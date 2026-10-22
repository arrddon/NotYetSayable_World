import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {validateArchive,safeDataPath,cameraRegion,CITIES} from '../dist/core.mjs';
import {archiveConfig,archiveClient} from './archive-source.mjs';

export const CONVERSION_VERSION=1;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const themeMap={Connection:'connection',Stability:'stability',Freedom:'freedom',Care:'care',Possibility:'possibility',Belonging:'belonging'};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(value);
const identity=item=>item.source+':'+item.row_id;
function fail(code){throw new Error('ARCHIVE_'+code);}

export function publicRecord(raw,item){
 if(!raw||typeof raw!=='object')fail('RECORD_INVALID');
 const row=raw.row||{},pin=raw.pin||row.map||{};
 const id=item.source==='current'?(row.row_id||row.unit_id):(row.unit_id||row.row_id);
 if(!validId(id)||row.row_id!==item.row_id)fail('IDENTITY_MISMATCH');
 if(!['complete','live_appended'].includes(row.status)||!Number.isFinite(Date.parse(raw.completed_at)))fail('RECORD_INCOMPLETE');
 const position=[pin.lng,pin.lat];
 if(!position.every(Number.isFinite)||Math.abs(position[0])>180||Math.abs(position[1])>85.051129)fail('COORDINATES_INVALID');
 const questions=raw.questions||{};
 const question=n=>{const value=questions['Q'+n]||(n===3?questions['Q3-1']:null);return value?.result||value;};
 const keywords=n=>{
  const result=question(n);
  if(!result||!Array.isArray(result.keywords)||!result.keywords.length)fail('KEYWORDS_MISSING');
  if((result.analysis_status&&result.analysis_status!=='complete')||result.processing_mode==='mock')fail('ANALYSIS_INCOMPLETE');
  const seen=new Set(),words=[];
  for(const value of result.keywords){
   if(typeof value!=='string')fail('KEYWORDS_INVALID');
   const en=value.normalize('NFKC').replace(/\s+/g,' ').trim();
   if(!en||en.length>240)fail('KEYWORDS_INVALID');
   const canonical=en.toLowerCase().replace(/[‘’]/g,"'");
   const id='kw-'+digest(canonical).slice(0,24);
   if(!seen.has(id)){seen.add(id);words.push({id,ko:'',en});}
  }
  return words;
 };
 // Q1 = Past Trace, Q2 = Present Conditions, Q3/Q3-1 = Future Imagination.
 // One unit's theme is its existing Q3 primary theme, never a confidence score.
 const theme=themeMap[question(3)?.classification?.primary_theme];
 if(!theme)fail('THEME_UNKNOWN');
 const city=cameraRegion({lng:position[0],lat:position[1],zoom:10}).city;
 const area=city?CITIES.find(c=>c.id===city).en+' area':'Future home';
 return {id,position,theme,city,area,past:keywords(1),present:keywords(2),future:keywords(3)};
}

function normalizeManifest(value){
 if(!Array.isArray(value))fail('MANIFEST_INVALID');
 const seen=new Set();
 const rows=value.map(item=>{
  if(!item||!['legacy','current'].includes(item.source)||!validId(item.row_id)||typeof item.completed_at!=='string'||!Number.isFinite(Date.parse(item.completed_at)))fail('MANIFEST_INVALID');
  const clean={source:item.source,row_id:item.row_id,completed_at:item.completed_at},key=identity(clean);
  if(seen.has(key))fail('MANIFEST_DUPLICATE');seen.add(key);return clean;
 });
 return rows.sort((a,b)=>identity(a).localeCompare(identity(b)));
}
async function readJSON(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return null;throw error;}}
async function currentArchive(dataDir){
 const manifest=await readJSON(resolve(dataDir,'manifest.json'));
 if(!manifest||!safeDataPath(manifest.file))return null;
 const archive=await readJSON(resolve(dataDir,manifest.file.slice(5)));
 try{validateArchive(archive);}catch{return null;}
 return archive.version===manifest.version&&archive.synthetic===false?{manifest,archive}:null;
}
async function atomicJSON(file,value){
 await mkdir(dirname(file),{recursive:true});
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temp,file);}
 finally{await unlink(temp).catch(()=>{});}
}

export async function syncArchive({rpc,dataDir=resolve(root,'dist/data'),cachePath=resolve(root,'.openai/local/archive-source-state.json'),now=()=>new Date().toISOString(),force=false}={}){
 const rows=normalizeManifest(await rpc('archive_manifest'));
 const sourceRevision=digest({conversionVersion:CONVERSION_VERSION,rows});
 const current=await currentArchive(dataDir);
 if(!force&&current?.manifest.sourceRevision===sourceRevision)return {changed:false,count:current.archive.records.length,fetched:0,version:current.archive.version};
 // Source stamps and public IDs only; raw records never reach the cache or disk.
 const cache=await readJSON(cachePath),previous=new Map(current?.archive.records.map(record=>[record.id,record])||[]);
 const stamps=!force&&cache?.conversionVersion===CONVERSION_VERSION?cache.entries||{}:{};
 const records=new Array(rows.length),entries={};let cursor=0,fetched=0;
 await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{
  while(cursor<rows.length){
   const index=cursor++,item=rows[index],key=identity(item),stamp=stamps[key];
   let record=stamp?.completedAt===item.completed_at?previous.get(stamp.publicId):null;
   if(!record){record=publicRecord(await rpc('archive_get',{p_source:item.source,p_row_id:item.row_id}),item);fetched++;}
   records[index]=record;entries[key]={completedAt:item.completed_at,publicId:record.id};
  }
 }));
 records.sort((a,b)=>a.id.localeCompare(b.id));
 const version='live-'+digest({conversionVersion:CONVERSION_VERSION,records}).slice(0,24);
 const updatedAt=current?.archive.version===version?current.archive.updatedAt:now();
 const archive={schemaVersion:1,version,updatedAt,synthetic:false,locationMeaning:'desired-future-home',records};
 validateArchive(archive);
 const file='data/archive.'+version+'.json',target=resolve(dataDir,file.slice(5));
 // Immutable version files precede the manifest. Failed conversion leaves the last
 // complete archive in place; never silently publish a subset of completed units.
 if(current?.archive.version!==version){
  const existing=await readJSON(target);
  if(existing){if(digest(existing.records)!==digest(records))fail('VERSION_COLLISION');}
  else await atomicJSON(target,archive);
 }
 await atomicJSON(resolve(dataDir,'manifest.json'),{schemaVersion:1,version,file,updatedAt,synthetic:false,recordCount:records.length,sourceRevision});
 await atomicJSON(cachePath,{conversionVersion:CONVERSION_VERSION,entries});
 return {changed:current?.archive.version!==version,count:records.length,fetched,version};
}

export async function startArchiveSync({intervalMs=60000,logger=console.log,configOptions={},onSync=()=>{},...options}={}){
 let rpc=options.rpc;
 if(!rpc){const config=await archiveConfig(configOptions);if(!config){logger('Archive sync: server credentials unavailable; serving the published snapshot.');return {stop(){},ready:Promise.resolve(null)};}rpc=archiveClient(config);}
 let busy=false;
 const run=async()=>{
  if(busy)return;busy=true;
  try{const result=await syncArchive({...options,rpc});await onSync(result);if(result.changed)logger(`Archive published: ${result.count} completed units (${result.fetched} source records read).`);return result;}
  catch(error){logger('Archive sync unavailable; keeping the last published snapshot. '+(/^[A-Z_0-9]+$/.test(error.message)?error.message:'ARCHIVE_PUBLISH_FAILED'));}
  finally{busy=false;}
 };
 const ready=run(),timer=setInterval(run,intervalMs);timer.unref();
 return {ready,stop:()=>clearInterval(timer)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.includes('--watch')){
   const watcher=await startArchiveSync();await watcher.ready;
   // Standalone watch must stay alive even when its interval is the only handle.
   const keepAlive=setInterval(()=>{},3600000);
   for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{watcher.stop();clearInterval(keepAlive);});
  }else{
   const config=await archiveConfig();if(!config)fail('CREDENTIALS_MISSING');
   const result=await syncArchive({rpc:archiveClient(config),force:process.argv.includes('--force')});
   console.log(`Archive ${result.changed?'published':'unchanged'}: ${result.count} completed units, ${result.fetched} source records read, ${result.version}.`);
  }
 }catch(error){console.error(/^[A-Z_0-9]+$/.test(error.message)?error.message:'ARCHIVE_PUBLISH_FAILED');process.exitCode=1;}
}
