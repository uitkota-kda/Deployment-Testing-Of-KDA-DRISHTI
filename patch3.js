const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("                         )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No photos provided.</span>}\\n                       </div>\\n", "");

fs.writeFileSync(file, code);
console.log('done');
