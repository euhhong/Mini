#!/usr/bin/env python3
"""Read completed t1155-measure ABBA output; do not infer a pass from partial runs."""
import argparse,hashlib,json,math,pathlib,statistics
p=argparse.ArgumentParser(description=__doc__);p.add_argument('directory',type=pathlib.Path);a=p.parse_args();d=a.directory
manifest=json.loads((d/'manifest.json').read_text());table=json.loads((d/'table.json').read_text())
runs=manifest.get('runs',[])
if len(runs)!=8 or any(r.get('rc')!=0 for r in runs):raise SystemExit('ABBA incomplete or failed')
metrics=[];groups={}
for run in runs:
 rows=[r for r in table['runs'] if r['tag']==run['tag'] and r['W']==run['phase']]
 if len(rows)!=1:raise SystemExit('missing/duplicate table row: '+run['tag'])
 row=rows[0];lines=row.get('lines') or {}
 vals={'selfUs':lines.get('selfUs'),'npcStepUs':lines.get('stepUs')}
 if not lines.get('chunks') or not lines.get('stepSamples') or not row.get('ticks') or not row.get('pop'):raise SystemExit('no real sampling/ticks/pop: '+run['tag'])
 if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in vals.values()):raise SystemExit('invalid metric: '+run['tag'])
 entry={'tag':run['tag'],'phase':run['phase'],'mode':run['mode'],'pop':row['pop'],'ticks':row['ticks'],'chunks':lines['chunks'],'npcStepSamples':lines['stepSamples'],**vals}
 metrics.append(entry);groups.setdefault((run['phase'],run['mode']),[]).append(entry)
summary={}
for phase in ['day','night']:
 section={}
 for mode in ['0','1']:
  entries=groups.get((phase,mode),[])
  if len(entries)!=2:raise SystemExit('ABBA needs two repeats per arm and phase')
  section[mode]={metric:{'median':statistics.median([x[metric] for x in entries]),'min':min(x[metric] for x in entries),'max':max(x[metric] for x in entries)} for metric in ['selfUs','npcStepUs']}
 section['selfRangesDisjointAndLower']=section['1']['selfUs']['max']<section['0']['selfUs']['min']
 section['npcStepRangesDisjointAndLower']=section['1']['npcStepUs']['max']<section['0']['npcStepUs']['min']
 summary[phase]=section
output={'framework':manifest['framework'],'host':manifest['host'],'cpu':manifest['cpu'],'node':manifest['node'],'source':manifest['source'],'template':manifest['template'],'inputsSHA256':{f:hashlib.sha256((d/f).read_bytes()).hexdigest() for f in ['manifest.json','table.json']},'complete':True,'runs':metrics,'phases':summary,'selfRangeCondition':all(summary[s]['selfRangesDisjointAndLower'] for s in ['day','night']),'npcStepRangeCondition':all(summary[s]['npcStepRangesDisjointAndLower'] for s in ['day','night']),'candidateWithoutNpcStepRegression':all(summary[s]['selfRangesDisjointAndLower'] and summary[s]['npcStepRangesDisjointAndLower'] for s in ['day','night']),'condition':'same box, independent phase restores; competing jobs must be disclosed in the report; two repeat-window aggregates per arm form each range'}
(d/'comparison.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
for phase,s in summary.items():
 print(phase,'self',s['0']['selfUs'],'->',s['1']['selfUs'],'npcStep',s['0']['npcStepUs'],'->',s['1']['npcStepUs'])
print('self range condition',output['selfRangeCondition'],'npcStep range condition',output['npcStepRangeCondition'],'candidate without npcStep regression',output['candidateWithoutNpcStepRegression'])
