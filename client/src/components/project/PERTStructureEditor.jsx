import React, { useState } from 'react';
import { Settings, X, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { formatDateForInput } from '../../utils/dateUtils';

export default function PERTStructureEditor({ project, userId, onClose, onSuccess }) {
  const [activities, setActivities] = useState((project.pertActivities || []).map(a => ({
    ...a,
    startDate: formatDateForInput(a.startDate),
    endDate: formatDateForInput(a.endDate)
  })));
  const [load, setLoad] = useState(false);

  const addRow = () => setActivities([...activities, { name: '', weightage: 0, startDate: '', endDate: '', progress: 0 }]);
  const removeRow = (idx) => setActivities(activities.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (project.workStarted !== 'Yes') {
      alert('PERT structure can only be modified after project work has officially started at site.');
      return;
    }
    const totalW = activities.reduce((sum, a) => sum + parseFloat(a.weightage || 0), 0);
    if (Math.abs(totalW - 100) > 0.01) {
      alert(`Total weightage must be exactly 100%. Current: ${totalW}%`);
      return;
    }

    if (activities.some(a => !a.name || !a.startDate || !a.endDate)) {
      alert('All fields are mandatory for every activity.');
      return;
    }

    for (const a of activities) {
      if (new Date(a.startDate) > new Date(a.endDate)) {
        alert(`Error in Activity "${a.name}": Start Date cannot be later than Completion Date.`);
        return;
      }
    }

    setLoad(true);
    try {
      await api.post(`/projects/${project.id}/pert`, { activities, userId });
      alert('PERT Structure updated successfully.');
      onSuccess();
    } catch (err) {
      alert(err.message || 'Failed to update PERT structure.');
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content fade-in-up">
        <div className="responsive-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={22} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Modify PERT Structure</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="responsive-modal-body">
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Exclusive Access: DEO Structural Override</p>

          {activities.map((a, idx) => (
            <div key={idx} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--glass-bg)', position: 'relative', border: '1px solid var(--glass-border)' }}>
              {activities.length > 1 && (
                <button onClick={() => removeRow(idx)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,0,0,0.1)', color: 'var(--error)', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>Remove</button>
              )}
              <div className="input-group">
                <label>Activity Name</label>
                <input value={a.name} onChange={e => {
                  const next = [...activities];
                  next[idx].name = e.target.value;
                  setActivities(next);
                }} />
              </div>
              <div className="responsive-input-grid" style={{ gap: '1rem' }}>
                <div className="input-group">
                  <label>Weightage (%)</label>
                  <input type="number" value={a.weightage} onChange={e => {
                    const next = [...activities];
                    next[idx].weightage = e.target.value;
                    setActivities(next);
                  }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--primary)" /> Start Date
                  </label>
                  <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(a.startDate)} onChange={e => {
                    const next = [...activities];
                    next[idx].startDate = e.target.value;
                    setActivities(next);
                  }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--primary)" /> End Date
                  </label>
                  <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(a.endDate)} onChange={e => {
                    const next = [...activities];
                    next[idx].endDate = e.target.value;
                    setActivities(next);
                  }} />
                </div>
              </div>
            </div>
          ))}

          <button className="btn" style={{ width: '100%', border: '1px dashed var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', marginBottom: '2rem' }} onClick={addRow}>+ Add Activity</button>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} style={{ flex: 2 }} disabled={load}>
              {load ? 'Saving Changes...' : 'Save PERT Structure'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
