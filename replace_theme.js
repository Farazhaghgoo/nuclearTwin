const fs = require('fs');
const path = require('path');

const files = ['index.html', 'script.js'];
const dir = 'c:/Users/faraz/Desktop/hmi';

const map = {
  '#0f1114': '#f4f6f8',
  '#1a1d21': '#e2e6ea',
  '#22262b': '#d1d6dc',
  '#2a2f36': '#ced4da',
  '#3a4050': '#adb5bd',
  '#4a5260': '#6c757d',
  '#5a6573': '#495057',
  '#7a8590': '#343a40',
  '#e0e4e8': '#212529',

  '#20c060': '#159647',
  '#ff2020': '#e31a1a',
  '#ffd020': '#d97d06',
  '#ff8020': '#cd5c08',
  '#050608': '#d5dbe0',

  'rgba(255,255,255,.04)': 'rgba(0,0,0,.04)',
  'rgba(255,255,255,.06)': 'rgba(0,0,0,.06)',
  'rgba(255,255,255,.08)': 'rgba(0,0,0,.08)',
  'rgba(255,255,255,.1)': 'rgba(0,0,0,.1)',
  'rgba(255,255,255,.12)': 'rgba(0,0,0,.12)',
  'rgba(255,255,255,.15)': 'rgba(0,0,0,.15)',
  'rgba(255,255,255,.25)': 'rgba(0,0,0,.25)',
  'rgba(255,255,255,.3)': 'rgba(0,0,0,.3)',

  'rgba(255,32,32,.15)': 'rgba(227,26,26,.15)',
  'rgba(255,32,32,.55)': 'rgba(227,26,26,.45)',
  'rgba(255,32,32,0)': 'rgba(227,26,26,0)',
  'rgba(255,32,32,.12)': 'rgba(227,26,26,.12)',
  'rgba(32,192,96,.25)': 'rgba(21,150,71,.25)',
  'rgba(255,128,32,.3)': 'rgba(205,92,8,.3)',

  '#160404': '#fcdcdc',
  '#161300': '#fcecd5',
  '#160900': '#fce3d5',
  '#1a1000': '#fce7d2',
  '#1f0808': '#fce6e6',
  '#2a0a0a': '#fcdada',

  '255,255,255': '0,0,0'
};

files.forEach(file => {
  let filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  for (const [key, value] of Object.entries(map)) {
    content = content.split(key).join(value);
    if (key.startsWith('#')) {
      content = content.split(key.toUpperCase()).join(value);
    }
  }
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${file}`);
});



