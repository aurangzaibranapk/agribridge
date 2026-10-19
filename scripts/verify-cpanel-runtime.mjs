import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2] ?? process.cwd());
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.release/manifest.json'),'utf8'));
const expected=new Set(manifest.files.map(f=>f.path));
const errors=[];
for(const file of manifest.files){
 const full=path.join(root,file.path);
 if(!fs.existsSync(full)){errors.push(`Missing: ${file.path}`);continue;}
 const content=fs.readFileSync(full);
 if(content.length!==file.bytes || crypto.createHash('sha256').update(content).digest('hex')!==file.sha256) errors.push(`Changed/incomplete: ${file.path}`);
}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);const rel=path.relative(root,full).split(path.sep).join('/');if(rel==='.next/cache'||rel==='.next/types'||rel==='.next/trace')continue;if(item.isDirectory())walk(full);else if(!expected.has(rel))errors.push(`Old/unexpected build file: ${rel}`);}}
if(fs.existsSync(path.join(root,'.next')))walk(path.join(root,'.next'));
// Maintenance safha: Node wali copy (public/system-update.html) aur Apache wali copy
// (ab-maintenance/index.html) bilkul ek jaisi honi chahiye, warna do alag safhe dikhenge.
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const appPage=path.join(root,'public/system-update.html'), apachePage=path.join(root,'ab-maintenance/index.html');
let maintenanceNote='';
if(expected.has('ab-maintenance/index.html')){
 if(!fs.existsSync(appPage)||!fs.existsSync(apachePage)) errors.push('Maintenance page copy missing (public/system-update.html or ab-maintenance/index.html)');
 else if(sha(appPage)!==sha(apachePage)) errors.push('Maintenance page copies differ: public/system-update.html != ab-maintenance/index.html');
 else maintenanceNote='; maintenance page copies identical';
 // Optional: AB_DOCROOT=/home/<user>/public_html node .release/verify.mjs -> live document-root copy bhi check.
 const docroot=process.env.AB_DOCROOT;
 if(docroot&&fs.existsSync(appPage)){
  const live=path.join(docroot,'ab-maintenance/index.html');
  if(!fs.existsSync(live)) console.warn(`WARNING: ${live} nahi mili - Node band hone par Apache wala safha nahi dikhega.`);
  else if(sha(live)!==sha(appPage)) console.warn(`WARNING: ${live} purani hai - is build ki ab-maintenance/index.html wahan copy karein.`);
  else maintenanceNote+='; document-root copy up to date';
 }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`VERIFIED ${manifest.files.length} runtime files; ${manifest.routes.length} routes; commit ${manifest.commit}; build ${manifest.buildId}${maintenanceNote}`);
