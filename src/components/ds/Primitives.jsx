/* eslint-disable react-refresh/only-export-components */
import React from 'react';

/* =========================================================================
   Mis Finanzas — Design System Primitives
   ========================================================================= */

// ---------------------------------------------------------------------------
// Icon — Material Symbols Outlined wrapper
// ---------------------------------------------------------------------------
export const Icon = ({ name, size = 20, fill = false, color, style = {}, className = '' }) => (
  <span
    className={`material-symbols-outlined${fill ? ' filled' : ''} ${className}`}
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${fill ? 500 : 400}, 'GRAD' 0, 'opsz' 24`,
      color: color || 'inherit',
      lineHeight: 1,
      flexShrink: 0,
      ...style,
    }}
  >
    {name}
  </span>
);

// ---------------------------------------------------------------------------
// Eyebrow — uppercase tracking label
// ---------------------------------------------------------------------------
export const Eyebrow = ({ children, color = 'var(--fg-3)', style = {} }) => (
  <div style={{
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color,
    lineHeight: 1,
    ...style,
  }}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Card — three archetypes
// ---------------------------------------------------------------------------
export const Card = ({
  variant = 'floating',
  moduleHue,
  padding = 16,
  style = {},
  onClick,
  children,
  className = '',
}) => {
  const base = {
    borderRadius: 'var(--r-2xl)',
    padding,
    boxSizing: 'border-box',
    cursor: onClick ? 'pointer' : 'default',
    transition: `transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
  };
  const variants = {
    floating: { background: 'var(--bg-raised)', boxShadow: 'var(--shadow-sm)' },
    outlined: { background: 'transparent', border: '1px solid var(--border-default)' },
    inset:    { background: 'var(--bg-sunken)', boxShadow: 'var(--shadow-inset)', borderRadius: 'var(--r-xl)' },
  };
  const moduleBar = moduleHue ? { borderLeft: `4px solid ${moduleHue}` } : {};

  return (
    <div
      className={className}
      style={{ ...base, ...variants[variant], ...moduleBar, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pill / chip
// ---------------------------------------------------------------------------
export const Pill = ({ children, variant = 'neutral', icon, onClick, style = {} }) => {
  const variants = {
    neutral:  { bg: 'var(--ink-50)',      fg: 'var(--fg-2)' },
    success:  { bg: 'var(--success-50)',  fg: 'var(--success-700)' },
    danger:   { bg: 'var(--danger-50)',   fg: 'var(--danger-700)' },
    warning:  { bg: 'var(--warning-50)',  fg: 'var(--warning-700)' },
    clay:     { bg: 'var(--clay-50)',     fg: 'var(--clay-600)' },
    olive:    { bg: 'var(--olive-50)',    fg: 'var(--olive-600)' },
    ink:      { bg: 'var(--ink-800)',     fg: '#fff' },
    outline:  { bg: 'transparent',        fg: 'var(--fg-2)', border: '1px solid var(--border-default)' },
  };
  const v = variants[variant] || variants.neutral;
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 9999,
        fontSize: 11, fontWeight: 700,
        background: v.bg, color: v.fg, border: v.border || 'none',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
};

// ---------------------------------------------------------------------------
// DeltaPill — trend indicator on KPIs
// ---------------------------------------------------------------------------
export const DeltaPill = ({ value, suffix = '%' }) => {
  const positive = value >= 0;
  return (
    <Pill variant={positive ? 'success' : 'danger'} icon={positive ? 'north_east' : 'south_east'}>
      {positive ? '+' : '−'}{Math.abs(value).toFixed(1)}{suffix}
    </Pill>
  );
};

// ---------------------------------------------------------------------------
// IconTile — tinted square icon container
// ---------------------------------------------------------------------------
export const IconTile = ({ icon, hue = 'clay', size = 36 }) => {
  const palette = {
    clay:    { bg: 'var(--clay-50)',    fg: 'var(--clay-600)' },
    olive:   { bg: 'var(--olive-50)',   fg: 'var(--olive-600)' },
    amber:   { bg: 'var(--amber-50)',   fg: 'var(--amber-500)' },
    plum:    { bg: 'var(--plum-50)',    fg: 'var(--plum-400)' },
    ink:     { bg: 'var(--ink-50)',     fg: 'var(--ink-700)' },
    success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
    danger:  { bg: 'var(--danger-50)',  fg: 'var(--danger-700)' },
    warning: { bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
  };
  const p = palette[hue] || palette.clay;
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: p.bg, color: p.fg, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={Math.round(size * 0.52)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// SparkLine
// ---------------------------------------------------------------------------
export const SparkLine = ({ points = [30, 22, 28, 14, 20, 8, 12, 6], color = 'var(--clay-500)', fill = true, height = 40 }) => {
  const max = Math.max(...points), min = Math.min(...points);
  const range = Math.max(1, max - min);
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = ((p - min) / range) * 30 + 5;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {fill && <path d={`${d} L 100 40 L 0 40 Z`} fill={color} opacity="0.1" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
export const ProgressBar = ({ value, max, color = 'var(--clay-500)', warningAt = 0.9, height = 8 }) => {
  const pct = Math.min(100, (value / max) * 100);
  const over = value > max;
  const warn = !over && value / max >= warningAt;
  const fill = over ? 'var(--danger-500)' : warn ? 'var(--warning-500)' : color;
  return (
    <div style={{ height, background: 'var(--bg-sunken)', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: fill,
        borderRadius: 9999, transition: `width var(--dur-slow) var(--ease-out)`,
      }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------
export const Segmented = ({ options, value, onChange, size = 'md' }) => {
  const pads = size === 'sm' ? '6px 10px' : '8px 14px';
  const font = size === 'sm' ? 11 : 12;
  return (
    <div style={{
      display: 'flex', background: 'var(--bg-sunken)', padding: 3, borderRadius: 12,
      boxShadow: 'var(--shadow-inset)', gap: 2,
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              padding: pads, fontSize: font, fontWeight: active ? 800 : 600,
              fontFamily: 'inherit',
              background: active ? 'var(--bg-raised)' : 'transparent',
              color: active ? 'var(--ink-800)' : 'var(--fg-3)',
              borderRadius: 9,
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              transition: `all var(--dur-fast) var(--ease-out)`,
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Money display — de-emphasised currency code
// ---------------------------------------------------------------------------
export const Money = ({ amount, currency = 'COP', sign = false, size = 'lg' }) => {
  const sizes = {
    sm: { num: 14, cur: 9 },
    md: { num: 20, cur: 11 },
    lg: { num: 28, cur: 12 },
    xl: { num: 40, cur: 16 },
  };
  const s = sizes[size] || sizes.lg;
  const abs = Math.abs(amount);
  const neg = amount < 0;
  const formatted = abs.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 5,
      fontWeight: 800, color: 'var(--fg-1)',
      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      fontSize: s.num, lineHeight: 1,
    }}>
      {neg ? '−' : sign ? '+' : ''}{formatted}
      <span style={{ fontSize: s.cur, color: 'var(--fg-3)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
        {currency}
      </span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Field label wrapper (for forms)
// ---------------------------------------------------------------------------
export const Field = ({ label, optional, children }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {optional ? <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>opcional</span> : null}
    </div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// TextInput (design system styled)
// ---------------------------------------------------------------------------
export const TextInput = ({ value, onChange, placeholder, mono, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%', boxSizing: 'border-box',
      border: '1px solid var(--border-default)',
      background: 'var(--bg-default)', borderRadius: 12, padding: '11px 12px',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 14,
      color: 'var(--fg-1)', outline: 'none',
      transition: `border-color var(--dur-fast) var(--ease-out)`,
    }}
    onFocus={e => { e.target.style.borderColor = 'var(--clay-500)'; }}
    onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
  />
);

// ---------------------------------------------------------------------------
// SelectInput
// ---------------------------------------------------------------------------
export const SelectInput = ({ value, onChange, options }) => (
  <div style={{
    position: 'relative', display: 'flex', alignItems: 'center',
    background: 'var(--bg-default)', border: '1px solid var(--border-default)',
    borderRadius: 12, padding: '0 12px',
  }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        flex: 1, border: 'none', outline: 'none', background: 'transparent',
        padding: '11px 0', fontSize: 14, color: 'var(--fg-1)',
        fontFamily: 'var(--font-sans)', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <Icon name="expand_more" size={18} color="var(--fg-3)" />
  </div>
);

// ---------------------------------------------------------------------------
// Category hue map (single source of truth)
// ---------------------------------------------------------------------------
export const HUE_BY_CATEGORY = {
  food:        'clay',
  software:    'amber',
  services:    'olive',
  salud:       'plum',
  transporte:  'ink',
  ingreso:     'olive',
  transfer:    'plum',
  general:     'ink',
};

export const hueForCategory = (cat) => HUE_BY_CATEGORY[cat?.toLowerCase()] || 'ink';

export const hueColorVar = (hue) => ({
  clay:  'var(--clay-500)',
  olive: 'var(--olive-500)',
  amber: 'var(--amber-300)',
  plum:  'var(--plum-400)',
  ink:   'var(--ink-700)',
}[hue] || 'var(--ink-400)');
