import React, { useState, useEffect, useContext } from 'react';
import { Plus, Settings, PauseCircle, X, User as UserIcon } from 'lucide-react';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { validateMobile, sanitizeName, sanitizeMobile } from '../utils/validation';

function UserModal({ user, adminId, onClose, onSuccess }) {
  const [formData, setFormData] = useState(user || {
    name: '', mobile: '', password: '', role: 'ENGINEER', designation: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateMobile(formData.mobile, 'Mobile number')) return;
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
    <div className="modal-overlay">
      <div className="glass-card modal-content fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--secondary)', padding: '0' }}>
        <div className="responsive-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UserIcon size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>{user ? 'Edit User' : 'Add New User'}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="responsive-modal-body">
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
    </div>
  );
}

export default function UserManagement() {
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
      alert(err.message || "Failed to delete user");
    }
  };

  const handleActivate = async (id) => {
    try {
      await api.patch(`/users/${id}/activate`);
      fetchUsers();
    } catch (err) {
      alert(err.message || "Failed to activate user");
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this user?")) return;
    try {
      await api.patch(`/users/${id}/deactivate`);
      fetchUsers();
    } catch (err) {
      alert(err.message || "Failed to deactivate user");
    }
  };

  const getStatusLabel = (u) => {
    if (u.is_active) return 'Active';
    if (u.failed_attempt_count >= 4) return 'Locked';
    return 'Inactive';
  };

  const getStatusStyle = (u) => {
    if (u.is_active) return { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (u.failed_attempt_count >= 4) return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
    return { background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' };
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
                <th style={{ padding: '1rem' }}>Status</th>
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
                  <td data-label="Status" style={{ padding: '1rem' }}>
                    <span className="badge" style={getStatusStyle(u)}>{getStatusLabel(u)}</span>
                  </td>
                  <td data-label="Actions" style={{ padding: '1rem' }}>
                    <div className="mobile-btn-group" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.4rem', background: 'var(--glass-bg)' }} title="Edit User" onClick={() => { setEditingUser(u); setShowModal(true); }}>
                        <Settings size={14} />
                      </button>

                      {(!u.is_active || u.failed_attempt_count >= 4) ? (
                        <button
                          className="btn"
                          style={{ padding: '0.4rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}
                          onClick={() => handleActivate(u.id)}
                        >
                          Activate User
                        </button>
                      ) : (
                        <>
                          {u.id !== user.id && (
                            <button
                              className="btn"
                              style={{ padding: '0.4rem', background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }}
                              title="Deactivate User"
                              onClick={() => handleDeactivate(u.id)}
                            >
                              <PauseCircle size={14} />
                            </button>
                          )}
                          {u.id !== user.id && (
                            <button className="btn" style={{ padding: '0.4rem', background: 'var(--error-soft-bg)', color: 'var(--error-strong-text)' }} title="Delete User" onClick={() => handleDelete(u.id)}>
                              <X size={14} />
                            </button>
                          )}
                        </>
                      )}
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
