const fs = require('fs');

const files = ['js/modules/command-palette.js', 'js/modules/pattern-lock.js'];

files.forEach(p => {
  let c = fs.readFileSync(p, 'utf8');
  // Replacing literal \` with `
  c = c.replace(/\\`/g, '`');
  fs.writeFileSync(p, c, 'utf8');
  console.log(`Fixed ${p}`);
});
