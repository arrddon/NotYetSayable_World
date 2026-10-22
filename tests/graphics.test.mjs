import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGraphics,GRAPHICS_DEFAULTS} from '../dist/graphics.mjs';
import {referenceCamera} from '../dist/camera.mjs';

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
