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
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`VERIFIED ${manifest.files.length} runtime files; ${manifest.routes.length} routes; commit ${manifest.commit}; build ${manifest.buildId}`);
