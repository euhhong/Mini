// API 세션 가드 — 에이전트가 쓰는 도구 하나하나를 실행 전에 본다(PreToolUse 훅).
// 막는 것: 서버 접속 · git push(미는 건 러너만) · force · durango-mini 폴더 · 비밀(PAT · API 키 · ssh · 서버 비밀) ·
//          sudo · 집 통째로 지우기 · 작업 폴더 밖 쓰기.
// 돌려주는 값: null = 통과 · 문자열 = 막은 이유(에이전트에게 그대로 보인다).
import path from 'node:path';

const SERVER_HOSTS = ['49.247.194.130', '108.160.135.177', '141.164.35.114'];

// 경로 어디에 나와도 막는 조각(읽기 · 쓰기 · 명령 전부)
const SECRET_BITS = [
  'durango-mini',          // 재민 클론 — 무접촉
  'claude-pat',            // GitHub PAT
  '.durango-secret', 'CENTRAL_SECRET',
  '.config/mini-api',      // API 키 파일
  'ANTHROPIC_API_KEY',
  '/.ssh', '~/.ssh', '$HOME/.ssh',
  'duckdns.org/update',    // DuckDNS 토큰 쓰는 주소
];

const BASH_DENY = [
  [/(^|[\s;&|(`])(ssh|scp|sftp|ssh-copy-id|mosh)(\s|$)/, '서버 접속(ssh · scp)은 세션 몫이 아닙니다 — 배포 · 서버 명령은 재민 손입니다.'],
  [/(^|[\s;&|(`])rsync\s[^\n]*\S+:\S*/, '원격 rsync 는 막혀 있습니다.'],
  [/(^|[\s;&|(`])git(\s[^;&|\n]*)?\spush(\s|$)/, 'git push 는 러너가 끝에 한 번만 합니다(batch 가지). 커밋만 하십시오.'],
  [/(^|[\s;&|(`])git\s+(-[^\s]+\s+)*remote\s+(add|set-url)/, '리모트를 바꾸지 마십시오.'],
  [/(^|[\s;&|(`])git\s+(-[^\s]+\s+)*config\s+(--global|--system)/, '전역 git 설정은 막혀 있습니다.'],
  [/(^|[\s;&|(`])git\s+(-[^\s]+\s+)*(checkout|switch)\s+(-[^\s]+\s+)*main(\s|$)/, '이 작업 폴더는 제 가지에 머뭅니다(main 으로 바꾸지 마십시오).'],
  [/--force(-with-lease)?(\s|=|$)/, 'force 는 0회입니다.'],
  [/(^|[\s;&|(`])sudo(\s|$)/, 'sudo 는 막혀 있습니다.'],
  [/(^|[\s;&|(`])(printenv|env)(\s*$|\s*[|;&>])/, '환경 변수 덤프는 막혀 있습니다(키가 섞입니다).'],
  [/(^|[\s;&|(`])set(\s*$|\s*[|;&>])/, '환경 변수 덤프는 막혀 있습니다(키가 섞입니다).'],
  [/(^|[\s;&|(`])security\s+(find|dump)/, '키체인 접근은 막혀 있습니다.'],
  [/(^|[\s;&|(`])rm\s+(-[a-zA-Z]+\s+)*(\/|~|\$HOME|\.\.)(\/?\s|\/?$)/, '집 · 뿌리 · 위 폴더를 통째로 지우는 명령은 막혀 있습니다.'],
  [/(^|[\s;&|(`])(crontab|launchctl)(\s|$)/, '상주 작업 등록은 막혀 있습니다.'],
];

function expandHome(p, home) {
  if (!p) return p;
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p.replace(/^\$HOME(?=\/|$)/, home);
}

export function makeGuard({ wt, home, mini, base }) {
  const W = (p) => path.resolve(p);
  const writeRoots = [W(wt), W(path.join(mini, '산그림')), W(path.join(base, 'tmp'))];
  const readRoots = [...writeRoots, W(path.join(mini, '지시')), W(path.join(mini, '_3d_in')), W(path.join(base, 'repo'))];
  const under = (p, roots) => roots.some((r) => p === r || p.startsWith(r + path.sep));

  function secret(text) {
    const t = String(text || '');
    for (const b of SECRET_BITS) if (t.includes(b)) return `「${b}」 는 세션이 닿지 않는 자리입니다(비밀 · 무접촉 규칙).`;
    for (const h of SERVER_HOSTS) if (t.includes(h)) return '서버 주소에 직접 닿는 일은 막혀 있습니다 — 서버는 재민 손입니다.';
    return null;
  }

  return function check(tool, input) {
    input = input || {};
    if (tool === 'Bash') {
      const cmd = String(input.command || '');
      const s = secret(cmd); if (s) return s;
      for (const [re, why] of BASH_DENY) if (re.test(cmd)) return why;
      return null;
    }
    const isWrite = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool);
    const isRead = ['Read', 'Glob', 'Grep'].includes(tool);
    if (isWrite || isRead) {
      const raw = input.file_path || input.notebook_path || input.path || '';
      const s = secret(raw) || secret(input.pattern && tool === 'Glob' ? input.pattern : ''); if (s) return s;
      if (!raw) return null;                      // 경로 없음 = 작업 폴더(cwd)
      const abs = W(path.isAbsolute(expandHome(raw, home)) ? expandHome(raw, home) : path.join(wt, raw));
      if (isWrite && !under(abs, writeRoots)) return `작업 폴더 밖에는 쓰지 않습니다: ${abs} (쓸 수 있는 곳: 작업 폴더 · ~/Mini/산그림 · ~/Mini/_api/tmp)`;
      if (isRead && !under(abs, readRoots)) return `작업 폴더 밖은 읽지 않습니다: ${abs} (읽을 수 있는 곳: 작업 폴더 · ~/Mini/지시 · ~/Mini/산그림 · ~/Mini/_3d_in)`;
      return null;
    }
    if (tool === 'WebFetch') return secret(input.url);
    return null;
  };
}
