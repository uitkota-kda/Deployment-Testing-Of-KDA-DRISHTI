import React from 'react';
import InfoItem from '../components/common/InfoItem';
import { Info } from 'lucide-react';

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
