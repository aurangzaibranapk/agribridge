import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), stage=path.resolve(process.argv[2]);
const appManifest=JSON.parse(fs.readFileSync(path.join(stage,'.next/server/app-paths-manifest.json'),'utf8'));
const sourceRoutes=[];
function routes(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())routes(f);else if(/^(page|route)\.[jt]sx?$/.test(e.name))sourceRoutes.push('/'+path.relative(path.join(root,'src/app'),f).split(path.sep).join('/').replace(/\.[jt]sx?$/,''));}}
routes(path.join(root,'src/app'));
const required=['/admin/pos/page','/admin/load-bill/page','/admin/khata/page','/admin/crm/[id]/statement/page','/admin/purchases/supplier-bill/page','/admin/pos/shift/[shiftId]/slip/page'];
const missing=[...new Set([...sourceRoutes,...required])].filter(key=>!appManifest[key]||!fs.existsSync(path.join(stage,'.next/server',appManifest[key])));
if(missing.length)throw new Error('Incomplete app build: '+missing.join(', '));
const baselinePath=path.resolve(root,'../agribridge-last-release.json');
if(fs.existsSync(baselinePath)){
 const previous=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
 const approvedPath=path.join(root,'docs/APPROVED-ROUTE-REMOVALS.json');
 const approved=fs.existsSync(approvedPath)?JSON.parse(fs.readFileSync(approvedPath,'utf8')):[];
 const removed=previous.routes.filter(route=>!sourceRoutes.includes(route)&&!approved.includes(route));
 if(removed.length)throw new Error('Previously released pages missing: '+removed.join(', '));
}
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else{const content=fs.readFileSync(full);files.push({path:path.relative(stage,full).split(path.sep).join('/'),bytes:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')});}}}
walk(stage);
const manifest={version:1,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAt:new Date().toISOString(),buildId:fs.readFileSync(path.join(stage,'.next/BUILD_ID'),'utf8').trim(),routes:sourceRoutes.sort(),files:files.sort((a,b)=>a.path.localeCompare(b.path))};
fs.writeFileSync(path.join(stage,'.release/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
