// Guards against hydration mismatch: inline <style>{`...`}</style> with quotes
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'../src/app/admin/reports/sales/page.tsx'),'utf8');
assert.ok(!/<style>\{`/.test(src),'sales page must not use <style>{`...`} children');
assert.ok(/dangerouslySetInnerHTML=\{\{ __html: SALES_PRINT_CSS \}\}/.test(src),'print css injected raw');
assert.ok(/\[role="navigation"\]/.test(src),'print css kept');
console.log('sales-report-print-style: 3/3 pass');
