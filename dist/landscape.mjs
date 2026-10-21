// Decorative, geographically anchored surface texture. These points are not archive records.
export class LuminousPoints {
 constructor(id){this.id=id;this.type='custom';this.renderingMode='3d';this.vertices=new Float32Array();this.dirty=false;}
 onAdd(map,gl){
  this.map=map;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const vertex=shader(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;
   uniform mat4 u_matrix; uniform float u_ratio;
   in vec3 a_position; in vec4 a_color; in float a_size;
   out vec4 v_color;
   void main(){gl_Position=u_matrix*vec4(a_position,1.0);gl_PointSize=a_size*u_ratio;v_color=a_color;}`);
  const fragment=shader(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;
   in vec4 v_color; out vec4 fragColor;
   void main(){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;float a=exp(-r*r*3.7)*v_color.a;fragColor=vec4(v_color.rgb,a);}`);
  this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of [['a_position',3,0],['a_color',4,12],['a_size',1,28]]){
   const location=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset);
  }
  gl.bindVertexArray(null);this.matrix=gl.getUniformLocation(this.program,'u_matrix');this.ratio=gl.getUniformLocation(this.program,'u_ratio');this.dirty=true;
 }
 setPoints(points){
  const values=new Float32Array(points.length*8);
  for(let i=0;i<points.length;i++){
   const p=points[i],m=maplibregl.MercatorCoordinate.fromLngLat(p.position,p.height||0);
   values.set([m.x,m.y,m.z,...p.color,p.alpha??.7,p.size??1.7],i*8);
  }
  this.vertices=values;this.dirty=true;this.map?.triggerRepaint();
 }
 render(gl,args){
  if(!this.vertices.length)return;
  const matrix=args.defaultProjectionData?.mainMatrix||args;
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  if(this.dirty){gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);this.dirty=false;}
  gl.uniformMatrix4fv(this.matrix,false,matrix);gl.uniform1f(this.ratio,Math.min(devicePixelRatio||1,2));
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
  gl.drawArrays(gl.POINTS,0,this.vertices.length/8);
  gl.bindVertexArray(null);gl.depthMask(true);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 onRemove(map,gl){gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);}
}

const distance=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111320);
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function urbanTexture(map,{mobile=false}={}){
 const budget=mobile?38000:115000,points=[],seen=new Set(),center=map.getCenter();
 let seed=1297;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const push=(position,height=1,bright=false)=>{
  if(points.length>=budget)return;
  const r=random();points.push({position,height,color:bright?[.69,.91,1]:[.17+r*.28,.55+r*.3,1],alpha:bright?.86:.45+r*.38,size:bright?1.9:1.05+r*1.1});
 };
 const trace=(ring,height,step,facade=false)=>{
  for(let i=1;i<ring.length&&points.length<budget;i++){
   const a=ring[i-1],b=ring[i],n=Math.min(45,Math.max(1,Math.ceil(distance(a,b)/step)));
   for(let j=0;j<n&&points.length<budget;j++){
    const p=mix(a,b,j/n);push(p,height,random()>.86);
    if(facade&&height>18&&random()>.48)push(p,random()*height,false);
   }
  }
 };
 let buildings=[];try{buildings=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});}catch{return [];}
 const bounds=map.getBounds();
 const geometries=[];
 for(const f of buildings){
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];
  for(const polygon of polygons){
   const ring=polygon[0];if(!ring?.length)continue;
   const key=ring[0].map(n=>n.toFixed(6)).join(',');if(seen.has(key))continue;seen.add(key);
   const mid=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
   if(!bounds.contains(mid))continue;
   geometries.push({ring,mid,height:Math.max(5,Number(f.properties.render_height||f.properties.height)||8)*1.65+2,dist:distance(mid,[center.lng,center.lat])});
  }
 }
 const roofBudget=budget*.83;
 const perBuilding=Math.max(3,Math.min(55,Math.floor(roofBudget/Math.max(1,geometries.length))));
 for(const {ring,mid,height} of geometries){
  if(points.length>=roofBudget)break;
  const lengths=[];let perimeter=0;
  for(let i=1;i<ring.length;i++){perimeter+=distance(ring[i-1],ring[i]);lengths.push(perimeter);}
  if(!perimeter)continue;
  for(let j=0;j<perBuilding&&points.length<roofBudget;j++){
   const along=random()*perimeter;let edgeIndex=lengths.findIndex(length=>length>=along);if(edgeIndex<0)edgeIndex=lengths.length-1;
   const edge=mix(ring[edgeIndex],ring[edgeIndex+1],random());
   const p=j%3===0?mix(mid,edge,Math.sqrt(random())):edge;
   const z=j%4===1&&height>18?random()*height:height+random()*2;
   push(p,z,random()>.73);
  }
 }
 try{
  const roads=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation'});
  for(const f of roads){
   if(points.length>=budget)break;
   const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
   for(const line of lines){if(line.length&&bounds.contains(line[Math.floor(line.length/2)]))trace(line,1,mobile?20:12);}
  }
 }catch{}
 return points;
}
