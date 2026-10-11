// Run with Playwright installed: node tests/receipt-print-layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p), 'utf8');
const css = (p) => read(p).match(/<style>\{`([\s\S]*?)`\}<\/style>/)[1];
(async () => {
  const browser = await chromium.launch({headless:true, executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const offline of [false,true]) {
      const file = `src/components/pos/${offline ? 'offline-receipt-modal' : 'receipt-modal'}.tsx`;
      assert(read(file).includes('<ReceiptPrintPortal>'));
      const id = offline ? 'offline-receipt-print' : 'receipt-print-area';
      for (const count of [1,9,60]) {
        const page = await browser.newPage({viewport:{width:1280,height:600}});
        const rows = Array.from({length:count},(_,i)=>`<tr><td>Product ${i} extra long name</td><td>3</td><td>1,090</td><td>3,270</td></tr>`).join('');
        await page.setContent(`<style>
          body{margin:0} #dashboard{height:1400px;overflow:hidden;transform:translateY(40px)}
          [data-pos-receipt-root]{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
          #${id}{max-height:90vh;overflow:auto;font:12px monospace} td{padding:4px 0}
          ${read('src/app/globals.css')}
          ${css('src/components/pos/receipt-print-portal.tsx')}
          ${css(file)}
        </style><div id="dashboard">DASHBOARD SHOULD NOT PRINT</div>
        <div data-pos-receipt-root><div id="${id}"><div>SHOP HEADER</div>
        <table><tbody>${rows}</tbody></table><div class="receipt-totals offline-totals">Grand Total Rs 13,590</div>
        <div class="receipt-balances">Total Balance Rs -2,951</div><div class="receipt-footer offline-footer">Thank You</div>
        <button class="print:hidden">Print Slip</button></div></div>`);
        await page.emulateMedia({media:'print'});
        const result = await page.evaluate((id)=>{
          const receipt=document.getElementById(id), table=receipt.querySelector('table');
          const box=receipt.getBoundingClientRect();
          return {dashboard:getComputedStyle(document.getElementById('dashboard')).display,
            top:box.top, width:box.width, height:box.height, scroll:receipt.scrollHeight,
            cells:[...table.querySelectorAll('td:last-child')].every(e=>getComputedStyle(e).display==='table-cell'),
            fits:table.getBoundingClientRect().right<=box.right,
            button:getComputedStyle(receipt.querySelector('button')).display};
        },id);
        assert.equal(result.dashboard,'none'); assert.equal(result.top,0);
        assert(result.cells); assert(result.fits); assert(result.scroll<=Math.ceil(result.height));
        assert.equal(result.button,'none');
        await page.pdf({path:`/tmp/receipt-${offline?'offline':'online'}-${count}.pdf`,width:'80mm',height:'150mm',printBackground:true});
        console.log(`PASS ${offline?'offline':'online'}: ${count} items, totals visible, no dashboard gap/clipping`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
