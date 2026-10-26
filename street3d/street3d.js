// ===== Street view (3D): Coopers Ave neighbourhood, modelled on OpenStreetMap =====
import * as THREE from 'three';
import {OrbitControls} from './jsm/controls/OrbitControls.js';
import {GLTFLoader} from './jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from './jsm/utils/SkeletonUtils.js';
import {mergeGeometries} from './jsm/utils/BufferGeometryUtils.js';
import {loadAssets, buildSpace, disposeSpace, setScale, setPhone} from './spaces.js';
const A=People.agents, HH=People.households, S=Sim.S, C=Clock, O=Outside, RG=window.R, $=id=>document.getElementById(id);
const BASE=new URL('.',import.meta.url).href;
const phone=Math.min(innerWidth,innerHeight)<600;
const S3={on:false}; window.S3D=S3;
let renderer,scene,camera,controls,sun,hemi,city,interior,data,graph,clips={},models={},houses=[],shops=[],works=[],masjid,edgeNodes=[];
let followed=null, fModel=null, angels=null, qareen=null, carMesh=null, rain=null, pool=[], mode='out', ready=false, curRoom=null;
const ERA={ '1986':{walls:[0xc9a27a,0xb5835a,0xd8c3a0,0xa86b4b],ind:0xb9ad98,roof:0x5a4636,road:0x5b5853,car:[0x8b5a2b,0xc2b280,0x7f1d1d,0x2f4f4f,0xd4c27a]},
 '2006':{walls:[0xe2dccf,0xcfc4b2,0xb8a58c,0xd9d2c4],ind:0xc4c6c8,roof:0x4a4f57,road:0x55575c,car:[0xc0c4c9,0x2b2f36,0x8b1e2a,0xe8e8e8,0x24456b]},
 '2026':{walls:[0xf0f0ec,0xd8dde0,0xc9d0d6,0xe6dfd2],ind:0xd3d7db,roof:0x383d44,road:0x4b4f57,car:[0xffffff,0x1f2328,0x9aa3ad,0x2563eb,0xb91c1c]}};
const hsh=(...x)=>RG.hash(...x);
// ---------- textures made in code ----------
function winTex(lit){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle=lit?'#000':'#fff'; g.fillRect(0,0,64,64);
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){ g.fillStyle=lit?(Math.random()<0.55?'#ffcf7a':'#000'):'#5b6b7d'; g.fillRect(8+x*32,8+y*32,16,18); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t; }
function glowTex(r,g,b){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); const gr=x.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,`rgba(${r},${g},${b},1)`); gr.addColorStop(0.4,`rgba(${r},${g},${b},0.45)`); gr.addColorStop(1,`rgba(${r},${g},${b},0)`); x.fillStyle=gr; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
function patTex(draw,n=128){ const c=document.createElement('canvas'); c.width=c.height=n; draw(c.getContext('2d'),n); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t; }
// ---------- geometry from OSM ----------
function centroid(p){ let x=0,z=0; for(const q of p){x+=q[0];z+=q[1];} return [x/p.length,z/p.length]; }
function walls(poly,h,uvH=3.3){ const pos=[],uv=[],idx=[]; let n=0; const P=poly.concat([poly[0]]);
  for(let i=0;i<P.length-1;i++){ const [x1,z1]=P[i],[x2,z2]=P[i+1]; const L=Math.hypot(x2-x1,z2-z1); if(L<0.1)continue;
    pos.push(x1,0,z1, x2,0,z2, x2,h,z2, x1,h,z1); const u=L/4; uv.push(0,0,u,0,u,h/uvH,0,h/uvH); idx.push(n,n+1,n+2,n,n+2,n+3); n+=4; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function flat(poly,y){ const pts=poly.map(p=>new THREE.Vector2(p[0],p[1])); let tri; try{ tri=THREE.ShapeUtils.triangulateShape(pts,[]); }catch(e){ return null; } const pos=[],uv=[]; for(const p of poly){ pos.push(p[0],y,p[1]); uv.push(p[0]/8,p[1]/8); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); const idx=[]; for(const t of tri) idx.push(t[0],t[2],t[1]); g.setIndex(idx); g.computeVertexNormals(); if(g.attributes.normal.getY(0)<0){ idx.length=0; for(const t of tri) idx.push(t[0],t[1],t[2]); g.setIndex(idx); g.computeVertexNormals(); } return g; }
function gable(poly,h){ // poly is 4-corner house
  const [a,b,c,d]=poly; const L1=Math.hypot(b[0]-a[0],b[1]-a[1]), L2=Math.hypot(c[0]-b[0],c[1]-b[1]);
  let p=L1>=L2?[a,b,c,d]:[b,c,d,a]; const m1=[(p[0][0]+p[3][0])/2,(p[0][1]+p[3][1])/2], m2=[(p[1][0]+p[2][0])/2,(p[1][1]+p[2][1])/2]; const rh=h+2.4;
  const v=[...p[0],...p[1],...m2,...m1, ...p[2],...p[3],...m1,...m2]; const pos=[];
  const Q=(A,B,C,D)=>{ pos.push(A[0],h,A[1],B[0],h,B[1],C[0],rh,C[1], A[0],h,A[1],C[0],rh,C[1],D[0],rh,D[1]); };
  Q(p[0],p[1],m2,m1); Q(p[2],p[3],m1,m2); pos.push(p[1][0],h,p[1][1],p[2][0],h,p[2][1],m2[0],rh,m2[1], p[3][0],h,p[3][1],p[0][0],h,p[0][1],m1[0],rh,m1[1]);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g; }
function ribbon(pts,w,y){ const pos=[],idx=[]; let n=0; for(let i=0;i<pts.length-1;i++){ const [x1,z1]=pts[i],[x2,z2]=pts[i+1]; const L=Math.hypot(x2-x1,z2-z1)||1; const nx=-(z2-z1)/L*w/2, nz=(x2-x1)/L*w/2;
  pos.push(x1+nx,y,z1+nz, x1-nx,y,z1-nz, x2-nx,y,z2-nz, x2+nx,y,z2+nz); idx.push(n,n+2,n+1,n,n+3,n+2); n+=4;
  // round joint
  pos.push(x2,y,z2); const cI=n; n++; for(let k=0;k<=8;k++){ const an=k/8*Math.PI*2; pos.push(x2+Math.cos(an)*w/2,y,z2+Math.sin(an)*w/2); n++; if(k) idx.push(cI,cI+k+1,cI+k); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
let mats={};
function buildCity(){ city=new THREE.Group(); scene.add(city); const E=ERA[O.era];
  mats.ground=new THREE.MeshLambertMaterial({color:0xa9b38f}); const gp=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),mats.ground); gp.rotation.x=-Math.PI/2; gp.receiveShadow=true; city.add(gp);
  const areaG={grass:[],park:[],wood:[],water:[],parking:[]};
  for(const a of data.a){ if(a.line||a.p.length<3)continue; const k=/park|grass|pitch|playground|recreation/.test(a.k)?'grass':/forest|wood/.test(a.k)?'wood':/water/.test(a.k)?'water':a.k==='parking'?'parking':null; if(!k)continue; const g=flat(a.p,k==='parking'?0.03:0.02); if(g) areaG[k].push(g); }
  const AC={grass:0x7fb069,wood:0x5d8f4e,water:0x4f8fc0,parking:0x8c8f93};
  for(const k in areaG) if(areaG[k].length){ const m=new THREE.Mesh(mergeGeometries(areaG[k]),new THREE.MeshLambertMaterial({color:AC[k]})); m.receiveShadow=true; city.add(m); }
  for(const a of data.a) if(a.line){ const m=new THREE.Mesh(ribbon(a.p,4,0.04),new THREE.MeshLambertMaterial({color:0x4f8fc0})); city.add(m); }
  // roads
  const roadG=[],walkG=[],markG=[];
  for(const r of data.r){ const foot=/footway|path|steps|cycleway|pedestrian/.test(r.k); (foot?walkG:roadG).push(ribbon(r.p,r.w,foot?0.07:0.05));
    if(!foot&&r.w>=7){ // sidewalks both sides
      for(const s of [1,-1]){ const off=r.p.map((p,i)=>{ const q=r.p[Math.min(i+1,r.p.length-1)], o=r.p[Math.max(i-1,0)]; const dx=q[0]-o[0], dz=q[1]-o[1], L=Math.hypot(dx,dz)||1; return [p[0]-dz/L*(r.w/2+1.2)*s, p[1]+dx/L*(r.w/2+1.2)*s]; }); walkG.push(ribbon(off,2,0.08)); }
      markG.push(ribbon(r.p,0.25,0.06)); } }
  mats.road=new THREE.MeshLambertMaterial({color:E.road}); const rm=new THREE.Mesh(mergeGeometries(roadG),mats.road); rm.receiveShadow=true; city.add(rm);
  city.add(new THREE.Mesh(mergeGeometries(walkG),new THREE.MeshLambertMaterial({color:0xcfcac0}))); if(markG.length) city.add(new THREE.Mesh(mergeGeometries(markG),new THREE.MeshBasicMaterial({color:0xf2d36b})));
  // buildings
  mats.winDay=winTex(false); mats.winLit=winTex(true);
  const W=E.walls.map(c=>new THREE.MeshLambertMaterial({color:c,map:mats.winDay,emissive:0xffffff,emissiveMap:mats.winLit,emissiveIntensity:0,side:THREE.DoubleSide}));
  const IND=new THREE.MeshLambertMaterial({color:E.ind,map:mats.winDay,emissive:0xffffff,emissiveMap:mats.winLit,emissiveIntensity:0,side:THREE.DoubleSide}); mats.walls=W; mats.ind=IND;
  mats.roof=new THREE.MeshLambertMaterial({color:E.roof,side:THREE.DoubleSide}); mats.flatRoof=new THREE.MeshLambertMaterial({color:0x9a9a96});
  const groups=W.map(()=>[]), ind=[], roofs=[], flats=[];
  for(const b of data.b){ if(O.era==='1986'&&b.h>26&&!b.m) continue; const c=centroid(b.p);
    if(b.m){ masjidMesh(b,c); continue; }
    if(b.gen||b.k==='house'){ groups[hsh(c[0]|0,c[1]|0)%W.length].push(walls(b.p,b.h)); if(b.p.length===4) roofs.push(gable(b.p,b.h)); else { const f=flat(b.p,b.h); f&&flats.push(f); } }
    else { ind.push(walls(b.p,b.h)); const f=flat(b.p,b.h); f&&flats.push(f); } }
  groups.forEach((g,i)=>{ if(g.length){ const m=new THREE.Mesh(mergeGeometries(g),W[i]); m.castShadow=!phone; m.receiveShadow=true; city.add(m);} });
  const im=new THREE.Mesh(mergeGeometries(ind),IND); im.castShadow=!phone; im.receiveShadow=true; city.add(im);
  if(roofs.length){ const m=new THREE.Mesh(mergeGeometries(roofs),mats.roof); m.castShadow=!phone; city.add(m); } if(flats.length) city.add(new THREE.Mesh(mergeGeometries(flats),mats.flatRoof));
  // trees (instanced), along residential roads and in parks
  const tp=[]; const rr=RG.rngFor('trees3d'); for(const r of data.r){ if(!/residential|tertiary|secondary/.test(r.k))continue; for(let i=0;i<r.p.length-1;i++){ const [x1,z1]=r.p[i],[x2,z2]=r.p[i+1]; const L=Math.hypot(x2-x1,z2-z1); for(let s=6;s<L;s+=22){ const f=s/L, nx=-(z2-z1)/L, nz=(x2-x1)/L, sd=rr()<0.5?1:-1; tp.push([x1+(x2-x1)*f+nx*(r.w/2+4)*sd, z1+(z2-z1)*f+nz*(r.w/2+4)*sd, 0.8+rr()*0.6]); } } }
  for(const a of data.a) if(/park|grass|wood|forest/.test(a.k)&&a.p.length>2){ const c=centroid(a.p); for(let i=0;i<6;i++) tp.push([c[0]+(rr()-0.5)*30,c[1]+(rr()-0.5)*30,0.8+rr()*0.7]); }
  const month=C.local(S.t).m, autumn=month>=8&&month<=10, winter=month===11||month<=2;
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18,0.25,2.4,5),new THREE.MeshLambertMaterial({color:0x6b4a2f}),tp.length);
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9,0),new THREE.MeshLambertMaterial({color:0xffffff}),tp.length);
  const M=new THREE.Matrix4(), col=new THREE.Color(); tp.forEach(([x,z,s],i)=>{ M.makeScale(s,s,s).setPosition(x,1.2*s,z); trunk.setMatrixAt(i,M); M.makeScale(s,s*1.1,s).setPosition(x,3.6*s,z); crown.setMatrixAt(i,M);
    col.set(winter?(i%3?0x8a7f6a:0x2f5d3a):autumn?[0xd9822b,0xc0392b,0xe0b030,0x7a9a3a][i%4]:[0x3f8f3f,0x4e9a4a,0x2f7d3a][i%3]); crown.setColorAt(i,col); });
  crown.castShadow=!phone; city.add(trunk,crown);
  // cars (instanced) on real roads
  const carRoads=data.r.filter(r=>/primary|secondary|tertiary|residential|unclassified|service/.test(r.k)&&r.p.length>1);
  const NC=phone?30:60; carMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.8,1.4,4.2),new THREE.MeshLambertMaterial({color:0xffffff}),NC); carMesh.userData.cars=[];
  for(let i=0;i<NC;i++){ const r=carRoads[hsh('car',i)%carRoads.length]; carMesh.userData.cars.push({r,ph:(hsh('cp',i)%1000)/1000,sp:0.6+(hsh('cs',i)%100)/100,dir:i%2?1:-1}); col.set(E.car[i%E.car.length]); carMesh.setColorAt(i,col); }
  carMesh.castShadow=!phone; city.add(carMesh);
  // street lights (glow sprites) along main roads
  const lt=glowTex(255,210,140); mats.lamps=[]; for(const r of carRoads.filter(r=>/primary|secondary|tertiary/.test(r.k))) for(let i=0;i<r.p.length-1;i+=1){ const [x,z]=r.p[i]; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:lt,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0})); sp.position.set(x+r.w/2+1.5,6,z); sp.scale.set(6,6,1); city.add(sp); mats.lamps.push(sp);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,6,4),new THREE.MeshLambertMaterial({color:0x555555})); pole.position.set(x+r.w/2+1.5,3,z); city.add(pole); }
}
function masjidMesh(b,c){ const g=new THREE.Group(); const wm=new THREE.MeshLambertMaterial({color:0xf3efe6,side:THREE.DoubleSide}); const m=new THREE.Mesh(walls(b.p,b.h+1),wm); m.castShadow=true; g.add(m); const f=flat(b.p,b.h+1); if(f) g.add(new THREE.Mesh(f,new THREE.MeshLambertMaterial({color:0xddd6c8})));
  const dome=new THREE.Mesh(new THREE.SphereGeometry(5,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshLambertMaterial({color:O.era==='1986'?0x2e7d6b:0x3aa17e})); dome.position.set(c[0],b.h+1,c[1]); g.add(dome);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(0.3,2,8),new THREE.MeshLambertMaterial({color:0xe6c35c})); tip.position.set(c[0],b.h+7,c[1]); g.add(tip);
  const mp=b.p[0]; const min=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,b.h+12,10),wm); min.position.set(mp[0],(b.h+12)/2,mp[1]); min.castShadow=true; g.add(min);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(1.4,3.5,10),new THREE.MeshLambertMaterial({color:0x3aa17e})); cap.position.set(mp[0],b.h+13.7,mp[1]); g.add(cap);
  const sign=makeLabel(b.n||'Jame Masjid',true); sign.position.set(c[0],b.h+11,c[1]); g.add(sign); city.add(g); }
function makeLabel(t,big){ const c=document.createElement('canvas'); const x=c.getContext('2d'); x.font='bold 40px system-ui'; const w=x.measureText(t).width+40; c.width=w; c.height=64; x.font='bold 40px system-ui'; x.fillStyle='rgba(255,255,255,0.9)'; x.fillRect(0,0,w,64); x.fillStyle='#14532d'; x.fillText(t,20,46);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:true})); s.scale.set(w/64*(big?3:1.5),big?3:1.5,1); return s; }
// ---------- road graph for walking real paths ----------
function buildGraph(){ const nodes=new Map(), key=(p)=>Math.round(p[0]*2)+','+Math.round(p[1]*2); const get=p=>{ const k=key(p); if(!nodes.has(k)) nodes.set(k,{p,e:[]}); return nodes.get(k); };
  for(const r of data.r){ if(/motorway|trunk/.test(r.k))continue; for(let i=0;i<r.p.length-1;i++){ // split long edges
      const a=r.p[i], b=r.p[i+1]; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const n=Math.max(1,Math.ceil(L/25)); let prev=get(a); for(let k=1;k<=n;k++){ const q=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]; const nd=get(q); const d=L/n; prev.e.push([nd,d]); nd.e.push([prev,d]); prev=nd; } } }
  graph=[...nodes.values()]; graph.forEach((n,i)=>n.i=i);
  // edge nodes (leaving the area) = nodes far from centre on big roads
  edgeNodes=graph.filter(n=>Math.hypot(n.p[0],n.p[1])>700); }
function nearest(p){ let b=null,bd=1e9; for(const n of graph){ const d=(n.p[0]-p[0])**2+(n.p[1]-p[1])**2; if(d<bd&&n.e.length){bd=d;b=n;} } return b; }
const routeCache=new Map();
function route(p1,p2){ const k=p1.join()+'>'+p2.join(); if(routeCache.has(k)) return routeCache.get(k); const s=nearest(p1), t=nearest(p2); const dist=new Float64Array(graph.length).fill(Infinity), prev=new Int32Array(graph.length).fill(-1); dist[s.i]=0; const open=[s]; const seen=new Uint8Array(graph.length);
  while(open.length){ let bi=0; for(let i=1;i<open.length;i++) if(dist[open[i].i]+h(open[i])<dist[open[bi].i]+h(open[bi])) bi=i; const u=open.splice(bi,1)[0]; if(u===t)break; if(seen[u.i])continue; seen[u.i]=1;
    for(const [v,d] of u.e){ const nd=dist[u.i]+d; if(nd<dist[v.i]){ dist[v.i]=nd; prev[v.i]=u.i; open.push(v); } } }
  function h(n){ return Math.hypot(n.p[0]-t.p[0],n.p[1]-t.p[1]); }
  const path=[p2]; let c=t.i; while(c>=0){ path.push(graph[c].p); if(c===s.i)break; c=prev[c]; } path.push(p1); path.reverse();
  const cum=[0]; for(let i=1;i<path.length;i++) cum.push(cum[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  const r={path,cum,L:cum[cum.length-1]}; if(routeCache.size>300) routeCache.clear(); routeCache.set(k,r); return r; }
function along(r,f){ const d=Math.max(0,Math.min(1,f))*r.L; let i=1; while(i<r.cum.length-1&&r.cum[i]<d)i++; const a=r.path[i-1], b=r.path[i], seg=r.cum[i]-r.cum[i-1]||1, k=(d-r.cum[i-1])/seg; return {x:a[0]+(b[0]-a[0])*k, z:a[1]+(b[1]-a[1])*k, dir:Math.atan2(b[0]-a[0],b[1]-a[1])}; }
// ---------- where sim places are in this neighbourhood ----------
function placeOf(a,pid){ if(pid==='home'||!pid) return {kind:'home',p:homeOf(a)};
  if(pid.startsWith('hh')){ const hh=HH[+pid.slice(2)]; return {kind:'home',p:houses[hsh('hh',hh.id)%houses.length].door,visit:true}; }
  if(pid==='away') return {kind:'away',p:edgeNodes.length?edgeNodes[hsh('edge',a.id)%edgeNodes.length].p:[600,600]};
  const pl=World.place(pid); if(pl&&pl.kind==='mosque') return {kind:'mosque',p:masjid.door};
  if(pl&&['market','plaza','mall'].includes(pl.kind)) return {kind:'shop',p:shops[hsh(pid)%shops.length].door};
  if(pl&&pl.kind==='school') return {kind:'school',p:(works.find(w=>w.k==='school')||works[0]).door};
  if(pl&&['park','eidground','square'].includes(pl.kind)) return {kind:'park',p:parkSpot(pid)};
  return {kind:'work',p:works[hsh(pid)%works.length].door}; }
function homeOf(a){ return houses[hsh('hh',a.hh)%houses.length].door; }
function parkSpot(pid){ const ps=data.a.filter(a=>/park|grass|pitch/.test(a.k)&&a.p.length>2); if(!ps.length) return [0,60]; return centroid(ps[hsh(pid)%ps.length].p); }
function prepPlaces(){ for(const b of data.b){ const c=centroid(b.p); const door=nearest(c)?nearest(c).p:c; const rec={c,door:[c[0]+(door[0]-c[0])*0.55,c[1]+(door[1]-c[1])*0.55],k:b.k,b};
    if(b.m) masjid=rec; else if(b.gen||b.k==='house') houses.push(rec); else if(/commercial|retail/.test(b.k)||(b.k==='yes'&&b.h<8)) shops.push(rec); else works.push(rec); }
  if(!shops.length) shops=works.slice(0,5); }
// ---------- people ----------
async function loadModels(){ const L=new GLTFLoader(); const [r,m]=await Promise.all([L.loadAsync(BASE+'rogue.glb'),L.loadAsync(BASE+'mage.glb')]); models.casual=r.scene; models.robe=m.scene; for(const c of r.animations) clips[c.name]=c;
  const box=new THREE.Box3().setFromObject(models.casual); const h=box.max.y-box.min.y; if(h>0.2&&h<20) setScale((h*0.62)/1.7); }
function dressFor(a){ const robe=(a.gender==='f'&&a.age>=12)||(a.gender==='m'&&a.age>=16&&hsh('thobe',a.id)%3===0); return robe?'robe':'casual'; }
function makePerson(a){ const src=models[dressFor(a)]; const o=SkeletonUtils.clone(src); const s=a.age<5?0.45:a.age<12?0.65:a.age<16?0.85:1; o.scale.setScalar(s*0.62);
  const tint=new THREE.Color(a.cloth||'#777'); o.traverse(n=>{ if(n.isMesh){ n.castShadow=!phone; n.frustumCulled=false; n.material=n.material.clone(); if(/Body|Leg|Arm/.test(n.name)) n.material.color.lerp(tint,0.55); if(/Head/.test(n.name)&&a.gender==='f') n.material.color.set(0xffffff); } });
  const head=findBone(o,'head');
  if(head){ if(a.gender==='f'&&a.age>=12){ const hj=new THREE.Mesh(new THREE.SphereGeometry(0.5,20,12,Math.PI/2+0.75,Math.PI*2-1.5,0,Math.PI*0.62),new THREE.MeshLambertMaterial({color:new THREE.Color(a.hijab||'#335'),side:THREE.DoubleSide})); hj.position.set(0,0.5,-0.06); hj.scale.set(1.12,1.1,1.1); head.add(hj);
      const dr=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.85,0.7,16,1,true),hj.material); dr.geometry=new THREE.CylinderGeometry(0.62,0.85,0.7,20,1,true,0.8,Math.PI*2-1.6); dr.position.set(0,0.0,-0.02); head.add(dr); }
    else if(a.gender==='m'&&a.kufi){ const k=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.42,0.18,16),new THREE.MeshLambertMaterial({color:0xf4f4f4})); k.position.set(0,0.98,0); head.add(k); }
    if(a.beard){ const bd=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.2,0.14),new THREE.MeshLambertMaterial({color:new THREE.Color(a.hair||'#222')})); bd.position.set(0,-0.06,0.42); head.add(bd); } }
  const mixer=new THREE.AnimationMixer(o); const P={a,o,mixer,acts:{},cur:null,head,hand:findBone(o,'handslot.r')};
  for(const n of ['Idle','Walking_A','Walking_B','Sit_Chair_Idle','Sit_Floor_Idle','Interact','Cheer','Lie_Idle','Use_Item']) if(clips[n]) P.acts[n]=mixer.clipAction(clips[n]);
  play(P,'Idle'); return P; }
function setProp(m,prop){ if(m.propK===prop) return; if(m.propO&&m.propO.parent) m.propO.parent.remove(m.propO); m.propK=prop; m.propO=null; if(!prop||!(m.head||m.hand)) return;
  const L=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0x000000}); let g;
  if(['phone','flip','bb','ipod','walkman'].includes(prop)){ g=new THREE.Group(); const body=new THREE.Mesh(new THREE.BoxGeometry(prop==='phone'?0.32:0.26,prop==='phone'?0.6:0.42,0.06),L(prop==='walkman'?0xc0392b:0x3a4250,0x111822)); g.add(body); const sc=new THREE.Mesh(new THREE.PlaneGeometry(prop==='phone'?0.28:0.2,prop==='phone'?0.52:0.2),new THREE.MeshBasicMaterial({color:prop==='phone'?0xbfe8ff:0xc8f0c8,side:THREE.DoubleSide})); sc.position.z=0.035; if(prop!=='walkman') g.add(sc); g.rotation.x=-0.6; }
  else if(prop==='paper'||prop==='letter'||prop==='cards'){ g=new THREE.Mesh(new THREE.PlaneGeometry(prop==='paper'?1.1:0.45,prop==='paper'?1.4:0.6),new THREE.MeshLambertMaterial({color:0xf1eee4,side:THREE.DoubleSide})); g.rotation.x=-0.9; }
  else if(prop==='landline'){ g=new THREE.Mesh(new THREE.CapsuleGeometry(0.08,0.55,4,8),L(0xe8dcc8)); g.rotation.z=1.2; }
  else if(prop==='radio'){ g=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.35,0.2),L(0x333333)); }
  else if(prop==='laptop'){ g=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.55),L(0x9aa3ad,0x223344)); }
  if(!g) return; const hd=m.head||m.hand; if(prop==='landline'){ g.position.set(0.5,0.2,0.15); g.rotation.set(0,0,0.3); }
  else if(prop==='paper'||prop==='letter'||prop==='cards'){ g.position.set(0,-0.45,0.75); g.rotation.set(-0.5,0,0); }
  else if(prop==='laptop'||prop==='radio'){ g.position.set(0,-0.75,0.8); g.rotation.set(0,0,0); }
  else { g.position.set(0.18,-0.4,0.62); g.rotation.set(-0.45,0,0); }
  hd.add(g); m.propO=g; }
function findBone(o,name){ let b=null; o.traverse(n=>{ if(!b&&n.isBone&&n.name===name) b=n; }); return b; }
function play(P,name){ if(P.cur===name||!P.acts[name])return; const nx=P.acts[name]; nx.reset().fadeIn(0.3).play(); if(P.cur&&P.acts[P.cur]) P.acts[P.cur].fadeOut(0.3); P.cur=name; }
const PRAY=new Set(['pray','jumuah','taraweeh','tahajjud','eid','itikaf']);
function pose(P,act,moving,mode){ if(moving){ play(P,mode==='run'?'Walking_B':'Walking_A'); return null; }
  const h=P.poseHint;
  if(h==='lie'){ play(P,'Idle'); return null; }
  if(h==='sit'){ play(P,'Sit_Chair_Idle'); return null; }
  if(h==='floor'){ play(P,'Sit_Floor_Idle'); return null; }
  if(h==='cheer'){ play(P,'Cheer'); return null; }
  if(h==='use'){ play(P,P.acts['Use_Item']?'Use_Item':'Interact'); return null; }
  if(h==='stand'){ play(P,'Idle'); return null; }
  if(h==='pray'||PRAY.has(act)) return prayerPhase(P); if(act==='sleep') { play(P,'Lie_Idle'); return null; }
  if(['eat','learn','dhikr'].includes(act)) { play(P,'Sit_Floor_Idle'); return null; } if(['phone','visit'].includes(act)){ play(P,'Sit_Chair_Idle'); return null; }
  if(act==='work'||act==='school') { play(P,P.a.labour?'Use_Item':'Interact'); return null; } if(act==='play') { play(P,'Cheer'); return null; }
  play(P,'Idle'); return null; }
// procedural prayer: qiyam, ruku, back up, sujud, sit, sujud (loops)
function prayerPhase(P){ const t=(performance.now()/1000+P.a.id*0.7)%18; let ph= t<6?'qiyam':t<9?'ruku':t<10?'itidal':t<12.5?'sujud':t<14?'jalsa':t<16.5?'sujud':'jalsa';
  play(P, (ph==='sujud'||ph==='jalsa')?'Sit_Floor_Idle':'Idle'); P.phase=ph; return ph; }
function applyPrayerBones(P){ if(!P.phase)return; const o=P.o; const sp=findB(P,'spine'), ch=findB(P,'chest'), hd=findB(P,'head'), ua=[findB(P,'upperarm.l'),findB(P,'upperarm.r')], la=[findB(P,'lowerarm.l'),findB(P,'lowerarm.r')], hips=findB(P,'hips');
  if(P.phase==='qiyam'){ ua.forEach((u,i)=>u&&(u.rotation.z+= (i?-1:1)*-0.9, u.rotation.x-=0.5)); la.forEach((l,i)=>l&&(l.rotation.y+=(i?1:-1)*1.3)); }
  if(P.phase==='ruku'){ if(sp) sp.rotation.x+=0.75; if(ch) ch.rotation.x+=0.6; if(hd) hd.rotation.x-=0.2; ua.forEach(u=>u&&(u.rotation.x+=0.4)); }
  if(P.phase==='sujud'){ if(hips){ hips.rotation.x+=0.9; hips.position.y-=0.25; } if(sp) sp.rotation.x+=0.6; if(ch) ch.rotation.x+=0.4; ua.forEach(u=>u&&(u.rotation.x-=1.2)); }
  if(P.phase==='jalsa'){ ua.forEach(u=>u&&(u.rotation.x+=0.2)); } }
function findB(P,n){ P.bones=P.bones||{}; if(!(n in P.bones)) P.bones[n]=findBone(P.o,n); return P.bones[n]; }
// ---------- angels & Qareen on the followed person ----------
function makeAngel(color){ const g=new THREE.Group(); const m=new THREE.MeshBasicMaterial({color}); const body=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.26,10),m); body.position.y=0.13; const head=new THREE.Mesh(new THREE.SphereGeometry(0.06,12,8),m); head.position.y=0.31;
  const wingM=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7,side:THREE.DoubleSide}); const ws=new THREE.Shape(); ws.moveTo(0,0); ws.quadraticCurveTo(0.18,0.2,0.22,0.02); ws.quadraticCurveTo(0.12,0.04,0,-0.06);
  const w1=new THREE.Mesh(new THREE.ShapeGeometry(ws),wingM); w1.position.set(0.03,0.2,-0.03); const w2=w1.clone(); w2.scale.x=-1; w2.position.x=-0.03;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(...new THREE.Color(color).toArray().map(v=>v*255|0)),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); halo.scale.set(0.9,0.9,1); halo.position.y=0.2;
  const light=new THREE.PointLight(color,0.6,2.5); light.position.y=0.2; g.add(body,head,w1,w2,halo,light); g.userData={w1,w2}; return g; }
function makeQareen(){ const g=new THREE.Group(); const tx=glowTex(30,12,45); for(let i=0;i<9;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false,opacity:0.55})); s.userData.ph=i*0.7; g.add(s); } return g; }
// ---------- which room this moment belongs in ----------
function placeMeta(a,pid){
  if(!pid||pid==='home') return {kind:'home',id:'home:'+a.hh,name:(HH[a.hh]&&HH[a.hh].surname?HH[a.hh].surname+' home':'home'),hh:a.hh};
  if(pid==='away') return {kind:'away',id:'away',name:'away',hh:a.hh};
  if(String(pid).startsWith('hh')){ const hh=+pid.slice(2); const host=HH[hh]; return {kind:'home',id:'visit:'+hh,name:host&&host.surname?host.surname+' home':'a visit',hh}; }
  const pl=World.place(pid); if(!pl) return {kind:'work',id:String(pid),name:'work',hh:a.hh};
  return {kind:pl.kind,id:pl.id,name:pl.name,hh:a.hh,size:pl.size||1};
}
function homeKindOf(hh){ const h=HH[hh]; const m=h&&h.members&&h.members[0]; return m&&m.home?m.home.kind:'house'; }
function specFor(a,p){
  if(!p) return null;
  const b=p.b||{}; const act=b.act||'home'; const pid=b.pid||'home';
  if(p.moving&&(p.mode==='walk'||!p.mode)) return null; // real Coopers Ave
  const era=O.era; const pl=placeMeta(a,pid); const hh=pl.hh!=null?pl.hh:a.hh;
  const ill=!!(a.plan&&a.plan.flags&&a.plan.flags.ill);
  const base={era,act,occ:a.occ,age:a.age,gender:a.gender,homeKind:homeKindOf(hh),placeName:pl.name||'',placeId:pl.id,wealth:HH[a.hh]?HH[a.hh].wealth:40,size:pl.size||1,ill,hh};
  const finish=(o)=>{ o.seed=o.seed>>>0; o.key=[o.type,o.era,o.seed].join(':'); return o; };
  if(p.moving&&p.mode==='car') return finish({...base,type:'car',seed:hsh('car',a.id,era),label:'🚗 In the car'+(roadName(p)?' · '+roadName(p):''),outdoor:false});
  if(p.moving&&p.mode==='bus') return finish({...base,type:'bus',seed:hsh('bus',era,a.id%4),label:'🚌 On the bus',outdoor:false});
  if(act==='away'||pl.kind==='away') return finish({...base,type:'airport',seed:hsh('air',era),label:'✈️ Airport — travelling',outdoor:false});
  const atHome=pl.kind==='home'; const atMosque=pl.kind==='mosque';
  if(atMosque&&(act==='dhikr'||(act==='pray'&&hsh('wudu',a.id,b.s|0)%5===0))) return finish({...base,type:'wudu',seed:hsh('wudu',pl.id,era),label:'🕌 Wudu area — '+pl.name,outdoor:false});
  if(atMosque&&['pray','jumuah','taraweeh','itikaf','eid'].includes(act)) return finish({...base,type:'prayerhall',seed:hsh('hall',pl.id,era),label:'🕌 Prayer hall — '+pl.name,outdoor:false});
  if(atMosque&&act==='eat') return finish({...base,type:'iftar',seed:hsh('iftar',pl.id,era),label:'🍽️ Masjid dining room — '+pl.name,outdoor:false});
  if(atMosque&&act==='learn') return finish({...base,type:a.occ==='imam'?'imam':'halaqah',seed:hsh('hal',pl.id,era,a.occ==='imam'?'i':'h'),label:(a.occ==='imam'?"🕌 Imam's office — ":'📚 Halaqah — ')+pl.name,outdoor:false});
  if(act==='eid'||pl.kind==='eidground') return finish({...base,type:'eid',seed:hsh('eid',era),label:'🕌 Eid prayer ground',outdoor:true});
  if(act==='sleep'||(ill&&atHome&&['pray','home','phone'].includes(act))) return finish({...base,type:'bedroom',seed:hsh('bed',hh,era,a.age<14?'k':'a'),label:a.age<14?'🛏️ Kids’ bedroom':'🛏️ Bedroom',outdoor:false});
  if(act==='tahajjud'||(atHome&&(act==='pray'||act==='dhikr'))) return finish({...base,type:'musalla',variant:'home',seed:hsh('mus',hh,era),label:'🕌 Prayer corner at home',outdoor:false});
  if(act==='eat'&&atHome) return finish({...base,type:'kitchen',seed:hsh('kit',hh,era),label:'🍳 Kitchen',outdoor:false});
  if(act==='eat') return finish({...base,type:'restaurant',seed:hsh('rest',pl.id,era),label:'🍽️ Restaurant'+(pl.name?' — '+pl.name:''),outdoor:false});
  if(act==='phone'||(atHome&&b.prop&&['tv','radio','pc','laptop','flip','bb','ipod','walkman','paper','letter','cards'].includes(b.prop))) return finish({...base,type:'living',seed:hsh('liv',hh,era),label:'🛋️ Living room',outdoor:false});
  if(act==='visit') return finish({...base,type:'living',seed:hsh('liv',hh,era),label:'🛋️ Living room — visiting '+pl.name,outdoor:false});
  if(act==='school'||(act==='work'&&a.occ==='teacher')||(act==='learn'&&pl.kind==='school')) return finish({...base,type:'classroom',seed:hsh('cls',pl.id,era),label:'🏫 Classroom — '+pl.name,outdoor:false});
  if(act==='learn'&&pl.kind==='campus') return finish({...base,type:'lecture',seed:hsh('lec',pl.id,era),label:'🎓 Lecture room — '+pl.name,outdoor:false});
  if(act==='learn') return finish({...base,type:'study',seed:hsh('stu',hh,era),label:'📚 Study',outdoor:false});
  if(act==='work'||act==='market'){
    if(a.occ==='nurse'||a.occ==='doctor'||pl.kind==='hospital') return finish({...base,type:'hospital',seed:hsh('hosp',pl.id,era,a.id%3),label:'🏥 '+(pl.name||'Hospital'),outdoor:false});
    if(a.occ==='shop'||a.occ==='retail'||act==='market'||['market','mall','plaza'].includes(pl.kind)){ const mall=pl.kind==='mall'||a.occ==='retail'; return finish({...base,type:mall?'shopmall':'grocery',seed:hsh('shop',pl.id,era,mall?a.id%3:0),label:(mall?'👗 Shop — ':'🛒 Market — ')+(pl.name||''),outdoor:false}); }
    if(a.occ==='warehouse'||pl.kind==='industry') return finish({...base,type:'warehouse',seed:hsh('wh',pl.id,era),label:'📦 Warehouse',outdoor:false});
    if(a.occ==='airport'||pl.kind==='airport') return finish({...base,type:'airport',seed:hsh('air',pl.id,era,a.id%2),label:'✈️ '+(pl.name||'Airport'),outdoor:false});
    if(a.occ==='driver') return finish({...base,type:'car',seed:hsh('car',a.id,era),label:'🚗 In the car — working',outdoor:false});
    if(a.occ==='builder') return finish({...base,type:'site',seed:hsh('site',era,a.id%2),label:'🏗️ Work site',outdoor:true});
    if(a.occ==='imam') return finish({...base,type:'imam',seed:hsh('imam',pl.id,era),label:"🕌 Imam's office — "+(pl.name||''),outdoor:false});
    if(pl.kind==='school') return finish({...base,type:'classroom',seed:hsh('cls',pl.id,era),label:'🏫 '+pl.name,outdoor:false});
    return finish({...base,type:'office',seed:hsh('off',pl.id,era,a.id%4),label:'🏢 Office — '+(pl.name||a.job||'work'),outdoor:false});
  }
  if((act==='play'||act==='outing')&&(pl.kind==='park'||pl.kind==='square')) return finish({...base,type:'park',seed:hsh('park',pl.id,era),label:'🌳 '+(pl.name||'Park'),outdoor:true});
  if(act==='play') return finish({...base,type:'yard',seed:hsh('yard',hh,era),label:'🏡 Outside the house',outdoor:true});
  if(act==='outing'){ const shop=['market','mall','plaza'].includes(pl.kind); const mall=pl.kind==='mall'; return finish({...base,type:shop?(mall?'shopmall':'grocery'):'park',seed:hsh('out',pl.id,era),label:(shop?(mall?'👗 Shop — ':'🛒 Market — '):'🌳 ')+(pl.name||'Outing'),outdoor:!shop}); }
  if(act==='walk') return finish({...base,type:'street',seed:hsh('gate',pl.id,era),label:'🚶 Outside — '+(pl.name||'the street'),outdoor:true});
  if(act==='pray'){ const home=atHome; return finish({...base,type:'musalla',variant:home?'home':'work',seed:hsh('mus',home?hh:pl.id,era,home?'h':'w'),label:home?'🕌 Prayer corner at home':'🕌 Quiet prayer room',outdoor:false}); }
  if(pl.kind==='park'||pl.kind==='square') return finish({...base,type:'park',seed:hsh('park',pl.id,era),label:'🌳 '+(pl.name||'Park'),outdoor:true});
  if(atHome){
    if(/homework|Qur'an|reading/i.test(b.txt||'')) return finish({...base,type:'study',seed:hsh('stu',hh,era),label:'📚 Study',outdoor:false});
    return finish({...base,type:'living',seed:hsh('liv',hh,era),label:'🛋️ Living room',outdoor:false});
  }
  if(pl.kind==='hospital') return finish({...base,type:'hospital',seed:hsh('hosp',pl.id,era),label:'🏥 '+pl.name,outdoor:false});
  if(pl.kind==='school') return finish({...base,type:'classroom',seed:hsh('cls',pl.id,era),label:'🏫 '+pl.name,outdoor:false});
  return finish({...base,type:'office',seed:hsh('off',pl.id,era),label:'🏢 '+(pl.name||'Indoors'),outdoor:false});
}
function dropRoom(){ if(!curRoom) return; scene.remove(curRoom); disposeSpace(curRoom); curRoom=null; clearRoomPeople(); spaceId=''; }
function clearCam(cam, room, rs){ const ud=room.userData, R0=room.position;
  if(ud.outdoor){ if(cam.y<R0.y+0.7) cam.y=R0.y+0.7; return; }
  const hx=(ud.W||6)/2*rs+0.62*rs, hz=(ud.D||5)/2*rs+0.62*rs, hy=2.5*rs;
  const dx=cam.x-R0.x, dy=cam.y-R0.y, dz=cam.z-R0.z;
  if(Math.abs(dx)>=hx||Math.abs(dz)>=hz||dy>=hy||dy<-0.25) return;
  if(ud.type==='car'||ud.type==='bus'){ cam.x=R0.x+hx; return; }
  if((hx-dx)<(hz-dz)) cam.x=R0.x+hx; else cam.z=R0.z+hz;
  if(cam.y<R0.y+0.85*rs) cam.y=R0.y+0.85*rs; }
// ---------- setup ----------
async function init(){ const box=$('s3d'); renderer=new THREE.WebGLRenderer({antialias:!phone,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,phone?1.25:1.75)); renderer.shadowMap.enabled=!phone; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace;
  box.prepend(renderer.domElement); renderer.domElement.id='s3dc';
  scene=new THREE.Scene(); scene.fog=new THREE.Fog(0xbfd6ea,phone?120:200,phone?420:700);
  camera=new THREE.PerspectiveCamera(55,1,0.05,phone?500:800); controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=0.9; controls.maxDistance=260; controls.maxPolarAngle=Math.PI*0.495; controls.target.set(0,1,0); camera.position.set(6,4,8);
  hemi=new THREE.HemisphereLight(0xdfefff,0x6b7a52,1.2); scene.add(hemi); sun=new THREE.DirectionalLight(0xfff1d6,2.2); sun.castShadow=!phone; sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=sc.bottom=-40; sc.right=sc.top=40; sc.near=1; sc.far=300; scene.add(sun,sun.target);
  S3.stage='fetch'; data=await (await fetch(BASE+'coopers.json')).json(); S3.stage='graph'; buildGraph(); S3.stage='places'; prepPlaces(); S3.stage='city'; buildCity(); S3.stage='models'; await loadModels(); setPhone(phone); S3.stage='assets';
  const msg=$('s3dLoadMsg'); await loadAssets(new GLTFLoader(),(d,n)=>{ if(msg) msg.textContent='Loading rooms and furniture… '+d+' / '+n; }); S3.stage='extras';
  angels=[makeAngel(0xffd678),makeAngel(0xdfe8ff)]; qareen=makeQareen(); scene.add(angels[0],angels[1],qareen);
  const rg=new THREE.BufferGeometry(); const N=phone?600:1500; const rp=new Float32Array(N*3); for(let i=0;i<N;i++){ rp[i*3]=(Math.random()-0.5)*60; rp[i*3+1]=Math.random()*30; rp[i*3+2]=(Math.random()-0.5)*60; } rg.setAttribute('position',new THREE.BufferAttribute(rp,3)); rain=new THREE.Points(rg,new THREE.PointsMaterial({color:0xcfe0ff,size:0.12,transparent:true,opacity:0.7})); scene.add(rain);
  addEventListener('resize',size); size(); ready=true; S3.stage='ready'; }
function size(){ if(!renderer)return; const w=innerWidth,h=innerHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); }
// ---------- per-frame ----------
const tmpV=new THREE.Vector3(); let lastEra=null, lastT=performance.now(), extras=new Map(), roomPeople=[], spaceId='', framed=false;
function pos3(a,t){ const loc=Sim.locate(a,t); if(!loc) return null; const b=loc.b||{};
  if(loc.moving){ const from=loc.from||b; const p1=placeOf(a,from.pid).p, p2=placeOf(a,b.pid).p; const tm=(t-a.dayMid)/60000; const here=a._slot?a._slot(from):a.home, there=a._slot?a._slot(b):a.home; const tr=Sim.travelMin(here,there,a); const dep=b.s-tr.m; const f=Math.max(0,Math.min(1,(tm-dep)/tr.m));
    const r=route(p1,p2); const q=along(r,f); return {x:q.x,z:q.z,dir:q.dir,moving:true,mode:loc.mode,act:b.act,b,inside:false}; }
  const pl=placeOf(a,b.pid); const ins=pl.kind==='home'||pl.kind==='mosque'; let sp=pl.p; if(!ins){ const nn=nearest(pl.p); if(nn) sp=[nn.p[0]+1.5,nn.p[1]+1.5]; } return {x:sp[0],z:sp[1],dir:0,moving:false,act:b.act,b,inside:pl.kind==='home'||pl.kind==='mosque',kind:pl.kind,pid:b.pid}; }
function frame(){ if(!S3.on){ framed=false; return; } requestAnimationFrame(frame); if(!ready)return; const now=performance.now(), dt=Math.min(0.1,(now-lastT)/1000); lastT=now; const t=S.t, a=UI.selected; if(!a){ S3.exit(); return; }
  if(lastEra!==O.era){ lastEra=O.era; scene.remove(city); buildCity(); if(fModel){ scene.remove(fModel.o); fModel=null; } dropRoom(); }
  if(!fModel||fModel.a!==a){ if(fModel) scene.remove(fModel.o); fModel=makePerson(a); scene.add(fModel.o); followed=a; }
  const p=pos3(a,t); if(!p) return;
  const spec=specFor(a,p); const id=spec?spec.key:'';
  let snapCam=false;
  if(id!==spaceId){ dropRoom(); spaceId=id; if(spec){ curRoom=buildSpace(spec); curRoom.position.set(0,-500,0); scene.add(curRoom); fillRoom(a,spec); snapCam=true; } }
  city.visible=!curRoom;
  const o=fModel.o; let tx,ty,tz; const rs=curRoom?curRoom.scale.x:1;
  if(curRoom){ const R0=curRoom.position, an=curRoom.userData.anchor||{x:0,y:0,z:0,ry:Math.PI,pose:'stand'}; const nudge=an.pose==='sit'?0.28:0; tx=R0.x+(an.x+Math.sin(an.ry)*nudge)*rs; ty=R0.y+(an.y+(an.pose==='lie'?-0.22:0))*rs; tz=R0.z+(an.z+Math.cos(an.ry)*nudge)*rs; o.rotation.order='YXZ'; o.rotation.set(an.pose==='lie'?-Math.PI/2:0, an.ry, 0); fModel.poseHint=an.pose; }
  else { tx=p.x; tz=p.z; ty=0; fModel.poseHint=null; o.rotation.order='YXZ'; o.rotation.x=0; o.rotation.z=0; if(p.moving) o.rotation.y=p.dir; }
  o.position.set(tx,ty,tz); o.visible=true;
  const ph=pose(fModel,p.act,!curRoom&&p.moving,p.mode); setProp(fModel,(curRoom||!p.moving)&&p.b&&p.b.prop||null); paintScreens(now); fModel.mixer.update(dt); if(ph) applyPrayerBones(fModel); else fModel.phase=null;
  const ud=curRoom&&curRoom.userData; const view=(ud?ud.view:8)*rs;
  const aimY=ty+(ud&&ud.anchor&&ud.anchor.pose==='lie'?0.25:1.0);
  if(snapCam&&curRoom){ const R0=curRoom.position, W=(ud.W||6)*rs, D=(ud.D||5)*rs; controls.target.set(tx,aimY,tz);
    if(ud.outdoor){ const dist=Math.max(3.8, Math.max(W,D)*0.42); camera.position.set(tx+dist*0.38, ty+dist*0.48, tz+dist*0.78); }
    else if(ud.type==='car'||ud.type==='bus'){ camera.position.set(R0.x+W/2+Math.max(1.2,W*0.9), ty+0.55+0.45*rs, tz+D*0.02); }
    else { const dist=Math.max(W,D)*0.95; camera.position.set(R0.x+W*0.5+dist*0.2, R0.y+dist*0.48, R0.z+D*0.5+dist*0.36); } }
  if(!S3.follow0){ const off=camera.position.clone().sub(controls.target); tmpV.set(tx,aimY,tz); const dd=controls.target.distanceTo(tmpV); controls.target.lerp(tmpV,snapCam||dd>3?1:1-Math.exp(-dt*8)); camera.position.copy(controls.target).add(off); }
  if(curRoom) clearCam(camera.position, curRoom, rs);
  controls.maxDistance=curRoom?Math.max(view*2.4,12):260; controls.update();
  if(curRoom) clearCam(camera.position, curRoom, rs);
  // angels on the shoulders, Qareen behind
  const head=fModel.head; head&&head.getWorldPosition(tmpV); const hx=head?tmpV.x:tx, hy=head?tmpV.y:ty+1.4, hz=head?tmpV.z:tz; const ry=o.rotation.y; const rx=Math.cos(ry), rz=-Math.sin(ry); const bx=-Math.sin(ry), bz=-Math.cos(ry); const sc=fModel.o.scale.x/0.62;
  const bob=Math.sin(now/500)*0.03; const so=0.62*sc;
  angels[0].position.set(hx-rx*so,hy+0.05*sc+bob,hz-rz*so); angels[1].position.set(hx+rx*so,hy+0.05*sc-bob,hz+rz*so); angels[0].scale.setScalar(2.05*sc); angels[1].scale.setScalar(2.05*sc); // right = person's right (model faces +z)
  for(const an of angels){ an.rotation.y=ry; an.visible=o.visible; const f=Math.sin(now/120)*0.4; an.userData.w1.rotation.y=f; an.userData.w2.rotation.y=-f; }
  const q=a._qlive!=null?a._qlive:(a._qs||0.3); qareen.visible=o.visible; qareen.children.forEach((s,i)=>{ const ph=now/900+s.userData.ph; s.position.set(hx+bx*0.7*sc+Math.sin(ph)*0.28, hy-0.15*sc+Math.cos(ph*1.3)*0.28, hz+bz*0.7*sc+Math.cos(ph)*0.28); const k=(0.85+q*1.5)*sc; s.scale.set(k,k*1.35,1); s.material.opacity=0.35+q*0.5; });
  // other people: outdoors moving nearby, or in the room
  if(!curRoom) others(t,a,tx,tz,dt); else { for(const P of pool) P.o.visible=false; for(const P of roomPeople){ const rph=pose(P,P.act,false); P.mixer.update(dt); if(rph) applyPrayerBones(P); else P.phase=null; } }
  // cars on the real streets
  if(!curRoom){ const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), Y=new THREE.Vector3(0,1,0); const hour=C.local(t).h; const busy=hour<6?0.3:1; carMesh.userData.cars.forEach((c,i)=>{ const r=c.r; let L=0; for(let k=1;k<r.p.length;k++) L+=Math.hypot(r.p[k][0]-r.p[k-1][0],r.p[k][1]-r.p[k-1][1]); c.L=L;
      let f=((t/1000)*c.sp*8/Math.max(L,40)+c.ph)%1; if(c.dir<0)f=1-f; const rr={path:r.p,cum:r.p.map((_,k)=>0),L}; let acc=0; rr.cum=r.p.map((q,k)=>k?(acc+=Math.hypot(q[0]-r.p[k-1][0],q[1]-r.p[k-1][1])):0); const g=along(rr,f);
      const off=(r.w/4)*c.dir; const nx=Math.cos(g.dir)*off, nz=-Math.sin(g.dir)*off; Q.setFromAxisAngle(Y,g.dir+(c.dir<0?Math.PI:0)); M.compose(new THREE.Vector3(g.x+nx,0.75,g.z+nz),Q,new THREE.Vector3(1,i/carMesh.count<busy?1:0.001,1)); carMesh.setMatrixAt(i,M); }); carMesh.instanceMatrix.needsUpdate=true; }
  // light from the sim sky
  const alt=C.sunAltitude(t), L=C.local(t); const az=(L.min/60-12.6)/12*Math.PI; const ca=Math.cos(alt*Math.PI/180);
  const gy=curRoom?ty:0;
  sun.position.set(tx-Math.sin(az)*ca*120, gy+Math.max(5,Math.sin(alt*Math.PI/180)*120), tz+Math.cos(az)*ca*120); sun.target.position.set(tx,gy,tz);
  const day=Math.max(0,Math.min(1,(alt+6)/18)); sun.intensity=2.4*Math.max(0,Math.min(1,alt/12)); hemi.intensity=0.15+day*1.05; const dusk=alt>-8&&alt<8;
  const sky=new THREE.Color().setHSL(0.6,0.55,0.06+day*0.6); if(dusk) sky.lerp(new THREE.Color(0xf29a6b),0.35*(1-Math.abs(alt)/8)); if(S.ctx.cloud) sky.lerp(new THREE.Color(0x9aa3ad),0.4*day);
  const enclosed=curRoom&&!curRoom.userData.skyBg;
  if(enclosed){ hemi.intensity=0.9; sun.intensity=0.35; scene.background=new THREE.Color(0xc5d0d6); scene.fog.color.set(0xc5d0d6); }
  else { scene.background=sky; scene.fog.color.copy(sky); }
  const night=1-day;
  for(const m of mats.walls.concat([mats.ind])) m.emissiveIntensity=night*0.9; for(const l of mats.lamps) l.material.opacity=night;
  if(curRoom&&curRoom.userData.lamp&&curRoom.userData.lamp.isPointLight) curRoom.userData.lamp.intensity=(O.era==='1986'?2.5:1.9)+night*0.7;
  if(curRoom&&curRoom.userData.glass) curRoom.userData.glass.color.copy(sky).lerp(new THREE.Color(0xd7eef8),0.4);
  const openAir=!curRoom||curRoom.userData.outdoor;
  rain.visible=openAir&&(S.ctx.rain||S.ctx.snow); if(rain.visible){ rain.material.color.set(S.ctx.snow?0xffffff:0xcfe0ff); rain.material.size=S.ctx.snow?0.2:0.08; const pa=rain.geometry.attributes.position; for(let i=0;i<pa.count;i++){ let y=pa.getY(i)-dt*(S.ctx.snow?2:22); if(y<0)y+=30; pa.setY(i,y); } pa.needsUpdate=true; rain.position.set(tx,curRoom?curRoom.position.y:0,tz); }
  renderer.render(scene,camera); bubbles(a,hx,hy,hz,sc); hud(a,p); }
function others(t,a,cx,cz,dt){ const near=[]; for(const x of A){ if(x===a)continue; const loc=x._p3t===t?x._p3:(x._p3t=t,x._p3=pos3cheap(x,t)); if(!loc||!loc.moving||loc.mode==='car')continue; const d=Math.hypot(loc.x-cx,loc.z-cz); if(d<(phone?80:140)) near.push([d,x,loc]); }
  near.sort((m,n)=>m[0]-n[0]); const n=Math.min(near.length,phone?8:16);
  while(pool.length<n){ const P=makePerson(near[pool.length][1]); scene.add(P.o); pool.push(P); }
  pool.forEach((P,i)=>{ if(i>=n){ P.o.visible=false; return; } const [d,x,loc]=near[i]; P.o.visible=true; P.o.position.set(loc.x,0,loc.z); P.o.rotation.y=loc.dir; pose(P,'walk',true,'walk'); P.mixer.update(dt); }); }
function pos3cheap(x,t){ try{ return pos3(x,t); }catch(e){ return null; } }
function clearRoomPeople(){ for(const P of roomPeople) scene.remove(P.o); roomPeople=[]; }
function fillRoom(a,spec){ clearRoomPeople(); if(!curRoom||!spec) return; const R0=curRoom.position, sc=curRoom.scale.x, spots=curRoom.userData.spots||[]; const cap=Math.min(spots.length, phone?6:spots.length); if(!cap) return;
  const t=S.t, list=[];
  for(const x of A){ if(x===a||x.here===false) continue; const loc=Sim.locate(x,t); if(!loc||loc.moving) continue; const sp=specFor(x,loc); if(sp&&sp.key===spec.key){ list.push({x,act:loc.b&&loc.b.act}); if(list.length>=cap) break; } }
  list.forEach((it,i)=>{ const spot=spots[i]; if(!spot) return; const P=makePerson(it.x); P.act=it.act||'home'; P.poseHint=spot.pose; const nudge=spot.pose==='sit'?0.28:0; P.o.position.set(R0.x+(spot.x+Math.sin(spot.ry)*nudge)*sc, R0.y+spot.y*sc, R0.z+(spot.z+Math.cos(spot.ry)*nudge)*sc); P.o.rotation.y=spot.ry; scene.add(P.o); roomPeople.push(P); }); }
function paintScreens(now){ const screens=curRoom&&curRoom.userData.screens; if(!screens||!screens.length) return; const prop=fModel&&fModel.propK; const hot=!!(prop&&['tv','pc','laptop'].includes(prop)); const type=curRoom.userData.type; const live=hot||['living','office','study','car','bus','bedroom'].includes(type); const pulse=live?(hot?0.55+0.45*Math.abs(Math.sin(now/180)):0.42):0.05; const era=O.era;
  const r=era==='1986'?0.22*pulse:0.22*pulse, g=era==='1986'?0.62*pulse:0.48*pulse, b=era==='1986'?0.2*pulse:0.9*pulse;
  for(const s of screens) if(s.material) s.material.color.setRGB(r,g,b); }
// ---------- 3D bubbles from the commentary engine ----------
let lastB='';
function bubbles(a,hx,hy,hz,sc){ const el=$('s3dBub'); const L=Iso.lines?Iso.lines(a):[]; const last=k=>{ for(let i=L.length-1;i>=Math.max(0,L.length-14);i--) if(k.includes(L[i].k)) return L[i]; return null; };
  const lastAng=last(['angel','right','leftNote']); const items=[['thought',last(['event','thought','choiceGood','choiceBad','ripple']),0,0.75],['q',last(['q']),-1,0.3],['angel',lastAng||{s:'Bismillah. Every good step is written.'},1,0.3]];
  const key=items.map(x=>x[1]?x[1].s:'').join('|'); if(key!==lastB){ lastB=key; el.innerHTML=items.map(([k,l])=>l?`<div class="b3 ${k} ${l.k==='leftNote'?'leftNote':''} ${l.k==='event'?'event':''}" data-k="${k}"><b>${k==='q'?'Qareen':k==='angel'?(l.k==='leftNote'?'Left angel':'Right angel'):(l.k==='event'?'🎬 '+a.first:a.first)}</b> ${O.esc(l.s)}</div>`:'').join(''); }
  const ry=fModel.o.rotation.y, rx=Math.cos(ry), rz=-Math.sin(ry);
  tmpV.set(hx,hy,hz).project(camera); const hsx=(tmpV.x*0.5+0.5)*innerWidth; tmpV.copy(angels[0].position).project(camera); const angL=(tmpV.x*0.5+0.5)*innerWidth<hsx;
  for(const d of el.children){ const k=d.dataset.k; if(k==='angel') tmpV.copy(d.classList.contains('leftNote')?angels[1].position:angels[0].position); else if(k==='q') tmpV.copy(qareen.children[0].position); else tmpV.set(hx,hy+0.75*sc,hz);
    tmpV.project(camera); const x=(tmpV.x*0.5+0.5)*innerWidth, y=(-tmpV.y*0.5+0.5)*innerHeight; const vis=tmpV.z<1; d.style.display=vis?'block':'none'; let tx='-50%', ox=0, oy=-40; if(k!=='thought'){ const left=k==='q'?!angL:(d.classList.contains('leftNote')?!angL:angL); tx=left?'-100%':'0'; ox=left?-40:40; oy=k==='q'?50:-45; if(k==='q') ox+=hsx-x+(left?-50:50); } const bw=d.offsetWidth||160; let lx=x+ox-(tx==='-100%'?bw:tx==='-50%'?bw/2:0); lx=Math.max(4,Math.min(innerWidth-bw-4,lx)); d.style.transform=`translate(${Math.round(lx)}px,${Math.round(y+oy)}px) translate(0,-100%)`; } }
function hud(a,p){ const el=$('s3dWhere'); const where=curRoom&&curRoom.userData.label?curRoom.userData.label:(p.moving?(p.mode==='car'?'🚗 Driving':p.mode==='bus'?'🚌 On the bus':'🚶 Walking on '+(roadName(p)||'the footpath')):'📍 Outside'); const txt=where+' · '+(p.b&&p.b.txt||''); if(el.textContent!==txt) el.textContent=txt; }
function roadName(p){ let best='',bd=30; for(const r of data.r){ if(!r.n)continue; for(const q of r.p){ const d=Math.hypot(q[0]-p.x,q[1]-p.z); if(d<bd){bd=d;best=r.n;} } } return best; }
// ---------- enter / exit ----------
S3.enter=async function(a){ if(a) UI.select(a,false); if(!UI.selected) return; S3.on=true; document.body.classList.add('s3d'); $('s3d').style.display='block'; $('inner').classList.add('open'); Iso.on3d=true; Iso.inner(true);
  if(!renderer){ $('s3dWhere').textContent='Loading the 3D street (first time only)…'; await init(); } size(); lastEra=O.era; lastT=performance.now(); if(!framed){ framed=true; frame(); } };
S3.exit=function(){ S3.on=false; document.body.classList.remove('s3d'); $('s3d').style.display='none'; Iso.on3d=false; if(!Iso.on) $('inner').classList.remove('open'); };
S3.dbg=()=>{ const b=new THREE.Box3().setFromObject(fModel.o); return {box:[b.min.toArray(),b.max.toArray()],pos:fModel.o.position.toArray(),cam:camera.position.toArray(),tg:controls.target.toArray(),vis:fModel.o.visible,ry:fModel.o.rotation.y,space:curRoom&&curRoom.userData.key,label:curRoom&&curRoom.userData.label,type:curRoom&&curRoom.userData.type}; };
S3.specFor=specFor;
S3.sample=function(n=10){ const t=S.t, by=new Map(); for(const a of A){ if(a.here===false||a.age<8) continue; const loc=Sim.locate(a,t); if(!loc) continue; const sp=specFor(a,loc); if(!sp) continue; if(!by.has(sp.key)) by.set(sp.key,{id:a.id,name:a.first,type:sp.type,key:sp.key,label:sp.label,act:loc.b&&loc.b.act}); }
  const all=[...by.values()]; const picked=[], seen=new Set(); for(const it of all){ if(picked.length>=n) break; if(seen.has(it.type)) continue; seen.add(it.type); picked.push(it); }
  for(const it of all){ if(picked.length>=n) break; if(!picked.includes(it)) picked.push(it); } return picked; };
S3.space=()=>curRoom?{key:curRoom.userData.key,type:curRoom.userData.type,label:curRoom.userData.label}:null;
S3.camTo=function(d,polar,behind){ // for screenshots
  const tg=controls.target; let az=Math.atan2(camera.position.x-tg.x,camera.position.z-tg.z); if(fModel&&behind!==false){ const ry=fModel.o.rotation.y; az=Math.atan2(-Math.sin(ry),-Math.cos(ry))+(behind||0.5); } camera.position.set(tg.x+Math.sin(az)*Math.sin(polar)*d, tg.y+Math.cos(polar)*d, tg.z+Math.cos(az)*Math.sin(polar)*d); };
$('s3dExit').onclick=()=>S3.exit(); $('s3dPeople').onclick=()=>Panels.show('dir'); $('s3d2d').onclick=()=>{ S3.exit(); Iso.enter(); };
$('go3d').onclick=()=>{ if(Iso.on) Iso.exit(); S3.enter(); };
// test helpers: ?s3d=1&find=walk|mosque|home&cam=close|street
{ const qp=new URLSearchParams(location.search); if(qp.get('s3d')){ const f=qp.get('find'), cm=qp.get('cam');
  const pickA=()=>{ if(!f)return null; for(const x of A){ if(x.age<16)continue; const l=Sim.locate(x,S.t); if(!l)continue; const pl=l.b&&World.place(l.b.pid);
      if(f==='walk'&&l.moving&&l.mode==='walk') return x; if(f==='mosque'&&!l.moving&&pl&&pl.kind==='mosque') return x; if(f==='home'&&!l.moving&&l.b.pid==='home'&&!['sleep','away'].includes(l.b.act)) return x; } return null; };
  addEventListener('load',()=>setTimeout(async()=>{ const x=pickA(); await S3.enter(x||UI.selected||A[12]); if(cm) setTimeout(()=>S3.camTo(cm==='close'?3.2:cm==='street'?16:5,cm==='close'?1.3:1.15,cm==='close'?2.6:0.5),400); },150)); } }
