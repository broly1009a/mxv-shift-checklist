const fs = require('fs');
const glob = (dir) => {
  let res = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + item.name;
    if (item.isDirectory()) res = res.concat(glob(full));
    else if (item.name.endsWith('.controller.ts')) res.push(full);
  }
  return res;
};
const controllers = glob('backend/src');
console.log('Total controllers:', controllers.length);
for (const c of controllers) {
  const content = fs.readFileSync(c, 'utf8');
  const classMatch = content.match(/@Controller\s*\(\s*([^)]+)\)\s*export\s+class\s+([A-Za-z0-9_]+)/);
  const prefix = classMatch ? classMatch[1] : '';
  const className = classMatch ? classMatch[2] : '';
  const routes = [...content.matchAll(/@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]?([^'"]*)['"]?\s*\)/g)].map(m => m[1] + ' ' + m[2]);
  console.log(`\n${c} -> [${className}] prefix: ${prefix}`);
  console.log('  Routes: ' + routes.slice(0, 8).join(', ') + (routes.length > 8 ? ` ... (+${routes.length - 8} more)` : ''));
}
