const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
const lines = fs.readFileSync(file, 'utf8').split(/\\r?\\n/);
for(let i = 430; i < 445; i++) {
  console.log(i + ': ' + lines[i]);
}
