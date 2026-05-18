import React from 'react';

export default function StatCard({ label, value, icon, onClick, active, color }) {
  const borderColor = color || (icon && icon.props && icon.props.color) || 'var(--primary)';
  return (
    <div
      className={`glass-card stat-card fade-in ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{
        padding: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        borderLeft: `5px solid ${borderColor}`,
        cursor: onClick ? 'pointer' : 'default',
        transform: active ? 'translateY(-5px) scale(1.02)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: active ? `0 20px 40px -15px ${borderColor}40` : '0 8px 20px -10px rgba(0,0,0,0.1)',
        background: active ? `linear-gradient(135deg, ${borderColor}15, rgba(255,255,255,0.05))` : 'var(--card-bg)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="stat-icon" style={{
        width: '56px', height: '56px', borderRadius: '16px',
        background: `${borderColor}15`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: borderColor,
        boxShadow: `inset 0 0 0 1px ${borderColor}30`
      }}>
        {React.cloneElement(icon, { size: 28, color: borderColor })}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800, marginBottom: '0.35rem' }}>{label}</div>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      </div>
      {active && (
        <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.2 }}>
           {React.cloneElement(icon, { size: 48, color: borderColor })}
        </div>
      )}
    </div>
  );
}
