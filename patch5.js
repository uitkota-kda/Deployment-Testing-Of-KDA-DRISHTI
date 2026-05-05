const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

// I will find the exact duplicate block and remove it.
const toRemove = "                         )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No photos provided.</span>}\\r\\n                       </div>\\r\\n";
const toRemove2 = "                         )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No photos provided.</span>}\\n                       </div>\\n";

if (code.includes(toRemove)) {
  code = code.replace(toRemove, "");
} else if (code.includes(toRemove2)) {
  code = code.replace(toRemove2, "");
} else {
  // Try regex
  code = code.replace(/[ \\t]*\)\) : <span style=\{\{ color: 'var\(--text-muted\)', fontSize: '0\.85rem' \}\}>No photos provided\.<\/span>\}\\r?\\n[ \\t]*<\/div>\\r?\\n/, "");
}

fs.writeFileSync(file, code);
console.log('done');
