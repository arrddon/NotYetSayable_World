// Appearance only. These values never change archive records or clustering/ranking rules.
export const GRAPHICS_PARAMETERS = [
 {key:'pillarHeight',ko:'기둥 높이',en:'Pillar height',hintKo:'낮은 흔적 → 긴 빛기둥',hintEn:'Low traces → tall light columns',min:.4,max:2.8,step:.1,unit:'×',digits:1},
 {key:'pillarDensity',ko:'기둥 밀도',en:'Pillar density',hintKo:'성긴 군집 → 조밀한 군집',hintEn:'Sparse → dense formations',min:.4,max:2,step:.1,unit:'×',digits:1},
 {key:'clusterSpread',ko:'군집 퍼짐',en:'Cluster spread',hintKo:'좁게 응축 → 넓게 확산',hintEn:'Concentrated → dispersed',min:.5,max:2,step:.05,unit:'×',digits:2},
 {key:'bloomStrength',ko:'빛 번짐 강도',en:'Bloom strength',hintKo:'선명한 기둥 → 빛나는 덩어리',hintEn:'Crisp columns → luminous forms',min:0,max:4,step:.05,unit:'×',digits:2},
 {key:'bloomRadius',ko:'빛 번짐 반경',en:'Bloom radius',hintKo:'가까운 광채 → 넓은 빛 안개',hintEn:'Tight glow → broad light haze',min:.5,max:3,step:.1,unit:'×',digits:1},
 {key:'cyan',ko:'사이언 비율',en:'Cyan mix',hintKo:'코발트 블루 → 사이언 블루',hintEn:'Cobalt blue → cyan blue',min:0,max:1,step:.05,unit:'%',digits:0},
 {key:'particleDensity',ko:'도시 입자 밀도',en:'City particle density',hintKo:'성긴 점 → 조밀한 점 풍경',hintEn:'Sparse points → dense point landscape',min:.4,max:1.5,step:.1,unit:'×',digits:1},
 {key:'grain',ko:'그레인',en:'Grain',hintKo:'매끈한 화면 → 거친 필름 질감',hintEn:'Smooth → textured film grain',min:0,max:.1,step:.005,unit:'%',digits:1},
 {key:'cameraElevation',ko:'카메라 고도각',en:'Camera elevation',hintKo:'25° 낮은 시점 · 90° 수직으로 내려다보기',hintEn:'25° low angle · 90° straight overhead',min:25,max:90,step:1,unit:'°',digits:0},
];
export const GRAPHICS_PRESETS = Object.freeze({
 calm:{pillarHeight:1,pillarDensity:1,clusterSpread:1,bloomStrength:1.1,bloomRadius:1,cyan:0,particleDensity:1,grain:.025,cameraElevation:47},
 emphasis:{pillarHeight:1.5,pillarDensity:1.3,clusterSpread:1.15,bloomStrength:1.85,bloomRadius:1.5,cyan:.35,particleDensity:1.1,grain:.045,cameraElevation:50},
 exaggerated:{pillarHeight:2.1,pillarDensity:1.7,clusterSpread:1.35,bloomStrength:2.7,bloomRadius:2.3,cyan:.55,particleDensity:1.4,grain:.065,cameraElevation:54},
});
export function normalizeGraphics(candidate={}){
 const values={};
 for(const parameter of GRAPHICS_PARAMETERS){
  const value=candidate?.[parameter.key];
  values[parameter.key]=typeof value==='number'&&Number.isFinite(value)?Math.max(parameter.min,Math.min(parameter.max,value)):GRAPHICS_PRESETS.emphasis[parameter.key];
 }
 return values;
}
export function formatGraphicsValue(parameter,value){return `${(value*(parameter.unit==='%'?100:1)).toFixed(parameter.digits)}${parameter.unit}`;}
