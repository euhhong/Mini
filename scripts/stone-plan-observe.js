'use strict';
if(require('worker_threads').isMainThread&&process.env.T17_JSON){
 const fs=require('fs'),crypto=require('crypto'),path=require('path'),E=require('../sim/economy-sim'),tick=E.tickVillage;
 const source={};for(const f of ['sim/economy-sim.js','sim/economy-sim-v2.js'])source[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',f))).digest('hex');
 const days={};
 E.tickVillage=function(v,day,...args){
  const tool=v._stoneToolMade||0,sword=v._stoneWeaponMade||0;
  const r=tick.call(this,v,day,...args),d=days[day]||(days[day]={pop:0,empty:0,mason:0,forager:0,stone:0,tool:0,toolsMade:0,swordsMade:0,stoneConsumed:0});
  d.pop+=v.npcs.length;d.empty+=!v.npcs.length;d.mason+=v.counts.mason||0;d.forager+=v.counts.forager||0;d.stone+=v.storage.stone||0;d.tool+=v.storage.tool||0;d.toolsMade+=(v._stoneToolMade||0)-tool;d.swordsMade+=(v._stoneWeaponMade||0)-sword;d.stoneConsumed+=v._consDay?.stone||0;
  return r;
 };
 process.on('exit',()=>fs.writeFileSync(process.env.T17_JSON+'.stone.json',JSON.stringify({source,flag:E.T419_STONE_REAL,days})));
}
