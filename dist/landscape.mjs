export const PARTICLE_LIMITS=Object.freeze({desktop:{roads:48000,field:48000,indicators:256},mobile:{roads:16000,field:18000,indicators:160}});
export const INDICATOR_TILT=.22;
export function packParticles(points){
 const values=new Float32Array(points.length*8),radians=Math.PI/180;
 for(let i=0;i<points.length;i++){
  const p=points[i],latitude=Math.max(-85.051129,Math.min(85.051129,p.position[1])),offset=i*8;
  values[offset]=(p.position[0]+180)/360;
  values[offset+1]=(1-Math.log(Math.tan(Math.PI/4+latitude*radians/2))/Math.PI)/2;
  values[offset+2]=(p.height||0)/(40075016.686*Math.cos(latitude*radians));
  values[offset+3]=p.color[0];values[offset+4]=p.color[1];values[offset+5]=p.color[2];
  values[offset+6]=p.alpha??.7;values[offset+7]=p.size??1.7;
 }
 return values;
}

// Decorative, geographically anchored particles. None of these points are records.
export class LuminousPoints {
 constructor(id,{motion=0}={}){
  this.id=id;this.type='custom';this.renderingMode='3d';this.motion=motion;
  this.vertices=new Float32Array();this.dirty=false;this.animated=true;this.time=0;this.lastTime=null;
 }
 onAdd(map,gl){
  this.map=map;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const vertex=shader(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;
   uniform mat4 u_matrix;uniform float u_ratio;uniform float u_time;uniform float u_motion;uniform float u_drift;
   in vec3 a_position;in vec4 a_color;in float a_size;out vec4 v_color;out float v_soft;
   void main(){
    float seed=float(gl_VertexID)*2.399963;
    vec3 position=a_position;
    float wave=dot(a_position.xy,vec2(16000.,23000.));
    position.xy+=vec2(sin(u_time*.6+seed*.08),cos(u_time*.47+seed*.06))*u_drift*u_motion;
    position.z*=1.0+sin(u_time*.85+wave)*u_motion*.24;
    gl_Position=u_matrix*vec4(position,1.0);
    gl_PointSize=a_size*u_ratio*(1.+sin(u_time+seed)*u_motion*.12);
    v_soft=step(12.,a_size);
    v_color=vec4(a_color.rgb,a_color.a*(1.0-u_motion*.2+sin(u_time*1.2+seed)*u_motion*.2));
   }`);
  const fragment=shader(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;in vec4 v_color;in float v_soft;out vec4 fragColor;
   void main(){if(v_color.a<.002)discard;float a=v_color.a;
    if(v_soft>.5){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;a*=exp(-r*r*3.7);}
    else if(max(abs(gl_PointCoord.x-.5),abs(gl_PointCoord.y-.5))>.48)discard;
    fragColor=vec4(v_color.rgb,a);}`);
  this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of [['a_position',3,0],['a_color',4,12],['a_size',1,28]]){
   const location=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset);
  }
  gl.bindVertexArray(null);
  this.uniforms=Object.fromEntries(['u_matrix','u_ratio','u_time','u_motion','u_drift'].map(name=>[name,gl.getUniformLocation(this.program,name)]));this.dirty=true;
 }
 setAnimated(value){this.animated=value;this.lastTime=null;this.map?.triggerRepaint();}
 setPoints(points){
  this.vertices=packParticles(points);this.dirty=true;this.map?.triggerRepaint();
 }
 render(gl,args){
  if(!this.vertices.length)return;
  const matrix=args.defaultProjectionData?.mainMatrix||args;
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  if(this.dirty){gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);this.dirty=false;}
  gl.uniformMatrix4fv(this.uniforms.u_matrix,false,matrix);
  gl.uniform1f(this.uniforms.u_ratio,this.map.getPixelRatio());
  const now=performance.now();if(this.animated&&this.lastTime!==null)this.time+=(now-this.lastTime)/1000;this.lastTime=now;
  gl.uniform1f(this.uniforms.u_time,this.time);
  gl.uniform1f(this.uniforms.u_motion,this.motion);
  gl.uniform1f(this.uniforms.u_drift,1.5/(512*2**this.map.getZoom()));
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
  gl.drawArrays(gl.POINTS,0,this.vertices.length/8);
  gl.bindVertexArray(null);gl.depthMask(true);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 onRemove(map,gl){gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);}
}

const distance=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111320);
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const randomFrom=initial=>{let seed=initial>>>0;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};
const seedOf=value=>[...value].reduce((seed,c)=>Math.imul(seed,31)+c.charCodeAt(0)|0,1)>>>0;
const metersPerPixel=(zoom,lat)=>40075016.686*Math.cos(lat*Math.PI/180)/(512*2**zoom);

export function roadParticles(map,{mobile=false,density=1}={}){
 const budget=Math.round(Math.min(mobile?PARTICLE_LIMITS.mobile.roads:PARTICLE_LIMITS.desktop.roads,(mobile?12000:36000)*density));
 const points=[],seen=new Set(),center=map.getCenter(),bounds=map.getBounds();
 const random=randomFrom(1297),step=Math.max(3,metersPerPixel(map.getZoom(),center.lat)*(mobile?4:3.2)/Math.sqrt(density));
 let features=[];try{features=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation'});}catch{return points;}
 const lines=[];
 for(const feature of features){
  if(['rail','transit','ferry'].includes(feature.properties?.class))continue;
  const geometry=feature.geometry;
  for(const line of geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[]){
   if(line.length<2)continue;
   const key=[line[0],line[Math.floor(line.length/2)],line.at(-1)].flat().map(n=>n.toFixed(6)).join(',');
   if(seen.has(key))continue;seen.add(key);
   lines.push({line,distance:distance(line[Math.floor(line.length/2)],[center.lng,center.lat])});
  }
 }
 lines.sort((a,b)=>a.distance-b.distance);
 for(const {line} of lines){
  for(let i=1;i<line.length&&points.length<budget;i++){
   const a=line[i-1],b=line[i],length=distance(a,b);
   if(!Number.isFinite(length)||!length)continue;
   const count=Math.min(3000,Math.max(1,Math.ceil(length/step)));
   for(let j=0;j<count&&points.length<budget;j++){
    const position=mix(a,b,(j+.2+random()*.6)/count);
    if(!bounds.contains(position))continue;
    const bright=random()>.89,tint=random();
    points.push({position,height:1+random()*2,color:bright?[.8,.94,1]:[.25+tint*.2,.57+tint*.28,1],alpha:bright?.8:.38+random()*.3,size:bright?1.7:.9+random()*.6});
    // Sparse shoulder dust gives the road network a porous, particulate edge.
    if(random()<.12&&points.length<budget){
     const angle=random()*Math.PI*2,offset=(2+random()*8)/111320;
     points.push({position:[position[0]+Math.cos(angle)*offset/Math.cos(center.lat*Math.PI/180),position[1]+Math.sin(angle)*offset],height:random()*5,color:[.2,.48,1],alpha:.25+random()*.25,size:.9+random()*.5});
    }
   }
  }
  if(points.length>=budget)break;
 }
 return points;
}

// Continuous geographic islands, surface texture, and broadly distributed indicators.
// The islands are decorative footprints, never measured participant boundaries.
export function formationParticles(features,{zoom=13.3,pillarHeight=1.5,pillarDensity=1.3,fieldDensity=1.2,clusterSpread=1.15,mobile=false}={}){
 const field=[],areas=[],indicators=[],relief=[],regions=[],groups=new Map(),limits=mobile?PARTICLE_LIMITS.mobile:PARTICLE_LIMITS.desktop;
 const scale=Math.min(9,Math.max(.16,2**(13.3-zoom)));
 for(const feature of features){
  const center=feature.geometry?.coordinates,properties=feature.properties||{};
  if(!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||Math.abs(center[0])>180||Math.abs(center[1])>85.051129)continue;
  const key=String(properties.cluster?`c${properties.cluster_id}`:`p${properties.id}`);
  if(!groups.has(key))groups.set(key,feature);
 }
 const fieldAllowance=Math.floor(limits.field/Math.max(1,groups.size));
 const reliefBudget=mobile?24000:90000,reliefGroups=Math.min(groups.size,Math.floor(reliefBudget/48));
 const segments=Math.min(mobile?28:44,Math.max(8,Math.floor(reliefBudget/Math.max(1,reliefGroups)/6)));
 const rings=Math.min(18,Math.max(1,Math.floor(reliefBudget/Math.max(1,reliefGroups)/segments/6)));
 const ordered=[...groups].sort((a,b)=>(Number(b[1].properties?.point_count)||1)-(Number(a[1].properties?.point_count)||1)||a[0].localeCompare(b[0]));
 const coverage=Math.max(.15,Math.min(1,pillarDensity/2));
 const indicatorCount=Math.min(limits.indicators,Math.max(1,Math.ceil(groups.size*coverage)));
 for(const [key,feature] of ordered){
  const center=feature.geometry.coordinates,properties=feature.properties||{};
  const count=Math.min(30000,Math.max(1,Number(properties.point_count)||1));
  let random=randomFrom(seedOf(key));
  const cos=Math.cos(center[1]*Math.PI/180),phase=random()*Math.PI*2;
  const radius=(185+Math.sqrt(count)*80)*scale*clusterSpread;
  regions.push({position:[...center],radius,phase});
  const locate=(angle,r)=>[center[0]+Math.cos(angle)*r/(111320*cos),center[1]+Math.sin(angle)*r/111320];
  const contour=angle=>.82+.11*Math.sin(angle*3+phase)+.065*Math.sin(angle*7-phase)+.025*Math.sin(angle*13+phase);
  const peak=(90+Math.sqrt(count)*44)*scale;
  const heightAt=(x,y)=>{
   const r=Math.hypot(x,y)/contour(Math.atan2(y,x));
   const envelope=Math.max(0,1-r*r)**.72;
   const ridge=.5+.27*Math.sin(x*9+phase)*Math.cos(y*8-phase)+.13*Math.sin((x+y)*19+phase);
   return scale*4+envelope*peak*(.3+Math.floor(ridge*7)/7*.85);
  };
  const unit=1/(40075016.686*cos),cx=(center[0]+180)/360,cy=(1-Math.log(Math.tan(Math.PI/4+center[1]*Math.PI/360))/Math.PI)/2;
  const vertex=(angle,t)=>{
   const x=Math.cos(angle)*t*contour(angle),y=Math.sin(angle)*t*contour(angle),z=heightAt(x,y),eps=.012;
   const normal=[-(heightAt(x+eps,y)-heightAt(x-eps,y))/(2*eps*radius),(heightAt(x,y+eps)-heightAt(x,y-eps))/(2*eps*radius),1];
   const length=Math.hypot(...normal),shade=z/peak;
   return [cx+x*radius*unit,cy-y*radius*unit,z*unit,...normal.map(v=>v/length),.035+shade*.07,.22+shade*.28,.72+shade*.23];
  };
  if(areas.length/4<reliefGroups&&zoom>=6){
   for(let ring=0;ring<rings;ring++)for(let j=0;j<segments;j++){
    const a=j/segments*Math.PI*2,b=(j+1)/segments*Math.PI*2,t=ring/rings,u=(ring+1)/rings;
    const p=vertex(a,t),q=vertex(b,t),r=vertex(a,u),s=vertex(b,u);
    relief.push(...p,...r,...q,...q,...r,...s);
   }
  }
  const polygon=(origin,radiusFactor,shift)=>{
   const ring=Array.from({length:73},(_,i)=>{
    const angle=(i%72)/72*Math.PI*2,r=radius*radiusFactor*contour(angle+shift);
    return [origin[0]+Math.cos(angle)*r/(111320*cos),origin[1]+Math.sin(angle)*r/111320];
   });
   return {type:'Feature',properties:{kind:radiusFactor===1?'area':'ice'},geometry:{type:'Polygon',coordinates:[ring]}};
  };
  areas.push(polygon(center,1,0));
  // Inset light patches make the footprint read as a surface rather than a point cloud.
  for(let i=0;i<3;i++)areas.push(polygon(locate(phase+i*2.1,radius*(i?.38:.12)),i?.24:.43,i*.7));
  const quantity=Math.min(fieldAllowance,mobile?3600:9500,Math.round((1800+count*200)*fieldDensity));
  for(let i=0;i<quantity;i++){
   const edge=i<quantity*.14,angle=random()*Math.PI*2,r=edge?.97+random()*.04:Math.sqrt(random()),position=locate(angle,r*radius*contour(angle));
   const ridge=.5+.5*Math.sin(angle*8+r*17+phase),envelope=Math.max(0,1-r*r);
   const x=(position[0]-center[0])*111320*cos/radius,y=(position[1]-center[1])*111320/radius;
   const chrome=Math.abs(Math.sin(angle*12+r*28+phase))<.065;
   const bright=random()>.94||chrome||edge,aura=!edge&&i%22===0;
   const height=heightAt(x,y)+(aura?random()*25:2+random()*5)*scale;
   const epsilon=.012,dx=(heightAt(x+epsilon,y)-heightAt(x-epsilon,y))/(2*epsilon*radius),dy=(heightAt(x,y+epsilon)-heightAt(x,y-epsilon))/(2*epsilon*radius);
   const shade=Math.max(.1,(-dx*.3+dy*.4+.86)/Math.hypot(dx,dy,1));
   field.push({position,height,color:aura?[.1,.22,1]:edge?[.78,.88,1]:bright?[.62+shade*.3,.72+shade*.23,1]:[.06+shade*.12,.17+shade*.23,.55+shade*.45],alpha:aura?.08:1,size:aura?22+random()*24:edge?4.2+random()*1.3:bright?3.8+random()*1.6:2.8+random()*1.4});
  }
  if(indicators.length<indicatorCount){
   const prominent=indicators.length<(mobile?3:6);
   const overview=.3+.7*Math.max(0,Math.min(1,(zoom-2)/8));
   const width=((mobile?13:26)+Math.min(mobile?17:28,Math.sqrt(count)*3.6))*overview*(prominent?1.28:.48);
   indicators.push({position:[...center],radius,height:-30*scale,width,reach:pillarHeight/.9*(prominent?1.08:.88),tilt:INDICATOR_TILT});
  }
 }
 return {field,areas:{type:'FeatureCollection',features:areas},indicators,regions,relief:new Float32Array(relief)};
}
