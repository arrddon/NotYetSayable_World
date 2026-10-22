import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {publicRecord,syncArchive} from '../scripts/publish-archive.mjs';
import {archiveConfig,archiveClient} from '../scripts/archive-source.mjs';
import {summarize,validateArchive} from '../dist/core.mjs';

// Invented fixtures only. None of these values comes from the participant archive.
const item=(row_id='example-a',source='current',completed_at='2026-10-22T10:00:00Z')=>({row_id,source,completed_at});
function raw(entry=item()){
 const result=(theme,keywords)=>({classification:{primary_theme:theme,confidence:.99,reason:'private'},keywords,raw_response:'PRIVATE ORIGINAL',translated_response:'PRIVATE TRANSLATION',trace:'PRIVATE TRACE'});
 return {row:{row_id:entry.row_id,unit_id:entry.source==='legacy'?'legacy-unit':entry.row_id,status:'complete',session_id:'PRIVATE SESSION'},pin:{lng:-.102,lat:51.512},questions:{Q1:{result:result('Connection',['shared table','Rest'])},Q2:{result:result('Stability',['rest','quiet'])},[entry.source==='legacy'?'Q3-1':'Q3']:{result:result('Belonging',['REST','garden']),image_path:'PRIVATE IMAGE'}},completed_at:entry.completed_at};
}
async function fixture(t){
 const dir=await mkdtemp(resolve(tmpdir(),'nys-public-archive-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const dataDir=resolve(dir,'data'),cachePath=resolve(dir,'cache.json');
 let rows=[item()],fail=false;const calls=[];
 const rpc=async(name,args)=>{calls.push({name,args});if(name==='archive_manifest')return rows;if(fail)throw new Error('ARCHIVE_NETWORK_UNAVAILABLE');return raw(rows.find(row=>row.row_id===args.p_row_id));};
 return {dataDir,cachePath,rpc,calls,rows:next=>{rows=next;},fail:()=>{fail=true;},publish:()=>syncArchive({rpc,dataDir,cachePath,now:()=> '2026-10-22T11:00:00Z'})};
}
test('current and legacy archives expose only allowed fields, preserving IDs and original future classification',()=>{
 const current=publicRecord(raw(),item());
 assert.equal(current.id,'example-a');assert.equal(current.theme,'belonging');assert.deepEqual(current.position,[-.102,51.512]);
 assert.equal(current.past[0].en,'shared table');assert.equal(current.future[0].ko,'');
 const legacy=item('legacy-row','legacy');assert.equal(publicRecord(raw(legacy),legacy).id,'legacy-unit');
 const archived=raw();archived.row.status='live_appended';assert.equal(publicRecord(archived,item()).id,'example-a');
 for(const secret of ['PRIVATE','raw_response','translated_response','image_path','trace','confidence','session_id'])assert.equal(JSON.stringify(current).includes(secret),false);
 assert.equal(summarize([current]).keywords.find(word=>word.en==='Rest').count,1);
});
test('incomplete or unsupported records are rejected without manufacturing keywords or coordinates',()=>{
 for(const mutate of [r=>{r.questions.Q3.result.keywords=[];},r=>{r.questions.Q3.result.classification.primary_theme='Unrecognised';},r=>{r.pin.lng='';},r=>{r.pin.lat=90;},r=>{r.row.row_id='different';},r=>{r.row.status='processing';},r=>{r.questions.Q3.result.processing_mode='mock';}]){
  const record=raw();mutate(record);assert.throws(()=>publicRecord(record,item()),/ARCHIVE_/);
 }
});
test('initial publication is complete; unchanged polls and warm starts do not fetch source bodies',async t=>{
 const f=await fixture(t),first=await f.publish();assert.equal(first.count,1);assert.equal(first.fetched,1);assert.equal(first.changed,true);
 const manifest=JSON.parse(await readFile(resolve(f.dataDir,'manifest.json'),'utf8'));
 const archive=JSON.parse(await readFile(resolve(f.dataDir,manifest.file.slice(5)),'utf8'));
 validateArchive(archive);assert.equal(archive.synthetic,false);assert.equal(manifest.recordCount,1);
 await writeFile(f.cachePath,'{}');const second=await f.publish();
 assert.equal(second.changed,false);assert.equal(second.fetched,0);assert.equal(f.calls.filter(call=>call.name==='archive_get').length,1);
 const forced=await syncArchive({rpc:f.rpc,dataDir:f.dataDir,cachePath:f.cachePath,force:true});
 assert.equal(forced.fetched,1);assert.equal(forced.version,first.version);assert.equal(forced.changed,false);
});
test('new and revised records are fetched incrementally, removals disappear, and version files remain immutable',async t=>{
 const f=await fixture(t),first=await f.publish();
 const oldFile=resolve(f.dataDir,'archive.'+first.version+'.json'),oldBody=await readFile(oldFile,'utf8');
 f.rows([item(),item('example-b')]);const next=await f.publish();assert.equal(next.fetched,1);assert.equal(next.count,2);assert.notEqual(first.version,next.version);
 assert.equal(await readFile(oldFile,'utf8'),oldBody);
 f.rows([item('example-b','current','2026-10-22T12:00:00Z')]);const removed=await f.publish();assert.equal(removed.count,1);assert.equal(removed.fetched,1);
 assert.equal((await readdir(f.dataDir)).filter(file=>file.endsWith('.tmp')).length,0);
});
test('failed updates and duplicate source IDs leave the last complete manifest unchanged',async t=>{
 const f=await fixture(t);await f.publish();const before=await readFile(resolve(f.dataDir,'manifest.json'),'utf8');
 f.rows([item(),item('example-b')]);f.fail();await assert.rejects(f.publish(),/NETWORK/);
 assert.equal(await readFile(resolve(f.dataDir,'manifest.json'),'utf8'),before);
 f.rows([item(),item()]);await assert.rejects(f.publish(),/DUPLICATE/);
 assert.equal(await readFile(resolve(f.dataDir,'manifest.json'),'utf8'),before);
});
test('credentials stay in server memory and the client can call only the two read RPCs',async t=>{
 const dir=await mkdtemp(resolve(tmpdir(),'nys-archive-env-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const path=resolve(dir,'.env.local');await writeFile(path,'SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY="fixture-only"\n');
 const config=await archiveConfig({env:{},envFiles:[path]});assert.equal(config.key,'fixture-only');
 let request;
 const rpc=archiveClient(config,{fetcher:async(url,options)=>{request={url,options};return {ok:true,json:async()=>[]};}});
 await rpc('archive_manifest');assert.equal(request.url,'https://example.supabase.co/rest/v1/rpc/archive_manifest');
 await assert.rejects(rpc('nys_reset'),/NOT_ALLOWED/);
 const denied=archiveClient(config,{fetcher:async()=>({ok:false,status:403,text:()=>{throw new Error('Private response must not be read');}})});
 await assert.rejects(denied('archive_manifest'),/^Error: ARCHIVE_HTTP_403$/);
});
