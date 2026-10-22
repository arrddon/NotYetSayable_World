import {GRAPHICS_PARAMETERS,GRAPHICS_DEFAULTS,normalizeGraphics,formatGraphicsValue} from './graphics.mjs';
// Start the revised exhibition look from its new baseline, then retain adjustments.
const storageKey='nys-graphics-v2';
export function loadGraphics(){try{return normalizeGraphics(JSON.parse(localStorage.getItem(storageKey)));}catch{return normalizeGraphics();}}
export function setupGraphicsPanel({settings,onChange,lang}){
 const panel=document.getElementById('graphics-panel'),toggle=document.getElementById('graphics-toggle'),controls=document.getElementById('graphics-controls'),rows=new Map();
 const words={ko:{title:'풍경의 그래픽',toggle:'그래픽 조절',close:'그래픽 조절 닫기',note:'설정은 이 브라우저에 저장됩니다. 기둥과 입자 밀도를 높이면 기기 부담이 커집니다.',meaning:'기둥과 빛은 그래픽 표현입니다. 참여자 수·군집 기준·주제 순위는 바뀌지 않습니다.',reset:'기본값으로',copy:'값 복사',copied:'복사됨'},en:{title:'Shape the landscape',toggle:'Graphics',close:'Close graphics controls',note:'Saved in this browser. Higher pillar and particle density asks more of your device.',meaning:'Pillars and light are visual expressions. Participant counts, clustering, and theme rankings stay the same.',reset:'Reset',copy:'Copy values',copied:'Copied'}};
 let language=lang,copyTimer;
 words.ko.meaning='그래픽 표현을 조절합니다. 원본 데이터와 군집·주제 순위의 집계 기준은 바뀌지 않습니다.';
 words.en.meaning='These controls change the appearance. Archive records and clustering/ranking rules stay the same.';
 words.en.toggle='[graphics]';
 words.en.note='Saved in this browser. Higher texture density asks more of your device.';
 const getWord=key=>words[language][key];
 function sync(){
  for(const p of GRAPHICS_PARAMETERS){const row=rows.get(p.key);row.input.value=settings[p.key];row.output.value=formatGraphicsValue(p,settings[p.key]);row.input.setAttribute('aria-valuetext',row.output.value);}
  document.getElementById('graphics-values').value=JSON.stringify(settings,null,2);
 }
 function apply(candidate){
  const next=normalizeGraphics(candidate),changed=GRAPHICS_PARAMETERS.filter(p=>settings[p.key]!==next[p.key]).map(p=>p.key);
  Object.assign(settings,next);sync();try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}
  onChange(changed);
 }
 function open(value){
  panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));document.getElementById('atlas').classList.toggle('graphics-open',value);
  if(value)document.getElementById('close-graphics').focus();else toggle.focus();
 }
 for(const parameter of GRAPHICS_PARAMETERS){
  const row=document.createElement('div');row.className='graphics-row';
  const header=document.createElement('div');header.className='graphics-row-header';
  const label=document.createElement('label');label.htmlFor=`graphics-${parameter.key}`;
  const output=document.createElement('output');output.setAttribute('for',`graphics-${parameter.key}`);
  const input=document.createElement('input');Object.assign(input,{id:`graphics-${parameter.key}`,type:'range',min:parameter.min,max:parameter.max,step:parameter.step});
  const hint=document.createElement('small');hint.id=`graphics-hint-${parameter.key}`;input.setAttribute('aria-describedby',hint.id);
  header.append(label,output);row.append(header,input,hint);controls.append(row);rows.set(parameter.key,{label,output,input,hint});
  input.addEventListener('input',()=>apply({...settings,[parameter.key]:Number(input.value)}));
 }
 toggle.addEventListener('click',()=>open(panel.hidden));document.getElementById('close-graphics').addEventListener('click',()=>open(false));
 document.getElementById('graphics-reset').addEventListener('click',()=>apply(GRAPHICS_DEFAULTS));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)open(false);});
 document.getElementById('graphics-copy').addEventListener('click',async()=>{
  const values=document.getElementById('graphics-values');
  try{await navigator.clipboard.writeText(JSON.stringify(settings,null,2));const button=document.getElementById('graphics-copy');button.textContent=getWord('copied');clearTimeout(copyTimer);copyTimer=setTimeout(()=>button.textContent=getWord('copy'),1800);}
  catch{values.hidden=false;values.focus();values.select();}
 });
 function setLanguage(next){language=next;for(const parameter of GRAPHICS_PARAMETERS){const row=rows.get(parameter.key);row.label.textContent=parameter[language];row.hint.textContent=parameter[language==='ko'?'hintKo':'hintEn'];}
  toggle.textContent=getWord('toggle');document.getElementById('graphics-title').textContent=getWord('title');document.getElementById('graphics-note').textContent=getWord('note');document.getElementById('graphics-meaning').textContent=getWord('meaning');document.getElementById('graphics-reset').textContent=getWord('reset');document.getElementById('graphics-copy').textContent=getWord('copy');document.getElementById('close-graphics').setAttribute('aria-label',getWord('close'));sync();
 }
 setLanguage(lang);return {setLanguage};
}
