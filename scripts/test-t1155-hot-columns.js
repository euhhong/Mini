'use strict';
// T1155 directive witness: actual hot functions must survive a body whose
// property reads throw. Mirrors remain writable at the module boundary.
const assert=require('node:assert/strict'),fs=require('fs'),acorn=require('acorn'),BC=require('../server/body-cols');
assert(BC.ON,'run with T1145_XY_COLS=1 or verify');
const src=fs.readFileSync(require.resolve('../server/zone'),'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest'});
const names=['_t1155StuckSlot','_t1155DetectSlot','_t1145Detect','_t1155DetectObject','_t1145Stuck','_t1155FollowSlot','_t1155FollowObject','_t1145Follow','_t1155StillObject','_t1155StillSlot','_wwIsStill','_t1155PreObject','_t1155StreamSlot','_t1155AlwaysSlot','_t1155ActiveSlot','_wwPreOne','_wwPre','_t1155PostObject','_wwPost','_wwStillPost'];
const code=names.map(name=>{const n=ast.body.find(x=>x.type==='FunctionDeclaration'&&x.id.name===name);assert(n,name);return src.slice(n.start,n.end)}).join('\n');
const target={pid:'guard',isNpc:true,x:64,y:64,vx:0,vy:0,path:[{x:100,y:64}],pathIndex:0,canadiaVillage:true};let guarded=false;
const p=new Proxy(target,{get(o,k){if(guarded)throw Error('hot body property read: '+String(k));return o[k]},set(o,k,v){o[k]=v;return true}});
const s=BC.alloc(p);let stampN=0;
const WW={zw:1024,zh:1024,tw:32,TB:new Uint8Array(256).fill(0x55),X:new Float64Array(4),Y:new Float64Array(4),VX:new Float64Array(4),VY:new Float64Array(4),RD:new Float64Array(4),ST:new Uint8Array(4),RX:new Float64Array(4),RY:new Float64Array(4),RR:new Float64Array(4),CNT:new Int32Array(6),ensure(){},trees(){},step(n,dt){for(let i=0;i<n;i++){this.X[i]+=this.VX[i]*dt;this.Y[i]+=this.VY[i]*dt;this.ST[i]=2}}};
const env={BC,_B1155:BC,_xyC:BC.C,T1145_XY_COLS:true,MOVE_SPEED:64,NPC_WALK_MULT:1,_t671Lt:(x,y,r)=>Math.hypot(x,y)<r,_t671Gt:(x,y,r)=>Math.hypot(x,y)>r,_WW:WW,
 T774_ACTIVE_COL:false,_t774I:0,_wwCut:false,_wwSeq:[],_wwCode:[],_wwList:[],_wwStill:[],_wwStill0:[],_wwOn:true,T689_GC:true,T672_WALK_CUT:true,
 players:new Map([['guard',p]]),_wwStat:{ticks:0,steps:0},_wwTC:{still:0},_walk:{steps:0,terrQ:0,wallQ:0,ej:0,ejQ:0,ejFail:0,ejPids:new Set()},qtResources:null,_wwRes:null,_wwNoRes:[],_wwResGen:0,_wwVerify:false,
 TRUNK_COLLIDER_MAX:9,PLAYER_BODY_R:6,ROCK_COLLIDER_R:14,Streams:{ON:true,isStreamCell:()=>true,STREAM_SLOW0:0.5},ZONE_ID:'fixture',T585_WALK_STAT:false,
 Roads:{stampEntityPx(body,x,y){assert.strictEqual(body,p);assert(Number.isFinite(x)&&Number.isFinite(y));stampN++}}};
const f=new Function(...Object.keys(env),code+'\nreturn {_t1145Detect,_t1145Follow,_wwIsStill,_wwPre,_wwPost,_wwStillPost};')(...Object.values(env));
guarded=true;
assert.equal(f._t1145Detect(p,0),false);assert.equal(f._t1145Detect(p,1601),true);
assert.equal(f._t1145Follow(p,1),false);assert.equal(BC.C.vx[s],64);
assert.equal(f._wwIsStill(p),true);
assert.equal(f._wwPre(1/30),1);f._wwPost(p,0);assert(BC.C.X[s]>64);assert.equal(stampN,1);
BC.setAt(s,'vx',0);BC.setAt(s,'vy',0);assert.equal(f._wwPre(1/30),0);f._wwStillPost(p);assert.equal(stampN,2);
BC.positionAt(s,100,64);assert.equal(f._t1145Follow(p,1),true);assert.equal(BC.C.pathIndex[s],1);
guarded=false;
for(const k of BC.FIELDS){BC.set(p,k,undefined);assert(Object.is(BC.C[k][s],p[k]));BC.set(p,k,-0);assert(Object.is(BC.C[k][s],-0));BC.set(p,k,NaN);assert(Number.isNaN(BC.C[k][s]));}
BC.set(p,'pathIndex','2');assert.equal(BC.update(p,'pathIndex',1,false),2);assert.equal(BC.C.pathIndex[s],3);assert.equal(BC.update(p,'pathIndex',1,true),4);
BC.set(p,'_stuckN',0n);assert.equal(BC.update(p,'_stuckN',-1,true),-1n);assert.equal(BC.C._stuckN[s],-1n);
BC.assignObject(p,{behavior:'sleep',floor:undefined});assert.equal(BC.C.behavior[s],'sleep');assert.equal(BC.C.floor[s],undefined);
BC.erase(p,'behavior');assert.equal(BC.C.behavior[s],undefined);assert(!Object.hasOwn(p,'behavior'));
BC.release(p);assert.equal(BC.slot(p),-1);for(const k of BC.FIELDS)assert.equal(BC.C[k][s],undefined);
const q={x:1,y:2};assert.equal(BC.alloc(q),s);BC.release(q);
console.log('T1155: body-read guard, moving/still gather/scatter, '+BC.FIELDS.length+' fields, -0/NaN/undefined, release/reuse passed');
