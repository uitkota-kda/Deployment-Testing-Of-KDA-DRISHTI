import React, { useState, useEffect } from 'react';
import { Info, CheckCircle2, AlertCircle, Clock, PauseCircle } from 'lucide-react';

export const renderStatusBadge = (status) => {
  if (!status || status === 'On Track') {
    return (
      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <CheckCircle2 size={12} /> ON TRACK
      </span>
    );
  }
  if (status === 'Delay' || status.startsWith('Delayed:')) {
    return (
      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <AlertCircle size={12} /> {status.startsWith('Delayed:') ? status.toUpperCase() : 'DELAYED'}
      </span>
    );
  }
  if (status === 'On Hold') {
    return (
      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <PauseCircle size={12} /> ON HOLD
      </span>
    );
  }
  if (status.startsWith('Pending:')) {
    return (
      <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <Clock size={12} /> {status.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
      <Info size={12} /> {status.toUpperCase()}
    </span>
  );
};

export function InfoItem({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  );
}

export const renderDynamicFields = (config, location, formData, setFormData) => {
  if (!config || !config.fields) return null;
  const fields = config.fields.filter(f => f.isActive && f.location === location);
  if (fields.length === 0) return null;

  return (
    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '0.5rem', gridColumn: '1 / -1' }}>
      {fields.map(f => (
        <div key={f.fieldKey} className="input-group" style={{ marginBottom: 0 }}>
          <label>{f.displayName} {f.isRequired && <span style={{ color: 'var(--error)' }}>*</span>}</label>
          {f.fieldType === 'select' ? (
            <select
              value={formData.fieldData?.[f.fieldKey] || ''}
              onChange={e => setFormData({ ...formData, fieldData: { ...formData.fieldData, [f.fieldKey]: e.target.value } })}
            >
              <option value="">Select Option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <input
              type={f.fieldType}
              value={formData.fieldData?.[f.fieldKey] || ''}
              onChange={e => setFormData({ ...formData, fieldData: { ...formData.fieldData, [f.fieldKey]: e.target.value } })}
              placeholder={`Enter ${f.displayName}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export const renderDynamicInfo = (project, location) => {
  if (!project || !project.configVersion || !project.configVersion.fields) return null;
  try {
    const fieldData = project.fieldData ? JSON.parse(project.fieldData) : {};
    const fields = project.configVersion.fields.filter(f => f.isActive && f.location === location && fieldData[f.fieldKey]);
    if (fields.length === 0) return null;

    return fields.map(f => (
      <InfoItem key={f.fieldKey} label={f.displayName} value={fieldData[f.fieldKey]} icon={<Info size={16} />} />
    ));
  } catch (e) {
    return null;
  }
};

const geoCache = new Map();
export const ReverseGeocode = ({ lat, lon }) => {
  const [address, setAddress] = useState('Location details pending...');
  const cacheKey = `${lat},${lon}`;

  useEffect(() => {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      setAddress('Location not available');
      return;
    }

    if (geoCache.has(cacheKey)) {
      setAddress(geoCache.get(cacheKey));
      return;
    }

    const fetchAddr = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'KPMS-Project-Monitor/1.0'
          }
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        if (data && data.display_name) {
          geoCache.set(cacheKey, data.display_name);
          setAddress(data.display_name);
        } else {
          setAddress('Location not available');
        }
      } catch (err) {
        setAddress('Location not available');
      }
    };

    const timer = setTimeout(fetchAddr, 500);
    return () => clearTimeout(timer);
  }, [lat, lon, cacheKey]);

  return <span style={{ fontSize: '10.5pt' }}>{address}</span>;
};

export const YesNoToggle = ({ value, onChange, label, style }) => {
  return (
    <div style={{ ...style }}>
      {label && <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <div style={{ display: 'inline-flex', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '0.8rem', border: '1px solid var(--glass-border)' }}>
        <button
          type="button"
          onClick={() => onChange('Yes')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
            background: value === 'Yes' ? 'var(--success)' : 'transparent',
            color: value === 'Yes' ? 'white' : 'var(--text-secondary)',
            fontWeight: 800, transition: 'all 0.2s', fontSize: '0.85rem'
          }}
        >
          YES
        </button>
        <button
          type="button"
          onClick={() => onChange('No')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
            background: value === 'No' ? 'var(--error)' : 'transparent',
            color: value === 'No' ? 'white' : 'var(--text-secondary)',
            fontWeight: 800, transition: 'all 0.2s', fontSize: '0.85rem'
          }}
        >
          NO
        </button>
      </div>
    </div>
  );
};

export const StatusToggle = ({ value, onChange }) => {
  const options = [
    { label: 'On Track', value: 'On Track', color: 'var(--success)' },
    { label: 'On Hold', value: 'On Hold', color: '#f59e0b' },
    { label: 'Delay', value: 'Delay', color: 'var(--error)' }
  ];

  return (
    <div className="input-group">
      <label>Overall Status</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '0.8rem', border: '1px solid var(--glass-border)' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0.6rem 0.5rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
              background: value === opt.value ? opt.color : 'transparent',
              color: value === opt.value ? 'white' : 'var(--text-secondary)',
              fontWeight: 700, transition: 'all 0.2s', fontSize: '0.7rem',
              textTransform: 'uppercase'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
