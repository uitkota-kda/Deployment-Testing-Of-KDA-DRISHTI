import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams, Link, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3, LayoutDashboard, FileText, Map as MapIcon,
  Camera, CheckCircle2, AlertCircle, LogOut, Plus, ChevronRight, Search,
  User as UserIcon, Settings, Calendar, Landmark, Info, MapPin,
  TrendingUp, Clock, History, X, MessageSquare, Phone, PieChart as PieChartIcon,
  AlertTriangle, Menu, Share2, Download, Sun, Moon, PauseCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList, CartesianGrid } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Default Icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import { formatDate, formatDateForInput, normalizeDate } from './utils/dateUtils';
import { getStepDisplayName, getProjectStage, getCalculatedStatus } from './utils/workflowUtils';
import { CONFIG } from './config';
import { toPng } from 'html-to-image';
import html2pdf from 'html2pdf.js';
import ConfigManager from './ConfigManager.jsx';

import { AuthContext, AuthProvider } from './context/AuthContext';
import { api } from './services/api';
import ProjectList from './pages/ProjectList';
import ProjectDetails from './pages/ProjectDetails';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import ViewerDashboard from './pages/ViewerDashboard';
import NewProject from './pages/NewProject';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';

import CustomAlert from './components/common/CustomAlert';
import Sidebar from './components/layout/Sidebar';
import MobileBottomNav from './components/layout/MobileBottomNav';

function RedirectIfLoggedIn({ children }) {
  const { user } = useContext(AuthContext);
  if (user) return <Navigate to="/dashboard" />;
  return children;
}

const renderDynamicFields = (config, location, formData, setFormData) => {
  if (!config || !config.fields) return null;
  const fields = config.fields.filter(f => f.isActive && f.location === location);
  if (fields.length === 0) return null;

  return (
    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '0.5rem', gridColumn: '1 / -1' }}>
      {fields.map(f => (
        <div key={f.fieldKey} className="input-group" style={{ marginBottom: 0 }}>
          <label>{f.displayName} {f.isRequired && <span style={{ color: 'var(--error)' }}>*</span>}</label>
          {f.fieldType === 'select' ? (
            <select
              value={formData.fieldData?.[f.fieldKey] || ''}
              onChange={e => setFormData({ ...formData, fieldData: { ...formData.fieldData, [f.fieldKey]: e.target.value } })}
            >
              <option value="">Select Option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : (
            <input
              type={f.fieldType}
              value={formData.fieldData?.[f.fieldKey] || ''}
              onChange={e => setFormData({ ...formData, fieldData: { ...formData.fieldData, [f.fieldKey]: e.target.value } })}
              placeholder={`Enter ${f.displayName}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const renderDynamicInfo = (project, location) => {
  if (!project || !project.configVersion || !project.configVersion.fields) return null;
  try {
    const fieldData = project.fieldData ? JSON.parse(project.fieldData) : {};
    const fields = project.configVersion.fields.filter(f => f.isActive && f.location === location && fieldData[f.fieldKey]);
    if (fields.length === 0) return null;

    return fields.map(f => (
      <InfoItem key={f.fieldKey} label={f.displayName} value={fieldData[f.fieldKey]} icon={<Info size={16} />} />
    ));
  } catch (e) {
    return null;
  }
};

const renderStatusBadge = (status) => {
  if (!status || status === 'On Track') {
    return (
      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <CheckCircle2 size={12} /> ON TRACK
      </span>
    );
  }
  if (status === 'Delay' || status.startsWith('Delayed:')) {
    return (
      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <AlertCircle size={12} /> {status.startsWith('Delayed:') ? status.toUpperCase() : 'DELAYED'}
      </span>
    );
  }
  if (status === 'On Hold') {
    return (
      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <PauseCircle size={12} /> ON HOLD
      </span>
    );
  }
  // For "Pending: ..." statuses
  if (status.startsWith('Pending:')) {
    return (
      <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <Clock size={12} /> {status.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
      <Info size={12} /> {status.toUpperCase()}
    </span>
  );
};



const blockInvalidNumberKeys = (e) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = err => reject(err);
});

function Preloader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <div className="pulse" style={{ width: '100px', height: '100px', background: 'var(--primary)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)', boxShadow: '0 0 50px var(--primary-glow)' }}>
          <LayoutDashboard size={48} color="white" />
        </div>
      </div>
      <h1 style={{ fontSize: 'clamp(2rem, 10vw, 3.5rem)', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>
        KDA <span style={{ color: 'var(--primary)' }}>DRISHTI</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}>Project Monitor</p>
      <div style={{ width: 'clamp(150px, 40vw, 200px)', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', marginTop: '3rem', overflow: 'hidden' }}>
        <div className="progress-fill" style={{ width: '100%' }} />
      </div>
    </div>
  );
}

function NavigationGuard() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if (navigationType === 'POP' && location.pathname === '/' && (lastPath.current === '/dashboard' || lastPath.current.includes('/dashboard')) && user) {
      logout();
    }
    lastPath.current = location.pathname;
  }, [location, user, logout, navigationType]);

  return null;
}

function InstallPWABtn({ isMobileView }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt) return null;

  if (isMobileView) {
    return (
      <div className="mobile-nav-item" onClick={handleInstallClick} style={{ cursor: 'pointer', color: '#10b981' }}>
        <Download size={20} /> App
      </div>
    );
  }

  return (
    <button onClick={handleInstallClick} className="btn" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
      <Download size={16} /> INSTALL APP
    </button>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/" />;
}

function DashboardRouter() {
  const { user } = useContext(AuthContext);
  if (!user) return null;
  if (user.role === 'VIEWER') return <ViewerDashboard />;
  if (user.role === 'ADMIN') return <AdminDashboard />;
  if (user.role === 'DEO') return <ViewerDashboard />;
  if (user.role === 'ENGINEER') return <ViewerDashboard />;
  return null;
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1150);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Preloader />;

  return (
    <Router>
      <NavigationGuard />
      <div className={`app-layout ${user ? 'authenticated' : ''}`}>
        {user && <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />}
        <main className="main-content" style={{ marginLeft: user && sidebarOpen ? '310px' : '0', padding: user ? '1rem 2rem 2rem 1rem' : '0' }}>
          <Routes>
            <Route path="/" element={<RedirectIfLoggedIn><LandingPage /></RedirectIfLoggedIn>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
            <Route path="/projects/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
            <Route path="/new-project" element={<Navigate to="/projects/new" />} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><ConfigManager /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        {user && <MobileBottomNav />}
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
