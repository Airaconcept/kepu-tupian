import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintOfSkill } from "./fingerprint.mjs";

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_TYPES = [".mjs", ".js", ".css", ".html", ".json", ".md", ".txt", ".svg"];
const SKIP_DIRS = ["node_modules", "shots", ".git"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AGENTS = ["Claude Code", "OpenCode", "Codex", "Other"];
const KINDS = ["SVG", "SVG + WebGL", "SVG + 3D", "SVG + WebGL + 3D"];

const posix = (path) => path.split(sep).join("/");
const inside = (root, path) => path === root || path.startsWith(root + sep);

function usage(message) {
  if (message) console.error(`publish: ${message}\n`);
  console.log(`Copy a figure into a local clone of the community gallery, ready for a pull request.

  node scripts/publish.mjs <figure folder> --into <anatomy-figures clone> --id <kebab-id> --title "..." --prompt "..." --author <github user>
      [--agent "Claude Code"|OpenCode|Codex|Other] [--model "..."] [--license MIT|CC-BY-4.0] [--tags a,b]
      [--build build.mjs] [--pages dark.html,light.html] [--kind "SVG + WebGL"] [--audit] [--no-poster] [--force]

The figure must be framework-free: a build script that writes standalone pages next to itself.
Nothing is pushed: the command prints the git and gh commands to run when you are ready.`);
  process.exit(message ? 1 : 0);
}

function parse(argv) {
  const options = { agent: "Claude Code", license: "MIT", build: "build.mjs", tags: [] };
  const take = (index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) usage(`${argv[index]} needs a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") usage();
    else if (["--into", "--id", "--title", "--prompt", "--author", "--agent", "--model", "--license", "--build", "--kind", "--date"].includes(arg)) options[arg.slice(2)] = take(index++);
    else if (arg === "--tags") options.tags = take(index++).split(",").map((tag) => tag.trim()).filter(Boolean);
    else if (arg === "--pages") options.pages = take(index++).split(",").map((page) => page.trim());
    else if (arg === "--audit") options.audit = true;
    else if (arg === "--no-poster") options.noPoster = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--")) usage(`unknown option ${arg}`);
    else if (!options.source) options.source = arg;
    else usage(`unexpected argument ${arg}`);
  }
  for (const key of ["source", "into", "id", "title", "prompt", "author"]) if (!options[key]) usage(`missing ${key === "source" ? "the figure folder" : `--${key}`}`);
  if (!ID.test(options.id)) usage("--id must be kebab-case, like token-bucket-bench");
  if (!AGENTS.includes(options.agent)) usage(`--agent must be one of: ${AGENTS.join(", ")}`);
  if (options.kind && !KINDS.includes(options.kind)) usage(`--kind must be one of: ${KINDS.join(", ")}`);
  return options;
}

function listFiles(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (name.startsWith(".") || stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(name)) listFiles(root, full, out);
    } else out.push(posix(relative(root, full)));
  }
  return out;
}

function detectPages(source, files, given) {
  if (given) {
    const [dark, light] = given;
    return { dark: dark || undefined, light: light || undefined };
  }
  const html = files.filter((file) => !file.includes("/") && file.endsWith(".html"));
  const pairs = html.filter((file) => !file.endsWith("-light.html") && html.includes(file.replace(/\.html$/, "-light.html")));
  if (pairs.length === 1) return { dark: pairs[0], light: pairs[0].replace(/\.html$/, "-light.html") };
  const singles = html.filter((file) => !/-(light|verify)\.html$/.test(file));
  if (!pairs.length && singles.length === 1) return { dark: singles[0] };
  throw new Error(`can't tell which pages are the figure (found: ${html.join(", ") || "none"}); pass --pages dark.html,light.html`);
}

function detectKind(text) {
  const webgl = /getContext\(\s*["']webgl2?["']|\bGLSL_ISO\b|\bglLayer\b/.test(text);
  const turning = /\bTURN\.mount\b|\bturnScript\b|\bTURN_CSS\b|class="[^"]*iso-turn/.test(text);
  return `SVG${webgl ? " + WebGL" : ""}${turning ? " + 3D" : ""}`;
}

export function rewriteSkillPaths(text, { fromDir, toDir, source, skill, skillLink }) {
  const outside = [];
  const rewritten = text.replace(/(["'])((?:\.{1,2}\/|\/)[^"'\n]*)\1/g, (literal, quote, path) => {
    const target = resolve(fromDir, path);
    const dotted = (from, to) => {
      const r = posix(relative(from, to));
      return r.startsWith(".") ? r : `./${r}`;
    };
    if (!/\.[a-z]+$/i.test(path) && !inside(skill, target)) return literal;
    if (inside(source, target)) return isAbsolute(path) ? `${quote}${dotted(fromDir, target)}${quote}` : literal;
    if (inside(skill, target)) return `${quote}${dotted(toDir, join(skillLink, relative(skill, target)))}${quote}`;
    if (/\.(m?js|css|json|html|svg)$/.test(path)) outside.push(path);
    return literal;
  });
  return { text: rewritten, outside };
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 });
  if (result.status !== 0) throw new Error(`${args.map((a) => basename(a)).join(" ")} failed:\n${`${result.stdout}${result.stderr}`.trim().split("\n").slice(-12).join("\n")}`);
  return result.stdout;
}

export function publish(options) {
  const source = resolve(options.source);
  const repo = resolve(options.into);
  if (!existsSync(join(source, options.build))) throw new Error(`no ${options.build} in ${source}`);
  if (!existsSync(join(repo, "figures")) || !existsSync(join(repo, "scripts", "validate.mjs"))) throw new Error(`${repo} doesn't look like a clone of anatomy-figures (no figures/ or scripts/validate.mjs)`);
  if (inside(SKILL, source) && !inside(join(SKILL, "examples"), source)) throw new Error("the figure folder is inside the skill itself; publish the folder where the figure was built");
  const dest = join(repo, "figures", options.id);
  if (existsSync(dest)) {
    if (!options.force) throw new Error(`figures/${options.id} already exists; pick another --id or pass --force to replace it`);
    rmSync(dest, { recursive: true, force: true });
  }

  const all = listFiles(source);
  const files = all.filter((file) => SOURCE_TYPES.includes(extname(file).toLowerCase()));
  const skipped = all.filter((file) => !files.includes(file));
  const pages = detectPages(source, files, options.pages);
  for (const page of Object.values(pages)) if (page && !files.includes(page)) throw new Error(`page ${page} not found in ${source}; build the figure first`);

  const skillLink = join(repo, ".skill");
  const kit = fingerprintOfSkill(SKILL);
  const outside = [];
  for (const file of files) {
    const from = join(source, file);
    const to = join(dest, "src", file);
    mkdirSync(dirname(to), { recursive: true });
    if (/\.m?js$/.test(file)) {
      const result = rewriteSkillPaths(readFileSync(from, "utf8"), { fromDir: dirname(from), toDir: dirname(to), source, skill: SKILL, skillLink });
      outside.push(...result.outside.map((path) => `${file}: ${path}`));
      writeFileSync(to, result.text);
    } else cpSync(from, to);
  }
  if (outside.length) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error(`these files reach outside the figure folder and the skill; move what they need into the folder:\n  ${outside.join("\n  ")}`);
  }

  let linked = "existing";
  if (!existsSync(skillLink)) {
    symlinkSync(SKILL, skillLink, "dir");
    linked = "created";
  } else if (fingerprintOfSkill(skillLink) !== kit) {
    const where = lstatSync(skillLink).isSymbolicLink() ? readlinkSync(skillLink) : skillLink;
    throw new Error(`${repo}/.skill (${where}) is a different kit version than this skill; remove it and run again`);
  }

  const build = [[`src/${options.build}`]];
  if (pages.light) build.push([`src/${options.build}`, "--light"]);
  if (!pages.dark) build.shift();
  for (const command of build) run(command, dest);

  const pageText = Object.values(pages).filter(Boolean).map((page) => readFileSync(join(dest, "src", page), "utf8")).join("\n");
  const figure = {
    id: options.id,
    title: options.title.trim(),
    author: options.author.replace(/^@/, ""),
    prompt: options.prompt.trim(),
    kind: options.kind ?? detectKind(pageText),
    agent: options.agent,
    ...(options.model ? { model: options.model } : {}),
    skill: { kit },
    build,
    pages: Object.fromEntries(Object.entries(pages).filter(([, page]) => page).map(([key, page]) => [key, `src/${page}`])),
    ...(options.audit ? { audit: true } : {}),
    license: options.license,
    ...(options.tags.length ? { tags: options.tags } : {}),
    created: options.date ?? new Date().toISOString().slice(0, 10),
  };
  writeFileSync(join(dest, "figure.json"), JSON.stringify(figure, null, 2) + "\n");

  if (!options.noPoster) {
    const page = join(dest, "src", pages.light ?? pages.dark);
    run([join(SKILL, "scripts", "capture.mjs"), page, "--width", "1200", "--out", join(dest, "poster.png")], dest);
    const size = statSync(join(dest, "poster.png")).size;
    if (size > 600 << 10) throw new Error(`poster.png is ${(size / 1024).toFixed(0)} KB, over 600 KB; retake it smaller with scripts/capture.mjs --width 900`);
  }
  return { dest, figure, skipped, linked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parse(process.argv.slice(2));
  try {
    const { dest, figure, skipped, linked } = publish(options);
    const repo = resolve(options.into);
    console.log(`published figures/${figure.id} (${figure.kind}, kit ${figure.skill.kit.slice(7, 19)})`);
    if (skipped.length) console.log(`  left out (not a source type): ${skipped.join(", ")}`);
    console.log(`  .skill link: ${linked}`);
    console.log(`\nCheck it:\n  cd ${repo}\n  node scripts/validate.mjs figures/${figure.id}`);
    console.log(`\nWhen you are happy with it, from your fork of anatomy-figures:\n  git switch -c figure/${figure.id}\n  git add figures/${figure.id}\n  git commit -m "Add ${figure.title.replace(/"/g, "'")}"\n  git push -u origin figure/${figure.id}\n  gh pr create --repo wheresryan22/anatomy-figures --fill`);
  } catch (error) {
    console.error(`publish: ${error.message}`);
    process.exit(1);
  }
}
