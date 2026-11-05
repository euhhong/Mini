# Usage: ACT_NODE=node22 python3 scripts/t1183-measure.py SOURCE OUTPUT [off,T790_NO_SNAP,...,all]
# SOURCE must be an immutable checkout/snapshot with dependencies installed.
import os,sys,json,time,subprocess,pathlib,hashlib,resource,re,signal
SRC=pathlib.Path(sys.argv[1]).resolve(); OUT=pathlib.Path(sys.argv[2]).resolve(); OUT.mkdir(parents=True,exist_ok=True)
NODE=os.environ.get('ACT_NODE','node')
KEYS=['T790_NO_SNAP','T1041_WAR_BODY','T811_ARMS_BODY','T449_BODY_DAY','T491_BATCH_FROM_BODY','T561_ROSTER_BODY','T502_ODDS_REAL','T815_DRAFT_FAMINE','T941_BATTLE_DAY','T627_TRIP_DAY']
variants=sys.argv[3].split(',') if len(sys.argv)>3 else ['off']+KEYS+['all']
rec={'source':str(SRC),'node':subprocess.check_output([NODE,'--version'],text=True).strip(),'files':{f:hashlib.sha256((SRC/f).read_bytes()).hexdigest() for f in ['server/villages.js','server/war-live.js','sim/war-core.js','sim/economy-sim.js']},'runs':[]}
if (OUT/'suite.json').exists():
 prior=json.loads((OUT/'suite.json').read_text())
 if prior.get('files') != rec['files']: raise RuntimeError('source changed; use a new output directory')
 rec=prior
def save(): (OUT/'suite.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
def run(tag,args,env):
 if any(r['tag']==tag and r['exit'] in (0,1) for r in rec['runs']):return
 log=OUT/(tag+'.log'); e=os.environ.copy(); e.update(env); t=time.monotonic(); ru=resource.getrusage(resource.RUSAGE_CHILDREN)
 print('START',tag,flush=True)
 with log.open('w') as stream:
  try:
   p=subprocess.Popen([NODE]+args,cwd=SRC,env=e,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True); code=p.wait(timeout=3600)
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
   code=124
 ru1=resource.getrusage(resource.RUSAGE_CHILDREN)
 row={'tag':tag,'args':args,'env':env,'exit':code,'wallSec':round(time.monotonic()-t,3),'cpuUs':round((ru1.ru_utime+ru1.ru_stime-ru.ru_utime-ru.ru_stime)*1e6),'log':str(log)}
 txt=log.read_text(); m=re.search(r'판 (/tmp/sbc-[\w-]+)',txt)
 if m: row['sbcDir']=m[1]
 rec['runs'].append(row);save(); print('DONE',tag,code,row['wallSec'],flush=True)
 if code not in (0,1) or (code==1 and args[0]!='scripts/server-baseline-check.js'):sys.exit(code or 2)
for v in variants:
 env={k:'0' for k in KEYS};env.update({k:'0' for k in ['T1078_BANDIT_ALL','T1079_BANDIT_CAMP','T1104_BANDIT_WALK','T1159_HOME_N']});env.update({k:'1' for k in ['T1076_ARMY_MORALE','T466_LOOT_ACT','T826_LOOT_BODY','T1168_SORTIE_AMMO']})
 if v=='all':env.update({k:'1' for k in KEYS})
 elif v!='off':env[v]='1'
 dest=OUT/v;dest.mkdir(exist_ok=True)
 run(v+'-plan',['scripts/server-baseline-check.js','계측/서버기준선_2026-11-04c.json','--plan','1020:400,7:60,42:60','--par','3'],env)
 e=dict(env,T400_BUILD_ACT='0',VILLAGE_CARAVAN_MAX='0',T577_DIR=str(dest/'server800'),T577_PAR='1',T577_TAG=v)
 run(v+'-server800',['scripts/t577-server-run.js','800','1020'],e)
 for seed in [1020,7,42]:
  e=dict(env,T17_JSON=str(dest/f'lab-{seed}.json'),LAB_SEEDCACHE=str(dest/f'lab-{seed}.seedcache.json'),DB_PATH=str(dest/f'lab-{seed}.db'))
  run(v+f'-lab-{seed}',['scripts/t17-metrics.js','800',str(seed)],e)
