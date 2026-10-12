import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fingerprintOf, fingerprintOfSkill } from "./fingerprint.mjs";
import { publish, rewriteSkillPaths } from "./publish.mjs";

const SKILL = resolve(import.meta.dirname, "..");

function gallery() {
  const repo = mkdtempSync(join(tmpdir(), "anatomy-gallery-"));
  mkdirSync(join(repo, "figures"));
  mkdirSync(join(repo, "scripts"));
  writeFileSync(join(repo, "scripts", "validate.mjs"), "");
  return repo;
}

test("the fingerprint matches the gallery's algorithm", () => {
  assert.equal(fingerprintOf([["kit/a.mjs", "1"], ["kit/b.mjs", "2"], ["scripts/inline-kit.mjs", "3"]]), fingerprintOf([["kit/b.mjs", "2"], ["scripts/inline-kit.mjs", "3"], ["kit/a.mjs", "1"]]));
  assert.equal(fingerprintOf([["kit/a.mjs", "1"], ["kit/b.mjs", "2"], ["scripts/inline-kit.mjs", "3"]]), "sha256:a249319b0f2a8db4899fbb430c782c55b7699df73809c5c0e4c07495c72eae8c");
  assert.match(fingerprintOfSkill(SKILL), /^sha256:[0-9a-f]{64}$/);
});

test("skill paths are rewritten to the gallery's .skill link, and nothing else", () => {
  const source = "/work/fig";
  const text = 'import * as k from "../../kit/iso-kit.mjs";\nimport { kitScript } from "../../scripts/inline-kit.mjs";\nimport "./live.mjs";\nconst x = "/2";';
  const { text: out, outside } = rewriteSkillPaths(text, { fromDir: join(SKILL, "examples", "x"), toDir: "/g/figures/x/src", source: join(SKILL, "examples", "x"), skill: SKILL, skillLink: "/g/.skill" });
  assert.deepEqual(outside, []);
  assert.match(out, /from "\.\.\/\.\.\/\.\.\/\.skill\/kit\/iso-kit\.mjs"/);
  assert.match(out, /from "\.\.\/\.\.\/\.\.\/\.skill\/scripts\/inline-kit\.mjs"/);
  assert.match(out, /import "\.\/live\.mjs"/);
  assert.match(out, /"\/2"/);
  const away = rewriteSkillPaths('import "../../elsewhere/x.mjs";', { fromDir: source, toDir: "/g/figures/x/src", source, skill: SKILL, skillLink: "/g/.skill" });
  assert.deepEqual(away.outside, ["../../elsewhere/x.mjs"]);
});

test("publishing an example rebuilds it byte for byte in the gallery", () => {
  const repo = gallery();
  try {
    const { dest, figure } = publish({ source: join(SKILL, "examples", "dial-indicator"), into: repo, id: "dial-indicator", title: "Dial indicator", prompt: "/anatomy a dial indicator", author: "octo-cat", agent: "Codex", license: "MIT", build: "build.mjs", tags: [], noPoster: true, date: "2026-10-12" });
    assert.equal(figure.kind, "SVG");
    assert.equal(figure.skill.kit, fingerprintOfSkill(SKILL));
    assert.deepEqual(figure.build, [["src/build.mjs", "--light"], ["src/build.mjs"]]);
    assert.deepEqual(figure.pages, { dark: "src/dial-indicator.html", light: "src/dial-indicator-light.html" });
    for (const page of ["dial-indicator.html", "dial-indicator-light.html"]) assert.ok(readFileSync(join(dest, "src", page)).equals(readFileSync(join(SKILL, "examples", "dial-indicator", page))), page);
    assert.ok(existsSync(join(repo, ".skill", "kit", "iso-kit.mjs")));
    assert.throws(() => publish({ source: join(SKILL, "examples", "dial-indicator"), into: repo, id: "dial-indicator", title: "x", prompt: "x", author: "x", agent: "Codex", license: "MIT", build: "build.mjs", tags: [], noPoster: true }), /already exists/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("publishing refuses a folder that is not a gallery clone", () => {
  const empty = mkdtempSync(join(tmpdir(), "not-gallery-"));
  try {
    assert.throws(() => publish({ source: join(SKILL, "examples", "dial-indicator"), into: empty, id: "x", title: "x", prompt: "x", author: "x", agent: "Codex", license: "MIT", build: "build.mjs", tags: [], noPoster: true }), /doesn't look like a clone of anatomy-community/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
