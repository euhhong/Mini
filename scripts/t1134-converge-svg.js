#!/usr/bin/env node
// (@regress 없음 — 보고 그림) === scripts/t1134-converge-svg.js — 같은 조건 · 출발 셋이 한 값으로(econ `t1134Step` 그대로) ===
//   node scripts/t1134-converge-svg.js [out.svg] [G=0.62] [N=40] [c=0.004] — 날 0 ~ 300 · 날 100 에 굶어 죽음 한 번(1/N)을 넣은 넷째 선(점선)
'use strict';
process.env.T1134_HAPPY_TARGET = '1';
const path = require('path'), fs = require('fs');
const A = process.argv.slice(2);
const OUT = A[0] || path.join(__dirname, '..', '계측', 'T1134_수렴.svg');
const G = +(A[1] || 0.62), N = +(A[2] || 40);
process.env.T1134_C = A[3] || '0.004';
const E = require(path.join(__dirname, '..', 'sim', 'economy-sim.js'));
const D = 300;
const series = (h0, ev) => { const v = { _H: h0, _t1134E: 0 }, y = [h0]; for (let d = 1; d <= D; d++) { if (ev && d === ev) v._t1134E += 1 / N; y.push(E.t1134Step(v, G, N, 0).h); } return y; };
const lines = [{ y: series(0.3), c: '#2a6f97', n: '출발 0.3' }, { y: series(0.7), c: '#6a994e', n: '출발 0.7' }, { y: series(1.0), c: '#bc4749', n: '출발 1.0' }, { y: series(0.7, 100), c: '#555', n: '출발 0.7 · 날 100 굶어 죽음 1', dash: true }];
const W = 640, H = 360, L = 50, R = 20, T = 20, B = 40;
const x = (d) => L + (W - L - R) * d / D, yv = (h) => T + (H - T - B) * (1 - h);
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12">\n<rect width="100%" height="100%" fill="#fff"/>\n`;
for (const h of [0, 0.25, 0.5, 0.75, 1]) s += `<line x1="${L}" x2="${W - R}" y1="${yv(h)}" y2="${yv(h)}" stroke="#ddd"/><text x="${L - 8}" y="${yv(h) + 4}" text-anchor="end">${h}</text>\n`;
for (const d of [0, 30, 60, 100, 150, 200, 250, 300]) s += `<text x="${x(d)}" y="${H - B + 16}" text-anchor="middle">${d}</text>\n`;
s += `<text x="${(W + L) / 2}" y="${H - 6}" text-anchor="middle">날(반감기 30)</text>\n`;
for (const l of lines) s += `<polyline fill="none" stroke="${l.c}" stroke-width="2"${l.dash ? ' stroke-dasharray="5 4"' : ''} points="${l.y.map((h, d) => `${x(d).toFixed(1)},${yv(h).toFixed(1)}`).join(' ')}"/>\n`;
lines.forEach((l, i) => { s += `<line x1="${W - 220}" x2="${W - 196}" y1="${T + 14 + i * 16}" y2="${T + 14 + i * 16}" stroke="${l.c}" stroke-width="2"${l.dash ? ' stroke-dasharray="5 4"' : ''}/><text x="${W - 190}" y="${T + 18 + i * 16}">${l.n}</text>\n`; });
s += `<text x="${L + 4}" y="${T + 12}">h* = 0.5 + G ${G} − c ${process.env.T1134_C} × N ${N} = ${(0.5 + G - (+process.env.T1134_C) * N).toFixed(3)}</text>\n</svg>\n`;
fs.writeFileSync(OUT, s);
console.log(OUT, lines.map((l) => `${l.n}: 300날 ${l.y[D].toFixed(4)}`).join(' · '));
