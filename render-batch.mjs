// Batch render: one bundle, N pieces.
//   node render-batch.mjs batches/my-batch.json [--comp Montage] [--concurrency 4] [--only id1,id2]
//
// batch.json: { "output": "../renders", "plans": [ {inline plan} | "path/to/plan.json" ] }
// Files in each plan (src, voice, sfx, base) can be absolute paths or relative to the batch file:
// they are copied to public/_batch/ and rewritten automatically.
// Output: <output>/<plan.id>.mp4 (H.264, 1080x1920).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: node render-batch.mjs <batch.json> [--comp Montage] [--concurrency 4] [--only id1,id2]");
  process.exit(2);
}
const flag = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };
const batchPath = path.resolve(args[0]);
const comp = flag("comp", "Montage");
const concurrency = Number(flag("concurrency", 4));
const only = flag("only", "").split(",").filter(Boolean);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const batch = readJson(batchPath);
const base = path.dirname(batchPath);
const stageDir = path.join(HERE, "public", "_batch");
fs.mkdirSync(stageDir, { recursive: true });
const seen = new Map();

// Copies a file into public/_batch and returns the path to use with staticFile().
const stage = (v) => {
  if (typeof v !== "string" || /^https?:/.test(v)) return v;
  const abs = path.isAbsolute(v) ? v : path.resolve(base, v);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return v;
  if (seen.has(abs)) return seen.get(abs);
  const h = crypto.createHash("md5").update(abs).digest("hex").slice(0, 8);
  const rel = `_batch/${h}-${path.basename(abs)}`;
  const dest = path.join(HERE, "public", rel);
  if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(abs).mtimeMs) fs.copyFileSync(abs, dest);
  seen.set(abs, rel);
  return rel;
};
const FILE_KEYS = new Set(["src", "voice", "sfx", "base"]);
const walk = (o) => {
  if (Array.isArray(o)) return o.map(walk);
  if (o && typeof o === "object")
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, FILE_KEYS.has(k) && typeof v === "string" ? stage(v) : walk(v)]));
  return o;
};

const plans = batch.plans
  .map((p) => (typeof p === "string" ? readJson(path.resolve(base, p)) : p))
  .filter((p) => !only.length || only.includes(p.id))
  .map(walk);

const outDir = path.resolve(base, batch.output || "renders");
fs.mkdirSync(outDir, { recursive: true });

console.log("bundling...");
const serveUrl = await bundle({ entryPoint: path.join(HERE, "src", "index.jsx"), publicDir: path.join(HERE, "public") });

const t0 = Date.now();
const results = [];
for (const plan of plans) {
  const id = plan.id || crypto.randomUUID().slice(0, 6);
  const out = path.join(outDir, `${id}.mp4`);
  try {
    const composition = await selectComposition({ serveUrl, id: comp, inputProps: plan });
    await renderMedia({
      composition, serveUrl, codec: "h264", outputLocation: out, inputProps: plan,
      concurrency, crf: 18, pixelFormat: "yuv420p", audioCodec: "aac",
      onProgress: ({ progress }) => process.stdout.write(`\r${id} ${(progress * 100).toFixed(0)}%   `),
    });
    console.log(`\r${id} OK -> ${out}`);
    results.push({ id, ok: true, out });
  } catch (e) {
    console.log(`\r${id} FAILED: ${String(e.message).split("\n")[0]}`);
    results.push({ id, ok: false, error: String(e.message).slice(0, 400) });
  }
}
fs.writeFileSync(path.join(outDir, "_results.json"), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} pieces in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
