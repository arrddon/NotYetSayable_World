// Re-sample map details as an overlay. Keep the actual basemap underneath it.
export class MapParticleSurface {
 constructor(density=1){this.id='map-particle-surface';this.type='custom';this.renderingMode='2d';this.density=density;this.regions=[];this.time=0;this.lastTime=null;this.regionsDirty=true;this.regionsA=new Float32Array(48);this.regionsB=new Float32Array(48);this.regionCount=0;}
 onAdd(map,gl){
  this.map=map;
  this.viewChanged=()=>{this.regionsDirty=true;};map.on('move',this.viewChanged);map.on('resize',this.viewChanged);
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=(vs,fs,names)=>{
   const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return {program:p,uniforms:Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]))};
  };
  this.points=program(`#version 300 es
   precision highp float;uniform sampler2D u_map;uniform vec2 u_grid;uniform vec2 u_texel;uniform float u_ratio;uniform float u_time;
   uniform int u_regionCount;uniform vec4 u_regionsA[12];uniform vec4 u_regionsB[12];
   out vec4 v_color;
   float hash(float x){return fract(sin(x*127.1)*43758.5453);}
   void main(){
    float id=float(gl_VertexID);vec2 cell=vec2(mod(id,u_grid.x),floor(id/u_grid.x));
    vec2 uv=(cell+.5)/u_grid;
    float tick=floor(u_time*5.),glitch=step(.987,hash(floor(cell.y/4.)+tick*.071));
    vec2 slip=vec2((hash(id+tick)-.5)*glitch*3.,0.);
    vec3 c=texture(u_map,uv+slip*u_texel).rgb;
    vec3 east=texture(u_map,uv+vec2(u_texel.x,0.)).rgb,west=texture(u_map,uv-vec2(u_texel.x,0.)).rgb;
    vec3 north=texture(u_map,uv+vec2(0.,u_texel.y)).rgb,south=texture(u_map,uv-vec2(0.,u_texel.y)).rgb;
    float light=dot(c,vec3(.2126,.7152,.0722));
    float edge=smoothstep(.045,.28,length(east-west)+length(north-south));
    float land=smoothstep(.12,.22,c.b),bright=max(edge,smoothstep(.075,.21,light));
    vec2 jitter=vec2(hash(id),hash(id+37.))-.5;
    gl_Position=vec4((cell+.5+jitter*.3+slip*.2)/u_grid*2.-1.,0.,1.);
    gl_PointSize=(1.45+bright*1.15+hash(id+9.)*.45)*u_ratio;
    vec3 base=mix(vec3(.012,.04,.19),vec3(.055,.16,.62),land);
    vec3 color=mix(base,vec3(.5,.66,1.),bright*.86);
    float interior=0.,rim=0.;
    for(int i=0;i<12;i++){
     if(i>=u_regionCount)break;
     vec2 delta=uv-u_regionsA[i].xy,local=vec2(dot(delta,u_regionsA[i].zw),dot(delta,u_regionsB[i].xy));
     // The contour plus its rim fits inside this box. Skip trigonometry elsewhere.
     if(any(greaterThan(abs(local),vec2(1.1))))continue;
     float angle=atan(local.y,local.x),phase=u_regionsB[i].z;
     float contour=.82+.11*sin(angle*3.+phase)+.065*sin(angle*7.-phase)+.025*sin(angle*13.+phase);
     float d=length(local)/contour;
     interior=max(interior,1.-smoothstep(.94,1.02,d));rim=max(rim,1.-smoothstep(.015,.055,abs(d-1.)));
    }
    vec3 chrome=mix(vec3(.75,.86,1.),vec3(.012,.035,.16),smoothstep(.045,.18,light));
    color=mix(color,chrome,interior*.32+rim*.6);
    gl_PointSize+=rim*u_ratio;
    color=mix(color,vec3(.82,.91,1.),glitch*bright*.22);
    // Flat background pixels contribute no particles; roads and region details do.
    float coverage=max(bright,interior*.2+rim*.55);
    v_color=vec4(color,coverage*(.28+bright*.32)*(.92+sin(u_time*.7+id)*.08));
   }`,`#version 300 es
   precision highp float;in vec4 v_color;out vec4 fragColor;
   void main(){if(v_color.a<.01||max(abs(gl_PointCoord.x-.5),abs(gl_PointCoord.y-.5))>.48)discard;fragColor=v_color;}`,['u_map','u_grid','u_texel','u_ratio','u_time','u_regionCount','u_regionsA[0]','u_regionsB[0]']);
  this.vao=gl.createVertexArray();this.texture=gl.createTexture();
 }
 setDensity(value){if(value!==this.density){this.density=value;this.map?.triggerRepaint();}}
 setRegions(regions){this.regions=regions.slice(0,12);this.regionsDirty=true;this.map?.triggerRepaint();}
 setAnimated(){this.lastTime=null;}
 render(gl){
  const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,canvas=this.map.getCanvas(),mobile=canvas.clientWidth<=760;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.width!==width||this.height!==height){
   this.width=width;this.height=height;
   this.regionsDirty=true;
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  }
  gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,width,height);
  gl.bindVertexArray(this.vao);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);
  const budget=mobile?42000:180000,step=Math.max((mobile?3:2.35)/Math.sqrt(this.density),Math.sqrt(canvas.clientWidth*canvas.clientHeight/budget));
  const columns=Math.max(1,Math.floor(canvas.clientWidth/step)),rows=Math.max(1,Math.floor(canvas.clientHeight/step));
  const p=this.points,now=performance.now();if(this.lastTime!==null)this.time+=(now-this.lastTime)/1000;this.lastTime=now;
  const a=this.regionsA,b=this.regionsB;
  if(this.regionsDirty){
   a.fill(0);b.fill(0);let count=0;
   for(const region of this.regions){
   const [lng,lat]=region.position,center=this.map.project(region.position),east=this.map.project([lng+region.radius/(111320*Math.cos(lat*Math.PI/180)),lat]),north=this.map.project([lng,lat+region.radius/111320]);
   const ex=(east.x-center.x)/canvas.clientWidth,ey=-(east.y-center.y)/canvas.clientHeight,nx=(north.x-center.x)/canvas.clientWidth,ny=-(north.y-center.y)/canvas.clientHeight,det=ex*ny-nx*ey;
   if(!Number.isFinite(det)||Math.abs(det)<1e-12)continue;
   a.set([center.x/canvas.clientWidth,1-center.y/canvas.clientHeight,ny/det,-nx/det],count*4);b.set([-ey/det,ex/det,region.phase,0],count*4);count++;
   }
   this.regionCount=count;this.regionsDirty=false;
  }
  gl.useProgram(p.program);gl.uniform1i(p.uniforms.u_map,0);gl.uniform2f(p.uniforms.u_grid,columns,rows);gl.uniform2f(p.uniforms.u_texel,1/width,1/height);gl.uniform1f(p.uniforms.u_ratio,this.map.getPixelRatio());gl.uniform1f(p.uniforms.u_time,this.time);
  gl.uniform1i(p.uniforms.u_regionCount,this.regionCount);gl.uniform4fv(p.uniforms['u_regionsA[0]'],a);gl.uniform4fv(p.uniforms['u_regionsB[0]'],b);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,columns*rows);
  gl.bindVertexArray(null);gl.depthMask(true);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 onRemove(map,gl){map.off('move',this.viewChanged);map.off('resize',this.viewChanged);gl.deleteProgram(this.points.program);gl.deleteTexture(this.texture);gl.deleteVertexArray(this.vao);}
}
