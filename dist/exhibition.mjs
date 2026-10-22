import {validateExhibitionState} from './exhibition-state.mjs';

export function exhibitionRole(search=location.search){
 const mode=new URLSearchParams(search).get('mode');
 return ['control','display'].includes(mode)?mode:null;
}

export function connectExhibition({readState,applyState,onArchiveVersion}){
 const role=exhibitionRole();
 if(!role)return {notify(){},setWaiting(){},archiveVersion:()=>null};
 document.documentElement.dataset.exhibition=role;
 const label=document.createElement('div');label.id='exhibition-status';label.setAttribute('role','status');label.setAttribute('aria-live','polite');document.body.append(label);
 // crypto.randomUUID requires HTTPS on iPad; getRandomValues works on the LAN HTTP page.
 const clientId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 let stream,instance=null,lastRevision=-1,owns=false,connected=false,claiming=false,sending=false,dirty=true,lastSent='',stopped=false,starting=false,waiting='',serverVersion=null,lastStatus={displays:0,controllerConnected:false};
 function archiveChanged(version){if(typeof version==='string'&&version&&version!==serverVersion){serverVersion=version;dirty=true;onArchiveVersion?.(version);}}
 function show(message){
  const normal=role==='control'?(owns?(lastStatus.displays?'Control connected · TD display connected':'Control connected · waiting for TD display'):'Another control screen is active · waiting'):(lastRevision<0?'Waiting for iPad control':lastStatus.controllerConnected?'':'Controller offline · holding the last view');
  const next=waiting||message||normal;if(label.textContent!==next)label.textContent=next;label.hidden=role==='display'&&!label.textContent;
  const locked=role==='control'&&(!owns||!connected);
  document.documentElement.classList.toggle('exhibition-locked',locked);document.getElementById('atlas').inert=locked;
  document.documentElement.dataset.exhibitionConnected=String(connected);
 }
 async function api(path,body){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4000);
  try{
   const response=await fetch('/exhibition/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal,cache:'no-store'});
   if(!response.ok){const error=new Error('Relay request failed');error.status=response.status;const data=await response.json().catch(()=>({}));error.code=data.error;error.archiveVersion=data.archiveVersion;throw error;}
   return await response.json();
  }finally{clearTimeout(timer);}
 }
 function receive(data,force=false){
  if(data.instance!==instance){instance=data.instance;lastRevision=-1;lastSent='';dirty=true;owns=false;}
  lastStatus=data;
  archiveChanged(data.archiveVersion);
  if(data.state&&(data.revision>lastRevision||(force&&data.revision===lastRevision))){
   const snapshot=validateExhibitionState(data.state);lastRevision=data.revision;
   if(force||data.source!==clientId)applyState(snapshot);
  }
  show();
 }
 async function claim(){
  if(role!=='control'||claiming||stopped)return;
  claiming=true;
  try{
   const data=await api('claim',{clientId}),restore=!owns||data.instance!==instance;
   receive(data,restore);owns=true;show();dirty=true;
  }catch(error){owns=false;show(error.status===409?'Another control screen is active · waiting':'Reconnecting control · holding the last view');}
  finally{claiming=false;}
 }
 async function start(){
  if(starting||stopped||stream)return;
  starting=true;
  try{
   const session=await api('session');
   if(session.protocol!==1)throw new Error('Unsupported relay');
   receive(session);
   stream=new EventSource('/exhibition/events?role='+role);
   stream.onopen=()=>{connected=true;show();if(role==='control')claim();};
   stream.addEventListener('snapshot',event=>{
    try{receive(JSON.parse(event.data));if(role==='control'&&!owns)claim();}
    catch{show('Could not read the display state');}
   });
   stream.addEventListener('status',event=>{
    try{const data=JSON.parse(event.data);if(data.instance!==instance){receive(data);if(role==='control')claim();}else{lastStatus=data;archiveChanged(data.archiveVersion);show();}}catch{}
   });
   stream.addEventListener('archive',event=>{try{archiveChanged(JSON.parse(event.data).version);}catch{}});
   stream.onerror=()=>{connected=false;owns=false;show('Reconnecting · holding the last view');};
  }catch{show('Exhibition relay unavailable · start npm run exhibition on the PC');}
  finally{starting=false;}
 }
 async function flush(){
  if(role!=='control'||!connected||!owns||sending||!dirty||stopped)return;
  const value=readState();if(!value)return;
  if(serverVersion&&value.archiveVersion!==serverVersion){onArchiveVersion?.(serverVersion);return;}
  const serialized=JSON.stringify(value);if(serialized===lastSent){dirty=false;return;}
  sending=true;dirty=false;
  try{
   await api('state',{clientId,state:value});lastSent=serialized;
  }catch(error){dirty=true;if(error.code==='ARCHIVE_VERSION_MISMATCH'){archiveChanged(error.archiveVersion);onArchiveVersion?.(serverVersion);show('Updating the archive');}else{if(error.status===409)owns=false;show('Reconnecting control · holding the last view');}}
  finally{sending=false;}
 }
 show('Connecting exhibition control');start();
 const updateTimer=setInterval(flush,100);
 const heartbeat=setInterval(()=>{if(!stream)start();else if(role==='control'&&connected)claim();},2000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){dirty=true;if(role==='control')claim();}});
 window.addEventListener('pagehide',()=>{
  stopped=true;clearInterval(updateTimer);clearInterval(heartbeat);stream?.close();
  if(owns)navigator.sendBeacon('/exhibition/release',new Blob([JSON.stringify({clientId})],{type:'application/json'}));
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 return {notify(){dirty=true;},setWaiting(message){waiting=message;show();},archiveVersion:()=>serverVersion};
}
