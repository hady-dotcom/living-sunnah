// Interiors and close-up places for Sunnah World.
// Furniture, food, vehicles, trees and columns are Kenney CC0 packs
// (https://kenney.nl). They are stylised and low-poly on purpose.
import * as THREE from 'three';
import {mergeGeometries} from './jsm/utils/BufferGeometryUtils.js';

const TEX = new Map();
const LIB = {};   // normalised props: {obj, size}
const RAW = {};   // corner-origin tiles (walls)
let FS = 0.62;
let PHONE = false;

const STRUCT = new Set(['wall','wallWindow','wallDoorway','floorFull','doorway','doorwayFront']);

const FURN = `bedDouble bedSingle bedBunk pillow pillowBlue pillowLong pillowBlueLong
chair chairCushion chairDesk chairModernCushion chairRounded stoolBar stoolBarSquare
loungeSofa loungeSofaCorner loungeSofaLong loungeChair loungeChairRelax loungeDesignSofa loungeDesignChair loungeDesignSofaCorner loungeSofaOttoman
table tableRound tableCloth tableCoffee tableCoffeeSquare tableCross
desk deskCorner bookcaseOpen bookcaseOpenLow bookcaseClosed books
kitchenCabinet kitchenCabinetUpper kitchenCabinetDrawer kitchenFridge kitchenFridgeSmall kitchenSink kitchenStove kitchenMicrowave kitchenBar kitchenCoffeeMachine toaster kitchenBlender
lampRoundFloor lampRoundTable lampSquareCeiling lampWall ceilingFan
televisionModern televisionVintage televisionAntenna radio laptop computerScreen computerKeyboard speaker
rugRectangle rugRound rugRounded rugDoormat rugSquare
pottedPlant plantSmall1 plantSmall2 plantSmall3
bathroomSink bathroomSinkSquare bathroomMirror bathroomCabinet toilet bench benchCushion
coatRack coatRackStanding sideTable sideTableDrawers cabinetTelevision cardboardBoxClosed cardboardBoxOpen trashcan
washer wall wallWindow wallDoorway doorway doorwayFront floorFull cabinetBedDrawer bear stairs
kitchenCabinetUpperDouble hoodModern`.trim().split(/\s+/);

const FOOD = `plate-dinner plate bowl cup-tea mug loaf apple banana grapes tomato pot-stew frying-pan bread carton cup cutting-board can bowl-soup`.trim().split(/\s+/);
const NATURE = `tree_detailed tree_oak tree_default tree_pineRoundA tree_pineSmallA rock_smallA`.trim().split(/\s+/);
const CARS = ['sedan','van','wheel-default','cone'];

export function setScale(s){ FS = Math.max(0.42, Math.min(0.95, s)); }
export function setPhone(v){ PHONE = !!v; }

function lambertFrom(mat){
  if (!mat) return new THREE.MeshLambertMaterial({color:0xffffff});
  if (mat.isMeshLambertMaterial || mat.isMeshBasicMaterial) return mat;
  const m = new THREE.MeshLambertMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    map: mat.map || null,
    transparent: !!mat.transparent,
    opacity: mat.opacity == null ? 1 : mat.opacity,
    alphaTest: mat.alphaTest || 0,
    side: mat.side || THREE.FrontSide,
    depthWrite: mat.transparent ? false : true,
    name: mat.name || '',
  });
  m.name = mat.name || '';
  if (mat.emissive) m.emissive.copy(mat.emissive);
  if (m.transparent) m.depthWrite = false;
  return m;
}
function prep(root){
  root.traverse(n=>{
    if (!n.isMesh) return;
    if (Array.isArray(n.material)) n.material = n.material.map(lambertFrom);
    else n.material = lambertFrom(n.material);
    n.castShadow = true; n.receiveShadow = true;
  });
}
function normalise(scene){
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  scene.position.set(-c.x, -box.min.y, -c.z);
  wrap.add(scene);
  wrap.userData.size = size;
  return wrap;
}

export async function loadAssets(loader, onProg){
  const jobs = [];
  for (const n of FURN) jobs.push(['furniture/'+n+'.glb', n]);
  for (const n of FOOD) jobs.push(['food/'+n+'.glb', n]);
  for (const n of NATURE) jobs.push(['nature/'+n+'.glb', n]);
  for (const n of CARS) jobs.push(['car/'+n+'.glb', n]);
  jobs.push(['building/column.glb', 'column']);
  let done = 0;
  await Promise.all(jobs.map(async ([rel, name])=>{
    try {
      const gltf = await loader.loadAsync(new URL('./assets/kenney/'+rel, import.meta.url).href);
      const scene = gltf.scene;
      prep(scene);
      if (STRUCT.has(name)) RAW[name] = scene;
      else {
        const wrap = normalise(scene);
        LIB[name] = {obj:wrap, size:wrap.userData.size.clone()};
      }
    } catch (e) { console.warn('asset', name, e); }
    done++; if (onProg) onProg(done, jobs.length);
  }));
}

function rngOf(seed){
  let s = seed >>> 0;
  return ()=>{ s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
function pick(rnd, arr){ return arr[Math.floor(rnd()*arr.length) % arr.length]; }
function css(hex){ return '#'+new THREE.Color(hex).getHexString(); }
function canvasTex(key, w, h, draw, repeat){
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  TEX.set(key, t); return t;
}
function woodTex(hex, v){
  return canvasTex('wood'+hex+'_'+v, 256, 256, (g,w,h)=>{
    g.fillStyle = css(hex); g.fillRect(0,0,w,h);
    const n = 7;
    for (let i=0;i<n;i++){
      g.fillStyle = `rgba(0,0,0,${0.05+((i+v)%4)*0.02})`;
      g.fillRect(0, i*h/n, w, h/n-3);
      g.strokeStyle = 'rgba(50,25,0,0.28)'; g.strokeRect(1, i*h/n+1, w-2, h/n-4);
      if ((i+v)%2===0){ g.fillStyle='rgba(80,40,0,0.13)'; g.beginPath(); g.ellipse(30+(i*53)%190, i*h/n+18, 10, 4, 0.4, 0, 7); g.fill(); }
    }
  }, [2,2]);
}
function tileTex(c1, c2, v){
  return canvasTex('tile'+c1+c2+v, 256, 256, (g,w,h)=>{
    const n = 6, s = w/n;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++){
      g.fillStyle = (x+y+v)%2 ? c2 : c1;
      g.fillRect(x*s, y*s, s, s);
      g.strokeStyle = 'rgba(60,60,60,0.35)'; g.strokeRect(x*s+1, y*s+1, s-2, s-2);
    }
  }, [2,2]);
}
function carpetTex(hex, v){
  return canvasTex('car'+hex+'_'+v, 256, 256, (g,w,h)=>{
    g.fillStyle = css(hex); g.fillRect(0,0,w,h);
    g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 3;
    g.strokeRect(14,14,w-28,h-28); g.strokeRect(28,28,w-56,h-56);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i=0;i<12;i++) g.fillRect((i*47+v*9)%w, (i*29)%h, 18, 8);
  }, [3,3]);
}
function linoTex(hex){
  return canvasTex('lino'+hex, 256, 256, (g,w,h)=>{
    g.fillStyle = css(hex); g.fillRect(0,0,w,h);
    for (let i=0;i<180;i++){ g.fillStyle = `rgba(255,255,255,${0.03+(i%5)*0.015})`; g.fillRect((i*37)%w, (i*19)%h, 6, 4); }
    g.strokeStyle = 'rgba(0,0,0,0.06)'; for (let y=0;y<h;y+=32){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  }, [3,3]);
}
function grassTex(v){
  return canvasTex('grass'+v, 256, 256, (g,w,h)=>{
    g.fillStyle = ['#6fa85a','#7eb56a','#5e984c'][v%3]; g.fillRect(0,0,w,h);
    for (let i=0;i<500;i++){
      g.strokeStyle = i%2 ? '#4f8a3e' : '#97d27a';
      const x = (i*73)%w, y = (i*41)%h;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+(i%5)-2, y-7); g.stroke();
    }
  }, [4,4]);
}
function dirtTex(){
  return canvasTex('dirt', 256, 256, (g,w,h)=>{
    g.fillStyle = '#8a7048'; g.fillRect(0,0,w,h);
    for (let i=0;i<220;i++){ g.fillStyle = i%2?'rgba(60,40,20,0.25)':'rgba(220,190,130,0.18)'; g.beginPath(); g.arc((i*61)%w,(i*29)%h, 3+(i%4), 0, 7); g.fill(); }
  }, [3,3]);
}
function asphaltTex(){
  return canvasTex('asph', 256, 256, (g,w,h)=>{
    g.fillStyle = '#3e434a'; g.fillRect(0,0,w,h);
    for (let i=0;i<300;i++){ g.fillStyle = `rgba(255,255,255,${0.02+(i%4)*0.02})`; g.fillRect((i*53)%w,(i*17)%h,2,2); }
  }, [6,6]);
}
function prayerTex(base, accent){
  return canvasTex('pray'+base+'_'+accent, 512, 768, (g,w,h)=>{
    g.fillStyle = css(base); g.fillRect(0,0,w,h);
    g.strokeStyle = css(accent); g.lineWidth = 14;
    g.strokeRect(18,18,w-36,h-36);
    g.lineWidth = 4; g.strokeRect(36,36,w-72,h-72);
    // mihrab arch at the north (top of the texture)
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(w*0.28, 150); g.quadraticCurveTo(w/2, 28, w*0.72, 150); g.stroke();
    g.beginPath(); g.arc(w/2, 118, 18, 0, 7); g.stroke();
    // prayer rows
    g.globalAlpha = 0.35; g.lineWidth = 3;
    for (let y=190; y<h-30; y+=70){ g.beginPath(); g.moveTo(48,y); g.lineTo(w-48,y); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = css(accent);
    g.fillRect(w/2-40, 70, 80, 8);
  });
}
function artTex(rnd, era){
  const key = 'art'+Math.floor(rnd()*8)+era[2];
  return canvasTex(key, 256, 256, (g,w,h)=>{
    const cols = era==='1986' ? ['#6b3a2a','#c4a574','#1f4d3a','#8c1d2b','#e6c35c']
      : era==='2006' ? ['#1f4e8c','#d9c7a3','#6b705c','#8c3a3a','#e8e0d0']
      : ['#12352f','#e7efe9','#c4a574','#1e3a5f','#f4f1ea'];
    g.fillStyle = cols[2]; g.fillRect(0,0,w,h);
    g.strokeStyle = cols[4]; g.lineWidth = 10; g.strokeRect(16,16,w-32,h-32);
    g.strokeStyle = cols[0]; g.lineWidth = 4;
    // eight-point geometric star
    g.save(); g.translate(w/2,h/2); g.fillStyle = cols[3];
    g.beginPath();
    for (let i=0;i<8;i++){ const a=i/8*Math.PI*2; g.lineTo(Math.cos(a)*70, Math.sin(a)*70); const b=a+Math.PI/8; g.lineTo(Math.cos(b)*28, Math.sin(b)*28); }
    g.closePath(); g.fill(); g.restore();
    if (era==='1986'){ g.fillStyle='rgba(0,0,0,0.08)'; for(let y=0;y<h;y+=3) g.fillRect(0,y,w,1); }
  });
}
function boardTex(){
  return canvasTex('board', 512, 256, (g,w,h)=>{
    g.fillStyle = '#1c3a2a'; g.fillRect(0,0,w,h);
    g.strokeStyle = 'rgba(220,230,210,0.55)'; g.lineWidth = 3;
    g.strokeRect(16,16,w-32,h-32);
    g.beginPath(); g.moveTo(40, h*0.45); g.lineTo(w*0.55, h*0.45); g.moveTo(40, h*0.62); g.lineTo(w*0.4, h*0.62); g.stroke();
  });
}
function signTex(text, dark){
  const key = 'sg'+(dark?1:0)+text;
  return canvasTex(key, 512, 128, (g,w,h)=>{
    g.fillStyle = dark ? '#14281f' : '#f4efe4'; g.fillRect(0,0,w,h);
    g.strokeStyle = '#e6c35c'; g.lineWidth = 8; g.strokeRect(6,6,w-12,h-12);
    g.fillStyle = dark ? '#f4f1ea' : '#143d2e';
    g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(text||'').slice(0, 26), w/2, h/2);
  });
}

function matsFor(spec, rnd){
  const era = spec.era || '2026';
  const walls = {
    '1986':[0xd2b48c,0xc4a574,0x8d9a78,0xe4d2b0,0xb85c38,0x7f6a55,0x6e8b8a],
    '2006':[0xe4dcc8,0xd7d0c4,0xc5d0c2,0xf0ebe3,0xb7c4c9,0xe6d2b0,0xd8c8b8],
    '2026':[0xf7f4ee,0xe7eef2,0xf3f6f4,0xe4ebe4,0xece4f2,0xf6eee6,0xdfe7ea],
  }[era];
  const fabrics = {
    '1986':[0x8c3a3a,0x2f5d50,0xb0893e,0x3d4f7a,0x6b3e5b,0x8a5a3b,0x1f4d3a],
    '2006':[0x9a3b4a,0x3d6b8a,0x6a7a4a,0xc47b4a,0x5a4a6a,0x8d6a4a,0x2f4f4f],
    '2026':[0x1f4e4a,0x334155,0xa1623b,0x7f1d1d,0x1e3a5f,0x3f6212,0x7c5c3b],
  }[era];
  const woods = [0x8a5a32,0xa97449,0x6b4226,0xc49a6c,0x5c4030,0x9a7048];
  // public rooms lean on a fixed colour so a masjid reads as a masjid,
  // while homes cycle through the palette.
  const personal = ['bedroom','kitchen','living','musalla','study','yard'].includes(spec.type);
  const wallHex = personal ? walls[spec.seed % walls.length] : (spec.type==='hospital'?0xd5e3df:spec.type==='wudu'?0xd7ebe6:spec.type==='prayerhall'?0xf3efe6:walls[spec.seed%walls.length]);
  const fabHex = fabrics[spec.seed % fabrics.length];
  const woodHex = woods[(spec.seed>>>3) % woods.length];
  const paint = new THREE.Color(wallHex);
  const fabric = new THREE.Color(fabHex);
  const wood = new THREE.Color(0x8d5a32).lerp(new THREE.Color(woodHex), 0.72);
  const mk = (hex, side)=> { const m=new THREE.MeshLambertMaterial({color:hex, side:side||THREE.FrontSide}); m.userData.room=1; return m; };
  const furn = {
    wood: mk(wood),
    woodDark: mk(wood.clone().multiplyScalar(0.62)),
    carpet: mk(fabric),
    carpetDarker: mk(fabric.clone().multiplyScalar(0.7)),
    carpetBlue: mk(fabric.clone().lerp(new THREE.Color(0x1e3a5f), 0.25)),
    carpetWhite: mk(fabric.clone().lerp(new THREE.Color(0xfffaf3), 0.84)),
  };
  const wall = {
    _defaultMat: mk(paint.clone().lerp(new THREE.Color(0xffffff), era==='2026'?0.35:0.12), THREE.DoubleSide),
    wood: furn.wood,
    woodDark: furn.woodDark,
    metalDark: mk(paint.clone().lerp(new THREE.Color(0x222222), 0.62), THREE.DoubleSide),
  };
  const ceil = mk(paint.clone().lerp(new THREE.Color(0xffffff), 0.45), THREE.DoubleSide);
  return {furn, wall, ceil, paint, fabric, wood, era, rnd, personal};
}

function retint(o, dict){
  if (!dict) return;
  const swap = m=>{
    if (!m) return m;
    if (m.userData && m.userData.room) return m;
    if (m.transparent && m.opacity < 0.98){
      if (!dict.glass){
        dict.glass = m.clone(); dict.glass.userData.room = 1; dict.glass.depthWrite = false; dict.glass.transparent = true; dict.glass.opacity = Math.min(0.55, m.opacity||0.45);
      }
      return dict.glass;
    }
    return dict[m.name] || m;
  };
  o.traverse(n=>{
    if (!n.isMesh) return;
    if (Array.isArray(n.material)) n.material = n.material.map(swap);
    else n.material = swap(n.material);
  });
}
function dim(name){
  const it = LIB[name];
  return it ? it.size : new THREE.Vector3(0.45, 0.45, 0.45);
}
function prop(g, ctx, name, x, y, z, ry=0, sc=1){
  const it = LIB[name]; if (!it) return null;
  const o = it.obj.clone(true);
  retint(o, ctx.pack.furn);
  o.position.set(x, y, z);
  o.rotation.y = ry || 0;
  const s = sc || 1;
  o.scale.setScalar(s);
  o.traverse(n=>{ if (n.isMesh){ n.castShadow = !PHONE; n.receiveShadow = true; }});
  g.add(o);
  o.userData.baseSize = it.size;
  return o;
}
function tile(g, ctx, name, x, y, z, ry){
  const src = RAW[name]; if (!src) return null;
  const o = src.clone(true);
  retint(o, name==='wall' ? ctx.pack.wall : ctx.pack.furn);
  // windows keep their wood frame; still pick up glass + wood tint
  if (name!=='wall') retint(o, ctx.pack.furn);
  o.position.set(x, y, z);
  o.rotation.y = ry || 0;
  o.traverse(n=>{ if (n.isMesh){ n.castShadow = !PHONE; n.receiveShadow = true; }});
  g.add(o);
  return o;
}
function addScreen(host, size, era, ctx){
  if (!host || !size) return;
  const w = Math.max(0.18, size.x * 0.72), h = Math.max(0.14, size.y * 0.62);
  const mat = new THREE.MeshBasicMaterial({color: era==='1986'?0x1a2418:0x101820});
  mat.userData.room = 1; mat.userData.screen = 1;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(0, size.y * 0.52, size.z * 0.5 + 0.02);
  m.userData.keep = 1; m.userData.screen = 1;
  host.add(m); ctx.screens.push(m);
  // back face too, in case the set faces the other way
  const m2 = m.clone(); m2.position.z = -size.z * 0.5 - 0.02; m2.rotation.y = Math.PI; m2.userData.keep = 1; m2.userData.screen = 1;
  host.add(m2); ctx.screens.push(m2);
}
function picture(g, ctx, x, y, z, ry){
  const tex = artTex(ctx.rnd, ctx.era);
  const mat = new THREE.MeshLambertMaterial({map:tex}); mat.userData.room = 1;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.04), ctx.pack.furn.wood);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.76), mat);
  frame.position.set(x,y,z); pic.position.set(x,y,z+Math.cos(ry)*0.03);
  frame.rotation.y = ry; pic.rotation.y = ry;
  g.add(frame, pic);
}
function sign(g, text, x, y, z, ry, dark){
  const tex = signTex(text, dark!==false);
  const mat = new THREE.MeshLambertMaterial({map:tex}); mat.userData.room = 1;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.4, 0.42+text.length*0.09), 0.36), mat);
  m.position.set(x,y,z); m.rotation.y = ry||0; g.add(m); return m;
}
function fit(name, target){
  const s = dim(name);
  const m = Math.max(s.x, s.y, s.z) || 1;
  return target / m;
}

function shell(g, ctx, o){
  const W = o.W, D = o.D;
  ctx.W = W; ctx.D = D;
  const floorMat = new THREE.MeshLambertMaterial({map:o.floor, color:0xffffff});
  floorMat.userData.room = 1;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; g.add(floor);
  if (o.rug){
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(o.rug.w, o.rug.d), ctx.pack.furn.carpet);
    rm.rotation.x = -Math.PI/2; rm.position.set(o.rug.x||0, 0.02, o.rug.z||0); g.add(rm);
  }
  const sides = o.sides == null ? 'nsew' : o.sides;
  // Dollhouse: the close-up camera sits outside the south-east corner.
  // Those walls are left out so it can never sit inside them.
  const cut = o.open ? '' : (o.cut==null ? 'se' : o.cut);
  const nx = Math.round(W), nz = Math.round(D);
  const win = o.windows || {};
  const door = o.door || {};
  const H = 1.29;
  const place = (name, x, y, z, ry)=> tile(g, ctx, name, x, y, z, ry);
  if (sides.includes('n') && !cut.includes('n')){
    for (let i=0;i<nx;i++){
      const x = -W/2 + i, z = -D/2;
      const isWin = win.n && win.n.includes(i), isDoor = door.side==='n' && door.i===i;
      place(isDoor?'wallDoorway':isWin?'wallWindow':'wall', x, 0, z, 0);
      place('wall', x, H, z, 0);
    }
  }
  if (sides.includes('s') && !cut.includes('s')){
    for (let i=0;i<nx;i++){
      const x = W/2 - i, z = D/2;
      const isWin = win.s && win.s.includes(i), isDoor = door.side==='s' && door.i===i;
      place(isDoor?'wallDoorway':isWin?'wallWindow':'wall', x, 0, z, Math.PI);
      place('wall', x, H, z, Math.PI);
    }
  }
  if (sides.includes('e') && !cut.includes('e')){
    for (let i=0;i<nz;i++){
      const x = W/2, z = -D/2 + i;
      const isWin = win.e && win.e.includes(i), isDoor = door.side==='e' && door.i===i;
      place(isDoor?'wallDoorway':isWin?'wallWindow':'wall', x, 0, z, -Math.PI/2);
      place('wall', x, H, z, -Math.PI/2);
    }
  }
  if (sides.includes('w') && !cut.includes('w')){
    for (let i=0;i<nz;i++){
      const x = -W/2, z = D/2 - i;
      const isWin = win.w && win.w.includes(i), isDoor = door.side==='w' && door.i===i;
      place(isDoor?'wallDoorway':isWin?'wallWindow':'wall', x, 0, z, Math.PI/2);
      place('wall', x, H, z, Math.PI/2);
    }
  }
  if (!o.open){
    // No ceiling slab. The camera looks down into the room, and a slab would hide it.
    prop(g, ctx, 'lampSquareCeiling', 0, 2.56 - dim('lampSquareCeiling').y, 0, 0);
    if (W>8) prop(g, ctx, 'lampSquareCeiling', -W*0.25, 2.56-dim('lampSquareCeiling').y, 0, 0);
    const warm = ctx.era==='2026' ? 0xfff6ea : ctx.era==='2006' ? 0xffe4c2 : 0xffd7a1;
    const lamp = new THREE.PointLight(warm, ctx.era==='1986'?2.6:2.1, 16, 1.4);
    lamp.position.set(0, 2.25, 0); g.add(lamp); ctx.lamp = lamp;
    const fill = new THREE.PointLight(0xc9ddff, 0.55, 14);
    fill.position.set(0, 1.7, -D/2+0.4); g.add(fill);
    if (ctx.era==='1986'){ const fan = prop(g, ctx, 'ceilingFan', W>5?1.2:0.6, 2.35, 0.4, 0); if (fan) fan.userData.keep = 1; }
  } else {
    const sun = new THREE.HemisphereLight(0xfff4e0, 0x6a8a48, 0.35);
    g.add(sun); ctx.lamp = sun;
  }
  if (!o.open && !o.noArt && sides.includes('w') && !cut.includes('w')){
    picture(g, ctx, -W/2+0.08, 1.45, 0.2, Math.PI/2);
  }
}

function setAnchor(ctx, a){ ctx.anchor = a; }
function spot(ctx, x, y, z, ry, pose){ ctx.spots.push({x,y,z,ry,pose:pose||'stand'}); }

// ---------- rooms ----------
function tvSet(g, ctx, x, z, ry){
  const era = ctx.era;
  if (era==='1986'){
    const cab = prop(g, ctx, 'cabinetTelevision', x, 0, z, ry);
    const t = prop(g, ctx, 'televisionVintage', x, dim('cabinetTelevision').y, z, ry);
    addScreen(t, dim('televisionVintage'), era, ctx);
    prop(g, ctx, 'televisionAntenna', x, dim('cabinetTelevision').y+dim('televisionVintage').y, z, ry);
    prop(g, ctx, 'radio', x+0.55, dim('cabinetTelevision').y, z, ry, 1);
    return cab;
  }
  if (era==='2006'){
    const name = (ctx.seed%2) ? 'televisionVintage' : 'televisionModern';
    const stand = name==='televisionVintage' ? prop(g, ctx, 'cabinetTelevision', x, 0, z, ry) : null;
    const y = stand ? dim('cabinetTelevision').y : 0.55;
    if (!stand) prop(g, ctx, 'sideTable', x, 0, z, ry);
    const t = prop(g, ctx, name, x, y, z, ry);
    addScreen(t, dim(name), era, ctx);
    // chunky desktop in the corner, not a flat phone
    return t;
  }
  const t = prop(g, ctx, 'televisionModern', x, 0.15, z, ry, 1.15);
  addScreen(t, dim('televisionModern'), era, ctx);
  return t;
}

function kitchen(g, ctx){
  const apt = ctx.homeKind==='tower';
  const lay = ctx.seed % 3;
  const W = apt ? 5 : (lay===2?7:6), D = apt ? 4 : 5;
  const c1 = ctx.era==='1986' ? '#d9c7a4' : ctx.era==='2006' ? '#e7e2d8' : '#f2f0ea';
  const c2 = ctx.era==='1986' ? '#b7a48a' : ctx.era==='2006' ? '#c9d2cf' : '#d5ddd8';
  shell(g, ctx, {W, D, floor:tileTex(c1,c2,lay), windows:{n:[1,2,Math.max(1,Math.round(W)-2)]}, door:{side:'s', i:1},
    rug:{w:1.7, d:1.15, x:0.2, z:0.55}});
  const back = -D/2;
  const slots = lay===1 ? ['fridge','cab','sink','stove','cab'] : lay===2 ? ['cab','stove','cab','sink','cab','fridge'] : ['cab','sink','cab','stove','fridge'];
  const cabW = dim('kitchenCabinet').x;
  slots.forEach((k,i)=>{
    const x = -W/2 + 0.55 + i*(cabW+0.04);
    const z = back + 0.28;
    if (k==='fridge') prop(g, ctx, ctx.era==='1986'?'kitchenFridgeSmall':'kitchenFridge', x, 0, z+0.1, 0);
    else if (k==='sink') prop(g, ctx, 'kitchenSink', x, 0, z, 0);
    else if (k==='stove'){ prop(g, ctx, 'kitchenStove', x, 0, z, 0); prop(g, ctx, 'hoodModern', x, 1.35, z-0.05, 0, 0.8); }
    else { prop(g, ctx, 'kitchenCabinet', x, 0, z, 0); if (i%2===0) prop(g, ctx, 'kitchenCabinetUpper', x, 1.22, back+0.2, 0); }
  });
  if (ctx.era!=='1986') prop(g, ctx, 'kitchenMicrowave', -W/2+0.7, dim('kitchenCabinet').y, back+0.35, 0, 0.9);
  else prop(g, ctx, 'radio', -W/2+0.7, dim('kitchenCabinet').y, back+0.35, 0);
  prop(g, ctx, 'kitchenBlender', W/2-0.85, dim('kitchenCabinet').y, back+0.4, 0, 0.85);
  prop(g, ctx, 'toaster', 0.9, dim('kitchenCabinet').y, back+0.42, 0.4, 0.8);
  if (ctx.era!=='1986' || lay!==0) prop(g, ctx, 'kitchenCoffeeMachine', 1.35, dim('kitchenCabinet').y, back+0.4, 0, 0.75);
  const tableName = ctx.era==='2026' && lay===0 ? 'tableRound' : (ctx.era==='1986'?'tableCloth':'table');
  const tz = apt?0.35:0.55, tx = lay===2?-0.4:0.15;
  prop(g, ctx, tableName, tx, 0, tz, 0);
  const th = dim(tableName).y;
  prop(g, ctx, 'plate-dinner', tx-0.12, th, tz+0.05, 0, fit('plate-dinner', 0.28));
  prop(g, ctx, ctx.era==='1986'?'cup-tea':'mug', tx+0.16, th, tz-0.05, 0, fit('mug', 0.16));
  prop(g, ctx, 'loaf', tx+0.02, th, tz-0.12, 0.5, fit('loaf', 0.28));
  prop(g, ctx, 'bowl-soup', tx-0.18, th, tz-0.1, 0, fit('bowl', 0.18));
  const ch = ctx.era==='2026' ? 'chairModernCushion' : 'chair';
  prop(g, ctx, ch, tx, 0, tz+0.78, Math.PI);
  prop(g, ctx, ch, tx-0.7, 0, tz+0.1, Math.PI/2);
  prop(g, ctx, 'chair', tx+0.75, 0, tz, -Math.PI/2);
  prop(g, ctx, 'pottedPlant', W/2-0.35, 0, D/2-0.4, 0);
  prop(g, ctx, 'trashcan', -W/2+0.3, 0, D/2-0.35, 0);
  if (lay===2) prop(g, ctx, 'kitchenBar', 1.3, 0, 1.1, Math.PI/2);
  setAnchor(ctx, {x:tx, y:0, z:tz+0.78, ry:Math.PI, pose:'sit'});
  spot(ctx, tx-0.7, 0, tz+0.1, Math.PI/2, 'sit');
  spot(ctx, tx+0.75, 0, tz, -Math.PI/2, 'sit');
  spot(ctx, -W/2+1.2, 0, back+0.9, 0, 'stand');
}

function living(g, ctx){
  const apt = ctx.homeKind==='tower';
  const lay = ctx.seed % 3;
  const W = apt?5: (lay===1?6:7), D = apt?4:5;
  const floors = {'1986':[0x8a5a32,0x6b4226,0xa97449], '2006':[0xb08968,0x8d6e63,0xc4a484], '2026':[0xd8c3a5,0xcbb89a,0xbfae96]};
  shell(g, ctx, {W, D, floor:woodTex(floors[ctx.era][lay%3], lay),
    windows:{n: lay===1?[2]:[1,3]}, door:{side:'s', i: apt?1:2},
    rug:{w: lay===2?2.2:2.8, d:1.8, x:0, z:0.15}});
  const sofaName = ctx.era==='2026' ? (lay===2?'loungeDesignSofaCorner':'loungeDesignSofa')
    : ctx.era==='2006' ? (lay===1?'loungeSofaCorner':'loungeSofa')
    : 'loungeSofa';
  const sd = dim(sofaName);
  // sofa against the south wall, person sits facing the television on the north wall
  const sz = D/2 - sd.z/2 - 0.15;
  prop(g, ctx, sofaName, lay===1?-0.7:0, 0, sz, Math.PI);
  prop(g, ctx, 'loungeSofaOttoman', 0.2, 0, sz-1.15, 0, 1);
  const tableN = ctx.era==='2026'?'tableCoffeeGlassSquare':'tableCoffee';
  // tableCoffeeGlassSquare may be missing; fall back handled by prop()
  const tn = LIB[tableN]?tableN:'tableCoffee';
  prop(g, ctx, tn, 0, 0, 0.15, 0);
  const th = dim(tn).y;
  if (ctx.era==='2026') prop(g, ctx, 'laptop', 0.15, th, 0.1, 0.4, 0.7);
  else if (ctx.era==='1986') prop(g, ctx, 'books', -0.1, th, 0.12, 0.2, fit('books', 0.28));
  else prop(g, ctx, 'speaker', 0.25, th, 0.05, 0, 0.55);
  tvSet(g, ctx, 0.1, -D/2+0.45, 0);
  const bookX = lay===0 ? -W/2+0.35 : W/2-0.35;
  prop(g, ctx, 'bookcaseOpen', bookX, 0, -0.2, lay===0?Math.PI/2:-Math.PI/2);
  prop(g, ctx, 'books', bookX+(lay===0?0.22:-0.22), 0.35, -0.15, 0, fit('books', 0.26));
  prop(g, ctx, 'books', bookX+(lay===0?0.22:-0.22), 0.7, -0.2, 0.4, fit('books', 0.24));
  prop(g, ctx, ctx.era==='2026'?'plantSmall2':'pottedPlant', W/2-0.4, 0, -D/2+0.55, 0, ctx.era==='2026'?1.3:1);
  prop(g, ctx, 'lampRoundFloor', -W/2+0.45, 0, sz-0.2, 0);
  prop(g, ctx, 'rugDoormat', 0, 0, D/2-0.35, 0);
  if (ctx.era!=='2026') prop(g, ctx, 'speaker', -1.1, 0, -D/2+0.4, 0, 0.8);
  if ((ctx.wealth||40) < 32) prop(g, ctx, 'cardboardBoxClosed', W/2-0.55, 0, sz, 0.2);
  const sitZ = sz - sd.z*0.15 - 0.15;
  setAnchor(ctx, {x: lay===1?-0.35:0.05, y:0, z:sitZ, ry:Math.PI, pose:'sit'});
  spot(ctx, 0.7, 0, sitZ, Math.PI, 'sit');
  spot(ctx, -0.8, 0, 0.2, 0.4, 'sit');
  spot(ctx, bookX, 0, 0.6, lay===0?Math.PI/2:-Math.PI/2, 'stand');
}

function bedroom(g, ctx){
  const kid = ctx.age < 14;
  const lay = ctx.seed % 3;
  const apt = ctx.homeKind==='tower';
  const W = apt?4: (kid?5:6), D = apt?4:5;
  const floors = [0x7a5230,0x8d5a32,0xa06a3c,0x5c3b24];
  shell(g, ctx, {W, D, floor:woodTex(floors[(ctx.seed>>>2)%4], lay), windows:{n:[1]}, door:{side:'s', i:1},
    rug:{w:1.5, d:0.9, x: kid?0.6:-1.1, z:0.4}});
  const bedName = kid ? (lay===2?'bedBunk':'bedSingle') : (lay===1?'bedSingle':'bedDouble');
  const bd = dim(bedName);
  const bx = lay===1 ? 0.3 : -W/2 + bd.x/2 + 0.35;
  const bz = -D/2 + bd.z/2 + 0.25;
  prop(g, ctx, bedName, bx, 0, bz, 0);
  prop(g, ctx, kid?'pillowBlue':'pillow', bx-bd.x*0.2, bd.y*0.72, bz-bd.z*0.28, 0.2, 0.9);
  prop(g, ctx, 'sideTable', bx+bd.x/2+0.32, 0, bz-0.2, 0);
  prop(g, ctx, 'lampRoundTable', bx+bd.x/2+0.32, dim('sideTable').y, bz-0.2, 0, 0.85);
  if (ctx.era==='1986') prop(g, ctx, 'radio', bx+bd.x/2+0.32, dim('sideTable').y+0.18, bz-0.15, 0, 0.7);
  prop(g, ctx, 'cabinetBedDrawer', W/2-0.4, 0, 0.2, -Math.PI/2);
  prop(g, ctx, 'bookcaseOpenLow', -W/2+0.3, 0, D/2-0.7, Math.PI/2);
  prop(g, ctx, 'books', -W/2+0.48, 0.28, D/2-0.7, 0, fit('books', 0.24));
  // prayer rug in the corner — every bedroom keeps one
  prop(g, ctx, 'rugRectangle', W/2-1.15, 0, D/2-1.15, 0, 0.7);
  prop(g, ctx, 'coatRackStanding', W/2-0.35, 0, -0.6, 0);
  if (ctx.era==='2026' && !kid) {
    const t = prop(g, ctx, 'televisionModern', W/2-0.55, dim('cabinetBedDrawer').y, 0.15, -Math.PI/2, 0.7);
    addScreen(t, dim('televisionModern'), ctx.era, ctx);
  }
  if (kid) prop(g, ctx, 'bear', bx+0.45, bd.y*0.8, bz, 0.6, 0.7);
  prop(g, ctx, 'pottedPlant', -W/2+0.4, 0, -D/2+0.45, 0, 0.8);
  const lie = ctx.act==='sleep' || ctx.act==='tahajjud' && false;
  if (ctx.act==='pray' || ctx.act==='dhikr'){
    setAnchor(ctx, {x:W/2-1.15, y:0, z:D/2-1.35, ry:Math.PI, pose: ctx.ill?'sit':'pray'});
  } else {
    setAnchor(ctx, {x:bx, y:bd.y*0.55, z:bz+0.05, ry:Math.PI/2, pose:'lie'});
  }
  spot(ctx, bx+0.8, 0, bz+1.1, Math.PI, 'stand');
  spot(ctx, W/2-1.15, 0, D/2-1.5, Math.PI, 'pray');
}

function musalla(g, ctx){
  const work = ctx.variant==='work';
  const W = work?4:5, D = work?4:4;
  shell(g, ctx, {W, D, floor:carpetTex(css(ctx.pack.fabric), ctx.seed%4), windows:{n:[1,2]}, door:{side:'s', i:1}, noArt:true,
    rug:{w:1.3, d:2.05, x:0, z:-0.15}});
  // qibla niche
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 18, Math.PI), ctx.pack.furn.wood);
  arch.position.set(0, 1.55, -D/2+0.08); arch.rotation.y = Math.PI; g.add(arch);
  prop(g, ctx, 'bookcaseOpen', -W/2+0.32, 0, -0.2, Math.PI/2);
  prop(g, ctx, 'books', -W/2+0.5, 0.55, -0.15, 0, fit('books', 0.26));
  prop(g, ctx, 'books', -W/2+0.5, 0.95, -0.2, 0.3, fit('books', 0.24));
  prop(g, ctx, 'lampRoundFloor', W/2-0.4, 0, -0.4, 0);
  prop(g, ctx, 'rugDoormat', 0, 0, D/2-0.3, 0);
  if (!work) prop(g, ctx, 'pillow', 0.7, 0, 0.5, 0.4, 0.8);
  sign(g, work?'Prayer room':'Prayer corner', 0, 2.15, -D/2+0.1, 0, true);
  setAnchor(ctx, {x:0, y:0, z:0.15, ry:Math.PI, pose: ctx.act==='dhikr'?'floor':'pray'});
  spot(ctx, -0.7, 0, 0.7, Math.PI, 'pray');
  spot(ctx, 0.75, 0, 0.85, Math.PI, 'floor');
}

function prayerHall(g, ctx){
  const big = !PHONE && (ctx.size||1.4) > 1.5;
  const W = big?14:10, D = big?11:8;
  const colours = [[0x7f1d2d,0xe6c35c],[0x1f4d3a,0xe6c35c],[0x1e3a5f,0xf0d78c],[0x5a2a3a,0xd4b483]];
  const col = colours[ctx.seed % colours.length];
  shell(g, ctx, {W, D, floor:prayerTex(col[0], col[1]), windows:{e:[1,3], w:[1,3]}, door:{side:'s', i:Math.floor(W/2)-1}, noArt:true, open:false});
  // mihrab
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 10, 24, Math.PI), new THREE.MeshLambertMaterial({color:0xe6c35c}));
  arch.material.userData.room = 1;
  arch.position.set(0, 1.7, -D/2+0.12); g.add(arch);
  const niche = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24, 0, Math.PI), new THREE.MeshLambertMaterial({color:0x1f5e4a, side:THREE.DoubleSide}));
  niche.material.userData.room = 1;
  niche.position.set(0, 1.15, -D/2+0.1); niche.rotation.z = Math.PI; g.add(niche);
  // minbar
  prop(g, ctx, 'stairs', 2.3, 0, -D/2+1.5, Math.PI);
  prop(g, ctx, 'chairRounded', 2.5, 0.85, -D/2+1.15, Math.PI, 0.7);
  // columns
  const step = big?3.4:3.2;
  if (!PHONE){
    for (let x=-W/2+1.6; x<W/2-1; x+=step){
      for (const z of [-1.2, 1.8]){
        if (Math.abs(x)<1.2 && z<0) continue;
        prop(g, ctx, 'column', x, 0, z, 0, 2.5/Math.max(0.5, dim('column').y));
      }
    }
  }
  // qur'an shelves along the west wall
  for (let i=0;i<3;i++){
    prop(g, ctx, 'bookcaseClosed', -W/2+0.35, 0, -1+i*1.1, Math.PI/2);
  }
  prop(g, ctx, 'books', -W/2+0.55, 1.0, -0.8, 0, fit('books', 0.28));
  // shoe racks at the entrance
  prop(g, ctx, 'bench', -1.4, 0, D/2-0.7, Math.PI/2);
  prop(g, ctx, 'bench', 1.6, 0, D/2-0.7, Math.PI/2);
  prop(g, ctx, 'rugDoormat', 0, 0, D/2-0.45, 0);
  sign(g, ctx.placeName || 'Prayer hall', 0, 2.2, -D/2+0.12, 0, true);
  const onMinbar = ctx.occ==='imam' && ctx.act==='jumuah';
  if (onMinbar) setAnchor(ctx, {x:2.5, y:0.9, z:-D/2+1.7, ry:Math.PI, pose:'stand'});
  else setAnchor(ctx, {x:0, y:0, z:-0.2, ry:Math.PI, pose:'pray'});
  let k=0;
  for (let row=0; row<4; row++) for (let c=-3; c<=3; c++){
    if (c===0 && row===0) continue;
    spot(ctx, c*0.85, 0, 0.9+row*1.15, Math.PI, 'pray');
    if (++k> (PHONE?8:16)) break;
  }
}

function wudu(g, ctx){
  const W = 7, D = 5;
  shell(g, ctx, {W, D, floor:tileTex('#d5ebe4','#b7d0c8',1), windows:{n:[1,3,5]}, door:{side:'s', i:3}, noArt:true});
  const sinks = PHONE?3:4;
  for (let i=0;i<sinks;i++){
    const x = -2.2 + i*1.45;
    prop(g, ctx, i%2?'bathroomSinkSquare':'bathroomSink', x, 0.72, -D/2+0.55, 0, 1.15);
    prop(g, ctx, 'bathroomCabinet', x, 0, -D/2+0.4, 0, 0.9);
    prop(g, ctx, 'bathroomMirror', x, 1.55, -D/2+0.12, 0, 0.8);
    prop(g, ctx, 'stoolBarSquare', x, 0, -D/2+1.25, 0, 0.85);
  }
  prop(g, ctx, 'benchCushion', 0, 0, 1.15, Math.PI/2, 1.3);
  prop(g, ctx, 'bench', -2.4, 0, 0.9, Math.PI/2);
  prop(g, ctx, 'rugDoormat', -2.2, 0, D/2-0.4, 0);
  prop(g, ctx, 'rugDoormat', 2.2, 0, D/2-0.4, 0);
  prop(g, ctx, 'coatRack', 2.6, 0, 0.2, 0);
  prop(g, ctx, 'plantSmall1', 2.7, 0, -1.4, 0, 1.4);
  sign(g, 'Wudu', 0, 2.2, -D/2+0.1, 0, true);
  setAnchor(ctx, {x:-2.2, y:0, z:-D/2+1.25, ry:Math.PI, pose:'use'});
  for (let i=1;i<sinks;i++) spot(ctx, -2.2+i*1.45, 0, -D/2+1.25, Math.PI, 'use');
  spot(ctx, 0.4, 0, 1.15, Math.PI/2, 'sit');
}

function office(g, ctx){
  const open = ctx.seed % 3 !== 0;
  const W = open?8:6, D = open?6:5;
  const lay = ctx.seed % 2;
  shell(g, ctx, {W, D, floor:carpetTex(ctx.era==='1986'?'#6e7f86':ctx.era==='2006'?'#8a96a3':'#c5cdd2', lay),
    windows:{n:[1,2,4,5]}, door:{side:'s', i:1}});
  const desks = open ? [[-2.1,-0.8],[0.2,-0.8],[2.3,-0.8],[-2.1,1.1],[0.2,1.1]] : [[-0.4,-0.7]];
  const show = PHONE ? desks.slice(0, open?3:1) : desks;
  show.forEach((p,i)=>{
    prop(g, ctx, 'desk', p[0], 0, p[1], 0);
    const dh = dim('desk').y;
    prop(g, ctx, 'chairDesk', p[0], 0, p[1]+0.7, Math.PI);
    if (ctx.era==='1986'){
      prop(g, ctx, 'books', p[0]-0.15, dh, p[1]-0.05, 0.3, fit('books', 0.26));
      prop(g, ctx, 'radio', p[0]+0.22, dh, p[1], 0, 0.6);
    } else if (ctx.era==='2006'){
      const sc = prop(g, ctx, 'computerScreen', p[0], dh, p[1]-0.08, 0, 0.95);
      addScreen(sc, dim('computerScreen'), ctx.era, ctx);
      prop(g, ctx, 'computerKeyboard', p[0], dh, p[1]+0.12, 0, 0.8);
    } else {
      const lp = prop(g, ctx, 'laptop', p[0]+0.05, dh, p[1], 0.2, 0.85);
      addScreen(lp, dim('laptop'), ctx.era, ctx);
    }
    if (i===0) setAnchor(ctx, {x:p[0], y:0, z:p[1]+0.7, ry:Math.PI, pose:'sit'});
    else spot(ctx, p[0], 0, p[1]+0.7, Math.PI, 'sit');
  });
  prop(g, ctx, 'bookcaseOpen', -W/2+0.32, 0, -0.2, Math.PI/2);
  prop(g, ctx, 'bookcaseOpen', -W/2+0.32, 0, 0.7, Math.PI/2);
  prop(g, ctx, 'pottedPlant', W/2-0.4, 0, -D/2+0.5, 0);
  prop(g, ctx, 'trashcan', W/2-0.35, 0, D/2-0.4, 0);
  if (ctx.era==='2026') prop(g, ctx, 'plantSmall3', 2.2, 0, -D/2+0.45, 0, 1.2);
  sign(g, (ctx.placeName||'Office').replace(/,.*/,''), 0, 2.15, -D/2+0.08, 0, false);
}

function classroom(g, ctx){
  const W = 8, D = 7;
  shell(g, ctx, {W, D, floor:linoTex(ctx.era==='1986'?'#c4b59a':'#d5d8dc'), windows:{e:[1,3,5]}, door:{side:'s', i:1}});
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), new THREE.MeshLambertMaterial({map:boardTex()}));
  board.material.userData.room = 1;
  board.position.set(0, 1.5, -D/2+0.08); g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.06), ctx.pack.furn.wood);
  frame.position.set(0, 1.5, -D/2+0.05); g.add(frame);
  prop(g, ctx, 'desk', -2.3, 0, -D/2+1.3, 0);
  prop(g, ctx, 'chairDesk', -2.3, 0, -D/2+1.95, Math.PI);
  const rows = PHONE?2:3, cols = PHONE?3:4;
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
    const x = -2.4 + c*1.6, z = -0.4 + r*1.45;
    prop(g, ctx, 'desk', x, 0, z, 0, 0.9);
    prop(g, ctx, 'chairDesk', x, 0, z+0.62, Math.PI, 0.95);
    spot(ctx, x, 0, z+0.62, Math.PI, 'sit');
  }
  prop(g, ctx, 'bookcaseClosed', W/2-0.35, 0, -0.5, -Math.PI/2);
  prop(g, ctx, 'books', W/2-0.55, 0.4, -0.4, 0, fit('books', 0.25));
  prop(g, ctx, 'pottedPlant', -W/2+0.4, 0, -D/2+0.5, 0);
  sign(g, (ctx.placeName||'Classroom').replace(/,.*/,''), 0, 2.2, -D/2+0.08, 0, false);
  const pupil = ctx.occ==='pupil' || ctx.age<18;
  if (pupil) setAnchor(ctx, {x:-2.4, y:0, z:0.22, ry:Math.PI, pose:'sit'});
  else setAnchor(ctx, {x:-0.2, y:0, z:-D/2+1.7, ry:0, pose:'stand'});
}

function shop(g, ctx, mall){
  const W = mall?6:8, D = mall?5:7;
  const c1 = ctx.era==='1986'?'#e6d3b3':ctx.era==='2006'?'#e7e4dc':'#f4f6f5';
  const c2 = ctx.era==='1986'?'#c4b08a':ctx.era==='2006'?'#d0d5d8':'#d9e2df';
  shell(g, ctx, {W, D, floor:tileTex(c1,c2,mall?2:0), windows:{n:[1,2,4]}, door:{side:'s', i:2}});
  if (!mall){
    // grocery aisles
    const aisles = PHONE?2:3;
    for (let a=0;a<aisles;a++){
      const z = -1.6 + a*1.5;
      for (let k=0;k<3;k++){
        const x = -2.2 + k*1.15;
        prop(g, ctx, k%2?'bookcaseOpen':'bookcaseOpenLow', x, 0, z, 0);
        const top = k%2?0.55:0.32;
        const food = ['apple','loaf','can','carton','banana','bread','grapes','tomato'][(a+k+ctx.seed)%8];
        prop(g, ctx, food, x, top, z, 0, fit(food, 0.22));
      }
    }
    prop(g, ctx, 'kitchenFridge', W/2-0.55, 0, -D/2+0.7, -Math.PI/2);
    prop(g, ctx, 'kitchenFridgeSmall', W/2-0.55, 0, 0.3, -Math.PI/2);
  } else {
    prop(g, ctx, 'coatRackStanding', -1.6, 0, -0.4, 0);
    prop(g, ctx, 'coatRackStanding', -0.4, 0, -0.6, 0.4);
    prop(g, ctx, 'table', 1.1, 0, -0.2, 0);
    prop(g, ctx, 'cardboardBoxOpen', 0.85, dim('table').y, -0.15, 0.3);
    prop(g, ctx, 'cardboardBoxClosed', 1.4, dim('table').y, -0.3, 0);
    prop(g, ctx, 'loungeChair', -1.7, 0, 1.0, 0.6);
  }
  // counter
  prop(g, ctx, 'kitchenBar', 0, 0, D/2-1.15, 0, 1.3);
  prop(g, ctx, 'sideTable', 1.5, 0, D/2-1.15, 0);
  if (ctx.era!=='1986'){
    const reg = prop(g, ctx, 'computerScreen', 1.5, dim('sideTable').y, D/2-1.15, Math.PI, 0.7);
    addScreen(reg, dim('computerScreen'), ctx.era, ctx);
  } else prop(g, ctx, 'radio', 1.5, dim('sideTable').y, D/2-1.15, 0, 0.7);
  prop(g, ctx, 'pottedPlant', -W/2+0.35, 0, D/2-0.45, 0);
  sign(g, (ctx.placeName|| (mall?'Shop':'Market')).replace(/,.*/,''), 0, 2.2, -D/2+0.08, 0, false);
  const worker = ctx.occ==='shop' || ctx.occ==='retail' || ctx.act==='work';
  if (worker) setAnchor(ctx, {x:0.2, y:0, z:D/2-0.7, ry:Math.PI, pose:'stand'});
  else setAnchor(ctx, {x:-1.2, y:0, z:-0.2, ry:0.4, pose:'stand'});
  spot(ctx, -1.5, 0, 0.8, 0.2, 'stand');
  spot(ctx, 1.2, 0, -0.5, -0.4, 'stand');
  spot(ctx, 0.4, 0, D/2-0.7, Math.PI, 'stand');
}

function restaurant(g, ctx){
  const W = 7, D = 6;
  const lay = ctx.seed % 2;
  shell(g, ctx, {W, D, floor:woodTex(ctx.era==='1986'?0x6b4226:ctx.era==='2006'?0x8d6e63:0xcbb89a, lay),
    windows:{n:[1,3,4]}, door:{side:'s', i:1}, rug:{w:2.2, d:1.4, x:-1.2, z:0.2}});
  const tables = lay? [[-1.5,-0.6],[1.2,-0.5],[-1.4,1.3],[1.3,1.2]] : [[-1.6,0],[0.2,0.1],[1.7,-0.2]];
  tables.forEach((p,i)=>{
    const tn = ctx.era==='1986'?'tableCloth':'tableRound';
    prop(g, ctx, tn, p[0], 0, p[1], 0, 0.9);
    const th = dim(tn).y*0.9;
    prop(g, ctx, 'plate-dinner', p[0]-0.08, th, p[1], 0, fit('plate-dinner', 0.26));
    prop(g, ctx, 'cup', p[0]+0.12, th, p[1]-0.06, 0, fit('cup', 0.14));
    const ch = ctx.era==='2026'?'chairModernCushion':'chairCushion';
    prop(g, ctx, ch, p[0], 0, p[1]+0.65, Math.PI);
    if (i===0) setAnchor(ctx, {x:p[0], y:0, z:p[1]+0.65, ry:Math.PI, pose:'sit'});
    else spot(ctx, p[0], 0, p[1]+0.65, Math.PI, 'sit');
  });
  if (ctx.era==='1986') prop(g, ctx, 'loungeSofa', -W/2+0.7, 0, -D/2+0.7, 0.4, 0.8);
  prop(g, ctx, 'kitchenBar', W/2-0.7, 0, -0.4, -Math.PI/2);
  prop(g, ctx, 'pot-stew', W/2-0.7, dim('kitchenBar').y, -0.3, 0, fit('pot-stew', 0.32));
  prop(g, ctx, 'pottedPlant', -W/2+0.35, 0, D/2-0.4, 0);
  sign(g, 'Restaurant', 0, 2.15, -D/2+0.08, 0, false);
}

function hospital(g, ctx){
  const W = 8, D = 6;
  shell(g, ctx, {W, D, floor:linoTex('#d5e4df'), windows:{n:[1,3,5]}, door:{side:'s', i:1}, noArt:true});
  const beds = PHONE?2:3;
  for (let i=0;i<beds;i++){
    const x = -2.4 + i*2.3;
    prop(g, ctx, 'bedSingle', x, 0, -0.7, Math.PI/2, 0.92);
    prop(g, ctx, 'sideTable', x+0.15, 0, 0.55, 0);
    prop(g, ctx, 'chair', x-0.9, 0, 0.45, Math.PI/2);
    // curtain
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.7), new THREE.MeshLambertMaterial({color: i%2?0xc5ddd4:0xd7ebe4, side:THREE.DoubleSide}));
    cur.material.userData.room = 1;
    cur.position.set(x+1.15, 1.0, -0.2); g.add(cur);
    if (ctx.era==='2026' && i===0){
      const mon = prop(g, ctx, 'computerScreen', x+0.15, dim('sideTable').y, 0.55, -0.6, 0.65);
      addScreen(mon, dim('computerScreen'), ctx.era, ctx);
    }
    spot(ctx, x, dim('bedSingle').y*0.5, -0.7, Math.PI/2, 'lie');
  }
  prop(g, ctx, 'cabinetBedDrawer', W/2-0.4, 0, -D/2+0.6, -Math.PI/2);
  prop(g, ctx, 'trashcan', W/2-0.4, 0, 1.4, 0);
  prop(g, ctx, 'chairDesk', -W/2+0.8, 0, D/2-0.8, Math.PI);
  sign(g, (ctx.placeName||'Hospital').replace(/,.*/,''), 0, 2.2, -D/2+0.08, 0, false);
  setAnchor(ctx, {x:-2.4+0.7, y:0, z:0.15, ry:-Math.PI/2, pose:'stand'});
}

function study(g, ctx){
  const W = 4, D = 4;
  shell(g, ctx, {W, D, floor:woodTex(0x8d5a32, ctx.seed%3), windows:{n:[1]}, door:{side:'s', i:1}});
  prop(g, ctx, 'desk', -0.3, 0, -0.6, 0);
  prop(g, ctx, 'chairDesk', -0.3, 0, 0.15, Math.PI);
  const dh = dim('desk').y;
  prop(g, ctx, 'lampRoundTable', 0.15, dh, -0.75, 0, 0.8);
  prop(g, ctx, 'books', -0.45, dh, -0.55, 0.4, fit('books', 0.26));
  if (ctx.era==='1986') prop(g, ctx, 'radio', 0.2, dh, -0.45, 0, 0.65);
  else if (ctx.era==='2006'){
    const sc = prop(g, ctx, 'computerScreen', -0.15, dh, -0.7, 0, 0.9);
    addScreen(sc, dim('computerScreen'), ctx.era, ctx);
    prop(g, ctx, 'computerKeyboard', -0.1, dh, -0.4, 0, 0.75);
  } else {
    const lp = prop(g, ctx, 'laptop', -0.1, dh, -0.5, 0.3, 0.85);
    addScreen(lp, dim('laptop'), ctx.era, ctx);
  }
  prop(g, ctx, 'bookcaseOpen', W/2-0.3, 0, -0.2, -Math.PI/2);
  prop(g, ctx, 'bookcaseOpenLow', -W/2+0.28, 0, 0.6, Math.PI/2);
  prop(g, ctx, 'pottedPlant', W/2-0.35, 0, D/2-0.4, 0, 0.8);
  setAnchor(ctx, {x:-0.3, y:0, z:0.15, ry:Math.PI, pose:'sit'});
  spot(ctx, 0.8, 0, 0.8, -0.8, 'stand');
}

function halaqah(g, ctx){
  const W = 6, D = 5;
  shell(g, ctx, {W, D, floor:carpetTex(css(ctx.pack.fabric), 2), windows:{n:[1,3]}, door:{side:'s', i:2}, noArt:true,
    rug:{w:3.2, d:2.4, x:0, z:-0.1}});
  const n = PHONE?5:7;
  for (let i=0;i<n;i++){
    const a = i/n*Math.PI*2;
    prop(g, ctx, i%2?'pillowBlue':'pillow', Math.cos(a)*1.35, 0, Math.sin(a)*1.05, -a, 0.85);
    spot(ctx, Math.cos(a)*1.15, 0, Math.sin(a)*0.9, -a+Math.PI, 'floor');
  }
  prop(g, ctx, 'tableCoffee', 0, 0, 0, 0, 0.8);
  prop(g, ctx, 'books', 0, dim('tableCoffee').y, 0, 0.2, fit('books', 0.28));
  prop(g, ctx, 'bookcaseOpen', -W/2+0.3, 0, -0.4, Math.PI/2);
  sign(g, 'Halaqah', 0, 2.15, -D/2+0.08, 0, true);
  setAnchor(ctx, {x:0, y:0, z:1.05, ry:Math.PI, pose:'floor'});
}

function iftar(g, ctx){
  const W = 8, D = 6;
  shell(g, ctx, {W, D, floor:carpetTex('#6e2430', 1), windows:{n:[1,3,5]}, door:{side:'s', i:3}, noArt:true});
  for (let i=0;i<3;i++){
    const z = -1.4+i*1.4;
    prop(g, ctx, 'table', 0, 0, z, Math.PI/2, 1.15);
    const th = dim('table').y;
    prop(g, ctx, 'plate-dinner', -0.3, th, z, 0, fit('plate-dinner', 0.26));
    prop(g, ctx, 'bowl', 0.25, th, z, 0, fit('bowl', 0.18));
    prop(g, ctx, 'loaf', 0, th, z+0.15, 0, fit('loaf', 0.26));
    prop(g, ctx, 'chair', -1.15, 0, z, Math.PI/2);
    prop(g, ctx, 'chair', 1.15, 0, z, -Math.PI/2);
    spot(ctx, 1.15, 0, z, -Math.PI/2, 'sit');
  }
  sign(g, 'Masjid dining', 0, 2.15, -D/2+0.08, 0, true);
  setAnchor(ctx, {x:-1.15, y:0, z:-1.4, ry:Math.PI/2, pose:'sit'});
}

function warehouse(g, ctx){
  const W = 8, D = 7;
  shell(g, ctx, {W, D, floor:asphaltTex(), windows:{e:[2,4]}, door:{side:'s', i:3}});
  // override wall feel: concrete-ish already from seed. Stacks of boxes.
  for (let i=0;i<5;i++){
    const x = -2.5+(i%3)*1.6, z = -2+Math.floor(i/3)*1.8;
    prop(g, ctx, 'cardboardBoxClosed', x, 0, z, i, 1.4);
    prop(g, ctx, 'cardboardBoxClosed', x+0.1, dim('cardboardBoxClosed').y*1.2, z, i+0.4, 1.2);
  }
  prop(g, ctx, 'bookcaseOpen', W/2-0.4, 0, -1, -Math.PI/2, 1.3);
  prop(g, ctx, 'bookcaseOpen', W/2-0.4, 0, 0.4, -Math.PI/2, 1.3);
  prop(g, ctx, 'pallet' in LIB ? 'pallet' : 'cardboardBoxOpen', -W/2+0.8, 0, 1.5, 0, 1.6);
  sign(g, 'Warehouse', 0, 2.2, -D/2+0.08, 0, false);
  setAnchor(ctx, {x:-0.4, y:0, z:0.4, ry:0.6, pose:'use'});
  spot(ctx, 1.5, 0, 1.2, -0.4, 'stand');
}

function airport(g, ctx){
  const W = 9, D = 6;
  shell(g, ctx, {W, D, floor:tileTex('#d9dee3','#c3ccd2',0), windows:{n:[0,1,2,3,4,5,6,7]}, door:{side:'s', i:4}});
  for (let i=0;i<3;i++){
    prop(g, ctx, 'benchCushion', -2.6+i*2.5, 0, 0.2, Math.PI/2, 1.15);
    spot(ctx, -2.2+i*2.5, 0, 0.2, Math.PI/2, 'sit');
  }
  prop(g, ctx, 'pottedPlant', -W/2+0.45, 0, -D/2+0.55, 0, 1.3);
  prop(g, ctx, 'pottedPlant', W/2-0.45, 0, -D/2+0.55, 0, 1.3);
  prop(g, ctx, 'cardboardBoxClosed', 2.4, 0, 1.3, 0.2);
  prop(g, ctx, 'trashcan', -3.2, 0, 1.6, 0);
  sign(g, ctx.act==='away'?'Departures':'Airport', 0, 2.2, -D/2+0.1, 0, true);
  setAnchor(ctx, {x:-2.2, y:0, z:0.35, ry:Math.PI/2, pose: ctx.act==='work'?'stand':'sit'});
}

function imamOffice(g, ctx){
  const W = 5, D = 5;
  shell(g, ctx, {W, D, floor:carpetTex('#1f4d3a', 3), windows:{n:[1,2]}, door:{side:'s', i:1}, noArt:true});
  prop(g, ctx, 'desk', -0.2, 0, -0.8, 0);
  prop(g, ctx, 'chairRounded', -0.2, 0, 0.05, Math.PI);
  const dh = dim('desk').y;
  prop(g, ctx, 'books', -0.45, dh, -0.75, 0.5, fit('books', 0.28));
  prop(g, ctx, 'lampRoundTable', 0.25, dh, -0.85, 0, 0.8);
  prop(g, ctx, 'bookcaseOpen', -W/2+0.3, 0, 0.3, Math.PI/2);
  prop(g, ctx, 'bookcaseClosed', -W/2+0.3, 0, -0.7, Math.PI/2);
  prop(g, ctx, 'rugRectangle', 1.15, 0, 0.6, 0, 0.75);
  sign(g, "Imam's office", 0, 2.15, -D/2+0.08, 0, true);
  setAnchor(ctx, {x:-0.2, y:0, z:0.05, ry:Math.PI, pose:'sit'});
  spot(ctx, 1.1, 0, 1.3, -2, 'sit');
}

function park(g, ctx){
  const W = 16, D = 14;
  const v = ctx.seed % 3;
  shell(g, ctx, {W, D, floor:grassTex(v), sides:'', open:true, noArt:true});
  // path
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.2, D*0.8), new THREE.MeshLambertMaterial({color:0xcbbfa8}));
  path.material.userData.room = 1;
  path.rotation.x = -Math.PI/2; path.position.set(v===1?-2:1.2, 0.02, 0); g.add(path);
  if (v===2){
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6, D), new THREE.MeshLambertMaterial({color:0x4f8fc0}));
    water.material.userData.room = 1;
    water.rotation.x = -Math.PI/2; water.position.set(-W/2+3, 0.01, 0); g.add(water);
  }
  const trees = PHONE?4:7;
  const kinds = ['tree_detailed','tree_oak','tree_default','tree_pineRoundA','tree_pineSmallA'];
  for (let i=0;i<trees;i++){
    const n = kinds[(i+ctx.seed)%kinds.length];
    const x = -6+ (i%4)*3.4 + (i%2), z = -5 + Math.floor(i/2)*3.2;
    prop(g, ctx, n, x, 0, z, i, 3.2/Math.max(0.4, dim(n).y));
  }
  prop(g, ctx, 'bench', 2.2, 0, 0.4, Math.PI/2);
  prop(g, ctx, 'bench', 2.2, 0, -2.2, Math.PI/2);
  prop(g, ctx, 'table', -0.4, 0, 2.4, 0);
  prop(g, ctx, 'benchCushion', -0.4, 0, 3.15, 0, 0.9);
  prop(g, ctx, 'rock_smallA', 4.2, 0, 3.3, 0.4, 1.4);
  prop(g, ctx, 'trashcan', 3.4, 0, 1.2, 0);
  if (ctx.placeName) sign(g, ctx.placeName.replace(/,.*/,''), 3.6, 1.6, -4.5, 0.4, true);
  const playing = ctx.act==='play';
  setAnchor(ctx, {x: playing?0.4:2.2, y:0, z: playing?0.2:0.4, ry: playing?0.5:Math.PI/2, pose: playing?'cheer':'sit'});
  spot(ctx, -0.6, 0, 1.2, 0.8, 'cheer');
  spot(ctx, 1.2, 0, -1.1, -0.4, 'stand');
  spot(ctx, 2.2, 0, -2.2, Math.PI/2, 'sit');
}

function yard(g, ctx){
  const W = 10, D = 8;
  shell(g, ctx, {W, D, floor:grassTex(ctx.seed%3), sides:'n', open:true, windows:{n:[2,4,6]}, door:{side:'n', i:4}});
  prop(g, ctx, 'table', -1.2, 0, 0.5, 0);
  prop(g, ctx, 'chair', -1.2, 0, 1.4, Math.PI);
  prop(g, ctx, 'chair', -2.1, 0, 0.5, Math.PI/2);
  prop(g, ctx, ctx.seed%2?'sedan':'van', 2.4, 0, -1.6, Math.PI/2, 1.6);
  prop(g, ctx, 'pottedPlant', -4.2, 0, -D/2+0.8, 0, 1.2);
  prop(g, ctx, 'plantSmall1', 4, 0, 2, 0, 2.2);
  const tree = prop(g, ctx, 'tree_oak', -3.5, 0, 2.2, 0, 3.4/Math.max(0.4,dim('tree_oak').y));
  if (tree) {}
  setAnchor(ctx, {x:0.4, y:0, z:1.6, ry:0.2, pose: ctx.act==='play'?'cheer':'stand'});
  spot(ctx, -1.2, 0, 1.4, Math.PI, 'sit');
  spot(ctx, 1.4, 0, 2.2, -0.6, 'cheer');
}

function site(g, ctx){
  const W = 12, D = 10;
  shell(g, ctx, {W, D, floor:dirtTex(), sides:'', open:true});
  for (let i=0;i<5;i++) prop(g, ctx, 'cone', -3+i*1.3, 0, -2.5, 0, 1);
  prop(g, ctx, 'cardboardBoxClosed', 1.5, 0, 0.4, 0.3, 1.6);
  prop(g, ctx, 'cardboardBoxClosed', 1.8, dim('cardboardBoxClosed').y*1.4, 0.5, 0.6, 1.3);
  prop(g, ctx, 'cardboardBoxOpen', -1.2, 0, 1.2, 0, 1.5);
  // a short run of unfinished wall
  for (let i=0;i<3;i++) tile(g, ctx, 'wall', -1+i, 0, -4, 0);
  prop(g, ctx, 'tree_pineSmallA', 4.5, 0, 3, 0, 2.4);
  setAnchor(ctx, {x:0.2, y:0, z:0.8, ry:-0.4, pose:'use'});
  spot(ctx, -2, 0, 1.5, 0.6, 'stand');
}

function eid(g, ctx){
  const W = 16, D = 12;
  shell(g, ctx, {W, D, floor:grassTex(1), sides:'', open:true, noArt:true});
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 8, 20, Math.PI), new THREE.MeshLambertMaterial({color:0xe6c35c}));
  arch.material.userData.room = 1;
  arch.position.set(0, 1.8, -D/2+1.2); g.add(arch);
  const rows = PHONE?3:5, cols = PHONE?5:7;
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
    const x = (c-(cols-1)/2)*1.15, z = -2+r*1.5;
    prop(g, ctx, 'rugRectangle', x, 0, z, 0, 0.55);
    if (!(r===0 && c===Math.floor(cols/2))) spot(ctx, x, 0, z+0.15, Math.PI, 'pray');
  }
  sign(g, 'Eid prayer', 0, 2.5, -D/2+1.2, 0, true);
  setAnchor(ctx, {x:0, y:0, z:-1.85, ry:Math.PI, pose:'pray'});
}

function streetScene(g, ctx){
  const W = 14, D = 10;
  shell(g, ctx, {W, D, floor:asphaltTex(), sides:'n', open:true, windows:{n:[2,4,6,8]}, door:{side:'n', i:5}});
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.4), new THREE.MeshLambertMaterial({color:0xd9d3c7}));
  walk.material.userData.room = 1;
  walk.rotation.x = -Math.PI/2; walk.position.set(0, 0.03, -D/2+1.3); g.add(walk);
  // centre line
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, D*0.7), new THREE.MeshBasicMaterial({color:0xf2d36b}));
  line.rotation.x = -Math.PI/2; line.position.set(0, 0.04, 1.2); g.add(line);
  prop(g, ctx, ctx.era==='1986'?'van':'sedan', 3.2, 0, 0.8, Math.PI/2, 1.55);
  prop(g, ctx, 'bench', -2.4, 0, -D/2+1.3, Math.PI/2);
  prop(g, ctx, 'tree_default', -5.2, 0, -1.5, 0, 3/Math.max(0.4,dim('tree_default').y));
  prop(g, ctx, 'tree_oak', 5.4, 0, -1.2, 0, 3.2/Math.max(0.4,dim('tree_oak').y));
  prop(g, ctx, 'trashcan', -3.6, 0, -D/2+1.2, 0);
  if (ctx.placeName) sign(g, ctx.placeName.replace(/,.*/,''), 1.2, 1.7, -D/2+0.12, 0, false);
  setAnchor(ctx, {x:-0.4, y:0, z:-D/2+1.35, ry:0.3, pose:'stand'});
  spot(ctx, 1.2, 0, 0.2, -0.4, 'stand');
  spot(ctx, -2.4, 0, -D/2+1.5, Math.PI/2, 'sit');
}

function vehicle(g, ctx, bus){
  const L = bus?8.5:3.4, W = bus?2.3:1.7;
  ctx.W = W; ctx.D = L;
  // road under and around the vehicle
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, bus?14:10), new THREE.MeshLambertMaterial({map:asphaltTex()}));
  road.material.userData.room = 1;
  road.rotation.x = -Math.PI/2; road.position.set(0, -0.02, 0.5); g.add(road);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, bus?12:8), new THREE.MeshBasicMaterial({color:0xf2d36b}));
  line.rotation.x = -Math.PI/2; line.position.set(2.2, -0.01, 0); g.add(line);
  // cabin shell
  const body = new THREE.MeshLambertMaterial({color: ctx.era==='1986'?0x6e533c:ctx.era==='2006'?0xc5c8ce:0xf4f6f8, side:THREE.DoubleSide});
  body.userData.room = 1;
  const dark = new THREE.MeshLambertMaterial({color:0x2a3038, side:THREE.DoubleSide}); dark.userData.room = 1;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.08, L), dark);
  floor.position.set(0, 0.04, 0); g.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, L), body);
  roof.position.set(0, bus?1.85:1.45, 0); g.add(roof);
  // glass
  const glass = new THREE.MeshLambertMaterial({color:0xb7d4e8, transparent:true, opacity:0.35, side:THREE.DoubleSide, depthWrite:false});
  glass.userData.room = 1; ctx.pack.furn.glass = glass;
  const wind = new THREE.Mesh(new THREE.PlaneGeometry(W-0.2, bus?0.7:0.55), glass);
  wind.position.set(0, bus?1.25:1.05, -L/2+0.15); g.add(wind);
  for (const side of [-1, 1]){
    if (side>0) continue; // near side stays open so the camera is not inside the door
    const win = new THREE.Mesh(new THREE.PlaneGeometry(L*0.72, 0.48), glass);
    win.position.set(side*(W/2), bus?1.25:1.05, bus?0.2:-0.15);
    win.rotation.y = Math.PI/2; g.add(win);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, L*0.85), body);
    panel.position.set(side*(W/2), 0.45, 0); g.add(panel);
  }
  if (!bus){
    prop(g, ctx, 'loungeChair', -0.38, 0.08, -0.55, Math.PI, 0.72);
    prop(g, ctx, 'loungeChair', 0.38, 0.08, -0.55, Math.PI, 0.72);
    prop(g, ctx, 'loungeSofa', 0, 0.08, 0.85, 0, 0.7);
    // dash
    const dash = new THREE.Mesh(new THREE.BoxGeometry(W-0.25, 0.28, 0.35), ctx.era==='1986'?ctx.pack.furn.wood:dark);
    dash.position.set(0, 0.72, -L/2+0.45); g.add(dash);
    const wheel = prop(g, ctx, 'wheel-default', -0.38, 0.92, -L/2+0.62, 0, 0.55);
    if (wheel) wheel.rotation.x = -0.7;
    if (ctx.era==='1986') prop(g, ctx, 'radio', 0.35, 0.9, -L/2+0.5, 0, 0.45);
    else {
      const sc = prop(g, ctx, 'computerScreen', 0.28, 0.9, -L/2+0.48, Math.PI, 0.4);
      addScreen(sc, dim('computerScreen'), ctx.era, ctx);
    }
    prop(g, ctx, 'bathroomMirror', 0, 1.25, -L/2+0.28, 0, 0.28);
    // the nose of the car, so the shape reads through the windscreen
    prop(g, ctx, ctx.era==='1986'?'van':'sedan', 0, 0, -L/2-0.9, Math.PI, 1.15);
    setAnchor(ctx, {x:-0.38, y:0.08, z:-0.42, ry:Math.PI, pose:'sit'});
    spot(ctx, 0.38, 0.08, -0.42, Math.PI, 'sit');
  } else {
    const rows = PHONE?3:4;
    for (let i=0;i<rows;i++){
      const z = -1.6 + i*1.15;
      prop(g, ctx, 'benchCushion', -0.45, 0.08, z, 0, 0.55);
      prop(g, ctx, 'benchCushion', 0.55, 0.08, z, Math.PI, 0.55);
      spot(ctx, 0.55, 0.08, z, Math.PI, 'sit');
    }
    prop(g, ctx, 'loungeChair', -0.45, 0.08, -L/2+0.85, Math.PI, 0.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.5,8), dark);
    pole.position.set(0.15, 0.9, 0); g.add(pole);
    sign(g, ctx.era==='1986'?'Mississauga Transit':ctx.era==='2006'?'MiWay':'MiWay bus', 0, 1.55, -L/2+0.2, 0, true);
    setAnchor(ctx, {x:-0.45, y:0.08, z:-0.45, ry:0, pose:'sit'});
  }
  // trees slipping past the windows
  prop(g, ctx, 'tree_default', -3.2, 0, -1.5, 0, 2.6/Math.max(0.4,dim('tree_default').y));
  prop(g, ctx, 'tree_oak', 3.4, 0, 1.4, 0, 2.8/Math.max(0.4,dim('tree_oak').y));
  ctx.lamp = new THREE.PointLight(0xffe2c0, 0.7, 6);
  ctx.lamp.position.set(0, 1.2, 0); g.add(ctx.lamp);
}

function lecture(g, ctx){
  classroom(g, ctx);
  sign(g, (ctx.placeName||'Lecture').replace(/,.*/,''), 0, 2.25, -ctx.D/2+0.06, 0, false);
}

const BUILDERS = {
  kitchen, living, bedroom, musalla, prayerhall:prayerHall, wudu, office,
  grocery:(g,c)=>shop(g,c,false), shopmall:(g,c)=>shop(g,c,true),
  classroom, restaurant, hospital, study, halaqah, iftar, warehouse, airport,
  imam:imamOffice, park, yard, site, eid, street:streetScene,
  car:(g,c)=>vehicle(g,c,false), bus:(g,c)=>vehicle(g,c,true), lecture,
};

function bake(g){
  g.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  const lights = [];
  const meshes = [];
  g.traverse(o=>{
    if (o.isLight) lights.push(o);
    if (o.isMesh) meshes.push(o);
  });
  for (const o of meshes){
    if (o.userData.keep || Array.isArray(o.material)){ keep.push(o); continue; }
    const mat = o.material;
    if (!mat) continue;
    let geo;
    try { geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); }
    catch (e){ keep.push(o); continue; }
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (!geo.getAttribute('uv')){
      const c = geo.getAttribute('position').count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c*2), 2));
    }
    if (!buckets.has(mat.uuid)) buckets.set(mat.uuid, {mat, geos:[]});
    buckets.get(mat.uuid).geos.push(geo);
  }
  const out = new THREE.Group();
  for (const {mat, geos} of buckets.values()){
    let mg = null;
    try { mg = mergeGeometries(geos, false); } catch (e){ mg = null; }
    for (const x of geos) x.dispose();
    if (!mg) continue;
    const mesh = new THREE.Mesh(mg, mat);
    mesh.userData.baked = 1;
    mesh.castShadow = !PHONE; mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const o of keep){
    const wm = o.matrixWorld.clone();
    o.removeFromParent();
    wm.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  for (const l of lights) out.add(l);
  return out;
}

export function buildSpace(spec){
  const rnd = rngOf(spec.seed>>>0);
  const pack = matsFor(spec, rnd);
  const g = new THREE.Group();
  const ctx = {
    ...spec, rnd, pack, era:spec.era||'2026', screens:[], spots:[], anchor:{x:0,y:0,z:0.4,ry:Math.PI,pose:'stand'}, lamp:null, W:6, D:5,
  };
  const fn = BUILDERS[spec.type] || living;
  try { fn(g, ctx); }
  catch (e){ console.warn('space', spec.type, e); living(g, ctx); }
  const baked = bake(g);
  baked.scale.setScalar(FS);
  const outdoor = !!spec.outdoor;
  baked.userData = {
    type: spec.type,
    key: spec.key,
    label: spec.label,
    anchor: ctx.anchor,
    spots: ctx.spots,
    lamp: ctx.lamp,
    screens: ctx.screens,
    glass: pack.furn.glass || null,
    outdoor,
    skyBg: outdoor || spec.type==='car' || spec.type==='bus',
    view: {prayerhall:11, eid:12, park:9, yard:8, site:9, airport:8, warehouse:8, classroom:8, lecture:8, office:7.2, grocery:8, shopmall:6.5, restaurant:7, iftar:8, hospital:7.5, car:5.2, bus:6.4, halaqah:6.2, wudu:6.6, street:8.5, living:6.2, kitchen:6.4, bedroom:6}[spec.type] || 5.8,
    W: ctx.W, D: ctx.D,
  };
  return baked;
}

export function disposeSpace(g){
  if (!g) return;
  const seen = new Set();
  g.traverse(o=>{
    if (o.userData && o.userData.baked && o.geometry) o.geometry.dispose();
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)){
      if (m && m.userData && m.userData.room && !seen.has(m.uuid)){ seen.add(m.uuid); m.dispose(); }
    }
  });
}
