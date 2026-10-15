// ============================================================
// Agent 循环机 —— Anatomy 中文示例
//
// 把"AI Agent 循环（感知→决策→执行→观察）"画成一台真实机械：
//   感知   = 左侧进料斗（任务卡片堆）
//   决策   = 导轨上的读卡器 + 右上工具选择转盘
//   执行   = 导轨末端的压机（压头落下 = 执行动作）
//   观察   = 右下出料滑槽 + 结果票据 + 左上计数表盘
//
// 跑法：
//   node build.mjs                 # 生成 agent-loop.html（动画版）
//   node build.mjs --static=0.68   # 生成 agent-loop-static.html（定格在"执行"帧）
//   node ../../scripts/capture.mjs agent-loop.html --out preview.png
//
// 改法：想换个概念，改 MACHINE 常量区的尺寸/位置，
//       改 story(t) 里的时间轴分段，改 readout 里的中文文案。
// ============================================================
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1160;
const HEIGHT = 640;

// --static=0.68：烘焙一帧确定性画面（社交平台配图用，定格在故事帧）
// --out <文件>：指定输出文件名（视频模式逐帧输出用）
const staticArg = process.argv.find((a) => a.startsWith("--static="));
const STATIC_T = staticArg ? parseFloat(staticArg.slice(9)) : null;
const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? outArg.slice(6)
  : STATIC_T === null ? "agent-loop.html" : "agent-loop-static.html";

// ---- world layout: rail is the spine, press at its end ----
const PLATE = { x: -204, y: -82, w: 408, d: 164, r: 10 };
const PLATE_H = 14, FOOT_H = 6;

const INBOX = { x: -194, y: -32, w: 54, d: 54, r: 4 };
const WALL_H = 26, WALL_T = 5;

const RAIL = { x0: -134, x1: 72, yA: -13, yB: -3, w: 5 };
const READER = { w: 30, d: 30, h: 7 };

const PRESS_X = 95;
const POST_H = 72;

const DIAL = [160, -28];
const DIAL_R = 24, DIAL_BASE_H = 9, DIAL_TOP_H = 7;

const SLIDE = { x: 106, y: 26, w: 56, d: 16 };
const OUTBOX = { x: 110, y: 44, w: 48, d: 36, r: 4 };

const COUNTER = [-62, -58];
const COUNTER_R = 15, COUNTER_POST_H = 52;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [INBOX.x, INBOX.y, WALL_H + 2],
    [DIAL[0] + DIAL_R, DIAL[1], DIAL_BASE_H + DIAL_TOP_H + 12],
    [PRESS_X, -34, POST_H + 10],
    [COUNTER[0], COUNTER[1], COUNTER_POST_H + 4],
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 42 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 10, 1.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -150, y: PLATE.y + PLATE.d - 16, w: 300, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 4, 5, strip.y + 0.9, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // big engraved Chinese title on the plate
  const label = { x: -95, y: 56, w: 190, d: 18, r: 2 };
  out.push(S(k.slabOf(label, 0, 1, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2), 1, P, 2), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([0, 65], 1, P, "x"), "AGENT 循环机", { size: 9, tone: "hi", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([150, 65], 1, P, "x"), "感知 · 决策 · 执行 · 观察", { size: 4.5, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function inbox() {
  const out = [];
  const inner = k.insetPlan(INBOX, WALL_T);
  out.push(S(k.slabOf(INBOX, 0, 3, P, 5, 0.8), { tone: "mid" }));
  const walls = [
    { x: INBOX.x, y: INBOX.y, w: INBOX.w, d: WALL_T },
    { x: INBOX.x, y: INBOX.y + INBOX.d - WALL_T, w: INBOX.w, d: WALL_T },
    { x: INBOX.x, y: INBOX.y + WALL_T, w: WALL_T, d: INBOX.d - 2 * WALL_T },
    { x: INBOX.x + INBOX.w - WALL_T, y: INBOX.y + WALL_T, w: WALL_T, d: INBOX.d - 2 * WALL_T },
  ];
  for (const w of [walls[0], walls[2], walls[3], walls[1]]) {
    out.push(S(k.slabOf(w, 3, WALL_H - 3, P, 3, 0.6), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(w, 1), WALL_H, P, 2), { tone: "faint" }));
  }
  // exit slot in front wall
  out.push(S(k.slabOf({ x: INBOX.x + 12, y: INBOX.y + INBOX.d - WALL_T, w: 30, d: WALL_T, r: 1 }, 3, 8, P, 2), { tone: "lo", crease: "none" }));
  for (let i = 0; i < 3; i++) {
    out.push(S(k.slabOf({ x: inner.x + 4, y: inner.y + 4, w: inner.w - 8, d: inner.d - 8, r: 2 }, 4 + i * 4.4, 3.4, P, 3), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of [RAIL.yA, RAIL.yB]) {
    out.push(S(k.slabOf({ x: RAIL.x0, y, w: RAIL.x1 - RAIL.x0, d: RAIL.w, r: 1 }, 0, 4, P, 3, 0.5), { tone: "mid" }));
    out.push(D([RAIL.x0 + 8, RAIL.x1 - 8].map((x) => at([x, y + 2.5, 4])), { size: 0.4 }));
  }
  for (const x of [RAIL.x0 - 4, RAIL.x1 - 1]) {
    out.push(S(k.slabOf({ x, y: RAIL.yA - 3, w: 5, d: 24, r: 1.2 }, 0, 8, P, 3, 0.5), { tone: "mid" }));
  }
  return out.join("");
}

function readerCarriage() {
  const out = [];
  const c = { x: -READER.w / 2, y: -READER.d / 2, w: READER.w, d: READER.d, r: 3 };
  out.push(S(k.slabOf(c, 4, READER.h, P, 4, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(c, 3), 4 + READER.h, P, 3), { tone: "faint" }));
  out.push(S(k.cylinder(0, 0, 7.5, 4 + READER.h, 9, P, 32), { tone: "mid" }));
  out.push(L(k.ring(0, 0, 7.5, 4 + READER.h + 9, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, 4.6, 4 + READER.h + 9, 2.4, P, 24), { tone: "hi", lit: true }));
  out.push(D([at([0, 0, 4 + READER.h + 11.4])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

// bigger task card with bold lit outline: the hero of the frame
function taskCard() {
  const c = { x: -14, y: -10, w: 28, d: 20, r: 2.5 };
  const out = [];
  out.push(S(k.slabOf(c, 5.2, 2, P, 3), { tone: "hi", lit: true }));
  out.push(`<path class="iso-line" data-tone="lit" d="${k.planOutline(c, 7.2, P, 3)}" style="stroke-width:1.6"/>`);
  out.push(L(k.lineOnTop([-8, -4], [8, -4], 7.2, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([-8, 1], [3, 1], 7.2, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([-8, 5], [8, 5], 7.2, P), { tone: "lo" }));
  return out.join("");
}

// ---- tool selector dial ----
function dialStatic() {
  const out = [];
  const [x, y] = DIAL;
  out.push(S(k.cylinder(x, y, DIAL_R + 4, 0, 3, P, 48), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, DIAL_R, 3, DIAL_BASE_H, P, 48, 0.8), { tone: "mid" }));
  out.push(L(k.knurl(x, y, DIAL_R, 3 + DIAL_BASE_H - 3, 3 + DIAL_BASE_H, 60, P, 0.4), { tone: "lo" }));
  return out.join("");
}

function dialTop() {
  const out = [];
  out.push(S(k.cylinder(0, 0, DIAL_R - 2, 0, DIAL_TOP_H, P, 48, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(0, 0, DIAL_R - 4, DIAL_TOP_H, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(0, 0, DIAL_R - 5, 4, 2.4, DIAL_TOP_H, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const bits = [[0, -(DIAL_R - 10)], [DIAL_R - 10, 0], [0, DIAL_R - 10], [-(DIAL_R - 10), 0]];
  bits.forEach(([bx, by], i) => {
    out.push(S(k.slabOf({ x: bx - 4, y: by - 4, w: 8, d: 8, r: 1.5 }, DIAL_TOP_H, 7, P, 3), { tone: i === 0 ? "hi" : "mid", lit: i === 0 }));
    out.push(D([at([bx, by, DIAL_TOP_H + 7])], { size: 0.45, tone: i === 0 ? "hi" : "lo" }));
  });
  out.push(S(k.cylinder(0, 0, 2.6, DIAL_TOP_H, 3, P, 20), { tone: "mid" }));
  return out.join("");
}

const dialPointerAt = (angle) => {
  const r = DIAL_R - 8;
  return k.lineOnTop([0, 0], [Math.cos(angle) * r, Math.sin(angle) * r], DIAL_TOP_H + 0.3, P);
};

// ---- press at the END of the rail: posts, crosshead, moving ram, anvil ----
function pressStatic() {
  const out = [];
  for (const y of [-30, 9]) {
    out.push(S(k.slabOf({ x: PRESS_X - 4, y, w: 8, d: 7, r: 1.5 }, 0, 10, P, 3, 0.6), { tone: "mid" }));
    out.push(S(k.cylinder(PRESS_X, y + 3.5, 3.4, 10, POST_H - 10, P, 24), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(PRESS_X, y + 3.5, 4.2, POST_H - 4, 4, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf({ x: PRESS_X - 8, y: -34, w: 16, d: 52, r: 2 }, POST_H, 8, P, 4, 0.6), { tone: "mid" }));
  out.push(D([at([PRESS_X - 5, -30, POST_H + 8]), at([PRESS_X + 5, 14, POST_H + 8])], { size: 0.45 }));
  out.push(S(k.slabOf({ x: PRESS_X - 9, y: -17, w: 18, d: 18, r: 2 }, 0, 12, P, 4, 0.7), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan({ x: PRESS_X - 9, y: -17, w: 18, d: 18, r: 2 }, 2), 12, P, 3), { tone: "faint" }));
  return out.join("");
}

function pressRam() {
  const out = [];
  out.push(S(k.cylinder(0, 0, 5, 0, 26, P, 28), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(0, 0, 5, 8, P, 20), { tone: "faint" }));
  out.push(S(k.cylinder(0, 0, 6.4, 26, 5, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 3, -6, 6, P, 20), { tone: "hi", lit: true }));
  return out.join("");
}

function slide() {
  const out = [];
  out.push(S(k.slabOf(SLIDE, 0, 3, P, 4, 0.5), { tone: "mid" }));
  for (const y of [SLIDE.y, SLIDE.y + SLIDE.d - 3]) {
    out.push(S(k.slabOf({ x: SLIDE.x, y, w: SLIDE.w, d: 3, r: 1 }, 3, 6, P, 2), { tone: "mid" }));
  }
  out.push(L(k.lineOnTop([SLIDE.x + 4, SLIDE.y + 8], [SLIDE.x + SLIDE.w - 4, SLIDE.y + 8], 3, P), { tone: "faint" }));
  return out.join("");
}

function outbox() {
  const out = [];
  const inner = k.insetPlan(OUTBOX, WALL_T);
  out.push(S(k.slabOf(OUTBOX, 0, 3, P, 4, 0.7), { tone: "mid" }));
  const walls = [
    { x: OUTBOX.x, y: OUTBOX.y, w: OUTBOX.w, d: WALL_T },
    { x: OUTBOX.x, y: OUTBOX.y + OUTBOX.d - WALL_T, w: OUTBOX.w, d: WALL_T },
    { x: OUTBOX.x, y: OUTBOX.y + WALL_T, w: WALL_T, d: OUTBOX.d - 2 * WALL_T },
    { x: OUTBOX.x + OUTBOX.w - WALL_T, y: OUTBOX.y + WALL_T, w: WALL_T, d: OUTBOX.d - 2 * WALL_T },
  ];
  for (const w of [walls[0], walls[2], walls[3], walls[1]]) {
    out.push(S(k.slabOf(w, 3, 18, P, 3, 0.6), { tone: "mid" }));
  }
  for (let i = 0; i < 2; i++) {
    out.push(S(k.slabOf({ x: inner.x + 5, y: inner.y + 5, w: inner.w - 10, d: inner.d - 10, r: 2 }, 4 + i * 4, 3, P, 3), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function resultTicket() {
  const c = { x: -10, y: -7, w: 20, d: 14, r: 2 };
  const out = [];
  out.push(S(k.slabOf(c, 4, 1.6, P, 3), { tone: "hi", lit: true }));
  out.push(D([at([0, 0, 5.6])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

function counter() {
  const out = [];
  const [x, y] = COUNTER;
  out.push(S(k.cylinder(x, y, 7, 0, 2.4, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 3, 2.4, COUNTER_POST_H - 2.4, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, COUNTER_R, COUNTER_POST_H, 7, P, 40, 0.7), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, COUNTER_R, COUNTER_POST_H + 4, COUNTER_POST_H + 7, 48, P, 0.3), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, COUNTER_R - 3, 12, 3, COUNTER_POST_H + 7, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.6, COUNTER_POST_H + 7, P, 16), { tone: "mid" }));
  return out.join("");
}

const counterNeedleAt = (count) => {
  const angle = -Math.PI / 2 + count * (Math.PI / 6);
  const [x, y] = COUNTER;
  return k.lineOnTop(
    [x - Math.cos(angle) * 3, y - Math.sin(angle) * 3],
    [x + Math.cos(angle) * (COUNTER_R - 4), y + Math.sin(angle) * (COUNTER_R - 4)],
    COUNTER_POST_H + 7.3, P,
  );
};

function cable() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = 40 + t * (DIAL[0] - DIAL_R - 40);
    const y = 14 + Math.sin(t * Math.PI) * -6 + t * ((DIAL[1] + 8) - 14);
    const z = 2 + Math.sin(t * Math.PI) * -1.5;
    pts.push(at([x, y, z]));
  }
  const d = "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L");
  return L(d, { tone: "lo" }) + D([pts[0], pts[pts.length - 1]], { size: 0.5, tone: "lo" });
}

// ---- assemble ----
const cardStartX = -166, cardEndX = PRESS_X - 10;
const readerStartX = -100;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Agent loop machine, light theme, 16:9. A task card leaves the inbox hopper and rides a straight rail to the press at its end; a reader scans it mid-rail; the tool dial turns to the chosen tool; the press executes once; a result ticket slides to the outbox; the counter advances. Sense, decide, act, observe, repeat.",
  body: [
    base(),
    inbox(),
    rails(),
    slide(),
    outbox(),
    dialStatic(),
    pressStatic(),
    counter(),
    cable(),
    `<g data-part="card" transform="${k.translateAlong(P, [cardStartX, -8, 0])}">${taskCard()}</g>`,
    `<g data-part="reader" transform="${k.translateAlong(P, [readerStartX, -8, 0])}">${readerCarriage()}</g>`,
    `<g data-part="dialtop" transform="${k.translateAlong(P, [DIAL[0], DIAL[1], 3 + DIAL_BASE_H])}">${dialTop()}<path data-part="pointer" class="iso-line" data-tone="lit" data-free="start" d="${dialPointerAt(-Math.PI / 2)}" style="stroke-width:1.4"/></g>`,
    `<g data-part="ram" transform="${k.translateAlong(P, [PRESS_X, -8, 44])}">${pressRam()}</g>`,
    `<g data-part="ticket" transform="${k.translateAlong(P, [99, 4, 13])}" opacity="0">${resultTicket()}</g>`,
    `<path data-part="cneedle" class="iso-line" data-tone="lit" data-free="start" d="${counterNeedleAt(0)}" style="stroke-width:1.2"/>`,
  ],
});

const liveBody = `
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_BASE_H = ${DIAL_BASE_H}, DIAL_TOP_H = ${DIAL_TOP_H};
const COUNTER = ${JSON.stringify(COUNTER)}, COUNTER_R = ${COUNTER_R}, COUNTER_POST_H = ${COUNTER_POST_H};
const PRESS_X = ${PRESS_X};
const cardStartX = ${cardStartX}, cardEndX = ${cardEndX}, readerStartX = ${readerStartX};
const T = 9;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const card = svg.querySelector('[data-part="card"]');
const reader = svg.querySelector('[data-part="reader"]');
const pointer = svg.querySelector('[data-part="pointer"]');
const ram = svg.querySelector('[data-part="ram"]');
const ticket = svg.querySelector('[data-part="ticket"]');
const cneedle = svg.querySelector('[data-part="cneedle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const seg = (t, a, b) => smooth((t - a) / (b - a));
const dialPointerAt = (angle) => {
  const r = DIAL_R - 8;
  return lineOnTop([0, 0], [Math.cos(angle) * r, Math.sin(angle) * r], DIAL_TOP_H + 0.3, P);
};
const counterNeedleAt = (count) => {
  const angle = -Math.PI / 2 + count * (Math.PI / 6);
  const [x, y] = COUNTER;
  return lineOnTop(
    [x - Math.cos(angle) * 3, y - Math.sin(angle) * 3],
    [x + Math.cos(angle) * (COUNTER_R - 4), y + Math.sin(angle) * (COUNTER_R - 4)],
    COUNTER_POST_H + 7.3, P
  );
};
let count = 0;
const PHASES = [[0, 0.4, "感知 · 读卡"], [0.4, 0.58, "决策 · 选工具"], [0.58, 0.78, "执行"], [0.78, 1, "观察 · 回执"]];
function draw(t) {
  const cx = cardStartX + (cardEndX - cardStartX) * seg(t, 0.02, 0.3);
  const cz = 8 * seg(t, 0.2, 0.3);
  card.setAttribute("transform", translateAlong(P, [cx, -8, cz]));
  const rx = readerStartX + (cardEndX - 36 - readerStartX) * seg(t, 0.08, 0.38);
  reader.setAttribute("transform", translateAlong(P, [rx, -8, 0]));
  const ang = -Math.PI / 2 + (count * Math.PI) / 2 + seg(t, 0.4, 0.58) * (Math.PI / 2);
  pointer.setAttribute("d", dialPointerAt(ang));
  const ramDz = -23 * (seg(t, 0.58, 0.68) - seg(t, 0.68, 0.78));
  ram.setAttribute("transform", translateAlong(P, [PRESS_X, -8, 44 + ramDz]));
  const tk = seg(t, 0.78, 0.93);
  ticket.setAttribute("opacity", tk > 0 ? 1 : 0);
  ticket.setAttribute("transform", translateAlong(P, [99 + tk * 37, 4 + tk * 52, 13 - tk * 8]));
  const done = t >= 0.93 ? 1 : 0;
  cneedle.setAttribute("d", counterNeedleAt(count + done));
  const phase = PHASES.find(([a, b]) => t >= a && t < b) || PHASES[3];
  const text = "第 " + (count + 1) + " 轮 · " + phase[2];
  if (readout.textContent !== text) readout.textContent = text;
}
`;

const live = STATIC_T === null
  ? liveBody + `
let frame = 0, visible = false, start = 0;
function tick(now) {
  if (!start) start = now;
  let t = ((now - start) / 1000 / T) % 1;
  if (t >= 0.985) { count++; start = now; t = 0; }
  draw(t);
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { start = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { draw(0.68); } else { draw(0); }
`
  : liveBody + `draw(${STATIC_T});`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Agent 循环机",
  hint: STATIC_T === null ? "自动演示一轮循环" : "执行瞬间 · 静态",
  readout: "第 1 轮 · 感知 · 读卡",
  keys: [
    { mark: "lit", label: "任务卡 / 回执 / 指针：本轮循环中活动的部件" },
    { mark: "hi", label: "读卡器、选择盘、压机：三个工位" },
  ],
  caption: "一台解释 AI agent 循环的机器：任务卡从进件斗沿导轨滑向末端的压机，读卡器中途扫描，工具选择盘转到对应工具，压机执行一次，回执经滑道落入出件盘，计数器加一——感知、决策、执行、观察，周而复始。",
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Agent 循环机：感知决策执行观察的一轮循环">${svg}</div>`,
});

writeFileSync(resolve(HERE, OUT), k.pageHtml({ title: "Agent 循环机", theme: "light", body, script: kitScript() + live }));
console.log("wrote", OUT);
