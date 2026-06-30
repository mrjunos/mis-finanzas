import React, { useMemo } from 'react';
import { useFinance } from '../../domains/finance/context/FinanceContext';
import { useHealth } from '../../domains/health/context/HealthContext';
import { useTasks } from '../../domains/tasks/context/TasksContext';
import { useHabits } from '../../domains/habits/context/HabitsContext';
import { Icon, Card, Eyebrow, Editorial } from '../ds/Primitives';
import { formatCompactNumber } from '../utils/format';

const EXCHANGE_RATE = 4100;
const toCOP = (t) => (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount);

function DomainCard({ color, icon, title, stats, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: 18, borderRadius: 24, border: 'none', cursor: 'pointer',
                background: color, color: '#fff',
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.28)',
                transition: 'transform var(--dur-fast) var(--ease-out)',
                textAlign: 'left', width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
            <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
            }}>
                <Icon name={icon} size={22} fill />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 8 }}>
                {title}
            </div>
            {stats.map((s, i) => (
                <div key={i} style={{ marginBottom: i < stats.length - 1 ? 4 : 0 }}>
                    <span style={{ fontSize: i === 0 ? 22 : 14, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                        {s.value}
                    </span>
                    {s.label && (
                        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, marginLeft: 5 }}>{s.label}</span>
                    )}
                </div>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.75, fontSize: 12, fontWeight: 700 }}>
                Ver detalle <Icon name="arrow_forward" size={14} />
            </div>
        </button>
    );
}

function LinkCard({ href, icon, title, subtitle }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                borderRadius: 20, textDecoration: 'none', color: 'var(--fg-1)',
                background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'var(--clay-50)', color: 'var(--clay-600)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon name={icon} size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-1)' }}>{title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
            </div>
            <Icon name="open_in_new" size={16} color="var(--fg-3)" />
        </a>
    );
}

export default function HomeScreen({ onSwitchDomain }) {
    const today = useMemo(() => new Date(), []);
    const month = today.getMonth();
    const year = today.getFullYear();

    // Finance stats
    const { transactions } = useFinance();
    const monthSpent = useMemo(() => {
        let spent = 0;
        transactions.forEach(t => {
            if (t.type === 'transfer' || t.isTransfer) return;
            if (t.currency !== 'COP' && t.currency !== undefined && t.currency !== 'COP') return;
            const d = t.date instanceof Date ? t.date : new Date(t.date);
            if (d.getMonth() === month && d.getFullYear() === year) {
                if (t.type === 'debit') spent += toCOP(t);
            }
        });
        return spent;
    }, [transactions, month, year]);

    // Health stats
    const { todayFoodSummary } = useHealth();

    // Tasks stats
    const { pendingCount, lists } = useTasks();

    // Habits stats
    const { todayCompleted, habits, bestStreak } = useHabits();

    const greetingHour = today.getHours();
    const greeting = greetingHour < 12 ? 'Buenos días' : greetingHour < 18 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Greeting */}
            <div>
                <Eyebrow style={{ marginBottom: 6 }}>
                    {today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Eyebrow>
                <Editorial size={28}>
                    {greeting}, <span style={{ color: 'var(--clay-500)' }}>¿cómo vas hoy?</span>
                </Editorial>
            </div>

            {/* Domain cards — 2x2 grid on mobile, row on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <DomainCard
                    color="var(--ink-800)"
                    icon="account_balance_wallet"
                    title="Finanzas"
                    stats={[
                        { value: `$ ${formatCompactNumber(monthSpent)}`, label: 'gastado este mes' },
                    ]}
                    onClick={() => onSwitchDomain('finance')}
                />
                <DomainCard
                    color="var(--olive-600, #5E6738)"
                    icon="restaurant"
                    title="Salud"
                    stats={[
                        { value: todayFoodSummary.kcal.toLocaleString('es-CO'), label: 'kcal hoy' },
                    ]}
                    onClick={() => onSwitchDomain('health')}
                />
                <DomainCard
                    color="var(--ink-600, #4A4035)"
                    icon="checklist"
                    title="Tareas"
                    stats={[
                        { value: pendingCount, label: `pendiente${pendingCount !== 1 ? 's' : ''}` },
                        { value: `${lists.length} lista${lists.length !== 1 ? 's' : ''}` },
                    ]}
                    onClick={() => onSwitchDomain('tasks')}
                />
                <DomainCard
                    color="var(--clay-500)"
                    icon="local_fire_department"
                    title="Hábitos"
                    stats={[
                        { value: `${todayCompleted}/${habits.length}`, label: 'completados' },
                        { value: `${bestStreak} días`, label: 'mejor racha' },
                    ]}
                    onClick={() => onSwitchDomain('habits')}
                />
            </div>

            {/* External links — below the modules */}
            <div>
                <Eyebrow style={{ marginBottom: 10 }}>Explora</Eyebrow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <LinkCard
                        href="https://mrjunos.github.io/infografias/"
                        icon="auto_graph"
                        title="Infografías"
                        subtitle="Visualizaciones"
                    />
                    <LinkCard
                        href="https://mrjunos.github.io/cv/"
                        icon="badge"
                        title="Mi CV"
                        subtitle="Perfil profesional"
                    />
                </div>
            </div>

            {/* Quick tip */}
            <Card padding={16} variant="outlined" style={{ borderStyle: 'dashed' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name="lightbulb" size={22} color="var(--amber-500, #DCA63B)" fill />
                    <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                        Toca una tarjeta para entrar al módulo. Usa el botón <strong>+</strong> para agregar una transacción desde cualquier pantalla.
                    </div>
                </div>
            </Card>
        </div>
    );
}
