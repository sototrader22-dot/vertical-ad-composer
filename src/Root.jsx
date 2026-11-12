import React from "react";
import { Composition } from "remotion";
import { Montage } from "./Montage.jsx";
import { plan as demo } from "./demo-plan.jsx";

const FPS = 30;

// calculateMetadata: duration comes from the plan (in seconds), so a batch never touches the code.
const meta = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.duration * (props.fps || FPS))),
  fps: props.fps || FPS,
});

export const Root = () => (
  <>
    {/* Full piece: voice + b-roll cuts + app pop-in + captions + sfx. */}
    <Composition id="Montage" component={Montage} width={1080} height={1920} fps={FPS}
      durationInFrames={FPS * 10} defaultProps={demo} calculateMetadata={meta} />
    {/* Only animated captions over an already-edited video (plan.base). */}
    <Composition id="CaptionsOnly" component={Montage} width={1080} height={1920} fps={FPS}
      durationInFrames={FPS * 10} defaultProps={{ ...demo, captionsOnly: true }} calculateMetadata={meta} />
  </>
);
