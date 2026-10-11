import * as C from "./constants";
import type { ShatterState, ShipState, SaucerState } from "./game";
export const wrap = (n: number, size: number) => ((n % size) + size) % size;
export const delta = (a: number, b: number, size: number) =>
  wrap(b - a + size / 2, size) - size / 2;
export const separation = (a: Point, b: Point) => ({
  x: delta(a.x, b.x, C.FIELD_W),
  y: delta(a.y, b.y, C.FIELD_H),
});
export interface Point {
  readonly x: number;
  readonly y: number;
}
export const distance = (a: Point, b: Point) => {
  const d = separation(a, b);
  return Math.hypot(d.x, d.y);
};
export const random = (lo: number, hi: number) =>
  lo + Math.random() * (hi - lo);
export const countdown = (n: number) =>
  Math.max(0, n - C.TICK_DT < 1e-10 ? 0 : n - C.TICK_DT);
export function ship(): ShipState {
  return {
    x: C.SAFE_X,
    y: C.SAFE_Y,
    vx: 0,
    vy: 0,
    angle: C.FACE_UP,
    thrusting: false,
    invuln: 0,
    collision: true,
    fireCooldown: 0,
  };
}
export function initial(muted = false): ShatterState {
  return {
    screen: "title",
    menuIndex: 0,
    score: 0,
    lives: C.START_LIVES,
    wave: 0,
    waveBanner: 0,
    ship: ship(),
    bullets: [],
    rocks: [],
    saucer: null,
    enemyBullets: [],
    torpedoes: [],
    torpedoCharge: 1,
    waveSpawning: true,
    saucerSpawning: true,
    saucerClock: 0,
    saucerDue: C.SAUCER_FIRST_DELAY,
    nextSaucerEdge: null,
    nextSaucerRow: null,
    nextSaucerAim: null,
    nextRockSpeed: null,
    nextRecycleEdge: null,
    tickClock: 0,
    nextId: 1,
    simTime: 0,
    muted,
    trails: {},
    extraLifeBanner: 0,
    particles: [],
    playTime: 0,
    pointerStarts: {},
    pendingFire: false,
    pendingTorpedo: false,
  };
}
export function saucer(id: number, x: number, y: number): SaucerState {
  return {
    id,
    x,
    y,
    vx: C.SAUCER_SPEED,
    vy: 0,
    mind: true,
    gun: true,
    travel: true,
    weave: 1,
    fireClock: C.SAUCER_FIRE_INTERVAL,
    weaveClock: C.SAUCER_WEAVE_INTERVAL,
    age: 0,
  };
}
export const menuItems = (s: ShatterState) =>
  s.screen === "title"
    ? C.TITLE_ITEMS
    : s.screen === "paused"
      ? C.PAUSE_ITEMS
      : s.screen === "gameover"
        ? C.GAMEOVER_ITEMS
        : [];
export function menuRect(s: ShatterState, index: number) {
  return Number.isInteger(index) && index >= 0 && index < menuItems(s).length
    ? {
        x: s.screen === "title" ? 100 : 460,
        y: (s.screen === "title" ? 405 : 385) + index * 62,
        w: 360,
        h: 50,
      }
    : null;
}
