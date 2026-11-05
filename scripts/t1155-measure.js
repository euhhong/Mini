'use strict';
// T1155: same t646 segment chain + t791 V8 sample framework, independent
// day/night restores, ABBA. Uses disposable plain copies (no Git worktree).
// node scripts/t1155-measure.js /absolute/source /absolute/tpl-t100.db /absolute/out
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const source=path.resolve(process.argv[2]||path.join(__dirname,'..')), tpl=path.resolve(process.argv[3]||''), out=path.resolve(process.argv[4]||'/tmp/t1155-abba');
if(!process.argv[3]||!fs.statSync(tpl).isFile())throw Error('a completed 200-day t100 template is required');
fs.mkdirSync(out,{recursive:true});
const adapter=path.join(source,'scripts','.t1155-t646-adapter.js');
let s=fs.readFileSync(path.join(source,'scripts/t646-anatomy.js'),'utf8');
function replace(a,b){if(!s.includes(a))throw Error('t646 adapter anchor missing: '+a.slice(0,70));s=s.replace(a,b)}
replace("  try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'ignore' }); } catch (e) {}\n  execFileSync('git', ['worktree', 'add', '--detach', '-q', dir, ref || 'HEAD'], { cwd: ROOT, stdio: 'ignore' });",`  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  for(const name of fs.readdirSync(ROOT)) if(!['.git','node_modules','계측','보고','.tools'].includes(name)) fs.cpSync(path.join(ROOT,name),path.join(dir,name),{recursive:true});`);
s=s.replaceAll("  try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'ignore' }); } catch (e) {}",'  fs.rmSync(dir,{recursive:true,force:true});');
replace("const at = (Math.floor(fs.statSync(TPL).mtimeMs / DAY) + 2) * DAY - LEAD_S * 1000;", "const at = (Math.floor(fs.statSync(TPL).mtimeMs / DAY) + 2) * DAY + (process.env.T1155_PHASE === 'night' ? 0.70 : 0.08) * DAY;");
replace("const WINS = [['day', 0.10, 0.62], ['night', 0.72, 0.97]];", "const WINS = (process.env.T1155_PHASE === 'night' ? [['night',0.72,0.97]] : [['day',0.10,0.62]]);");
replace('  const phaseNow = async () =>', '  await sleep(60000); // identical post-observer warm-up for every arm\n  const phaseNow = async () =>');
fs.writeFileSync(adapter,s);
const meta={source,template:tpl,node:process.version,host:os.hostname(),cpu:os.cpus()[0].model,cpus:os.cpus().length,order:['A1','B1','B2','A2'],framework:'t646 --seg --lines, t791 V8 sampling; separate phase restores, 60s warm-up, 3 x 15s slices, unchanged 24-minute day',runs:[]};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(meta,null,2));
try {
 for(const phase of ['day','night'])for(const [tag,mode] of [['A1','0'],['B1','1'],['B2','1'],['A2','0']]){
  const name=tag+'-'+phase,env={...process.env,T1145_XY_COLS:mode,T646_DIR:out,T646_TPL:tpl,T646_SLICE_S:'15',T646_SLICES:'3',T646_PORT:'61200',T1155_PHASE:phase,T646_COUNT:'0'};
  const start=Date.now();const fd=fs.openSync(path.join(out,name+'.runner.log'),'w');
  const r=spawnSync(process.execPath,[adapter,'run','inf',name,'--seg','--lines','--ref',process.env.T1155_SOURCE_HEAD||'HEAD'],{cwd:source,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
  const row={tag:name,mode,phase,rc:r.status,error:r.error?.message,seconds:(Date.now()-start)/1000};meta.runs.push(row);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(row));
  if(r.status!==0)throw Error('measurement failed: '+name);
 }
 const r=spawnSync(process.execPath,[adapter,'table'],{cwd:source,env:{...process.env,T646_DIR:out},stdio:'inherit'});if(r.status!==0)throw Error('table failed');
} finally {fs.rmSync(adapter,{force:true});}
