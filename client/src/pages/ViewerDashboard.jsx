import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, LayoutDashboard, CheckCircle2, TrendingUp, AlertCircle,
  Clock, Search, Map as MapIcon, PieChart as PieChartIcon, AlertTriangle
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { getProjectStage, getCalculatedStatus } from '../utils/workflowUtils';
import { renderStatusBadge } from '../components/common/UIHelpers';
import StatCard from '../components/dashboard/StatCard';
import ProjectMap from '../components/dashboard/ProjectMap';

export default function ViewerDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/projects')
      .then(res => {
        setProjects(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Unable to sync project records from server.");
        setLoading(false);
      });
  }, []);

  const { total, completed, ongoing, onTrack, delayed, onHold, pieData, barData, filteredProjects, paginatedProjects, totalPages } = useMemo(() => {
    const stats = {
      total: (projects || []).length,
      completed: (projects || []).filter(p => p && (p.status === 'COMPLETED' || getProjectStage(p) === 'COMPLETED')).length,
      ongoing: (projects || []).filter(p => p && (p.status !== 'COMPLETED' && getProjectStage(p) !== 'COMPLETED')).length,
      onTrack: (projects || []).filter(p => p && p.overallStatus === 'On Track').length,
      delayed: (projects || []).filter(p => p && p.overallStatus === 'Delay').length,
      onHold: (projects || []).filter(p => p && p.overallStatus === 'On Hold').length,
    };

    const pie = [
      { name: 'Completed', value: stats.completed, color: '#a855f7' },
      { name: 'On Track', value: stats.onTrack, color: '#10b981' },
      { name: 'Delayed', value: stats.delayed, color: '#ef4444' },
      { name: 'On Hold', value: stats.onHold, color: '#f59e0b' }
    ].filter(d => d.value > 0);

    const reasons = {};
    (projects || []).forEach(p => {
      if (!p || getProjectStage(p) === 'COMPLETED') return;
      const r = p.overallStatus === 'On Hold' ? p.statusHoldReason : (p.overallStatus === 'Delay' ? p.statusDelayBrief : (p.workStarted === 'No' ? p.delayBrief : null));
      if (r) reasons[r] = (reasons[r] || 0) + 1;
    });

    const bar = Object.entries(reasons)
      .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const filtered = (projects || []).filter(p => {
      if (!p) return false;
      const isType = filter === 'ALL' || (filter === 'COMPLETED' ? (p.status === 'COMPLETED' || getProjectStage(p) === 'COMPLETED') : p.overallStatus === filter);
      const term = searchTerm.toLowerCase();
      const matchesSearch = (p.name || '').toLowerCase().includes(term) || (p.inchargeName || '').toLowerCase().includes(term);
      return isType && matchesSearch;
    }).sort((a, b) => (b.currentProgress || 0) - (a.currentProgress || 0));

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return { ...stats, pieData: pie, barData: bar, filteredProjects: filtered, paginatedProjects: paginated, totalPages };
  }, [projects, filter, searchTerm, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '100%', margin: '0' }} className="fade-in">
      <div className="glass-card" style={{
        marginBottom: '2.5rem',
        padding: '2rem 2.5rem',
        background: 'linear-gradient(135deg, var(--card-bg), rgba(255,255,255,0.02))',
        border: '1px solid var(--glass-border)'
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div className="viewer-title-box">
            <h1 className="viewer-title" style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Authority Control Center
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
              <p className="viewer-subtitle" style={{ margin: 0, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Executive Overview • {user?.name || 'User'}
              </p>
            </div>
          </div>

          <div className="viewer-actions" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'flex-end' }}>
            <div className="search-input-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
              <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.8 }} size={20} />
              <input
                type="text"
                placeholder="Search by project or engineer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.85rem 1.5rem 0.85rem 3.5rem', margin: 0, height: 'auto',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--input-bg)',
                  borderRadius: '1.25rem', fontSize: '0.95rem', width: '100%',
                  color: 'var(--text-primary)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s'
                }}
              />
            </div>
            <div className="sync-info" style={{ textAlign: 'right', minWidth: '150px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Last Sync: {new Date().toLocaleTimeString()}</div>
              <button className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }} onClick={() => window.location.reload()}>Refresh Sync</button>
            </div>
          </div>
        </header>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        <StatCard
          label="Total Works"
          value={total}
          icon={<LayoutDashboard color="#6366f1" />}
          onClick={() => setFilter('ALL')}
          active={filter === 'ALL'}
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={<CheckCircle2 color="#a855f7" />}
          onClick={() => setFilter('COMPLETED')}
          active={filter === 'COMPLETED'}
          color="#a855f7"
        />
        <StatCard
          label="On Track"
          value={onTrack}
          icon={<TrendingUp color="#10b981" />}
          onClick={() => setFilter('On Track')}
          active={filter === 'On Track'}
          color="#10b981"
        />
        <StatCard
          label="Delayed"
          value={delayed}
          icon={<AlertCircle color="#ef4444" />}
          onClick={() => setFilter('Delay')}
          active={filter === 'Delay'}
          color="#ef4444"
        />
        <StatCard
          label="On Hold"
          value={onHold}
          icon={<Clock color="#f59e0b" />}
          onClick={() => setFilter('On Hold')}
          active={filter === 'On Hold'}
          color="#f59e0b"
        />
      </div>

      <div className="responsive-grid-2-1" style={{ marginBottom: '3rem' }}>
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '450px' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}><MapIcon size={20} /> Project Site Location Map</h3>
          <div style={{ flex: 1, borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            <ProjectMap projects={projects} />
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem', minHeight: '450px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <PieChartIcon size={22} color="var(--primary)" /> Strategic Portfolio Matrix
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', background: 'var(--accent-soft)', color: 'var(--primary)', borderRadius: '20px', fontWeight: 700 }}>
              {total > 0 ? Math.min(100, ((onTrack + completed) / total * 100)).toFixed(0) : 0}% OPTIMIZED
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '1.5rem', 
            minHeight: '300px' 
          }}>
            <div style={{ position: 'relative', flex: '1 1 250px', minHeight: '250px' }}>
              {total > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}
                        itemStyle={{ color: 'white', fontSize: '0.85rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    textAlign: 'center', pointerEvents: 'none'
                  }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{total}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.25rem' }}>Works</div>
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No records</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem', paddingBottom: '1rem', flex: '1 1 200px' }}>
              {pieData.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{((item.value / total) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', marginTop: '0.4rem' }}>
                      <div style={{ width: `${(item.value / total) * 100}%`, height: '100%', background: item.color, borderRadius: '2px' }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}><BarChart3 size={20} /> Major Roadblocks (Delay Reasons)</h3>
        <div style={{ minHeight: 250 }}>
          {barData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
              {(() => {
                const maxBarCount = Math.max(...barData.map(b => b.count), 1);
                return barData.map((entry, index) => (
                  <div key={index} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', alignItems: 'flex-end', gap: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{entry.name}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#ef4444', fontSize: '1rem', marginRight: '4px' }}>{entry.count}</span>Works
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'var(--glass-bg)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${(entry.count / maxBarCount) * 100}%`, height: '100%', background: `rgba(239, 68, 68, ${1 - index * 0.15})`, borderRadius: '5px', transition: 'width 1s ease-out' }}></div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', color: 'var(--text-muted)' }}>No delays reported yet.</div>}
        </div>
      </div>

      <div className="glass-card static-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Project Leaderboard {filter !== 'ALL' ? `(${filter})` : ''}</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem', fontWeight: 500, width: '40px' }}>#</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Project Name</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Overall Status</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Reason of Delay/Hold</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Today's Remark</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Final Remarks</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Progress</th>
                <th style={{ padding: '1rem', fontWeight: 500, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.map((p, i) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td data-label="#" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{String((currentPage - 1) * pageSize + i + 1).padStart(2, '0')}</td>
                  <td data-label="Project Name" style={{ fontWeight: 700, minWidth: '200px' }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{p.brief}</div>
                  </td>
                  <td data-label="Type" style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>{p.type}</td>
                  <td data-label="Status">
                    <span className={p.status === 'COMPLETED' ? 'badge badge-success' : 'badge'} style={{ background: p.status === 'COMPLETED' ? '' : 'rgba(59, 130, 246, 0.15)', color: p.status === 'COMPLETED' ? '' : '#60a5fa', border: p.status === 'COMPLETED' ? '' : '1px solid rgba(59, 130, 246, 0.2)' }}>
                      {p.status}
                    </span>
                  </td>
                  <td data-label="Overall Status">
                    {getProjectStage(p) !== 'COMPLETED' ? renderStatusBadge(getCalculatedStatus(p)) : <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>-</span>}
                  </td>
                  <td data-label="Reason of Delay/Hold" style={{ fontSize: '0.85rem', maxWidth: '200px' }}>
                    <div style={{ color: p.overallStatus === 'Delay' ? '#ef4444' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getProjectStage(p) !== 'COMPLETED' ? (p.overallStatus === 'On Hold' ? (p.statusHoldReason || 'Not specified') : (p.overallStatus === 'Delay' ? (p.statusDelayBrief || 'Not specified') : (p.workStarted === 'No' ? (p.delayBrief || 'Work not started') : '-'))) : '-'}
                    </div>
                  </td>
                  <td data-label="Today's Remark" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '150px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.todaysUpdateNote || '-'}
                  </td>
                  <td data-label="Final Remarks" style={{ fontSize: '0.85rem', color: 'var(--accent)', maxWidth: '150px', fontStyle: 'italic', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.updates && p.updates[0] && p.updates[0].remarks ? `"${p.updates[0].remarks}"` : '-'}
                  </td>
                  <td data-label="Progress">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '120px' }}>
                      <div className="progress-bar" style={{ flex: 1, margin: 0, height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${p.currentProgress}%` }}></div>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '45px' }}>{p.currentProgress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <button className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.75rem', letterSpacing: '1px' }} onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}>DETAILS</button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan="10" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem', padding: '1.5rem 1rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', opacity: currentPage === 1 ? 0.4 : 1, transition: 'all 0.2s' }}
            >
              Previous
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const page = idx + 1;
                if (totalPages > 7 && page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} style={{ color: 'var(--text-muted)', padding: '0 0.5rem' }}>...</span>;
                  return null;
                }
                return (
                  <button
                    key={page}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(page); }}
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
              onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); }}
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', opacity: currentPage === totalPages ? 0.4 : 1, transition: 'all 0.2s' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
