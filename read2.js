const fs = require('fs');
const file = 'c:/Users/Dell/Desktop/project/client/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

// Find the index of the first "No photos provided" and second "No photos provided"
let lines = code.split('\\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes("No photos provided")) {
    console.log("Found at line " + i + ": " + lines[i]);
  }
}
