const fs = require('fs');

let src = fs.readFileSync('src/scenario-engine.js', 'utf8');

// 1. += mutations
src = src.replace(/DAO\._s\.([A-Z_]+)\.v\s*\+=\s*([^;]+);/g, "DAO.inject('$1', $2);");

// 2. Math.max overrides (e.g., DAO._s.PUMP_A.v = Math.max(... DAO._s.PUMP_A.v - 250);)
// DAO._s.PUMP_A.v = Math.max(0, DAO._s.PUMP_A.v - 250);
src = src.replace(/DAO\._s\.([A-Z_]+)\.v\s*=\s*Math\.max\([^,]+,\s*DAO\._s\.\1\.v\s*-\s*([^)]+)\);/g, "DAO.override('$1', Math.max(0, DAO.snapshot().$1.v - $2));");

// Wait, let's just do a manual replace using a callback.
src = src.replace(/DAO\._s\.([A-Z_]+)\.v\s*=\s*([^;]+);/g, (match, key, expr) => {
  let newExpr = expr.replace(/DAO\._s\.([A-Z_]+)\.v/g, "DAO.snapshot().$1.v");
  return `DAO.override('${key}', ${newExpr});`;
});

// 3. Reads
src = src.replace(/DAO\._s\.([A-Z_]+)\.v/g, 'DAO.snapshot().$1.v');
src = src.replace(/DAO\._s\.([A-Z_]+)/g, 'DAO.snapshot().$1');

fs.writeFileSync('src/scenario-engine.js', src);
