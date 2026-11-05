'use strict';
// T1192: 몸 크기는 민물/바다 표, kcal 밀도는 T59. 낱개 묶음 무게는 몸 크기의 출처가 아니다.
const ON=typeof process==='undefined'||!process.env||process.env.T1192_FISH_SPECIES!=='0';
const Fresh=require('./freshfish'),Sea=require('./seafish');
function bodyKg(id,fallback=0){const f=Fresh.kgOf(id);if(f>0)return f;const row=Sea.TABLE?.find(r=>r.id===id);if(row?.kg?.length===2)return(row.kg[0]+row.kg[1])/2;return fallback;}
function species(){return require('./fish-preserve').species();}
function items(){return require('./fish-preserve').items();}
function isItem(id){return ON&&!!items()[id];}
function factor(id){return require('./kcal').kcalOf(id)/require('./kcal').DAY_KCAL;}
function note(v,id,n){if(!ON||!species().includes(id)||!(n>0))return;const m=v._t1192CatchMix||(v._t1192CatchMix={});m[id]=(m[id]||0)+n;}
function shares(v){const m=v?._t1192CatchMix||{},o={};let sum=0;for(const id of species()){const u=(m[id]||0)*factor(id);if(u>0){o[id]=u;sum+=u;}}if(sum>0)for(const id in o)o[id]/=sum;return o;}
function reserve(v,id,oldDry,oldPickle,oldFactor){const it=items()[id];if(!it)return 0;const f=factor(id),s=shares(v)[it.from]||0;return f>0?s*(it.kind==='dry'?oldDry:oldPickle)*oldFactor/f:0;}
function audit(){const Sp=require('./specialty'),W=require('./weights');return species().map(id=>{const fr=Fresh.kgOf(id),r=Sea.TABLE?.find(x=>x.id===id),old=Sp.RESOURCES[id]?.weight||W.CORE_KG[id]||fr||0;return{id,ko:require('./fish-preserve').koOf(id),parcelKg:old,bodyKg:bodyKg(id,old),source:fr?'설계/설계_민물고기.md §1 (T603 kg 미확인 · 현행 몸 크기 유지)':r?.kg?'설계/고증_바닷물고기.md (T592/T602 보통 구간 중앙)':'미확인 · 현행 값 유지',verified:!fr&&!!r?.kg};});}
module.exports={ON,bodyKg,species,items,isItem,factor,note,shares,reserve,audit};
