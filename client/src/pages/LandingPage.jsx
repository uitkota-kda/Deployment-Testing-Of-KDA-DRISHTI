import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, X, Landmark, Clock, Camera, AlertTriangle, TrendingUp,
  Map as MapIcon, AlertCircle, Menu, Sun, Moon, Download
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { sanitizeMobile } from '../utils/validation';

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="hover-card" style={{
      padding: '3rem',
      borderRadius: '2rem',
      background: 'white',
      border: '2px solid #eef2f6',
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
            minHeight: window.innerWidth < 600 ? '300px' : '650px'
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

export default function LandingPage() {
  const { login, theme, toggleTheme } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const UserManualModal = () => (
    <div className="modal-overlay" onClick={() => setShowManual(false)}>
      <div className="glass-card modal-content fade-in" style={{ width: '100%', maxWidth: '1300px', padding: '0', borderRadius: '2rem' }} onClick={e => e.stopPropagation()}>
        <div className="responsive-modal-header" style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--accent-soft)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>KDA Drishti: Official Operations Manual</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Version 2.4 • System Mastery Guide</p>
            </div>
          </div>
          <button
            onClick={() => setShowManual(false)}
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <X size={24} />
          </button>
        </div>

        <div className="responsive-modal-body">
          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Landmark size={22} /> 1. Introduction & Vision
            </h3>
            <p style={{ lineHeight: '1.8', color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              KDA Drishti is the pinnacle of infrastructure monitoring for the Kanpur Development Authority. It is not just a database; it is an <b>Agentic System</b> that enforces accountability through strict logic. Our goal is to ensure that every project is completed with transparency, on time, and within budget by providing "One Version of the Truth" to all stakeholders.
            </p>
          </section>

          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>2. Access & Security Policies</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={18} /> Session Management</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Sessions are secured via JWT and expire after 24 hours of inactivity. Always log out manually using the sidebar icon when leaving your workstation.</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Landmark size={18} /> Credentials</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Your User ID is linked to your official role. Sharing credentials is a violation of the KDA IT Policy and may result in disciplinary action.</p>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>3. Phase 1: Project Registration (DEO)</h3>
            <div style={{ marginBottom: '2.5rem' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 800 }}>3.1 The Project Master & Validation</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                The Master entry requires extreme precision. You must map the correct **Executive Engineer** to ensure the project appears in their field updates list.
              </p>
              <div style={{ padding: '1rem 1.5rem', background: 'rgba(14, 165, 233, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}><b>Validation Note:</b> The system highlights missing mandatory fields in RED. You cannot skip "Register Master" to reach "Add Milestones" without 100% field compliance.</p>
              </div>
            </div>
            <div style={{ marginBottom: '2.5rem' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 800 }}>3.2 Milestone Dependency Logic</h4>
              <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '2' }}>
                <li><b>A&F Sanction</b> → The legal birth of the project.</li>
                <li><b>Technical Sanction (TS)</b> → Engineering approval.</li>
                <li><b>NIT Published</b> → Cannot be marked "Yes" before TS approval.</li>
                <li><b>Work Order</b> → Marks the transition to physical execution.</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>4. Phase 2: Progress Reporting (Engineer)</h3>
            <div style={{ background: 'var(--glass-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Camera size={20} /> Engineering Evidence Requirements</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                <div>
                  <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>GPS VERIFICATION</h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Capture GPS while physically present at the site center. The system logs the exact coordinates and timestamp.</p>
                </div>
                <div>
                  <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>SITE PHOTOGRAPHY</h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Upload clear, wide-angle shots showing physical progress. Close-ups of materials or documents are NOT accepted.</p>
                </div>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>5. Configuration & Oversight</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Official Reports (OPR)</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>The OPR is generated in A4 standard PDF format. It includes a full activity heatmap and historical delay reasons, optimized for board-level review meetings.</p>
              </div>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>The Dynamic Config Manager</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>Admins can add custom project fields (Financial, Master, EE) dynamically. These are stored in JSON and automatically appear in the project creation wizard.</p>
              </div>
            </div>
          </section>

          <section style={{
            marginBottom: '4rem',
            background: 'rgba(239, 68, 68, 0.08)',
            padding: window.innerWidth < 600 ? '1.5rem 1rem' : '2.5rem',
            borderRadius: '32px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <h3 style={{
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: window.innerWidth < 600 ? '1.25rem' : '1.5rem'
            }}>
              <AlertTriangle size={window.innerWidth < 600 ? 24 : 28} /> Critical Safeguards: "What to Avoid"
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 600 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: window.innerWidth < 600 ? '0rem' : '2rem'
            }}>
              <ul style={{
                paddingLeft: '1rem',
                color: 'var(--text-primary)',
                fontSize: window.innerWidth < 600 ? '0.85rem' : '0.95rem',
                lineHeight: '2',
                fontWeight: 500,
                listStyleType: 'none',
                margin: 0
              }}>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No Special Characters</b>: Avoid #, &, *, " in descriptions.</li>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No Document Screenshots</b>: SITE PHOTOS only.</li>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No Logical Skipping</b>: Don't bypass milestones.</li>
              </ul>
              <ul style={{
                paddingLeft: '1rem',
                color: 'var(--text-primary)',
                fontSize: window.innerWidth < 600 ? '0.85rem' : '0.95rem',
                lineHeight: '2',
                fontWeight: 500,
                listStyleType: 'none',
                margin: 0
              }}>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No Sharing Credentials</b>: Your ID is your signature.</li>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No Approximate Dates</b>: Use exact dates always.</li>
                <li style={{ marginBottom: '0.75rem' }}>❌ <b>No GPS Spooling</b>: Tampering is logged.</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>7. Troubleshooting FAQ</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
                <b style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>Q: Why is Step 3 (PERT) blocked?</b>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>A: PERT weightage must sum to exactly 100%. Check for minor decimal errors.</p>
              </div>
              <div style={{ padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
                <b style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>Q: "GPS Capture Failed" message?</b>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>A: Ensure your browser and operating system have location permissions enabled for this portal.</p>
              </div>
            </div>
          </section>

          <div style={{ textAlign: 'center', marginTop: '5rem', padding: '3rem', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary)' }}>KDA Drishti — Advanced Agentic Monitoring</p>
            <p style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Precision • Transparency • Accountability</p>
            <p style={{ marginTop: '2rem', fontSize: '0.75rem' }}>Developed for the Kanpur Development Authority IT Cell. All Rights Reserved 2026.</p>
          </div>
        </div>
      </div>
    </div>
  );

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
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        height: '100px',
        display: 'flex', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Drishti Logo" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
          </div>

          <div className="desktop-only" style={{ gap: '2rem', alignItems: 'center' }}>
            <a
              href="#"
              style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: 'color 0.2s' }}
              onClick={(e) => { e.preventDefault(); setShowManual(true); }}
            >
              User Manual
            </a>
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

        <div style={{
          position: 'fixed', top: '80px', left: 0, right: 0,
          background: 'var(--secondary)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          transform: isMenuOpen ? 'translateY(0)' : 'translateY(-120%)',
          opacity: isMenuOpen ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1050, padding: '2rem 3%',
          flexDirection: 'column', gap: '1rem',
          borderBottom: '1px solid var(--glass-border)'
        }} className="mobile-only">
          <a
            href="#"
            style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem', padding: '1rem 0', borderBottom: '1px solid var(--glass-border)' }}
            onClick={(e) => { e.preventDefault(); setIsMenuOpen(false); setShowManual(true); }}
          >
            User Manual
          </a>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', height: '3.75rem', fontSize: '1rem', width: '100%' }}
            onClick={() => { setIsMenuOpen(false); document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' }); }}
          >
            Login
          </button>
        </div>
      </nav>
      <div style={{ height: '80px' }}></div>

      <section style={{ padding: '2rem 0 4rem 0', background: 'var(--bg-deep)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '30px 2rem' }}>
          <div style={{ marginBottom: '3rem' }}>
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

          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 1100 ? '1fr 1fr' : '1fr', gap: '3rem' }}>
            <HeroSlider />

            <div id="login-section" className="login-column" style={{ display: 'flex' }}>
              <div className="glass-card fade-in" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)' }}>
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

      <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 0', background: '#f8fafc', position: 'relative' }}>
        <div style={{ maxWidth: '100%', margin: '0', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 8vw, 5rem)' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#1e293b' }}>Advanced Monitoring Capabilities</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '1rem' }}>Empowering the Authority with data-driven infrastructure management.</p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 1200 ? 'repeat(4, 1fr)' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
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

      <footer style={{ marginTop: 'auto', background: '#0f172a', color: 'white', padding: '4rem 0' }}>
        <div style={{ maxWidth: '100%', margin: '0', padding: '0 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
            <div>
              <img src="/logo.png" alt="Drishti Logo" style={{ height: '120px', width: 'auto', marginBottom: '1.5rem' }} />
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                The Official Project Monitoring System of Kota Development Authority (KDA), ensuring world-class infrastructure for the people of Kota.
              </p>
            </div>
            <div>
              <h4 style={{ marginBottom: '1.5rem' }}>Authority Portal</h4>
              <ul style={{ listStyle: 'none', padding: 0, color: '#94a3b8', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>
                  <a href="https://kda.rajasthan.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                    KDA.RAJASTHAN.GOV.IN
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 style={{ marginBottom: '1.5rem' }}>Admin Contact</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                IT Cell, Room No. 111, First Floor,<br />
                Old Building, KDA, Kota
              </p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
            <p>© 2026 Kota Development Authority. All Rights Reserved.</p>
            <p>Designed for Infrastructure Excellence</p>
          </div>
        </div>
      </footer>
      {showManual && <UserManualModal />}
    </div>
  );
}
