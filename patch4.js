const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\\n');
lines.splice(435, 2); // lines 436 and 437 are index 435 and 436
fs.writeFileSync(file, lines.join('\\n'));
console.log('done');
