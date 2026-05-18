import React, { useState, useEffect } from 'react';
import { History, User as UserIcon } from 'lucide-react';
import { api } from '../../services/api';

export default function ProjectLogs({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${projectId}/logs`)
      .then(res => setLogs(res.data))
      .catch(err => console.error("Error fetching logs:", err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading audit trails...</div>;

  return (
    <div className="glass-card" style={{ marginTop: '2rem', marginBottom: '2rem', padding: '2rem' }}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <History size={20} color="var(--primary)" /> Project Activity Log (Admin View)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
        {logs.map(log => (
          <div key={log.id} style={{ padding: '1rem', background: 'var(--glass-bg)', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.65rem' }}>{log.action.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <p style={{ fontSize: '0.9rem', margin: '0.5rem 0', color: 'var(--text-primary)' }}>{log.details}</p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <UserIcon size={12} /> {log.user.name} ({log.user.role}) {log.user.designation ? `• ${log.user.designation}` : ''}
            </div>
          </div>
        ))}
        {logs.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No logs recorded for this project.</p>}
      </div>
    </div>
  );
}
