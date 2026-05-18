import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjectStage } from '../utils/workflowUtils';
import { FileText, TrendingUp, CheckCircle2, Info } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/dashboard/StatCard';
import ProjectMap from '../components/dashboard/ProjectMap';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/projects', { params: { isAdmin: true } })
    ]).then(([statsRes, projectsRes]) => {
      setStats(statsRes.data);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    }).catch(err => {
      console.error(err);
      setError("Failed to load global analytics.");
    });
  }, []);

  const derivedStats = {
    total: projects.length,
    completed: projects.filter(p => p.status === 'COMPLETED' || getProjectStage(p) === 'COMPLETED').length,
    ongoing: projects.filter(p => p.status !== 'COMPLETED' && getProjectStage(p) !== 'COMPLETED').length,
    delayed: projects.filter(p => p.overallStatus === 'Delay' && getProjectStage(p) !== 'COMPLETED').length,
    dprSubmitted: projects.filter(p => (p.workflows || []).some(w => w.stepName.includes('DPR Submitted') && w.isCompleted)).length
  };

  const { filteredProjects, paginatedProjects, totalPages } = useMemo(() => {
    const filtered = projects.filter(p => {
      const stage = getProjectStage(p);
      if (filter === 'ALL') return true;
      if (filter === 'ONGOING') return p.status !== 'COMPLETED' && stage !== 'COMPLETED';
      if (filter === 'DELAY') return p.overallStatus === 'Delay' && stage !== 'COMPLETED';
      if (filter === 'COMPLETED') return p.status === 'COMPLETED' || stage === 'COMPLETED';
      if (filter === 'DPR_SUBMITTED') return (p.workflows || []).some(w => w.stepName.includes('DPR Submitted') && w.isCompleted);
      return true;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return { filteredProjects: filtered, paginatedProjects: paginated, totalPages };
  }, [projects, filter, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--error)' }}>{error}</p>
      <button className="btn" onClick={() => window.location.reload()}>Retry Sync</button>
    </div>
  );

  const typeData = [
    { name: 'Execution', value: stats?.typeDistribution?.execution || 0 },
    { name: 'Consultancy', value: stats?.typeDistribution?.consultancy || 0 }
  ];

  const COLORS = ['#6366f1', '#a855f7'];

  return (
    <div className="fade-in">
      <div className="glass-card" style={{ 
        marginBottom: '2.5rem', 
        padding: '2rem 2.5rem',
        background: 'linear-gradient(135deg, var(--card-bg), rgba(255,255,255,0.02))',
        border: '1px solid var(--glass-border)'
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div className="viewer-title-box">
            <h1 className="viewer-title" style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Authority Dashboard
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>
              <p className="viewer-subtitle" style={{ margin: 0, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Global Monitoring & Infrastructure Analytics
              </p>
            </div>
          </div>
        </header>
      </div>

      <div className="dashboard-grid">
        <StatCard label="Total projects" value={derivedStats.total} icon={<FileText color="#6366f1" />} onClick={() => setFilter('ALL')} active={filter === 'ALL'} />
        <StatCard label="Ongoing Works" value={derivedStats.ongoing} icon={<TrendingUp color="#10b981" />} onClick={() => setFilter('ONGOING')} active={filter === 'ONGOING'} />
        <StatCard label="Delayed / Issues" value={derivedStats.delayed} icon={<Info color="#ef4444" />} onClick={() => setFilter('DELAY')} active={filter === 'DELAY'} />
        <StatCard label="Completed" value={derivedStats.completed} icon={<CheckCircle2 color="#f59e0b" />} onClick={() => setFilter('COMPLETED')} active={filter === 'COMPLETED'} />
        <StatCard label="DPRs Submitted" value={derivedStats.dprSubmitted} icon={<Info color="#a855f7" />} onClick={() => setFilter('DPR_SUBMITTED')} active={filter === 'DPR_SUBMITTED'} />
      </div>

      <div className="responsive-grid-auto" style={{ marginTop: '2rem' }}>
        <div className="glass-card" style={{ height: '400px' }}>
          <h4>Project Type Distribution</h4>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={typeData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ marginBottom: '1rem' }}>Geospatial Project Sites Overview</h4>
          <div style={{ flex: 1, borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            <ProjectMap projects={projects} />
          </div>
        </div>
      </div>
      <div className="glass-card static-card" style={{ marginTop: '2rem', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Global Project Leaderboard {filter !== 'ALL' ? `(${filter})` : ''}</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem', fontWeight: 500, width: '40px' }}>#</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Project Name</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>EE / Incharge</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Progress</th>
                <th style={{ padding: '1rem', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.map((p, i) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td data-label="#" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{String((currentPage - 1) * pageSize + i + 1).padStart(2, '0')}</td>
                  <td data-label="Project Name" style={{ fontWeight: 700 }}>
                    <div style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.type} WORK</div>
                  </td>
                  <td data-label="EE / Incharge" style={{ fontSize: '0.85rem' }}>{p.inchargeName}</td>
                  <td data-label="Progress">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="progress-bar" style={{ flex: 1, margin: 0, height: '6px' }}>
                        <div className="progress-fill" style={{ width: `${p.currentProgress}%` }}></div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.currentProgress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.6rem' }} onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}>DETAILS</button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found for current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', padding: '1.5rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--glass-bg)', opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={(e) => { e.stopPropagation(); setCurrentPage(idx + 1); }}
                  className={`btn ${currentPage === idx + 1 ? 'btn-primary' : ''}`}
                  style={{
                    minWidth: '35px', height: '35px', padding: 0,
                    borderRadius: '8px', fontSize: '0.8rem',
                    background: currentPage === idx + 1 ? 'var(--primary)' : 'var(--glass-bg)',
                    color: currentPage === idx + 1 ? 'white' : 'var(--text-primary)',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button
              className="btn"
              disabled={currentPage === totalPages}
              onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--glass-bg)', opacity: currentPage === totalPages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
