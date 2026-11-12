// Example plan used by the Studio preview. Paths are relative to public/.
export const plan = {
  id: "demo", fps: 30, duration: 6,
  voice: null,
  cuts: [
    { src: "demo/a.mp4", from: 0, to: 1.5 },
    { src: "demo/b.mp4", from: 1.5, to: 3 },
    { src: "demo/a.mp4", from: 3, to: 4.5, start: 2 },
  ],
  app: [{ src: "demo/b.mp4", from: 4.5, to: 6, sfx: null }],
  words: [
    { t0: 0.1, t1: 0.5, w: "This" }, { t0: 0.5, t1: 0.9, w: "changes" }, { t0: 0.9, t1: 1.4, w: "EVERYTHING" },
    { t0: 1.6, t1: 2.0, w: "with" }, { t0: 2.0, t1: 2.5, w: "one" }, { t0: 2.5, t1: 3.0, w: "app" },
    { t0: 3.2, t1: 3.7, w: "free" }, { t0: 3.7, t1: 4.3, w: "today." },
  ],
  highlight: ["everything", "free", "app"],
  style: { posY: 0.6, size: 86, maxWords: 3 },
  sfx: [],
};
