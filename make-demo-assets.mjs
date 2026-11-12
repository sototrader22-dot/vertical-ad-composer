// Generates two tiny placeholder 9:16 clips (public/demo/a.mp4, b.mp4) with ffmpeg so the demo renders
// out of the box. Requires `ffmpeg` on your PATH.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public", "demo");
fs.mkdirSync(dir, { recursive: true });

const make = (name, source) => {
  const r = spawnSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `${source}=size=1080x1920:rate=30`, "-t", "8",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, name),
  ], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("ffmpeg failed. Is it installed and on your PATH?");
    process.exit(1);
  }
};

make("a.mp4", "testsrc2");
make("b.mp4", "smptebars");
console.log("Demo clips written to", dir);
