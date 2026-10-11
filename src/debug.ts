import * as C from "./constants";
import type { ShatterState, Screen, SaucerEdge, FieldEdge } from "./game";
import { initial, menuRect, saucer } from "./model";
type S = ShatterState;
function finite(...values: number[]) {
  if (values.some((v) => !Number.isFinite(v)))
    throw new Error("Expected finite number");
}
function name<T extends string>(v: T, choices: readonly string[]): T {
  if (!choices.includes(v)) throw new Error("Unknown name: " + v);
  return v;
}
function entity<T extends { readonly id: number }>(
  items: readonly T[],
  id: number,
): T {
  finite(id);
  const item = items.find((v) => v.id === id);
  if (!item) throw new Error("Unknown entity: " + id);
  return item;
}
function liveSaucer(s: S) {
  if (!s.saucer) throw new Error("No saucer");
  return s.saucer;
}
export const debug = {
  version: C.SHATTER_DEBUG_VERSION,
  reset: (s: S): S => initial(s.muted),
  reconcile: (s: S): S => ({ ...s }),
  menuItemRect: (s: S, index: number) => {
    finite(index);
    return menuRect(s, index);
  },
  snapshot: (s: S) => ({
    version: C.SHATTER_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    score: s.score,
    lives: s.lives,
    wave: s.wave,
    waveBanner: s.waveBanner,
    muted: s.muted,
    waveSpawning: s.waveSpawning,
    saucerSpawning: s.saucerSpawning,
    saucerClock: s.saucerClock,
    saucerDue: s.saucerDue,
    nextSaucerEdge: s.nextSaucerEdge,
    nextSaucerRow: s.nextSaucerRow,
    nextSaucerAim: s.nextSaucerAim,
    nextRockSpeed: s.nextRockSpeed,
    nextRecycleEdge: s.nextRecycleEdge,
    ship: { ...s.ship, speed: Math.hypot(s.ship.vx, s.ship.vy) },
    bullets: s.bullets.map((b) => ({ ...b })),
    rocks: s.rocks.map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      vx: r.vx,
      vy: r.vy,
      size: r.size,
      radius: C.ROCK_RADIUS[r.size],
      health: r.health,
    })),
    saucer: s.saucer ? { ...s.saucer } : null,
    enemyBullets: s.enemyBullets.map((b) => ({ ...b })),
    torpedoes: s.torpedoes.map((t) => ({ ...t })),
    torpedoCharge: s.torpedoCharge,
    torpedoReady: s.torpedoCharge === 1,
    simTime: s.simTime,
  }),
  setMenuIndex: (s: S, n: number): S => {
    finite(n);
    return { ...s, menuIndex: n };
  },
  setScore: (s: S, n: number): S => {
    finite(n);
    return { ...s, score: n };
  },
  setLives: (s: S, n: number): S => {
    finite(n);
    return { ...s, lives: n };
  },
  setWave: (s: S, n: number): S => {
    finite(n);
    return { ...s, wave: n };
  },
  setWaveBanner: (s: S, n: number): S => {
    finite(n);
    return { ...s, waveBanner: n };
  },
  setSaucerDue: (s: S, n: number): S => {
    finite(n);
    return { ...s, saucerDue: n };
  },
  setNextSaucerRow: (s: S, n: number): S => {
    finite(n);
    return { ...s, nextSaucerRow: n };
  },
  setNextSaucerAim: (s: S, n: number): S => {
    finite(n);
    return { ...s, nextSaucerAim: n };
  },
  setNextRockSpeed: (s: S, n: number): S => {
    finite(n);
    return { ...s, nextRockSpeed: n };
  },
  setTorpedoCharge: (s: S, n: number): S => {
    finite(n);
    return { ...s, torpedoCharge: n };
  },
  setWaveSpawning: (s: S, enabled: boolean): S => ({
    ...s,
    waveSpawning: enabled,
  }),
  setSaucerSpawning: (s: S, enabled: boolean): S => ({
    ...s,
    saucerSpawning: enabled,
  }),
  setScreen: (s: S, value: Screen): S => ({
    ...s,
    screen: name(value, ["title", "howto", "playing", "paused", "gameover"]),
  }),
  setNextSaucerEdge: (s: S, value: SaucerEdge): S => ({
    ...s,
    nextSaucerEdge: name(value, ["left", "right"]),
  }),
  setNextRecycleEdge: (s: S, value: FieldEdge): S => ({
    ...s,
    nextRecycleEdge: name(value, ["top", "bottom", "left", "right"]),
  }),
  setShipPosition: (s: S, x: number, y: number): S => {
    finite(x, y);
    return { ...s, ship: { ...s.ship, x, y } };
  },
  setShipVelocity: (s: S, vx: number, vy: number): S => {
    finite(vx, vy);
    return { ...s, ship: { ...s.ship, vx, vy } };
  },
  setShipAngle: (s: S, angle: number): S => {
    finite(angle);
    return { ...s, ship: { ...s.ship, angle } };
  },
  setShipInvuln: (s: S, invuln: number): S => {
    finite(invuln);
    return { ...s, ship: { ...s.ship, invuln } };
  },
  setFireCooldown: (s: S, ticks: number): S => {
    finite(ticks);
    return { ...s, ship: { ...s.ship, fireCooldown: ticks } };
  },
  setShipCollision: (s: S, enabled: boolean): S => ({
    ...s,
    ship: { ...s.ship, collision: enabled },
  }),
  addBullet: (s: S, x: number, y: number, vx: number, vy: number): S => {
    finite(x, y, vx, vy);
    return {
      ...s,
      nextId: s.nextId + 1,
      bullets: [
        ...s.bullets,
        { id: s.nextId, x, y, vx, vy, life: C.BULLET_LIFE },
      ],
    };
  },
  addEnemyBullet: (s: S, x: number, y: number, vx: number, vy: number): S => {
    finite(x, y, vx, vy);
    return {
      ...s,
      nextId: s.nextId + 1,
      enemyBullets: [
        ...s.enemyBullets,
        { id: s.nextId, x, y, vx, vy, life: C.SAUCER_BULLET_LIFE },
      ],
    };
  },
  removeBullet: (s: S, id: number): S => {
    entity(s.bullets, id);
    return { ...s, bullets: s.bullets.filter((v) => v.id !== id) };
  },
  clearBullets: (s: S): S => ({ ...s, bullets: [] }),
  removeEnemyBullet: (s: S, id: number): S => {
    entity(s.enemyBullets, id);
    return { ...s, enemyBullets: s.enemyBullets.filter((v) => v.id !== id) };
  },
  clearEnemyBullets: (s: S): S => ({ ...s, enemyBullets: [] }),
  removeRock: (s: S, id: number): S => {
    entity(s.rocks, id);
    return { ...s, rocks: s.rocks.filter((v) => v.id !== id) };
  },
  clearRocks: (s: S): S => ({ ...s, rocks: [] }),
  removeTorpedo: (s: S, id: number): S => {
    entity(s.torpedoes, id);
    return { ...s, torpedoes: s.torpedoes.filter((v) => v.id !== id) };
  },
  clearTorpedoes: (s: S): S => ({ ...s, torpedoes: [] }),
  addRock: (s: S, size: C.RockSize, x: number, y: number): S => {
    finite(x, y);
    name(size, ["large", "medium", "small"]);
    return {
      ...s,
      nextId: s.nextId + 1,
      rocks: [
        ...s.rocks,
        {
          id: s.nextId,
          x,
          y,
          vx: 0,
          vy: 0,
          size,
          spin: 0,
          health: C.ROCK_HEALTH[size],
          flash: 0,
        },
      ],
    };
  },
  setRockVelocity: (s: S, id: number, vx: number, vy: number): S => {
    finite(vx, vy);
    entity(s.rocks, id);
    return {
      ...s,
      rocks: s.rocks.map((r) => (r.id === id ? { ...r, vx, vy } : r)),
    };
  },
  setRockHealth: (s: S, id: number, hp: number): S => {
    finite(hp);
    const r = entity(s.rocks, id);
    if (!Number.isInteger(hp) || hp < 1 || hp > C.ROCK_HEALTH[r.size])
      throw new Error("Invalid health");
    return {
      ...s,
      rocks: s.rocks.map((r) => (r.id === id ? { ...r, health: hp } : r)),
    };
  },
  addSaucer: (s: S, x: number, y: number): S => {
    finite(x, y);
    return { ...s, nextId: s.nextId + 1, saucer: saucer(s.nextId, x, y) };
  },
  removeSaucer: (s: S): S => ({ ...s, saucer: null }),
  setSaucerVelocity: (s: S, vx: number, vy: number): S => {
    finite(vx, vy);
    return { ...s, saucer: { ...liveSaucer(s), vx, vy } };
  },
  setSaucerWeave: (s: S, direction: 1 | -1): S => {
    if (direction !== 1 && direction !== -1) throw new Error("Invalid weave");
    return { ...s, saucer: { ...liveSaucer(s), weave: direction } };
  },
  setSaucerMind: (s: S, enabled: boolean): S => ({
    ...s,
    saucer: { ...liveSaucer(s), mind: enabled },
  }),
  setSaucerGun: (s: S, enabled: boolean): S => ({
    ...s,
    saucer: { ...liveSaucer(s), gun: enabled },
  }),
  setSaucerTravel: (s: S, enabled: boolean): S => ({
    ...s,
    saucer: { ...liveSaucer(s), travel: enabled },
  }),
  addTorpedo: (s: S, x: number, y: number, heading: number): S => {
    finite(x, y, heading);
    return {
      ...s,
      nextId: s.nextId + 1,
      torpedoes: [
        ...s.torpedoes,
        {
          id: s.nextId,
          x,
          y,
          heading,
          vx: C.TORPEDO_SPEED * Math.cos(heading),
          vy: C.TORPEDO_SPEED * Math.sin(heading),
          life: C.TORPEDO_LIFE,
          homing: true,
        },
      ],
    };
  },
  setTorpedoHeading: (s: S, id: number, radians: number): S => {
    finite(radians);
    const t = entity(s.torpedoes, id);
    const speed = Math.hypot(t.vx, t.vy);
    return {
      ...s,
      torpedoes: s.torpedoes.map((t) =>
        t.id === id
          ? {
              ...t,
              heading: radians,
              vx: speed * Math.cos(radians),
              vy: speed * Math.sin(radians),
            }
          : t,
      ),
    };
  },
  setTorpedoHoming: (s: S, id: number, enabled: boolean): S => {
    entity(s.torpedoes, id);
    return {
      ...s,
      torpedoes: s.torpedoes.map((t) =>
        t.id === id ? { ...t, homing: enabled } : t,
      ),
    };
  },
};
