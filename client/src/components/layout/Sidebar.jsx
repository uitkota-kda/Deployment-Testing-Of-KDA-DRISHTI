import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, History, Plus, User as UserIcon, Settings, 
  Sun, Moon, LogOut 
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import InstallPWABtn from '../common/InstallPWABtn';

export function SidebarLink({ icon, label, to }) {
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

export default function Sidebar() {
  const { logout, user, theme, toggleTheme } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="sidebar glass-card" style={{
      width: '280px', height: 'calc(100vh - 2rem)', 
      position: 'fixed', left: '1rem', top: '1rem',
      borderRadius: '2rem', display: 'flex', flexDirection: 'column',
      padding: '2rem 1rem', zIndex: 1000
    }}>
      <div className="sidebar-header" style={{ marginBottom: '2.5rem', padding: '0 0.5rem' }}>
        <img src="/logo.png" alt="Drishti Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
      </div>

      <nav className="sidebar-nav">
        <SidebarLink icon={<LayoutDashboard size={20} />} label="Dashboard" to="/dashboard" />
        <SidebarLink icon={<FileText size={20} />} label="Projects" to="/projects" />
        <SidebarLink icon={<History size={20} />} label="Reports" to="/reports" />
        {(user.role === 'DEO' || user.role === 'ADMIN' || user.role === 'ENGINEER') && <SidebarLink icon={<Plus size={20} />} label="New Project" to="/new-project" />}
        {(user.role === 'ADMIN') && <SidebarLink icon={<UserIcon size={20} />} label="User Management" to="/users" />}
        {(user.role === 'ADMIN') && <SidebarLink icon={<Settings size={20} />} label="System Config" to="/config" />}
      </nav>

      <div className="sidebar-user" style={{ padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '1.5rem', marginTop: 'auto', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ 
            width: '45px', height: '45px', 
            background: 'var(--sidebar-btn-bg)', 
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' 
          }}>
            <UserIcon size={22} color="var(--user-icon-color)" />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{user.role?.replace('_', ' ') || 'User'}</p>
          </div>
        </div>
        <InstallPWABtn />
        <button onClick={toggleTheme} className="btn" style={{ width: '100%', background: 'var(--sidebar-btn-bg)', color: 'var(--sidebar-btn-text)', border: '1px solid var(--glass-border)', fontSize: '0.7rem', marginBottom: '0.75rem', fontWeight: 700 }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
        </button>
        <button onClick={logout} className="btn" style={{ width: '100%', background: 'var(--sidebar-btn-bg)', color: 'var(--sidebar-btn-text)', border: '1px solid var(--glass-border)', fontSize: '0.7rem', fontWeight: 700 }}>
          <LogOut size={16} /> SIGN OUT
        </button>
      </div>
    </div>
  );
}
