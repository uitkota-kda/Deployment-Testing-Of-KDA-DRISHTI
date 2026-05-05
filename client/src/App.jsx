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

import { formatDate, formatDateForInput, normalizeDate } from './utils/dateUtils';
import { getStepDisplayName, getProjectStage } from './utils/workflowUtils';
import { CONFIG } from './config';
import { toPng } from 'html-to-image';
import html2pdf from 'html2pdf.js';
import ConfigManager from './ConfigManager';

const AuthContext = createContext(null);
const API_BASE = CONFIG.API_BASE_URL;

// Optimized Axios Instance with standard error handling
export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  try {
    const user = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  } catch (e) {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }

  if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
    config.url = '/api' + config.url;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Ensure we got a JSON response and not an HTML error page from hosting
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      return Promise.reject({ message: 'Backend server not found. Please ensure the server is live.' });
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or unauthorized - could trigger logout here if desired
      if (error.response?.status === 401) {
        // Auto-logout on 401 (Unauthenticated) or if legacy session is detected
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        window.location.href = '/';
      }
    }
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'System error occurred';
    return Promise.reject({ message, ...error.response?.data });
  }
);

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
  if (status === 'On Track' || !status) {
    return (
      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <CheckCircle2 size={12} /> ON TRACK
      </span>
    );
  }
  if (status === 'Delay') {
    return (
      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
        <AlertCircle size={12} /> DELAYED
      </span>
    );
  }
  return (
    <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
      <PauseCircle size={12} /> ON HOLD
    </span>
  );
};



const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

const CustomAlert = ({ show, message, onClose }) => {
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }} className="fade-in">
      <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />
        <div style={{ background: 'rgba(99, 102, 241, 0.15)', width: '70px', height: '70px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', transform: 'rotate(-5deg)' }}>
          <AlertCircle size={36} color="var(--primary)" />
        </div>
        <h2 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>Notification</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1.05rem' }}>{message}</p>
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', height: 'auto', fontSize: '1rem', fontWeight: 600, background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', border: 'none', borderRadius: '12px' }}
          onClick={onClose}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
};

const sanitizeMobile = (val) => val.replace(/\D/g, '').slice(0, 10);
const sanitizeName = (val) => val.replace(/[^a-zA-Z\s]/g, '');
// Utilities moved to ./utils/

// Geocoding Cache to prevent redundant API calls
const geoCache = new Map();

const ReverseGeocode = ({ lat, lon }) => {
  const [address, setAddress] = useState('Location details pending...');
  const cacheKey = `${lat},${lon}`;

  useEffect(() => {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      setAddress('Location not available');
      return;
    }

    if (geoCache.has(cacheKey)) {
      setAddress(geoCache.get(cacheKey));
      return;
    }

    const fetchAddr = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'KPMS-Project-Monitor/1.0'
          }
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        if (data && data.display_name) {
          geoCache.set(cacheKey, data.display_name);
          setAddress(data.display_name);
        } else {
          setAddress('Location not available');
        }
      } catch (err) {
        setAddress('Location not available');
      }
    };

    const timer = setTimeout(fetchAddr, 500);
    return () => clearTimeout(timer);
  }, [lat, lon, cacheKey]);

  return <span style={{ fontSize: '10.5pt' }}>{address}</span>;
};

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
      <h1 style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        KDA <span style={{ color: 'var(--primary)' }}>DRISHTI</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Project Monitor</p>
      <div style={{ width: '200px', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', marginTop: '3rem', overflow: 'hidden' }}>
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
    // If navigation is a 'back' action (POP) and we land on '/' from '/dashboard'
    if (navigationType === 'POP' && location.pathname === '/' && (lastPath.current === '/dashboard' || lastPath.current.includes('/dashboard')) && user) {
      logout();
    }
    lastPath.current = location.pathname;
  }, [location, user, logout, navigationType]);

  return null;
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
      // Clear legacy sessions that don't have a JWT token
      if (storedUser && !storedUser.token) {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        return null;
      }
      return storedUser;
    } catch (e) {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      return null;
    }
  });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [alertState, setAlertState] = useState({ show: false, message: '' });
  const [appLoading, setAppLoading] = useState(true);
  const [activeConfig, setActiveConfig] = useState(null);

  useEffect(() => {
    if (user) {
      const fetchConfig = async () => {
        try {
          const res = await api.get('/config/latest');
          setActiveConfig(res.data);
        } catch (err) {
          console.error("Failed to fetch active config:", err);
        }
      };
      fetchConfig();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setAppLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    // Globally override window.alert to use our custom UI
    window.alert = (msg) => {
      setAlertState({ show: true, message: msg });
    };
  }, []);

  const login = (authData) => {
    if (!authData || !authData.token) {
      console.error("Invalid login data received", authData);
      window.alert("Login failed: Invalid server response");
      return;
    }
    const { token, user: userData } = authData;
    const fullUserData = { ...userData, token };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(fullUserData));
    setUser(fullUserData);
  };



  const logout = () => {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, theme, toggleTheme }}>
      {appLoading && <Preloader />}
      <Router>
        <NavigationGuard />
        <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }} className="app-layout">
          {user && <Sidebar />}

          {user && (
            <div className="mobile-top-header mobile-only">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src="/logo.png" alt="Drishti Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div 
                  onClick={toggleTheme}
                  style={{ width: '36px', height: '36px', background: 'var(--glass-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--glass-border)' }}
                >
                  {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{user.name?.split(' ')[0] || 'User'}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--primary)', margin: 0, fontWeight: 700 }}>{user.role?.replace('_', ' ')}</p>
                </div>
                <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={16} color="white" />
                </div>
              </div>
            </div>
          )}

          <main style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
            <Routes>
              <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
              <Route path="/new-project" element={<ProtectedRoute><NewProject activeConfig={activeConfig} /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/config" element={<ProtectedRoute><ConfigManager /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          {user && (
            <div className="mobile-bottom-nav mobile-only">
              <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><LayoutDashboard size={20} /> Dashboard</NavLink>
              <NavLink to="/projects" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><FileText size={20} /> Projects</NavLink>
              <NavLink to="/reports" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><History size={20} /> Reports</NavLink>
              {(user.role === 'DEO' || user.role === 'ADMIN' || user.role === 'ENGINEER') && <NavLink to="/new-project" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><Plus size={20} /> New</NavLink>}

              <InstallPWABtn isMobileView={true} />
              <div className="mobile-nav-item" onClick={logout} style={{ cursor: 'pointer' }}><LogOut size={20} /> Logout</div>
            </div>
          )}
        </div>
        <CustomAlert
          show={alertState.show}
          message={alertState.message}
          onClose={() => setAlertState({ ...alertState, show: false })}
        />
      </Router>
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/" />;
}

// --- CORE COMPONENTS ---

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
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
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

function Sidebar() {
  const { logout, user, theme, toggleTheme } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="sidebar glass-card" style={{
      width: '280px', height: 'calc(100vh - 2rem)', margin: '1rem 0 1rem 1rem',
      borderRadius: '2rem', display: 'flex', flexDirection: 'column',
      padding: '2rem 1rem'
    }}>
      <div className="sidebar-header" style={{ marginBottom: '2.5rem', padding: '0 0.5rem' }}>
        <img src="/logo.png" alt="Drishti Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
      </div>

      <nav className="sidebar-nav">
        <SidebarLink icon={<LayoutDashboard size={20} />} label="Dashboard" to="/" />
        <SidebarLink icon={<FileText size={20} />} label="Projects" to="/projects" />
        <SidebarLink icon={<History size={20} />} label="Reports" to="/reports" />
        {(user.role === 'DEO' || user.role === 'ADMIN' || user.role === 'ENGINEER') && <SidebarLink icon={<Plus size={20} />} label="New Project" to="/new-project" />}
        {(user.role === 'ADMIN') && <SidebarLink icon={<UserIcon size={20} />} label="User Management" to="/users" />}
        {(user.role === 'ADMIN') && <SidebarLink icon={<Settings size={20} />} label="System Config" to="/config" />}
      </nav>

      <div className="sidebar-user" style={{ padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '1.5rem', marginTop: 'auto', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ width: '45px', height: '45px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
            <UserIcon size={22} color="white" />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{user.role?.replace('_', ' ') || 'User'}</p>
          </div>
        </div>
        <InstallPWABtn />
         <button onClick={toggleTheme} className="btn" style={{ width: '100%', background: 'var(--accent-soft)', color: 'var(--primary)', border: '1px solid var(--glass-border)', fontSize: '0.7rem', marginBottom: '0.75rem' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} 
          {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
        </button>
        <button onClick={logout} className="btn" style={{ width: '100%', background: 'var(--error-soft-bg)', color: 'var(--error-strong-text)', border: '1px solid var(--glass-border)', fontSize: '0.7rem' }}>
          <LogOut size={16} /> SIGN OUT
        </button>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, to }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
      borderRadius: '1rem', color: 'var(--text-primary)', textDecoration: 'none',
      marginBottom: '0.5rem', transition: 'all 0.2s'
    }}
      className="sidebar-link">
      {icon} <span>{label}</span>
    </Link>
  );
}

function HeroSlider() {
  const slides = [
    {
      img: '/assets/kota_1.jpg',
      title: "Majestic Chambal Riverfront",
      subtitle: "A world-class landmark redefining urban leisure and aesthetic excellence in Kota."
    },
    {
      img: '/assets/kota_2.jpg',
      title: "Sustainable Urban Spaces",
      subtitle: "Modern infrastructure like Oxygen Park creating a healthier, greener tomorrow."
    },
    {
      img: '/assets/kota_3.jpg',
      title: "Building a Smarter Kota",
      subtitle: "KDA's vision brought to life through precision engineering and iconic design."
    }
  ];

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero-slider-container" style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: '2rem', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
      {slides.map((slide, idx) => (
        <div
          key={idx}
          style={{
            position: idx === current ? 'relative' : 'absolute', inset: 0, opacity: idx === current ? 1 : 0, transition: 'opacity 1.5s ease-in-out',
            backgroundImage: `url(${slide.img})`, backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'flex-end', padding: '2rem',
            minHeight: '400px'
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)' }}></div>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px' }} className="fade-in">
            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 800, color: 'white', marginBottom: '0.5rem', lineHeight: 1.1 }}>{slide.title}</h2>
            <p style={{ fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem' }}>{slide.subtitle}</p>
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem', zIndex: 10 }}>
        {slides.map((_, idx) => (
          <div
            key={idx}
            onClick={() => setCurrent(idx)}
            style={{
              width: idx === current ? '30px' : '8px', height: '8px', borderRadius: '4px',
              background: idx === current ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', transition: 'all 0.3s'
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { login, theme, toggleTheme } = useContext(AuthContext);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedMobile = mobile.trim();
    const trimmedPassword = otp.trim();

    if (trimmedMobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits');
      return;
    }

    try {
      const res = await api.post('/auth/login', {
        mobile: trimmedMobile,
        password: trimmedPassword
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Optimized Header */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        height: '80px',
        display: 'flex', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Drishti Logo" style={{ height: '55px', width: 'auto', objectFit: 'contain' }} />
          </div>

          {/* Desktop Nav */}
          <div className="desktop-only" style={{ gap: '2rem', alignItems: 'center' }}>
            {['About Us', 'Services'].map(item => (
              <a key={item} href="#" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>{item}</a>
            ))}
            <div 
              onClick={toggleTheme}
              style={{ width: '40px', height: '40px', background: 'var(--glass-bg)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--glass-border)', color: 'var(--primary)' }}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            <button className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', height: '40px' }} onClick={() => document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' })}>
              Login
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="mobile-only" style={{ alignItems: 'center', gap: '0.75rem' }}>
            <div 
              onClick={toggleTheme}
              style={{ width: '38px', height: '38px', background: 'var(--glass-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--glass-border)', color: 'var(--primary)' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </div>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '0.6rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Improved Mobile Navigation Drawer */}
        <div style={{
          position: 'fixed', top: '80px', left: 0, right: 0,
          background: 'var(--secondary)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          transform: isMenuOpen ? 'translateY(0)' : 'translateY(-120%)',
          opacity: isMenuOpen ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1050, padding: '2rem 5%',
          flexDirection: 'column', gap: '1rem',
          borderBottom: '1px solid var(--glass-border)'
        }} className="mobile-only">
          {['About Us', 'Services'].map(item => (
            <a key={item} href="#" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem', padding: '1rem 0', borderBottom: '1px solid var(--glass-border)' }} onClick={() => setIsMenuOpen(false)}>{item}</a>
          ))}
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', height: '3.75rem', fontSize: '1rem', width: '100%' }}
            onClick={() => { setIsMenuOpen(false); document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' }); }}
          >
            Login
          </button>
        </div>





      </nav>
      <div style={{ height: '80px' }}></div> {/* Spacer for fixed nav */}

      {/* Responsive Hero Section */}
      <section style={{ padding: '2rem 5% 4rem 5%', background: 'var(--bg-deep)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="hero-grid" style={{ display: 'grid', gap: '3rem', alignItems: 'start' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <span style={{
                  background: 'var(--accent-soft)', color: 'var(--primary)', padding: '0.6rem 1.75rem',
                  borderRadius: '100px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px'
                }}>
                  DRISHTI • OFFICIAL CONSOLE
                </span>
                <h1 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1.5rem', lineHeight: 1.1 }}>
                  Precision Monitoring for <br />
                  <span style={{ background: 'linear-gradient(to right, #0ea5e9, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Urban Infrastructure.</span>
                </h1>
              </div>

              <HeroSlider />
            </div>

            {/* Login Form Column */}
            <div id="login-section" className="login-column">
              <div className="glass-card fade-in" style={{ padding: 'clamp(1.5rem, 5vw, 3rem)', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <div style={{ width: '56px', height: '56px', background: 'var(--accent-soft)', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                    <Landmark size={28} color="var(--primary)" />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Authority Login</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Administrative access for KDA controls.</p>
                </div>
                <form onSubmit={handleLogin}>
                  <div className="input-group">
                    <label>Authority Mobile</label>
                    <input type="text" maxLength="10" placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(sanitizeMobile(e.target.value))} required />
                  </div>
                  <div className="input-group">
                    <label>Security Password</label>
                    <input type="password" placeholder="••••••••" value={otp} onChange={(e) => setOtp(e.target.value)} required />
                  </div>
                  {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--error-soft-bg)', border: '1px solid var(--error-soft-border)', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <AlertCircle size={16} color="#f87171" />
                      <p style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{error}</p>
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '0.9rem' }}>
                    ACCESS CONSOLE
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 5%', background: '#f8fafc', position: 'relative' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 8vw, 5rem)' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#1e293b' }}>Advanced Monitoring Capabilities</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '1rem' }}>Empowering the Authority with data-driven infrastructure management.</p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gap: '2rem' }}>
            <FeatureCard
              icon={<TrendingUp color="#6366f1" size={32} />}
              title="Real-time Tracking"
              desc="Monitor physical and financial progress with live updates from the site, ensuring every milestone is tracked with precision."
            />
            <FeatureCard
              icon={<MapIcon color="#10b981" size={32} />}
              title="Strategic PERT"
              desc="Automated chronological analysis with bottleneck detection and milestone tracking for complex project lifecycles."
            />
            <FeatureCard
              icon={<Camera color="#f59e0b" size={32} />}
              title="Visual Evidence"
              desc="Geo-tagged site photos and engineering observations for total accountability and visual verification of progress."
            />
            <FeatureCard
              icon={<FileText color="#ec4899" size={32} />}
              title="Authority Insights"
              desc="Comprehensive reports and data visualizations designed for executive decision-making and resource optimization."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', background: '#0f172a', color: 'white', padding: '4rem 5%' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
            <div>
              <img src="/logo.png" alt="Drishti Logo" style={{ height: '70px', width: 'auto', background: 'white', padding: '0.5rem', borderRadius: '8px', marginBottom: '1.5rem' }} />
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                The Official Project Monitoring System of Kota Development Authority (KDA), ensuring world-class infrastructure for the people of Kota.
              </p>
            </div>
            <div>
              <h4 style={{ marginBottom: '1.5rem' }}>Authority Quick Links</h4>
              <ul style={{ listStyle: 'none', padding: 0, color: '#94a3b8', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>Tenders & Notices</li>
                <li>Citizen Grievance</li>
                <li>RTI Information</li>
                <li>Master Plan 2031</li>
              </ul>
            </div>
            <div>
              <h4 style={{ marginBottom: '1.5rem' }}>Contact Info</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Collectorate Premises, Rawatbhata Rd, Kota, Rajasthan 324001</p>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Phone: 0744 250 5123</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
            <p>© 2026 Kota Development Authority. All Rights Reserved.</p>
            <p>Designed for Infrastructure Excellence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="hover-card" style={{
      padding: '3rem',
      borderRadius: '2rem',
      background: 'white',
      border: '1px solid #eef2f6',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      cursor: 'default',
      height: '100%'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        background: '#f8fafc',
        borderRadius: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2rem',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.75rem', marginBottom: '1.25rem', color: '#1e293b', fontWeight: 700 }}>{title}</h3>
      <p style={{ color: '#64748b', lineHeight: 1.7, fontSize: '1.05rem' }}>{desc}</p>
    </div>
  );
}

function DashboardRouter() {
  const { user } = useContext(AuthContext);
  if (!user) return null;
  if (user.role === 'VIEWER') return <ViewerDashboard />;
  if (user.role === 'ADMIN') return <AdminDashboard />;
  if (user.role === 'DEO') return <DEODashboard />;
  if (user.role === 'ENGINEER') return <EngineerDashboard />;
  return null;
}


function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => {
        console.error(err);
        setError("Failed to load global analytics.");
      });
  }, []);

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--error)' }}>{error}</p>
      <button className="btn" onClick={() => window.location.reload()}>Retry Sync</button>
    </div>
  );

  if (!stats) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <div className="pulse" style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
      <p style={{ color: 'var(--text-muted)' }}>Assembling Authority Intel...</p>
    </div>
  );

  const typeData = [
    { name: 'Execution', value: stats.typeDistribution?.execution || 0 },
    { name: 'Consultancy', value: stats.typeDistribution?.consultancy || 0 }
  ];

  const COLORS = ['#6366f1', '#a855f7'];

  return (
    <div style={{ padding: '1rem' }} className="fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1>Global Monitoring</h1>
        <p style={{ color: 'var(--text-muted)' }}>Authority-wide project distribution and status</p>
      </header>

      <div className="dashboard-grid">
        <StatCard label="Total Projects" value={stats.total} icon={<FileText color="#6366f1" />} />
        <StatCard label="Ongoing Works" value={stats.ongoing} icon={<TrendingUp color="#10b981" />} />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 color="#f59e0b" />} />
        <StatCard label="DPRs Submitted" value={stats.dprStatus?.submitted || 0} icon={<Info color="#a855f7" />} />
        <StatCard label="DPRs Approved" value={stats.dprStatus?.approved || 0} icon={<CheckCircle2 color="#8b5cf6" />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="glass-card" style={{ height: '400px' }}>
          <h4>Structure Distribution</h4>
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

        <div className="glass-card" style={{ height: '400px' }}>
          <h4>Project Health Map</h4>
          <div style={{ height: '90%', borderRadius: '1rem', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <p style={{ color: 'var(--text-muted)', zIndex: 10 }}>Interactive GIS Map (Leaflet.js)</p>
            <div style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.1, background: 'url(https://www.mapsofindia.com/maps/rajasthan/districts/kota.jpg) center/cover no-repeat' }}></div>
          </div>
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: `4px solid ${icon.props.color || 'var(--primary)'}` }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>{label}</p>
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>{value}</h2>
      </div>
    </div>
  );
}

// getProjectStage moved to ./utils/workflowUtils.js

function ProjectPERTChart({ project }) {
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

  const mainAxisLength = Math.max(isMobile ? 800 : 1000, nodeCount * (isMobile ? 200 : 260));
  const crossAxisLength = isMobile ? 350 : 600;

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

    const maxOffset = isMobile ? 120 : 240;
    const offsetAmount = isMobile ? (span > 1 ? 50 : 30) : (span > 1 ? 100 : 60);
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
    <div className="glass-card fade-in" style={{ marginBottom: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <TrendingUp size={24} color="#6366f1" /> Execution PERT Network
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Full-scale project dependency map</p>
        </div>
        <div className="desktop-only" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
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

      <div className="custom-scrollbar" style={{ width: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(10, 15, 30, 0.6)' : 'rgba(0, 0, 0, 0.05)', borderRadius: '1.5rem', border: '1px solid var(--glass-border)', boxShadow: theme === 'dark' ? 'inset 0 0 40px rgba(0,0,0,0.4)' : 'none' }}>
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

function ProjectVerticalBarChart({ project }) {
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
                    } catch(e) { 
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

      <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '20px' }} className="custom-scrollbar">
        <div style={{ height: '550px', width: `${minChartWidth}px`, padding: '0 10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 40, right: 30, left: 0, bottom: 120 }}
              barGap={20}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
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
                    // Calculate base Y position at the bottom of the chart
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

function ProjectBarChart({ project }) {
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
    if (act.progress >= 100) return '#10b981'; // Success Green
    if (new Date() > new Date(act.endDate)) return '#ef4444'; // Danger Red
    return '#6366f1'; // Primary Indigo
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

              <div style={{ flex: 1, position: 'relative', height: '36px', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>

                {/* Activity Slot */}
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

                {/* Active Progress Fill */}
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

                {/* Timeline Text */}
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

function ProjectLogs({ projectId }) {
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
    <div className="glass-card" style={{ marginTop: '2rem', padding: '2rem' }}>
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

function ProjectList() {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [viewBin, setViewBin] = useState(false);
  const [viewMode, setViewMode] = useState('CARDS'); // CARDS or TABLE
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [viewBin]);

  const fetchProjects = () => {
    api.get(`/projects`, {
      params: {
        onlyDeleted: viewBin,
        isAdmin: user.role === 'ADMIN',
        _t: Date.now() // Cache busting
      }
    }).then(res => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch(err => {
        console.error("Error fetching projects:", err);
        setProjects([]);
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

  return (
    <div style={{ padding: '1rem' }} className="fade-in">
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
          {filteredProjects.map(p => {
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
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
        <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
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
                {filteredProjects.map(p => {
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
    </div>
  );
}

function DirectionModal({ project, userId, onClose, onSuccess }) {
  const { theme } = useContext(AuthContext);
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/projects/${project.id}/directions`, { direction });
      onSuccess();
    } catch (err) {
      alert(err.message || "Failed to submit direction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay fade-in" style={{
      position: 'fixed', inset: 0, background: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', zIndex: 2000, padding: '4rem 1rem',
      overflowY: 'auto'
    }}>
      <div className="glass-card slide-down" style={{
        width: '100%', maxWidth: '600px', padding: '2.5rem',
        background: 'var(--secondary)', border: '1px solid var(--glass-border)',
        boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 25px 50px -12px rgba(0, 0, 0, 0.1)', borderRadius: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--accent-soft)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Issue Authority Direction</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Administrative instruction for {project.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label style={{ color: 'var(--text-primary)', opacity: 0.8, fontWeight: 600, fontSize: '0.85rem' }}>Direction Details</label>
            <textarea
              rows="6"
              placeholder="Provide clear instructions or directions for the project team..."
              value={direction}
              onChange={e => setDirection(e.target.value)}
              required
              style={{
                width: '100%', padding: '1.25rem', background: 'var(--glass-bg)',
                color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '1rem',
                fontSize: '1rem', lineHeight: 1.6, resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem' }}>
            <button type="button" className="btn" style={{ flex: 1, height: '3.5rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '3.5rem', fontSize: '1rem' }} disabled={loading}>
              {loading ? "Submitting..." : "Issue Direction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectDetails() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPERTEdit, setShowPERTEdit] = useState(false);
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [showOfficialReport, setShowOfficialReport] = useState(false);
  const [chartView, setChartView] = useState('TIMELINE'); // 'NETWORK', 'TIMELINE'

  const location = useLocation();

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('update') === 'true') {
      setShowUpdateModal(true);
    }
  }, [location]);

  const fetchProject = async () => {
    if (!user) return;
    try {
      const res = await api.get('/projects', { params: { isAdmin: user?.role === 'ADMIN', includeDeleted: true } });
      const p = res.data.find(p => p.id === parseInt(id));
      if (p) setProject(p);
      setLoading(false);
    } catch (err) {
      console.error("Fetch Error:", err);
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
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button
              className="btn"
              style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)', textTransform: 'none', fontSize: '0.85rem' }}
              onClick={() => setShowPERTEdit(true)}
            >
              <Settings size={16} /> Modify PERT Structure (DEO Exclusive)
            </button>
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
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', background: 'var(--glass-bg)', padding: '0.4rem', borderRadius: '1rem', width: 'fit-content', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
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
                const filtered = (project.workflows || []).filter(w => project.type !== 'CONSULTANCY' || !obsolete.includes(w.stepName));
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
          <div className="glass-card">
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
              {getProjectStage(project) !== 'COMPLETED' && project.overallStatus && <InfoItem label="Overall Status" value={project.overallStatus} icon={<Info size={16} />} />}
              {project.type === 'EXECUTION' && (
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
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <p style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
                    {project.overallStatus === 'On Hold' ? 'Reason of Hold' : 'Reason of Delay'}
                  </p>
                  {project.overallStatus === 'Delay' && project.statusDelayReasons && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                      {(() => {
                        try {
                          const r = typeof project.statusDelayReasons === 'string' ? JSON.parse(project.statusDelayReasons) : (project.statusDelayReasons || []);
                          const arr = Array.isArray(r) ? r : [r];
                          return arr.filter(Boolean).map((reason, i) => (
                            <span key={i} style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{reason}</span>
                          ));
                        } catch(e) { 
                          return project.statusDelayReasons ? [<span key="0" style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{project.statusDelayReasons}</span>] : null;
                        }
                      })()}
                    </div>
                  )}
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    {project.overallStatus === 'On Hold' ? project.statusHoldReason : (project.overallStatus === 'Delay' ? project.statusDelayBrief : project.delayBrief)}
                  </p>
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

function PERTStructureEditor({ project, userId, onClose, onSuccess }) {
  const [activities, setActivities] = useState((project.pertActivities || []).map(a => ({
    ...a,
    startDate: formatDateForInput(a.startDate),
    endDate: formatDateForInput(a.endDate)
  })));
  const [load, setLoad] = useState(false);

  const addRow = () => setActivities([...activities, { name: '', weightage: 0, startDate: '', endDate: '', progress: 0 }]);
  const removeRow = (idx) => setActivities(activities.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const totalW = activities.reduce((sum, a) => sum + parseFloat(a.weightage || 0), 0);
    if (Math.abs(totalW - 100) > 0.01) {
      alert(`Total weightage must be exactly 100%. Current: ${totalW}%`);
      return;
    }

    if (activities.some(a => !a.name || !a.startDate || !a.endDate)) {
      alert('All fields are mandatory for every activity.');
      return;
    }

    for (const a of activities) {
      if (new Date(a.startDate) > new Date(a.endDate)) {
        alert(`Error in Activity "${a.name}": Start Date cannot be later than Completion Date.`);
        return;
      }
    }

    setLoad(true);
    try {
      await api.post(`/projects/${project.id}/pert`, { activities, userId });
      alert('PERT Structure updated successfully.');
      onSuccess();
    } catch (err) {
      alert(err.message || 'Failed to update PERT structure.');
    } finally {
      setLoad(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
      <div className="glass-card fade-in-up" style={{ width: '100%', maxWidth: '700px', position: 'relative', padding: '2.5rem', background: 'var(--secondary)' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <h2 style={{ marginBottom: '1.5rem' }}>Modify PERT Structure</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>Exclusive Access: DEO Structural Override</p>

        {activities.map((a, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--glass-bg)', position: 'relative', border: '1px solid var(--glass-border)' }}>
            {activities.length > 1 && (
              <button onClick={() => removeRow(idx)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,0,0,0.1)', color: 'var(--error)', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>Remove</button>
            )}
            <div className="input-group">
              <label>Activity Name</label>
              <input value={a.name} onChange={e => {
                const next = [...activities];
                next[idx].name = e.target.value;
                setActivities(next);
              }} />
            </div>
            <div className="responsive-input-grid" style={{ gap: '1rem' }}>
              <div className="input-group">
                <label>Weightage (%)</label>
                <input type="number" value={a.weightage} onChange={e => {
                  const next = [...activities];
                  next[idx].weightage = e.target.value;
                  setActivities(next);
                }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> Start Date
                </label>
                <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(a.startDate)} onChange={e => {
                  const next = [...activities];
                  next[idx].startDate = e.target.value;
                  setActivities(next);
                }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> End Date
                </label>
                <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(a.endDate)} onChange={e => {
                  const next = [...activities];
                  next[idx].endDate = e.target.value;
                  setActivities(next);
                }} />
              </div>
            </div>
          </div>
        ))}

        <button className="btn" style={{ width: '100%', border: '1px dashed var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', marginBottom: '2rem' }} onClick={addRow}>+ Add Activity</button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ flex: 2 }} disabled={load}>
            {load ? 'Saving Changes...' : 'Save PERT Structure'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveCameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
        setLoading(false);
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please ensure permissions are granted.");
        setLoading(false);
      }
    }
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get Location for watermark
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      
      // Watermark styling
      context.fillStyle = 'rgba(0, 0, 0, 0.6)';
      context.fillRect(0, canvas.height - 120, canvas.width, 120);
      
      context.fillStyle = 'white';
      context.font = 'bold 24px Inter, sans-serif';
      context.fillText(`KDA DRISHTI - OFFICIAL SITE EVIDENCE`, 30, canvas.height - 80);
      context.font = '18px Inter, sans-serif';
      context.fillText(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, 30, canvas.height - 50);
      context.fillText(`Timestamp: ${timestamp}`, 30, canvas.height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(dataUrl);
    }, (err) => {
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, canvas.height - 60, canvas.width, 60);
        context.fillStyle = 'white';
        context.font = 'bold 20px Inter, sans-serif';
        context.fillText(`KDA DRISHTI - ${timestamp}`, 30, canvas.height - 25);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 3001 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '50%', backdropFilter: 'blur(10px)' }}>
          <X size={24} />
        </button>
      </div>

      {loading && <div style={{ color: 'white', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>Initializing Camera...</div>}
      {error && <div style={{ color: 'var(--error)', padding: '2rem', textAlign: 'center', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>{error}</div>}
      
      <video ref={videoRef} autoPlay playsInline style={{ flex: 1, objectFit: 'cover', display: (loading || error) ? 'none' : 'block' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!loading && !error && (
        <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
          <button 
            onClick={capturePhoto}
            className="pulse"
            style={{ 
              width: '80px', height: '80px', borderRadius: '50%', border: '6px solid white', 
              background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'white' }} />
          </button>
        </div>
      )}
    </div>
  );
}

function CycleUpdateWizard({ project, userId, userRole, onClose, onSuccess }) {
  const { user } = useContext(AuthContext);
  // Logic to determine initial step based on handover
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get(`/projects/${project.id}/config`);
        setConfig(res.data);
      } catch (err) {
        console.error("Config fetch error:", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [project.id]);

  const [step, setStep] = useState(1); // Default to 1, will adjust after config load
  
  useEffect(() => {
    if (config) {
      // Adjust initial step based on config
      const isWorkOrderDone = (project.workflows || []).some(w => (w.stepName === 'Work Order Issued' || w.stageKey === 'WORK_ORDER') && w.isCompleted);
      const firstIncompleteIdx = workflowUpdates.findIndex(w => !w.isCompleted);
      
      if (userRole === 'ADMIN' && project.currentProgress >= 100) setStep(1);
      else if (firstIncompleteIdx !== -1) setStep(2);
      else if (project.type === 'EXECUTION' && isWorkOrderDone && project.currentProgress < 100) setStep(3);
      else setStep(4);
    }
  }, [config]);
  const [load, setLoad] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // State for Step 1: Master Field Updates
  const [masterFields, setMasterFields] = useState({
    name: project.name,
    brief: project.brief || '',
    estimatedCost: project.estimatedCost,
    fundingAgency: project.fundingAgency,
    inchargeName: project.inchargeName,
    inchargeMobile: project.inchargeMobile,
    consultantName: project.consultantName || '',
    consultantMobile: project.consultantMobile || '',
    contractorName: project.contractorName || '',
    contractorMobile: project.contractorMobile || '',
    fieldData: (() => {
      try {
        return project.fieldData ? JSON.parse(project.fieldData) : {};
      } catch (e) { return {}; }
    })()
  });

  const [workflowUpdates, setWorkflowUpdates] = useState(() => {
    let w = (project.workflows || []).map(item => {
      // Sync milestone date with project master dates if missing
      let date = item.date;
      if (item.stepName === 'Work Order Issued' && !date && project.actualStartDate) {
        date = project.actualStartDate;
      }
      return { ...item, date };
    });

    // 1. NIT/Tender Opened Migration for existing projects (EXECUTION only or NIT Consultancy)
    const hasNIT = w.some(item => item.stepName === 'NIT Published');
    const isSingleSource = project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE';

    if (!hasNIT && !isSingleSource) {
      const oldIdx = w.findIndex(item => item.stepName === 'Tender Processed');
      const nit = { stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' };
      const opened = { stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' };

      if (oldIdx !== -1) {
        // Replace old "Tender Processed" with the two new steps
        w.splice(oldIdx, 1, nit, opened);
      } else {
        // Insert before "Work Order Issued"
        const woIdx = w.findIndex(item => item.stepName === 'Work Order Issued');
        if (woIdx !== -1) w.splice(woIdx, 0, nit, opened);
        else w.push(nit, opened);
      }
    }

    // 2. Consultancy DPR Granularity Migration
    if (project.type === 'CONSULTANCY') {
      // Remove legacy/irrelevant steps
      const obsolete = ['DPR Submitted', 'DPR Approved', 'Technical Sanction'];
      w = w.filter(item => !obsolete.includes(item.stepName));

      // Ensure granular steps exist
      const granular = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
      for (const s of granular) {
        if (!w.some(item => item.stepName === s)) {
          w.push({ stepName: s, isCompleted: false, value: 'No', reason: '', date: '' });
        }
      }
    }
    return w;
  });

  // Re-sync workflowUpdates when config loads to ensure display names match
  useEffect(() => {
    if (config && config.stages) {
      setWorkflowUpdates(prev => {
        return config.stages.map(stage => {
          const existing = prev.find(p => p.stageKey === stage.stageKey || p.stepName === stage.displayName || p.stepName === stage.stageKey);
          return {
            id: existing?.id,
            stageKey: stage.stageKey,
            stepName: stage.displayName,
            isCompleted: existing?.isCompleted || false,
            value: existing?.value || 'No',
            reason: existing?.reason || '',
            date: existing?.date || ''
          };
        });
      });
    }
  }, [config]);

  const [pertUpdates, setPertUpdates] = useState(((project.pertActivities || [])).map(p => ({
    id: p.id,
    name: p.name,
    weightage: p.weightage,
    progress: p.progress,
    startDate: p.startDate,
    endDate: p.endDate
  })));

  const [statusUpdate, setStatusUpdate] = useState({
    physicalProgress: project.currentProgress,
    financialProgress: 0,
    remarks: '',
    gpsLat: null,
    gpsLong: null,
    photos: [],
    actualStartDate: project.actualStartDate || '',
    stipulatedCompletionDate: project.stipulatedCompletionDate || '',
    overallStatus: project.overallStatus || '',
    statusHoldReason: project.statusHoldReason || '',
    statusDelayReasons: (() => {
      try {
        if (!project.statusDelayReasons) return [];
        if (typeof project.statusDelayReasons === 'string' && (project.statusDelayReasons.startsWith('[') || project.statusDelayReasons.startsWith('{'))) {
          return JSON.parse(project.statusDelayReasons);
        }
        if (Array.isArray(project.statusDelayReasons)) return project.statusDelayReasons;
        return [project.statusDelayReasons];
      } catch (e) {
        return [project.statusDelayReasons];
      }
    })(),
    statusDelayBrief: project.statusDelayBrief || '',
    todaysUpdateNote: project.todaysUpdateNote || '',
    expectedCompletionDate: project.expectedCompletionDate || '',
    timeExtension: project.timeExtension || '',
    contractorName: project.contractorName || '',
    contractorMobile: project.contractorMobile || '',
    consultantName: project.consultantName || '',
    consultantMobile: project.consultantMobile || '',
    qualitySampling: project.qualitySampling || 'No',
    qualitySamplingReason: project.qualitySamplingReason || '',
    fieldData: (() => {
      try {
        return JSON.parse(project.fieldData || '{}');
      } catch (e) {
        return {};
      }
    })()
  });

  const captureGPS = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setStatusUpdate({ ...statusUpdate, gpsLat: pos.coords.latitude, gpsLong: pos.coords.longitude });
    });
  };

  const calculateOverallProgress = (uPert) => {
    return uPert.reduce((sum, p) => sum + (parseFloat(p.progress || 0) * (parseFloat(p.weightage || 0) / 100)), 0).toFixed(1);
  };

  const renderDynamicFields = (location) => {
    const fields = (config?.fields || []).filter(f => f.location === location && f.isActive);
    if (fields.length === 0) return null;

    return fields.sort((a, b) => a.sequenceOrder - b.sequenceOrder).map(field => (
      <div key={field.fieldKey} className="input-group fade-in" style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
          {field.displayName} {field.isRequired && <span style={{ color: 'var(--error)' }}>*</span>}
        </label>
        {field.fieldType === 'select' ? (
          <YesNoToggle
            value={statusUpdate.fieldData[field.fieldKey] || 'No'}
            onChange={val => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: val }
            }))}
          />
        ) : field.fieldType === 'date' ? (
          <input
            type="date"
            value={statusUpdate.fieldData[field.fieldKey] || ''}
            onChange={e => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: e.target.value }
            }))}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
        ) : (
          <input
            type={field.fieldType === 'number' ? 'number' : 'text'}
            value={statusUpdate.fieldData[field.fieldKey] || ''}
            placeholder={`Enter ${field.displayName.toLowerCase()}...`}
            onChange={e => setStatusUpdate(prev => ({
              ...prev,
              fieldData: { ...prev.fieldData, [field.fieldKey]: e.target.value }
            }))}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
        )}
      </div>
    ));
  };

  const validateDates = (updatedWorkflows) => {
    for (let i = 0; i < updatedWorkflows.length; i++) {
      const current = updatedWorkflows[i];
      if (project.type === 'CONSULTANCY' && current.stepName === 'Technical Sanction') continue;
      const isSingleSource = project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE';
      if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(current.stepName)) continue;

      if (current.value === 'Yes' && current.date) {
        // 1. Backward check (against predecessors)
        for (let j = i - 1; j >= 0; j--) {
          const prev = updatedWorkflows[j];
          if (project.type === 'CONSULTANCY' && prev.stepName === 'Technical Sanction') continue;
          if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(prev.stepName)) continue;
          if (prev.value === 'Yes' && prev.date) {
            const dCurrent = normalizeDate(current.date);
            const dPrev = normalizeDate(prev.date);
            if (dCurrent && dPrev && dCurrent < dPrev) {
              alert(`Date Conflict: "${getStepDisplayName(current.stepName)}" (${dCurrent}) cannot be before "${getStepDisplayName(prev.stepName)}" (${dPrev}).`);
              return false;
            }
            break;
          }
        }
        // 2. Forward check (against successors)
        for (let k = i + 1; k < updatedWorkflows.length; k++) {
          const nextStep = updatedWorkflows[k];
          if (project.type === 'CONSULTANCY' && nextStep.stepName === 'Technical Sanction') continue;
          if (isSingleSource && ['NIT Published', 'Tender Opened'].includes(nextStep.stepName)) continue;
          if (nextStep.value === 'Yes' && nextStep.date) {
            const dCurrent = normalizeDate(current.date);
            const dNext = normalizeDate(nextStep.date);
            if (dCurrent && dNext && dCurrent > dNext) {
              alert(`Date Conflict: "${getStepDisplayName(current.stepName)}" (${dCurrent}) cannot be after "${getStepDisplayName(nextStep.stepName)}" (${dNext}).`);
              return false;
            }
            break;
          }
        }
      }
    }
    return true;
  };

  const handleFinalSubmit = async (isQuickSave = false) => {
    setLoad(true);
    const isFinalStage = step === 6;
    const isConsultancyDone = project.type === 'CONSULTANCY' && workflowUpdates.every(w => w.value === 'Yes');

    // 1. STRICT VALIDATION: Check for empty reasons in ACTIVE milestones only
    let activeIdx = -1;
    for (let i = 0; i < workflowUpdates.length; i++) {
      if (project.type === 'CONSULTANCY' && workflowUpdates[i].stepName === 'Technical Sanction') continue;
      if (workflowUpdates[i].value === 'No') {
        activeIdx = i;
        break; // Only the FIRST 'No' matters for current block
      }
    }

    if (!isQuickSave && activeIdx !== -1) {
      const current = workflowUpdates[activeIdx];
      if (!current.reason || current.reason.trim().length < 5) {
        window.alert(`Dhyan dein: "${getStepDisplayName(current.stepName)}" ke liye Reason for Delay mention karna anivarya hai.`);
        setLoad(false);
        return; // BLOCK SUBMISSION
      }
    }

    // 2. PROGRESS REGRESSION CHECK
    if (statusUpdate.physicalProgress < project.currentProgress) {
      window.alert(`Progress Violation: Nayi progress (${statusUpdate.physicalProgress}%) pichli record ki gayi progress (${project.currentProgress}%) se kam nahi ho sakti.`);
      return;
    }

    // 3. STATUS vs MILESTONE CONSISTENCY
    if (statusUpdate.overallStatus === 'COMPLETED') {
      const isWorkStarted = project.workStarted === 'Yes';
      const hasWorkOrder = project.workflows?.some(w => w.stepName === 'Work Order Issued' && w.value === 'Yes');
      if (!isWorkStarted || !hasWorkOrder) {
        window.alert("Completion Blocked: Project ko COMPLETED nahi mark kiya ja sakta jab tak Work Order Issue na ho aur Work Start na ho.");
        return;
      }
    }

    const hasEvidenceRights = userRole === 'ENGINEER' || userRole === 'DEO';
    // STRICT RULE: No bypass for progress updates (Step 6)
    const isProgressUpdate = isFinalStage || isConsultancyDone;

    if (isProgressUpdate && hasEvidenceRights) {
      if (statusUpdate.photos.length < 1) { window.alert('Submission Blocked: At least 1 site photo is mandatory for engineering evidence.'); return; }
      if (statusUpdate.gpsLat === null || statusUpdate.gpsLat === undefined) { window.alert('Submission Blocked: GPS location capture is mandatory for site updates.'); return; }
      if (!statusUpdate.remarks || statusUpdate.remarks.trim().length < 2) { window.alert('Submission Blocked: Please enter brief engineering observations.'); return; }
    }

    // 2. CHRONOLOGICAL DATE VALIDATION: Ensure no prior date for next stage
    if (!validateDates(workflowUpdates)) return; // BLOCK SUBMISSION

    let finalStatusUpdate = { ...statusUpdate };
    if (project.type === 'CONSULTANCY') {
      const dprSub = workflowUpdates.find(w => w.stepName === 'DPR Submitted');
      const dprApp = workflowUpdates.find(w => w.stepName === 'DPR Approved');

      if (dprApp?.value === 'Yes') {
        finalStatusUpdate.todaysUpdateNote = "DPR Approved. Project Lifecycle Completed.";
        finalStatusUpdate.physicalProgress = 100;
        finalStatusUpdate.financialProgress = 100;
        finalStatusUpdate.overallStatus = 'On Track';
      } else if (dprApp?.value === 'No' && dprSub?.value === 'Yes') {
        finalStatusUpdate.todaysUpdateNote = "DPR Pending to be approved. Reason: " + (dprApp.reason || 'Not specified');
        finalStatusUpdate.overallStatus = 'Delay';
      } else if (dprSub?.value === 'No') {
        finalStatusUpdate.todaysUpdateNote = "DPR Pending to be submitted. Reason: " + (dprSub.reason || 'Not specified');
        finalStatusUpdate.overallStatus = 'Delay';
      }
    }

    try {
      // Process photos to Base64 before sending (ONLY for authorized roles)
      let base64Photos = statusUpdate.photos;
      if (userRole === 'ENGINEER' || userRole === 'DEO') {
        base64Photos = await Promise.all(statusUpdate.photos.map(p => {
          if (typeof p === 'string') return p; // Already uploaded/base64
          return fileToBase64(p);
        }));
      }

      await api.post(`/projects/${project.id}/cycle-update`, {
        userId: parseInt(userId),
        projectMasterUpdates: (userRole === 'DEO' || userRole === 'ADMIN') ? {
          ...masterFields,
          fieldData: JSON.stringify(masterFields.fieldData)
        } : null,
        workflowUpdates: workflowUpdates.map(w => ({
          id: w.id,
          stepName: w.stepName,
          isCompleted: w.isCompleted,
          value: w.value,
          date: w.date,
          reason: w.reason
        })),
        pertUpdates: project.type === 'EXECUTION' ? pertUpdates.map(p => ({ id: p.id, progress: p.progress })) : [],
        statusUpdate: {
          ...finalStatusUpdate,
          fieldData: JSON.stringify(statusUpdate.fieldData),
          photos: base64Photos,
          isProgressUpdate: isFinalStage || isConsultancyDone
        }
      });
      setSubmitted(true); // Switch to acknowledgment screen
    } catch (err) {
      alert(err.message || 'Update failed - Please check all mandatory fields and connection.');
    } finally {
      setLoad(false);
    }
  };

  const renderStep1 = () => (
    <div className="fade-in">
      <h4>Step 1: Project Master Review</h4>
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.1)', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {userRole === 'DEO' || userRole === 'ADMIN' ? (
          <>
            <div className="input-group">
              <label>Project Name</label>
              <input value={masterFields.name} onChange={e => setMasterFields({ ...masterFields, name: e.target.value })} />
            </div>
            {renderDynamicFields(config, 'AFTER_NAME', masterFields, setMasterFields)}
            <div className="input-group">
              <label>Project Brief Description</label>
              <textarea
                value={masterFields.brief}
                onChange={e => setMasterFields({ ...masterFields, brief: e.target.value })}
                style={{ minHeight: '80px', padding: '0.75rem', fontSize: '0.9rem' }}
                placeholder="Update project brief..."
              />
            </div>
            {renderDynamicFields(config, 'MASTER', masterFields, setMasterFields)}
            <div className="responsive-input-grid">
              <div className="input-group">
                <label>Estimated Cost (Lakhs)</label>
                <input type="number" value={masterFields.estimatedCost} onChange={e => setMasterFields({ ...masterFields, estimatedCost: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Funding Agency</label>
                <input value={masterFields.fundingAgency} onChange={e => setMasterFields({ ...masterFields, fundingAgency: e.target.value })} />
              </div>
            </div>
            {renderDynamicFields(config, 'AFTER_FUNDING', masterFields, setMasterFields)}
            {renderDynamicFields(config, 'FINANCIAL', masterFields, setMasterFields)}

            <div className="responsive-input-grid">
              <div className="input-group">
                <label>Executive Engineer</label>
                <input value={masterFields.inchargeName} onChange={e => setMasterFields({ ...masterFields, inchargeName: sanitizeName(e.target.value) })} />
              </div>
              <div className="input-group">
                <label>Executive Engineer Mobile</label>
                <input value={masterFields.inchargeMobile} onChange={e => setMasterFields({ ...masterFields, inchargeMobile: sanitizeMobile(e.target.value) })} maxLength={10} />
              </div>
            </div>

            {project.type === 'EXECUTION' && (
              <>
                <div className="responsive-input-grid">
                  <div className="input-group">
                    <label>Consultant Name</label>
                    <input value={masterFields.consultantName} onChange={e => setMasterFields({ ...masterFields, consultantName: sanitizeName(e.target.value) })} />
                  </div>
                  <div className="input-group">
                    <label>Consultant Mobile</label>
                    <input value={masterFields.consultantMobile} onChange={e => setMasterFields({ ...masterFields, consultantMobile: sanitizeMobile(e.target.value) })} maxLength={10} />
                  </div>
                </div>
                {renderDynamicFields(config, 'AFTER_CONSULTANT', masterFields, setMasterFields)}

                <div className="responsive-input-grid">
                  <div className="input-group">
                    <label>Contractor Name</label>
                    <input value={masterFields.contractorName} onChange={e => setMasterFields({ ...masterFields, contractorName: sanitizeName(e.target.value) })} />
                  </div>
                  <div className="input-group">
                    <label>Contractor Mobile</label>
                    <input value={masterFields.contractorMobile} onChange={e => setMasterFields({ ...masterFields, contractorMobile: sanitizeMobile(e.target.value) })} maxLength={10} />
                  </div>
                </div>
                {renderDynamicFields(config, 'CONTRACTOR', masterFields, setMasterFields)}
                {renderDynamicFields(config, 'OTHER', masterFields, setMasterFields)}
              </>
            )}
          </>
        ) : (
          <div style={{ padding: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{masterFields.name}</p>
            <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Cost: ₹{masterFields.estimatedCost} Lakhs</p>
          </div>
        )}
      </div>

      {/* Live Sync Progress Indicator */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Live Sync Progress</span>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
            {((workflowUpdates.filter(w => w.value === 'Yes').length / workflowUpdates.length) * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${(workflowUpdates.filter(w => w.value === 'Yes').length / workflowUpdates.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
          <button className="btn" style={{ flex: 1, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
            Quick Save & Exit
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => {
          if (userRole === 'DEO' || userRole === 'ADMIN') {
            if (!masterFields.name || !masterFields.estimatedCost) {
              alert('Project Name and Estimated Cost are mandatory for updates.');
              return;
            }
          }
          setStep(2);
        }}>Next: Pre-Execution</button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    // Determine how many steps to show based on dependencies
    let visibleCount = 1;
    for (let i = 0; i < workflowUpdates.length - 1; i++) {
      const curW = workflowUpdates[i];
      if (project.type === 'CONSULTANCY' && curW.stepName === 'Technical Sanction') {
        visibleCount++;
        continue;
      }
      const tenderSteps = ['NIT Published', 'Tender Opened'];
      if (project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(curW.stepName)) {
        visibleCount++;
        continue;
      }
      if (curW.value === 'Yes' && curW.date) {
        visibleCount++;
      } else {
        break;
      }
    }

    return (
      <div className="fade-in">
        <h4>Step 2: Pre-Execution Milestones</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Steps must be completed in order. PERT is only accessible after Work Order.
        </p>

        {workflowUpdates.slice(0, visibleCount).map((w, idx) => {
          if (project.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') return null;

          // Skip tender steps for Single Source consultancy projects
          const tenderSteps = ['NIT Published', 'Tender Opened'];
          if (project.type === 'CONSULTANCY' && project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(w.stepName)) return null;

          const isDPR = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'].includes(w.stepName);
          const isWOLocked = project.type === 'CONSULTANCY' && isDPR && workflowUpdates.find(item => item.stepName === 'Work Order Issued')?.value !== 'Yes';

          return (
            <div key={idx} className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: w.value === 'Yes' ? '4px solid var(--success)' : '4px solid var(--error)', opacity: isWOLocked ? 0.5 : 1, pointerEvents: isWOLocked ? 'none' : 'auto', cursor: isWOLocked ? 'not-allowed' : 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{w.stepName}</span>
                <YesNoToggle
                  value={w.value}
                  onChange={val => {
                    const dprSteps = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
                    if (project.type === 'CONSULTANCY' && dprSteps.includes(w.stepName)) {
                      const wo = workflowUpdates.find(item => item.stepName === 'Work Order Issued');
                      if (!wo || wo.value !== 'Yes') {
                        alert("You cannot proceed until the Work Start Date (As per Work Order) is recorded.");
                        return;
                      }
                    }
                    const next = [...workflowUpdates];
                    next[idx].value = val;
                    next[idx].isCompleted = val === 'Yes';
                    if (val === 'No') {
                      for (let j = idx + 1; j < next.length; j++) {
                        next[j].value = 'No';
                        next[j].isCompleted = false;
                        next[j].date = '';
                      }
                    }
                    setWorkflowUpdates(next);
                  }}
                />
              </div>

              {w.value === 'Yes' ? (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {w.stepName !== 'Work Order Issued' && (
                    <>
                      <label>Date of Achievement</label>
                      <input
                        type="date"
                        min="1900-01-01"
                        max="2099-12-31"
                        value={formatDateForInput(w.date)}
                        required
                        onChange={e => {
                          const val = e.target.value;
                          const next = [...workflowUpdates];
                          next[idx].date = val;
                          setWorkflowUpdates(next);

                          // Only alert if the date is fully formed (10 chars: YYYY-MM-DD)
                          // This prevents annoying alerts while the user is still typing the year/month
                          if (val && val.length === 10) {
                            validateDates(next);
                          }
                        }}
                      />
                    </>
                  )}

                  {w.stepName === 'Work Order Issued' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} color="var(--primary)" /> Work Start Date (As per Work Order)
                        </label>
                        <input
                          type="date"
                          min="1900-01-01"
                          max="2099-12-31"
                          value={formatDateForInput(statusUpdate.actualStartDate)}
                          onChange={e => {
                            const val = e.target.value;
                            setStatusUpdate({ ...statusUpdate, actualStartDate: val });
                            const next = [...workflowUpdates];
                            next[idx].date = val;
                            setWorkflowUpdates(next);
                            if (val && val.length === 10) {
                              validateDates(next);
                            }
                          }}
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} color="var(--primary)" /> Stipulated Completion Date
                        </label>
                        <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(statusUpdate.stipulatedCompletionDate)} onChange={e => setStatusUpdate({ ...statusUpdate, stipulatedCompletionDate: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {w.stepName === 'Work Order Issued' && project.type === 'EXECUTION' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Name of Contractor</label>
                        <input value={statusUpdate.contractorName} onChange={e => setStatusUpdate({ ...statusUpdate, contractorName: sanitizeName(e.target.value) })} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Contractor Mobile</label>
                        <input maxLength="10" value={statusUpdate.contractorMobile} onChange={e => setStatusUpdate({ ...statusUpdate, contractorMobile: sanitizeMobile(e.target.value) })} />
                      </div>
                    </div>
                  )}
                  {w.stepName === 'Work Order Issued' && project.type === 'CONSULTANCY' && (
                    <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Name of Consultant</label>
                        <input value={statusUpdate.consultantName || ''} onChange={e => setStatusUpdate({ ...statusUpdate, consultantName: sanitizeName(e.target.value) })} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Consultant Mobile</label>
                        <input maxLength="10" value={statusUpdate.consultantMobile || ''} onChange={e => setStatusUpdate({ ...statusUpdate, consultantMobile: sanitizeMobile(e.target.value) })} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label>Reason for Delay (Mandatory)</label>
                  <textarea
                    placeholder="Why is this step pending?"
                    value={w.reason}
                    required
                    onChange={e => {
                      const next = [...workflowUpdates];
                      next[idx].reason = e.target.value;
                      setWorkflowUpdates(next);
                    }}
                    style={{ minHeight: '60px', padding: '0.5rem' }}
                  />
                </div>
              )}
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>

          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.75rem' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}

          {workflowUpdates.slice(0, visibleCount).some(w => w.value === 'No') ? (
            <button
              className="btn btn-primary"
              style={{ flex: 1, background: 'var(--error)' }}
              onClick={() => {
                const pendingStep = workflowUpdates.slice(0, visibleCount).find(w => {
                  if (w.value !== 'No') return false;
                  // Skip validation for steps that are filtered out in UI
                  if (project.type === 'CONSULTANCY') {
                    if (w.stepName === 'Technical Sanction') return false;
                    const tenderSteps = ['NIT Published', 'Tender Opened'];
                    if (project.consultancySource === 'SINGLE_SOURCE' && tenderSteps.includes(w.stepName)) return false;
                  }
                  return true;
                });
                if (pendingStep && (!pendingStep.reason || pendingStep.reason.trim().length < 5)) {
                  alert(`Mandatory: Please provide a valid Reason for Delay for "${getStepDisplayName(pendingStep.stepName)}" before submitting.`);
                  return;
                }
                handleFinalSubmit();
              }}
              disabled={load}
            >
              {load ? 'Saving...' : (
                project.type === 'CONSULTANCY'
                  ? `Submit Update: ${getStepDisplayName(workflowUpdates.slice(0, visibleCount).find(w => w.value === 'No')?.stepName)} Pending`
                  : 'Submit & Exit (Work Stalled)'
              )}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                const lastVisible = workflowUpdates[visibleCount - 1];
                if (lastVisible.value === 'Yes' && !lastVisible.date) {
                  const label = getStepDisplayName(lastVisible.stepName);
                  alert(`Please enter the date for ${label}`);
                  return;
                }

                // Consultancy Final Submission directly from Step 2 if Final DPR Approved is Yes
                if (project.type === 'CONSULTANCY' && workflowUpdates.find(w => w.stepName === 'Final DPR Approved')?.value === 'Yes') {
                  handleFinalSubmit();
                  return;
                }
                // Chronological Check (Next Step)
                if (!validateDates(workflowUpdates)) return;

                // If all are Yes, determine next step
                const allDone = workflowUpdates.every(w => w.isCompleted);
                if (allDone) {
                  if (project.type === 'EXECUTION') setStep(3);
                  else if (project.type === 'CONSULTANCY') handleFinalSubmit(); // Consultancy ends at milestones
                  else setStep(4);
                } else {
                  alert('Complete all milestones or provide reasons for delay to proceed.');
                }
              }}
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const totalCalc = calculateOverallProgress(pertUpdates);

    return (
      <div className="fade-in">
        <h4>Step 3: PERT Activity Progress</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
          Update progress for each activity. Overall project progress is calculated automatically.
        </p>

        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)' }}>
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>Effect on Physical Progress: {totalCalc}%</p>
        </div>

        {pertUpdates.map((p, idx) => (
          <div key={idx} className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600 }}>{p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.weightage}%)</span></span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{p.progress}%</span>
            </div>
            <input type="range" min="0" max="100" value={p.progress} onChange={e => {
              const next = [...pertUpdates];
              next[idx].progress = e.target.value;
              setPertUpdates(next);
              // Also update the overall physical progress in Step 4
              setStatusUpdate({ ...statusUpdate, physicalProgress: calculateOverallProgress(next) });
            }} style={{ width: '100%', accentColor: 'var(--success)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>Start: {formatDate(p.startDate)}</span>
              <span>Deadline: {formatDate(p.endDate)}</span>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(4)}>Confirm & Next</button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="fade-in">
      <h4>Step 4: Overall Progress Stats</h4>
      <div className="input-group">
        <label>Physical Progress (%) — Calculated from PERT</label>
        <input type="number" readOnly value={statusUpdate.physicalProgress} style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }} />
      </div>
      <div className="input-group">
        <label>Financial Progress (%)</label>
        <input type="number" value={statusUpdate.financialProgress} onChange={e => setStatusUpdate({ ...statusUpdate, financialProgress: e.target.value })} />
      </div>
      {renderDynamicFields('UPDATE_PROGRESS')}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => setStep(project.type === 'EXECUTION' ? 3 : 2)}>Back</button>
        {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
          <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
            Quick Save
          </button>
        )}
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(5)}>Next: Overall Status</button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    return (
      <div className="fade-in">
        <h4>Step 5: Overall Project Status</h4>

        <StatusToggle value={statusUpdate.overallStatus} onChange={val => setStatusUpdate({ ...statusUpdate, overallStatus: val })} />

        {statusUpdate.overallStatus === 'On Hold' && (
          <div className="input-group fade-in">
            <label>Reason for Hold (Mandatory)</label>
            <textarea
              value={statusUpdate.statusHoldReason}
              onChange={e => setStatusUpdate({ ...statusUpdate, statusHoldReason: e.target.value })}
              placeholder="Why is the project on hold?"
              style={{ minHeight: '60px', padding: '0.5rem' }}
            />
          </div>
        )}

        {statusUpdate.overallStatus === 'Delay' && (
          <div className="glass-card fade-in" style={{ padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--warning)' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Reason for Delay</label>
            <div className="responsive-input-grid" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
              {['Land Acquisition', 'Utility Shifting', 'Encroachment', 'NOC (Forest/Pollution/Other)', 'Court Case/Stay', 'Any Other'].map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={(statusUpdate.statusDelayReasons || []).includes(r)}
                    onChange={e => {
                      const current = statusUpdate.statusDelayReasons || [];
                      if (e.target.checked) setStatusUpdate({ ...statusUpdate, statusDelayReasons: [...current, r] });
                      else setStatusUpdate({ ...statusUpdate, statusDelayReasons: current.filter(cr => cr !== r) });
                    }}
                  />
                  {r}
                </label>
              ))}
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Brief Reason for Delay (Mandatory)</label>
              <textarea
                value={statusUpdate.statusDelayBrief}
                onChange={e => setStatusUpdate({ ...statusUpdate, statusDelayBrief: e.target.value })}
                placeholder="Provide brief details about the delay..."
                style={{ minHeight: '60px', padding: '0.5rem' }}
              />
            </div>
          </div>
        )}

        <div className="input-group">
          <label>Today's Update Note (Mandatory)</label>
          <textarea
            value={statusUpdate.todaysUpdateNote}
            onChange={e => setStatusUpdate({ ...statusUpdate, todaysUpdateNote: e.target.value })}
            placeholder="Brief note about the progress till today..."
            style={{ minHeight: '60px', padding: '0.5rem' }}
          />
        </div>

        {project.type === 'EXECUTION' && !config?.fields?.some(f => f.location === 'UPDATE_STATUS' && f.fieldKey.includes('QUALITY')) && (
          <>
            <YesNoToggle
              label="Quality Sampling as per norms"
              value={statusUpdate.qualitySampling}
              onChange={val => setStatusUpdate({ ...statusUpdate, qualitySampling: val })}
            />

            {statusUpdate.qualitySampling === 'No' && (
              <div className="input-group fade-in">
                <label style={{ color: '#f87171' }}>Reason for No Quality Sampling (Mandatory)</label>
                <textarea
                  value={statusUpdate.qualitySamplingReason}
                  onChange={e => setStatusUpdate({ ...statusUpdate, qualitySamplingReason: e.target.value })}
                  placeholder="Please provide a valid reason why quality sampling was not done..."
                  style={{ minHeight: '60px', padding: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                />
              </div>
            )}
          </>
        )}

        <div className="input-group">
          <label>Expected Date of Project Completion (Mandatory)</label>
          <input
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={formatDateForInput(statusUpdate.expectedCompletionDate)}
            onChange={e => setStatusUpdate({ ...statusUpdate, expectedCompletionDate: e.target.value })}
          />
        </div>

        {!config?.fields?.some(f => f.location === 'UPDATE_STATUS' && f.fieldKey.includes('EXTENSION')) && (
          <YesNoToggle
            label="Time Extension Taken?"
            value={statusUpdate.timeExtension}
            onChange={val => setStatusUpdate({ ...statusUpdate, timeExtension: val })}
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        {renderDynamicFields('UPDATE_STATUS')}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(4)}>Back</button>
          {(userRole === 'DEO' || userRole === 'ADMIN' || userRole === 'ENGINEER') && (
            <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }} onClick={() => handleFinalSubmit(true)}>
              Quick Save
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
            if (!statusUpdate.overallStatus) { alert("Please select an overall status."); return; }
            if (statusUpdate.overallStatus === 'On Hold' && !statusUpdate.statusHoldReason) { alert("Reason for hold is mandatory."); return; }
            if (statusUpdate.overallStatus === 'Delay') {
              if (!statusUpdate.statusDelayReasons || statusUpdate.statusDelayReasons.length === 0) { alert("Please select at least one reason for delay."); return; }
              if (!statusUpdate.statusDelayBrief) { alert("Brief reason for delay is mandatory."); return; }
            }
            if (!statusUpdate.todaysUpdateNote) { alert("Today's update note is mandatory."); return; }
            if (project.type === 'EXECUTION' && statusUpdate.qualitySampling === 'No' && !statusUpdate.qualitySamplingReason) { alert("Reason for no quality sampling is mandatory."); return; }
            if (!statusUpdate.expectedCompletionDate) { alert("Expected date of completion is mandatory."); return; }

            // Time Extension validation: Mandatory if Expected > Stipulated
            const expTime = statusUpdate.expectedCompletionDate ? new Date(statusUpdate.expectedCompletionDate).getTime() : 0;
            const stipTime = statusUpdate.stipulatedCompletionDate ? new Date(statusUpdate.stipulatedCompletionDate).getTime() : 0;
            if (expTime > stipTime && !statusUpdate.timeExtension) {
              alert("Dhyan dein: Expected Completion Date contract ki Stipulated Date se aage hai. Kripya Time Extension (Yes/No) record karein.");
              return;
            }

            // Skip Evidence for Consultancy
            if (project.type === 'CONSULTANCY') {
              handleFinalSubmit();
              return;
            }

            setStep(6);
          }}>Next: Evidence</button>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const hasEvidenceRights = userRole === 'ENGINEER' || userRole === 'DEO';

    return (
      <div className="fade-in">
        <h4>Step 6: Geo-Tag & Visuals</h4>

        {!hasEvidenceRights && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Info size={24} color="var(--primary)" />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Notice:</strong> Visual evidence and site coordinates are locked. Only the <strong>Field Engineer</strong> or <strong>DEO</strong> can update these details. Existing evidence will be preserved.
            </p>
          </div>
        )}

        <div className="input-group">
          {hasEvidenceRights ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={captureGPS}
              style={{ width: '100%', height: '4rem', fontSize: '1.1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)', borderRadius: '1rem' }}
            >
              <MapPin size={24} /> {statusUpdate.gpsLat !== null ? 'LOCATION LOCKED' : 'SYNC SITE COORDINATES'}
            </button>
          ) : (
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapPin size={20} color="var(--text-muted)" />
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Locked Coordinates</p>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{project.gpsLat || '---'}, {project.gpsLong || '---'}</p>
              </div>
            </div>
          )}

          {hasEvidenceRights && statusUpdate.gpsLat !== null && <p style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>{statusUpdate.gpsLat}, {statusUpdate.gpsLong}</p>}

          {userRole === 'DEO' && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,165,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,165,0,0.2)' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--warning)' }}>Manual Coordinates Override</label>
              <div className="responsive-input-grid" style={{ gap: '1rem' }}>
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g., 0)"
                  value={statusUpdate.gpsLat !== null ? statusUpdate.gpsLat : ''}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, gpsLat: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  style={{ 
                    padding: '0.6rem 1rem', borderRadius: '8px', 
                    border: '1px solid var(--warning)', background: 'var(--input-bg)', 
                    color: 'var(--text-primary)', width: '100%', fontSize: '0.9rem' 
                  }}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g., 0)"
                  value={statusUpdate.gpsLong !== null ? statusUpdate.gpsLong : ''}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, gpsLong: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  style={{ 
                    padding: '0.6rem 1rem', borderRadius: '8px', 
                    border: '1px solid var(--warning)', background: 'var(--input-bg)', 
                    color: 'var(--text-primary)', width: '100%', fontSize: '0.9rem' 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="input-group">
          <label style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {userRole === 'ENGINEER' ? 'CAPTURE SITE PHOTOS (CAMERA ONLY - 2 REQ.)' : 'UPLOAD SITE PHOTOS (2 REQ.)'}
          </label>

          {hasEvidenceRights ? (
            userRole === 'ENGINEER' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCamera(true)}
                  style={{ width: '100%', height: '3.5rem', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.75rem' }}
                >
                  <Camera size={20} /> LAUNCH LIVE CAMERA
                </button>
                
                {showCamera && (
                  <LiveCameraModal 
                    onClose={() => setShowCamera(false)}
                    onCapture={(img) => {
                      const nextPhotos = [...statusUpdate.photos, img].slice(0, 4);
                      setStatusUpdate({ ...statusUpdate, photos: nextPhotos });
                      setShowCamera(false);
                    }}
                  />
                )}
              </div>
            ) : (
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                required
                onChange={(e) => {
                  const fileList = Array.from(e.target.files);
                  const currentPhotos = statusUpdate.photos || [];
                  const nextPhotos = [...currentPhotos, ...fileList].slice(0, 4);
                  setStatusUpdate({ ...statusUpdate, photos: nextPhotos });
                }}
              />
            )
          ) : (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Camera size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>Existing photographs from the latest field update will be used.</p>
            </div>
          )}
          {statusUpdate.photos.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                {statusUpdate.photos.length} site evidence photos captured:
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {statusUpdate.photos.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    <img 
                      src={typeof img === 'string' && img.startsWith('data:') ? img : (typeof img === 'string' ? img : URL.createObjectURL(img))} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const next = statusUpdate.photos.filter((_, i) => i !== idx);
                        setStatusUpdate({ ...statusUpdate, photos: next });
                      }}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="input-group">
          <label>Final Remarks</label>
          <textarea value={statusUpdate.remarks} onChange={e => setStatusUpdate({ ...statusUpdate, remarks: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(5)}>Back</button>
          <button className="btn btn-primary" style={{ flex: 1, disabled: load }} onClick={handleFinalSubmit}>
            {load ? 'Saving Lifecycle...' : 'Finish & Submit Update'}
          </button>
        </div>
      </div>
    );
  };

  const wizardRef = useRef(null);

  useEffect(() => {
    if (wizardRef.current) wizardRef.current.scrollTo(0, 0);
  }, [step]);

  if (submitted) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        className="fade-in"
      >
        <div
          className="glass-card"
          style={{ width: '100%', maxWidth: '480px', textAlign: 'center', padding: '3.5rem 2rem', position: 'relative', overflow: 'hidden' }}
        >
          <button
            onClick={onSuccess}
            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}
          >
            <X size={24} />
          </button>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--success)' }}></div>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem' }}>
            <CheckCircle2 size={56} color="var(--success)" />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Update Committed</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
            The project lifecycle state, pre-execution milestones, and field evidence have been successfully synchronized with the central authority database.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn btn-primary" style={{ width: '100%', height: '3.5rem' }} onClick={onSuccess}>
              Return to Dashboard
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transaction ID: DRISHTI-TXN-{Date.now().toString().slice(-6)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wizardRef}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}
    >
      <div
        className="glass-card fade-in-up"
        style={{ width: '100%', maxWidth: '500px', position: 'relative', padding: '2rem 1.25rem', marginBottom: '2rem', border: '1px solid var(--glass-border)', background: 'var(--secondary)' }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}
        >
          <X size={20} />
        </button>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {[1, 2, 3, 4, 5, 6].map(s => <div key={s} style={{ flex: 1, height: '4px', background: step >= s ? 'var(--primary)' : 'var(--glass-bg)', borderRadius: 2 }}></div>)}
        </div>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {project.type === 'EXECUTION' && (
          <>
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
            {step === 6 && renderStep6()}
          </>
        )}
        {project.type === 'CONSULTANCY' && step > 2 && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Project milestones are complete. Please return to Step 1 or 2 to finalize master changes.</p>
            <button className="btn btn-primary" onClick={() => setStep(1)}>Back to Step 1</button>
          </div>
        )}
      </div>
    </div>
  );
}


function InfoItem({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  );
}

function NewProject({ activeConfig }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', type: 'EXECUTION', brief: '', fundingAgency: CONFIG.DEFAULT_AGENCY, customFundingAgency: '', estimatedCost: '',
    inchargeName: '', inchargeMobile: '', creatorId: user?.id,
    consultantName: '', consultantMobile: '', contractorName: '', contractorMobile: '',
    actualStartDate: '', stipulatedCompletionDate: '',
    workStarted: '', delayReasons: [], delayBrief: '',
    consultancySource: 'NIT',
    fieldData: {}
  });
  const [load, setLoad] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.get('/config/latest').then(res => {
      setConfig(res.data);
      if (res.data && res.data.stages) {
        setWorkflows(res.data.stages.map(s => ({
          stageKey: s.stageKey,
          stepName: s.displayName,
          isCompleted: false,
          value: 'No',
          reason: '',
          date: ''
        })));
      }
    });
  }, []);

  const [pert, setPert] = useState([
    { name: '', weightage: '', startDate: '', endDate: '' }
  ]);

  const addPertRow = () => setPert([...pert, { name: '', weightage: '', startDate: '', endDate: '' }]);
  const removePertRow = (idx) => setPert(pert.filter((_, i) => i !== idx));

  const handleSave = async (final = false) => {
    // Focused Validation: Only check reasons for milestones you've actually touched/reached
    if (final && step >= 2) {
      // 1. Check for reasons for delay
      for (const w of workflows) {
        // Skip Technical Sanction validation for consultancy projects
        if (formData.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') continue;

        if (w.value === 'No') {
          if (!w.reason || w.reason.trim().length < 5) {
            window.alert(`Dhyan dein: "${getStepDisplayName(w.stepName)}" ke liye Reason for Delay mention karna anivarya hai.`);
            setLoad(false);
            return; // Stop immediately
          }
          break;
        }
      }

      // 2. Bi-directional Chronological Date Validation for "Yes" milestones
      for (let i = 0; i < workflows.length; i++) {
        const cur = workflows[i];
        // Skip consultancy technical sanction in chronological validation
        if (formData.type === 'CONSULTANCY' && cur.stepName === 'Technical Sanction') continue;

        if (cur.value === 'Yes' && cur.date) {
          // Backward
          for (let j = i - 1; j >= 0; j--) {
            const pr = workflows[j];
            if (formData.type === 'CONSULTANCY' && pr.stepName === 'Technical Sanction') continue;
            if (pr.value === 'Yes' && pr.date) {
              const dCur = normalizeDate(cur.date);
              const dPr = normalizeDate(pr.date);
              if (dCur && dPr && dCur < dPr) {
                window.alert(`Conflict: "${getStepDisplayName(cur.stepName)}" (${dCur}) cannot be before "${getStepDisplayName(pr.stepName)}" (${dPr}).`);
                return;
              }
              break;
            }
          }
          // Forward
          for (let k = i + 1; k < workflows.length; k++) {
            const nx = workflows[k];
            if (formData.type === 'CONSULTANCY' && nx.stepName === 'Technical Sanction') continue;
            if (nx.value === 'Yes' && nx.date) {
              const dCur = normalizeDate(cur.date);
              const dNx = normalizeDate(nx.date);
              if (dCur && dNx && dCur > dNx) {
                window.alert(`Conflict: "${getStepDisplayName(cur.stepName)}" (${dCur}) cannot be after "${getStepDisplayName(nx.stepName)}" (${dNx}).`);
                return;
              }
              break;
            }
          }
        }
      }
    }

    if (final && formData.type === 'EXECUTION' && step >= 3) {
      for (const p of pert) {
        if (!p.name || !p.weightage || !p.startDate || !p.endDate) {
          alert('Please carefully fill out Name, Weightage, Start Date, and Completion Date for every PERT activity before finalization.');
          return;
        }
      }
      const totalWeight = pert.reduce((sum, p) => sum + parseFloat(p.weightage || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        alert('PERT weightage must be 100% for finalization');
        return;
      }
    }

    try {
      setLoad(true);
      const payload = { ...formData };
      if (payload.fundingAgency === 'Any other') {
        payload.fundingAgency = payload.customFundingAgency;
      }
      delete payload.customFundingAgency;
      delete payload.creatorId;

      await api.post('/projects', {
        projectBaseData: {
          ...payload,
          fieldData: JSON.stringify(payload.fieldData)
        },
        workflows: step >= 2 ? workflows : [],
        pertActivities: (step >= 3 && formData.type === 'EXECUTION') ? pert : []
      });
      alert(`Project ${final ? 'Finalized' : 'Master Instance Created'} Successfully!`);
      navigate('/projects');
    } catch (err) {
      alert(err.message || 'Creation failed');
    } finally {
      setLoad(false);
    }
  };

  const renderStep1 = () => (
    <div className="fade-in">
      <h2 style={{ marginBottom: '1.5rem' }}>Project Master</h2>
      {renderDynamicFields(config, 'TOP', formData, setFormData)}
      <div className="input-group">
        <label>Work Type</label>
        <select value={formData.type} onChange={e => {
          const nextType = e.target.value;
          setFormData({ ...formData, type: nextType });
          // Dynamically update workflow milestones based on type and source
          if (nextType === 'CONSULTANCY') {
            const milestones = formData.consultancySource === 'SINGLE_SOURCE' ? [
              { stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
            ] : [
              { stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
            ];
            setWorkflows(milestones);
          } else {
            setWorkflows([
              { stepName: 'A&F Received', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Technical Sanction', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
              { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' }
            ]);
          }
        }}>
          <option value="EXECUTION">Execution Work</option>
          <option value="CONSULTANCY">Consultancy Work</option>
        </select>
      </div>

      <div className="input-group">
        <label>Project Name</label>
        <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
      </div>
      {renderDynamicFields(config, 'AFTER_NAME', formData, setFormData)}
      <div className="input-group">
        <label>Project Brief Description</label>
        <textarea
          value={formData.brief}
          onChange={e => setFormData({ ...formData, brief: e.target.value })}
          required
          style={{ minHeight: '60px', padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          placeholder="Enter a brief project description..."
        />
      </div>
      {renderDynamicFields(config, 'MASTER', formData, setFormData)}
      <div className="input-group">
        <label>Funding Agency</label>
        <select value={formData.fundingAgency} onChange={e => setFormData({ ...formData, fundingAgency: e.target.value })}>
          <option value="KDA">KDA</option>
          <option value="Any other">Any other</option>
        </select>
      </div>
      {formData.fundingAgency === 'Any other' && (
        <div className="input-group fade-in">
          <label>Name of Funding Agency</label>
          <input
            value={formData.customFundingAgency}
            onChange={e => setFormData({ ...formData, customFundingAgency: e.target.value })}
            placeholder="Enter funding agency name"
            required
          />
        </div>
      )}
      {renderDynamicFields(config, 'AFTER_FUNDING', formData, setFormData)}
      <div className="input-group">
        <label>Estimated Cost (₹ Lakhs)</label>
        <input type="number" step="0.01" value={formData.estimatedCost} onChange={e => setFormData({ ...formData, estimatedCost: e.target.value })} required />
      </div>
      {renderDynamicFields(config, 'FINANCIAL', formData, setFormData)}
      <div className="responsive-input-grid" style={{ gap: '1rem' }}>
        <div className="input-group">
          <label>Executive Engineer Name</label>
          <input value={formData.inchargeName} onChange={e => setFormData({ ...formData, inchargeName: sanitizeName(e.target.value) })} />
        </div>
        <div className="input-group">
          <label>Executive Engineer Mobile</label>
          <input maxLength="10" value={formData.inchargeMobile} onChange={e => setFormData({ ...formData, inchargeMobile: sanitizeMobile(e.target.value) })} />
        </div>
      </div>
      {renderDynamicFields(config, 'AFTER_EE', formData, setFormData)}
      {formData.type === 'EXECUTION' && (
        <div className="responsive-input-grid" style={{ gap: '1rem' }}>
          <div className="input-group">
            <label>Consultant Name</label>
            <input value={formData.consultantName} onChange={e => setFormData({ ...formData, consultantName: sanitizeName(e.target.value) })} />
          </div>
          <div className="input-group">
            <label>Consultant Mobile</label>
            <input maxLength="10" value={formData.consultantMobile} onChange={e => setFormData({ ...formData, consultantMobile: sanitizeMobile(e.target.value) })} />
          </div>
        </div>
      )}
      {renderDynamicFields(config, 'AFTER_CONSULTANT', formData, setFormData)}
      {renderDynamicFields(config, 'AFTER_CONTRACTOR', formData, setFormData)}
      {renderDynamicFields(config, 'AFTER_DATES', formData, setFormData)}
      {renderDynamicFields(config, 'BOTTOM', formData, setFormData)}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleSave(false)}>Save Progress & Exit</button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, background: 'var(--success)', opacity: (formData.name && formData.brief && formData.estimatedCost && (formData.fundingAgency !== 'Any other' || formData.customFundingAgency)) ? 1 : 0.5 }}
          onClick={() => {
            if (!formData.name || !formData.brief || !formData.estimatedCost) {
              alert('Mandatory Fields: Please enter Project Name, Project Brief Description, and Estimated Cost to proceed.');
              return;
            }
            if (formData.fundingAgency === 'Any other' && !formData.customFundingAgency) {
              alert('Please enter the name of the Funding Agency.');
              return;
            }
            setStep(2);
          }}
        >
          Next: Add Milestones
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="fade-in">
      <h2 style={{ marginBottom: '1rem' }}>Workflow Status</h2>

      {/* Dynamic Summary Card */}
      <div className="glass-card fade-in" style={{ marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{formData.name || 'Untitled Project'}</h4>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--primary)', color: 'white', fontWeight: 700 }}>{formData.type}</span>
              <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}>₹{formData.estimatedCost || '0'} Lakhs</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>
              {((workflows.filter(w => w.value === 'Yes').length / workflows.length) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projected Start</div>
          </div>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '1rem' }}>
          <div
            style={{
              height: '100%',
              width: `${(workflows.filter(w => w.value === 'Yes').length / workflows.length) * 100}%`,
              background: 'var(--primary)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Define initial pre-execution milestone states</p>
      {workflows.map((w, idx) => {
        // Remove technical sanction field for consultancy work
        if (formData.type === 'CONSULTANCY' && w.stepName === 'Technical Sanction') return null;

        const isDPR = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'].includes(w.stepName);
        const isWOLocked = formData.type === 'CONSULTANCY' && isDPR && workflows.find(item => item.stepName === 'Work Order Issued')?.value !== 'Yes';

        return (
          <React.Fragment key={idx}>
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', opacity: isWOLocked ? 0.5 : 1, pointerEvents: isWOLocked ? 'none' : 'auto', cursor: isWOLocked ? 'not-allowed' : 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{getStepDisplayName(w.stepName)}</span>
                <YesNoToggle
                  value={w.value}
                  onChange={val => {
                    const dprSteps = ['Draft DPR Submitted', 'Draft DPR Approved', 'Final DPR Submitted', 'Final DPR Approved'];
                    if (formData.type === 'CONSULTANCY' && dprSteps.includes(w.stepName)) {
                      const wo = workflows.find(item => item.stepName === 'Work Order Issued');
                      if (!wo || wo.value !== 'Yes') {
                        alert("You cannot proceed until the Work Start Date (As per Work Order) is recorded.");
                        return;
                      }
                    }
                    const newW = [...workflows];
                    newW[idx].value = val;
                    newW[idx].isCompleted = val === 'Yes';
                    if (val === 'No') {
                      for (let j = idx + 1; j < newW.length; j++) {
                        newW[j].value = 'No';
                        newW[j].isCompleted = false;
                        newW[j].date = '';
                      }
                    }
                    setWorkflows(newW);
                  }}
                />
              </div>
              {w.value === 'Yes' ? (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {w.stepName !== 'Work Order Issued' && (
                    <>
                      <label>Date of Achievement</label>
                      <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(w.date)}
                        onChange={e => {
                          const val = e.target.value;
                          const newW = [...workflows];
                          newW[idx].date = val;
                          setWorkflows(newW);

                          // Only validate once the date is complete (YYYY-MM-DD)
                          if (val && val.length === 10) {
                            // Bi-directional Immediate Validation for NewProject
                            for (let m = 0; m < newW.length; m++) {
                              const cur = newW[m];
                              if (cur.value === 'Yes' && cur.date) {
                                // Back
                                for (let b = m - 1; b >= 0; b--) {
                                  const pr = newW[b];
                                  if (pr.value === 'Yes' && pr.date) {
                                    if (new Date(cur.date).getTime() < new Date(pr.date).getTime()) {
                                      alert(`Order Mismatch: "${getStepDisplayName(cur.stepName)}" before "${getStepDisplayName(pr.stepName)}".`);
                                      return;
                                    }
                                    break;
                                  }
                                }
                                // Forward
                                for (let f = m + 1; f < newW.length; f++) {
                                  const nx = newW[f];
                                  if (nx.value === 'Yes' && nx.date) {
                                    if (new Date(cur.date).getTime() > new Date(nx.date).getTime()) {
                                      alert(`Order Mismatch: "${getStepDisplayName(cur.stepName)}" after "${getStepDisplayName(nx.stepName)}".`);
                                      return;
                                    }
                                    break;
                                  }
                                }
                              }
                            }
                          }
                        }}
                      />
                    </>
                  )}

                  {w.stepName === 'Work Order Issued' && (
                    <>
                      <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Work Start Date (As per Work Order)</label>
                          <input
                            type="date"
                            min="1900-01-01"
                            max="2099-12-31"
                            value={formatDateForInput(formData.actualStartDate)}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, actualStartDate: val });
                              // Sync milestone date for validation
                              const newW = [...workflows];
                              newW[idx].date = val;
                              setWorkflows(newW);
                            }}
                          />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Stipulated Completion Date</label>
                          <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(formData.stipulatedCompletionDate)} onChange={e => setFormData({ ...formData, stipulatedCompletionDate: e.target.value })} />
                        </div>
                      </div>

                      {formData.type === 'EXECUTION' && (
                        <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Name of Contractor</label>
                            <input value={formData.contractorName} onChange={e => setFormData({ ...formData, contractorName: sanitizeName(e.target.value) })} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Contractor Mobile</label>
                            <input maxLength="10" value={formData.contractorMobile} onChange={e => setFormData({ ...formData, contractorMobile: sanitizeMobile(e.target.value) })} />
                          </div>
                        </div>
                      )}

                      {formData.type === 'CONSULTANCY' && (
                        <div className="responsive-input-grid" style={{ gap: '1rem', marginTop: '1rem' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Name of Consultant</label>
                            <input value={formData.consultantName} onChange={e => setFormData({ ...formData, consultantName: sanitizeName(e.target.value) })} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Consultant Mobile</label>
                            <input maxLength="10" value={formData.consultantMobile} onChange={e => setFormData({ ...formData, consultantMobile: sanitizeMobile(e.target.value) })} />
                          </div>
                        </div>
                      )}

                      <YesNoToggle
                        label="Work Started"
                        value={formData.workStarted || ''}
                        onChange={val => setFormData({ ...formData, workStarted: val })}
                      />

                      {formData.workStarted === 'No' && (
                        <div style={{ marginTop: '1rem', background: 'rgba(255,0,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Reason for Delay</label>
                          <div className="responsive-input-grid" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                            {[
                              'Land Acquisition', 'Utility Shifting', 'Encroachment',
                              'NOC (Forest/Pollution/Any Other)', 'Court Case/Stay', 'Any Other'
                            ].map(reason => (
                              <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <input
                                  type="checkbox"
                                  checked={(formData.delayReasons || []).includes(reason)}
                                  onChange={e => {
                                    const current = formData.delayReasons || [];
                                    if (e.target.checked) {
                                      setFormData({ ...formData, delayReasons: [...current, reason] });
                                    } else {
                                      setFormData({ ...formData, delayReasons: current.filter(r => r !== reason) });
                                    }
                                  }}
                                />
                                {reason}
                              </label>
                            ))}
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Brief Reason for Delay</label>
                            <textarea
                              placeholder="Enter brief reason for delay..."
                              value={formData.delayBrief || ''}
                              onChange={e => setFormData({ ...formData, delayBrief: e.target.value })}
                              style={{ minHeight: '60px', padding: '0.5rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label>Reason for Delay (Mandatory)</label>
                  <textarea
                    placeholder="Enter delay justification..."
                    value={w.reason}
                    onChange={e => {
                      const newW = [...workflows];
                      newW[idx].reason = e.target.value;
                      setWorkflows(newW);
                    }}
                    style={{ minHeight: '60px', padding: '0.5rem' }}
                  />
                </div>
              )}
            </div>

            {/* Consultancy Selection Source Toggle - INJECTED AFTER A&F */}
            {formData.type === 'CONSULTANCY' && w.stepName === 'A&F Received' && (
              <div className="glass-card fade-in" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', display: 'block' }}>Consultancy Selection Source</label>
                <select
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  value={formData.consultancySource}
                  onChange={e => {
                    const source = e.target.value;
                    setFormData({ ...formData, consultancySource: source });

                    // Dynamically rebuild the rest of the milestones starting from index 1 (after A&F)
                    const base = [workflows[0]]; // Keep A&F
                    let tail = [];
                    if (source === 'SINGLE_SOURCE') {
                      tail = [
                        { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
                      ];
                    } else {
                      tail = [
                        { stepName: 'NIT Published', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Tender Opened', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Work Order Issued', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Draft DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Submitted', isCompleted: false, value: 'No', reason: '', date: '' },
                        { stepName: 'Final DPR Approved', isCompleted: false, value: 'No', reason: '', date: '' }
                      ];
                    }
                    setWorkflows([...base, ...tail]);
                  }}
                >
                  <option value="NIT">NIT (Public Tender)</option>
                  <option value="SINGLE_SOURCE">Single Source / Direct Nomination</option>
                </select>
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
        {workflows.every(w => w.value === 'Yes') && formData.type === 'EXECUTION' && formData.workStarted === 'Yes' ? (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--success)', color: 'white' }} onClick={() => {
            if (!formData.actualStartDate || !formData.stipulatedCompletionDate) {
              alert('Please provide the Work Start Date (As per Work Order) and Stipulated Completion Date.');
              return;
            }
            if (new Date(formData.actualStartDate) > new Date(formData.stipulatedCompletionDate)) {
              alert('Critical Error: Work Start Date (As per Work Order) cannot be later than the Stipulated Completion Date.');
              return;
            }
            setStep(3);
          }}>Next: Define PERT Schedule</button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--primary)' }} onClick={() => {
            if (workflows.find(w => w.stepName === 'Work Order Issued')?.value === 'Yes') {
              if (!formData.actualStartDate || !formData.stipulatedCompletionDate) {
                alert('Please provide the Work Start Date (As per Work Order) and Stipulated Completion Date.');
                return;
              }
              if (new Date(formData.actualStartDate) > new Date(formData.stipulatedCompletionDate)) {
                alert('Critical Error: Work Start Date (As per Work Order) cannot be later than the Stipulated Completion Date.');
                return;
              }
              if (!formData.workStarted) {
                alert('Please specify if work has started.');
                return;
              }
              if (formData.workStarted === 'No') {
                if (!formData.delayReasons || formData.delayReasons.length === 0) {
                  alert('Please select at least one reason for delay.');
                  return;
                }
                if (!formData.delayBrief || formData.delayBrief.trim() === '') {
                  alert('Please provide a brief reason for delay.');
                  return;
                }
              }
            }
            handleSave(true);
          }}>
            Finalize {formData.type === 'EXECUTION' ? 'Pre-Execution' : ''} Registration
          </button>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const totalW = pert.reduce((s, p) => s + (parseFloat(p.weightage) || 0), 0);
    const isValid = Math.abs(totalW - 100) < 0.01;

    return (
      <div className="fade-in">
        <h2 style={{ marginBottom: '1.5rem' }}>Step 3: Define PERT Activities</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Create your project schedule by adding activities and their specific timelines.</p>

        <div className="glass-card" style={{ marginBottom: '1.5rem', background: isValid ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)', border: isValid ? '1px solid var(--success)' : '1px solid var(--warning)' }}>
          <p style={{ fontWeight: 600, color: isValid ? 'var(--success)' : 'var(--warning)', textAlign: 'center', margin: '0.5rem' }}>
            Total Weightage: {totalW}% {isValid ? ' (Ready for Finalization)' : ' (Must be exactly 100%)'}
          </p>
        </div>

        {pert.map((p, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', position: 'relative', background: 'var(--bg-deep)' }}>
            {pert.length > 1 && (
              <button
                onClick={() => removePertRow(idx)}
                title="Remove Row"
                style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,100,100,0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer', borderRadius: '4px', padding: '0.25rem 0.5rem' }}
              >
                Remove Item
              </button>
            )}

            <div className="input-group">
              <label>Activity Name (Project Specific)</label>
              <input value={p.name} onChange={e => {
                const n = [...pert];
                n[idx].name = e.target.value;
                setPert(n);
              }} placeholder="Describe the activity..." />
            </div>

            <div className="responsive-grid-auto" style={{ gap: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Weightage (%)</label>
                <input type="number" value={p.weightage} onChange={e => {
                  const n = [...pert];
                  n[idx].weightage = e.target.value;
                  setPert(n);
                }} placeholder="e.g. 25" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> Work Start Date (As per Work Order)
                </label>
                <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(p.startDate)} onChange={e => {
                  const n = [...pert];
                  n[idx].startDate = e.target.value;
                  setPert(n);
                }} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} color="var(--primary)" /> Date of Completion
                </label>
                <input type="date" min="1900-01-01" max="2099-12-31" value={formatDateForInput(p.endDate)} onChange={e => {
                  const n = [...pert];
                  n[idx].endDate = e.target.value;
                  setPert(n);
                }} />
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn"
          style={{ width: '100%', marginBottom: '2rem', border: '1px dashed rgba(255,255,255,0.2)', background: 'none', color: 'var(--text-muted)' }}
          onClick={addPertRow}
        >
          + Add New Activity Row
        </button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: isValid ? 'var(--success)' : 'var(--btn-ghost-bg)', color: isValid ? 'white' : 'var(--text-muted)', opacity: isValid ? 1 : 0.7 }}
            onClick={() => {
              if (!isValid) return alert(`Total weightage is ${totalW}%. It must be exactly 100%.`);

              for (const p of pert) {
                if (new Date(p.startDate) > new Date(p.endDate)) {
                  alert(`Error in Activity "${p.name}": Start Date cannot be later than Completion Date.`);
                  return;
                }
              }

              handleSave(true);
            }}
          >
            Finalize and Create Project Schedule
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {[1, 2, 3].map(s => <div key={s} style={{ flex: 1, height: '4px', borderRadius: 2, background: step >= s ? 'var(--primary)' : 'var(--glass-bg)' }}></div>)}
        </div>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}

function DEODashboard() { return <ProjectList />; }
function EngineerDashboard() { return <ProjectList />; }

function UserManagement() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();

    } catch (err) {
      alert("Failed to delete user");
    }
  };

  return (
    <div style={{ padding: '1rem' }} className="fade-in">
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>User Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage Field Engineers, DEOs, and Viewers</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setShowModal(true); }}>
          <Plus size={18} /> Add New User
        </button>
      </header>

      {loading ? <p>Loading users...</p> : (
        <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Name</th>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>Designation</th>
                <th style={{ padding: '1rem' }}>Mobile (ID)</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="Name" style={{ padding: '1rem' }}>{u.name}</td>
                  <td data-label="Role" style={{ padding: '1rem' }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}>{u.role}</span>
                  </td>
                  <td data-label="Designation" style={{ padding: '1rem' }}>{u.designation || '-'}</td>
                  <td data-label="Mobile (ID)" style={{ padding: '1rem' }}>{u.mobile}</td>
                  <td data-label="Actions" style={{ padding: '1rem' }}>
                    <div className="mobile-btn-group" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.4rem', background: 'var(--glass-bg)' }} onClick={() => { setEditingUser(u); setShowModal(true); }}>
                        <Settings size={14} />
                      </button>
                      <button className="btn" style={{ padding: '0.4rem', background: 'var(--error-soft-bg)', color: 'var(--error-strong-text)' }} onClick={() => handleDelete(u.id)}>
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserModal
          user={editingUser}
          adminId={user.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchUsers(); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, adminId, onClose, onSuccess }) {
  const [formData, setFormData] = useState(user || {
    name: '', mobile: '', password: '', role: 'ENGINEER', designation: ''
  });


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (user) {
        await api.put(`/users/${user.id}`, formData, { headers: { adminId } });
      } else {
        await api.post('/users', formData, { headers: { adminId } });
      }

      onSuccess();
    } catch (err) {
      alert(err.message || "Failed to save user");
    }
  };

  return (
    <div className="modal-overlay" style={{ 
      position: 'fixed', inset: 0, 
      background: 'rgba(0,0,0,0.6)', 
      backdropFilter: 'blur(8px)', zIndex: 2000, 
      padding: '2rem 1rem', overflowY: 'auto', 
      display: 'flex', flexDirection: 'column' 
    }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2rem', margin: 'auto', position: 'relative', background: 'var(--secondary)' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-bg)'; }} onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
          <X size={20} />
        </button>
        <h3 style={{ margin: 0, paddingRight: '2rem', color: 'var(--text-primary)' }}>{user ? 'Edit User' : 'Add New User'}</h3>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div className="input-group">
            <label>Full Name</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: sanitizeName(e.target.value) })} required />
          </div>
          <div className="input-group">
            <label>Mobile Number (User ID)</label>
            <input maxLength="10" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: sanitizeMobile(e.target.value) })} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
          </div>
          <div className="input-group">
            <label>Role</label>
            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
              <option value="ENGINEER">Engineer</option>
              <option value="DEO">Data Entry Operator</option>
              <option value="VIEWER">Viewer (Authority)</option>
              <option value="ADMIN">Admin</option>
            </select>

          </div>
          {(formData.role === 'ENGINEER' || formData.role === 'VIEWER') && (
            <div className="input-group">
              <label>Designation</label>
              {formData.role === 'ENGINEER' ? (

                <select value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} required>
                  <option value="">Select Designation</option>
                  <option value="SE">SE</option>
                  <option value="Executive Engineer">Executive Engineer</option>
                  <option value="Assistant Engineer">Assistant Engineer</option>
                  <option value="Junior Engineer">Junior Engineer</option>
                </select>
              ) : (
                <input value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g. Director Engineering" required />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{user ? 'Update' : 'Create'} User</button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ViewerDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
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

  const { total, completed, ongoing, onTrack, delayed, onHold, pieData, barData, filteredProjects } = React.useMemo(() => {
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

    return { ...stats, pieData: pie, barData: bar, filteredProjects: filtered };
  }, [projects, filter, searchTerm]);

  if (error) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <AlertTriangle size={48} color="var(--error)" style={{ marginBottom: '1.5rem' }} />
      <h2 style={{ marginBottom: '1rem' }}>Connection Failed</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Re-establish Connection</button>
    </div>
  );

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
      <div className="pulse" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Initializing Control Center...</p>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '100%', margin: '0' }} className="fade-in">
      <header className="viewer-header">
        <div className="viewer-title-box">
          <h1 className="viewer-title">
            Authority Control Center
          </h1>
          <p className="viewer-subtitle">Executive Overview • {user.name}</p>
        </div>

        <div className="viewer-actions">
          <div className="search-input-wrapper">
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.6 }} size={18} />
            <input
              type="text"
              placeholder="Search by project or engineer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '3rem', margin: 0, height: '3.5rem', border: '1px solid var(--input-border)',
                background: 'var(--input-bg)', borderRadius: '1rem', fontSize: '1rem', width: '100%', color: 'var(--text-primary)'
              }}
            />
          </div>
          <div className="sync-info">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Last Sync: {new Date().toLocaleTimeString()}</div>
            <button className="btn" style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }} onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-card hover-card" onClick={() => setFilter('ALL')} style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1', cursor: 'pointer', transform: filter === 'ALL' ? 'scale(1.02)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Works</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0 0', color: 'var(--text-primary)' }}>{total}</h2>
            </div>
            <LayoutDashboard size={32} color="#6366f1" opacity={0.8} />
          </div>
        </div>

        <div className="glass-card hover-card" onClick={() => setFilter('COMPLETED')} style={{ padding: '1.5rem', borderLeft: '4px solid #a855f7', cursor: 'pointer', transform: filter === 'COMPLETED' ? 'scale(1.02)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Completed</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0 0', color: '#a855f7' }}>{completed}</h2>
            </div>
            <CheckCircle2 size={32} color="#a855f7" opacity={0.8} />
          </div>
        </div>

        <div className="glass-card hover-card" onClick={() => setFilter('On Track')} style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', cursor: 'pointer', transform: filter === 'On Track' ? 'scale(1.02)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px' }}>On Track</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0 0', color: 'var(--text-primary)' }}>{onTrack}</h2>
            </div>
            <TrendingUp size={32} color="#10b981" opacity={0.8} />
          </div>
        </div>

        <div className="glass-card hover-card" onClick={() => setFilter('Delay')} style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444', cursor: 'pointer', transform: filter === 'Delay' ? 'scale(1.02)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Delayed</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0 0', color: '#ef4444' }}>{delayed}</h2>
            </div>
            <AlertCircle size={32} color="#ef4444" opacity={0.8} />
          </div>
        </div>

        <div className="glass-card hover-card" onClick={() => setFilter('On Hold')} style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', cursor: 'pointer', transform: filter === 'On Hold' ? 'scale(1.02)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px' }}>On Hold</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0 0', color: 'var(--text-primary)' }}>{onHold}</h2>
            </div>
            <Clock size={32} color="#f59e0b" opacity={0.8} />
          </div>
        </div>
      </div>

      <div className="responsive-grid-2-1" style={{ marginBottom: '3rem' }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}><PieChartIcon size={20} /> Project Health Distribution</h3>
          <div style={{ height: 300 }}>
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p>No data</p>}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}><BarChart3 size={20} /> Major Roadblocks (Delay Reasons)</h3>
          <div style={{ height: 300 }}>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} style={{ fill: 'var(--text-secondary)', fontSize: '0.75rem' }} width={120} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={`rgba(239, 68, 68, ${1 - index * 0.15})`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>No delays reported yet.</div>}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem' }}>
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
              {filteredProjects.map((p, i) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td data-label="#" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</td>
                  <td data-label="Project Name" style={{ fontWeight: 700 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.35rem' }}>{p.brief}</div>
                  </td>
                  <td data-label="Type" style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>{p.type}</td>
                  <td data-label="Status">
                    <span className={p.status === 'COMPLETED' ? 'badge badge-success' : 'badge'} style={{ background: p.status === 'COMPLETED' ? '' : 'rgba(59, 130, 246, 0.15)', color: p.status === 'COMPLETED' ? '' : '#60a5fa', border: p.status === 'COMPLETED' ? '' : '1px solid rgba(59, 130, 246, 0.2)' }}>
                      {p.status}
                    </span>
                  </td>
                  <td data-label="Overall Status">
                    {getProjectStage(p) !== 'COMPLETED' ? renderStatusBadge(p.overallStatus) : <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>-</span>}
                  </td>
                  <td data-label="Reason of Delay/Hold" style={{ fontSize: '0.85rem', maxWidth: '250px' }}>
                    {p.overallStatus === 'Delay' && p.statusDelayReasons && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                        {(() => {
                          try {
                            const r = typeof p.statusDelayReasons === 'string' ? JSON.parse(p.statusDelayReasons) : (p.statusDelayReasons || []);
                            const arr = Array.isArray(r) ? r : [r];
                            const filtered = arr.filter(Boolean);
                            return (
                              <>
                                {filtered.slice(0, 2).map((reason, i) => (
                                  <span key={i} style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{reason}</span>
                                ))}
                                {filtered.length > 2 && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>+more</span>}
                              </>
                            );
                          } catch(e) { 
                            return p.statusDelayReasons ? <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{p.statusDelayReasons}</span> : null; 
                          }
                        })()}
                      </div>
                    )}
                    <div style={{ color: p.overallStatus === 'Delay' ? '#ef4444' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.8rem', lineHeight: '1.2' }}>
                      {getProjectStage(p) !== 'COMPLETED' ? (p.overallStatus === 'On Hold' ? (p.statusHoldReason || 'Not specified') : (p.overallStatus === 'Delay' ? (p.statusDelayBrief || 'Not specified') : (p.workStarted === 'No' ? (p.delayBrief || 'Work not started') : '-'))) : '-'}
                    </div>
                  </td>
                  <td data-label="Today's Remark" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', fontWeight: 500 }}>
                    {p.todaysUpdateNote || '-'}
                  </td>
                  <td data-label="Final Remarks" style={{ fontSize: '0.85rem', color: 'var(--accent)', maxWidth: '220px', fontStyle: 'italic', fontWeight: 500 }}>
                    {p.updates && p.updates[0] && p.updates[0].remarks ? `"${p.updates[0].remarks}"` : '-'}
                  </td>
                  <td data-label="Progress">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="progress-bar" style={{ flex: 1, margin: 0, height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${p.currentProgress}%` }}></div>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '45px' }}>{p.currentProgress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <button
                      className="btn"
                      style={{
                        padding: '0.5rem 1rem', fontSize: '0.65rem',
                        background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)',
                        border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '0.75rem',
                        letterSpacing: '1px'
                      }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                    >
                      DETAILS
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan="10" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OfficialReportView({ projects, onClose }) {
  const isConsolidated = projects.length > 1;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  useEffect(() => {
    const handlePrintPrepare = () => {
      const el = document.getElementById("official-report-container");
      if (el) {
        const A4_HEIGHT = 1122; 
        const contentHeight = el.scrollHeight;
        const scale = Math.min(1, A4_HEIGHT / contentHeight);
        el.dataset.printScale = scale;
      }
    };
    handlePrintPrepare();
  }, [projects]);

  const renderDynamicReportFields = (project, locations = ['MASTER', 'AFTER_NAME', 'AFTER_BRIEF', 'AFTER_FUNDING', 'AFTER_COST', 'AFTER_EE', 'AFTER_CONSULTANT', 'AFTER_CONTRACTOR', 'AFTER_DATES', 'BOTTOM', 'UPDATE_PROGRESS', 'UPDATE_STATUS']) => {
    if (!project || !project.configVersion || !project.configVersion.fields) return null;
    try {
      const fieldData = typeof project.fieldData === 'string' ? JSON.parse(project.fieldData || '{}') : (project.fieldData || {});
      const fields = project.configVersion.fields.filter(f => f.isActive && locations.includes(f.location) && fieldData[f.fieldKey]);
      if (fields.length === 0) return null;

      return (
        <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
          <h4 style={sectionHeaderStyle}>ADDITIONAL PROJECT PARAMETERS</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
            <tbody>
              {Array.from({ length: Math.ceil(fields.length / 2) }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: '#f9fafb' }}>{fields[rowIndex * 2].displayName}</td>
                  <td style={{ ...reportTableTdStyle, width: '25%' }}>{fieldData[fields[rowIndex * 2].fieldKey]}</td>
                  {fields[rowIndex * 2 + 1] ? (
                    <>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: '#f9fafb' }}>{fields[rowIndex * 2 + 1].displayName}</td>
                      <td style={{ ...reportTableTdStyle, width: '25%' }}>{fieldData[fields[rowIndex * 2 + 1].fieldKey]}</td>
                    </>
                  ) : (
                    <><td style={reportTableTdStyle}></td><td style={reportTableTdStyle}></td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch (e) { return null; }
  };

  return (
    <div className="report-overlay" style={{
      position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 3000,
      overflowY: 'auto', padding: '1.5rem'
    }}>
      <div id="official-report-container" style={{ 
        width: '794px', minHeight: '1122px', background: '#ffffff', margin: '0 auto',
        padding: '40px 40px 60px 40px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', position: 'relative',
        borderRadius: '0', boxSizing: 'border-box'
      }}>
        {/* Actions - Hidden during print */}
        <div className="no-print" style={{
          position: 'fixed', top: '2rem', right: '3rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
          zIndex: 3100
        }}>
          <button className="btn" style={{ background: '#3b82f6', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', width: '150px' }} onClick={() => window.print()}>Print Report</button>
          
          <button className="btn" style={{ background: '#059669', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(5,150,105,0.3)', width: '150px' }} onClick={() => {
            const element = document.getElementById('official-report-container');
            const opt = {
              margin: [10, 10, 10, 10],
              filename: `KDA_Report_${new Date().toISOString().split('T')[0]}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false, 
                letterRendering: true,
                width: 794,
                scrollY: 0,
                scrollX: 0
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            
            // Temporary style adjustment for clean capture
            const originalBoxShadow = element.style.boxShadow;
            element.style.boxShadow = 'none';
            
            html2pdf().set(opt).from(element).save().then(() => {
              element.style.boxShadow = originalBoxShadow;
            });
          }}>Download PDF</button>

          <button className="btn" style={{ background: '#ef4444', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', width: '150px' }} onClick={onClose}>Exit View</button>
        </div>

        {/* Official Letterhead Header */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1rem' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="KDA Logo" style={{ height: '70px', width: 'auto' }} />
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ margin: 0, fontSize: '20pt', fontWeight: '800', textTransform: 'uppercase', color: '#000' }}>Kota Development Authority</h1>
              <p style={{ margin: 0, fontSize: '9pt', color: '#444' }}>Drishti - Project Monitoring & Evaluation System</p>
              <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '13pt', fontWeight: '700', color: '#000', textDecoration: 'underline' }}>Official Project Progress Report</h2>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Report ID: KDA/D/2026/2883</p>
            <p style={{ margin: 0, fontSize: '9pt' }}>Date: {today}</p>
          </div>
        </div>

        {/* Project Name Priority Bar */}
        <div style={{ 
          background: '#f3f4f6', padding: '0.75rem', border: '1px solid #d1d5db', 
          borderRadius: '4px', textAlign: 'center', marginBottom: '1.5rem' 
        }}>
          <h3 style={{ margin: 0, fontSize: '13pt', fontWeight: '800', color: '#111827', textTransform: 'uppercase' }}>
            PROJECT: {isConsolidated ? 'CONSOLIDATED ADMINISTRATIVE SUMMARY' : projects[0].name}
          </h3>
        </div>

        {isConsolidated && (
          <div className="report-section" style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '10pt', fontStyle: 'italic', color: '#444' }}>
              This document provides a consolidated progress assessment for {projects.length} selected projects under Kota Development Authority as of {today}.
            </p>
          </div>
        )}

        {isConsolidated && (
          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>I. EXECUTIVE SUMMARY TABLE</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
              <thead>
                <tr>
                  <th style={reportTableThStyle}>S.No</th>
                  <th style={reportTableThStyle}>Project Name</th>
                  <th style={reportTableThStyle}>Cost (Lakhs)</th>
                  <th style={reportTableThStyle}>Phys. Progress (%)</th>
                  <th style={reportTableThStyle}>Fin. Progress (%)</th>
                  <th style={reportTableThStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={reportTableTdStyle}>{idx + 1}</td>
                    <td style={reportTableTdStyle}>{p.name}</td>
                    <td style={reportTableTdStyle}>{p.estimatedCost}</td>
                    <td style={reportTableTdStyle}>{p.currentProgress}%</td>
                    <td style={reportTableTdStyle}>{p.financialProgress || '0'}%</td>
                    <td style={reportTableTdStyle}>{p.status === 'COMPLETED' ? 'COMPLETED' : (p.overallStatus || 'On Track')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {projects.map((p, idx) => (
          <div key={p.id} style={{ marginBottom: '2rem', pageBreakAfter: (idx < projects.length - 1) ? 'always' : 'auto' }}>
            <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid #eee', paddingBottom: '2.5rem' }}>
              {isConsolidated && (
                <h3 style={{ 
                  fontSize: '14pt', fontWeight: '900', background: '#334155', color: '#fff', 
                  padding: '0.5rem 1rem', marginBottom: '1.5rem', borderRadius: '4px' 
                }}>
                  {idx + 1}. {p.name}
                </h3>
              )}

            {/* 1. Basic Details */}
            <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
              <h4 style={sectionHeaderStyle}>1. BASIC PROJECT INFORMATION</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <tbody>
                  <tr>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Project ID</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>KDA-P-{p.id}</td>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Funding Agency</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.fundingAgency || 'KDA'}</td>
                  </tr>
                  <tr>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Project Type</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.type}</td>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Estimated Cost</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>INR {p.estimatedCost} Lakhs</td>
                  </tr>
                  <tr>
                    <td style={{ ...reportTableTdStyle, fontWeight: 'bold' }}>Location</td>
                    <td style={reportTableTdStyle} colSpan="3">{(() => {
                      const lat = p.gpsLat || (p.updates && p.updates[0]?.gpsLat);
                      const lon = p.gpsLong || (p.updates && p.updates[0]?.gpsLong);
                      return (lat !== null && lat !== undefined && lon !== null && lon !== undefined)
                        ? <ReverseGeocode lat={lat} lon={lon} />
                        : (p.type === 'EXECUTION' ? 'Rawatbhata Road, Kota, Ladpura Tehsil, Kota, Rajasthan, 324001, India' : 'Official Records, Kota')
                    })()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {renderDynamicReportFields(p)}

            {/* 2. Key Stakeholders */}
            <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
              <h4 style={sectionHeaderStyle}>2. KEY STAKEHOLDERS</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <tbody>
                  <tr>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Executive Engineer</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.inchargeName}</td>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Contact</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.inchargeMobile}</td>
                  </tr>
                  <tr>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Technical Consultant</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.consultantName || 'Internal'}</td>
                    <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Consultant Contact</td>
                    <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.consultantMobile || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. Milestones */}
            <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <h4 style={sectionHeaderStyle}>3. APPROVAL & MILESTONES</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={reportTableThStyle}>MILESTONE</th>
                    <th style={reportTableThStyle}>DATE</th>
                    <th style={reportTableThStyle}>REMARKS / DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sorted = [...(p.workflows || [])].sort((a, b) => a.id - b.id);
                    const list = [];
                    sorted.forEach(w => {
                      list.push({
                        label: w.stepName,
                        date: (w.stageKey === 'WORK_ORDER' || w.stepName === 'Work Order Issued') ? (w.value === 'Yes' ? 'Yes' : 'No') : (w.value === 'Yes' && w.date ? new Date(w.date).toLocaleDateString('en-GB') : 'PENDING'),
                        remarks: w.value === 'Yes' ? 'Completed' : (w.reason ? `Pending: ${w.reason}` : 'Pending')
                      });

                      if (w.stageKey === 'WORK_ORDER' || w.stepName === 'Work Order Issued') {
                        list.push({
                          label: 'Work Start Date (As per Work Order)',
                          date: p.actualStartDate ? new Date(p.actualStartDate).toLocaleDateString('en-GB') : 'PENDING',
                          remarks: 'Master Record'
                        });
                      }
                    });
                    list.push({
                      label: 'Stipulated Completion Date',
                      date: p.stipulatedCompletionDate ? new Date(p.stipulatedCompletionDate).toLocaleDateString('en-GB') : 'PENDING',
                      remarks: 'Contractual Deadline'
                    });
                    return list;
                  })().map((m, i) => (
                    <tr key={i}>
                      <td style={reportTableTdStyle}>{m.label}</td>
                      <td style={reportTableTdStyle}>{m.date}</td>
                      <td style={reportTableTdStyle}>{m.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Progress Status - Execution Only */}
            {p.type === 'EXECUTION' && (
              <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                <h4 style={sectionHeaderStyle}>4. PROGRESS STATUS</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Physical Progress</td>
                      <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.currentProgress}%</td>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Financial Progress</td>
                      <td style={{ ...reportTableTdStyle, width: '25%' }}>{p.financialProgress || '0'}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid' }}>
                <h4 style={sectionHeaderStyle}>5. OVERALL OBSERVATIONS</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold', background: (p.overallStatus === 'Delay' || p.overallStatus === 'On Hold') ? '#fef2f2' : 'transparent' }}>Current Status</td>
                      <td style={reportTableTdStyle}>{p.overallStatus || 'On Track'}</td>
                    </tr>
                    <tr>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Quality Sampling</td>
                      <td style={reportTableTdStyle}>
                        {(() => {
                          const fd = typeof p.fieldData === 'string' ? JSON.parse(p.fieldData || '{}') : (p.fieldData || {});
                          return fd.QUALITY_SAMPLING || p.qualitySampling || 'Not Recorded';
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...reportTableTdStyle, width: '25%', fontWeight: 'bold' }}>Time Extension</td>
                      <td style={reportTableTdStyle}>
                        {(() => {
                          const fd = typeof p.fieldData === 'string' ? JSON.parse(p.fieldData || '{}') : (p.fieldData || {});
                          return fd.TIME_EXTENSION || p.timeExtension || 'No';
                        })()}
                      </td>
                    </tr>
                    {(p.overallStatus === 'Delay' || p.overallStatus === 'On Hold' || p.workStarted === 'No') && (
                      <>
                        <tr>
                          <td style={{ ...reportTableTdStyle, fontWeight: 'bold', background: '#fef2f2' }}>Reason for Delay</td>
                          <td style={reportTableTdStyle}>
                            <div style={{ fontWeight: '600' }}>
                              {p.statusDelayBrief || p.statusHoldReason || p.delayBrief || 'Awaiting initiation.'}
                            </div>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

            {/* 6. Analytic Project Assessment */}
            <div className="report-section" style={{ marginBottom: '1.5rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <h4 style={sectionHeaderStyle}>6. ANALYTIC PROJECT ASSESSMENT</h4>
              <div style={{ 
                background: '#f9fafb',
                padding: '1.25rem', borderRadius: '4px', border: '1px solid #d1d5db',
                lineHeight: 1.6, fontSize: '10pt', color: '#111827', textAlign: 'justify'
              }}>
                <p style={{ margin: 0 }}>
                  <strong>Executive Summary:</strong> As of {today}, the project <strong>"{p.name}"</strong> is 
                  {p.overallStatus === 'Delay' ? (
                    <span> <strong> IN DELAY</strong>. {p.statusDelayBrief || p.delayBrief || "Specific delay reason not provided in system records."}</span>
                  ) : p.overallStatus === 'On Hold' ? (
                    <span> <strong> ON HOLD</strong>. {p.statusHoldReason || "Hold reason not recorded."}</span>
                  ) : p.currentProgress >= 100 ? (
                    <span> <strong> FULLY COMPLETED</strong>. Transitioned to maintenance phase.</span>
                  ) : (
                    <> 
                      <span> currently in the <strong>{getProjectStage(p)}</strong> stage and is progressing as per the schedule.</span>
                      {p.type === 'EXECUTION' && (
                        <span style={{ display: 'block', marginTop: '0.4rem' }}> Current physical completion: {p.currentProgress}%.</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* 7. Footer / Signatures */}
            <div className="signature-block" style={{ marginTop: '2.5rem', breakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', width: '220px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9.5pt' }}>{p.inchargeName}</p>
                  <p style={{ margin: 0, fontSize: '8.5pt' }}>{p.inchargeDesignation || 'Executive Engineer'}</p>
                  <p style={{ margin: 0, fontSize: '8pt', color: '#444' }}>Kota Development Authority</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '8.5pt', color: '#444' }}>Page generated by Drishti System</p>
                  <p style={{ margin: 0, fontSize: '8.5pt', color: '#444' }}>{today}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Print Styles moved to index.css */}
      </div>
    </div>
  );
}

const reportTableThStyle = { border: '1px solid #000', padding: '8px 10px', textAlign: 'left', fontWeight: '800', color: '#000', fontSize: '9pt', textTransform: 'uppercase', background: '#f3f4f6' };
const reportTableTdStyle = { border: '1px solid #000', padding: '8px 10px', textAlign: 'left', color: '#000', fontSize: '9.5pt', lineHeight: '1.4' };
const sectionHeaderStyle = { fontSize: '11pt', fontWeight: '900', borderBottom: '2px solid #000', paddingBottom: '0.4rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const dataGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '11pt' };
const dataItemStyle = { marginBottom: '0.5rem' };

function ReportTable({ projects, selectedIds, onToggleSelect }) {
  if (!projects || projects.length === 0) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem' }}>No projects found in this category.</p>;

  return (
    <div className="glass-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
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
              <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => onToggleSelect(p.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: '1.25rem 1rem', maxWidth: '350px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.brief || 'No description provided.'}</div>
              </td>
              <td style={{ padding: '1.25rem 1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.inchargeName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{p.inchargeDesignation}</div>
              </td>
              <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', maxWidth: '300px' }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {p.todaysUpdateNote || p.statusDelayBrief || p.statusHoldReason || (p.workStarted === 'No' ? p.delayBrief : 'Monitoring active.')}
                </div>
              </td>
              <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
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

function Reports() {
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

  const categorized = React.useMemo(() => {
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

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
      <div className="pulse" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Generating Compiled Reports...</p>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '1400px', margin: '0 auto' }} className="fade-in">
      {showOfficialReport && (
        <OfficialReportView projects={selectedProjects} onClose={() => setShowOfficialReport(false)} />
      )}

      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }} className="no-print">
        <div>
          <h1 className="viewer-title">Compiled Project Reports</h1>
          <p className="viewer-subtitle">Centralized textual overview categorized by type and status</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', width: '280px' }}
            />
          </div>
          <button
            className="btn"
            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', opacity: selectedIds.length > 0 ? 1 : 0.5 }}
            onClick={() => selectedIds.length > 0 && setShowOfficialReport(true)}
            disabled={selectedIds.length === 0}
          >
            <FileText size={18} /> Official Report ({selectedIds.length})
          </button>
        </div>
      </header>

      <div className="no-print">
        {['CONSULTANCY', 'EXECUTION'].map(type => (
          <div key={type} style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ width: '8px', height: '32px', background: 'var(--primary)', borderRadius: '4px' }}></div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{type} PROJECTS</h2>
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

function YesNoToggle({ value, onChange, label, style }) {
  return (
    <div style={{ ...style }}>
      {label && <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <div style={{ display: 'inline-flex', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '0.8rem', border: '1px solid var(--glass-border)' }}>
        <button
          type="button"
          onClick={() => onChange('Yes')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
            background: value === 'Yes' ? 'var(--success)' : 'transparent',
            color: value === 'Yes' ? 'white' : 'var(--text-secondary)',
            fontWeight: 800, transition: 'all 0.2s', fontSize: '0.85rem'
          }}
        >
          YES
        </button>
        <button
          type="button"
          onClick={() => onChange('No')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
            background: value === 'No' ? 'var(--error)' : 'transparent',
            color: value === 'No' ? 'white' : 'var(--text-secondary)',
            fontWeight: 800, transition: 'all 0.2s', fontSize: '0.85rem'
          }}
        >
          NO
        </button>
      </div>
    </div>
  );
}

function StatusToggle({ value, onChange }) {
  const options = [
    { label: 'On Track', value: 'On Track', color: 'var(--success)' },
    { label: 'On Hold', value: 'On Hold', color: '#f59e0b' },
    { label: 'Delay', value: 'Delay', color: 'var(--error)' }
  ];

  return (
    <div className="input-group">
      <label>Overall Status</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: '0.8rem', border: '1px solid var(--glass-border)' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0.6rem 0.5rem', borderRadius: '0.6rem', border: 'none', cursor: 'pointer',
              background: value === opt.value ? opt.color : 'transparent',
              color: value === opt.value ? 'white' : 'var(--text-secondary)',
              fontWeight: 700, transition: 'all 0.2s', fontSize: '0.7rem',
              textTransform: 'uppercase'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
