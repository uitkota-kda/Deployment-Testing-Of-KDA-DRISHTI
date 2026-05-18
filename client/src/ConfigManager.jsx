import React, { useState, useEffect } from 'react';
import { 
  Settings, Plus, Save, Trash2, ArrowUp, ArrowDown, 
  CheckCircle, XCircle, AlertCircle, Layers, Type, 
  ChevronRight, ChevronDown, Check, Send
} from 'lucide-react';
import { api } from './services/api';

const ConfigManager = () => {
  const [draft, setDraft] = useState({ stages: [], fields: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('stages');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchDraft();
  }, []);

  const fetchDraft = async () => {
    try {
      const res = await api.get('/config/draft');
      setDraft(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load configuration draft' });
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await api.post('/config/draft/update', {
        stages: draft.stages.map(({ id, versionId, ...rest }) => rest),
        fields: draft.fields.map(({ id, versionId, ...rest }) => rest)
      });
      setMessage({ type: 'success', text: 'Draft saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const publishConfig = async () => {
    if (!window.confirm("Are you sure? Publishing will create a new version. New projects will use this config immediately. Existing projects will continue with their current version.")) return;
    
    setSaving(true);
    try {
      await api.post('/config/publish');
      setMessage({ type: 'success', text: 'Configuration published successfully!' });
      fetchDraft();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    const newStage = {
      stageKey: `STAGE_${Date.now()}`,
      displayName: 'New Stage',
      sequenceOrder: draft.stages.length + 1,
      isActive: true
    };
    setDraft({ ...draft, stages: [...draft.stages, newStage] });
  };

  const addField = () => {
    const newField = { 
      fieldKey: `FIELD_${Date.now()}`, 
      displayName: 'New Custom Field', 
      fieldType: 'text', 
      isRequired: false, 
      isActive: true,
      location: 'MASTER',
      sequenceOrder: draft.fields.length
    };
    setDraft({ ...draft, fields: [...draft.fields, newField] });
  };

  const updateStage = (index, updates) => {
    const next = [...draft.stages];
    next[index] = { ...next[index], ...updates };
    setDraft({ ...draft, stages: next });
  };

  const updateField = (index, updates) => {
    const next = [...draft.fields];
    next[index] = { ...next[index], ...updates };
    setDraft({ ...draft, fields: next });
  };

  const moveStage = (index, direction) => {
    const next = [...draft.stages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Re-assign sequence order
    const ordered = next.map((s, i) => ({ ...s, sequenceOrder: i + 1 }));
    setDraft({ ...draft, stages: ordered });
  };

  if (loading) return <div className="loading-state">Loading configuration...</div>;

  return (
    <div className="config-manager fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings className="text-primary" size={32} />
            System Configuration
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Manage project lifecycle stages and dynamic fields.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={saveDraft} disabled={saving}>
            <Save size={18} /> Save Draft
          </button>
          <button className="btn btn-primary" onClick={publishConfig} disabled={saving} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <Send size={18} /> Publish Version
          </button>
        </div>
      </header>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}` }}>
          {message.type === 'success' ? <CheckCircle size={20} color="#10b981" /> : <AlertCircle size={20} color="#ef4444" />}
          <span style={{ color: message.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{message.text}</span>
        </div>
      )}

      <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <button 
          className={`tab ${activeTab === 'stages' ? 'active' : ''}`} 
          onClick={() => setActiveTab('stages')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', background: activeTab === 'stages' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: activeTab === 'stages' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s' }}
        >
          Project Stages (Workflows)
        </button>
        <button 
          className={`tab ${activeTab === 'fields' ? 'active' : ''}`} 
          onClick={() => setActiveTab('fields')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', background: activeTab === 'fields' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: activeTab === 'fields' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s' }}
        >
          Dynamic Custom Fields
        </button>
      </div>

      <div className="content">
        {activeTab === 'stages' ? (
          <div className="stages-grid">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Lifecycle Stages</h3>
              <button className="btn btn-primary btn-sm" onClick={addStage}><Plus size={16} /> Add Stage</button>
            </div>
            <div className="stages-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {draft.stages.sort((a,b) => a.sequenceOrder - b.sequenceOrder).map((stage, idx) => (
                <div key={idx} className="glass-card config-list-item" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center', borderLeft: `4px solid ${stage.isActive ? 'var(--primary)' : 'var(--text-muted)'}` }}>
                  <div className="order-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button className="icon-btn" onClick={() => moveStage(idx, -1)} disabled={idx === 0} title="Move Up">
                      <ArrowUp size={16} color="var(--text-primary)" />
                    </button>
                    <button className="icon-btn" onClick={() => moveStage(idx, 1)} disabled={idx === draft.stages.length - 1} title="Move Down">
                      <ArrowDown size={16} color="var(--text-primary)" />
                    </button>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Stage Key (Fixed)</label>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{stage.stageKey}</div>
                  </div>

                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Display Name (Editable)</label>
                    <input 
                      className="input-minimal"
                      value={stage.displayName} 
                      onChange={e => updateStage(idx, { displayName: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0', border: 'none', borderBottom: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div className="toggle-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active</span>
                      <input 
                        type="checkbox" 
                        checked={stage.isActive} 
                        onChange={e => updateStage(idx, { isActive: e.target.checked })} 
                      />
                    </div>
                    <button className="icon-btn text-error" onClick={() => {
                      if (window.confirm("Remove this stage from draft?")) {
                        setDraft({ ...draft, stages: draft.stages.filter((_, i) => i !== idx) });
                      }
                    }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="fields-grid">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Custom Fields</h3>
              <button className="btn btn-primary btn-sm" onClick={addField}><Plus size={16} /> Add Field</button>
            </div>
            <div className="fields-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {draft.fields.map((field, idx) => (
                <div key={idx} className="glass-card config-list-item" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center', borderLeft: `4px solid ${field.isActive ? 'var(--secondary)' : 'var(--text-muted)'}` }}>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Field Key</label>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{field.fieldKey}</div>
                  </div>

                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Label</label>
                    <input 
                      className="input-minimal"
                      value={field.displayName} 
                      onChange={e => updateField(idx, { displayName: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0', border: 'none', borderBottom: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem' }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Type</label>
                    <select 
                      value={field.fieldType} 
                      onChange={e => updateField(idx, { fieldType: e.target.value })}
                      style={{ 
                        width: '100%', 
                        background: 'var(--glass-bg)', 
                        border: '1px solid var(--glass-border)', 
                        color: 'var(--text-primary)', 
                        padding: '0.4rem', 
                        borderRadius: '8px', 
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="text" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Text</option>
                      <option value="number" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Number</option>
                      <option value="date" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Date</option>
                      <option value="select" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Select/Yes-No</option>
                    </select>
                  </div>

                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Location</label>
                    <select 
                      value={field.location || 'BOTTOM'} 
                      onChange={e => updateField(idx, { location: e.target.value })}
                      style={{ 
                        width: '100%', 
                        background: 'var(--glass-bg)', 
                        border: '1px solid var(--glass-border)', 
                        color: 'var(--text-primary)', 
                        padding: '0.4rem', 
                        borderRadius: '8px', 
                        cursor: 'pointer'
                      }}
                    >
                      <option value="TOP" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Top (Above Name)</option>
                      <option value="AFTER_NAME" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Project Name</option>
                      <option value="AFTER_BRIEF" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Description</option>
                      <option value="AFTER_FUNDING" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Funding Agency</option>
                      <option value="AFTER_COST" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Estimated Cost</option>
                      <option value="AFTER_EE" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Executive Engineer</option>
                      <option value="AFTER_CONSULTANT" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Consultant Details</option>
                      <option value="AFTER_CONTRACTOR" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Contractor Details</option>
                      <option value="AFTER_DATES" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>After Project Dates</option>
                      <option value="BOTTOM" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Bottom (End of Step 1)</option>
                      <option value="UPDATE_PROGRESS" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Update Flow: Progress Step</option>
                      <option value="UPDATE_STATUS" style={{ background: 'var(--secondary)', color: 'var(--text-primary)' }}>Update Flow: Overall Status Step</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                        <input type="checkbox" checked={field.isRequired} onChange={e => updateField(idx, { isRequired: e.target.checked })} /> Required
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                        <input type="checkbox" checked={field.isActive} onChange={e => updateField(idx, { isActive: e.target.checked })} /> Active
                      </label>
                    </div>
                    <button className="icon-btn text-error" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== idx) })}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .config-manager input:focus {
          outline: none;
          border-bottom-color: var(--primary) !important;
        }
        .icon-btn {
          background: rgba(255,255,255,0.05);
          border: none;
          color: white;
          padding: 0.4rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .icon-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.15);
        }
        .icon-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .text-error { color: #ef4444; }
        .text-primary { color: var(--primary); }
      `}} />
    </div>
  );
};

export default ConfigManager;
