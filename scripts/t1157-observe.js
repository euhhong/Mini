'use strict';
const fs=require('fs'), E=require('../sim/economy-sim-v2'), tick=E.tickWorldV2;
let last, kg=0, legs=0, starvingDays=0;const prior=new WeakMap();
E.tickWorldV2=function(w,...args){
  const hook=w.onBasket;
  w.onBasket=function(type,data){if(type==='arrive'){kg+=data.c.kg||0;legs++;}if(hook)return hook(type,data);};
  try{return tick.call(this,w,...args);}finally{
    w.onBasket=hook;last=w;
    for(const v of w.villages)if(v._fdDay?.starving>0)starvingDays++;
  }
};
process.on('exit',()=>{if(!last||!process.env.T17_JSON)return;fs.writeFileSync(process.env.T17_JSON+'.observe.json',JSON.stringify({days:last.day,pop:last.villages.reduce((n,v)=>n+v.npcs.length,0),empty:last.villages.filter(v=>!v.npcs.length).length,dead:last.villages.reduce((n,v)=>n+(v._deadTot||0),0),kg,legs,kgPerLeg:legs?kg/legs:0,starvingDays,mines:last.villages.filter(v=>/^광산/.test(v.name)).map(v=>({name:v.name,pop:v.npcs.length,counts:v.counts,trade:v.tradeStats,dead:v._deadTot||0}))}));});
