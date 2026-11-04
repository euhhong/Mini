// 가드 하네스 — node test-guard.mjs
import { makeGuard } from './guard.mjs';
const home = '/Users/jm', mini = home + '/Mini', base = mini + '/_api', wt = base + '/wt/batch_api-t1-1104';
const g = makeGuard({ wt, home, mini, base });
let ok = 0, bad = 0;
const t = (name, tool, input, expectBlock) => {
  const why = g(tool, input); const blocked = !!why;
  if (blocked === expectBlock) ok++; else { bad++; console.log(`✗ ${name}: ${blocked ? '막힘 ' + why : '통과'}`); }
};
// 막혀야 하는 것
t('ssh', 'Bash', { command: 'ssh seoul cat /opt/x' }, true);
t('scp', 'Bash', { command: 'cd x && scp a root@1.2.3.4:/tmp' }, true);
t('서버 IP', 'Bash', { command: 'curl http://49.247.194.130:3000/debug' }, true);
t('git push', 'Bash', { command: 'git push origin HEAD' }, true);
t('git -c push', 'Bash', { command: 'git -c x=y push' }, true);
t('force', 'Bash', { command: 'git rebase main --force' }, true);
t('remote set-url', 'Bash', { command: 'git remote set-url origin https://x' }, true);
t('global config', 'Bash', { command: 'git config --global user.name a' }, true);
t('checkout main', 'Bash', { command: 'git checkout main' }, true);
t('PAT 읽기', 'Bash', { command: 'cat ~/Mini/durango-mini/.git/claude-pat.txt' }, true);
t('키 변수', 'Bash', { command: 'echo $ANTHROPIC_API_KEY' }, true);
t('printenv', 'Bash', { command: 'printenv' }, true);
t('env 파이프', 'Bash', { command: 'env | grep KEY' }, true);
t('sudo', 'Bash', { command: 'sudo rm x' }, true);
t('rm 집', 'Bash', { command: 'rm -rf ~' }, true);
t('rm 뿌리', 'Bash', { command: 'rm -rf /' }, true);
t('rm 위', 'Bash', { command: 'rm -rf ..' }, true);
t('서버 비밀', 'Bash', { command: 'cat /root/.durango-secret' }, true);
t('duckdns 토큰', 'Bash', { command: 'curl "https://www.duckdns.org/update?domains=x"' }, true);
t('ssh 키 읽기', 'Read', { file_path: home + '/.ssh/id_ed25519' }, true);
t('키 파일 읽기', 'Read', { file_path: '~/.config/mini-api/key' }, true);
t('durango-mini 읽기', 'Read', { file_path: mini + '/durango-mini/server/zone.js' }, true);
t('밖 쓰기', 'Write', { file_path: home + '/Desktop/x.md', content: '' }, true);
t('지시 쓰기', 'Edit', { file_path: mini + '/지시/지시_T1.md' }, true);
t('밖 읽기', 'Read', { file_path: home + '/Documents/a.txt' }, true);
t('위로 탈출', 'Write', { file_path: wt + '/../../x.js' }, true);
t('Glob 비밀', 'Glob', { pattern: '**/claude-pat*' }, true);
// 통과해야 하는 것
t('하네스', 'Bash', { command: 'node scripts/test-move-soa.js 2>&1 | tail -3' }, false);
t('커밋', 'Bash', { command: 'git add -A && git commit -m "[승인 대기 · T1] x"' }, false);
t('git log', 'Bash', { command: 'git log --oneline -5 origin/main' }, false);
t('rm 안쪽', 'Bash', { command: 'rm -rf tmp/out' }, false);
t('공개 끝점', 'Bash', { command: 'curl -s https://mini-saebeol.duckdns.org/startinfo' }, false);
t('environment 낱말', 'Bash', { command: 'grep -n environment sim/x.js' }, false);
t('안쪽 쓰기', 'Write', { file_path: wt + '/보고/T1_2026-11-04.md' }, false);
t('상대 쓰기', 'Edit', { file_path: 'sim/economy-sim.js' }, false);
t('산그림 쓰기', 'Write', { file_path: mini + '/산그림/T1153/a.png' }, false);
t('지시 읽기', 'Read', { file_path: mini + '/지시/지시_T1153.md' }, false);
t('_3d_in 읽기', 'Read', { file_path: mini + '/_3d_in/body.blend' }, false);
t('Grep 기본', 'Grep', { pattern: 'npcStep' }, false);
t('웹', 'WebFetch', { url: 'https://ko.wikipedia.org/wiki/송국리_문화' }, false);
console.log(`가드 ${ok}/${bad}`);
process.exit(bad ? 1 : 0);
