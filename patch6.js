const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /[ \t]*\)\) : <span style=\{\{ color: 'var\(--text-muted\)', fontSize: '0\.85rem' \}\}>No photos provided\.<\/span>\}\r?\n[ \t]*<\/div>\r?\n/g;

code = code.replace(regex, "");

fs.writeFileSync(file, code);
console.log('done');
