#!/usr/bin/env python3
"""
Reporte de transferencias a una cuenta — búsqueda directa en Gmail.

Busca en Gmail (API directa) los correos de notificación de Bancolombia que
reporten transferencias a una cuenta destino, extrae monto y fecha, y genera un
PDF corporativo simple con el detalle y el total.

Self-contained: reutiliza la conexión a Firestore (utils.conectar_db) y el token
de Gmail ya guardado, sin depender del pipeline de IA.

Uso:
    python3 scripts/reporte_transferencias.py
    python3 scripts/reporte_transferencias.py --account 3114096566 --after 2026/01/01
    python3 scripts/reporte_transferencias.py --out ~/Desktop/reporte.pdf

Dependencias: firebase-admin, google-api-python-client, google-auth,
beautifulsoup4, reportlab.
"""

import os
import re
import sys
import json
import argparse
import datetime

from bs4 import BeautifulSoup
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# conectar_db vive en la raíz del repo
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import conectar_db  # noqa: E402

from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)

GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
BOGOTA = datetime.timezone(datetime.timedelta(hours=-5))
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

# "Transferiste $444,000.00 desde tu cuenta 2823 a la cuenta *3114096566 el 25/06/2026 a las 22:45."
TRANSFER_RE = re.compile(
    r"Transferiste\s*\$\s*([\d.,]+)\s*desde tu cuenta\s*(\w+)\s*"
    r"a la cuenta\s*\*?(\d+)\s*el\s*(\d{2}/\d{2}/\d{4})\s*a las\s*(\d{1,2}:\d{2})",
    re.IGNORECASE,
)

# Marca / colores corporativos
INK = colors.HexColor('#0F3D3A')      # teal oscuro (header)
ACCENT = colors.HexColor('#13ECDA')   # teal de marca
ROW_ALT = colors.HexColor('#F2FAF9')
MUTED = colors.HexColor('#6B7B79')


# ---------------------------------------------------------------------------
# Gmail (auth mínima reutilizando el token de Firestore)
# ---------------------------------------------------------------------------
def gmail_service(db):
    doc = db.collection('gmail_auth').document('token').get()
    if not doc.exists:
        raise RuntimeError("No hay token de Gmail en Firestore (gmail_auth/token).")
    info = doc.to_dict()
    creds = Credentials.from_authorized_user_info(info, GMAIL_SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            db.collection('gmail_auth').document('token').set(json.loads(creds.to_json()))
        else:
            raise RuntimeError("Token de Gmail inválido y no refrescable.")
    return build('gmail', 'v1', credentials=creds)


def email_text(payload):
    parts = []

    def walk(p):
        for part in p.get('parts', []):
            mime = part.get('mimeType', '')
            data = part.get('body', {}).get('data')
            if mime == 'text/html' and data:
                import base64
                html = base64.urlsafe_b64decode(data).decode('utf-8', 'replace')
                parts.append(BeautifulSoup(html, 'html.parser').get_text(' '))
            elif mime == 'text/plain' and data:
                import base64
                parts.append(base64.urlsafe_b64decode(data).decode('utf-8', 'replace'))
            elif 'parts' in part:
                walk(part)

    if 'parts' in payload:
        walk(payload)
    else:
        data = payload.get('body', {}).get('data')
        if data:
            import base64
            decoded = base64.urlsafe_b64decode(data).decode('utf-8', 'replace')
            if 'html' in payload.get('mimeType', ''):
                decoded = BeautifulSoup(decoded, 'html.parser').get_text(' ')
            parts.append(decoded)
    return re.sub(r'\s+', ' ', ' '.join(parts))


# ---------------------------------------------------------------------------
# Búsqueda + parseo
# ---------------------------------------------------------------------------
def fetch_transfers(service, account, after):
    query = f"{account} after:{after.replace('-', '/')}"
    print(f"📫 Buscando en Gmail: {query!r}")
    res = service.users().messages().list(userId='me', q=query, maxResults=200).execute()
    msgs = res.get('messages', [])
    print(f"   {len(msgs)} correos coinciden con la búsqueda.")

    rows, unmatched = [], 0
    for m in msgs:
        data = service.users().messages().get(userId='me', id=m['id'], format='full').execute()
        text = email_text(data.get('payload', {}))
        match = TRANSFER_RE.search(text)
        if not match or not match.group(3).endswith(account[-6:]):
            unmatched += 1
            continue
        amount = float(match.group(1).replace(',', ''))
        src, dest = match.group(2), match.group(3)
        d = datetime.datetime.strptime(match.group(4), "%d/%m/%Y").date()
        rows.append({"date": d, "time": match.group(5), "amount": amount, "src": src, "dest": dest})

    rows.sort(key=lambda r: (r["date"], r["time"]))
    return rows, len(msgs), unmatched


def fmt_cop(n):
    return "$ " + f"{int(round(n)):,}".replace(",", ".")


def fmt_date(d):
    return f"{d.day:02d} {MESES[d.month - 1]} {d.year}"


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------
def build_pdf(rows, account, after, out_path, n_emails, unmatched):
    doc = SimpleDocTemplate(
        out_path, pagesize=letter,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title="Reporte de transferencias",
    )
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle('t', parent=styles['Title'], textColor=colors.white,
                             fontSize=20, leading=24, alignment=0)
    h_sub = ParagraphStyle('s', parent=styles['Normal'], textColor=colors.white,
                           fontSize=10, leading=14, alignment=0)
    foot = ParagraphStyle('f', parent=styles['Normal'], textColor=MUTED, fontSize=8, leading=11)

    total = sum(r["amount"] for r in rows)
    periodo = f"Desde {after} · {len(rows)} transferencias"

    # Banda de encabezado
    header = Table([[Paragraph("Reporte de transferencias", h_title)],
                    [Paragraph(f"Cuenta destino <b>*{account}</b> &nbsp;·&nbsp; {periodo}", h_sub)]],
                   colWidths=[doc.width])
    header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), INK),
        ('LEFTPADDING', (0, 0), (-1, -1), 16), ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (0, 0), 16), ('BOTTOMPADDING', (-1, -1), (-1, -1), 14),
        ('LINEBELOW', (0, 0), (-1, 0), 0, INK),
    ]))

    # Tabla de movimientos
    data = [["#", "Fecha", "Hora", "Cuenta origen", "Monto"]]
    for i, r in enumerate(rows, 1):
        data.append([str(i), fmt_date(r["date"]), r["time"], f"*{r['src']}", fmt_cop(r["amount"])])
    data.append(["", "", "", "TOTAL", fmt_cop(total)])

    tbl = Table(data, colWidths=[12 * mm, 38 * mm, 20 * mm, 40 * mm, 44 * mm], repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), INK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, colors.HexColor('#DDE7E5')),
        # Fila total
        ('BACKGROUND', (0, -1), (-1, -1), ACCENT),
        ('FONTNAME', (3, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (3, -1), (-1, -1), 11),
        ('TEXTCOLOR', (0, -1), (-1, -1), INK),
        ('TOPPADDING', (0, -1), (-1, -1), 10), ('BOTTOMPADDING', (0, -1), (-1, -1), 10),
    ]
    for i in range(1, len(rows) + 1):  # zebra
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), ROW_ALT))
    tbl.setStyle(TableStyle(style))

    generado = datetime.datetime.now(BOGOTA).strftime("%d/%m/%Y %H:%M")
    nota = (f"Generado el {generado} (hora Colombia) a partir de la búsqueda directa en Gmail. "
            f"{n_emails} correos coincidieron con la búsqueda; {len(rows)} se reconocieron como "
            f"transferencias a la cuenta destino"
            + (f"; {unmatched} no coincidieron con el formato esperado." if unmatched else "."))

    doc.build([header, Spacer(1, 14), tbl, Spacer(1, 16), Paragraph(nota, foot)])
    return total


def main():
    ap = argparse.ArgumentParser(description="Reporte PDF de transferencias a una cuenta (vía Gmail).")
    ap.add_argument('--account', default='3114096566', help="Cuenta destino a buscar.")
    ap.add_argument('--after', default='2026/01/01', help="Fecha desde (YYYY/MM/DD).")
    ap.add_argument('--out', default=None, help="Ruta del PDF de salida.")
    args = ap.parse_args()

    out = args.out or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        f"reporte_transferencias_{args.account}.pdf")

    db = conectar_db()
    service = gmail_service(db)
    rows, n_emails, unmatched = fetch_transfers(service, args.account, args.after)
    if not rows:
        print("⚠️ No se encontraron transferencias que coincidan.")
        return
    total = build_pdf(rows, args.account, args.after, out, n_emails, unmatched)
    print(f"\n✅ {len(rows)} transferencias · total {fmt_cop(total)}")
    print(f"📄 PDF: {out}")


if __name__ == '__main__':
    main()
