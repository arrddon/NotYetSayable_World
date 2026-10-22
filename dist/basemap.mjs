// A compact, label-free style. Every map layer stays in the same blue palette.
// Share one vector source with the decorative road sampling layer.
export function createBasemapStyle(){
 return {version:8,name:'Latent Homes / Monochrome',sources:{openmaptiles:{type:'vector',url:'https://tiles.openfreemap.org/planet'}},layers:[
  {id:'background',type:'background',paint:{'background-color':'#081144'}},
  {id:'flat-water',type:'fill',source:'openmaptiles','source-layer':'water',paint:{'fill-color':'#03061e','fill-opacity':1}},
  {id:'flat-waterways',type:'line',source:'openmaptiles','source-layer':'waterway',paint:{'line-color':'#477cf2','line-width':.7,'line-opacity':.55}},
  {id:'flat-roads',type:'line',source:'openmaptiles','source-layer':'transportation',minzoom:5,
   filter:['match',['get','class'],['rail','transit','ferry'],false,true],
   paint:{'line-color':'#5b7fe2','line-width':['interpolate',['linear'],['zoom'],5,.3,12,.7,16,1.25,18,2],'line-opacity':.5}},
  {id:'flat-boundaries',type:'line',source:'openmaptiles','source-layer':'boundary',maxzoom:7,
   paint:{'line-color':'#40618f','line-width':.7,'line-opacity':.3,'line-dasharray':[3,3]}}
 ]};
}
