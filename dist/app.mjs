import {THEMES,CITIES,cameraRegion,validateArchive,selectRecords,summarize,pointCollection,safeDataPath} from './core.mjs';
import {LuminousPoints,formationParticles} from './landscape.mjs';
import {MapParticleSurface} from './map-particles.mjs';
import {MetallicIndicators} from './indicators.mjs';
import {FormationRelief} from './relief.mjs';
import {BloomPass} from './bloom.mjs';
import {createBasemapStyle} from './basemap.mjs';
import {referenceCamera} from './camera.mjs';
import {loadGraphics,setupGraphicsPanel} from './graphics-panel.mjs';

const $=id=>document.getElementById(id);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const graphics=loadGraphics();
const state={lang:'en',archive:null,city:'london',theme:null,selection:null,area:null,records:[],map:null,mapReady:false,loadBusy:false,lastFormationSignature:'',refreshing:false};
const words={
 "empty": "No home units in this area yet.<br>Move the map to find another imagining.",
 "returnLondon": "Return to London",
 "fallback": "The basemap could not connect. You can still explore the keywords.",
 "retry": "Reconnect map",
 "loading": "Gathering the landscape",
 "updating": "Connecting new imaginings",
 "noChange": "You are viewing the latest published data.",
 "updated": "New imaginings have joined the landscape.",
 "updateFailed": "Could not check for updates. Showing the last loaded data.",
 "liveStatus": "Published keyword archive",
 "records": " home units",
 "selected": "Selected area",
 "demoLabel": "DEMO DATA",
 "liveLabel": "ARCHIVE",
 "mapRetry": "Reconnecting the map.",
 "worldRegion": "Across the world",
 "viewRegion": "Area in view",
 "regionSuffix": " area",
};
const t=key=>words[key]||key;
let toastTimer,moveTimer,loadTimer,sourceUpdateTimer,graphicsTimer,mapSurface,reliefLayer,fieldLayer,lightLayer,graphicsPanel,effectsTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function loading(active,label='loading'){$('loading-label').textContent=t(label);$('map-loading').classList.toggle('inactive',!active);$('map-loading').setAttribute('aria-hidden',String(!active));}
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function cityName(id){const city=CITIES.find(c=>c.id===id);return city?city[state.lang]:t('selected');}
function regionLabel(){
 const region=state.mapReady?cameraRegion({...state.map.getCenter(),zoom:state.map.getZoom()}):{scope:state.city?'region':'world',city:state.city};
 if(region.scope==='world')return t('worldRegion');
 return region.city?`${cityName(region.city)}${t('regionSuffix')}`:t('viewRegion');
}

function applyLanguage(){
 document.documentElement.lang='en';
 document.querySelectorAll('[data-i18n]').forEach(e=>{e.innerHTML=t(e.dataset.i18n);});
 $('loading-label').textContent=t('loading');
 document.querySelectorAll('[data-city]').forEach(button=>button.textContent=cityName(button.dataset.city));
 $('demo-label').textContent=state.archive?.synthetic===false?t('liveLabel'):t('demoLabel');
 $('data-status').textContent=state.archive?.synthetic===false?t('liveStatus'):(state.archive?.records.length||0)+' synthetic records';
 graphicsPanel?.setLanguage('en');renderPanel();
}
function setTheme(id){
 state.theme=state.theme===id?null:id;state.selection=null;state.area=null;updatePointSource();renderPanel();
}
function getBounds(){
 if(!state.mapReady)return null;
 const m=state.map,canvas=m.getCanvas(),right=canvas.clientWidth,bottom=canvas.clientHeight;
 const corners=[[0,0],[right,0],[right,bottom],[0,bottom]].map(p=>m.unproject(p));
 return [Math.min(...corners.map(p=>p.lng)),Math.min(...corners.map(p=>p.lat)),Math.max(...corners.map(p=>p.lng)),Math.max(...corners.map(p=>p.lat))];
}
function scopedRecords({applyTheme=true}={}){
 const all=state.archive?.records||[],data=!state.mapReady&&state.city?all.filter(r=>r.city===state.city):all;
 return selectRecords(data,{bounds:state.selection?null:getBounds(),theme:applyTheme?state.theme:null,ids:state.selection});
}
function renderPanel(){
 if(!state.archive)return;
 const records=scopedRecords();state.records=records;
 const summary=summarize(records),themeSummary=summarize(scopedRecords({applyTheme:false}));
 $('panel-title').textContent=JSON.stringify(regionLabel());$('sample-count').textContent=summary.total;
 $('sample-count').title=summary.total+t('records');
 $('clear-selection').hidden=!state.selection&&!state.theme;
 const ranking=$('theme-ranking');ranking.replaceChildren();
 const themes=[...themeSummary.themes,...THEMES.filter(theme=>!themeSummary.themes.some(item=>item.id===theme.id)).map(theme=>({...theme,count:0}))];
 for(const theme of themes){
  const b=text('button','','prior-row');b.classList.toggle('active',state.theme===theme.id);b.setAttribute('aria-pressed',String(state.theme===theme.id));
  const share=themeSummary.total?theme.count/themeSummary.total:0;
  b.title=theme.en+' · '+theme.count+' of '+themeSummary.total+' home units';b.setAttribute('aria-label',b.title);
  const track=text('span','','prior-track'),fill=text('span','','prior-fill');fill.style.width=share*100+'%';track.append(fill);
  b.append(text('span',theme.id,'prior-name'),track,text('span',share.toFixed(2),'prior-value'));
  b.addEventListener('click',()=>setTheme(theme.id));ranking.append(b);
 }
 ranking.classList.toggle('has-filter',!!state.theme);
 const lead=$('console-lead');lead.replaceChildren();
 for(const word of summary.keywords.slice(0,4))lead.append(text('span',JSON.stringify(word.en)+',','console-line'));
 $('empty-state').hidden=summary.total>0;
 renderKeywordFlow(summary.keywords.slice(4));updateHighlight();
}
function renderKeywordFlow(keywords){
 const flow=$('keyword-flow');
 flow.hidden=!keywords.length;
 if(!keywords.length){flow.replaceChildren();flow.classList.remove('flow-overflow');delete flow.dataset.signature;return;}
 const signature=keywords.map(word=>word.id+':'+word.en).join('|')+':'+flow.clientWidth+'x'+flow.clientHeight;
 if(flow.dataset.signature===signature)return;
 flow.dataset.signature=signature;
 const track=text('div','','keyword-track'),group=text('div','','keyword-group');group.setAttribute('role','list');
 for(const word of keywords){const item=text('span',JSON.stringify(word.en)+',','flow-word');item.setAttribute('role','listitem');group.append(item);}
 track.append(group);flow.replaceChildren(track);
 // Move only the actual overflow. Short selections stay still and every keyword appears once.
 const distance=Math.max(0,group.offsetHeight-flow.clientHeight);
 flow.classList.toggle('flow-overflow',distance>0);
 track.style.setProperty('--flow-distance',distance+'px');
 track.style.setProperty('--flow-duration',Math.max(24,distance/6)+'s');
}
function updateHighlight(){
 if(state.mapReady)state.map.setFilter('selected-points',['in',['get','id'],['literal',state.selection?[...state.selection]:[]]]);
}
function clearSelection(){state.selection=null;state.area=null;renderPanel();}

async function refreshArchive({manual=false,initial=false}={}){
 if(state.refreshing)return;
 state.refreshing=true;$('refresh-data').disabled=true;
 try{
  const res=await fetch('./data/manifest.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('Manifest unavailable');
  const manifest=await res.json();
  if(manifest.schemaVersion!==1||typeof manifest.version!=='string'||!safeDataPath(manifest.file))throw new Error('Invalid manifest');
  if(state.archive?.version===manifest.version){if(manual)toast(t('noChange'));return;}
  if(!initial)loading(true,'updating');
  const response=await fetch(new URL(manifest.file,location.href),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Archive unavailable');
  const candidate=validateArchive(await response.json());if(candidate.version!==manifest.version)throw new Error('Version mismatch');
  state.archive=candidate;
  if(state.selection){const valid=new Set(candidate.records.map(r=>r.id));state.selection=new Set([...state.selection].filter(id=>valid.has(id)));if(!state.selection.size){state.selection=null;state.area=null;}}
  updatePointSource();applyLanguage();
  if(!initial)toast(t('updated'));
 }catch(error){
  console.warn('Archive refresh unavailable:',error.message);
  if(!state.archive){$('data-status').textContent='Could not load the archive. Use ↻ to retry.';toast(t('updateFailed'));}
  else if(manual)toast(t('updateFailed'));
 }finally{state.refreshing=false;$('refresh-data').disabled=false;if(!initial)loading(false);}
}

function markMapStage(name){$('map').dataset[name]=String(Math.round(performance.now()));}
async function initMap(){
 state.mapReady=false;clearTimeout(effectsTimer);clearTimeout(sourceUpdateTimer);clearTimeout(loadTimer);
 if(state.map)state.map.remove();state.map=null;mapSurface=reliefLayer=fieldLayer=lightLayer=null;
 state.lastFormationSignature='';
 for(const name of ['styleReadyMs','firstMapFrameMs','particlesReadyMs','fullyLoadedMs'])delete $('map').dataset[name];
 markMapStage('mapStartedMs');$('fallback-notice').hidden=true;loading(true);
 try{
  if(!window.maplibregl)throw new Error('The map library is unavailable');
  const city=CITIES.find(c=>c.id===state.city)||CITIES[0],mobile=innerWidth<=760;
  const camera=referenceCamera(city.zoom,mobile);
  const map=new maplibregl.Map({container:'map',style:createBasemapStyle(),center:city.center,zoom:city.zoom-(mobile?.65:0),bearing:city.bearing,pitch:camera.pitch,padding:mapPadding(),pixelRatio:Math.min(devicePixelRatio||1,1.25),maxZoom:18,minZoom:1.3,maxPitch:65,pitchWithRotate:false,attributionControl:false,renderWorldCopies:false,cancelPendingTileRequestsWhileZooming:true,canvasContextAttributes:{antialias:false},fadeDuration:0});
  state.map=map;
  map.setVerticalFieldOfView(camera.fov);
  map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Synthetic archive'}),'bottom-right');
  map.on('style.load',()=>{
   if(map!==state.map)return;
   state.mapReady=true;markMapStage('styleReadyMs');installLayers();updatePointSource();renderPanel();updateReadout();
   // Paint the lightweight map first; compile and populate decorative GPU layers afterward.
   map.once('render',()=>{effectsTimer=setTimeout(()=>{if(map===state.map&&state.mapReady)installEffects();},80);});
  });
  map.on('load',()=>{if(map===state.map){markMapStage('fullyLoadedMs');clearTimeout(loadTimer);loading(false);}});
  let sourceErrors=0,firstTileScheduled=false;
  map.on('error',event=>{
   console.warn('Map resource unavailable:',event.error?.message?.slice(0,180));
   if(++sourceErrors>=4&&!$('map').dataset.firstMapFrameMs){$('fallback-notice').hidden=false;loading(false);}
  });
  map.on('movestart',()=>{clearTimeout(moveTimer);clearTimeout(loadTimer);loadTimer=setTimeout(()=>loading(true),400);});
  map.on('moveend',()=>{
   const camera=referenceCamera(map.getZoom(),innerWidth<=760);
   if(Math.abs(map.getPitch()-camera.pitch)>.05){map.jumpTo({pitch:camera.pitch});return;}
   clearTimeout(loadTimer);clearTimeout(moveTimer);moveTimer=setTimeout(()=>{renderPanel();updateFormationLayers();scheduleTexture();updateReadout();loading(false);},120);
  });
  map.on('zoom',updateReadout);
  map.on('idle',()=>{if(state.mapReady){scheduleTexture();clearTimeout(loadTimer);loading(false);}});
  map.on('sourcedata',event=>{
   if(map!==state.map)return;
   if(event.sourceId==='archive'&&event.isSourceLoaded){clearTimeout(sourceUpdateTimer);sourceUpdateTimer=setTimeout(updateFormationLayers,30);}
   if(event.sourceId==='openmaptiles'&&event.sourceDataType==='content'){
    scheduleTexture();
    if(!firstTileScheduled){firstTileScheduled=true;map.once('render',()=>{if(map===state.map){markMapStage('firstMapFrameMs');loading(false);}});}
   }
  });
  map.on('click',onMapClick);map.on('mousemove',onMapHover);
  map.getCanvas().addEventListener('mouseleave',()=>{popup?.remove();popup=null;});
  map.on('dragstart',()=>{state.city=null;document.querySelectorAll('.city-button').forEach(b=>b.classList.remove('active'));if(state.selection)clearSelection();});
  loadTimer=setTimeout(()=>{if(map===state.map&&!$('map').dataset.firstMapFrameMs){$('fallback-notice').hidden=false;loading(false);}},18000);
 }catch(error){console.warn('Map could not start:',error.message);$('fallback-notice').hidden=false;loading(false);renderPanel();}
}
function mapPadding(){return {left:20,right:20,top:20,bottom:20};}
function installLayers(){
 const map=state.map;
 const props={};for(const theme of THEMES)props[theme.id]=['+',['case',['==',['get','theme'],theme.id],1,0]];
 map.addSource('archive',{type:'geojson',data:pointCollection([]),cluster:true,clusterRadius:48,clusterMaxZoom:15,clusterProperties:props});
 map.addSource('formation-areas',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 // Water cuts through the highlighted islands, and the road network stays engraved above them.
 map.addLayer({id:'formation-surface',type:'fill',source:'formation-areas',filter:['==',['get','kind'],'area'],paint:{'fill-color':'#1278ff','fill-opacity':.12}},'flat-water');
 map.addLayer({id:'formation-ice',type:'fill',source:'formation-areas',filter:['==',['get','kind'],'ice'],paint:{'fill-color':'#4aaaff','fill-opacity':.09}},'flat-water');
 map.addLayer({id:'formation-edge',type:'line',source:'formation-areas',filter:['==',['get','kind'],'area'],paint:{'line-color':'#79dfff','line-width':.6,'line-opacity':.24,'line-blur':.3}},'flat-water');
 const count=['coalesce',['get','point_count'],1];
 // Transparent picking area preserves cluster selection without a solid halo.
 map.addLayer({id:'archive-halo',type:'circle',source:'archive',paint:{'circle-radius':['interpolate',['linear'],count,1,18,6,32,20,45,60,55],'circle-opacity':0,'circle-pitch-alignment':'map'}});
 map.addLayer({id:'archive-core',type:'circle',source:'archive',paint:{'circle-radius':2.5,'circle-color':'#edfaff','circle-opacity':.85,'circle-pitch-alignment':'map','circle-stroke-color':'#b6dfff','circle-stroke-width':.5}});
 map.addLayer({id:'archive-ring',type:'circle',source:'archive',filter:['has','point_count'],paint:{'circle-radius':5,'circle-color':'#174aa4','circle-opacity':0,'circle-stroke-color':'#ecf7ff','circle-stroke-opacity':.65,'circle-stroke-width':.8,'circle-pitch-alignment':'map'}});
 map.addLayer({id:'selected-points',type:'circle',source:'archive',filter:['in',['get','id'],['literal',[]]],paint:{'circle-radius':10,'circle-color':'#ffffff','circle-opacity':0,'circle-stroke-color':'#ffffff','circle-stroke-width':1.2}});
}
function installEffects(){
 const map=state.map;
 mapSurface=new MapParticleSurface(graphics.particleDensity);map.addLayer(mapSurface,'archive-halo');
 reliefLayer=new FormationRelief();map.addLayer(reliefLayer,'archive-halo');
 fieldLayer=new LuminousPoints('formation-field-particles',{motion:1});map.addLayer(fieldLayer,'archive-halo');
 lightLayer=new MetallicIndicators();map.addLayer(lightLayer,'archive-halo');
 map.addLayer(new BloomPass(graphics));updateFormationLayers();scheduleTexture();
}
function applyGraphics(changed){
 if(!state.mapReady)return;
 if(changed.some(key=>['pillarHeight','pillarDensity','fieldDensity','clusterSpread'].includes(key))){
  clearTimeout(graphicsTimer);graphicsTimer=setTimeout(()=>{state.lastFormationSignature='';updateFormationLayers();},140);
 }
 if(changed.includes('particleDensity')){scheduleTexture();}
 state.map.triggerRepaint();
}
function scheduleTexture(){
 if(state.mapReady&&mapSurface)mapSurface.setDensity(graphics.particleDensity);
}
function updatePointSource(){
 if(!state.mapReady)return;
 const records=selectRecords(state.archive?.records||[],{theme:state.theme});
 state.map.getSource('archive').setData(pointCollection(records));state.lastFormationSignature='';
 updateHighlight();
}
function updateFormationLayers(){
 if(!state.mapReady||!reliefLayer||!fieldLayer||!lightLayer||!state.map.getSource('archive')||!state.map.isSourceLoaded('archive'))return;
 const map=state.map,zoom=map.getZoom(),unique=new Map(),bounds=map.getBounds();
 for(const feature of map.querySourceFeatures('archive')){
  if(bounds.contains(feature.geometry.coordinates))unique.set(feature.properties.cluster?'c'+feature.properties.cluster_id:'p'+feature.properties.id,feature);
 }
 const signature=[state.archive?.version,state.theme,Math.floor(zoom*2),innerWidth<=760,graphics.pillarHeight,graphics.pillarDensity,graphics.fieldDensity,graphics.clusterSpread,...[...unique.keys()].sort()].join('|');
 if(signature===state.lastFormationSignature)return;
 state.lastFormationSignature=signature;
 const particles=formationParticles([...unique.values()],{...graphics,zoom,mobile:innerWidth<=760});
 map.getSource('formation-areas').setData(particles.areas);
 mapSurface.setRegions(particles.regions);
 reliefLayer.setMesh(particles.relief);
 fieldLayer.setPoints(particles.field);lightLayer.setIndicators(particles.indicators);
 if((particles.field.length||particles.indicators.length)&&!$('map').dataset.particlesReadyMs)map.once('render',()=>{if(map===state.map)markMapStage('particlesReadyMs');});
}
function hitFeatures(point){if(!state.mapReady)return [];return state.map.queryRenderedFeatures(point,{layers:['archive-core','archive-ring','archive-halo']});}
async function onMapClick(event){
 const feature=hitFeatures(event.point)[0];if(!feature)return;

 if(feature.properties.cluster){
  const source=state.map.getSource('archive');const version=state.archive?.version,theme=state.theme;
  try{
   const leaves=await source.getClusterLeaves(Number(feature.properties.cluster_id),Number(feature.properties.point_count),0);
   if(state.archive?.version!==version||state.theme!==theme)return;
   state.selection=new Set(leaves.map(f=>f.properties.id));
   const records=state.archive.records.filter(r=>state.selection.has(r.id));
   const areas=new Map();for(const r of records)areas.set(r.area,(areas.get(r.area)||0)+1);
   state.area=[...areas].sort((a,b)=>b[1]-a[1])[0]?.[0]||t('selected');
   renderPanel();
   const expansion=await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
   state.map.easeTo({center:feature.geometry.coordinates,zoom:Math.min(expansion,Math.max(state.map.getZoom()+.6,14.1)),duration:reducedMotion?0:1100,padding:mapPadding()});
  }catch(error){console.warn('Cluster selection unavailable:',error.message);}
 }else{
  state.selection=new Set([feature.properties.id]);const record=state.archive.records.find(r=>r.id===feature.properties.id);state.area=record?.area||t('selected');renderPanel();updateHighlight();
 }
}
let popup;
function onMapHover(event){
 const feature=hitFeatures(event.point)[0];state.map.getCanvas().style.cursor=feature?'pointer':'';
 if(!feature){popup?.remove();popup=null;return;}
 const key=feature.properties.cluster?String(feature.properties.cluster_id):feature.properties.id;
 if(popup?.nysKey===key)return;
 popup?.remove();
 const count=feature.properties.point_count||1;
 const wrapper=document.createElement('div');wrapper.append(text('div',`${count}${t('records')}`,'map-tooltip-title'),text('div','Select to explore shared themes','map-tooltip-subtitle'));
 popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:19}).setLngLat(feature.geometry.coordinates).setDOMContent(wrapper).addTo(state.map);popup.nysKey=key;
}
function updateReadout(){
 if(!state.map)return;
 $('map').dataset.cameraFov=state.map.getVerticalFieldOfView().toFixed(1);$('map').dataset.cameraPitch=state.map.getPitch().toFixed(1);$('map').dataset.projection='perspective';
 const {lng,lat}=state.map.getCenter();$('coordinates').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'} · ${Math.abs(lng).toFixed(3)}° ${lng>=0?'E':'W'}`;$('zoom-readout').textContent=state.map.getZoom().toFixed(1);$('zoom-range').value=state.map.getZoom().toFixed(1);
 if(state.archive)$('panel-title').textContent=JSON.stringify(regionLabel());
}
function goToCity(id){
 const city=CITIES.find(c=>c.id===id);if(!city)return;
 state.city=id;state.selection=null;state.area=null;
 document.querySelectorAll('.city-button').forEach(b=>b.classList.toggle('active',b.dataset.city===id));
 if(state.mapReady)state.map.flyTo({center:city.center,zoom:city.zoom-(innerWidth<=760?.65:0),bearing:city.bearing,pitch:referenceCamera(city.zoom,innerWidth<=760).pitch,padding:mapPadding(),duration:reducedMotion?0:1900,essential:!reducedMotion});
 else renderPanel();
}

function setupEvents(){
 // Native text/link dragging is separate from MapLibre's pointer-based map navigation.
 document.addEventListener('dragstart',event=>event.preventDefault());
 $('keyword-flow').classList.toggle('flow-running',!reducedMotion);
 document.querySelectorAll('[data-city]').forEach(b=>b.addEventListener('click',()=>goToCity(b.dataset.city)));
 $('world-button').addEventListener('click',()=>{state.city=null;clearSelection();document.querySelectorAll('.city-button').forEach(b=>b.classList.toggle('active',b.id==='world-button'));if(state.mapReady)state.map.flyTo({center:[32,40],zoom:1.8,pitch:referenceCamera(1.8).pitch,bearing:0,duration:reducedMotion?0:2200,padding:mapPadding()});});
 $('zoom-in').addEventListener('click',()=>state.map?.zoomIn({duration:reducedMotion?0:500}));$('zoom-out').addEventListener('click',()=>state.map?.zoomOut({duration:reducedMotion?0:500}));$('reset-bearing').addEventListener('click',()=>state.map?.easeTo({bearing:0,pitch:referenceCamera(state.map.getZoom()).pitch,duration:reducedMotion?0:800}));
 $('zoom-range').addEventListener('change',event=>state.map?.zoomTo(Number(event.target.value),{duration:reducedMotion?0:600}));
 $('clear-selection').addEventListener('click',()=>{state.theme=null;updatePointSource();clearSelection();});$('empty-reset').addEventListener('click',()=>goToCity('london'));
 $('refresh-data').addEventListener('click',()=>refreshArchive({manual:true}));$('retry-map').addEventListener('click',()=>{toast(t('mapRetry'));initMap();});
 window.addEventListener('resize',()=>{state.map?.resize();if(state.mapReady){const camera=referenceCamera(state.map.getZoom(),innerWidth<=760);state.map.setVerticalFieldOfView(camera.fov);state.map.easeTo({pitch:camera.pitch,padding:mapPadding(),duration:0});renderPanel();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshArchive();mapSurface?.setAnimated(true);fieldLayer?.setAnimated(true);lightLayer?.setAnimated(true);}});
 setInterval(()=>{if(!document.hidden)refreshArchive();},30000);
 // Only GPU appearance animates: no tile re-sampling, archive fetch, or AI call per frame.
 setInterval(()=>{if(!document.hidden&&state.mapReady&&!state.map.isMoving())state.map.triggerRepaint();},1000/24);
 // Explicit, one-way navigation from an embedded exhibition display. No upload or credentials in the browser.
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='nys:navigate')return;
  const {city,unitId}=event.data;if(city)goToCity(city);
  const record=state.archive?.records.find(r=>r.id===unitId);
  if(record&&state.mapReady){state.selection=new Set([record.id]);state.area=record.area;state.map.flyTo({center:record.position,zoom:15.5,padding:mapPadding(),duration:reducedMotion?0:1500});renderPanel();}
 });
}
graphicsPanel=setupGraphicsPanel({settings:graphics,onChange:applyGraphics,lang:state.lang});
setupEvents();applyLanguage();
await Promise.allSettled([initMap(),refreshArchive({initial:true})]);
