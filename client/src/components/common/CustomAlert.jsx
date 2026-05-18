import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function CustomAlert({ show, message, onClose }) {
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }} className="fade-in">
      <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />
        <div style={{ background: 'rgba(99, 102, 241, 0.15)', width: '70px', height: '70px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', transform: 'rotate(-5deg)' }}>
          <AlertCircle size={36} color="var(--primary)" />
        </div>
        <h2 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>Notification</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1.05rem' }}>{message}</p>
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', height: 'auto', fontSize: '1rem', fontWeight: 600, background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', border: 'none', borderRadius: '12px' }}
          onClick={onClose}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
