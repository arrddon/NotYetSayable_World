import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateArchive,inBounds,selectRecords,summarize,safeDataPath} from '../dist/core.mjs';
const word={id:'table',en:'a shared table',ko:'함께하는 식탁'};
const record=(id,theme='connection')=>({id,theme,position:[0,51],past:[word],present:[word],future:[word]});
test('one participant is counted once across past, present, and future',()=>{
 const r=record('a'),result=summarize([r,r,record('b','care')]);
 assert.equal(result.total,2);assert.equal(result.keywords[0].count,2);assert.equal(result.themes[0].count,1);
});
test('common themes are ordered by participant support, not model confidence',()=>{
 const result=summarize([record('a'),record('b'),{...record('c','care'),confidence:1}]);
 assert.equal(result.themes[0].id,'connection');assert.equal(result.themes[0].count,2);
});
test('viewport handles a wrapped antimeridian and excludes other points',()=>{
 assert.equal(inBounds([179,10],[170,-20,-170,30]),true);
 assert.equal(inBounds([-179,10],[170,-20,190,30]),true);
 assert.equal(inBounds([0,10],[170,-20,-170,30]),false);
 assert.equal(inBounds([0,10],[-200,-90,200,90]),true);
});
test('theme, keyword, selected IDs and viewport constraints work together',()=>{
 const records=[record('a'),{...record('b'),position:[1,52]},record('c','care')];
 const selected=selectRecords(records,{bounds:[-.5,50,.5,51.5],theme:'connection',keyword:'table',ids:new Set(['a','b'])});
 assert.deepEqual(selected.map(r=>r.id),['a']);
});
test('archive validation rejects duplicates, invalid coordinates, or missing temporal keywords',()=>{
 const data={schemaVersion:1,version:'one',records:[record('a')]};
 assert.equal(validateArchive(data),data);
 assert.throws(()=>validateArchive({...data,records:[record('a'),record('a')]}),/duplicate/);
 assert.throws(()=>validateArchive({...data,records:[{...record('a'),position:[181,40]}]}),/coordinates/);
 assert.throws(()=>validateArchive({...data,records:[{...record('a'),future:[]}]}),/keywords/);
});
test('manifest file paths cannot navigate outside the public data directory',()=>{
 assert.equal(safeDataPath('data/archive.demo-01.json'),true);
 for(const path of ['https://elsewhere.test/data.json','../data/private.json','data/../private.json','data/sub/file.json','data/a..json'])assert.equal(safeDataPath(path),false);
});
test('generated demo is explicitly synthetic, valid, and contains no participant originals',async()=>{
 const archive=JSON.parse(await readFile(new URL('../dist/data/archive.demo-20261021-01.json',import.meta.url)));
 validateArchive(archive);assert.equal(archive.synthetic,true);
 assert.equal(archive.locationMeaning,'desired-future-home');assert.equal(archive.records.length,302);
 const encoded=JSON.stringify(archive);for(const name of ['raw_response','translated_response','image_path','service_role'])assert.equal(encoded.includes(name),false);
});

test('the active published manifest points to a valid archive with matching version and explicit provenance',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../dist/data/manifest.json',import.meta.url)));
 assert.equal(safeDataPath(manifest.file),true);
 const archive=JSON.parse(await readFile(new URL('../dist/'+manifest.file,import.meta.url)));
 validateArchive(archive);assert.equal(archive.version,manifest.version);
 assert.equal(archive.synthetic,manifest.synthetic);assert.equal(typeof archive.synthetic,'boolean');
 const recordFields=new Set(['id','position','theme','city','area','past','present','future']);
 for(const record of archive.records){
  assert.ok(Object.keys(record).every(key=>recordFields.has(key)));
  for(const time of ['past','present','future'])for(const word of record[time])assert.deepEqual(Object.keys(word).sort(),['en','id','ko']);
 }
});
