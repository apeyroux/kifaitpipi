// One clock drives both the canvas frames and the React timeline. Committing
// its exact time on pause/speed change avoids jumping back to the last UI tick.
export function playbackTime(anchor,now){
 if(!anchor?.playing)return anchor?.time??0;
 return Math.min(1440,anchor.time+Math.max(0,now-anchor.at)*anchor.speed/60000);
}
