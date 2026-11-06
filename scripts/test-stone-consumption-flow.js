#!/usr/bin/env node
'use strict';
process.env.T419_STONE_REAL='1';
process.env.T400_BUILD_ACT='0';
const assert=require('assert'),E=require('../sim/economy-sim'),E2=require('../sim/economy-sim-v2');
const w=E2.createWorldV2({seed:1020,villageCount:1}),v=w.villages[0];
v.storage.food=10000;v.storage.stone=1000;v.storage.tool=0;v.storage.weapon=0;
v.counts={mason:1,farmer:v.npcs.length-1};v.npcs.forEach((p,i)=>{p.currentJob=i?'farmer':'mason';p.age=30;});
E.tickVillage(v,1);
const tools=v._stoneToolMade||0,swords=v._stoneWeaponMade||0,used=tools*E.stoneRealPer('tool').stone+swords*E.stoneRealPer('stoneSword').stone;
assert(used>0,'positive mason production required');
assert((v._consDay?.stone||0)+1e-9>=used,`actual mason stone ${used} absent from consumption flow ${v._consDay?.stone}`);
console.log(JSON.stringify({tools,swords,recipeStone:used,recordedStone:v._consDay.stone}));
console.log('PASS actual stone material enters consumption flow');
