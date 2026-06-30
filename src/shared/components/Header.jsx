import React from 'react';
import { Icon } from '../ds/Primitives';

const DOMAIN_LABELS = {
  finance: 'Finanzas',
  health:  'Salud',
  tasks:   'Tareas',
  habits:  'Hábitos',
};

export default function Header({ domain = 'home', onHome }) {
  const domainLabel = DOMAIN_LABELS[domain];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(251, 247, 238, 0.82)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      borderBottom: '1px solid rgba(31, 27, 20, 0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px',
      }}>
        {/* Logo mark — PWA app icon */}
        <img
          src="/icons/icon-192.png"
          alt="Mis Finanzas"
          width={34}
          height={34}
          style={{ borderRadius: 10, flexShrink: 0, display: 'block' }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-1)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            {domainLabel || 'Mis Finanzas'}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--fg-4)', marginTop: 1,
          }}>
            {domainLabel ? 'Dashboard personal' : 'Todo en un lugar'}
          </div>
        </div>

        {domain !== 'home' && onHome && (
          <button
            type="button"
            onClick={onHome}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              background: 'var(--bg-sunken)', color: 'var(--fg-2)',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
              flexShrink: 0,
              transition: 'background var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-default)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-sunken)'}
          >
            <Icon name="arrow_back" size={15} />
            Inicio
          </button>
        )}
      </div>
    </header>
  );
}
