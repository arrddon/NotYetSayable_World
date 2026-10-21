import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGraphics,GRAPHICS_PRESETS} from '../dist/graphics.mjs';

test('untrusted saved graphics settings cannot escape GPU/camera limits or add archive controls',()=>{
 const candidate={pillarDensity:999,particleDensity:999,cameraElevation:-100,bloomStrength:Infinity,cyan:'1',grain:NaN,clusterRadius:999,records:[]};
 const settings=normalizeGraphics(candidate);
 assert.equal(settings.pillarDensity,2);assert.equal(settings.particleDensity,1.5);assert.equal(settings.cameraElevation,25);
 assert.equal(settings.bloomStrength,GRAPHICS_PRESETS.emphasis.bloomStrength);assert.equal(settings.cyan,GRAPHICS_PRESETS.emphasis.cyan);assert.equal(settings.grain,GRAPHICS_PRESETS.emphasis.grain);
 assert.equal('clusterRadius' in settings,false);assert.equal('records' in settings,false);
 assert.equal(candidate.pillarDensity,999);
 assert.deepEqual(normalizeGraphics(null),GRAPHICS_PRESETS.emphasis);
});
