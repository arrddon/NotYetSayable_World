import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGraphics,GRAPHICS_DEFAULTS} from '../dist/graphics.mjs';
import {referenceCamera} from '../dist/camera.mjs';
import {mapPixelRatio,MAX_MAP_PIXELS,animationFrameGate} from '../dist/rendering.mjs';
import {CITIES} from '../dist/core.mjs';

test('untrusted saved graphics settings cannot escape GPU/camera limits or add archive controls',()=>{
 const candidate={pillarDensity:999,particleDensity:999,cameraElevation:-100,cameraFov:999,bloomStrength:Infinity,cyan:'1',grain:NaN,clusterRadius:999,records:[]};
 const settings=normalizeGraphics(candidate);
 assert.equal(settings.pillarDensity,2);assert.equal(settings.particleDensity,1.5);
 assert.equal('cameraElevation' in settings,false);assert.equal('cameraFov' in settings,false);
 assert.equal(settings.bloomStrength,GRAPHICS_DEFAULTS.bloomStrength);assert.equal(settings.cyan,GRAPHICS_DEFAULTS.cyan);assert.equal(settings.grain,GRAPHICS_DEFAULTS.grain);
 assert.equal('clusterRadius' in settings,false);assert.equal('records' in settings,false);
 assert.equal(candidate.pillarDensity,999);
 assert.deepEqual(normalizeGraphics(null),GRAPHICS_DEFAULTS);
});

test('4K map rendering fits the QHD pixel budget without shrinking DOM or small displays',()=>{
 for(const [width,height,dpr] of [[3840,2160,1],[3840,2160,2],[7680,4320,1],[1920,1080,2],[1024,768,2],[390,844,3]]){
  const ratio=mapPixelRatio(width,height,dpr);
  assert.ok(width*height*ratio*ratio<=MAX_MAP_PIXELS+1);
  assert.ok(ratio>0&&ratio<=1.25&&ratio<=dpr);
 }
 assert.equal(mapPixelRatio(3840,2160,1),2/3);
 assert.equal(mapPixelRatio(1920,1080,1),1);
 assert.equal(mapPixelRatio(1024,768,2),1.25);
 assert.ok(CITIES.every(city=>city.bearing===0));
});

test('30fps animation follows 60/120Hz display frames and skips hidden, moving, or delayed work',()=>{
 for(const hz of [60,120]){
  const due=animationFrameGate();let draws=0;
  for(let frame=0;frame<hz*2;frame++)if(due(frame*1000/hz))draws++;
  assert.equal(draws,60);
 }
 const due=animationFrameGate();assert.equal(due(0),true);assert.equal(due(1),false);
 assert.equal(due(1000,false),false);assert.equal(due(2000),true);assert.equal(due(2001),false);
 assert.equal(due(5000),true);assert.equal(due(5001),false);
});

test('automatic reference camera keeps perspective framing within overview and close-up bounds',()=>{
 for(const mobile of [false,true])for(const zoom of [1.3,4.9,13.3,18]){
  const camera=referenceCamera(zoom,mobile);
  assert.ok(camera.pitch>=30&&camera.pitch<=52);assert.ok(camera.fov>=48&&camera.fov<=50);
 }
 assert.ok(referenceCamera(1.3).pitch<referenceCamera(13.3).pitch);
 assert.equal(referenceCamera(13.3).pitch,52);
 assert.equal(referenceCamera(18).pitch,40);
 assert.ok(referenceCamera(16).pitch>referenceCamera(18).pitch);
});
