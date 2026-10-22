import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createExhibitionServer} from '../scripts/exhibition-server.mjs';
import {validateExhibitionState,reconcileControllerArchive} from '../dist/exhibition-state.mjs';
import {GRAPHICS_DEFAULTS} from '../dist/graphics.mjs';

const id='controller_1234567890',other='controller_9876543210';
const state=()=>({protocol:1,archiveVersion:'synthetic-test',city:'seoul',theme:'care',camera:{lng:126.98,lat:37.56,zoom:13,bearing:25,pitch:52,fov:48},selection:['public-id-1'],scope:['public-id-1','public-id-2'],graphics:{...GRAPHICS_DEFAULTS}});
async function fixture(t,options){
 const server=createExhibitionServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base=`http://127.0.0.1:${server.address().port}`;
 return {server,base,post:(route,body,headers={})=>fetch(base+'/exhibition/'+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})};
}
async function events(base){
 const abort=new AbortController(),response=await fetch(base+'/exhibition/events?role=display',{signal:abort.signal}),reader=response.body.getReader();
 assert.equal(response.status,200);let pending='';
 return {close:()=>abort.abort(),async next(type){
  const timeout=setTimeout(()=>abort.abort(),2500);
  try{while(true){
   const end=pending.indexOf('\n\n');
   if(end>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);if(block.startsWith('event: '+type+'\n'))return JSON.parse(block.split('\ndata: ')[1]);continue;}
   const chunk=await reader.read();if(chunk.done)throw new Error('Stream ended');pending+=new TextDecoder().decode(chunk.value);
  }}finally{clearTimeout(timeout);}
 }};
}

test('LAN navigation validation rejects malformed cameras and strips unrelated fields',()=>{
 const candidate=state();candidate.raw_response='must never be relayed';candidate.camera.password='ignored';
 const clean=validateExhibitionState(candidate);assert.equal('raw_response' in clean,false);assert.equal('password' in clean.camera,false);
 assert.equal(clean.camera.bearing,0);
 for(const patch of [{zoom:Infinity},{lat:90},{lng:'126'},{pitch:-1},{bearing:181},{fov:0}])assert.throws(()=>validateExhibitionState({...candidate,camera:{...candidate.camera,...patch}}),/camera/);
 assert.throws(()=>validateExhibitionState({...candidate,theme:'unknown'}),/theme/);
 assert.throws(()=>validateExhibitionState({...candidate,selection:[{}]}),/selection/);
 assert.throws(()=>validateExhibitionState({...candidate,scope:new Array(5001).fill('x')}),/scope/);
});
test('live output receives navigation and selected public IDs, and reconnect replays the latest snapshot',async t=>{
 const {base,post}=await fixture(t),output=await events(base);t.after(output.close);
 assert.equal((await output.next('snapshot')).state,null);
 assert.equal((await post('claim',{clientId:id})).status,200);
 assert.equal((await post('state',{clientId:id,state:state()})).status,200);
 const live=await output.next('snapshot');assert.deepEqual(live.state,validateExhibitionState(state()));assert.equal(live.revision,1);
 output.close();
 const next={...state(),theme:null,selection:null,camera:{...state().camera,lng:-.1,lat:51.5}};
 await post('state',{clientId:id,state:next});
 const reconnect=await events(base);t.after(reconnect.close);const recovered=await reconnect.next('snapshot');
 assert.equal(recovered.revision,2);assert.deepEqual(recovered.state,validateExhibitionState(next));
});
test('one controller owns the map; release and lease expiry permit a new controller without resetting the view',async t=>{
 const {post}=await fixture(t,{leaseMs:60});
 await post('claim',{clientId:id});await post('state',{clientId:id,state:state()});
 assert.equal((await post('claim',{clientId:other})).status,409);
 assert.equal((await post('state',{clientId:other,state:state()})).status,409);
 await post('release',{clientId:id});
 const claimed=await (await post('claim',{clientId:other})).json();assert.equal(claimed.revision,1);assert.deepEqual(claimed.state,validateExhibitionState(state()));
 await new Promise(resolve=>setTimeout(resolve,90));
 assert.equal((await post('claim',{clientId:id})).status,200);
});
test('invalid and cross-origin writes cannot replace the last good state; static browsing has no control effect',async t=>{
 const {base,post}=await fixture(t);await post('claim',{clientId:id});await post('state',{clientId:id,state:state()});
 assert.equal((await post('state',{clientId:id,state:{...state(),camera:{...state().camera,zoom:100}}})).status,400);
 assert.equal((await post('state',{clientId:id,state:state()},{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await fetch(base+'/exhibition/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:other})})).status,403);
 assert.equal((await fetch(base+'/?mode=display')).status,200);
 assert.equal((await fetch(base+'/../package.json')).status,404);
 const output=await events(base);t.after(output.close);const current=await output.next('snapshot');assert.equal(current.revision,1);assert.deepEqual(current.state,validateExhibitionState(state()));
});

test('a controller restores its camera across archive versions and removes obsolete demo IDs and themes',()=>{
 const saved={...state(),archiveVersion:'demo-20261021-01',theme:'creativity',selection:['LH-DEMO-0001'],scope:['LH-DEMO-0001']};
 const archive={version:'live-next',records:[{id:'public-id-1'}]};
 const next=reconcileControllerArchive(saved,archive,'live-next');
 assert.equal(next.archiveVersion,'live-next');assert.equal(next.theme,null);assert.equal(next.selection,null);assert.deepEqual(next.scope,[]);
 assert.equal(next.camera.lng,saved.camera.lng);assert.equal(next.camera.zoom,saved.camera.zoom);assert.equal(next.camera.bearing,0);
 assert.deepEqual(next.graphics,saved.graphics);
 assert.equal(reconcileControllerArchive(saved,archive,'live-newer'),null);
 const retained=reconcileControllerArchive(state(),archive,'live-next');assert.deepEqual(retained.selection,['public-id-1']);
});

test('publishing a new archive wakes displays; stale controllers cannot overwrite the current version',async t=>{
 const {base,post,server}=await fixture(t,{archiveVersion:'synthetic-test'}),output=await events(base);t.after(output.close);
 assert.equal((await output.next('snapshot')).archiveVersion,'synthetic-test');
 await post('claim',{clientId:id});await post('state',{clientId:id,state:state()});await output.next('snapshot');
 server.setArchiveVersion('synthetic-next');assert.deepEqual(await output.next('archive'),{version:'synthetic-next'});
 const stale=await post('state',{clientId:id,state:state()});assert.equal(stale.status,409);assert.equal((await stale.json()).error,'ARCHIVE_VERSION_MISMATCH');
 const current={...state(),archiveVersion:'synthetic-next'};assert.equal((await post('state',{clientId:id,state:current})).status,200);
 const recovered=await output.next('snapshot');assert.equal(recovered.revision,2);assert.equal(recovered.state.archiveVersion,'synthetic-next');
});
