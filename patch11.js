const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<h2 style=\{\{ marginBottom: '0.5rem', textAlign: 'center', fontSize: '1.75rem' \}\}>KPMS Access<\/h2>[\\s\\S]*?<p style=\{\{ color: 'var\(--text-muted\)', textAlign: 'center', marginBottom: '2.5rem' \}\}>KDA Project Monitoring System<\/p>/,
  `<div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
           <div style={{ background: 'white', padding: '0.75rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
             <img src="/logo.png" alt="KDA Logo" style={{ height: '70px', width: 'auto' }} />
           </div>
           <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem' }}>KPMS Access</h2>
           <p style={{ color: 'var(--text-muted)' }}>Kota Development Authority</p>
        </div>`
);

code = code.replace(
  /<div style=\{\{ marginBottom: '2.5rem' \}\}>[\\s\\S]*?<h2 style=\{\{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient\\(to right, #6366f1, #a855f7\\)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' \}\}>KPMS Portal<\/h2>[\\s\\S]*?<p style=\{\{ fontSize: '0.75rem', color: 'var\\(--text-muted\\)' \}\}>Kota Development Authority<\/p>[\\s\\S]*?<\/div>/,
  `<div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ background: 'white', padding: '0.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <img src="/logo.png" alt="KDA Logo" style={{ height: '45px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '1px' }}>KPMS Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '0.2rem' }}>Kota Development Authority</p>
          </div>
        </div>`
);

fs.writeFileSync(file, code);
console.log('done');
