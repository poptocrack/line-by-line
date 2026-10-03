// @ts-nocheck
// Géométrie des motifs : chaque dessin est une liste de traits dans le repère [-1, 1].
// Types de traits : 'l' (segment), 'a' (arc de cercle), 'p' (polyligne, pour les machines).
// k = 1 marque un trait de la couche d'ombrage (hachures).
export type Pt = [number, number];
export type Stroke = any;

export const TAU = Math.PI * 2, SQ3 = Math.sqrt(3);

export const L=(x1,y1,x2,y2,k=0)=>({t:'l',x1,y1,x2,y2,k});
export const A=(cx,cy,r,a0,a1,k=0)=>({t:'a',cx,cy,r,a0,a1,k});
export const slen=s=>s.t==='l'?Math.hypot(s.x2-s.x1,s.y2-s.y1):s.t==='p'?s.len:s.r*Math.abs(s.a1-s.a0);
// Polyligne : un morceau de courbe continue (machines)
export function PL(pts,col,thin){const cum=[0];let len=0;for(let i=1;i<pts.length;i++){len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);cum.push(len)}return{t:'p',pts,cum,len:len||1e-6,k:0,col,thin}}
export function polyAt(s,u){const d=u*s.len;let i=1;while(i<s.cum.length-1&&s.cum[i]<d)i++;const a=s.pts[i-1],b=s.pts[i],sg=(s.cum[i]-s.cum[i-1])||1,t=Math.min(1,Math.max(0,(d-s.cum[i-1])/sg));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}
export const units=s=>(0.3+0.7*Math.min(slen(s),2)/2)*(s.k?0.45:1);
export const ptAt=(s,u)=>{if(s.t==='l')return[s.x1+(s.x2-s.x1)*u,s.y1+(s.y2-s.y1)*u];if(s.t==='p')return polyAt(s,u);const a=s.a0+(s.a1-s.a0)*u;return[s.cx+Math.cos(a)*s.r,s.cy+Math.sin(a)*s.r]};
const byDist=(a,b)=>{const da=Math.hypot(a[0],a[1]),db=Math.hypot(b[0],b[1]);return Math.abs(da-db)>1e-6?da-db:Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0])};

// Hachures d'un polygone quelconque (règle pair-impair)
export function hatch(poly,ang,sp,k=1){
  const ux=Math.cos(ang),uy=Math.sin(ang),nx=-uy,ny=ux;
  let mn=Infinity,mx=-Infinity;
  for(const[x,y]of poly){const d=x*nx+y*ny;if(d<mn)mn=d;if(d>mx)mx=d}
  const n=Math.floor((mx-mn)/sp),start=mn+((mx-mn)-n*sp)/2,out=[];
  for(let i=0;i<=n;i++){
    const s=start+i*sp;if(s<=mn+1e-5||s>=mx-1e-5)continue;
    const pts=[];
    for(let j=0;j<poly.length;j++){
      const a=poly[j],b=poly[(j+1)%poly.length];
      const da=a[0]*nx+a[1]*ny-s,db=b[0]*nx+b[1]*ny-s;
      if((da<0)!==(db<0)){const t=da/(da-db);pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
    }
    pts.sort((p,q)=>(p[0]*ux+p[1]*uy)-(q[0]*ux+q[1]*uy));
    for(let m=0;m+1<pts.length;m+=2){
      const p=pts[m],q=pts[m+1],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy);
      if(l<0.01)continue;const e=Math.min(0.006,l*0.08);
      out.push(L(p[0]+dx/l*e,p[1]+dy/l*e,q[0]-dx/l*e,q[1]-dy/l*e,k));
    }
  }
  out.forEach((s,i)=>{if(i%2){[s.x1,s.x2]=[s.x2,s.x1];[s.y1,s.y2]=[s.y2,s.y1]}});
  return out;
}

// m = niveau de maîtrise du motif : plus de branches, plus de fils, puis une toile intérieure.
function genStar(d,f,m=0){
  const B=Math.min(10,5+Math.floor(m/2)),n=7+2*d+m,R=0.94,out=[];
  const P=(i,r,off=0)=>{const a=-Math.PI/2+i*TAU/B+off;return[Math.cos(a)*r,Math.sin(a)*r]};
  for(let i=0;i<B;i++){const p=P(i,R);out.push(L(0,0,p[0],p[1]))}
  for(let i=0;i<B;i++)for(let j=1;j<=n;j++){const a=P(i,R*j/(n+1)),b=P(i+1,R*(n+1-j)/(n+1));out.push(L(a[0],a[1],b[0],b[1]))}
  if(m>=3){const n3=Math.max(5,Math.round(n*.6)),R3=R*.78;for(let i=0;i<B;i++)for(let j=1;j<=n3;j++){const a=P(i,R3*j/(n3+1)),b=P(i+2,R3*(n3+1-j)/(n3+1));out.push(L(a[0],a[1],b[0],b[1]))}}
  if(f){
    const n2=Math.max(6,Math.round(n*0.7)),R2=R*0.52,o=Math.PI/B;
    for(let i=0;i<B;i++)for(let j=1;j<=n2;j++){const a=P(i,R2*j/(n2+1),o),b=P(i+1,R2*(n2+1-j)/(n2+1),o);out.push(L(a[0],a[1],b[0],b[1],1))}
    if(f>=2){const n4=Math.max(5,Math.round(n2*.7)),R4=R*.28;for(let i=0;i<B;i++)for(let j=1;j<=n4;j++){const a=P(i,R4*j/(n4+1)),b=P(i+1,R4*(n4+1-j)/(n4+1));out.push(L(a[0],a[1],b[0],b[1],1))}}
  }
  return out;
}
export function spiralCore(P,lv,t,f){
  const k=P.length,out=[],tris=[];
  const edges=Q=>{for(let i=0;i<k;i++){const a=Q[i],b=Q[(i+1)%k];out.push(L(a[0],a[1],b[0],b[1]))}};
  edges(P);
  for(let l=0;l<lv;l++){
    const Q=P.map((p,i)=>{const q=P[(i+1)%k];return[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]});
    for(let i=0;i<k;i+=2)tris.push([Q[i],P[(i+1)%k],Q[(i+1)%k]]);
    edges(Q);P=Q;
  }
  if(f)for(const tr of tris){const a=Math.atan2(tr[1][1]-tr[0][1],tr[1][0]-tr[0][0]);out.push(...hatch(tr,a,0.022));if(f>=2)out.push(...hatch(tr,a+Math.PI/2,0.026))}
  return out;
}
// m : le tourbillon se dédouble en 2×2 (niveau 2), puis 3×3 (niveau 6), avec des sens alternés.
function genWhirl(d,f,m=0){
  const T=m>=6?3:m>=2?2:1,lv=Math.round((12+4*d+2*m)*(T===1?1:T===2?.7:.55)),h=0.92/T,out=[];
  for(let j=0;j<T;j++)for(let i=0;i<T;i++){
    const cx=-0.92+h*(2*i+1),cy=-0.92+h*(2*j+1),mir=(i+j)%2===1;
    const P=mir?[[cx+h,cy-h],[cx-h,cy-h],[cx-h,cy+h],[cx+h,cy+h]]:[[cx-h,cy-h],[cx+h,cy-h],[cx+h,cy+h],[cx-h,cy+h]];
    out.push(...spiralCore(P,lv,0.11,f));
  }
  return out;
}
function genCubes(d,f){
  const R=Math.min(3,1+Math.floor(d/3)),rr=0.92/(R*SQ3+1),out=[],seen=new Set(),faces=[],cells=[];
  for(let q=-R;q<=R;q++)for(let r=-R;r<=R;r++){if(Math.abs(q+r)>R)continue;cells.push([rr*SQ3*(q+r/2),rr*1.5*r])}
  cells.sort(byDist);
  const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3);
  const seg=(a,b)=>{const ka=key(a),kb=key(b),kk=ka<kb?ka+'|'+kb:kb+'|'+ka;if(seen.has(kk))return;seen.add(kk);out.push(L(a[0],a[1],b[0],b[1]))};
  for(const[cx,cy]of cells){
    const v=[];for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;v.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr])}
    const c=[cx,cy];
    for(let i=0;i<6;i++)seg(v[i],v[(i+1)%6]);
    seg(c,v[5]);seg(c,v[1]);seg(c,v[3]);
    faces.push({left:[v[5],c,v[3],v[4]],right:[v[1],v[2],v[3],c],top:[v[0],v[1],c,v[5]]});
  }
  if(f){const sp=rr*0.13;for(const fc of faces){out.push(...hatch(fc.left,Math.PI/2,sp*1.35));if(f>=2)out.push(...hatch(fc.left,Math.PI/6,sp*1.35));out.push(...hatch(fc.right,Math.PI/2,sp*0.8));out.push(...hatch(fc.right,-Math.PI/6,sp*0.8));if(f>=2)out.push(...hatch(fc.top,-Math.PI/6,sp*2.2))}}
  return out;
}
function genFlower(d,f){
  const R=Math.min(3,1+Math.floor(d/3)),rc=0.9/(R+1),out=[],cs=[];
  for(let q=-R;q<=R;q++)for(let r=-R;r<=R;r++){if(Math.abs(q+r)>R)continue;cs.push([rc*(q+r/2),rc*SQ3/2*r])}
  cs.sort(byDist);
  for(const[x,y]of cs){const a0=(Math.abs(x)+Math.abs(y)>1e-9)?Math.atan2(y,x):-Math.PI/2;out.push(A(x,y,rc,a0,a0+TAU))}
  out.push(A(0,0,rc*(R+1),-Math.PI/2,-Math.PI/2+TAU));
  out.push(A(0,0,rc*(R+1)+0.035,-Math.PI/2,-Math.PI/2-TAU));
  if(f)for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){
    const a=cs[i],b=cs[j];if(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-rc)<1e-6)out.push(L(a[0],a[1],b[0],b[1],1));
  }
  if(f>=2)for(const[x,y]of cs)out.push(A(x,y,rc*.5,-Math.PI/2,-Math.PI/2+TAU,1));
  return out;
}
// Triangle impossible : arêtes visibles précalculées (projection isométrique de trois barres)
export const PEN=[{"s":[[-0.001,0.159,-0.184,-0.159],[-0.184,-0.159,-0.001,0.159],[-0.184,-0.797,-0.92,0.478],[-0.174,-0.779,-0.184,-0.797],[-0.184,-0.797,-0.174,-0.779],[0.184,-0.797,-0.184,-0.797],[-0.174,-0.779,0.368,0.159],[0.368,0.159,-0.174,-0.779],[0.92,0.478,0.184,-0.797],[0.736,0.797,0.92,0.478],[0.368,0.159,0.001,0.159],[0.001,0.159,0.368,0.159],[-0.184,0.478,0.92,0.478],[0.92,0.478,-0.184,0.478],[-0.368,0.797,0.736,0.797],[0.001,0.159,0.0,0.159],[0.0,0.159,0.001,0.159],[-0.0,0.159,-0.001,0.159],[-0.001,0.159,0.0,0.159],[0.0,0.159,-0.184,0.478],[-0.368,0.797,-0.0,0.159],[-0.184,0.478,-0.368,0.797],[-0.736,0.797,-0.368,0.797],[-0.726,0.779,-0.736,0.797],[-0.736,0.797,-0.726,0.779],[-0.92,0.478,-0.736,0.797],[-0.184,-0.159,-0.726,0.779],[-0.726,0.779,-0.184,-0.159]],"f":[{"o":"x","p":[[0.92,0.478],[0.184,-0.797],[-0.184,-0.797],[0.368,0.159],[0.0,0.159],[-0.184,0.478]]},{"o":"y","p":[[0.736,0.797],[0.92,0.478],[-0.184,0.478],[-0.368,0.797]]},{"o":"y","p":[[-0.368,0.797],[-0.0,0.159],[-0.184,-0.159],[-0.736,0.797]]}]},{"s":[[-0.153,-0.797,-0.92,0.531],[-0.0,0.0,-0.153,-0.266],[-0.153,-0.266,-0.0,0.0],[-0.145,-0.783,-0.153,-0.797],[-0.153,-0.797,-0.145,-0.783],[0.153,-0.797,-0.153,-0.797],[-0.145,-0.783,0.46,0.266],[0.46,0.266,-0.145,-0.783],[0.92,0.531,0.153,-0.797],[0.767,0.797,0.92,0.531],[0.46,0.266,0.153,0.266],[0.153,0.266,0.46,0.266],[-0.307,0.531,0.92,0.531],[0.92,0.531,-0.307,0.531],[-0.0,0.0,0.153,0.266],[-0.46,0.797,0.767,0.797],[0.153,0.266,-0.153,0.266],[-0.153,0.266,-0.307,0.531],[-0.307,0.531,-0.46,0.797],[-0.46,0.797,-0.0,0.0],[-0.767,0.797,-0.46,0.797],[-0.759,0.783,-0.767,0.797],[-0.767,0.797,-0.759,0.783],[-0.92,0.531,-0.767,0.797],[-0.153,-0.266,-0.759,0.783],[-0.759,0.783,-0.153,-0.266]],"f":[{"o":"x","p":[[0.92,0.531],[0.153,-0.797],[-0.153,-0.797],[0.46,0.266],[-0.153,0.266],[-0.307,0.531]]},{"o":"y","p":[[0.767,0.797],[0.92,0.531],[-0.307,0.531],[-0.46,0.797]]},{"o":"y","p":[[-0.46,0.797],[-0.0,-0.0],[-0.153,-0.266],[-0.767,0.797]]}]},{"s":[[-0.115,-0.797,-0.92,0.598],[-0.0,-0.199,-0.115,-0.398],[-0.115,-0.398,-0.0,-0.199],[-0.11,-0.788,-0.115,-0.797],[-0.115,-0.797,-0.11,-0.788],[0.115,-0.797,-0.115,-0.797],[-0.11,-0.788,0.575,0.398],[0.575,0.398,-0.11,-0.788],[0.92,0.598,0.115,-0.797],[-0.0,-0.199,0.345,0.398],[0.805,0.797,0.92,0.598],[0.575,0.398,0.345,0.398],[0.345,0.398,0.575,0.398],[-0.46,0.598,0.92,0.598],[0.92,0.598,-0.46,0.598],[-0.575,0.797,0.805,0.797],[0.345,0.398,-0.345,0.398],[-0.46,0.598,-0.575,0.797],[-0.345,0.398,-0.46,0.598],[-0.805,0.797,-0.575,0.797],[-0.575,0.797,-0.0,-0.199],[-0.8,0.788,-0.805,0.797],[-0.805,0.797,-0.8,0.788],[-0.92,0.598,-0.805,0.797],[-0.115,-0.398,-0.8,0.788],[-0.8,0.788,-0.115,-0.398]],"f":[{"o":"x","p":[[0.92,0.598],[0.115,-0.797],[-0.115,-0.797],[0.575,0.398],[-0.345,0.398],[-0.46,0.598]]},{"o":"y","p":[[0.805,0.797],[0.92,0.598],[-0.46,0.598],[-0.575,0.797]]},{"o":"y","p":[[-0.575,0.797],[-0.0,-0.199],[-0.115,-0.398],[-0.805,0.797]]}]}];
function genPenrose(d,f){
  const v=PEN[d<3?0:d<6?1:2],out=v.s.map(a=>L(a[0],a[1],a[2],a[3]));
  if(f)for(const fc of v.f){
    if(fc.o==='x'){out.push(...hatch(fc.p,Math.PI/3,0.03));out.push(...hatch(fc.p,-Math.PI/3,0.03))}
    else { out.push(...hatch(fc.p,Math.PI/3,0.05)); if(f>=2)out.push(...hatch(fc.p,-Math.PI/3,0.06)); }
  }
  return out;
}


export const THREADS=['196,52,38','28,70,156','198,146,26','30,120,90'];
export const gcd=(a,b)=>b?gcd(b,a%b):a;
function chunk(pts,n,col,thin){const out=[];for(let i=0;i<pts.length-1;i+=n-1)out.push(PL(pts.slice(i,i+n),col,thin));return out}
function seeded(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- Motifs de base ---------- */
export const PATTERN_GEN = { star: genStar, whirl: genWhirl, cubes: (d,f,m=0)=>genCubes(d+m,f), flower: (d,f,m=0)=>genFlower(d+m,f), penrose: (d,f,m=0)=>genPenrose(d+m,f) };

/* ---------- Machines à dessiner ---------- */
export function filNails(c) { const o = []; for (let i = 0; i < c.N; i++) { const a = -Math.PI / 2 + i * TAU / c.N; o.push([Math.cos(a) * .93, Math.sin(a) * .93]); } return o; }
export function genFilMachine(c) {
  const N = c.N, nl = filNails(c), out = [];
  const path = k => { k = ((k % N) + N) % N || 1; const o = [0]; let start = 0, cur = 0; for (let s = 0; s < N; s++) { let nx = (cur + k) % N; if (nx === start) { o.push(nx); start = (start + 1) % N; nx = start; } o.push(nx); cur = nx; } return o; };
  const lay = [[c.k, THREADS[0]]]; if (c.k2 > 0) lay.push([c.k2, THREADS[1]]);
  for (const [k, col] of lay) { const pth = path(k); for (let i = 0; i < pth.length - 1; i++) { const a = nl[pth[i]], b = nl[pth[i + 1]]; if (a !== b) { const st = L(a[0], a[1], b[0], b[1]); st.col = col; out.push(st); } } }
  return out;
}
export function genSpiroMachine(c) {
  const out = [], R = 96;
  for (let j = 0; j < c.n; j++) {
    const r = Math.max(20, Math.min(90, c.r + [0, -17, 13][j])), d = c.d * [1, .82, .92][j], g = gcd(R, r), Tm = TAU * r / g, k = (R - r) / r, sc = .95 / ((R - r) + d * r), pts = [];
    for (let t = 0; t <= Tm + 1e-9; t += .025) pts.push([((R - r) * Math.cos(t) + d * r * Math.cos(k * t)) * sc, ((R - r) * Math.sin(t) - d * r * Math.sin(k * t)) * sc]);
    out.push(...chunk(pts, 40, THREADS[j]));
  }
  return out;
}
export const HARMO_RATIOS = [[1, 1], [2, 3], [3, 4], [1, 2], [3, 5]];
export function genHarmoMachine(c) {
  const [a, b] = HARMO_RATIOS[c.q], rn = seeded(c.seed || 1), f = [a + c.det, b, a, b + c.det * .7], ph = [rn() * TAU, rn() * TAU, rn() * TAU, rn() * TAU], pts = [];
  for (let t = 0; ; t += .05) { const e = Math.exp(-c.damp * t); pts.push([(.46 * Math.sin(f[0] * t + ph[0]) + .46 * Math.sin(f[1] * t + ph[1])) * e, (.46 * Math.sin(f[2] * t + ph[2] + Math.PI / 2) + .46 * Math.sin(f[3] * t + ph[3])) * e]); if (e < .035) break; }
  return chunk(pts, 48, null, true);
}
export const MACHINE_GEN = { fil: genFilMachine, spiro: genSpiroMachine, harmo: genHarmoMachine };

/* ---------- Folioscope : une image par valeur de p dans [0, 1] ---------- */
// m = niveau de maîtrise de l'animation (un niveau par film terminé) : plus de fils, de tuiles, de cercles.
function tableRing(out, n, mult, off, R, k) {
  const pt = x => { const a = -Math.PI / 2 + TAU * x / n; return [Math.cos(a) * R, Math.sin(a) * R]; };
  for (let i = 0; i < n; i++) { const a = pt(i), b = pt(((i * mult + off) % n + n) % n); if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-3) out.push(L(a[0], a[1], b[0], b[1], k)); }
}
export const FLIP_FRAME = {
  table(p, m = 0) {
    const n = Math.min(300, 120 + 30 * m), mult = 2 + 8 * p, R = .96, out = [A(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU)];
    tableRing(out, n, mult, 0, R, 0);
    if (m >= 2) tableRing(out, Math.round(n / 2), mult + 1, 0, R, 1);
    if (m >= 4) { out.push(A(0, 0, R * .55, -Math.PI / 2, -Math.PI / 2 + TAU)); tableRing(out, Math.round(n / 2), 10 - 8 * p + 2, 0, R * .55, 0); }
    return out;
  },
  whirl(p, m = 0) {
    const T = m >= 5 ? 3 : m >= 2 ? 2 : 1, tw = .03 + .22 * (.5 - .5 * Math.cos(TAU * p)), lv = Math.round((26 + 3 * m) * (T === 1 ? 1 : T === 2 ? .7 : .55)), h = .92 / T, out = [];
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const cx = -.92 + h * (2 * i + 1), cy = -.92 + h * (2 * j + 1), mir = (i + j) % 2 === 1;
      out.push(...spiralCore(mir ? [[cx + h, cy - h], [cx - h, cy - h], [cx - h, cy + h], [cx + h, cy + h]] : [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]], lv, tw, false));
    }
    return out;
  },
  rosace(p, m = 0) {
    const out = [A(0, 0, .98, -Math.PI / 2, -Math.PI / 2 + TAU)], N = 10 + 2 * m, r = .2 + .28 * (.5 - .5 * Math.cos(TAU * p)), D = .98 - r, rot = p * TAU / N;
    for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + i * TAU / N + rot; out.push(A(Math.cos(a) * D, Math.sin(a) * D, r, a, a + TAU)); }
    for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + i * TAU / N - rot * 2; out.push(A(Math.cos(a) * D * .45, Math.sin(a) * D * .45, r * .55, a, a + TAU, 1)); }
    if (m >= 3) for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (i + .5) * TAU / N + rot * 3; out.push(A(Math.cos(a) * D * .72, Math.sin(a) * D * .72, r * .35, a, a + TAU)); }
    return out;
  },
};

/* ---------- Atelier : règles de construction ---------- */
function genFils(c,d,f){
  const B=c.a,s=Math.min(c.b,Math.floor(B/2)),n=Math.round(c.n*(1+.12*d)),R=.94,out=[];
  const P=(i,r)=>{const a=-Math.PI/2+(i%B)*TAU/B;return[Math.cos(a)*r,Math.sin(a)*r]};
  for(let i=0;i<B;i++){const p=P(i,R);out.push(L(0,0,p[0],p[1]))}
  const lim=2*s===B?B/2:B;
  for(let i=0;i<lim;i++)for(let j=1;j<=n;j++){const a=P(i,R*j/(n+1)),b=P(i+s,R*(n+1-j)/(n+1));out.push(L(a[0],a[1],b[0],b[1]))}
  if(f)for(let i=0;i<lim;i++)for(let j=0;j<=n;j++){const a=P(i,R*(j+.5)/(n+1)),b=P(i+s,R*(n+.5-j)/(n+1));out.push(L(a[0],a[1],b[0],b[1],1))}
  return out;
}
function genSpirale(c,d,f){
  const N=c.a,P=[];for(let i=0;i<N;i++){const a=-Math.PI/2+i*TAU/N;P.push([Math.cos(a)*.96,Math.sin(a)*.96])}
  const ys=P.map(p=>p[1]),mid=(Math.min(...ys)+Math.max(...ys))/2;P.forEach(p=>p[1]-=mid);
  return spiralCore(P,Math.min(90,Math.round(c.n*(1+.12*d))),c.b,f);
}
function genTable(c,d,f){
  const n=Math.min(360,Math.round(c.n*(1+.12*d))),m=c.a,o=c.b,R=.92,out=[A(0,0,R,-Math.PI/2,-Math.PI/2+TAU)];
  const pt=x=>{const a=-Math.PI/2+TAU*x/n;return[Math.cos(a)*R,Math.sin(a)*R]};
  const add=(i,mm,k)=>{const j=((i*mm+o)%n+n)%n,p=pt(i),q=pt(j);if(Math.hypot(p[0]-q[0],p[1]-q[1])>1e-3)out.push(L(p[0],p[1],q[0],q[1],k))};
  for(let i=0;i<n;i++)add(i,m,0);
  if(f)for(let i=0;i<n;i+=2)add(i,m+1,1);
  return out;
}
function genRosace(c,d,f){
  const N=c.a,r=c.b,out=[],inner=[];
  for(let q=0;q<c.n;q++){
    const s=Math.pow(.62,q),rr=r*s,D=(.92-r)*s;
    for(let i=0;i<N;i++){const a=-Math.PI/2+i*TAU/N+q*Math.PI/N,x=Math.cos(a)*D,y=Math.sin(a)*D;out.push(A(x,y,rr,a,a+TAU));inner.push([x,y,rr,a])}
  }
  out.push(A(0,0,.955,-Math.PI/2,-Math.PI/2+TAU));
  if(f)for(const[x,y,rr,a]of inner)out.push(A(x,y,rr*.5,a,a-TAU,1));
  return out;
}
export const RULE_GEN = { fils: genFils, spirale: genSpirale, table: genTable, rosace: genRosace };
