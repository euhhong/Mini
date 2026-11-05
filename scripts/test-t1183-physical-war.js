// @regress
'use strict';
process.env.ENABLE_VILLAGES = '0';
const assert = require('assert/strict');
const { run } = require('./t1183-battle-parity');
const WL = require('../server/war-live').createWarLive({ cellPx: 32, pxPerM: 32, tickHz: 30 });
const V = require('../server/villages');
let pass = 0;
function check(fn, name) { fn(); pass++; console.log('✓ ' + name); }
const free = run(false), held = run(true), physical = run(true, true);
check(() => assert.equal(free.same, true), '같은 병력·거리·씨: 자유 교전의 화살 시각과 10초 사기 곡선 = 랩 커널');
check(() => assert.equal(run(false, true).same, true), '물리 전이 팔도 자유 교전의 정본 계산을 바꾸지 않는다');
check(() => assert(held.server.firstArrow.B > held.lab.firstArrow.B), '대조: 옛 대형 제어는 방어 궁수의 첫 사격을 늦춘다');
check(() => assert.equal(physical.server.firstArrow.B, physical.lab.firstArrow.B), '실물 대형: 사거리 안 방어 궁수 첫 사격 = 랩');

const H = V.__p3Bind({ warLive: WL, deps: { isTerrainBlockedLocal: () => false, players: new Map(), moveSpeed: 64 }, _warNoCollide: true, _warStat: {} });
check(() => {
  const w={id:99,born:400,phase:'march'}, fight=WL.makeFight(w,null);fight.physical=true;
  for(const [side,x] of [['A',40],['B',70]])WL.enlist(fight,side,{pid:side,type:'archer'},{x:x*32,y:40*32});
  const body={w,fight,mode:'camp'};H.state._warStat.engage=0;
  for(let i=0;i<300&&body.mode==='camp';i++)H._warOverwatch(body);
  assert.equal(body.mode,'fight');assert.equal(w.phase,'battle');assert.equal(fight.state,'engaged');
  assert.equal(H.state._warStat.engage,1);H._warOverwatch(body);assert.equal(H.state._warStat.engage,1);
}, '돌격 명령 전에도 진의 사거리 안 적에게 쏘며 실제 첫 발로 교전에 들어간다');
check(() => {
  const comp = H._warSampleComp({ spear: 80, archer: 26 }, WL.MU.NPC_SAMPLE);
  assert.equal(comp.spear, 80); assert.equal(comp.archer, 26);
}, '전쟁 몸 팔에서는 106명 명부를 34명 표본으로 줄이지 않는다');
check(() => {
  const speed = H.state.deps.moveSpeed; H.state.deps.moveSpeed = undefined;
  try {
    const group = WL.buildGroup([{ type: 'champion', x: 10, y: 10 }], 'line', { cx: 20, cy: 20 }, 0, 7);
    H._warSnapToSlots(group); WL._muStepFollow(group);
    assert.equal(group.units[0].x, 10); assert.equal(group.units[0].y, 10);
  } finally { H.state.deps.moveSpeed = speed; }
}, '걸음 정본 미주입도 순간 배치로 대체하지 않는다');
const f = { holder: 'B', t: 1, objective: { x: 100, y: 10 } };
const world = H._warWorld(f), shooter = { x: 40, y: 10, hp: 100 };
const defender = { side: 'B', x: 10, y: 10, hp: 100, _t1183Shooter: shooter };
const ctx = { _cen: { A: { x: 100, y: 10, n: 1 } } };
check(() => {
  const d = world.advance(ctx, defender); assert(d && d.dx > 0 && d.dy === 0);
  assert.equal(world.hold(ctx, defender, Object.assign(shooter, { ctl: true })), false);
}, '맞는 수비 몸은 실제 쏜 적 방향으로 전진하고 대형 제어에 묶이지 않는다');
check(() => {
  const own = Object.assign({}, defender); delete own._t1183Shooter;
  assert.equal(world.advance(ctx, own), null);
  shooter.hp = 0; assert.equal(world.advance(ctx, defender), null);
}, '피격하지 않은 수비병과 죽은 발사자는 추격 근거가 아니다');

const g = WL.buildGroup([{ type: 'champion', x: 10, y: 10 }, { type: 'spear', x: 10, y: 12 }], 'line', { cx: 20, cy: 20 }, 0, 7);
H._t790Mark(g);
const fight = { adv: { side: 'A', released: false }, t: 0 }, body = { fight, atkGroup: g };
check(() => {
  assert.equal(H._warGroupReady(g), false);
  let ticks = 0;
  while (!H._warGroupReady(g) && ticks++ < 1000) { fight.t += WL.STEP_DT; H._warAdvanceMarch(body); assert.deepEqual(g.cmd, { cx: 20, cy: 20 }); }
  assert(ticks > 1 && ticks < 1000); assert.equal(H._warGroupReady(g), true);
  assert.equal(fight.adv.formed, undefined);
}, '지휘 몸과 병사가 집결하는 동안 돌격 원점은 출발하지 않고 몸만 걸어온다');
check(() => {
  const crowd = WL.buildGroup(Array.from({ length: 12 }, (_, i) => ({ type: 'spear', x: 10+i*0.1, y: 10+(i%3)*0.2 })), 'wall', { cx: 20, cy: 20 }, 0, 7);
  H._t790Mark(crowd);
  for (let tick=0; tick<500; tick++) {
    const before = crowd.units.map(u => [u.x,u.y]); WL._muStepFollow(crowd, crowd._t790Walk);
    crowd.units.forEach((u,i) => assert(Math.hypot(u.x-before[i][0],u.y-before[i][1]) <= crowd._t790Walk+1e-9));
  }
}, '밀집한 대열도 추종+겹침 해소의 합이 몸 한 걸음을 넘지 않는다');
check(() => {
  const fs=require('fs'), src=fs.readFileSync(require('path').join(__dirname,'../server/zone.js'),'utf8');
  const stand=/function _standCellNear\(x0, y0, blocked\) \{[\s\S]*?\n\}/.exec(src);
  const old=H.state.deps.standCellNear, terrain=H.state.deps.isTerrainBlockedLocal;
  const blocked=(x,y)=>Math.floor(x)===20&&Math.floor(y)===20;
  H.state.deps.standCellNear=new Function('ZONE','_BLOCKED_STAND',stand[0]+'\nreturn _standCellNear;')({zoneWidth:1e7,zoneHeight:1e7},()=>false);
  H.state.deps.isTerrainBlockedLocal=(x,y)=>blocked(x/32,y/32); H.state._warTerrMemo=new Map(); H.state._warNoCollide=false;
  try {
    const group=WL.buildGroup([{type:'champion',x:30,y:20}],'line',{cx:30,cy:20},0,7);H._t790Mark(group);
    const cap=group._t790Walk;
    for(let i=0;i<Math.ceil(20/cap);i++){
      const p={...group.cmd};H._warWalkGroupTo(group,{cx:20,cy:20},cap);
      assert(!blocked(group.cmd.cx,group.cmd.cy));assert(Math.hypot(group.cmd.cx-p.cx,group.cmd.cy-p.cy)<=cap+1e-9);
    }
    assert(Math.hypot(group.cmd.cx-20,group.cmd.cy-20)<=WL.MU.FORM_R);
  } finally { H.state.deps.standCellNear=old;H.state.deps.isTerrainBlockedLocal=terrain;H.state._warNoCollide=true;H.state._warTerrMemo=new Map(); }
}, '원점 목표가 물·집 칸이면 정본 빈 칸으로 걸어 비켜 선다');
check(() => {
  const fs=require('fs'),src=fs.readFileSync(require('path').join(__dirname,'../server/zone.js'),'utf8');
  const stand=/function _standCellNear\(x0, y0, blocked\) \{[\s\S]*?\n\}/.exec(src);
  const old=H.state.deps.standCellNear,terrain=H.state.deps.isTerrainBlockedLocal;
  const blocked=(x,y)=>Math.floor(x)===40&&y>=15&&y<26;
  H.state.deps.standCellNear=new Function('ZONE','_BLOCKED_STAND',stand[0]+'\nreturn _standCellNear;')({zoneWidth:1e7,zoneHeight:1e7},()=>false);
  H.state.deps.isTerrainBlockedLocal=(x,y)=>blocked(x/32,y/32);H.state._warTerrMemo=new Map();H.state._warNoCollide=false;
  try {
    const group=WL.buildGroup([{type:'champion',x:30,y:20}],'line',{cx:30,cy:20},0,7);H._t790Mark(group);
    const enemy=WL.buildGroup([{type:'champion',x:70,y:20}],'line',{cx:90,cy:20},0,7);
    const fight=WL.makeFight({id:19,born:400},null);fight.adv={side:'A',released:false,formed:true};
    fight.route=[{x:30,y:20},{x:70,y:20}];fight.objective={x:70,y:20};
    const body={fight,atkGroup:group,defGroup:enemy,pts:[{x:30*32,y:20*32},{x:70*32,y:20*32}]};group.detour=H._warDetourFor(body);
    for(let i=0;i<1500&&!fight.adv.released;i++){
      const p={...group.cmd};fight.t+=WL.STEP_DT;H._warAdvanceMarch(body);
      assert(!blocked(group.cmd.cx,group.cmd.cy));assert(Math.hypot(group.cmd.cx-p.cx,group.cmd.cy-p.cy)<=group._t790Walk+1e-9);
    }
    assert.equal(fight.adv.released,true);assert(Math.abs(group.cmd.cy-20)>1);
  } finally {H.state.deps.standCellNear=old;H.state.deps.isTerrainBlockedLocal=terrain;H.state._warNoCollide=true;H.state._warTerrMemo=new Map();}
}, '거친 행군선이 벽을 관통해도 실제 적 몸까지 고운 길로 돌아 교전에 풀린다');
console.log(`\n${pass} 통과 / 0 실패`);
