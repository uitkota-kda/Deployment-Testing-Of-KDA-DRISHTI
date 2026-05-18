import React, { useState, useEffect, useContext } from 'react';
import { TrendingUp } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';

export default function ProjectBarChart({ project }) {
  const { theme } = useContext(AuthContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1000);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1000);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activities = (project.pertActivities || []).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (activities.length === 0) return null;

  const startTimes = activities.map(a => new Date(a.startDate).getTime());
  const endTimes = activities.map(a => new Date(a.endDate).getTime());
  const overallStart = Math.min(...startTimes);
  const overallEnd = Math.max(...endTimes);
  const totalSpan = overallEnd - overallStart || 1;

  const getStatusColor = (act) => {
    if (act.progress >= 100) return '#10b981';
    if (new Date() > new Date(act.endDate)) return '#ef4444';
    return '#6366f1';
  };

  return (
    <div className="glass-card fade-in" style={{ padding: isMobile ? '1rem' : '2.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.25rem' }}>
            <TrendingUp size={24} color="var(--primary)" /> Activity Timeline Analysis
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Visual breakdown of schedules, deadlines, and completion status</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', background: 'var(--glass-bg)', padding: '0.75rem 1.25rem', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}></div> Completed
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#6366f1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)' }}></div> In Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }}></div> Overdue
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activities.map((act, idx) => {
          const actStart = new Date(act.startDate).getTime();
          const actEnd = new Date(act.endDate).getTime();
          const leftPct = ((actStart - overallStart) / totalSpan) * 100;
          const widthPct = ((actEnd - actStart) / totalSpan) * 100;
          const statusColor = getStatusColor(act);
          const isOverdue = new Date() > new Date(act.endDate) && act.progress < 100;

          return (
            <div key={act.id || idx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '0.75rem' : '2rem', padding: isMobile ? '1rem' : '0', background: isMobile ? 'var(--glass-bg)' : 'transparent', borderRadius: '1rem', border: isMobile ? '1px solid var(--glass-border)' : 'none' }}>
              <div style={{ minWidth: isMobile ? '100%' : '180px', flexShrink: 0 }}>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{act.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.05)' }}>
                    {act.weightage}% Weight
                  </span>
                  {isOverdue && <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#ef4444' }}>⚠️ DELAYED</span>}
                </div>
              </div>

              {isMobile && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '-0.5rem', marginBottom: '-0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Start Date</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{formatDate(act.startDate)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>End Date</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{formatDate(act.endDate)}</span>
                  </div>
                </div>
              )}

              <div style={{ flex: 1, position: 'relative', height: '36px', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: '6px',
                    bottom: '6px',
                    background: statusColor,
                    opacity: 0.1,
                    borderRadius: '6px'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    width: `${(act.progress / 100) * widthPct}%`,
                    top: '6px',
                    bottom: '6px',
                    background: `linear-gradient(90deg, ${statusColor} 0%, ${statusColor}dd 100%)`,
                    borderRadius: '6px',
                    boxShadow: `0 0 20px ${statusColor}33`,
                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '8px'
                  }}
                />
                {!isMobile && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
                      letterSpacing: '0.5px'
                    }}>
                      {formatDate(act.startDate)} — {formatDate(act.endDate)}
                    </span>
                  </div>
                )}
              </div>

              {!isMobile && (
                <div style={{ minWidth: '80px', textAlign: 'right' }}>
                  <p style={{
                    fontWeight: 900,
                    color: statusColor,
                    fontSize: '1.1rem',
                    margin: 0,
                    fontVariantNumeric: 'tabular-nums'
                  }}>{act.progress}%</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Progress</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
