const {loadEnvConfig}=require('@next/env');
loadEnvConfig(process.cwd(),false);
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missing=required.filter(name=>!process.env[name]);
if(missing.length){console.error('Production build env missing: '+missing.join(', ')+'. Keep your existing production .env.local; do not upload it inside the archive.');process.exit(1);}
let url;
try{url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);}catch{console.error('Production Supabase URL invalid.');process.exit(1);}
if(url.protocol!=='https:'||url.hostname!=='ktskwawkslaznkjjacni.supabase.co'){console.error('This cPanel package must target the live ERP, not testing. Check NEXT_PUBLIC_SUPABASE_URL.');process.exit(1);}
console.log('Live ERP build environment verified.');
