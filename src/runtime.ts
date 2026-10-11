import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { ShatterState as S, ShatterDebugApi } from "./game";
import { debug } from "./debug";
import { initial, menuItems, menuRect, wrap } from "./model";
import { tick } from "./physics";
export function initialize(api: InitApi<S>): [S, ShatterDebugApi] {
  for (const action of C.ACTIONS)
    api.input.register(action, C.BINDINGS[action]);
  const specs = [
    {
      freq: 950,
      freqTo: 220,
      durationMs: 95,
      wave: "triangle" as const,
      gain: 0.12,
    },
    {
      freq: 130,
      freqTo: 25,
      durationMs: 220,
      wave: "sawtooth" as const,
      gain: 0.13,
    },
    { freq: 55, durationMs: 100, wave: "sawtooth" as const, gain: 0.045 },
    { freq: 380, freqTo: 780, durationMs: 360, gain: 0.12 },
    {
      freq: 200,
      freqTo: 22,
      durationMs: 550,
      wave: "square" as const,
      gain: 0.12,
    },
    { freq: 600, freqTo: 1200, durationMs: 450, gain: 0.16 },
  ];
  Object.values(C.CUES).forEach((cue, i) => api.audio.define(cue, specs[i]));
  for (const key of [
    "screen",
    "score",
    "lives",
    "wave",
    "torpedoCharge",
    "simTime",
  ] as const)
    api.diagnostics.register(key, (s) => s[key]);
  api.diagnostics.register(
    "ship.position",
    (s) => `${s.ship.x.toFixed(1)}, ${s.ship.y.toFixed(1)}`,
  );
  api.diagnostics.register(
    "ship.velocity",
    (s) => `${s.ship.vx.toFixed(1)}, ${s.ship.vy.toFixed(1)}`,
  );
  api.diagnostics.register("ship.speed", (s) =>
    Math.hypot(s.ship.vx, s.ship.vy),
  );
  api.diagnostics.register("ship.angle", (s) => s.ship.angle);
  api.diagnostics.register("ship.invuln", (s) => s.ship.invuln);
  for (const key of ["bullets", "rocks", "torpedoes"] as const)
    api.diagnostics.register(key, (s) => s[key].length);
  api.diagnostics.register("saucer", (s) => s.saucer !== null);
  api.diagnostics.register("saucer.position", (s) =>
    s.saucer ? `${s.saucer.x.toFixed(1)}, ${s.saucer.y.toFixed(1)}` : "none",
  );
  return [initial(), debug];
}
function start(s: S): S {
  return {
    ...initial(s.muted),
    screen: "playing",
    wave: 1,
    waveBanner: C.WAVE_BANNER_TIME,
    simTime: s.simTime,
    tickClock: s.tickClock,
  };
}
function confirm(s: S): S {
  if (s.screen === "title")
    return s.menuIndex === 0 ? start(s) : { ...s, screen: "howto" };
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: "playing", menuIndex: 0 }
      : s.menuIndex === 1
        ? start(s)
        : { ...s, screen: "title", menuIndex: 0 };
  if (s.screen === "gameover")
    return s.menuIndex === 0
      ? start(s)
      : { ...s, screen: "title", menuIndex: 0 };
  return s;
}
export function update(state: S, api: UpdateApi, dt: number): S {
  const pressed = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  ) as Record<C.ActionName, boolean>;
  const samples = api.input.pointerSamples();
  if (pressed.mute) api.audio.setMuted(!api.audio.muted());
  let s: S = { ...state, muted: api.audio.muted() };
  const before = s.screen;
  if (s.screen === "paused" && (pressed.pause || pressed.back))
    s = { ...s, screen: "playing", menuIndex: 0 };
  else if (s.screen === "playing" && pressed.pause)
    s = { ...s, screen: "paused", menuIndex: 0 };
  else if (s.screen === "howto" && (pressed.confirm || pressed.back))
    s = { ...s, screen: "title" };
  else if (s.screen === "gameover" && pressed.back)
    s = { ...s, screen: "title", menuIndex: 0 };
  else if (menuItems(s).length) {
    const count = menuItems(s).length;
    if (pressed.up) s = { ...s, menuIndex: wrap(s.menuIndex - 1, count) };
    if (pressed.down) s = { ...s, menuIndex: wrap(s.menuIndex + 1, count) };
    if (pressed.confirm) s = confirm(s);
    else {
      const starts = { ...s.pointerStarts };
      let chosen = false;
      for (const sample of samples) {
        const index = menuItems(s).findIndex((_, i) => {
          const r = menuRect(s, i)!;
          return (
            sample.x >= r.x &&
            sample.x <= r.x + r.w &&
            sample.y >= r.y &&
            sample.y <= r.y + r.h
          );
        });
        if (index >= 0) s = { ...s, menuIndex: index };
        if (sample.type === "down" && sample.button === "primary")
          starts[sample.id] = index;
        if (sample.type === "up" && sample.button === "primary") {
          if (index >= 0 && starts[sample.id] === index && !chosen) {
            s = confirm(s);
            chosen = true;
          }
          delete starts[sample.id];
        }
        if (chosen) break;
      }
      s = { ...s, pointerStarts: starts };
    }
  }
  const transitioned = before !== s.screen;
  s = {
    ...s,
    tickClock: s.tickClock + dt,
    pendingFire: s.pendingFire || (!transitioned && pressed.a),
    pendingTorpedo: s.pendingTorpedo || (!transitioned && pressed.b),
  };
  while (s.tickClock >= C.TICK_DT - 1e-10) {
    const result = tick(s, {
      turn: api.input.value("right") - api.input.value("left"),
      thrust: api.input.value("up") > 0,
      fire: !transitioned && (api.input.value("a") > 0 || s.pendingFire),
      torpedo: !transitioned && s.pendingTorpedo,
    });
    s = {
      ...result.state,
      tickClock: Math.max(0, s.tickClock - C.TICK_DT),
      pendingFire: false,
      pendingTorpedo: false,
    };
    for (const cue of result.cues) api.audio.play(cue);
    if (s.screen === "playing" && s.ship.thrusting)
      api.audio.loop(C.CUES.thrust);
    else api.audio.stop(C.CUES.thrust);
  }
  if (s.screen !== "playing") api.audio.stop(C.CUES.thrust);
  return s;
}
