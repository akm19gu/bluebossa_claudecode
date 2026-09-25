// WebGL2 finishing pass: shutter accumulation (motion blur) in linear light,
// dual-Kawase bloom, lens chromatic aberration, grade, vignette, grain, HUD.
'use strict';

class Post {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const vs = `#version 300 es
      in vec2 p; out vec2 uv;
      void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
    const hdr = `#version 300 es
      precision highp float; in vec2 uv; out vec4 o;`;
    this.progs = {
      accum: this.prog(vs, hdr + `uniform sampler2D src; uniform float w;
        void main(){ vec4 c = texture(src, uv); o = vec4(pow(c.rgb, vec3(2.2))*w, w); }`),
      bright: this.prog(vs, hdr + `uniform sampler2D src; uniform float th, knee;
        void main(){ vec3 c = texture(src, uv).rgb; float l = max(c.r, max(c.g, c.b));
          float k = smoothstep(th, th+knee, l); o = vec4(c*k, 1.); }`),
      down: this.prog(vs, hdr + `uniform sampler2D src; uniform vec2 px;
        void main(){ vec3 s = texture(src, uv).rgb*4.;
          s += texture(src, uv+vec2(-px.x,-px.y)).rgb; s += texture(src, uv+vec2(px.x,-px.y)).rgb;
          s += texture(src, uv+vec2(-px.x,px.y)).rgb; s += texture(src, uv+vec2(px.x,px.y)).rgb;
          o = vec4(s/8., 1.); }`),
      up: this.prog(vs, hdr + `uniform sampler2D src; uniform vec2 px;
        void main(){ vec3 s = vec3(0.);
          s += texture(src, uv+vec2(-2.*px.x,0.)).rgb; s += texture(src, uv+vec2(2.*px.x,0.)).rgb;
          s += texture(src, uv+vec2(0.,-2.*px.y)).rgb; s += texture(src, uv+vec2(0.,2.*px.y)).rgb;
          s += texture(src, uv+vec2(-px.x,-px.y)).rgb*2.; s += texture(src, uv+vec2(px.x,-px.y)).rgb*2.;
          s += texture(src, uv+vec2(-px.x,px.y)).rgb*2.; s += texture(src, uv+vec2(px.x,px.y)).rgb*2.;
          o = vec4(s/12., 1.); }`),
      final: this.prog(vs, hdr + `
        uniform sampler2D scene, bloom, hud;
        uniform vec2 res; uniform float seed, bloomAmt, ca, vig, grain, expo, warp, sat;
        uniform vec3 lift, gain, tint;
        float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
        void main(){
          vec2 d = uv-0.5; d.x *= res.x/res.y;
          float r2 = dot(d,d);
          vec2 wuv = uv + (uv-0.5)*r2*warp;
          vec2 off = (uv-0.5)*ca*(0.35+r2*2.2);
          vec3 c;
          c.r = texture(scene, wuv-off).r; c.g = texture(scene, wuv).g; c.b = texture(scene, wuv+off).b;
          vec3 b;
          b.r = texture(bloom, wuv-off*1.6).r; b.g = texture(bloom, wuv).g; b.b = texture(bloom, wuv+off*1.6).b;
          c += b*bloomAmt;
          c *= expo;
          c = c*(1.+c/2.2)/(1.+c);                 // soft shoulder
          c = pow(c, vec3(1./2.2));
          c = clamp(c*gain + lift*(1.-c), 0., 1.) * tint;
          float lum = dot(c, vec3(.299,.587,.114));
          c = mix(vec3(lum), c, sat);
          float v = smoothstep(1.25, 0.25, length(d*vec2(0.92,1.1)));
          c *= mix(1., v, vig);
          vec4 h = texture(hud, uv);
          c = h.rgb + c*(1.-h.a);
          float n = hash(uv*res + seed*91.7) + hash(uv*res*1.37 + seed*13.1) - 1.;
          c += n*grain*(0.55 + 0.45*(1.-lum));
          c += (hash(uv*res+seed)-.5)/255.;
          o = vec4(c, 1.);
        }`),
    };
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.src = this.tex(); this.hudTex = this.tex();
    const [w, h] = [canvas.width, canvas.height];
    this.w = w; this.h = h;
    this.accum = this.target(w, h);
    this.levels = [];
    let lw = w >> 1, lh = h >> 1;
    for (let i = 0; i < 6; i++) { this.levels.push(this.target(lw, lh)); lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); }
  }
  prog(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  tex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  target(w, h) {
    const gl = this.gl, t = this.tex();
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb, w, h };
  }
  pass(prog, target, uniforms, texs) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.w, target ? target.h : this.h);
    let unit = 0;
    for (const [name, t] of Object.entries(texs)) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(prog.u[name], unit++);
    }
    for (const [name, v] of Object.entries(uniforms)) {
      const loc = prog.u[name]; if (!loc) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else gl.uniform3fv(loc, v);
    }
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  upload(tex, canvas, premul) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  add(canvas, weight) {
    const gl = this.gl;
    this.upload(this.src, canvas, false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    this.pass(this.progs.accum, this.accum, { w: weight }, { src: this.src });
    gl.disable(gl.BLEND);
  }
  finish(hudCanvas, P) {
    const gl = this.gl, L = this.levels;
    this.pass(this.progs.bright, L[0], { th: P.th, knee: P.knee }, { src: this.accum.t });
    for (let i = 1; i < L.length; i++)
      this.pass(this.progs.down, L[i], { px: [0.5 / L[i - 1].w, 0.5 / L[i - 1].h] }, { src: L[i - 1].t });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = L.length - 2; i >= 0; i--)
      this.pass(this.progs.up, L[i], { px: [0.5 / L[i + 1].w, 0.5 / L[i + 1].h] }, { src: L[i + 1].t });
    gl.disable(gl.BLEND);
    this.upload(this.hudTex, hudCanvas, true);
    this.pass(this.progs.final, null, {
      res: [this.w, this.h], seed: P.seed, bloomAmt: P.bloom, ca: P.ca, vig: P.vig, grain: P.grain,
      expo: P.expo, warp: P.warp, sat: P.sat, lift: P.lift, gain: P.gain, tint: P.tint,
    }, { scene: this.accum.t, bloom: L[0].t, hud: this.hudTex });
  }
}
