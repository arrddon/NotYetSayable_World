import {readFile} from 'node:fs/promises';

// This module runs in Node only. Never copy credentials or source records into dist.
export async function archiveConfig({env=process.env,envFiles=[new URL('../.env.local',import.meta.url),new URL('../../system/.env.local',import.meta.url)]}={}){
 const values={...env};
 for(const file of envFiles){
  let text;try{text=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw new Error('ARCHIVE_ENV_UNREADABLE');}
  for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
   const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
   if(match&&!values[match[1]])values[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }
 }
 if(!values.SUPABASE_URL||!values.SUPABASE_SERVICE_ROLE_KEY)return null;
 let url;try{url=new URL(values.SUPABASE_URL);}catch{throw new Error('ARCHIVE_URL_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('ARCHIVE_URL_INVALID');
 return {url:url.origin,key:values.SUPABASE_SERVICE_ROLE_KEY};
}

export function archiveClient(config,{fetcher=fetch}={}){
 return async(name,args={})=>{
  if(!['archive_manifest','archive_get'].includes(name))throw new Error('ARCHIVE_RPC_NOT_ALLOWED');
  let response;
  try{response=await fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key,Authorization:'Bearer '+config.key},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});}
  catch{throw new Error('ARCHIVE_NETWORK_UNAVAILABLE');}
  // Do not log upstream bodies: they can contain private data or credential details.
  if(!response.ok)throw new Error('ARCHIVE_HTTP_'+response.status);
  try{return await response.json();}catch{throw new Error('ARCHIVE_RESPONSE_INVALID');}
 };
}
