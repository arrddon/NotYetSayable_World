import {THEMES,CITIES,validateArchive,selectRecords,summarize,pointCollection,makeSpire,safeDataPath} from './core.mjs';

const $=id=>document.getElementById(id);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={lang:localStorage.getItem('nys-language')==='en'?'en':'ko',archive:null,city:'london',theme:null,keyword:null,selection:null,area:null,records:[],recordIndex:0,map:null,mapReady:false,loadBusy:false,lastSpireSignature:'',refreshing:false};
const translations={
 ko:{subtitle:'아직 말해지지 않은 집의 풍경',intro:'기억과 지금, 그리고 앞으로의 집.<br>각자의 상상이 만나 하나의 풍경이 됩니다.',about:'작품 소개',goto:'GO TO',world:'전체',mapCaption:'우리가 살고 싶은 곳에 모이는 이야기',collective:'COLLECTIVE IMAGINARIES',common:'공통으로 그리는 집',keywords:'이곳에 모인 단어들',details:'개별 상상 들여다보기',showArea:'지역 전체 보기',interpretation:'참여자의 표현에서 재해석한 키워드입니다.',panelFooter:'하나의 답보다,<br>함께 상상할 수 있는 가능성.',themes:'THEMES',empty:'이 풍경에는 아직 기록이 없습니다.<br>지도를 이동해 다른 상상을 찾아보세요.',returnLondon:'런던으로 돌아가기',fallback:'배경 지도를 연결하지 못했습니다. 키워드 탐색은 계속 사용할 수 있습니다.',retry:'지도 다시 연결',loading:'풍경을 불러오는 중',updating:'새로운 상상을 연결하는 중',noChange:'현재 공개된 최신 데이터입니다.',updated:'새로운 상상이 풍경에 더해졌습니다.',updateFailed:'갱신을 확인하지 못했습니다. 마지막 데이터를 표시합니다.',demoStatus:'합성 데이터로 살펴보는 첫 풍경',liveStatus:'공개 키워드 아카이브',areaNote:'이곳에서 살기를 상상한 사람들의 공통점',worldNote:'서로 다른 곳에서 그리는 미래의 집',filtered:'선택한 키워드의 상상',records:'개의 상상',of:'명 중',mentions:'명이 공유',past:'PAST / 기억',present:'PRESENT / 지금',future:'FUTURE / 상상',filteredTitle:'선택한 주제',resetFilter:'모든 주제 보기',all:'모든 주제',selected:'선택한 군집',demoLabel:'DEMO DATA',liveLabel:'ARCHIVE',detailEmpty:'표시할 기록이 없습니다.',city:'도시',mapRetry:'지도 연결을 다시 시도합니다.',aboutCopy:'<p>집은 어디에 있을까요. 우리가 기억하는 곳, 지금 머무는 곳, 그리고 언젠가 살고 싶은 곳 사이에서 집의 의미는 계속 만들어집니다.</p><p>Not Yet Sayable: Latent Homes는 각자의 경험이 서로 만나 공동의 상상으로 자라나는 참여형 작업입니다. 하나의 상상은 지도 위의 작은 흔적이 되고, 다른 이들의 흔적과 함께 새로운 풍경을 이룹니다.</p><p>지도는 참여자가 선택한 <strong>미래에 살고 싶은 곳</strong>을 나타냅니다. 군집을 선택해 공통 주제를 살펴보고, 개별 기록의 기억·현재·미래 키워드를 탐색해 보세요.</p><p class="demo-explanation">현재는 디자인과 탐색 방식을 검토하기 위한 프로토타입입니다. 표시된 모든 기록과 수치는 합성 데이터이며 실제 참여자의 응답이 아닙니다. 원문과 손글씨 이미지는 공개하지 않습니다.</p>'},
 en:{subtitle:'A collective map of imagined homes',intro:'Memories, present lives, and homes yet to be.<br>Individual imaginings become a shared landscape.',about:'About the work',goto:'GO TO',world:'World',mapCaption:'Stories gather where we imagine living',collective:'COLLECTIVE IMAGINARIES',common:'The homes we imagine together',keywords:'Words gathering here',details:'Look into individual imaginings',showArea:'Back to the area',interpretation:'Keywords interpreted from participants’ expressions.',panelFooter:'Beyond a single answer,<br>the possibility of imagining together.',themes:'THEMES',empty:'No imaginings in this view yet.<br>Move the map to discover another landscape.',returnLondon:'Return to London',fallback:'The basemap could not connect. You can still explore the keywords.',retry:'Reconnect map',loading:'Gathering the landscape',updating:'Connecting new imaginings',noChange:'You are viewing the latest published data.',updated:'New imaginings have joined the landscape.',updateFailed:'Could not check for updates. Showing the last loaded data.',demoStatus:'A first landscape, explored with synthetic data',liveStatus:'Published keyword archive',areaNote:'Shared by people imagining a future here',worldNote:'Future homes imagined across different places',filtered:'Imaginings with this keyword',records:' imaginings',of:' of ',mentions:' share this',past:'PAST / Memories',present:'PRESENT / Now',future:'FUTURE / Imagined',filteredTitle:'Selected theme',resetFilter:'Show all themes',all:'All themes',selected:'Selected cluster',demoLabel:'DEMO DATA',liveLabel:'ARCHIVE',detailEmpty:'No records in this view.',city:'City',mapRetry:'Reconnecting the map.',aboutCopy:'<p>Where is home? Between places we remember, places we inhabit, and places we hope to live, the meaning of home is continually being formed.</p><p>Not Yet Sayable: Latent Homes is a participatory work in which individual experiences meet and grow into collective imagination. Each imagining becomes a trace in the landscape, taking shape alongside the traces of others.</p><p>The map locates the places where participants <strong>imagine living in the future</strong>. Select a cluster to discover shared themes, then explore the past, present, and future keywords of individual contributions.</p><p class="demo-explanation">This prototype uses entirely synthetic records and counts to explore the design and interactions. No real participant responses are displayed. Original writing and handwritten images are kept private.</p>'},
};
const t=key=>translations[state.lang][key]||key;
let toastTimer,moveTimer,loadTimer,sourceUpdateTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function loading(active,label='loading'){$('loading-label').textContent=t(label);$('map-loading').classList.toggle('inactive',!active);}
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function cityName(id){const city=CITIES.find(c=>c.id===id);return city?city[state.lang]:t('selected');}

function applyLanguage(){
 document.documentElement.lang=state.lang;
 document.querySelectorAll('[data-i18n]').forEach(e=>{e.innerHTML=t(e.dataset.i18n);});
 $('language-button').textContent=state.lang==='ko'?'EN':'KO';
 $('language-button').setAttribute('aria-label',state.lang==='ko'?'Switch to English':'한국어로 전환');
 $('about-copy').innerHTML=t('aboutCopy');
 $('loading-label').textContent=t('loading');
 document.querySelectorAll('[data-city]').forEach(button=>button.textContent=cityName(button.dataset.city));
 $('demo-label').textContent=state.archive?.synthetic===false?t('liveLabel'):t('demoLabel');
 $('data-status').textContent=state.archive?.synthetic===false?t('liveStatus'):t('demoStatus');
 renderLegend();renderPanel();
}
function renderLegend(){
 const legend=$('theme-legend');legend.replaceChildren();
 for(const theme of THEMES){
  const b=document.createElement('button');b.className='legend-item';b.style.setProperty('--theme-color',theme.color);b.classList.toggle('active',state.theme===theme.id);b.setAttribute('aria-pressed',String(state.theme===theme.id));b.setAttribute('aria-label',`${theme[state.lang]} · ${t('filteredTitle')}`);
  const dot=text('span','','legend-dot');dot.setAttribute('aria-hidden','true');b.append(dot,text('span',theme[state.lang]));b.addEventListener('click',()=>setTheme(theme.id));legend.append(b);
 }
}
function setTheme(id){
 state.theme=state.theme===id?null:id;state.keyword=null;state.selection=null;state.area=null;state.recordIndex=0;updatePointSource();renderLegend();renderPanel();
}
function getBounds(){
 if(!state.mapReady)return null;
 const m=state.map,canvas=m.getCanvas(),mobile=innerWidth<=760;
 const right=mobile?canvas.clientWidth:Math.max(100,canvas.clientWidth-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-width'))-60);
 const bottom=mobile?canvas.clientHeight*.57:canvas.clientHeight-100;
 const corners=[[0,0],[right,0],[right,bottom],[0,bottom]].map(p=>m.unproject(p));
 return [Math.min(...corners.map(p=>p.lng)),Math.min(...corners.map(p=>p.lat)),Math.max(...corners.map(p=>p.lng)),Math.max(...corners.map(p=>p.lat))];
}
function scopedRecords({applyKeyword=true}={}){
 const all=state.archive?.records||[];
 const data=!state.mapReady&&state.city?all.filter(r=>r.city===state.city):all;
 return selectRecords(data,{bounds:state.selection?null:getBounds(),theme:state.theme,keyword:applyKeyword?state.keyword:null,ids:state.selection});
}
function renderPanel(){
 if(!state.archive)return;
 const records=scopedRecords();state.records=records;
 const summary=summarize(records),baseSummary=summarize(scopedRecords({applyKeyword:false}));
 const cityCounts=new Map();for(const r of records)cityCounts.set(r.city,(cityCounts.get(r.city)||0)+1);
 const dominantCity=[...cityCounts].sort((a,b)=>b[1]-a[1])[0]?.[0];
 let heading=state.area||(dominantCity?cityName(dominantCity):(state.city?cityName(state.city):t('world')));
 if(cityCounts.size>1&&!state.selection)heading=t('world');
 $('panel-title').textContent=heading;
 $('area-description').textContent=state.keyword?t('filtered'):(cityCounts.size>1?t('worldNote'):t('areaNote'));
 $('sample-count').textContent=`${summary.total}${t('records')}`;
 $('panel-index').textContent=`${String(Math.max(1,CITIES.findIndex(c=>c.id===dominantCity)+1)).padStart(2,'0')} — 04`;
 $('clear-selection').hidden=!state.selection&&!state.keyword;
 $('detail-count').textContent=String(records.length).padStart(2,'0');
 const ranking=$('theme-ranking');ranking.replaceChildren();
 for(const [i,theme] of summary.themes.slice(0,3).entries()){
  const b=document.createElement('button');b.className='theme-row';b.style.setProperty('--theme-color',theme.color);b.classList.toggle('active',state.theme===theme.id);b.setAttribute('aria-pressed',String(state.theme===theme.id));b.title=state.theme===theme.id?t('resetFilter'):theme[state.lang];
  const head=text('span','','theme-row-head');head.append(text('span',String(i+1).padStart(2,'0'),'theme-number'),text('span',theme[state.lang],'theme-name'));
  const value=text('span','','theme-value');value.append(text('strong',theme.count),document.createTextNode(` / ${summary.total}`));head.append(value);
  const track=text('div','','theme-track'),fill=text('div','','theme-fill');fill.style.width=`${theme.count/summary.total*100}%`;track.append(fill);b.append(head,track);b.addEventListener('click',()=>setTheme(theme.id));ranking.append(b);
 }
 const cloud=$('keyword-cloud');cloud.replaceChildren();
 for(const word of baseSummary.keywords.slice(0,9)){
  const b=text('button','','keyword');b.classList.toggle('active',state.keyword===word.id);b.setAttribute('aria-pressed',String(state.keyword===word.id));b.append(text('span',word[state.lang]),text('span',word.count,'keyword-count'));
  b.addEventListener('click',()=>{state.keyword=state.keyword===word.id?null:word.id;state.recordIndex=0;renderPanel();updateHighlight();if(!$('detail-content').hidden)renderRecord();});cloud.append(b);
 }
 $('empty-state').hidden=summary.total>0;ranking.hidden=!summary.total;cloud.hidden=!summary.total;
 document.querySelector('.keyword-heading').hidden=!summary.total;
 $('detail-toggle').disabled=!summary.total;
 state.recordIndex=summary.total?Math.min(state.recordIndex,summary.total-1):0;
 renderRecord();
}
function renderRecord(){
 const records=state.records,record=records[state.recordIndex];
 $('record-id').textContent=record?.id||'';
 $('record-position').textContent=record?`${String(state.recordIndex+1).padStart(2,'0')} / ${String(records.length).padStart(2,'0')}`:'00 / 00';
 $('previous-record').disabled=records.length<2;$('next-record').disabled=records.length<2;
 const container=$('time-keywords');container.replaceChildren();
 if(!record)return;
 for(const [i,time] of ['past','present','future'].entries()){
  const block=text('div','','time-block');block.style.setProperty('--time-color',['#b6caff','#71dbc4','#ffdc98'][i]);
  const label=text('div','','time-label');label.append(text('span','','time-dot'),document.createTextNode(t(time)));block.append(label);
  for(const keyword of record[time])block.append(text('span',keyword[state.lang],'time-word'));
  container.append(block);
 }
}
function showRecord(direction){
 if(!state.records.length)return;
 state.recordIndex=(state.recordIndex+direction+state.records.length)%state.records.length;renderRecord();updateHighlight();
}
function updateHighlight(){
 if(!state.mapReady)return;
 const record=state.records[state.recordIndex];
 const ids=state.keyword?state.records.map(r=>r.id):(!$('detail-content').hidden&&record?[record.id]:[]);
 state.map.setFilter('selected-points',['in',['get','id'],['literal',ids]]);
}
function clearSelection(){state.selection=null;state.area=null;state.keyword=null;state.recordIndex=0;renderPanel();updateHighlight();}

async function refreshArchive({manual=false,initial=false}={}){
 if(state.refreshing)return;
 state.refreshing=true;$('refresh-data').disabled=true;
 try{
  const res=await fetch('./data/manifest.json',{cache:'no-cache'});if(!res.ok)throw new Error('Manifest unavailable');
  const manifest=await res.json();
  if(manifest.schemaVersion!==1||typeof manifest.version!=='string'||!safeDataPath(manifest.file))throw new Error('Invalid manifest');
  if(state.archive?.version===manifest.version){if(manual)toast(t('noChange'));return;}
  if(!initial)loading(true,'updating');
  const response=await fetch(new URL(manifest.file,location.href));if(!response.ok)throw new Error('Archive unavailable');
  const candidate=validateArchive(await response.json());if(candidate.version!==manifest.version)throw new Error('Version mismatch');
  state.archive=candidate;
  if(state.selection){const valid=new Set(candidate.records.map(r=>r.id));state.selection=new Set([...state.selection].filter(id=>valid.has(id)));if(!state.selection.size){state.selection=null;state.area=null;}}
  updatePointSource();applyLanguage();
  if(!initial)toast(t('updated'));
 }catch(error){
  console.warn('Archive refresh unavailable:',error.message);
  if(!state.archive){$('data-status').textContent=state.lang==='ko'?'공개 데이터를 불러오지 못했습니다. ↻ 버튼으로 다시 시도하세요.':'Could not load the archive. Use ↻ to retry.';toast(t('updateFailed'));}
  else if(manual)toast(t('updateFailed'));
 }finally{state.refreshing=false;$('refresh-data').disabled=false;if(!initial)loading(false);}
}

function nightStyle(style){
 style.name='Latent Homes / Cobalt';
 style.layers=style.layers.filter(l=>l.type!=='symbol'||/^place-(city|town|country|state)/.test(l.id));
 for(const layer of style.layers){
  layer.paint ||= {};
  if(layer.type==='background')layer.paint={'background-color':'#082960'};
  if(layer.type==='fill'){
   const water=/water/.test(layer.id),building=/building/.test(layer.id),park=/park|wood|grass/.test(layer.id);
   layer.paint={'fill-color':water?'#031746':building?'#205496':park?'#0c3980':'#103b7c','fill-opacity':water?1:building?.75:.48};
  }
  if(layer.type==='line'){
   const road=/road|motorway|highway|bridge|tunnel/.test(layer.id),boundary=/boundary/.test(layer.id);
   layer.paint={'line-color':road?'#709fdc':'#547fbd','line-opacity':boundary?.22:road?.52:.35,'line-width':road?['interpolate',['linear'],['zoom'],8,.15,12,.45,16,1.3,19,3.5]:.45};
  }
  if(layer.type==='symbol'){layer.paint={'text-color':'#a1bde4','text-opacity':.38,'text-halo-color':'#0a285f','text-halo-width':1};}
 }
 return style;
}
async function initMap(){
 if(state.map){state.map.remove();state.map=null;}
 state.mapReady=false;state.lastSpireSignature='';$('fallback-notice').hidden=true;loading(true);
 try{
  if(!window.maplibregl)throw new Error('The map library is unavailable');
  const response=await fetch('./vendor/base-style.json');if(!response.ok)throw new Error('Basemap style unavailable');
  const style=nightStyle(await response.json());
  const city=CITIES.find(c=>c.id===state.city)||CITIES[0];
  const mobile=innerWidth<=760;
  const map=new maplibregl.Map({container:'map',style,center:city.center,zoom:city.zoom-(mobile?.65:0),bearing:city.bearing,pitch:city.pitch,antialias:true,maxZoom:18,minZoom:1.3,maxPitch:65,attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{antialias:true},fadeDuration:reducedMotion?0:350});
  state.map=map;
  map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Synthetic archive'}),'bottom-right');
  map.on('load',()=>{
   state.mapReady=true;installLayers();updatePointSource();renderPanel();updateReadout();
   clearTimeout(loadTimer);loading(false);
   map.easeTo({padding:mapPadding(),duration:0});
  });
  let sourceErrors=0;
  map.on('error',event=>{
   console.warn('Map resource unavailable:',event.error?.message?.slice(0,180));
   if(++sourceErrors>=4){$('fallback-notice').hidden=false;loading(false);}
  });
  map.on('movestart',()=>{clearTimeout(moveTimer);clearTimeout(loadTimer);loadTimer=setTimeout(()=>loading(true),400);});
  map.on('moveend',()=>{
   clearTimeout(loadTimer);clearTimeout(moveTimer);moveTimer=setTimeout(()=>{if(!state.selection){renderPanel();}updateSpireSource();updateReadout();loading(false);},230);
  });
  map.on('zoom',updateReadout);
  map.on('idle',()=>{if(state.mapReady){updateSpireSource();clearTimeout(loadTimer);loading(false);}});
  map.on('sourcedata',e=>{if(e.sourceId==='archive'&&e.isSourceLoaded){clearTimeout(sourceUpdateTimer);sourceUpdateTimer=setTimeout(updateSpireSource,50);}});
  map.on('click',onMapClick);
  map.on('mousemove',onMapHover);
  map.on('dragstart',()=>{state.city=null;document.querySelectorAll('.city-button').forEach(b=>b.classList.remove('active'));if(state.selection)clearSelection();});
  loadTimer=setTimeout(()=>{if(!state.mapReady||!map.areTilesLoaded()){$('fallback-notice').hidden=false;loading(false);}},18000);
 }catch(error){console.warn('Map could not start:',error.message);$('fallback-notice').hidden=false;loading(false);renderPanel();}
}
function mapPadding(){return innerWidth<=760?{left:15,right:15,top:100,bottom:Math.round(innerHeight*.34)}:{left:20,right:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-width'))+95,top:80,bottom:90};}
function installLayers(){
 const map=state.map;
 map.setLight({anchor:'viewport',color:'#dbe9ff',intensity:.65,position:[1.5,100,45]});
 map.addLayer({id:'latent-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:12,paint:{'fill-extrusion-color':'#2861ac','fill-extrusion-height':['*',['coalesce',['get','render_height'],['get','height'],5],1.2],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.55,'fill-extrusion-vertical-gradient':true}});
 const props={};for(const theme of THEMES)props[theme.id]=['+',['case',['==',['get','theme'],theme.id],1,0]];
 map.addSource('archive',{type:'geojson',data:pointCollection([]),cluster:true,clusterRadius:48,clusterMaxZoom:15,clusterProperties:props});
 map.addSource('spires',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 const count=['coalesce',['get','point_count'],1];
 const radius=['interpolate',['linear'],count,1,15,6,28,20,50,60,75];
 const color=['case',['has','cluster'],'#ffdf9d',['get','color']];
 map.addLayer({id:'archive-halo-wide',type:'circle',source:'archive',paint:{'circle-radius':['*',radius,1.7],'circle-color':color,'circle-opacity':.07,'circle-blur':.85,'circle-pitch-alignment':'map'}});
 map.addLayer({id:'archive-halo',type:'circle',source:'archive',paint:{'circle-radius':radius,'circle-color':color,'circle-opacity':.22,'circle-blur':.78,'circle-pitch-alignment':'map'}});
 map.addLayer({id:'spires-body',type:'fill-extrusion',source:'spires',paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':.87,'fill-extrusion-vertical-gradient':true}});
 map.addLayer({id:'archive-core',type:'circle',source:'archive',paint:{'circle-radius':['interpolate',['linear'],count,1,3,8,5,40,8],'circle-color':'#fff3d5','circle-opacity':.95,'circle-blur':.2,'circle-pitch-alignment':'map','circle-stroke-color':'#fff2d2','circle-stroke-width':.5}});
 map.addLayer({id:'archive-ring',type:'circle',source:'archive',filter:['has','point_count'],paint:{'circle-radius':['interpolate',['linear'],count,2,12,20,17,70,22],'circle-color':'#061b49','circle-opacity':.17,'circle-stroke-color':'#fff1d5','circle-stroke-opacity':.65,'circle-stroke-width':.7,'circle-pitch-alignment':'map'}});
 map.addLayer({id:'archive-count',type:'symbol',source:'archive',filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count_abbreviated']],'text-font':['Noto Sans Regular'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff4d9','text-halo-color':'#173a67','text-halo-width':2}});
 map.addLayer({id:'selected-points',type:'circle',source:'archive',filter:['in',['get','id'],['literal',[]]],paint:{'circle-radius':11,'circle-color':'#ffffff','circle-opacity':0,'circle-stroke-color':'#ffffff','circle-stroke-width':1.5}});
}
function updatePointSource(){
 if(!state.mapReady)return;
 const records=selectRecords(state.archive?.records||[],{theme:state.theme});
 state.map.getSource('archive').setData(pointCollection(records));state.lastSpireSignature='';
 updateHighlight();
}
function updateSpireSource(){
 if(!state.mapReady||!state.map.getSource('archive')||!state.map.isSourceLoaded('archive'))return;
 const map=state.map,zoom=map.getZoom();
 const features=map.querySourceFeatures('archive');const unique=new Map();
 for(const f of features)unique.set(f.properties.cluster?`c${f.properties.cluster_id}`:`p${f.properties.id}`,f);
 const signature=[state.archive?.version,state.theme,Math.floor(zoom*2),...[...unique.keys()].sort()].join('|');
 if(signature===state.lastSpireSignature)return;
 state.lastSpireSignature=signature;
 const result=[];
 const scale=Math.min(9,Math.max(.2,2**(13-zoom)));
 for(const [key,f] of unique){
  const count=Number(f.properties.point_count)||1,color=f.properties.cluster?'#ffe4a5':f.properties.color;
  const center=f.geometry.coordinates;
  const quantity=Math.min(22,Math.max(1,Math.round(Math.sqrt(count)*2)));
  let seed=[...key].reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0)|0,1)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<quantity;i++){
   const angle=rand()*Math.PI*2,dist=i?Math.sqrt(rand())*42*scale:0;
   const point=[center[0]+Math.cos(angle)*dist/(111320*Math.cos(center[1]*Math.PI/180)),center[1]+Math.sin(angle)*dist/111320];
   const height=(i?35+rand()*110:90+Math.sqrt(count)*22)*scale;
   result.push({type:'Feature',geometry:makeSpire(point,height,(i?2+rand()*3:5)*scale),properties:{height,color}});
  }
 }
 map.getSource('spires').setData({type:'FeatureCollection',features:result});
}
function hitFeatures(point){if(!state.mapReady)return [];return state.map.queryRenderedFeatures(point,{layers:['archive-core','archive-ring','archive-halo']});}
async function onMapClick(event){
 const feature=hitFeatures(event.point)[0];if(!feature)return;
 state.keyword=null;state.recordIndex=0;
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
  state.selection=new Set([feature.properties.id]);const record=state.archive.records.find(r=>r.id===feature.properties.id);state.area=record?.area||t('selected');renderPanel();openDetails(true);updateHighlight();
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
 const wrapper=document.createElement('div');wrapper.append(text('div',`${count}${t('records')}`,'map-tooltip-title'),text('div',state.lang==='ko'?'선택해 공통점 살펴보기':'Select to explore shared themes','map-tooltip-subtitle'));
 popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:19}).setLngLat(feature.geometry.coordinates).setDOMContent(wrapper).addTo(state.map);popup.nysKey=key;
}
function updateReadout(){
 if(!state.map)return;
 const {lng,lat}=state.map.getCenter();$('coordinates').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'} · ${Math.abs(lng).toFixed(3)}° ${lng>=0?'E':'W'}`;$('zoom-readout').textContent=state.map.getZoom().toFixed(1);
}
function goToCity(id){
 const city=CITIES.find(c=>c.id===id);if(!city)return;
 state.city=id;state.selection=null;state.area=null;state.keyword=null;state.recordIndex=0;
 document.querySelectorAll('.city-button').forEach(b=>b.classList.toggle('active',b.dataset.city===id));
 if(state.mapReady)state.map.flyTo({center:city.center,zoom:city.zoom-(innerWidth<=760?.65:0),bearing:city.bearing,pitch:city.pitch,padding:mapPadding(),duration:reducedMotion?0:1900,essential:!reducedMotion});
 else renderPanel();
}
function openDetails(open){
 $('detail-toggle').setAttribute('aria-expanded',String(open));$('detail-content').hidden=!open;renderRecord();updateHighlight();
 if(open&&innerWidth<=760)$('detail-content').scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'nearest'});
}
function setupEvents(){
 $('language-button').addEventListener('click',()=>{state.lang=state.lang==='ko'?'en':'ko';localStorage.setItem('nys-language',state.lang);applyLanguage();});
 $('about-button').addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());
 $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
 document.querySelectorAll('[data-city]').forEach(b=>b.addEventListener('click',()=>goToCity(b.dataset.city)));
 $('world-button').addEventListener('click',()=>{state.city=null;clearSelection();document.querySelectorAll('.city-button').forEach(b=>b.classList.toggle('active',b.id==='world-button'));if(state.mapReady)state.map.flyTo({center:[32,40],zoom:1.8,pitch:0,bearing:0,duration:reducedMotion?0:2200,padding:mapPadding()});});
 $('zoom-in').addEventListener('click',()=>state.map?.zoomIn({duration:reducedMotion?0:500}));$('zoom-out').addEventListener('click',()=>state.map?.zoomOut({duration:reducedMotion?0:500}));$('reset-bearing').addEventListener('click',()=>state.map?.easeTo({bearing:0,pitch:0,duration:reducedMotion?0:800}));
 $('clear-selection').addEventListener('click',clearSelection);$('empty-reset').addEventListener('click',()=>goToCity('london'));
 $('detail-toggle').addEventListener('click',()=>openDetails($('detail-content').hidden));
 $('previous-record').addEventListener('click',()=>showRecord(-1));$('next-record').addEventListener('click',()=>showRecord(1));
 $('refresh-data').addEventListener('click',()=>refreshArchive({manual:true}));$('retry-map').addEventListener('click',()=>{toast(t('mapRetry'));initMap();});
 window.addEventListener('resize',()=>{state.map?.resize();if(state.mapReady){state.map.easeTo({padding:mapPadding(),duration:0});renderPanel();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshArchive();});
 setInterval(()=>{if(!document.hidden)refreshArchive();},30000);
 // Explicit, one-way navigation from an embedded exhibition display. No upload or credentials in the browser.
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='nys:navigate')return;
  const {city,unitId}=event.data;if(city)goToCity(city);
  const record=state.archive?.records.find(r=>r.id===unitId);
  if(record&&state.mapReady){state.selection=new Set([record.id]);state.area=record.area;state.keyword=null;state.map.flyTo({center:record.position,zoom:15.5,padding:mapPadding(),duration:reducedMotion?0:1500});renderPanel();openDetails(true);}
 });
}
setupEvents();applyLanguage();
await refreshArchive({initial:true});
await initMap();
