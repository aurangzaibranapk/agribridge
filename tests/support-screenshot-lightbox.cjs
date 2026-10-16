const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const src = fs.readFileSync('src/components/ui/image-lightbox.tsx', 'utf8');
for (const t of ['Naye tab mein kholein', 'download', 'Escape', 'ZoomIn', 'createPortal']) assert.ok(src.includes(t), t);
const { nextZoom } = (() => { const m = { exports: {} }; const out = ts.transpileModule(src.replace(/^import .*$/gm, ''), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText; try { new Function('module','exports','require','React',out)(m, m.exports, () => ({}), {}); } catch {} return m.exports; })();
assert.equal(nextZoom(1, 1), 1.5); assert.equal(nextZoom(3, 1), 3); assert.equal(nextZoom(1, -1), 1); assert.equal(nextZoom(2, -1), 1.5);
for (const f of ['src/components/support/support-desk.tsx', 'src/components/layout/assistant-panel.tsx', 'src/app/admin/messages/messages-client.tsx']) {
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(s.includes('<LightboxImage'), f);
  assert.ok(!/target="_blank"[^>]*>\s*<img/.test(s), `${f} still opens image in new tab`);
}
console.log('PASS: support/chat screenshots open in lightbox (zoom, download, new-tab link)');
