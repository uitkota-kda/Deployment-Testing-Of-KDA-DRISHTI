import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Search, FileText, CheckCircle2, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { getProjectStage } from '../utils/workflowUtils';
import OfficialReportView from '../components/dashboard/OfficialReportView';

function ReportTable({ projects, selectedIds, onToggleSelect }) {
  if (!projects || projects.length === 0) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem' }}>No projects found in this category.</p>;

  return (
    <div className="glass-card static-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <th style={{ padding: '1.25rem 1rem', width: '50px' }}>Select</th>
            <th style={{ padding: '1.25rem 1rem' }}>Project Details</th>
            <th style={{ padding: '1.25rem 1rem' }}>Incharge / Engineer</th>
            <th style={{ padding: '1.25rem 1rem' }}>Current Status / Remarks</th>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td data-label="Select" style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => onToggleSelect(p.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td data-label="Project Details" style={{ padding: '1.25rem 1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.brief || 'No description provided.'}</div>
              </td>
              <td data-label="Incharge" style={{ padding: '1.25rem 1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.inchargeName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{p.inchargeDesignation}</div>
              </td>
              <td data-label="Status/Remarks" style={{ padding: '1.25rem 1rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {p.todaysUpdateNote || p.statusDelayBrief || p.statusHoldReason || (p.workStarted === 'No' ? p.delayBrief : 'Monitoring active.')}
                </div>
              </td>
              <td data-label="Progress" style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{p.currentProgress.toFixed(1)}%</div>
                <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', margin: '0.5rem auto 0', overflow: 'hidden' }}>
                  <div style={{ width: `${p.currentProgress}%`, height: '100%', background: 'var(--primary)' }}></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showOfficialReport, setShowOfficialReport] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    api.get('/projects').then(res => {
      setProjects(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectedProjects = projects.filter(p => selectedIds.includes(p.id));

  const categorized = useMemo(() => {
    const result = {
      CONSULTANCY: { COMPLETED: [], ONGOING: { 'On Track': [], 'Delay': [], 'On Hold': [] } },
      EXECUTION: { COMPLETED: [], ONGOING: { 'On Track': [], 'Delay': [], 'On Hold': [] } }
    };

    projects.forEach(p => {
      const type = p.type || 'EXECUTION';
      const stage = getProjectStage(p);
      const term = searchTerm.toLowerCase();
      if (!p.name.toLowerCase().includes(term) && !(p.brief || '').toLowerCase().includes(term)) return;

      if (stage === 'COMPLETED' || p.status === 'COMPLETED') {
        result[type].COMPLETED.push(p);
      } else {
        const subStatus = p.overallStatus || 'On Track';
        if (result[type].ONGOING[subStatus]) {
          result[type].ONGOING[subStatus].push(p);
        } else {
          result[type].ONGOING['On Track'].push(p);
        }
      }
    });

    return result;
  }, [projects, searchTerm]);


  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '1400px', margin: '0 auto' }} className="fade-in reports-container">
      {showOfficialReport && (
        <OfficialReportView projects={selectedProjects} onClose={() => setShowOfficialReport(false)} />
      )}

      <header className="report-header no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div className="report-title-section">
          <h1 className="viewer-title">Compiled Project Reports</h1>
          <p className="viewer-subtitle">Centralized textual overview categorized by type and status</p>
        </div>
        <div className="report-actions-section" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="search-wrapper" style={{ position: 'relative', flex: '1 1 auto' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="report-search-input"
              style={{ padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', width: '100%', maxWidth: '280px' }}
            />
          </div>
          <button
            className="btn report-btn"
            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', opacity: selectedIds.length > 0 ? 1 : 0.5, flex: '1 1 auto' }}
            onClick={() => selectedIds.length > 0 && setShowOfficialReport(true)}
            disabled={selectedIds.length === 0}
          >
            <FileText size={18} /> <span className="btn-text">Official Report ({selectedIds.length})</span>
          </button>
        </div>
      </header>

      <div className="no-print">
        {['CONSULTANCY', 'EXECUTION'].map(type => (
          <div key={type} style={{ marginBottom: '4rem' }}>
            <div className="section-type-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ width: '8px', height: '32px', background: 'var(--primary)', borderRadius: '4px' }}></div>
              <h2 className="type-title" style={{ fontSize: '2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{type} PROJECTS</h2>
            </div>

            <div style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.75rem', width: 'fit-content' }}>
                <CheckCircle2 size={20} color="var(--success)" />
                <h3 style={{ color: 'var(--success)', margin: 0 }}>Completed Stage</h3>
              </div>
              <ReportTable projects={categorized[type].COMPLETED} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '0.5rem 1rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '0.75rem', width: 'fit-content' }}>
                <TrendingUp size={20} color="var(--primary)" />
                <h3 style={{ color: 'var(--primary)', margin: 0 }}>Ongoing Development</h3>
              </div>
              {['On Track', 'Delay', 'On Hold'].map(status => (
                <div key={status} style={{ marginBottom: '2.5rem', marginLeft: '1.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {status === 'On Track' ? <CheckCircle2 size={18} color="var(--success)" /> : status === 'Delay' ? <AlertCircle size={18} color="var(--error)" /> : <Clock size={18} color="var(--warning)" />}
                    <h4 style={{ margin: 0, color: status === 'On Track' ? 'var(--success)' : status === 'Delay' ? 'var(--error)' : 'var(--warning)', textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900, letterSpacing: '1px' }}>{status}</h4>
                  </div>
                  <ReportTable projects={categorized[type].ONGOING[status]} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
