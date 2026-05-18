import React from 'react';
import { LayoutDashboard } from 'lucide-react';

export default function Preloader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <div className="pulse" style={{ width: '100px', height: '100px', background: 'var(--primary)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)', boxShadow: '0 0 50px var(--primary-glow)' }}>
          <LayoutDashboard size={48} color="white" />
        </div>
      </div>
      <h1 style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        KDA <span style={{ color: 'var(--primary)' }}>DRISHTI</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Project Monitor</p>
      <div style={{ width: '200px', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', marginTop: '3rem', overflow: 'hidden' }}>
        <div className="progress-fill" style={{ width: '100%' }} />
      </div>
    </div>
  );
}
