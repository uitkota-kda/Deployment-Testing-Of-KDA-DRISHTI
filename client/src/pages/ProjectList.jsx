import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { getProjectStage } from '../utils/workflowUtils';
import { renderStatusBadge } from '../components/common/UIHelpers';
import { formatDate } from '../utils/dateUtils';

export default function ProjectList() {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [viewBin, setViewBin] = useState(false);
  const [viewMode, setViewMode] = useState('CARDS'); // CARDS or TABLE
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [viewBin, user]);

  const fetchProjects = () => {
    setLoading(true);
    api.get(`/projects`, {
      params: {
        onlyDeleted: viewBin,
        isAdmin: user?.role === 'ADMIN',
        _t: Date.now()
      }
    }).then(res => {
      // Handle both {success: true, data: []} and direct array response
      const data = res.success ? res.data : (Array.isArray(res) ? res : []);
      setProjects(Array.isArray(data) ? data : []);
    }).catch(err => {
      console.error("Error fetching projects:", err);
      setProjects([]);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Move this project to Recycle Bin?")) {
      await api.patch(`/projects/${id}/delete`, { userId: user?.id });
      fetchProjects();
    }
  };

  const handleRestore = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Restore this project to active monitoring?")) {
      await api.patch(`/projects/${id}/restore`, { userId: user?.id });
      fetchProjects();
    }
  };

  const handlePermanentDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("CRITICAL: This will permanently delete the project and ALL its history. Proceed?")) {
      await api.delete(`/projects/${id}/permanent`, { headers: { userid: user?.id } });
      fetchProjects();
    }
  };

  const handleEmptyBin = async () => {
    if (window.confirm("ARE YOU SURE? This will PERMANENTLY DELETE all projects in the Recycle Bin. This action cannot be undone.")) {
      try {
        await api.delete(`/projects/empty-bin`, { headers: { userid: user?.id } });
        fetchProjects();
      } catch (err) {
        alert(err.message || "Failed to empty bin");
      }
    }
  };

  const filteredProjects = (projects || []).filter(p => {
    if (!p) return false;
    const matchesSearch =
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brief || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.inchargeName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const stage = getProjectStage(p);
    const matchesFilter =
      activeFilter === 'ALL' ||
      (activeFilter === 'COMPLETED' && stage === 'COMPLETED') ||
      (activeFilter === 'ONGOING' && stage !== 'COMPLETED') ||
      (activeFilter === 'DELAY' && p.overallStatus === 'Delay' && stage !== 'COMPLETED');

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter, viewBin]);

  const totalPages = Math.ceil(filteredProjects.length / pageSize);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '1rem' }} className="fade-in">
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="pulse" style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Synchronizing Authority Records...</p>
        </div>
      ) : (
        <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{viewBin ? "Recycle Bin" : "Project Master"}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{viewBin ? "Deleted projects awaiting permanent action" : "Authority's central monitored repository"}</p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', flex: 1, maxWidth: '700px', padding: '0.6rem', borderRadius: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'relative', flex: '1 1 250px', minWidth: 0 }}>
            <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.8 }} size={20} />
            <input
              type="text"
              placeholder="Filter by name, brief description or engineer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '3.5rem', margin: 0, height: '3.5rem', border: '1px solid var(--input-border)',
                background: 'var(--input-bg)', borderRadius: '0.85rem', fontSize: '1rem', width: '100%', color: 'var(--text-primary)'
              }}
            />
          </div>
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            style={{
              flex: '1 1 200px', minWidth: '150px', height: '3.5rem', margin: 0, border: '1px solid var(--input-border)',
              background: 'var(--input-bg)', borderRadius: '0.85rem', fontWeight: 700,
              color: 'var(--text-primary)', padding: '0 1.25rem', cursor: 'pointer', appearance: 'auto'
            }}
          >
            <option value="ALL">All Portfolios</option>
            <option value="ONGOING">Ongoing Works</option>
            <option value="DELAY">Delayed / Stalled</option>
            <option value="COMPLETED">Completed Stage</option>
          </select>
          {user.role === 'ADMIN' && (
            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 100%' }}>
              <button
                className="btn"
                onClick={() => setViewBin(!viewBin)}
                style={{
                  background: viewBin ? 'var(--error)' : 'var(--error-soft-bg)',
                  color: viewBin ? 'white' : 'var(--error-strong-text)',
                  border: `1px solid ${viewBin ? 'var(--error)' : 'var(--error-soft-border)'}`,
                  textTransform: 'none',
                  flex: 1
                }}
              >
                {viewBin ? "Back to Active" : "Recycle Bin"}
              </button>
              {viewBin && projects.length > 0 && (
                <button
                  className="btn"
                  onClick={handleEmptyBin}
                  style={{ background: 'var(--error)', color: 'white', flex: 1 }}
                >
                  Empty Bin
                </button>
              )}
            </div>
          )}
          <div className="desktop-only" style={{ display: 'flex', background: 'var(--glass-bg)', borderRadius: '0.75rem', padding: '0.25rem' }}>
            <button
              onClick={() => setViewMode('CARDS')}
              style={{
                padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                background: viewMode === 'CARDS' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'CARDS' ? 'white' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', fontWeight: 600
              }}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              style={{
                padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                background: viewMode === 'TABLE' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'TABLE' ? 'white' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', fontWeight: 600
              }}
            >
              Table
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'CARDS' ? (
        <div className="responsive-grid-auto">
          {paginatedProjects.map(p => {
            const stage = getProjectStage(p);
            return (
              <div key={p.id} className="glass-card hover-card" style={{ cursor: 'pointer', opacity: p.isDeleted ? 0.7 : 1 }} onClick={() => navigate(`/projects/${p.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className={`badge ${p.isDeleted ? 'badge-error' : (stage === 'COMPLETED' ? 'badge-success' : 'badge-warning')}`} style={{ fontSize: '0.65rem' }}>
                    {p.isDeleted ? "DELETED (RECYCLE BIN)" : stage}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{p.id}</span>
                </div>
                <div className="card-header-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{p.name}</h3>

                  <div className="card-actions-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: p.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: p.type === 'CONSULTANCY' ? '#a855f7' : '#6366f1', fontWeight: 800, border: `1px solid ${p.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {p.type}
                    </span>

                    {user.role === 'ADMIN' && p.isDeleted ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'var(--success)', color: 'white', borderRadius: '0.5rem' }} onClick={(e) => handleRestore(e, p.id)}>RESTORE</button>
                        <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'var(--error)', color: 'white', borderRadius: '0.5rem' }} onClick={(e) => handlePermanentDelete(e, p.id)}>PURGE</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {user.role !== 'VIEWER' && !p.isDeleted && (
                          <button
                            className="btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.5rem' }}
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}?update=true`); }}
                          >
                            QUICK UPDATE
                          </button>
                        )}
                        {user.role === 'ADMIN' && !p.isDeleted && (
                          <button
                            className="btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'var(--error-soft-bg)', color: 'var(--error-strong-text)', border: '1px solid var(--error-soft-border)', borderRadius: '0.5rem' }}
                            onClick={(e) => handleDelete(e, p.id)}
                          >
                            DELETE
                          </button>
                        )}
                        {(user.role === 'VIEWER') && (
                          <button
                            className="btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.5rem' }}
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                          >
                            GIVE DIRECTION
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>{p.brief}</p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.5rem' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.fundingAgency}</p>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>₹{p.estimatedCost}L</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Physical</p>
                    <p style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.currentProgress}%</p>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginTop: '0.75rem' }}>
                  <div className="progress-fill" style={{ width: `${p.currentProgress}%` }}></div>
                </div>

                {stage !== 'COMPLETED' && ((p.overallStatus === 'Delay' && p.statusDelayBrief) || (p.workStarted === 'No' && p.delayBrief) || (p.overallStatus === 'On Hold' && p.statusHoldReason)) && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ fontSize: '0.65rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {p.overallStatus === 'On Hold' ? 'Reason of Hold' : 'Reason of Delay'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.overallStatus === 'On Hold' ? p.statusHoldReason : (p.overallStatus === 'Delay' ? p.statusDelayBrief : p.delayBrief)}
                    </p>
                  </div>
                )}

                {p.todaysUpdateNote && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Today's Remark</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.todaysUpdateNote}</p>
                  </div>
                )}

                {p.updates && p.updates[0] && p.updates[0].remarks && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Final Remarks</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic' }}>"{p.updates[0].remarks}"</p>
                  </div>
                )}
              </div>
            );
          })}
          {filteredProjects.length === 0 && (
            <div style={{ padding: '4rem', textAlign: 'center', gridColumn: '1/-1' }}>
              <p style={{ color: 'var(--text-muted)' }}>No projects found in this repository.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card static-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1400px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>ID</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Project Name & Brief</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Funding</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Cost (L)</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Executive Engineer</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Progress</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Stage</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Quality</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Delay/Hold Remark</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Today's Remark</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Final Remark</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Stip. Comp.</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map(p => {
                  const stage = getProjectStage(p);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: p.isDeleted ? 'rgba(239,68,68,0.03)' : 'transparent', transition: 'background 0.2s' }} className="table-row-hover">
                      <td data-label="ID" style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{p.id}</td>
                      <td data-label="Project Name & Brief" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brief}</div>
                      </td>
                      <td data-label="Type" style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: p.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: p.type === 'CONSULTANCY' ? '#a855f7' : '#6366f1', fontWeight: 700, border: `1px solid ${p.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.2)'}` }}>
                          {p.type}
                        </span>
                      </td>
                      <td data-label="Funding" style={{ padding: '1rem', fontSize: '0.8rem' }}>{p.fundingAgency}</td>
                      <td data-label="Cost (L)" style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>{p.estimatedCost}</td>
                      <td data-label="Executive Engineer" style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.inchargeName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.inchargeMobile}</div>
                      </td>
                      <td data-label="Progress" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--glass-bg)', borderRadius: '3px', overflow: 'hidden', width: '60px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ width: `${p.currentProgress}%`, height: '100%', background: 'var(--primary)' }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{p.currentProgress}%</span>
                        </div>
                      </td>
                      <td data-label="Stage" style={{ padding: '1rem' }}>
                        <span className={`badge ${stage === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6rem' }}>{stage}</span>
                      </td>
                      <td data-label="Status" style={{ padding: '1rem' }}>
                        {renderStatusBadge(p.overallStatus)}
                      </td>
                      <td data-label="Quality" style={{ padding: '1rem' }}>
                        <span className="badge" style={{ fontSize: '0.6rem', background: p.qualitySampling === 'Yes' ? 'var(--success-soft-bg)' : 'var(--warning-soft-bg)', color: p.qualitySampling === 'Yes' ? 'var(--success-strong-text)' : 'var(--warning-strong-text)', border: `1px solid ${p.qualitySampling === 'Yes' ? 'var(--success-soft-border)' : 'var(--warning-soft-border)'}` }}>
                          {p.qualitySampling || 'No'}
                        </span>
                      </td>
                      <td data-label="Delay/Hold Remark" style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--error-strong-text)', maxWidth: '180px' }}>
                        {stage !== 'COMPLETED' ? (p.overallStatus === 'On Hold' ? p.statusHoldReason : (p.overallStatus === 'Delay' ? p.statusDelayBrief : (p.workStarted === 'No' ? p.delayBrief : '-'))) : '-'}
                      </td>
                      <td data-label="Today's Remark" style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '150px' }}>{p.todaysUpdateNote || '-'}</td>
                      <td data-label="Final Remark" style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--accent)', maxWidth: '150px', fontStyle: 'italic' }}>
                        {p.updates && p.updates[0] && p.updates[0].remarks ? `"${p.updates[0].remarks}"` : '-'}
                      </td>
                      <td data-label="Stip. Comp." style={{ padding: '1rem', fontSize: '0.8rem' }}>{p.stipulatedCompletionDate ? formatDate(p.stipulatedCompletionDate) : '-'}</td>
                      <td data-label="Actions" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div className="mobile-btn-group" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.2)' }} onClick={() => navigate(`/projects/${p.id}`)}>VIEW</button>
                          {user.role === 'ADMIN' && p.isDeleted ? (
                            <>
                              <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', background: 'var(--success)', color: 'white' }} onClick={(e) => handleRestore(e, p.id)}>RESTORE</button>
                              <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', background: 'var(--error)', color: 'white' }} onClick={(e) => handlePermanentDelete(e, p.id)}>PURGE</button>
                            </>
                          ) : (
                            <>
                              {user.role !== 'VIEWER' && !p.isDeleted && (
                                <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', background: 'var(--primary)', color: 'white' }} onClick={() => navigate(`/projects/${p.id}?update=true`)}>UPDATE</button>
                              )}
                              {user.role === 'ADMIN' && !p.isDeleted && (
                                <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} onClick={(e) => handleDelete(e, p.id)}>DEL</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <tr><td colSpan="14" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No projects matched your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '3rem', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: '1.5rem', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            disabled={currentPage === 1}
            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo(0, 0); }}
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', opacity: currentPage === 1 ? 0.4 : 1, transition: 'all 0.2s' }}
          >
            Previous
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const page = idx + 1;
              if (totalPages > 7 && page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 2) {
                if (page === 2 || page === totalPages - 1) return <span key={page} style={{ color: 'var(--text-muted)', padding: '0 0.5rem' }}>...</span>;
                return null;
              }
              return (
                <button
                  key={page}
                  onClick={(e) => { e.stopPropagation(); setCurrentPage(page); window.scrollTo(0, 0); }}
                  className={`btn ${currentPage === page ? 'btn-primary' : ''}`}
                  style={{ 
                    minWidth: '38px', height: '38px', padding: 0, 
                    borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
                    background: currentPage === page ? 'var(--primary)' : 'var(--glass-bg)',
                    border: currentPage === page ? 'none' : '1px solid var(--glass-border)',
                    color: currentPage === page ? 'white' : 'var(--text-primary)',
                    boxShadow: currentPage === page ? '0 4px 12px var(--primary-glow)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>
          <button 
            className="btn" 
            disabled={currentPage === totalPages}
            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo(0, 0); }}
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', opacity: currentPage === totalPages ? 0.4 : 1, transition: 'all 0.2s' }}
          >
            Next
          </button>
        </div>
      )}
    </>
  )}
</div>
  );
}
