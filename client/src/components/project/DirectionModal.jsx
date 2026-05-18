import React, { useState, useContext } from 'react';
import { MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

export default function DirectionModal({ project, userId, onClose, onSuccess }) {
  const { theme } = useContext(AuthContext);
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/projects/${project.id}/directions`, { direction });
      onSuccess();
    } catch (err) {
      alert(err.message || "Failed to submit direction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: window.innerWidth < 600 ? 'flex-start' : 'center', 
      paddingTop: window.innerWidth < 600 ? '2rem' : '0',
      padding: '1rem' 
    }}>
      <div className="glass-card modal-content slide-down" style={{ 
        padding: window.innerWidth < 600 ? '1.5rem' : '2.5rem',
        maxWidth: '500px',
        height: window.innerWidth < 600 ? '370px' : 'auto',
        margin: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: window.innerWidth < 600 ? '0.75rem' : '1.5rem' }}>
          <div style={{ 
            width: window.innerWidth < 600 ? '36px' : '48px', 
            height: window.innerWidth < 600 ? '36px' : '48px', 
            background: 'var(--accent-soft)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <MessageSquare size={window.innerWidth < 600 ? 18 : 24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: window.innerWidth < 600 ? '1.15rem' : '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Issue Direction</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.1rem' }}>Admin instruction for {project.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{ marginBottom: window.innerWidth < 600 ? '1rem' : '1.75rem' }}>
            <label style={{ color: 'var(--text-primary)', opacity: 0.8, fontWeight: 600, fontSize: '0.8rem' }}>Direction Details</label>
            <textarea
              rows={window.innerWidth < 600 ? "3" : "6"}
              placeholder="Provide clear instructions..."
              value={direction}
              onChange={e => setDirection(e.target.value)}
              required
              style={{
                width: '100%', padding: '1rem', background: 'var(--glass-bg)',
                color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '1rem',
                fontSize: '0.9rem', lineHeight: 1.5, resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: window.innerWidth < 600 ? '1.25rem' : '2.5rem' }}>
            <button type="button" className="btn" style={{ flex: 1, height: '3rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', fontSize: '0.9rem' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '3rem', fontSize: '0.9rem' }} disabled={loading}>
              {loading ? "..." : "Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
