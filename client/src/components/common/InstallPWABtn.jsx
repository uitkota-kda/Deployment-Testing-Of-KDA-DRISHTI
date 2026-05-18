import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallPWABtn({ isMobileView }) {
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
    <button onClick={handleInstallClick} className="btn" style={{ width: '100%', background: 'var(--sidebar-btn-bg)', color: 'var(--sidebar-btn-text)', border: '1px solid var(--glass-border)', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: 700 }}>
      <Download size={16} /> INSTALL APP
    </button>
  );
}
