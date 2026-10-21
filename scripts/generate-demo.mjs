import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const words={
 connection:[['shared-table','함께하는 식탁','a shared table'],['old-friends','오랜 친구','old friends'],['being-heard','이야기를 들어주는 곳','being heard'],['open-door','열린 문','an open door'],['close-by','가까이 머물기','staying close']],
 stability:[['a-place-to-stay','머물 수 있는 곳','a place to stay'],['own-room','나만의 방','a room of my own'],['belongings','짐을 풀 수 있는 곳','unpacking'],['familiar-routine','익숙한 일상','familiar routines'],['rooted','뿌리내리기','putting down roots']],
 freedom:[['open-space','열린 공간','open space'],['room-to-breathe','숨 쉴 여유','room to breathe'],['own-rhythm','나의 속도','my own rhythm'],['daylight','햇빛','daylight'],['quiet-corner','조용한 구석','a quiet corner']],
 care:[['warmth','온기','warmth'],['being-safe','안심할 수 있는 곳','feeling safe'],['small-rituals','작은 의식들','small rituals'],['looking-after','서로 돌보기','looking after each other'],['rest','쉴 수 있는 곳','a place to rest']],
 creativity:[['making-things','무언가 만드는 곳','making things'],['possibilities','새로운 가능성','new possibilities'],['changing-room','바꿀 수 있는 공간','a room that can change'],['play','놀이','play'],['a-small-garden','작은 정원','a small garden']],
 community:[['neighbours','이웃','neighbours'],['shared-garden','함께 가꾸는 정원','a shared garden'],['local-streets','익숙한 골목','familiar streets'],['meeting-place','만나는 장소','a place to meet'],['belonging','소속감','belonging']],
};
const memories=[['kitchen-light','부엌의 불빛','the kitchen light'],['family-table','가족의 식탁','the family table'],['window-seat','창가의 자리','a window seat'],['summer-evenings','여름 저녁','summer evenings'],['familiar-sounds','익숙한 소리','familiar sounds'],['a-small-room','작은 방','a small room']];
const present=[['temporary','잠시 머무는 곳','somewhere temporary'],['moving-boxes','이삿짐 상자','moving boxes'],['shared-space','나누어 쓰는 공간','sharing a space'],['new-routines','새로운 일상','new routines'],['distance','멀리 떨어져 있음','being far away'],['small-comforts','작은 위안','small comforts']];
const groups=[
 ['london','Shoreditch',[-.078,51.525],22,'connection'],['london','Hackney',[-.059,51.54],16,'community'],['london','South Bank',[-.113,51.501],24,'connection'],['london','Bermondsey',[-.075,51.495],19,'care'],['london','Bloomsbury',[-.128,51.522],18,'stability'],['london','Greenwich',[-.005,51.483],14,'freedom'],['london','Peckham',[-.067,51.473],16,'creativity'],['london','Islington',[-.103,51.542],15,'community'],
 ['seoul','연남 · Yeonnam',[126.923,37.563],14,'creativity'],['seoul','한남 · Hannam',[127.002,37.536],12,'connection'],['seoul','서촌 · Seochon',[126.969,37.58],15,'stability'],['seoul','성수 · Seongsu',[127.047,37.543],13,'freedom'],
 ['new-york','East Village',[-73.984,40.727],13,'community'],['new-york','West Village',[-74.003,40.734],15,'connection'],['new-york','Williamsburg',[-73.96,40.715],12,'creativity'],['new-york','Chelsea',[-74.001,40.746],13,'care'],
 ['paris','Le Marais',[2.361,48.858],14,'connection'],['paris','Canal Saint-Martin',[2.365,48.872],12,'freedom'],['paris','Quartier Latin',[2.349,48.847],12,'stability'],['paris','Belleville',[2.382,48.873],13,'community'],
];
let s=72861;const random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
const kw=w=>({id:w[0],ko:w[1],en:w[2]});
const themes=Object.keys(words);let n=0;const records=[];
for(const [city,area,center,count,dominant] of groups){
 for(let i=0;i<count;i++){
  const theme=random()<.62?dominant:themes[Math.floor(random()*themes.length)];
  const vocabulary=words[theme];const second=themes[Math.floor(random()*themes.length)];
  records.push({id:`LH-DEMO-${String(++n).padStart(4,'0')}`,city,area,position:[+(center[0]+(random()-.5)*.012).toFixed(6),+(center[1]+(random()-.5)*.006).toFixed(6)],theme,
   past:[kw(memories[i%memories.length]),kw(vocabulary[i%vocabulary.length])],
   present:[kw(present[(i+2)%present.length]),kw(vocabulary[(i+2)%vocabulary.length])],
   future:[kw(vocabulary[0]),kw(vocabulary[(i+1)%vocabulary.length]),kw(words[second][(i+3)%words[second].length])],
  });
 }
}
const version='demo-20261021-01';
const dataset={schemaVersion:1,version,updatedAt:'2026-10-21T12:00:00.000Z',synthetic:true,locationMeaning:'desired-future-home',records};
await mkdir(resolve(root,'dist/data'),{recursive:true});
await writeFile(resolve(root,`dist/data/archive.${version}.json`),JSON.stringify(dataset));
await writeFile(resolve(root,'dist/data/manifest.json'),JSON.stringify({schemaVersion:1,version,file:`data/archive.${version}.json`,updatedAt:dataset.updatedAt,synthetic:true},null,2));
console.log(`Generated ${records.length} synthetic records in ${groups.length} neighbourhoods. No participant data included.`);
