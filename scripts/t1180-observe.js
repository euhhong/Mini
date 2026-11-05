'use strict';
// T1180 실서버 관측 preload: 동작 변경 없이 입고·실제 몸·수식 폴백·비용을 센다.
if(require('worker_threads').isMainThread && process.env.T577_SEED){
 const fs=require('fs'),path=require('path'),Module=require('module'),crypto=require('crypto'),root=path.resolve(__dirname,'..');
 const st={seed:+process.env.T577_SEED,flags:Object.fromEntries(['T312_FISH_ACT','T325_WOOD_ACT','T347_FORAGE_ACT'].map(k=>[k,process.env[k]])),runtime:{node:process.version,v8:process.versions.v8,icu:process.versions.icu},source:{},tickN:0,tickNs:0,bodyIn:{fish:0,wood:0,forage:0},remoteIn:{fish:0,wood:0,forage:0},allIn:{fish:0,wood:0,forage:0},formula:{},rejected:{},days:[],errors:[]};
 const O=globalThis.__t1180Observe={st,formula(v,p,r){const cells=p.currentJob==='fisher'?v._t312Cells:p.currentJob==='lumberjack'?v._t325Cells:v._t347Cells;const k=p.currentJob+'/'+r+'/'+(cells==null?'unknown':cells===0?'zero':'present');st.formula[k]=(st.formula[k]||0)+1;}};
 const old=Module._extensions['.js'];Module._extensions['.js']=function(m,file){if(file!==path.join(root,'sim/economy-sim.js')&&file!==path.join(root,'server/villages.js'))return old(m,file);
  let src=fs.readFileSync(file,'utf8');st.source[path.relative(root,file)]=crypto.createHash('sha256').update(src).digest('hex');
  if(file.endsWith('/sim/economy-sim.js')){
   const gate='if (!actual && productionFormulaOff(v, npc.currentJob)) return;';
   if(!src.includes(gate))throw new Error('T1180 observer formula gate missing');
   src=src.replace(gate,"if (!actual && productionFormulaOff(v, npc.currentJob)) { const k=npc.currentJob+'/'+r; const O=globalThis.__t1180Observe; O.st.rejected[k]=(O.st.rejected[k]||0)+1; return; } if(!actual && ['fisher','lumberjack','forager'].includes(npc.currentJob))globalThis.__t1180Observe.formula(v,npc,r);");
   src+=`\n;(()=>{const O=globalThis.__t1180Observe,orig=module.exports.tickVillage;module.exports.tickVillage=function(...a){const t=process.hrtime.bigint();try{return orig.apply(this,a)}finally{O.st.tickN++;O.st.tickNs+=Number(process.hrtime.bigint()-t);}};for(const [key,name]of [['fish','fishToGranary'],['wood','woodToGranary'],['forage','forageToGranary']]){const f=module.exports[name];module.exports[name]=function(...a){const g=f.apply(this,a);O.st.allIn[key]+=g||0;return g;};}})();`;
  }else src+=`\n;(()=>{const O=globalThis.__t1180Observe;for(const [key,get,set]of [['fish',()=>_t312Deliver,f=>_t312Deliver=f],['wood',()=>_t325Deliver,f=>_t325Deliver=f],['forage',()=>_t347Deliver,f=>_t347Deliver=f]]){const f=get();set(function(v,p,...a){const g=f.call(this,v,p,...a);if(g>0){O.st.bodyIn[key]+=g;const S=p._t720,t=p._granTask;const goal=S&&S.k?{x:S.tx,y:S.ty}:t?_granLadder(t):{x:v.ccx*SZ+SZ/2,y:v.ccy*SZ+SZ/2};if(Math.hypot(p.x-goal.x,p.y-goal.y)>44+1e-6)O.st.remoteIn[key]+=g;}return g;});}})();`;
  m._compile(src,file);
 };
 const Events=require('../server/events'),create=Events.createLedger;
 Events.createLedger=function(...a){const L=create.apply(this,a),scan=L.scanDay;L.scanDay=function(w,...b){try{const m=require.cache[path.join(root,'server/villages.js')],S=m?.exports.__p3Bind({}).state;const sum=(k)=>w.villages.reduce((n,v)=>n+(v[k]||0),0);st.days.push({day:w.day,pop:w.villages.reduce((n,v)=>n+v.npcs.length,0),empty:w.villages.filter(v=>!v.npcs.length).length,dead:sum('_deadTot'),bodies:S?.villages.reduce((n,v)=>n+(v.npcPids?.length||0),0),bodyIn:{...st.bodyIn},allIn:{...st.allIn}});}catch(e){st.errors.push(String(e));}return scan.call(this,w,...b);};return L;};
 process.on('exit',()=>{st.tickUs=st.tickN?st.tickNs/st.tickN/1000:0;fs.writeFileSync(process.env.T577_OUT+'.t1180.json',JSON.stringify(st));});
}
