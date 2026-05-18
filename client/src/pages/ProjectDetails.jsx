import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronRight, FileText, MessageSquare, X, User as UserIcon, Settings,
  TrendingUp, Share2, BarChart3, Clock, CheckCircle2, Camera, MapPin,
  Landmark, Phone, Calendar, Info, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { getProjectStage, getStepDisplayName, getCalculatedStatus } from '../utils/workflowUtils';
import { formatDate } from '../utils/dateUtils';
import { renderDynamicInfo, InfoItem } from '../components/common/UIHelpers';

// Dashboard Components
import ProjectBarChart from '../components/dashboard/ProjectBarChart';
import ProjectPERTChart from '../components/dashboard/ProjectPERTChart';
import ProjectVerticalBarChart from '../components/dashboard/ProjectVerticalBarChart';
import ProjectLogs from '../components/dashboard/ProjectLogs';
import OfficialReportView from '../components/dashboard/OfficialReportView';

// Project Modals
import CycleUpdateWizard from '../components/project/CycleUpdateWizard';
import DirectionModal from '../components/project/DirectionModal';
import PERTStructureEditor from '../components/project/PERTStructureEditor';

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPERTEdit, setShowPERTEdit] = useState(false);
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [showOfficialReport, setShowOfficialReport] = useState(false);
  const [chartView, setChartView] = useState('TIMELINE'); // 'NETWORK', 'TIMELINE', 'VERTICAL'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1000);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1000);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const location = useLocation();

  useEffect(() => {
    fetchProject();
  }, [id, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('update') === 'true') {
      setShowUpdateModal(true);
    }
  }, [location]);

  const fetchProject = async () => {
    if (!user) {
      setLoading(true);
      return;
    }
    try {
      const res = await api.get('/projects', {
        params: {
          isAdmin: user?.role === 'ADMIN',
          includeDeleted: true,
          _t: Date.now() // Cache busting
        }
      });
      if (res && res.success) {
        const p = res.data.find(p => p.id === parseInt(id));
        if (p) setProject(p);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Synchronizing Authority Data...</div>;
  if (!project || !user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Project data or User session not found</div>;

  return (
    <div style={{ padding: '1rem' }} className="fade-in">
      {showOfficialReport && (
        <OfficialReportView projects={[project]} onClose={() => setShowOfficialReport(false)} />
      )}
      {showUpdateModal && (
        <CycleUpdateWizard
          project={project}
          userId={user?.id}
          userRole={user?.role}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => { setShowUpdateModal(false); fetchProject(); }}
        />
      )}
      {showDirectionModal && (
        <DirectionModal
          project={project}
          userId={user?.id}
          onClose={() => setShowDirectionModal(false)}
          onSuccess={() => { setShowDirectionModal(false); fetchProject(); }}
        />
      )}

      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          <Link to={(user?.role === 'VIEWER') ? "/" : "/projects"} style={{ color: 'inherit', textDecoration: 'none' }}>{(user?.role === 'VIEWER') ? "Dashboard" : "Projects"}</Link>

          <ChevronRight size={16} />
          <span className="badge badge-success" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>{getProjectStage(project)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{project.name}</h1>
            <span style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '8px', background: project.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: project.type === 'CONSULTANCY' ? '#a855f7' : '#6366f1', fontWeight: 700, border: `1px solid ${project.type === 'CONSULTANCY' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(99, 102, 241, 0.3)'}` }}>
              {project.type} WORK
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn no-print"
              style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: 'max-content' }}
              onClick={() => setShowOfficialReport(true)}
            >
              <FileText size={18} /> Official Report
            </button>
            {(user?.role === 'VIEWER' || user?.role === 'ADMIN') && (
              <button
                className="btn btn-primary no-print"
                style={{ textTransform: 'none', fontSize: '0.9rem', padding: '0.75rem 1.5rem', borderRadius: '1rem', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4)', flex: '1 1 auto', minWidth: 'max-content' }}
                onClick={() => setShowDirectionModal(true)}
              >
                <MessageSquare size={18} /> Issue Authority Direction
              </button>
            )}
            {user?.role === 'ADMIN' && !project.isDeleted && (
              <button
                className="btn no-print"
                style={{ background: 'var(--error-soft-bg)', color: 'var(--error-strong-text)', border: '1px solid var(--error-soft-border)', textTransform: 'none', fontSize: '1rem', padding: '0.75rem 1.5rem', borderRadius: '1rem' }}
                onClick={async () => {
                  if (!user) return;
                  if (window.confirm("Move this project to Recycle Bin?")) {
                    await api.patch(`/projects/${project.id}/delete`, { userId: user?.id });
                    navigate('/projects');
                  }
                }}
              >
                <X size={18} /> Delete Project
              </button>
            )}
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', maxWidth: '800px' }}>{project.brief}</p>

        {project.updates && project.updates[0] && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserIcon size={16} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>Last Updated By</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                {project.updates[0].user?.name} ({project.updates[0].user?.designation}) • {project.updates[0].user?.mobile}
              </p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
                on {new Date(project.updates[0].timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {(user?.role === 'DEO' || user?.role === 'ADMIN') && project.type === 'EXECUTION' && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              className="btn"
              disabled={project.workStarted !== 'Yes'}
              title={project.workStarted !== 'Yes' ? "PERT structure can only be modified after project work has officially started at site." : ""}
              style={{ 
                background: project.workStarted === 'Yes' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(156, 163, 175, 0.1)', 
                color: project.workStarted === 'Yes' ? '#a855f7' : '#9ca3af', 
                border: `1px solid ${project.workStarted === 'Yes' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(156, 163, 175, 0.2)'}`, 
                textTransform: 'none', 
                fontSize: '0.85rem',
                opacity: project.workStarted === 'Yes' ? 1 : 0.6,
                cursor: project.workStarted === 'Yes' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onClick={() => setShowPERTEdit(true)}
            >
              <Settings size={16} /> Modify PERT Structure (DEO Exclusive)
            </button>
            {project.workStarted !== 'Yes' && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={14} /> Please mark 'Work Started = Yes' before creating PERT activities.
              </span>
            )}
          </div>
        )}
      </header>

      {showPERTEdit && (
        <PERTStructureEditor
          project={project}
          userId={user?.id}
          onClose={() => setShowPERTEdit(false)}
          onSuccess={() => { setShowPERTEdit(false); fetchProject(); }}
        />
      )}

      {project.type === 'EXECUTION' && project.pertActivities && project.pertActivities.length > 0 && (
        <div style={{ marginBottom: '2rem', maxWidth: '100%', overflowX: 'visible' }}>
          <div style={{
            display: 'flex',
            background: 'var(--glass-bg)',
            padding: '0.4rem',
            borderRadius: '1rem',
            width: isMobile ? '100%' : 'fit-content',
            marginBottom: '1.5rem',
            border: '1px solid var(--glass-border)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            WebkitOverflowScrolling: 'touch'
          }}>
            <style dangerouslySetInnerHTML={{
              __html: `
              div::-webkit-scrollbar { display: none; }
            `}} />
            <button
              onClick={() => setChartView('TIMELINE')}
              style={{
                padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: chartView === 'TIMELINE' ? 'var(--primary)' : 'transparent',
                color: chartView === 'TIMELINE' ? 'white' : 'var(--text-muted)',
                fontWeight: 600, transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <TrendingUp size={16} /> Timeline
            </button>
            <button
              onClick={() => setChartView('NETWORK')}
              style={{
                padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: chartView === 'NETWORK' ? 'var(--primary)' : 'transparent',
                color: chartView === 'NETWORK' ? 'white' : 'var(--text-muted)',
                fontWeight: 600, transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <Share2 size={16} /> Network
            </button>
            <button
              onClick={() => setChartView('VERTICAL')}
              style={{
                padding: '0.6rem 1.2rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: chartView === 'VERTICAL' ? 'var(--primary)' : 'transparent',
                color: chartView === 'VERTICAL' ? 'white' : 'var(--text-muted)',
                fontWeight: 600, transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <BarChart3 size={16} /> Vertical Analysis
            </button>
          </div>

          {chartView === 'TIMELINE' && <ProjectBarChart project={project} />}
          {chartView === 'NETWORK' && <ProjectPERTChart project={project} />}
          {chartView === 'VERTICAL' && <ProjectVerticalBarChart project={project} />}
        </div>
      )}

      {user?.role === 'ADMIN' && <ProjectLogs projectId={project.id} />}

      <div className="responsive-grid-2-1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock /> Pre-Execution Workflow</h3>
            <div className="stepper" style={{ position: 'relative' }}>
              {(() => {
                const obsolete = ['DPR Submitted', 'DPR Approved', 'Technical Sanction'];
                const rawWorkflows = (project.workflows || []).filter(w => project.type !== 'CONSULTANCY' || !obsolete.includes(w.stepName));
                const firstNoIdx = rawWorkflows.findIndex(w => !w.isCompleted || w.value === 'No');
                const filtered = firstNoIdx === -1 ? rawWorkflows : rawWorkflows.slice(0, firstNoIdx + 1);
                return filtered.map((w, idx) => (
                  <div key={w.id} style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: w.isCompleted ? 'var(--success)' : 'var(--glass-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2, border: '2px solid ' + (w.isCompleted ? 'transparent' : 'var(--glass-border)')
                      }}>
                        {w.isCompleted ? <CheckCircle2 size={18} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' }}></div>}
                      </div>
                      {idx < filtered.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--glass-border)', margin: '4px 0' }}></div>}
                    </div>
                    <div style={{ flex: 1, paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ color: w.isCompleted ? 'var(--text-primary)' : 'var(--text-muted)' }}>{getStepDisplayName(w.stepName)}</h4>
                          {w.isCompleted && w.date && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed on: {formatDate(w.date)}</p>}
                          {w.value === 'No' && w.reason && (
                            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', padding: '0.4rem 0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              <strong>Reason for Pending:</strong> {w.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {project.type === 'EXECUTION' && project.pertActivities && project.pertActivities.length > 0 && (
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.5rem' }}><TrendingUp size={20} /> PERT Breakdown</h3>
              {(project.pertActivities || []).map(p => (
                <div key={p.id} style={{ marginBottom: '1.5rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--glass-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.weightage}%)</span></span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>{p.progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--glass-bg)', borderRadius: '3px', marginBottom: '0.5rem', border: '1px solid var(--glass-border)' }}>
                    <div style={{ width: `${p.progress}%`, height: '100%', background: 'var(--success)', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Start: {formatDate(p.startDate)}</span>
                    <span>Completion: {formatDate(p.endDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {project.type === 'EXECUTION' && project.updates && project.updates.length > 0 && (
            <div className="glass-card fade-in">
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Camera size={20} /> Latest Field Evidence</h3>
              {(() => {
                const latest = project.updates[0];
                let photos = [];
                try { photos = JSON.parse(latest.photos || '[]'); } catch (e) { }
                return (
                  <div>
                    <div className="custom-scrollbar field-evidence-container" style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1.5rem', scrollSnapType: 'x mandatory' }}>
                      {photos.length > 0 ? photos.map((p, idx) => (
                        <div key={idx} className="hover-card" style={{ flexShrink: 0, width: '320px', height: '220px', borderRadius: '16px', overflow: 'hidden', scrollSnapAlign: 'start', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                          {typeof p === 'string' && (p.startsWith('data:image') || p.startsWith('http')) ? (
                            <img src={p} alt={`Field evidence ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              <Camera size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                              <span style={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Evidence #{idx + 1}</span>
                            <Camera size={16} opacity={0.8} />
                          </div>
                        </div>
                      )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>No field photos provided for this update.</span>}
                    </div>
                    {latest.gpsLat && latest.gpsLong && (
                      <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={18} color="var(--primary)" />
                            <span style={{ fontSize: '0.85rem' }}>GPS: {latest.gpsLat}, {latest.gpsLong}</span>
                          </div>
                          <a href={`https://www.google.com/maps?q=${latest.gpsLat},${latest.gpsLong}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>Open Full Map</a>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${latest.gpsLat},${latest.gpsLong}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'block', position: 'relative', overflow: 'hidden', textDecoration: 'none', cursor: 'pointer', borderRadius: '0 0 8px 8px' }}
                          onMouseOver={(e) => {
                            const btn = e.currentTarget.querySelector('.map-overlay-btn');
                            if (btn) {
                              btn.style.transform = 'translate(-50%, -50%) scale(1.05)';
                              btn.style.background = 'var(--primary)';
                            }
                          }}
                          onMouseOut={(e) => {
                            const btn = e.currentTarget.querySelector('.map-overlay-btn');
                            if (btn) {
                              btn.style.transform = 'translate(-50%, -50%) scale(1)';
                              btn.style.background = 'rgba(0,0,0,0.6)';
                            }
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}></div>
                          <iframe
                            width="100%"
                            height="250"
                            style={{ border: 0, display: 'block', filter: 'brightness(0.9) contrast(1.1)', pointerEvents: 'none' }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://maps.google.com/maps?q=${latest.gpsLat},${latest.gpsLong}&z=15&output=embed`}>
                          </iframe>
                          <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '2rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            zIndex: 11,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s ease',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }} className="map-overlay-btn">
                            <MapPin size={16} /> Open in Google Maps
                          </div>
                        </a>
                      </div>
                    )}
                    {latest.remarks && (
                      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: '#fff' }}>Field Remarks:</strong> {latest.remarks}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {project.updates && project.updates.length > 0 && (
            <div className="glass-card fade-in">
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={20} /> Project Update History</h3>
              <div className="custom-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {(project.updates || []).map((upd, uIdx) => (
                  <div key={upd.id} style={{ padding: '1.25rem', marginBottom: '1rem', borderRadius: '12px', background: 'var(--bg-deep)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{formatDate(upd.timestamp)}</span>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phy: {upd.physicalProgress}%</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fin: {upd.financialProgress}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <UserIcon size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Updated by: <strong>{upd.user?.name}</strong> ({upd.user?.designation}) • {upd.user?.mobile}
                      </span>
                    </div>
                    {upd.todaysUpdateNote && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Remark</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{upd.todaysUpdateNote}</p>
                      </div>
                    )}
                    {upd.remarks && (
                      <div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Field Observation</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{upd.remarks}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card responsive-padding">
            <h3>Project Summary</h3>
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {renderDynamicInfo(project, 'TOP')}
              <InfoItem label="Funding" value={project.fundingAgency} icon={<Landmark size={16} />} />
              {renderDynamicInfo(project, 'AFTER_NAME')}
              {renderDynamicInfo(project, 'AFTER_BRIEF')}
              {renderDynamicInfo(project, 'AFTER_FUNDING')}
              <InfoItem label="Cost" value={`₹${project.estimatedCost} Lakhs`} icon={<Landmark size={16} />} />
              {renderDynamicInfo(project, 'AFTER_COST')}
              <InfoItem label="Executive Engineer" value={project.inchargeName} icon={<UserIcon size={16} />} />
              <InfoItem label="Executive Engineer Mobile" value={project.inchargeMobile} icon={<Phone size={16} />} />
              {renderDynamicInfo(project, 'AFTER_EE')}
              {project.type === 'CONSULTANCY' && <InfoItem label="Selection Source" value={project.consultancySource === 'SINGLE_SOURCE' ? 'Single Source' : 'NIT'} icon={<Settings size={16} />} />}
              {project.consultantName && <InfoItem label="Consultant" value={project.consultantName} icon={<Settings size={16} />} />}
              {project.actualStartDate && <InfoItem label="Actual Start" value={formatDate(project.actualStartDate)} icon={<Calendar size={16} color="var(--success)" />} />}
              {project.stipulatedCompletionDate && <InfoItem label="Stipulated Completion" value={formatDate(project.stipulatedCompletionDate)} icon={<Calendar size={16} color="var(--warning)" />} />}
              {project.expectedCompletionDate && <InfoItem label="Expected Completion" value={formatDate(project.expectedCompletionDate)} icon={<Calendar size={16} color="var(--primary)" />} />}
              {renderDynamicInfo(project, 'AFTER_DATES')}
              {renderDynamicInfo(project, 'AFTER_CONTRACTOR')}
              {getProjectStage(project) !== 'COMPLETED' && (
                <InfoItem
                  label="Overall Status"
                  value={getCalculatedStatus(project)}
                  icon={<Info size={16} />}
                />
              )}
              {project.type === 'EXECUTION' && getProjectStage(project) === 'EXECUTION STAGE' && (
                <>
                  <InfoItem label="Quality Sampling" value={project.qualitySampling || 'No'} icon={<CheckCircle2 size={16} color={project.qualitySampling === 'Yes' ? 'var(--success)' : 'var(--warning)'} />} />
                  {project.qualitySampling === 'No' && project.qualitySamplingReason && (
                    <div style={{ fontSize: '0.75rem', color: '#f87171', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)', marginTop: '-0.5rem' }}>
                      <strong>Reason:</strong> {project.qualitySamplingReason}
                    </div>
                  )}
                </>
              )}
              {project.timeExtension && <InfoItem label="Time Extension" value={project.timeExtension} icon={<Clock size={16} />} />}
              {renderDynamicInfo(project, 'BOTTOM')}
              {getProjectStage(project) !== 'COMPLETED' && ((project.overallStatus === 'Delay' && (project.statusDelayBrief || project.statusDelayReasons)) || (project.workStarted === 'No' && project.delayBrief) || (project.overallStatus === 'On Hold' && project.statusHoldReason)) && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '1.25rem', 
                  background: project.overallStatus === 'On Hold' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)', 
                  borderRadius: '16px', 
                  border: `1px solid ${project.overallStatus === 'On Hold' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    {project.overallStatus === 'On Hold' ? <Clock size={16} color="#f59e0b" /> : <AlertTriangle size={16} color="#ef4444" />}
                    <span style={{ fontSize: '0.75rem', color: project.overallStatus === 'On Hold' ? '#f59e0b' : '#ef4444', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                      {project.overallStatus === 'On Hold' ? 'Project On Hold' : 'Critical Delay Analysis'}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                    {project.overallStatus === 'On Hold' ? project.statusHoldReason : (project.overallStatus === 'Delay' ? project.statusDelayBrief : project.delayBrief)}
                  </p>

                  {(project.overallStatus === 'Delay' || project.workStarted === 'No') && (project.statusDelayReasons || project.delayReasons) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {(() => {
                        try {
                          const raw = project.statusDelayReasons || project.delayReasons;
                          const r = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
                          const arr = Array.isArray(r) ? r : [r];
                          return arr.filter(Boolean).map((reason, i) => (
                            <span key={i} style={{ 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              background: 'var(--accent-soft)', 
                              color: 'var(--primary)', 
                              padding: '4px 12px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--glass-border)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                              {reason}
                            </span>
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}
              {project.todaysUpdateNote && (
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 700 }}>Today's Remark</p>
                  <p style={{ fontSize: '0.85rem' }}>{project.todaysUpdateNote}</p>
                </div>
              )}
              {project.updates && project.updates[0] && project.updates[0].remarks && (
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 700 }}>Final Remarks</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{project.updates[0].remarks}"</p>
                </div>
              )}
            </div>
          </div>

          {project.directions && project.directions.length > 0 && (
            <div className="glass-card" style={{ border: '2px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)', padding: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '1rem', marginBottom: '1rem' }}>
                <AlertTriangle size={18} /> AUTHORITY DIRECTIONS
              </h3>

              <div style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                  "{project.directions[0].direction}"
                </p>
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                    By: <strong>{project.directions[0].user?.name}</strong> ({project.directions[0].user?.designation})
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                    {new Date(project.directions[0].timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              {project.directions.length > 1 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {project.directions.slice(1).map(dir => (
                      <div key={dir.id} style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.3', marginBottom: '0.4rem' }}>"{dir.direction}"</p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {dir.user?.name} • {new Date(dir.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(user.role === 'ADMIN' || user.role === 'DEO' || (project.type === 'EXECUTION' && user.role !== 'VIEWER' && getProjectStage(project) !== 'COMPLETED')) && (

            <button
              className="btn"
              style={{
                width: '100%',
                height: '4.5rem',
                background: getProjectStage(project) === 'COMPLETED'
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: '1.25rem',
                boxShadow: getProjectStage(project) === 'COMPLETED'
                  ? '0 10px 20px -5px rgba(245, 158, 11, 0.4)'
                  : '0 10px 20px -5px rgba(99, 102, 241, 0.4)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transition: 'all 0.3s ease'
              }}
              onClick={() => setShowUpdateModal(true)}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {getProjectStage(project) === 'COMPLETED' ? <Settings size={24} /> : <Camera size={24} />}
              {getProjectStage(project) === 'COMPLETED' ? "Alter Project Details" : "New Field Update"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
