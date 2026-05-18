import React, { useContext } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';

export default function ProjectVerticalBarChart({ project }) {
  const { theme } = useContext(AuthContext);
  const activities = [...(project.pertActivities || [])].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (activities.length === 0) return null;

  const data = activities.map(act => ({
    name: act.name,
    progress: act.progress,
    weightage: act.weightage,
    startDate: formatDate(act.startDate),
    endDate: formatDate(act.endDate),
    status: act.progress >= 100 ? 'Completed' : (new Date() > new Date(act.endDate) ? 'Delayed' : 'On Track')
  }));

  const moreCount = Math.max(0, activities.length - 12);
  const minChartWidth = Math.max(800, activities.length * 150);

  return (
    <div className="glass-card fade-in" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
      <div style={{ borderBottom: '3px solid var(--text-primary)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Official PERT Activity Performance Matrix
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 700 }}>Strict Grid Alignment • Physical Progress Ledger</p>

          {project.overallStatus === 'Delay' && (project.statusDelayBrief || project.statusDelayReasons) && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--error-soft-bg)', border: `1px solid var(--error-soft-border)`, borderRadius: '8px', borderLeft: `4px solid var(--error)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} color="var(--error)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--error-strong-text)', textTransform: 'uppercase' }}>Official Delay Reason</span>
              </div>
              {project.overallStatus === 'Delay' && project.statusDelayReasons && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {(() => {
                    try {
                      const r = typeof project.statusDelayReasons === 'string' ? JSON.parse(project.statusDelayReasons) : (project.statusDelayReasons || []);
                      const arr = Array.isArray(r) ? r : [r];
                      return arr.filter(Boolean).map((reason, i) => (
                        <span key={i} style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{reason}</span>
                      ));
                    } catch (e) {
                      return project.statusDelayReasons ? [<span key="0" style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{project.statusDelayReasons}</span>] : null;
                    }
                  })()}
                </div>
              )}
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0, lineHeight: '1.4' }}>
                {project.statusDelayBrief}
              </p>
            </div>
          )}
        </div>
        {moreCount > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', background: 'var(--accent-soft)', padding: '4px 12px', border: '1px solid var(--glass-border)' }}>+ {moreCount} MORE ACTIVITIES DETAILED IN LOGS</span>}
      </div>

      <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '20px' }} className="custom-scrollbar chart-container-with-labels">
        <div style={{ height: '550px', width: `${minChartWidth}px`, padding: '0 10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 40, right: 30, left: 0, bottom: 120 }}
              barGap={20}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
              <ReferenceLine y={0} stroke="var(--text-primary)" strokeWidth={3} />
              <XAxis
                dataKey="name"
                interval={0}
                axisLine={{ stroke: 'var(--text-primary)', strokeWidth: 2 }}
                tick={false}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={{ stroke: 'var(--glass-border)' }}
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: 'var(--glass-bg)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div style={{ background: 'var(--secondary)', border: '2px solid var(--primary)', padding: '1rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', zIndex: 1000, borderRadius: '8px' }}>
                        <p style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{item.name}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            <span style={{ fontWeight: 800 }}>Timeline:</span> {item.startDate} – {item.endDate}
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            <span style={{ fontWeight: 800 }}>Progress:</span> {item.progress}%
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            <span style={{ fontWeight: 800 }}>Weightage:</span> {item.weightage}%
                          </p>
                          <p style={{ fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                            <span style={{ fontWeight: 800 }}>Status:</span>
                            <span style={{ marginLeft: '4px', fontWeight: 900, color: item.status === 'Completed' ? '#10b981' : (item.status === 'Delayed' ? '#ef4444' : '#6366f1') }}>
                              {item.status.toUpperCase()}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="progress" barSize={60} radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.status === 'Completed' ? '#10b981' : (entry.status === 'Delayed' ? '#ef4444' : '#6366f1')} />
                ))}

                <LabelList
                  dataKey="progress"
                  position="top"
                  formatter={(v) => `${v}%`}
                  style={{ fill: 'var(--text-primary)', fontWeight: 900, fontSize: '1rem' }}
                />

                <LabelList
                  dataKey="name"
                  content={(props) => {
                    const { x, y, width, value, index } = props;
                    const item = data[index];
                    const baseY = 400;
                    return (
                      <g transform={`translate(${x + width / 2},${baseY + 30})`}>
                        <text x={0} y={0} textAnchor="middle" style={{ fill: 'var(--text-primary)', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                          {value.length > 25 ? value.substring(0, 23) + '...' : value}
                        </text>
                        <text x={0} y={22} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontWeight: 800, fontSize: '0.7rem' }}>
                          {item.startDate} – {item.endDate}
                        </text>
                        <text x={0} y={40} textAnchor="middle" style={{ fill: 'var(--primary)', fontWeight: 900, fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                          W: {item.weightage}%
                        </text>
                        <rect x={-40} y={50} width={80} height={20} rx={4} fill={item.status === 'Completed' ? '#10b98115' : (item.status === 'Delayed' ? '#ef444415' : '#6366f115')} />
                        <text x={0} y={64} textAnchor="middle" style={{ fill: item.status === 'Completed' ? '#10b981' : (item.status === 'Delayed' ? '#ef4444' : '#6366f1'), fontWeight: 900, fontSize: '0.65rem' }}>
                          {item.status.toUpperCase()}
                        </text>
                      </g>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      <div style={{ marginTop: '3rem', display: 'flex', gap: '2.5rem', justifyContent: 'center', padding: '1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
        {['Completed', 'On Track', 'Delayed'].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
            <div style={{ width: 14, height: 14, borderRadius: '4px', background: s === 'Completed' ? '#10b981' : (s === 'On Track' ? '#6366f1' : '#ef4444') }}></div>
            {s.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
