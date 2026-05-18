import React from 'react';

export const YesNoToggle = ({ value, onChange }) => (
  <div style={{ display: 'inline-flex', background: 'var(--glass-bg)', borderRadius: '0.6rem', padding: '0.2rem', border: '1px solid var(--glass-border)' }}>
    <button
      type="button"
      onClick={() => onChange('Yes')}
      style={{
        padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
        background: value === 'Yes' ? 'var(--success)' : 'transparent',
        color: value === 'Yes' ? 'white' : 'var(--text-muted)',
        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s'
      }}
    >
      YES
    </button>
    <button
      type="button"
      onClick={() => onChange('No')}
      style={{
        padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
        background: value === 'No' ? 'var(--error)' : 'transparent',
        color: value === 'No' ? 'white' : 'var(--text-muted)',
        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s'
      }}
    >
      NO
    </button>
  </div>
);

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export const normalizeDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
};

export const sanitizeMobile = (val) => {
  return val.replace(/\D/g, '').slice(0, 10);
};
