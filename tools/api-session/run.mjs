#!/usr/bin/env node
// API 세션(S-API) 러너 — 카드 하나를 Claude Agent SDK 로 끝까지 돌린다. 재민 맥 터미널에서:
//   node run.mjs T1150                 (기본 모델 opus · 카드당 상한 $15 · 결제 주기 상한 $100)
//   node run.mjs T1150 --model=sonnet --budget=5
//   node run.mjs T1150 --dry           (API 안 부름 — 클론 · 가지 · 프롬프트만 확인)
// 요금은 Console API 크레딧에서 나간다(구독 사용량 아님). 키: ~/.config/mini-api/key (한 줄).
// 러너가 하는 일: 클론 → 최신 main → 새 가지 워크트리 → npm ci → 에이전트 → 남은 변경 커밋 → batch 가지 푸시(새 ref 만 · force 0) → 장부.
// main 착지는 PM 이 한다. 서버 · 배포는 재민 손. (족보 755)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { makeGuard } from './guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const MINI = process.env.MINI_DIR || path.join(HOME, 'Mini');
const BASE = process.env.MINI_API_DIR || path.join(MINI, '_api');
const KEYFILE = process.env.MINI_API_KEYFILE || path.join(HOME, '.config', 'mini-api', 'key');
const PATFILE = process.env.MINI_PATFILE || path.join(MINI, 'durango-mini', '.git', 'claude-pat.txt');
const REPO_URL = 'https://github.com/simjaemin1/Mini.git';

// ── 인자 ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (k, d) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); if (!a) return d; return a.includes('=') ? a.split('=').slice(1).join('=') : true; };
const words = argv.filter((x) => !x.startsWith('--'));
const RESUME = !!flag('resume', false);                  // 지난 대화 이어서(같은 대화 · 같은 가지)
const STATE = path.join(BASE, '지난대화.json');
let last = null;
try { last = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* 없음 */ }
if (RESUME && !(last && last.session && fs.existsSync(last.wt || ''))) { console.log('✗ 이어 갈 지난 대화가 없습니다 — 새로 시작하십시오.'); process.exit(5); }
const cardArg = RESUME ? '' : words.find((x) => /^T\d+$/i.test(x));
const card = RESUME ? last.card : (cardArg ? cardArg.toUpperCase() : 'API');
const FREE = cardArg ? '' : words.join(' ').trim();      // 카드 번호가 아니면 = 재민이 말로 시킨 일 (이어서면 = 이어서 할 말)
const IS_FREE = RESUME ? !!last.free : !cardArg;
const MODEL = String(flag('model', 'opus'));
const BUDGET = Number(flag('budget', 15));
const CYCLE_CAP = Number(flag('cap', 100));
const CYCLE_DAY = Number(flag('cycle-day', 4));          // 크레딧 들어오는 날(다음 크레딧 12월 4일)
const MAX_TURNS = Number(flag('max-turns', 400));
const DRY = !!flag('dry', false);
const ONCE = !!flag('once', false);                      // 끝나고 이어서 묻지 않음
const NO_SANDBOX = !!flag('no-sandbox', false);
const EXTRA = flag('note', '');                           // 카드에 덧붙일 한 줄(선택)

if (!RESUME && !cardArg && !FREE) { console.log('쓰는 법: node run.mjs T1150 [--model=opus|sonnet] [--budget=15] [--dry] [--once] [--no-sandbox] [--note="…"]\n      또는: node run.mjs "말로 시킬 일"\n      또는: node run.mjs --resume ["이어서 할 말"]'); process.exit(1); }

// ── 비밀 가리기 ────────────────────────────────────────
let PAT = '';
try { PAT = fs.readFileSync(PATFILE, 'utf8').replace(/\s+/g, ''); } catch { /* 공개 읽기로 시도 */ }
let KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!KEY) { try { KEY = fs.readFileSync(KEYFILE, 'utf8').trim(); } catch { /* 아래에서 안내 */ } }
const mask = (s) => {
  let t = String(s ?? '');
  if (PAT) t = t.split(PAT).join('***');
  if (KEY) t = t.split(KEY).join('***');
  return t.replace(/github_pat_[A-Za-z0-9_]+/g, '***').replace(/sk-ant-[A-Za-z0-9_-]+/g, '***');
};
const authUrl = () => (PAT ? `https://x-access-token:${PAT}@github.com/simjaemin1/Mini.git` : REPO_URL);

function sh(cmd, args, opt = {}) {
  const r = spawnSync(cmd, args, { cwd: opt.cwd, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 64 << 20 });
  const out = mask((r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0 && !opt.ok) { console.error(`✗ ${cmd} ${mask(args.join(' '))}\n${out}`); throw new Error(`${cmd} 실패`); }
  if (opt.show && out.trim()) console.log(out.trim());
  return { code: r.status, out: (r.stdout || '').trim() };
}
const git = (args, opt = {}) => sh('git', args, { cwd: opt.cwd || REPO, ...opt });

// ── 0. 준비물 ──────────────────────────────────────────
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) console.log(`⚠ Node ${process.versions.node} — 서버 하네스(--experimental-sqlite)는 Node 22 이상이 필요합니다. brew install node 로 올리십시오.`);
if (!KEY && !DRY) {
  console.log([
    '✗ API 키가 없습니다. 한 번만 하시면 됩니다:',
    '  1) https://platform.claude.com/settings/keys 에서 키 만들기(크레딧이 연결된 "재민\'s Individual Org")',
    `  2) mkdir -p ~/.config/mini-api && pbpaste > ${KEYFILE} && chmod 600 ${KEYFILE}   (키를 복사한 뒤)`,
    '  키는 채팅 · 레포 · 메모리에 절대 붙이지 마십시오.',
  ].join('\n'));
  process.exit(2);
}
fs.mkdirSync(path.join(BASE, 'logs'), { recursive: true });
fs.mkdirSync(path.join(BASE, '결과'), { recursive: true });
fs.mkdirSync(path.join(BASE, 'tmp'), { recursive: true });

// ── 1. 장부(결제 주기 상한) ─────────────────────────────
const LEDGER = path.join(BASE, '장부.tsv');
function cycleStart(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), CYCLE_DAY);
  if (d.getDate() < CYCLE_DAY) s.setMonth(s.getMonth() - 1);
  return s;
}
function spentThisCycle() {
  if (!fs.existsSync(LEDGER)) return 0;
  const s0 = cycleStart();
  return fs.readFileSync(LEDGER, 'utf8').split('\n').slice(1).filter(Boolean)
    .map((l) => l.split('\t')).filter((c) => new Date(c[0]) >= s0).reduce((a, c) => a + (Number(c[4]) || 0), 0);
}
const spent = spentThisCycle();
console.log(`· 이번 주기(${cycleStart().toISOString().slice(0, 10)}~) 쓴 돈 $${spent.toFixed(2)} / 상한 $${CYCLE_CAP} · 이 카드 상한 $${BUDGET}`);
if (!DRY && spent + BUDGET > CYCLE_CAP) { console.log(`✗ 주기 상한을 넘습니다 — --budget 을 줄이거나 --cap 을 올리십시오.`); process.exit(3); }

// ── 2. 클론 · 최신 main ────────────────────────────────
const REPO = path.join(BASE, 'repo');
if (!fs.existsSync(path.join(REPO, '.git'))) {
  console.log('· 처음이라 클론합니다(몇 분 걸립니다)…');
  sh('git', ['clone', '--no-checkout', authUrl(), REPO]);
  git(['remote', 'set-url', 'origin', REPO_URL]);           // PAT 를 .git/config 에 남기지 않는다
  git(['config', 'user.name', 'Mini API 세션']);
  git(['config', 'user.email', 'api-session@mini.local']);
}
git(['fetch', '-q', authUrl(), '+refs/heads/main:refs/remotes/origin/main']);
const baseHash = RESUME ? last.base : git(['rev-parse', 'origin/main']).out;
console.log(`· main = ${baseHash.slice(0, 8)}`);

// ── 3. 카드 ────────────────────────────────────────────
let cardText = '';
if (RESUME) console.log(`· 지난 대화 이어서 — ${last.card === 'API' ? '말로 시킨 일' : '카드 ' + last.card} · 가지 ${last.branch}`);
else if (cardArg) {
  const r = git(['show', `origin/main:지시/지시_${card}.md`], { ok: true });
  cardText = r.code === 0 ? r.out : '';
  if (!cardText) { const p = path.join(MINI, '지시', `지시_${card}.md`); if (fs.existsSync(p)) cardText = fs.readFileSync(p, 'utf8'); }
  if (!cardText) { console.log(`✗ 카드 ${card} 를 main 의 지시/ 에서도 ~/Mini/지시/ 에서도 못 찾았습니다.`); process.exit(4); }
  console.log(`· 카드: ${cardText.split('\n')[0].slice(0, 120)}`);
} else console.log(`· 말로 시킨 일: ${FREE.slice(0, 120)}`);

// ── 4. 새 가지 · 워크트리 ──────────────────────────────
const d = new Date();
const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const hhmm = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
const slug = cardArg ? card.toLowerCase() : `free-${hhmm}`;
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
let branch, WT;
if (RESUME) { branch = last.branch; WT = last.wt; }
else {
  // 지난 대화가 고친 것 없이 끝났으면 그 워크트리는 여기서 치운다(이어서 할 일이 새로 생겼으니)
  if (last && last.wt && fs.existsSync(last.wt) && !last.pushed) {
    const dirty = sh('git', ['status', '--porcelain'], { cwd: last.wt, ok: true }).out;
    const ah = Number(sh('git', ['rev-list', '--count', `${last.base}..HEAD`], { cwd: last.wt, ok: true }).out || 0);
    if (!dirty && ah === 0) { git(['worktree', 'remove', '--force', last.wt], { ok: true }); git(['branch', '-D', last.branch], { ok: true }); }
  }
  branch = `batch/api-${slug}-${mmdd}`;
  const remoteHas = (b) => sh('git', ['ls-remote', '--heads', authUrl(), b], { cwd: REPO }).out.length > 0;
  const localHas = (b) => git(['rev-parse', '--verify', '-q', `refs/heads/${b}`], { ok: true }).code === 0;
  for (let n = 2; remoteHas(branch) || localHas(branch); n++) branch = `batch/api-${slug}-${mmdd}-${n}`;
  WT = path.join(BASE, 'wt', branch.replace(/\//g, '_'));
  git(['worktree', 'add', '-q', '-b', branch, WT, 'origin/main']);
  console.log(`· 가지 ${branch} · 작업 폴더 ${WT}`);
  if (!DRY) {
    console.log('· npm ci …');
    sh('npm', [fs.existsSync(path.join(WT, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: WT });
  }
}

// ── 5. 프롬프트 ────────────────────────────────────────
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const RULES = `
너는 미니(레포 durango-mini · 한국 청동기 오픈월드 경제 시뮬) 작업 세션 **S-API** 다. 재민이 터미널에서 보고 있을 수도, 자리를 비웠을 수도 있다 — 일하는 도중엔 묻지 말고 스스로 판단해 끝까지 하고, 끝에 짧게 한국어로 답한다(재민이 이어서 말할 수 있다).${IS_FREE ? '\n- 이번 일은 카드가 아니라 **재민이 말로 시킨 일**이다. 설계 결정 · 캐논을 바꾸는 판정이면 하지 말고 끝 답에 질문으로 남겨라. 묻기만 한 것이면 파일을 고치지 말고 답만 해라.' : ''}
- 작업 폴더 = ${WT} · 가지 \`${branch}\` · 베이스 \`${baseHash.slice(0, 7)}\`(main). 카드에 적힌 가지 이름 대신 **이 가지**를 쓴다.
- 순서는 레포 \`지시/README.md\` 의 "세션 쪽 순서"와 같다. 단 클론 · pull · push 는 러너가 한다 — **너는 git push 를 하지 않는다**(막혀 있다). 커밋만 한다.
- 먼저 읽기: \`인계/공통.md\` §0~§2 · 카드가 가리키는 영역 인계 · \`tail -n 12 인계/족보.md\`.
- 커밋 제목에 카드가 정한 태그(\`[승인 대기 · ${card}]\`)를 넣는다. 일하는 중간중간 커밋해라 — 예산($${BUDGET})이 다 되면 그 자리에서 끊긴다.
- 파일을 고쳤으면 끝에 \`보고/${!IS_FREE ? card + '_' + today : 'API_' + today + '_' + hhmm}.md\` 를 쓴다(머리 15줄 = \`지시/_보고머리_템플릿.md\` 네 칸 — 가지 해시는 마지막 커밋 해시). 판정이 필요한 것은 하지 말고 보고에 질문으로 남긴다.
- 금지: 서버 접속(ssh · scp) · 배포 · force · \`durango-mini\` 폴더 · 비밀 파일(PAT · 키 · 서버 비밀) · "듀랑고" 라는 낱말. 가드가 막으면 다른 길로 가라.
- 맥 경로: 그림은 \`${path.join(MINI, '산그림', card)}/\` 에 써도 된다 · \`${path.join(MINI, '지시')}\` · \`${path.join(MINI, '_3d_in')}\` 는 읽기만. 임시 파일은 \`${path.join(BASE, 'tmp')}\`.
- 언어: 한국어. 정확성이 속도보다 우선.`.trim();
let prompt = RESUME ? FREE : IS_FREE ? `재민이 말로 시킨 일:\n\n${FREE}` : `카드 ${card} 를 한다.${EXTRA ? `\n\n덧붙임(재민 · PM): ${EXTRA}` : ''}\n\n----- 카드 전문 -----\n${cardText}`;

if (RESUME && !prompt) prompt = (await ask('이어서 할 말: ')).trim();
if (RESUME && !prompt) { console.log('· 할 말이 없어 끝냅니다.'); process.exit(0); }

if (DRY) {
  console.log('\n===== (드라이런) 덧붙는 규칙 =====\n' + RULES + '\n\n===== 첫 메시지 =====\n' + prompt.slice(0, 1500));
  if (!RESUME) { git(['worktree', 'remove', '--force', WT], { ok: true }); git(['branch', '-D', branch], { ok: true }); }
  console.log('\n✓ 드라이런 끝 — API 는 부르지 않았습니다(워크트리 · 가지 치움).');
  process.exit(0);
}

// ── 6. 에이전트 ────────────────────────────────────────
const { query } = await import('@anthropic-ai/claude-agent-sdk');
const check = makeGuard({ wt: WT, home: HOME, mini: MINI, base: BASE });
const logPath = path.join(BASE, 'logs', branch.replace(/\//g, '_') + '.jsonl');
const log = fs.createWriteStream(logPath, { flags: 'a' });
let abort = null;
let stopped = false;
process.on('SIGINT', () => { if (stopped) process.exit(130); stopped = true; console.log('\n· 멈추는 중(한 번 더 누르면 바로 끝) — 남은 변경은 커밋하고 가지를 밉니다.'); abort?.abort(); });

const short = (o) => mask(JSON.stringify(o)).slice(0, 160);
const options = (budgetLeft, resume) => ({
  cwd: WT,
  model: MODEL,
  maxBudgetUsd: budgetLeft,
  maxTurns: MAX_TURNS,
  abortController: abort,
  ...(resume ? { resume } : {}),
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  settingSources: ['project'],
  additionalDirectories: [path.join(MINI, '지시'), path.join(MINI, '산그림'), path.join(BASE, 'tmp')],
  systemPrompt: { type: 'preset', preset: 'claude_code', append: RULES },
  env: { ...process.env, ANTHROPIC_API_KEY: KEY, LC_ALL: 'C.UTF-8' },
  hooks: {
    PreToolUse: [{
      hooks: [async (input) => {
        const why = check(input.tool_name, input.tool_input);
        if (!why) return {};
        console.log(`  ⛔ 가드: ${input.tool_name} — ${why}`);
        log.write(JSON.stringify({ t: Date.now(), guard: input.tool_name, why }) + '\n');
        return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why } };
      }],
    }],
  },
  sandbox: NO_SANDBOX ? undefined : {
    enabled: true,
    autoAllowBashIfSandboxed: true,
    allowUnsandboxedCommands: false,
    filesystem: {
      allowWrite: [WT, path.join(MINI, '산그림'), path.join(BASE, 'tmp'), path.join(HOME, '.npm'), path.join(HOME, '.cache'), os.tmpdir()],
      denyRead: [PATFILE, path.dirname(KEYFILE), path.join(HOME, '.ssh')],
    },
    network: { allowedDomains: ['github.com', 'api.github.com', 'codeload.github.com', 'objects.githubusercontent.com', 'registry.npmjs.org', 'pypi.org', 'files.pythonhosted.org', 'mini-saebeol.duckdns.org'] },
    credentials: { envVars: [{ name: 'ANTHROPIC_API_KEY', mode: 'deny' }] },
  },
});

// 한 번 말하기 = 에이전트가 일을 마칠 때까지. 끝나면 터미널에서 이어서 말할 수 있다(같은 대화 · 같은 가지).
async function runTurn(text, resume, budgetLeft) {
  abort = new AbortController();
  const r = { subtype: 'unknown', cost: 0, turns: 0, text: '', session: resume || '' };
  try {
    for await (const m of query({ prompt: text, options: options(budgetLeft, resume) })) {
      log.write(mask(JSON.stringify({ t: Date.now(), ...m })) + '\n');
      if (m.type === 'system' && m.subtype === 'init') {
        r.session = m.session_id || r.session;
        if (!resume) console.log(`· 모델 ${m.model} · 키 출처 ${m.apiKeySource} · 샌드박스 ${NO_SANDBOX ? '끔' : '켬'}`);
        if (m.apiKeySource !== 'ANTHROPIC_API_KEY') { console.log('✗ API 키가 아닌 다른 자격(구독 로그인 등)으로 돌려 합니다 — 멈춥니다.'); stopped = true; abort.abort(); }
      } else if (m.type === 'assistant') {
        for (const b of m.message?.content || []) {
          if (b.type === 'text' && b.text.trim()) console.log('  ' + mask(b.text.trim()).slice(0, 400).replace(/\n/g, '\n  '));
          else if (b.type === 'tool_use') console.log(`  · ${b.name} ${short(b.input)}`);
        }
      } else if (m.type === 'result') {
        Object.assign(r, { subtype: m.subtype, cost: m.total_cost_usd || 0, turns: m.num_turns || 0, text: m.result || (m.errors || []).join('\n'), session: m.session_id || r.session });
      }
    }
  } catch (e) {
    r.subtype = r.subtype === 'unknown' ? (stopped ? 'stopped' : 'error') : r.subtype;
    r.text = (r.text ? r.text + '\n' : '') + mask(String(e?.message || e));
    console.log('✗ 에이전트 오류: ' + mask(String(e?.message || e)).slice(0, 500));
  }
  return r;
}

const result = { subtype: 'unknown', cost: 0, turns: 0, text: '' };
let next = prompt, session = RESUME ? last.session : '';
while (next) {
  const left = BUDGET - result.cost;
  if (left < 0.5) { console.log(`· 이 세션 상한 $${BUDGET} 를 다 썼습니다.`); break; }
  const r = await runTurn(next, session, left);
  session = r.session || session;
  Object.assign(result, { subtype: r.subtype, cost: result.cost + r.cost, turns: result.turns + r.turns, text: r.text });
  console.log(`\n───── S-API 답 ($${r.cost.toFixed(2)} · 합계 $${result.cost.toFixed(2)} / $${BUDGET}) ─────\n${mask(r.text || '(없음)')}\n`);
  if (stopped || ONCE || !process.stdin.isTTY || !session || r.subtype === 'error_max_budget_usd') break;
  next = (await ask('이어서 할 말 (엔터 = 끝내고 가지 밀기): ')).trim();
}
log.end();

// ── 7. 남은 변경 커밋 · 가지 푸시 ─────────────────────
if (git(['status', '--porcelain'], { cwd: WT }).out) {
  git(['add', '-A'], { cwd: WT });
  git(['commit', '-q', '-m', `[승인 대기 · ${card}] wip — API 세션이 멈춘 자리(${result.subtype})`], { cwd: WT });
}
const ahead = Number(git(['rev-list', '--count', 'origin/main..HEAD'], { cwd: WT }).out);
const head = git(['rev-parse', 'HEAD'], { cwd: WT }).out;
let pushed = '안 밂(커밋 0)';
if (ahead > 0) {
  const r = sh('git', ['push', authUrl(), `HEAD:refs/heads/${branch}`], { cwd: WT, ok: true });
  pushed = r.code === 0 ? `밂 ${branch} = ${head.slice(0, 8)}` : `✗ 푸시 실패(번들로 남김) — ${path.join(BASE, '결과', branch.replace(/\//g, '_') + '.bundle')}`;
  if (r.code !== 0) git(['bundle', 'create', path.join(BASE, '결과', branch.replace(/\//g, '_') + '.bundle'), `origin/main..${branch}`], { ok: true });
}

fs.writeFileSync(STATE, JSON.stringify({ session, branch, wt: WT, card, free: IS_FREE, base: baseHash, pushed: ahead > 0 || !!(last && RESUME && last.pushed), t: new Date().toISOString() }, null, 1));

// ── 8. 장부 · 결과 ─────────────────────────────────────
if (!fs.existsSync(LEDGER)) fs.writeFileSync(LEDGER, '시각\t카드\t가지\t모델\t달러\t결과\t커밋수\n');
fs.appendFileSync(LEDGER, [new Date().toISOString(), card, branch, MODEL, result.cost.toFixed(4), result.subtype, ahead].join('\t') + '\n');
const summary = [
  `# ${card} — API 세션 결과 (${today})`, '',
  `- 가지: \`${branch}\` · 머리 \`${head.slice(0, 8)}\` · 베이스 \`${baseHash.slice(0, 8)}\` · 커밋 ${ahead}개 · ${pushed}`,
  `- 모델 ${MODEL} · 돈 $${result.cost.toFixed(2)}(카드 상한 $${BUDGET}) · 턴 ${result.turns} · 끝남 = ${result.subtype}`,
  `- 이번 주기 합계 $${(spent + result.cost).toFixed(2)} / $${CYCLE_CAP}`,
  `- 기록: ${logPath}`, '', '## 에이전트 마지막 말', '', mask(result.text || '(없음)'),
].join('\n');
fs.writeFileSync(path.join(BASE, '결과', branch.replace(/\//g, '_') + '.md'), summary + '\n');
console.log('\n' + summary.split('\n').slice(0, 5).join('\n'));
console.log('· 이 대화는 기억됩니다 — 다음에 「이어서」(node run.mjs --resume)로 같은 대화를 이어 갈 수 있습니다.');
console.log(ahead > 0 ? `\n✓ 끝. PM 에게 "${branch}" 만 말하면 됩니다(착지 때 가지를 다 훑습니다).` : '\n✓ 끝. 고친 파일이 없어 가지는 밀지 않았습니다.');
