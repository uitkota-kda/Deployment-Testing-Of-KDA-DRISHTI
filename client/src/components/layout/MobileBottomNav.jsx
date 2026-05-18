import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, History, Plus, User as UserIcon, LogOut, Settings, Sun, Moon 
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

export default function MobileBottomNav() {
  const { user, logout, theme, toggleTheme } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </NavLink>
      
      <NavLink to="/projects" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <FileText size={20} />
        <span>Projects</span>
      </NavLink>
      
      <NavLink to="/reports" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <History size={20} />
        <span>Reports</span>
      </NavLink>

      {(user.role === 'DEO' || user.role === 'ADMIN' || user.role === 'ENGINEER') && (
        <NavLink to="/projects/new" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Plus size={20} />
          <span>New</span>
        </NavLink>
      )}

      {user.role === 'ADMIN' && (
        <>
          <NavLink to="/users" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <UserIcon size={20} />
            <span>Users</span>
          </NavLink>
          <NavLink to="/config" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>Config</span>
          </NavLink>
        </>
      )}

      <button onClick={toggleTheme} className="mobile-nav-item theme-toggle">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

      <button onClick={handleLogout} className="mobile-nav-item logout-btn">
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </nav>
  );
}

