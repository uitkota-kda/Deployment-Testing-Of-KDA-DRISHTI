import React, { useState, useEffect, useContext } from 'react';
import { TrendingUp } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';

export default function ProjectPERTChart({ project }) {
  const { theme } = useContext(AuthContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1150);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1150);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activities = (project.pertActivities || []).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (activities.length === 0) return null;

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const dayInMs = 24 * 60 * 60 * 1000;
  const threshold = 2 * dayInMs;

  const rawTimestamps = [];
  activities.forEach(a => {
    rawTimestamps.push(normalizeDate(a.startDate));
    rawTimestamps.push(normalizeDate(a.endDate));
  });

  const sortedTimestamps = [...new Set(rawTimestamps)].sort((a, b) => a - b);

  const groups = [];
  if (sortedTimestamps.length > 0) {
    let currentGroup = [sortedTimestamps[0]];
    for (let i = 1; i < sortedTimestamps.length; i++) {
      const prev = sortedTimestamps[i - 1];
      const curr = sortedTimestamps[i];
      if (curr - prev <= threshold) {
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);
  }

  const dateToNodeId = new Map();
  groups.forEach((group, idx) => {
    group.forEach(ts => dateToNodeId.set(ts, idx + 1));
  });

  const nodes = groups.map((group, idx) => ({ id: idx + 1, timestamp: group[0] }));

  const edges = activities.map((a, idx) => ({
    id: a.id,
    from: dateToNodeId.get(normalizeDate(a.startDate)),
    to: dateToNodeId.get(normalizeDate(a.endDate)),
    name: a.name,
    duration: Math.ceil((new Date(a.endDate) - new Date(a.startDate)) / dayInMs),
    progress: a.progress,
    isDelayed: new Date() > new Date(a.endDate) && a.progress < 100
  }));

  const nodeCount = nodes.length;

  const mainAxisLength = Math.max(isMobile ? 850 : 1000, nodeCount * (isMobile ? 220 : 260));
  const crossAxisLength = isMobile ? 500 : 600;

  const width = mainAxisLength;
  const height = crossAxisLength;

  const paddingMain = 120;
  const nodeRadius = 26;

  const getMain = (id) => paddingMain + ((id - 1) / (nodeCount - 1 || 1)) * (mainAxisLength - 2 * paddingMain);

  const getEdgePath = (edge, index) => {
    const main1 = getMain(edge.from);
    const main2 = getMain(edge.to);
    const crossCenter = crossAxisLength / 2;
    const span = edge.to - edge.from;

    const maxOffset = isMobile ? 180 : 240;
    const offsetAmount = isMobile ? (span > 1 ? 60 : 40) : (span > 1 ? 100 : 60);
    const offset = (index % 2 === 0 ? 1 : -1) * Math.min(maxOffset, offsetAmount * (Math.floor(index / 2) + 1));

    const targetCross = crossCenter + offset;

    const x1 = main1;
    const y1 = crossCenter;
    const x2 = main2;
    const y2 = crossCenter;

    const midX = (x1 + x2) / 2;
    const midY = targetCross;

    const path = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${targetCross} ${x2} ${y2}`;

    return { path, midX, midY, targetCross, span };
  };

  return (
    <div className="glass-card fade-in" style={{ marginBottom: '2rem', padding: isMobile ? '1rem' : '2rem' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <TrendingUp size={24} color="#6366f1" /> Execution PERT Network
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Full-scale project dependency map</p>
          {isMobile && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem' }}>
              <span>↔ SWIPE HORIZONTAL TO EXPLORE CHART</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)' }}></div>
            <span style={{ color: 'var(--text-primary)' }}>On Track</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}></div>
            <span style={{ color: 'var(--text-primary)' }}>Completed</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pert-chart-container::-webkit-scrollbar {
          height: 12px;
          display: block !important;
        }
        .pert-chart-container::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          margin: 0 20px;
        }
        .pert-chart-container::-webkit-scrollbar-thumb {
          background: var(--primary);
          border-radius: 10px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .pert-chart-container {
          scrollbar-width: auto;
          scrollbar-color: var(--primary) rgba(0,0,0,0.2);
        }
      ` }} />
      <div className="custom-scrollbar pert-chart-container" style={{ 
        width: '100%', 
        overflowX: 'auto', 
        overflowY: 'hidden',
        background: theme === 'dark' ? 'rgba(10, 15, 30, 0.6)' : 'rgba(0, 0, 0, 0.05)', 
        borderRadius: '1.5rem', 
        border: '1px solid var(--glass-border)', 
        boxShadow: theme === 'dark' ? 'inset 0 0 40px rgba(0,0,0,0.4)' : 'none',
        paddingBottom: '5px'
      }}>
        <svg width={width} height={height} style={{ display: 'block', minWidth: `${width}px` }}>
          <defs>
            <pattern id="gridPattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill={theme === 'dark' ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
            </pattern>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="completeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8" fill={theme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"} />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />

          {edges.map((edge, idx) => {
            const { path, midX, midY, targetCross, span } = getEdgePath(edge, idx);
            const isDelayed = edge.isDelayed;
            const isCompleted = edge.progress >= 100;
            const gradient = isCompleted ? "url(#completeGradient)" : (isDelayed ? "#ef4444" : "url(#edgeGradient)");

            const labelOffset = isMobile
              ? (targetCross > crossAxisLength / 2 ? 30 : -30) + (idx % 3 - 1) * 10
              : (targetCross > crossAxisLength / 2 ? 30 : -30) + (idx % 3 - 1) * 15;

            const textTransform = isMobile
              ? `translate(${midX + labelOffset}, ${midY})`
              : `translate(${midX}, ${midY + labelOffset})`;

            return (
              <g key={edge.id} className="pert-edge-group">
                <path
                  d={path}
                  fill="none"
                  stroke={gradient}
                  strokeWidth={isDelayed ? "6" : "4"}
                  strokeLinecap="round"
                  markerEnd="url(#arrowHead)"
                  style={{ transition: 'all 0.6s ease', opacity: (isCompleted || isDelayed) ? 1 : 0.7, strokeDasharray: isDelayed ? '10,5' : 'none' }}
                />

                <g transform={textTransform}>
                  <text textAnchor="middle" style={{ fill: isDelayed ? '#ef4444' : 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 800, textShadow: theme === 'dark' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>
                    {edge.name.length > 25 ? edge.name.substring(0, 22) + '...' : edge.name}
                    {isDelayed && " ⚠️"}
                  </text>
                  <text y="16" textAnchor="middle" style={{ fill: isCompleted ? '#10b981' : (isDelayed ? '#ef4444' : '#6366f1'), fontSize: '0.75rem', fontWeight: 700, textShadow: theme === 'dark' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>
                    {edge.duration} Days • {edge.progress}% Complete {isDelayed ? "• OVERDUE" : ""}
                  </text>
                </g>
              </g>
            );
          })}

          {nodes.map((node) => {
            const isNodeDelayed = edges.some(e => e.to === node.id && e.isDelayed);
            const cx = getMain(node.id);
            const cy = crossAxisLength / 2;

            return (
              <g key={node.id} transform={`translate(${cx}, ${cy})`}>
                <text
                  dx="0"
                  dy="-45"
                  textAnchor="middle"
                  style={{ fill: isNodeDelayed ? '#ef4444' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}
                >
                  {formatDate(node.timestamp)} {isNodeDelayed && "⚠️"}
                </text>
                {isNodeDelayed && (
                  <circle
                    r={nodeRadius + 10}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    className="pulse-slow"
                    style={{ opacity: 0.6 }}
                  />
                )}
                <circle
                  r={nodeRadius}
                  fill={isNodeDelayed ? "#450a0a" : (theme === 'dark' ? "#1e293b" : "#f1f5f9")}
                  stroke={isNodeDelayed ? "#ef4444" : "#6366f1"}
                  strokeWidth="4"
                  style={{ filter: isNodeDelayed ? 'drop-shadow(0 0 15px rgba(239, 68, 68, 0.6))' : 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.5))' }}
                />
                <text
                  textAnchor="middle"
                  dy=".35em"
                  style={{ fill: theme === 'dark' ? '#fff' : '#0f172a', fontSize: '1.1rem', fontWeight: 900 }}
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
