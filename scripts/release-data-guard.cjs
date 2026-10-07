const fs=require('node:fs'),path=require('node:path');
function compare(before,after){
 if(before.project!==after.project)throw new Error('Different database projects; comparison refused.');
 if(!before.counts||!after.counts||!Object.keys(before.counts).length)throw new Error('Empty/invalid baseline.');
 const rows=Object.keys(before.counts).sort().map(table=>({table,before:before.counts[table],after:after.counts[table]??null,status:after.counts[table]===undefined?'MISSING':after.counts[table]<before.counts[table]?'DECREASE':after.counts[table]>before.counts[table]?'INCREASE':'SAME'}));
 for(const table of Object.keys(after.counts).filter(t=>!(t in before.counts)).sort())rows.push({table,before:null,after:after.counts[table],status:'NEW'});
 return {beforeAt:before.capturedAt,afterAt:after.capturedAt,project:after.project,passed:!rows.some(r=>['MISSING','DECREASE'].includes(r.status)),rows};
}
async function main(){
 const [command,file]=process.argv.slice(2);
 if(!['capture','compare'].includes(command)||!file)throw new Error('Usage: node scripts/release-data-guard.cjs capture|compare ../release-before.json');
 require('@next/env').loadEnvConfig(process.cwd(),false);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Existing .env.local needs Supabase URL and service role key. Do not paste keys into chat.');
 const project=new URL(url).hostname;
 const {createClient}=require('@supabase/supabase-js');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.rpc('release_data_counts');
 if(error)throw new Error('Database inventory failed. Check connection and release_data_counts migration.');
 if(!data?.counts||!Object.keys(data.counts).length)throw new Error('No table counts returned; release blocked.');
 const snapshot={...data,project};const target=path.resolve(file);
 if(command==='capture'){
  fs.writeFileSync(target,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(`SAVED ${Object.keys(data.counts).length} table counts: ${target}`);return;
 }
 const baseline=JSON.parse(fs.readFileSync(target,'utf8')),report=compare(baseline,snapshot);
 const reportPath=target.replace(/\.json$/,'')+'-comparison-'+Date.now()+'.json';
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.table(report.rows.filter(r=>r.status!=='SAME'));
 console.log(`${report.passed?'PASS':'STOP'}: ${report.rows.filter(r=>r.status==='SAME').length} unchanged tables; report ${reportPath}`);
 if(!report.passed)process.exitCode=1;
}
module.exports={compare};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
