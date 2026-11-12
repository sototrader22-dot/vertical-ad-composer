// Validates a plan object before rendering. Returns an array of human-readable problems (empty = OK).
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

const checkTimed = (plan, key, needSrc, problems) => {
  (plan[key] || []).forEach((it, i) => {
    const at = `${key}[${i}]`;
    if (!isNum(it.from) || !isNum(it.to)) return problems.push(`${at}: "from" and "to" must be numbers (seconds)`);
    if (it.to <= it.from) problems.push(`${at}: "to" (${it.to}) must be greater than "from" (${it.from})`);
    if (needSrc && typeof it.src !== "string") problems.push(`${at}: "src" is required`);
    if (isNum(plan.duration) && it.to > plan.duration + 0.001)
      problems.push(`${at}: ends at ${it.to}s, after the plan duration (${plan.duration}s)`);
  });
};

export function validatePlan(plan) {
  const problems = [];
  if (!plan || typeof plan !== "object") return ["plan must be an object"];
  if (typeof plan.id !== "string" || !plan.id) problems.push('"id" must be a non-empty string');
  if (!isNum(plan.duration) || plan.duration <= 0) problems.push('"duration" must be a positive number of seconds');
  if (plan.fps !== undefined && (!isNum(plan.fps) || plan.fps <= 0)) problems.push('"fps" must be a positive number');

  checkTimed(plan, "cuts", true, problems);
  checkTimed(plan, "avatar", true, problems);
  checkTimed(plan, "app", true, problems);
  checkTimed(plan, "cta", false, problems);

  (plan.words || []).forEach((w, i) => {
    if (typeof w.w !== "string" || !w.w) problems.push(`words[${i}]: "w" must be a non-empty string`);
    if (!isNum(w.t0) || !isNum(w.t1) || w.t1 < w.t0) problems.push(`words[${i}]: need numeric t0 <= t1`);
  });
  if (plan.highlight !== undefined && !(Array.isArray(plan.highlight) && plan.highlight.every((h) => typeof h === "string")))
    problems.push('"highlight" must be an array of strings');
  return problems;
}
