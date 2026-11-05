#!/usr/bin/env node
// @regress
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),Module=require('module'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),flags=['T312_FISH_ACT','T325_WOOD_ACT','T347_FORAGE_ACT'];
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.log('FAIL '+name+': '+e.message);}}
if(!process.env.T1180_MUTANT)for(const val of [undefined,'0','1',''])check('defaults '+String(val),()=>{
 const env={...process.env};for(const k of flags){delete env[k];if(val!==undefined)env[k]=val;}
 const r=spawnSync(process.execPath,['-e',`const E=require('./sim/economy-sim');console.log(JSON.stringify(${JSON.stringify(flags)}.map(k=>E[k])));`],{cwd:ROOT,env,encoding:'utf8'});
 assert.strictEqual(r.status,0,r.stderr);assert.deepStrictEqual(JSON.parse(r.stdout.trim().split('\n').at(-1)),flags.map(()=>val!=='0'));
});
for(const k of flags)delete process.env[k];
process.env.ENABLE_VILLAGES='0';
if(process.env.T1180_MUTANT){const old=Module._extensions['.js'];Module._extensions['.js']=function(m,file){const formula=process.env.T1180_MUTANT==='formula',target=path.join(ROOT,formula?'sim/economy-sim.js':'server/villages.js');if(file!==target)return old(m,file);let src=fs.readFileSync(file,'utf8');const needle=formula?'if (!actual && productionFormulaOff(v, npc.currentJob)) return;':'if (Math.hypot(npc.x - S.tx, npc.y - S.ty) > 44)';assert(src.includes(needle));m._compile(src.replace(needle,formula?'if (false) return;':'if (false)'),file);};}
const V=require('../server/villages'),P=V.__labProbe._t1180Probe,E=require('../sim/economy-sim'),F=require('../server/freshfish');
const state=V.__p3Bind({}).state,oldDeps=state.deps;state.deps={players:new Map()};
const id=F.ids().find(x=>F.kgOf(x)>0),kg=F.kgOf(id);
function fixture(){return {v:{ccx:0,ccy:0,_granList:[],econ:{storage:{fish:0},treasury:{fish:0},_t312Cells:1,_fishOutLast:10}},p:{pid:'fish-test',simJob:'fisher',x:1000,y:16,inventory:{[id]:2},_t312U:20,_t312Kg:kg*2}};}
check('physical host suppresses all formula byproducts even before sites exist',()=>{
 const E2=require('../sim/economy-sim-v2');
 for(const job of ['fisher','lumberjack','forager']){
  const make=()=>{const w=E2.createWorldV2({seed:1020,villageCount:1}),v=w.villages[0];v.land={...v.land,water:1,wood:1,fertility:1,stone:1};v.storage.food=10000;for(const p of v.npcs)p.currentJob=job;return {w,v};};
  const a=make(),b=make();assert(!E.productionFormulaOff(a.v,job));E.bindProductionActs(b.w);assert(E.productionFormulaOff(b.v,job));
  E.tickVillage(a.v,1);E.tickVillage(b.v,1);
  const sum=v=>Object.values(v.dailyProductionBuf||{}).reduce((n,x)=>n+x,0);
  assert(sum(a.v)>0,job+' positive control');assert.strictEqual(sum(b.v),0,job+' formula leaked');
 }
});
check('missing fishing site cannot reactivate the legacy catch clock',()=>{const src=fs.readFileSync(path.join(ROOT,'server/villages.js'),'utf8'),m=src.match(/else if \((!_lifeEcon\(\)\.T312_FISH_ACT && .*?)\) \{/);assert(m);const f=new Function('_lifeEcon','npc','now','return ('+m[1]+');');assert.strictEqual(f(()=>E,{},10000),false);assert.strictEqual(f(()=>({T312_FISH_ACT:false}),{},10000),true);assert.strictEqual(f(()=>({T312_FISH_ACT:false}),{_lastFishAt:9000},10000),false);});
check('full fish walks to the hall before any deposit',()=>{
 const {v,p}=fixture(),t=10000;
 assert(P.returnStep(v,p,t,.3,.7,1,true));assert(P.returnStep(v,p,t+P.storeMs()+1,.3,.7,1,true));
 assert.strictEqual(v.econ.storage.fish,0);assert.strictEqual(p.inventory[id],2);assert.strictEqual(p._t312U,20);
 assert.strictEqual(p.targetX,16);assert.strictEqual(p.targetY,16);
 p.x=16;p.y=16;const a=t+P.storeMs()+2;P.returnStep(v,p,a,.3,.7,1,true);
 assert.strictEqual(v.econ.storage.fish,0);P.returnStep(v,p,a+P.storeMs()+1,.3,.7,1,true);
 assert.strictEqual(p.inventory[id],1);assert.strictEqual(p._t312U,10);assert.strictEqual(p._t312Kg,kg);
 assert(Math.abs(v.econ.storage.fish+v.econ.treasury.fish+p._t312U-20)<1e-6);
});
check('zero demand keeps every fish and credited unit',()=>{const {v,p}=fixture();v.econ._fishOutLast=0;assert.strictEqual(P.fishDeliver(v,p),0);assert.strictEqual(p.inventory[id],2);assert.strictEqual(p._t312U,20);assert.strictEqual(p._t312Kg,kg*2);});
check('whole fish only; second accepted fish is deposited once',()=>{const {v,p}=fixture();v.econ._fishOutLast=9;assert.strictEqual(P.fishDeliver(v,p),0);v.econ._fishOutLast=10;assert.strictEqual(P.fishDeliver(v,p),10);assert.strictEqual(p.inventory[id],1);v.econ._fishOutLast=20;assert.strictEqual(P.fishDeliver(v,p),10);assert.strictEqual(p.inventory[id],0);assert.strictEqual(p._t312U,0);assert.strictEqual(p._t312Kg,0);assert.strictEqual(P.fishDeliver(v,p),0);assert(Math.abs(v.econ.storage.fish+v.econ.treasury.fish-20)<1e-6);});
check('credit without a physical fish cannot enter storage',()=>{const {v,p}=fixture();p.inventory={};assert.strictEqual(P.fishDeliver(v,p),0);assert.strictEqual(v.econ.storage.fish,0);assert.strictEqual(p._t312U,20);});
check('sea species use the same partial deposit and keep rejected fish',()=>{const S=require('../server/seafish'),sea=S.ids().find(x=>!F.ids().includes(x)&&S.kgOf(x)>0);assert(sea);const {v,p}=fixture();p.inventory={[sea]:2};p._t312Kg=S.kgOf(sea)*2;assert.strictEqual(P.fishDeliver(v,p),10);assert.strictEqual(p.inventory[sea],1);assert.strictEqual(p._t312U,10);assert.strictEqual(p._t312Kg,S.kgOf(sea));});
state.deps=oldDeps;
if(!process.env.T1180_MUTANT)check('mutant removing arrival check is caught',()=>{const r=spawnSync(process.execPath,[__filename],{cwd:ROOT,env:{...process.env,T1180_MUTANT:'1'},encoding:'utf8'});assert.strictEqual(r.status,1,r.stderr);assert(r.stdout.includes('FAIL full fish walks to the hall before any deposit'),r.stdout);});
if(!process.env.T1180_MUTANT)check('mutant restoring formula production is caught',()=>{const r=spawnSync(process.execPath,[__filename],{cwd:ROOT,env:{...process.env,T1180_MUTANT:'formula'},encoding:'utf8'});assert.strictEqual(r.status,1,r.stderr);assert(r.stdout.includes('FAIL physical host suppresses all formula byproducts even before sites exist'),r.stdout);});
console.log(`PASS ${pass} / FAIL ${fail}`);process.exitCode=fail?1:0;
