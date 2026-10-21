// Map-only highlight extraction, separable blur, and film-grain composite.
// Rendering is event-driven by MapLibre; this pass does not request an animation loop.
export class BloomPass {
 constructor(options){this.options=options;this.id='landscape-bloom';this.type='custom';this.renderingMode='2d';this.enabled=false;this.width=0;this.height=0;}
 onAdd(map,gl){
  this.map=map;
  try{
   const vertex=`#version 300 es
    precision highp float;out vec2 v_uv;
    void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
   const fragment=body=>`#version 300 es
    precision highp float;in vec2 v_uv;out vec4 fragColor;${body}`;
   this.bright=this.program(gl,vertex,fragment(`uniform sampler2D u_image;
    void main(){vec3 c=texture(u_image,v_uv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));float gate=smoothstep(.56,.91,l)*smoothstep(.12,.56,c.r);fragColor=vec4(c*gate,1.0);}`));
   this.blur=this.program(gl,vertex,fragment(`uniform sampler2D u_image;uniform vec2 u_direction;
    void main(){vec3 c=texture(u_image,v_uv).rgb*.227027;
     c+=texture(u_image,v_uv+u_direction*1.384615).rgb*.316216;c+=texture(u_image,v_uv-u_direction*1.384615).rgb*.316216;
     c+=texture(u_image,v_uv+u_direction*3.230769).rgb*.070270;c+=texture(u_image,v_uv-u_direction*3.230769).rgb*.070270;fragColor=vec4(c,1.0);}`));
   this.composite=this.program(gl,vertex,fragment(`uniform sampler2D u_scene;uniform sampler2D u_bloom;uniform float u_strength;uniform float u_grain;uniform float u_cyan;
    float grain(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec3 scene=texture(u_scene,v_uv).rgb;vec3 bloom=texture(u_bloom,v_uv).rgb;
     float blue=smoothstep(.04,.26,scene.b-scene.r)*(1.0-smoothstep(.25,.7,scene.r));
     scene.g+=(scene.b-scene.g)*u_cyan*.55*blue;scene.r*=1.0-u_cyan*.14*blue;
     float n=(grain(floor(gl_FragCoord.xy))-.5)*u_grain;vec3 color=scene+bloom*u_strength;
     fragColor=vec4(max(vec3(0.0),color+vec3(n*.84,n,n*1.04)),1.0);}`));
   this.vao=gl.createVertexArray();this.scene=gl.createTexture();this.targets=[0,1].map(()=>({texture:gl.createTexture(),framebuffer:gl.createFramebuffer()}));this.enabled=true;
  }catch(error){console.warn('Bloom pass unavailable:',error.message);}
 }
 program(gl,vertex,fragment){
  const compile=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  return {program,uniforms:Object.fromEntries(['u_image','u_scene','u_bloom','u_direction','u_strength','u_grain','u_cyan'].map(name=>[name,gl.getUniformLocation(program,name)]))};
 }
 allocate(gl,texture,width,height){
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 }
 resize(gl,width,height){
  if(this.width===width&&this.height===height)return;
  this.width=width;this.height=height;
  const scale=Math.min(innerWidth<=760?.32:.42,1024/width,640/height);
  this.blurWidth=Math.max(1,Math.round(width*scale));this.blurHeight=Math.max(1,Math.round(height*scale));
  this.allocate(gl,this.scene,width,height);
  for(const target of this.targets){
   this.allocate(gl,target.texture,this.blurWidth,this.blurHeight);gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Bloom framebuffer is incomplete');
  }
 }
 draw(gl,program,target,texture,direction){
  gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,this.blurWidth,this.blurHeight);gl.useProgram(program.program);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(program.uniforms.u_image,0);
  if(direction)gl.uniform2f(program.uniforms.u_direction,...direction);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
 render(gl){
  if(!this.enabled)return;
  const framebuffer=gl.getParameter(gl.FRAMEBUFFER_BINDING),viewport=gl.getParameter(gl.VIEWPORT);
  try{
   this.resize(gl,gl.drawingBufferWidth,gl.drawingBufferHeight);
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.scene);
   gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,this.width,this.height);
   gl.bindVertexArray(this.vao);gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.depthMask(false);gl.colorMask(true,true,true,true);
   this.draw(gl,this.bright,this.targets[0],this.scene);
   const x=2.2*this.options.bloomRadius/this.blurWidth,y=2.2*this.options.bloomRadius/this.blurHeight;
   this.draw(gl,this.blur,this.targets[1],this.targets[0].texture,[x,0]);
   this.draw(gl,this.blur,this.targets[0],this.targets[1].texture,[0,y]);
   this.draw(gl,this.blur,this.targets[1],this.targets[0].texture,[x*1.7,0]);
   this.draw(gl,this.blur,this.targets[0],this.targets[1].texture,[0,y*1.7]);
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(...viewport);gl.useProgram(this.composite.program);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.scene);gl.uniform1i(this.composite.uniforms.u_scene,0);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);gl.uniform1i(this.composite.uniforms.u_bloom,1);
   gl.uniform1f(this.composite.uniforms.u_strength,this.options.bloomStrength*(innerWidth<=760?.76:1));
   gl.uniform1f(this.composite.uniforms.u_grain,this.options.grain);gl.uniform1f(this.composite.uniforms.u_cyan,this.options.cyan);gl.drawArrays(gl.TRIANGLES,0,3);
  }catch(error){this.enabled=false;console.warn('Bloom pass disabled:',error.message);}
  finally{gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(...viewport);gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);gl.depthMask(true);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
 }
 onRemove(map,gl){
  for(const p of [this.bright,this.blur,this.composite])if(p)gl.deleteProgram(p.program);
  if(this.scene)gl.deleteTexture(this.scene);if(this.vao)gl.deleteVertexArray(this.vao);
  for(const t of this.targets||[]){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);}
 }
}
