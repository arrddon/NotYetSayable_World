export const THEMES = [
  {id:'connection',en:'Connection',ko:'연결',color:'#ffdc98'},
  {id:'stability',en:'Stability',ko:'안정',color:'#5bafff'},
  {id:'freedom',en:'Freedom',ko:'자유',color:'#71dbc4'},
  {id:'care',en:'Care',ko:'돌봄',color:'#f29bb7'},
  {id:'creativity',en:'Creativity',ko:'창의',color:'#b29bff'},
  {id:'community',en:'Community',ko:'공동체',color:'#b6caff'},
];
export const CITIES = [
  {id:'london',en:'London',ko:'런던',center:[-.096,51.508],zoom:12.8,bearing:-24,pitch:51},
  {id:'seoul',en:'Seoul',ko:'서울',center:[126.975,37.555],zoom:12.2,bearing:-22,pitch:49},
  {id:'new-york',en:'New York',ko:'뉴욕',center:[-73.992,40.731],zoom:12.7,bearing:28,pitch:51},
  {id:'paris',en:'Paris',ko:'파리',center:[2.35,48.855],zoom:12.7,bearing:-20,pitch:51},
];
const themeIds=new Set(THEMES.map(t=>t.id));
export function validateArchive(data){
  if(!data||data.schemaVersion!==1||typeof data.version!=='string'||!data.version||!Array.isArray(data.records))throw new Error('Unsupported archive format');
  const ids=new Set();
  for(const r of data.records){
    if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id))throw new Error('Invalid or duplicate record ID');
    ids.add(r.id);
    if(!Array.isArray(r.position)||r.position.length!==2||!r.position.every(Number.isFinite)||Math.abs(r.position[0])>180||Math.abs(r.position[1])>85.051129)throw new Error('Invalid future-home coordinates');
    if(!themeIds.has(r.theme))throw new Error('Unknown theme');
    for(const time of ['past','present','future']){
      if(!Array.isArray(r[time])||!r[time].length||r[time].some(k=>!k||typeof k.id!=='string'||typeof k.ko!=='string'||typeof k.en!=='string'))throw new Error('Invalid interpreted keywords');
    }
  }
  return data;
}
export function inBounds(position,bounds){
  if(!bounds)return true;
  const [lng,lat]=position,[west,south,east,north]=bounds;
  if(lat<south||lat>north)return false;
  if(east-west>=360)return true;
  const norm=n=>((n+180)%360+360)%360-180;
  const w=norm(west),e=norm(east),l=norm(lng);
  return w>e?l>=w||l<=e:l>=w&&l<=e;
}
export function selectRecords(records,{bounds,theme=null,keyword=null,ids=null}={}){
  const seen=new Set();
  return records.filter(r=>{
    if(seen.has(r.id)||!inBounds(r.position,bounds)||(theme&&r.theme!==theme)||(ids&&!ids.has(r.id)))return false;
    if(keyword&&!['past','present','future'].some(t=>r[t].some(k=>k.id===keyword)))return false;
    seen.add(r.id);return true;
  });
}
export function summarize(records){
  const unique=[...new Map(records.map(r=>[r.id,r])).values()];
  const themes=new Map(THEMES.map(t=>[t.id,{...t,count:0}]));
  const keywords=new Map();
  for(const r of unique){
    if(themes.has(r.theme))themes.get(r.theme).count++;
    const seen=new Set();
    for(const time of ['past','present','future'])for(const k of r[time]){
      if(seen.has(k.id))continue;
      seen.add(k.id);
      if(!keywords.has(k.id))keywords.set(k.id,{...k,count:0});
      keywords.get(k.id).count++;
    }
  }
  return {total:unique.length,themes:[...themes.values()].filter(t=>t.count).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id)),keywords:[...keywords.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id))};
}
export function pointCollection(records){
  return {type:'FeatureCollection',features:records.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.position},properties:{id:r.id,theme:r.theme,color:THEMES.find(t=>t.id===r.theme)?.color||'#ffdc98'}}))};
}
export function makeSpire(position,height,radius=18){
  const [lng,lat]=position,dx=radius/(111320*Math.cos(lat*Math.PI/180)),dy=radius/111320;
  return {type:'Polygon',coordinates:[[[lng-dx,lat-dy],[lng+dx,lat-dy],[lng+dx,lat+dy],[lng-dx,lat+dy],[lng-dx,lat-dy]]]};
}
export function safeDataPath(file){
  return typeof file==='string'&&/^data\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(file)&&!file.includes('..');
}
