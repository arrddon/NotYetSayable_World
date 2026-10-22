import test from 'node:test';
import assert from 'node:assert/strict';
import {roadParticles,formationParticles,packParticles,PARTICLE_LIMITS,INDICATOR_TILT} from '../dist/landscape.mjs';
import {createBasemapStyle} from '../dist/basemap.mjs';
import {cylinderMesh,indicatorAxis,indicatorParticleCount} from '../dist/indicators.mjs';

const line={type:'Feature',properties:{class:'residential'},geometry:{type:'LineString',coordinates:[[-.11,51.51],[-.1,51.512],[-.09,51.51]]}};
const mapFor=features=>({
 getCenter:()=>({lng:-.1,lat:51.51}),getZoom:()=>16,
 getBounds:()=>({contains:([lng,lat])=>lng>-.2&&lng<0&&lat>51.4&&lat<51.6}),
 querySourceFeatures:(source,{sourceLayer})=>{assert.equal(source,'openmaptiles');assert.equal(sourceLayer,'transportation');return features;},
});
const cluster=(id,count=30)=>({type:'Feature',geometry:{type:'Point',coordinates:[-.1,51.51]},properties:{cluster:true,cluster_id:id,point_count:count}});

test('road particles use transportation only, ignore duplicate roads and ferries, and stay near ground',()=>{
 const ferry={...line,properties:{class:'ferry'}};
 const expected=roadParticles(mapFor([line]));
 assert.ok(expected.length>50);
 assert.deepEqual(roadParticles(mapFor([line,line,ferry])),expected);
 assert.ok(expected.every(p=>p.height>=0&&p.height<=5&&p.position.every(Number.isFinite)));
});

test('particle generation respects independent desktop/mobile GPU budgets',()=>{
 const features=Array.from({length:40},(_,i)=>cluster(i,300));
 for(const mobile of [false,true]){
  const {field,indicators,relief}=formationParticles(features,{mobile,fieldDensity:2,pillarDensity:2,pillarHeight:2.8});
  const limits=PARTICLE_LIMITS[mobile?'mobile':'desktop'];
  assert.ok(field.length>0&&field.length<=limits.field);
  assert.ok(indicators.length>0&&indicators.length<=limits.indicators);
  assert.ok(relief.length/9<=(mobile?24000:90000));assert.ok(relief.every(Number.isFinite));
  for(const p of field)assert.ok([...p.position,p.height,...p.color,p.alpha,p.size].every(Number.isFinite));
  for(const p of indicators)assert.ok([...p.position,p.height,p.width,p.reach,p.tilt].every(Number.isFinite));
 }
 const roads=Array.from({length:100},(_,i)=>({...line,geometry:{type:'LineString',coordinates:[[-.18,51.45+i*.001],[-.02,51.45+i*.001]]}}));
 assert.ok(roadParticles(mapFor(roads),{mobile:true,density:1.5}).length<=16000);
});

test('lower particle budgets still give every visible formation a continuous surface and texture',()=>{
 const features=Array.from({length:40},(_,id)=>({...cluster(id,300),geometry:{type:'Point',coordinates:[id,51]}}));
 const {field,areas}=formationParticles(features,{mobile:true,fieldDensity:2,pillarDensity:2});
 assert.equal(new Set(field.map(p=>Math.round(p.position[0]))).size,40);
 assert.equal(areas.features.filter(p=>p.properties.kind==='area').length,40);
 for(const feature of areas.features){
  const ring=feature.geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));
  assert.ok(ring.length>=4&&ring.every(p=>p.every(Number.isFinite)));
 }
});

test('packed particles retain known Web Mercator positions, altitude, and appearance',()=>{
 const packed=packParticles([{position:[0,0],height:100,color:[1,.5,.25],alpha:.8,size:2},{position:[90,66.51326044311186],color:[0,0,1]}]);
 assert.equal(packed.length,16);assert.equal(packed[0],.5);assert.equal(packed[1],.5);
 assert.ok(Math.abs(packed[2]-100/40075016.686)<1e-11);
 assert.equal(packed[3],1);assert.equal(packed[4],.5);assert.equal(packed[7],2);
 assert.equal(packed[8],.75);assert.ok(Math.abs(packed[9]-.25)<1e-7);
});

test('the lightweight basemap includes flat roads and water without text or buildings',()=>{
 const style=createBasemapStyle();
 assert.deepEqual(Object.keys(style.sources),['openmaptiles']);
 assert.ok(style.layers.some(layer=>layer['source-layer']==='water'));
 assert.ok(style.layers.some(layer=>layer['source-layer']==='transportation'&&layer.paint['line-opacity']>0));
 assert.ok(style.layers.every(layer=>['background','fill','line'].includes(layer.type)&&layer['source-layer']!=='building'));
 assert.equal(style.glyphs,undefined);assert.equal(style.sprite,undefined);
});

test('surface density does not move metallic indicators, alter boundaries, or change source records',()=>{
 const features=[cluster(7)],original=structuredClone(features);
 const sparse=formationParticles(features,{fieldDensity:.5}),dense=formationParticles(features,{fieldDensity:1.5});
 assert.ok(dense.field.length>sparse.field.length);
 assert.deepEqual(dense.indicators,sparse.indicators);
 assert.deepEqual(dense.areas,sparse.areas);
 assert.deepEqual(formationParticles([features[0],features[0]],{fieldDensity:.5}),sparse);
 assert.deepEqual(features,original);
});

test('full density covers small clusters and prioritises large columns; invalid coordinates never make geometry',()=>{
 const features=Array.from({length:12},(_,id)=>({...cluster(id,id+1),geometry:{type:'Point',coordinates:[id,51]}}));
 features.push({...cluster(90,999),geometry:{type:'Point',coordinates:[NaN,51]}});
 const result=formationParticles(features,{mobile:true,pillarDensity:2});
 assert.deepEqual(result.indicators.map(p=>p.position[0]),[11,10,9,8,7,6,5,4,3,2,1,0]);
 assert.ok(result.indicators[2].width>result.indicators[3].width);
 assert.equal(result.areas.features.filter(p=>p.properties.kind==='area').length,12);
 assert.ok(result.field.every(p=>p.color[2]>=p.color[1]&&p.color[1]>=p.color[0]));
});

test('broad indicators share a gentle rightward lean, start below terrain, and remain at overview zoom',()=>{
 const features=Array.from({length:20},(_,id)=>cluster(id,id*5));
 const {indicators}=formationParticles(features,{mobile:true});
 assert.ok(indicators.length>3&&indicators.length<=20);
 assert.ok(indicators.every(p=>p.tilt===INDICATOR_TILT&&p.tilt>0&&p.width<=39&&p.reach>1&&p.height<0));
 const overview=formationParticles(features,{zoom:2});
 assert.ok(overview.indicators.length>0&&overview.indicators.every(p=>p.width>0&&p.reach>0));
});

test('near-complete point coverage retains a bounded total particle load as the number of pillars grows',()=>{
 const points=Array.from({length:196},(_,id)=>({type:'Feature',geometry:{type:'Point',coordinates:[id%170,40]},properties:{id:'unit-'+id}}));
 const all=formationParticles(points,{pillarDensity:2,pillarHeight:2.8,fieldDensity:.4});
 assert.equal(all.indicators.length,196);
 assert.ok(all.indicators[0].reach>3.3);assert.ok(all.indicators[6].reach>2.7);
 assert.equal(formationParticles(points,{pillarDensity:.4,fieldDensity:.4}).indicators.length,40);
 const mobile=formationParticles(points,{mobile:true,pillarDensity:2,fieldDensity:.4});assert.equal(mobile.indicators.length,160);
 for(const narrow of [false,true])for(const count of [0,1,3,6,40,160,256]){
  const perPillar=indicatorParticleCount(count,narrow);
  assert.ok(perPillar>=0&&perPillar*count<=(narrow?1950:8400));
 }
});

test('columns have actual circular 3D walls and closed ends with valid surface normals',()=>{
 const mesh=cylinderMesh();let wall=0,lower=0,upper=0;
 for(let i=0;i<mesh.length;i+=6){
  const [x,y,z,nx,ny,nz]=mesh.subarray(i,i+6);
  assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-6);assert.ok(z===0||z===1);
  if(nz===0){assert.ok(Math.abs(Math.hypot(x,y)-1)<1e-6);wall++;}
  else if(nz<0){assert.equal(z,0);lower++;}else{assert.equal(z,1);upper++;}
 }
 assert.ok(wall>0&&lower>0&&upper>0);
 const axis=indicatorAxis([1,0,0,0,0,-1,0,0,0,1,1,0,0,0,0,1],1000,800);
 assert.ok(axis.every(Number.isFinite)&&axis[0]>0&&axis[2]===1);
});
