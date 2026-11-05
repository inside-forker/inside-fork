#!/usr/bin/env node
// Design lint for the public-site redesign.
//
//   npm run design-lint              Fail if any migrated file (listed in
//                                    design-lint.paths.json) uses a banned
//                                    pattern from the design skill.
//   npm run design-lint -- --report  Count banned patterns in the code that is
//                                    not migrated yet, to track progress.
//
// Rules: .claude/skills/insidekarachi-design/SKILL.md. A real false positive
// can be silenced with a `design-lint-disable-line` comment on that line.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".mdx"]);
const REPORT_ROOTS = ["app", "components", "lib", "hooks"];
// Email HTML needs inline hex colours, and globals.css holds the tokens and
// the legacy block, so neither is part of the report.
const REPORT_EXCLUDE = ["lib/emails", "app/globals.css"];
const DISABLE = "design-lint-disable-line";

const COLORS =
  "primary|secondary|accent|muted|background|foreground|card|popover|destructive|ink|cream|" +
  "white|black|transparent|current|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|" +
  "yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RULES = [
  {
    id: "gradient",
    re: new RegExp(
      `bg-gradient|(?:linear|radial|conic)-gradient|(?<![\\w-])(?:from|via|to)-(?:${COLORS}|\\[)`,
      "g",
    ),
  },
  { id: "backdrop-blur", re: /backdrop-blur|backdrop-filter/g },
  { id: "blur", re: /(?<![\w-])blur-|(?<![\w-])blur\(/g },
  { id: "glow", re: /glow/gi },
  { id: "drop-shadow", re: /drop-shadow/g },
  { id: "shadow", re: /(?<![\w-])shadow-(?!none\b|overlay\b)[\w[\]/.-]+/g },
  {
    id: "arbitrary-value",
    re: /(?<![\w-])(?:shadow|rounded(?:-[a-z]{1,2})?|duration|delay|ease)-\[|(?<![\w-])(?:bg|text|border|ring|fill|stroke|outline|decoration|divide|from|via|to)-\[(?:#|rgb|hsl)/g,
  },
  { id: "hex-color", re: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { id: "rgb-color", re: /\brgba?\(|\bhsla?\((?!\s*var\()/g },
  { id: "legacy-class", re: /glass-card|gradient-text|shadow-premium/g },
];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function walk(target, out = []) {
  if (!existsSync(target)) return out;
  const stat = statSync(target);
  if (stat.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    walk(path.join(target, entry), out);
  }
  return out;
}

function scan(file) {
  const hits = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(DISABLE)) return;
    for (const rule of RULES) {
      for (const m of line.matchAll(rule.re)) {
        hits.push({ rule: rule.id, line: i + 1, col: m.index + 1, match: m[0] });
      }
    }
  });
  return hits;
}

function migratedPaths() {
  const config = JSON.parse(readFileSync(path.join(ROOT, "design-lint.paths.json"), "utf8"));
  return (config.paths ?? []).map((p) => p.replace(/\/+$/, ""));
}

function lint() {
  const paths = migratedPaths();
  let failures = 0;
  for (const p of paths) {
    const abs = path.join(ROOT, p);
    if (!existsSync(abs)) {
      console.warn(`design-lint: ${p} is listed in design-lint.paths.json but does not exist`);
      continue;
    }
    for (const file of walk(abs)) {
      for (const h of scan(file)) {
        failures++;
        console.log(`${rel(file)}:${h.line}:${h.col}  ${h.rule}  ${h.match}`);
      }
    }
  }
  if (failures) {
    console.log(`\ndesign-lint: ${failures} banned pattern(s) in migrated files. See .claude/skills/insidekarachi-design/SKILL.md`);
    process.exit(1);
  }
  console.log(`design-lint: OK (${paths.length} migrated path(s) clean)`);
}

function report() {
  const migrated = migratedPaths();
  const skip = (r) =>
    [...REPORT_EXCLUDE, ...migrated].some((p) => r === p || r.startsWith(`${p}/`));
  const perRule = new Map(RULES.map((r) => [r.id, { matches: 0, files: new Set() }]));
  const perFile = new Map();
  for (const root of REPORT_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      const r = rel(file);
      if (skip(r)) continue;
      for (const h of scan(file)) {
        const s = perRule.get(h.rule);
        s.matches++;
        s.files.add(r);
        perFile.set(r, (perFile.get(r) ?? 0) + 1);
      }
    }
  }
  console.log("Banned patterns in code not migrated yet (excludes lib/emails, globals.css)\n");
  console.log(`${"pattern".padEnd(16)} ${"matches".padStart(8)} ${"files".padStart(6)}`);
  let total = 0;
  for (const [id, s] of perRule) {
    total += s.matches;
    console.log(`${id.padEnd(16)} ${String(s.matches).padStart(8)} ${String(s.files.size).padStart(6)}`);
  }
  console.log(`${"total".padEnd(16)} ${String(total).padStart(8)} ${String(perFile.size).padStart(6)}`);
  console.log("\nMost affected files");
  [...perFile]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([file, n]) => console.log(`${String(n).padStart(6)}  ${file}`));
}

if (process.argv.includes("--report")) report();
else lint();
