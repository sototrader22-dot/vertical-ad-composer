import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validatePlan } from "../validate-plan.mjs";

const good = () => ({
  id: "x", duration: 6, fps: 30,
  cuts: [{ src: "a.mp4", from: 0, to: 1.5 }],
  app: [{ src: "b.mp4", from: 4.5, to: 6 }],
  words: [{ t0: 0.1, t1: 0.5, w: "Hi" }],
  highlight: ["hi"],
});

test("a well-formed plan has no problems", () => {
  assert.deepEqual(validatePlan(good()), []);
});

test("the bundled demo batch is valid", () => {
  const batch = JSON.parse(fs.readFileSync(new URL("../batches/demo.json", import.meta.url), "utf8"));
  for (const p of batch.plans) assert.deepEqual(validatePlan(p), []);
});

test("rejects missing id and bad duration", () => {
  const p = good(); delete p.id; p.duration = 0;
  const out = validatePlan(p).join("\n");
  assert.match(out, /"id" must be a non-empty string/);
  assert.match(out, /"duration" must be a positive number/);
});

test("rejects a cut whose end is not after its start", () => {
  const p = good(); p.cuts[0].to = 0;
  assert.match(validatePlan(p)[0], /cuts\[0\].*greater than/);
});

test("flags items that run past the plan duration", () => {
  const p = good(); p.app[0].to = 9;
  assert.match(validatePlan(p)[0], /after the plan duration/);
});

test("flags a cut without src", () => {
  const p = good(); delete p.cuts[0].src;
  assert.match(validatePlan(p)[0], /"src" is required/);
});

test("flags bad words and highlight", () => {
  const p = good(); p.words = [{ t0: 2, t1: 1, w: "" }]; p.highlight = "x";
  assert.equal(validatePlan(p).length, 3);
});
