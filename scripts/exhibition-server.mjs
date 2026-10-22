import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {serveStatic} from './static-server.mjs';
import {startArchiveSync} from './publish-archive.mjs';
import {validateExhibitionState,MAX_STATE_BYTES,EXHIBITION_PROTOCOL} from '../dist/exhibition-state.mjs';

export function createExhibitionServer({leaseMs=7000,archiveVersion=null}={}){
 const instance=randomUUID(),streams=new Map();
 let snapshot=null,revision=0,owner=null,leaseUntil=0;
 const status=()=>({protocol:EXHIBITION_PROTOCOL,instance,revision,archiveVersion,controllerConnected:!!owner&&Date.now()<leaseUntil,displays:[...streams.values()].filter(role=>role==='display').length});
 const event=(res,type,data)=>{
  if(res.destroyed||res.writableLength>MAX_STATE_BYTES*2){res.destroy();return;}
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
 };
 const broadcast=(type,data)=>{for(const res of streams.keys())event(res,type,data);};
 const expire=()=>{if(owner&&Date.now()>=leaseUntil){owner=null;broadcast('status',status());}};
 const json=(res,code,body)=>res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(body));
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/exhibition/'))return serveStatic(req,res);
  const origin=`http://${req.headers.host}`;
  if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Same-origin requests only'});
  expire();
  if(req.method==='GET'&&url.pathname==='/exhibition/session')return json(res,200,status());
  if(req.method==='GET'&&url.pathname==='/exhibition/events'){
   const role=url.searchParams.get('role');
   if(!['control','display'].includes(role))return json(res,400,{error:'Invalid role'});
   const address=req.socket.remoteAddress;
   if(role==='display'&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return json(res,403,{error:'Open the display on the TD computer using 127.0.0.1'});
   if(streams.size>=20)return json(res,503,{error:'Too many connections'});
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   res.write('retry: 1000\n\n');streams.set(res,role);
   event(res,'snapshot',{...status(),state:snapshot});broadcast('status',status());
   res.on('close',()=>{streams.delete(res);broadcast('status',status());});
   return;
  }
  if(req.method!=='POST'||!['/exhibition/claim','/exhibition/state','/exhibition/release'].includes(url.pathname))return json(res,404,{error:'Not found'});
  if(req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,403,{error:'Use same-origin JSON'});
  try{
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>MAX_STATE_BYTES){json(res,413,{error:'State too large'});return;}chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!/^[a-zA-Z0-9_-]{16,80}$/.test(body.clientId||''))return json(res,400,{error:'Invalid controller ID'});
   expire();
   if(url.pathname==='/exhibition/release'){
    if(owner===body.clientId){owner=null;leaseUntil=0;broadcast('status',status());}
    return json(res,200,{ok:true});
   }
   if(owner&&owner!==body.clientId)return json(res,409,{error:'Another controller is active',...status()});
   if(url.pathname==='/exhibition/claim'){
    const changed=owner!==body.clientId;owner=body.clientId;leaseUntil=Date.now()+leaseMs;
    if(changed)broadcast('status',status());
    return json(res,200,{...status(),state:snapshot});
   }
   if(owner!==body.clientId)return json(res,409,{error:'Claim control first'});
   const next=validateExhibitionState(body.state);
   if(archiveVersion&&next.archiveVersion!==archiveVersion)return json(res,409,{error:'ARCHIVE_VERSION_MISMATCH',archiveVersion});
   owner=body.clientId;leaseUntil=Date.now()+leaseMs;snapshot=next;revision++;
   broadcast('snapshot',{...status(),state:snapshot,source:owner});
   return json(res,200,{revision,instance});
  }catch(error){if(!res.headersSent)json(res,400,{error:error instanceof SyntaxError?'Invalid JSON':'Invalid navigation state'});}
 });
 const timer=setInterval(()=>{expire();for(const res of streams.keys())res.write(': keepalive\n\n');},2000);timer.unref();
 server.on('close',()=>clearInterval(timer));
 server.closeStreams=()=>{for(const res of streams.keys())res.destroy();streams.clear();};
 server.setArchiveVersion=version=>{if(typeof version==='string'&&version&&version!==archiveVersion){archiveVersion=version;broadcast('archive',{version});}};
 return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.EXHIBITION_PORT||4180);
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('EXHIBITION_PORT must be 1024–65535');
 let archiveVersion=null;try{archiveVersion=JSON.parse(await readFile(new URL('../dist/data/manifest.json',import.meta.url),'utf8')).version;}catch{}
 const server=createExhibitionServer({archiveVersion});let archiveSync,archiveReady=false;
 server.on('close',()=>archiveSync?.stop());
 server.on('error',error=>{console.error(`Exhibition server: ${error.code==='EADDRINUSE'?`Port ${port} is already in use. Close the previous exhibition server or set EXHIBITION_PORT.`:error.message}`);process.exitCode=1;});
 server.listen(port,'0.0.0.0',()=>{
  console.log(`TD display: http://127.0.0.1:${port}/?mode=display`);
  const addresses=[...new Set(Object.values(networkInterfaces()).flat().filter(item=>item.family==='IPv4'&&!item.internal&&!item.address.startsWith('169.254.')).map(item=>item.address))];
  for(const address of addresses)console.log(`iPad control: http://${address}:${port}/?mode=control`);
  if(!addresses.length)console.log('No LAN IPv4 address found. Connect this PC to the same network as the iPad.');
  console.log('Keep this process running. Ctrl+C stops the exhibition relay.');
  startArchiveSync({onSync:result=>{server.setArchiveVersion(result.version);if(!archiveReady){archiveReady=true;console.log(`Archive sync ready: ${result.count} completed units. Checking every 60 seconds.`);}}}).then(handle=>{archiveSync=handle;if(!server.listening)handle.stop();}).catch(()=>console.error('Archive sync unavailable; serving the published snapshot.'));
 });
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeStreams();server.close();});
}
