#!/usr/bin/env node
// render-static.mjs —— 多平台静态配图渲染器
//
// 把一张 Anatomy 静态 HTML 定格图，套版输出成各社交平台要的比例。
// 策略：16:9 母版直出；其他比例不硬裁，而是"套版"——母版图完整保留，
// 上下加纸色标题区，这样机器主体永远不会被切掉。
//
// 用法：
//   node scripts/render-static.mjs <figure-static.html> \
//     --aspect 16:9 --title "Agent 循环机" --subtitle "感知 → 决策 → 执行 → 观察" \
//     --out /tmp/agent-16x9.png
//
//   --aspect 可选：16:9（X/B站） 1:1（IG/Threads/FB） 4:5（IG） 3:4（小红书） 9:16（TikTok）
//   输入的 HTML 应该是静态定格版（比如 build.mjs --static=0.68 生成的）。
//
// 依赖：scripts/capture.mjs（headless Chrome 截图）

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE = join(HERE, "capture.mjs");

const ASPECTS = {
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "3:4": [1080, 1440],
  "9:16": [1080, 1920],
};

function usage() {
  console.log(`用法（静态图）: node render-static.mjs <figure-static.html> --aspect <比例> --title <标题> [选项]

  --aspect <16:9|1:1|4:5|3:4|9:16>  目标比例（默认 16:9）
  --title <文本>                     主标题（套版时显示在图上方）
  --subtitle <文本>                  副标题（可选，显示在主图下方）
  --out <png>                        输出路径（默认 ./static-<aspect>.png）
  --width <px>                       母版截图视口宽（默认 1200）

用法（视频）: node render-static.mjs --video <build.mjs> --frames <N> --fps <F> --out <mp4>

  --video <build.mjs>   figure 的构建脚本（须支持 --static=<t> 和 --out=<文件>）
  --frames <N>          总帧数（默认 48）
  --fps <F>             帧率（默认 24）
  --out <mp4>           输出视频路径（默认 ./figure.mp4）
  视频为 plate 原生尺寸（各帧自动对齐）；竖版视频暂不支持`);
}

function parse(argv) {
  const o = { aspect: "16:9", title: "", subtitle: "", width: 1200, frames: 48, fps: 24 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--aspect") o.aspect = next();
    else if (a === "--title") o.title = next();
    else if (a === "--subtitle") o.subtitle = next();
    else if (a === "--out") o.out = next();
    else if (a === "--width") o.width = Number(next());
    else if (a === "--video") o.video = next();
    else if (a === "--frames") o.frames = Number(next());
    else if (a === "--fps") o.fps = Number(next());
    else if (a === "--help" || a === "-h") o.help = true;
    else rest.push(a);
  }
  o.html = rest[0];
  return o;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 视频模式：对 build.mjs 按时间 t=0..1 烘焙 N 帧静态 HTML，逐帧截图后用 ffmpeg 合成 MP4。
// 要求 build.mjs 支持 --static=<t> 和 --out=<文件> 两个参数（见 examples/agent-loop/build.mjs）。
function renderVideo(o) {
  const build = resolve(o.video);
  const buildDir = dirname(build);
  const N = o.frames, fps = o.fps;
  const out = o.out || "figure.mp4";
  const tmp = mkdtempSync(join(tmpdir(), "render-video-"));
  const nodeArgs = process.execArgv.includes("--experimental-websocket")
    ? [] : ["--experimental-websocket"];

  console.error(`烘焙 ${N} 帧……`);
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)).toFixed(4);
    const frameHtml = join(tmp, `frame-${String(i).padStart(4, "0")}.html`);
    const framePng = join(tmp, `frame-${String(i).padStart(4, "0")}.png`);
    execFileSync(process.execPath, [build, `--static=${t}`, `--out=${frameHtml}`],
      { cwd: buildDir, stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
    execFileSync(process.execPath,
      [...nodeArgs, CAPTURE, frameHtml, "--out", framePng,
       "--width", "1280", "--height", "720",
       "--scale", "1", "--wait", "800"],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
    if ((i + 1) % 12 === 0 || i === N - 1) console.error(`  ${i + 1}/${N}`);
  }

  console.error("合成视频……");
  execFileSync("ffmpeg", ["-y", "-framerate", String(fps), "-i", join(tmp, "frame-%04d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", resolve(out)],
    { stdio: ["ignore", "pipe", "pipe"], timeout: 300000 });
  console.log(`saved ${out}`);
}

function main() {
  const o = parse(process.argv.slice(2));
  if (o.help || (!o.html && !o.video)) { usage(); process.exit(o.html || o.video ? 0 : 2); }

  // 视频模式：逐帧烘焙静态 HTML → 截图 → ffmpeg 合成
  if (o.video) { renderVideo(o); return; }

  if (!ASPECTS[o.aspect]) { console.error(`不支持的比例：${o.aspect}`); process.exit(2); }

  const html = resolve(o.html);
  const tmp = mkdtempSync(join(tmpdir(), "render-static-"));
  const masterPng = join(tmp, "master.png");

  // 第一步：母版截图（只截机器 plate，干净）
  const nodeArgs = process.execArgv.includes("--experimental-websocket")
    ? [] : ["--experimental-websocket"];
  let clipOut = "";
  try {
    clipOut = execFileSync(process.execPath,
      [...nodeArgs, CAPTURE, html, "--out", masterPng,
       "--width", String(o.width), "--height", "700",
       "--scale", "1", "--wait", "2500"],
      { encoding: "utf-8", timeout: 120000 });
  } catch (e) {
    console.error("母版截图失败：", (e.stdout || "") + (e.stderr || e.message));
    process.exit(1);
  }
  const m = clipOut.match(/clip\s+\d+,\d+\s+(\d+)x(\d+)/);
  if (!m) { console.error("没解析到截图区域，capture 输出：\n" + clipOut); process.exit(1); }
  const [mw, mh] = [Number(m[1]), Number(m[2])];
  console.error(`母版 ${mw}x${mh}`);

  const out = o.out || `static-${o.aspect.replace(":", "x")}.png`;

  // 16:9：母版直出
  if (o.aspect === "16:9") {
    copyFileSync(masterPng, out);
    console.log(`saved ${out}`);
    return;
  }

  // 其他比例：套版
  const [W, H] = ASPECTS[o.aspect];
  const b64 = readFileSync(masterPng).toString("base64");
  const s = W / 1080; // 缩放系数
  const pad = Math.round(W * 0.075);
  const padTop = Math.round(H * 0.09); // 内容偏上：社交封面标准构图
  const contentW = W - pad * 2;
  const imgH = Math.round(contentW * mh / mw);

  const wrapHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #f6f4ee; }
  #wrap {
    width: ${W}px; height: ${H}px; background: #f6f4ee;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    padding-top: ${padTop}px;
    font-family: "Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  .kicker {
    font-size: ${Math.round(26 * s)}px; letter-spacing: ${Math.round(10 * s)}px;
    color: #9a958a; margin-bottom: ${Math.round(18 * s)}px; text-indent: ${Math.round(10 * s)}px;
  }
  h1 {
    font-size: ${Math.round(64 * s)}px; font-weight: 700; color: #2b2925;
    text-align: center; line-height: 1.25; max-width: ${contentW}px;
    margin-bottom: ${Math.round(34 * s)}px;
  }
  img { width: ${contentW}px; height: ${imgH}px; display: block;
        border: 1px solid #e3ded2; border-radius: ${Math.round(8 * s)}px; background: #fff; }
  .sub {
    font-size: ${Math.round(30 * s)}px; color: #6f6a5e; text-align: center;
    line-height: 1.6; max-width: ${contentW}px; margin-top: ${Math.round(30 * s)}px;
  }
</style></head><body>
<div id="wrap">
  <div class="kicker">ANATOMY · 机械科普</div>
  ${o.title ? `<h1>${esc(o.title)}</h1>` : ""}
  <img src="data:image/png;base64,${b64}">
  ${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ""}
</div>
</body></html>`;
  const wrapPath = join(tmp, "wrap.html");
  writeFileSync(wrapPath, wrapHtml);

  try {
    execFileSync(process.execPath,
      [...nodeArgs, CAPTURE, wrapPath, "--out", resolve(out),
       "--select", "#wrap", "--width", String(W), "--height", String(H),
       "--scale", "2", "--wait", "1200"],
      { encoding: "utf-8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    console.error("套版截图失败：", e.message);
    process.exit(1);
  }
  console.log(`saved ${out}`);
}

main();
