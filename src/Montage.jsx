import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, Img, staticFile,
  useCurrentFrame, useVideoConfig, spring, interpolate,
} from "remotion";

/*
 * PLAN (JSON): all times in SECONDS, all files relative to public/.
 * {
 *   id, fps, duration,
 *   voice: "voice.wav",  music: {src, volume},
 *   avatar: [{src, from, to, start?}],            // talking-head segments (keep them short)
 *   cuts:   [{src, from, to, start?, x?}],        // b-roll cuts (<= 1.5 s each works best)
 *   app:    [{src, from, to, start?, sfx?}],      // app pop-in: only when the script names the app
 *   cta:    [{from, to, text?}],                  // bouncing call-to-action box
 *   words:  [{t0, t1, w}],                        // word-level transcript (e.g. from faster-whisper)
 *   highlight: ["word", ...],                     // keywords drawn in the accent color
 *   style: {color, posY, size, maxWords},
 *   sfx: [{src, t, volume}],
 *   base: "video.mp4"                             // only for the CaptionsOnly composition
 * }
 */

const ACCENT = "#22C55E"; // default accent color for highlighted words

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9$%]/g, "");

const f = (s, fps) => Math.round(s * fps);
const src = (p) => (/^https?:/.test(p) ? p : staticFile(p));

// ───────── B-roll cuts: 9:16 cover, with a slow zoom so it never feels static ─────────
const Cut = ({ c }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = Math.max(1, f(c.to - c.from, fps));
  const zoom = interpolate(frame, [0, dur], [1.0, 1.08], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo
        src={src(c.src)} muted startFrom={f(c.start || 0, fps)}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          objectPosition: `${(c.x ?? 0.5) * 100}% 50%`, transform: `scale(${zoom})`,
        }}
      />
    </AbsoluteFill>
  );
};

// ───────── App pop-in: springs up with a shadow and rounded corners; sfx plays on the first frame ─────────
const AppPop = ({ a }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 160, mass: 0.7 } });
  const out = interpolate(frame, [f(a.to - a.from, fps) - 5, f(a.to - a.from, fps)], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div style={{
        width: 760, height: 1350, borderRadius: 64, overflow: "hidden", background: "#fff",
        transform: `scale(${0.6 + 0.4 * s})`, boxShadow: "0 40px 120px rgba(0,0,0,.55)", border: "6px solid #fff",
      }}>
        {/\.(png|jpe?g|webp)$/i.test(a.src)
          ? <Img src={src(a.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <OffthreadVideo src={src(a.src)} muted startFrom={f(a.start || 0, fps)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      {a.sfx ? <Audio src={src(a.sfx)} volume={0.9} /> : null}
    </AbsoluteFill>
  );
};

// ───────── Captions: phrases of <= N words, the active word grows, keywords use the accent color ─────────
const group = (words, maxW) => {
  const g = [];
  let cur = [];
  words.forEach((p, i) => {
    cur.push(p);
    const brk = /[.!?,;:]$/.test(p.w) || cur.length >= maxW || (words[i + 1] && words[i + 1].t0 - p.t1 > 0.35);
    if (brk) { g.push(cur); cur = []; }
  });
  if (cur.length) g.push(cur);
  return g;
};

const Captions = ({ words, highlight = [], style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const keys = new Set(highlight.map(norm));
  const accent = style.color || ACCENT;
  const groups = React.useMemo(() => group(words, style.maxWords || 3), [words, style.maxWords]);
  const g = groups.find((gr) => t >= gr[0].t0 - 0.02 && t < gr[gr.length - 1].t1 + 0.12);
  if (!g) return null;
  const tIn = g[0].t0;
  const enter = spring({ frame: frame - f(tIn, fps), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ top: `${(style.posY ?? 0.6) * 100}%`, height: "auto", alignItems: "center", pointerEvents: "none" }}>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 64px", padding: "0 90px",
        transform: `scale(${0.85 + 0.15 * Math.min(1, enter)})`, opacity: Math.min(1, enter * 1.5),
      }}>
        {g.map((p, i) => {
          const active = t >= p.t0 && t < p.t1;
          const isKey = keys.has(norm(p.w));
          return (
            <span key={i} style={{
              fontFamily: "Montserrat, Arial Black, Impact, sans-serif", fontWeight: 900,
              fontSize: style.size || 86, textTransform: "uppercase", lineHeight: 1.12,
              color: isKey ? accent : "#fff",
              WebkitTextStroke: "10px #000", paintOrder: "stroke fill",
              textShadow: "0 6px 0 rgba(0,0,0,.35)",
              transform: `scale(${active ? 1.05 : 1})`, display: "inline-block",
            }}>{p.w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ───────── CTA: green box with an arrow, bounces in ─────────
const Cta = ({ a }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 180, mass: 0.7 } });
  const arrow = Math.sin(frame / 4) * 14;
  return (
    <AbsoluteFill style={{ top: "72%", height: "auto", alignItems: "center", pointerEvents: "none" }}>
      <div style={{
        background: "#2fa35a", color: "#fff", borderRadius: 36, padding: "26px 60px", textAlign: "center",
        fontFamily: "Montserrat, Arial Black, Impact, sans-serif", fontWeight: 900, fontSize: 84, textTransform: "uppercase",
        transform: `scale(${0.6 + 0.4 * s})`, boxShadow: "0 18px 50px rgba(0,0,0,.5)", border: "6px solid #fff",
      }}>
        {a.text || "Tap here"}
        <div style={{ fontSize: 90, lineHeight: 1, transform: `translateY(${arrow}px)` }}>↓</div>
      </div>
    </AbsoluteFill>
  );
};

// ───────── Piece ─────────
export const Montage = (plan) => {
  const { fps } = useVideoConfig();
  const seq = (arr, Comp, key) =>
    (arr || []).map((x, i) => (
      <Sequence key={`${key}${i}`} from={f(x.from, fps)} durationInFrames={Math.max(1, f(x.to - x.from, fps))}>
        <Comp {...{ [key === "c" ? "c" : "a"]: x }} />
      </Sequence>
    ));
  const full = !plan.captionsOnly;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {plan.captionsOnly && plan.base ? <OffthreadVideo src={src(plan.base)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {full && seq(plan.cuts, Cut, "c")}
      {full && (plan.avatar || []).map((a, i) => (
        <Sequence key={`av${i}`} from={f(a.from, fps)} durationInFrames={Math.max(1, f(a.to - a.from, fps))}>
          <Cut c={{ ...a, x: a.x ?? 0.5 }} />
        </Sequence>
      ))}
      {full && seq(plan.app, AppPop, "a")}
      {full && seq(plan.cta, Cta, "a")}
      {plan.words ? <Captions words={plan.words} highlight={plan.highlight} style={plan.style} /> : null}
      {full && plan.voice ? <Audio src={src(plan.voice)} /> : null}
      {plan.music ? <Audio src={src(plan.music.src)} volume={plan.music.volume ?? 0.12} loop /> : null}
      {(plan.sfx || []).map((s, i) => (
        <Sequence key={`sf${i}`} from={f(s.t, fps)}><Audio src={src(s.src)} volume={s.volume ?? 0.8} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
