// Appearance only. These values never change archive records or clustering/ranking rules.
export const GRAPHICS_PARAMETERS = [
 {key:'pillarHeight',ko:'인디케이터 길이',en:'Indicator reach',hintKo:'짧은 흔적 → 화면 끝을 넘는 형태',hintEn:'Short traces → forms extending beyond the screen',min:.4,max:2.8,step:.1,unit:'×',digits:1},
 {key:'pillarDensity',ko:'인디케이터 밀도',en:'Indicator density',hintKo:'적은 표식 → 더 많은 표식',hintEn:'Fewer → more indicators',min:.4,max:2,step:.1,unit:'×',digits:1},
 {key:'clusterSpread',ko:'군집 퍼짐',en:'Cluster spread',hintKo:'좁게 응축 → 넓게 확산',hintEn:'Concentrated → dispersed',min:.5,max:2,step:.05,unit:'×',digits:2},
 {key:'bloomStrength',ko:'빛 번짐 강도',en:'Bloom strength',hintKo:'선명한 기둥 → 빛나는 덩어리',hintEn:'Crisp columns → luminous forms',min:0,max:4,step:.05,unit:'×',digits:2},
 {key:'bloomRadius',ko:'빛 번짐 반경',en:'Bloom radius',hintKo:'가까운 광채 → 넓은 빛 안개',hintEn:'Tight glow → broad light haze',min:.5,max:3,step:.1,unit:'×',digits:1},
 {key:'cyan',ko:'사이언 비율',en:'Cyan mix',hintKo:'코발트 블루 → 사이언 블루',hintEn:'Cobalt blue → cyan blue',min:0,max:1,step:.05,unit:'%',digits:0},
 {key:'particleDensity',ko:'지도 입자 밀도',en:'Map particle density',hintKo:'지도 텍스처를 성긴 픽셀 → 조밀한 픽셀로',hintEn:'Sparse → dense pixels sampled from the map',min:.4,max:1.5,step:.1,unit:'×',digits:1},
 {key:'fieldDensity',ko:'영역 질감',en:'Surface texture',hintKo:'영역을 이루는 움직이는 픽셀 입자',hintEn:'Moving pixel particles forming the highlighted terrain',min:.4,max:2,step:.1,unit:'×',digits:1},
 {key:'grain',ko:'그레인',en:'Grain',hintKo:'매끈한 화면 → 거친 필름 질감',hintEn:'Smooth → textured film grain',min:0,max:.1,step:.005,unit:'%',digits:1},
];
export const GRAPHICS_DEFAULTS=Object.freeze({pillarHeight:2.8,pillarDensity:2,clusterSpread:.8,bloomStrength:1.4,bloomRadius:1.1,cyan:0,particleDensity:1.5,fieldDensity:1.7,grain:.08});
export function normalizeGraphics(candidate={}){
 const values={};
 for(const parameter of GRAPHICS_PARAMETERS){
  const value=candidate?.[parameter.key];
  values[parameter.key]=typeof value==='number'&&Number.isFinite(value)?Math.max(parameter.min,Math.min(parameter.max,value)):GRAPHICS_DEFAULTS[parameter.key];
 }
 return values;
}
export function formatGraphicsValue(parameter,value){return `${(value*(parameter.unit==='%'?100:1)).toFixed(parameter.digits)}${parameter.unit}`;}
