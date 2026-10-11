import * as C from "./constants";
import type { ShatterState as S, RockState, BulletState } from "./game";
import {
  countdown,
  distance,
  random,
  separation,
  ship,
  saucer,
  wrap,
} from "./model";
import type { Point } from "./model";
export interface Controls {
  turn: number;
  thrust: boolean;
  fire: boolean;
  torpedo: boolean;
}
interface Body extends Point {
  readonly vx: number;
  readonly vy: number;
}
const star = { x: C.STAR_X, y: C.STAR_Y, vx: 0, vy: 0 };
export function gravity<T extends Body>(b: T): T {
  const x = C.STAR_X - b.x,
    y = C.STAR_Y - b.y,
    d = Math.hypot(x, y);
  const k = d === 0 ? 0 : (C.MU / Math.max(d, C.SOFTEN) ** 2 / d) * C.TICK_DT;
  return { ...b, vx: b.vx + x * k, vy: b.vy + y * k };
}
export function travel<T extends Body>(b: T): T {
  return {
    ...b,
    x: wrap(b.x + b.vx * C.TICK_DT, C.FIELD_W),
    y: wrap(b.y + b.vy * C.TICK_DT, C.FIELD_H),
  };
}
/** Sweeps relative motion against every periodic image intersecting the segment. */
export function contactTime(a: Body, b: Body, r: number): number {
  let earliest = Infinity;
  const d = separation(b, a),
    vx = (a.vx - b.vx) * C.TICK_DT,
    vy = (a.vy - b.vy) * C.TICK_DT;
  const sx = d.x - vx,
    sy = d.y - vy,
    den = vx * vx + vy * vy;
  for (
    let ix = Math.ceil((Math.min(sx, d.x) - r) / C.FIELD_W);
    ix <= Math.floor((Math.max(sx, d.x) + r) / C.FIELD_W);
    ix++
  )
    for (
      let iy = Math.ceil((Math.min(sy, d.y) - r) / C.FIELD_H);
      iy <= Math.floor((Math.max(sy, d.y) + r) / C.FIELD_H);
      iy++
    ) {
      const x = sx - ix * C.FIELD_W,
        y = sy - iy * C.FIELD_H;
      const c = x * x + y * y - r * r;
      if (c <= 0) return 0;
      const dot = x * vx + y * vy,
        discriminant = dot * dot - den * c;
      if (den > 0 && discriminant >= 0) {
        const time = (-dot - Math.sqrt(discriminant)) / den;
        if (time >= 0 && time <= 1) earliest = Math.min(earliest, time);
      }
    }
  return earliest;
}
export function contact(a: Body, b: Body, r: number): boolean {
  return Number.isFinite(contactTime(a, b, r));
}
export function spawnWave(s: S): S {
  let id = s.nextId;
  const rocks: RockState[] = [];
  for (let i = 0; i < C.WAVE_BASE_ROCKS + s.wave; i++) {
    let p: Point;
    do {
      p = { x: random(0, C.FIELD_W), y: random(0, C.FIELD_H) };
    } while (
      distance(p, s.ship) < C.WAVE_MIN_SHIP_DIST ||
      distance(p, star) < C.WAVE_MIN_STAR_DIST
    );
    const a = random(0, Math.PI * 2),
      v =
        (s.nextRockSpeed ??
          random(C.ROCK_SPEED_MIN.large, C.ROCK_SPEED_MAX.large)) *
        (1 + Math.min(C.WAVE_SPEED_CAP, C.WAVE_SPEED_STEP * (s.wave - 1)));
    rocks.push({
      ...p,
      id: id++,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      size: "large",
      health: C.ROCK_HEALTH.large,
      spin: a,
      flash: 0,
    });
  }
  return { ...s, rocks, nextId: id, nextRockSpeed: null };
}
export function tick(
  input: S,
  c: Controls,
): { state: S; cues: readonly C.CueName[] } {
  let s: S = { ...input, simTime: input.simTime + C.TICK_DT };
  const cues = new Set<C.CueName>();
  const burst = (body: Body, color: string, count: number) => {
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + s.simTime;
      const speed = 35 + (i % 5) * 22;
      return {
        x: body.x,
        y: body.y,
        vx: body.vx * 0.2 + Math.cos(angle) * speed,
        vy: body.vy * 0.2 + Math.sin(angle) * speed,
        life: 0.3 + (i % 4) * 0.12,
        color,
      };
    });
    s = { ...s, particles: [...s.particles, ...particles] };
  };
  if (s.screen !== "playing") return { state: s, cues: [] };
  s = {
    ...s,
    playTime: s.playTime + C.TICK_DT,
    particles: s.particles
      .map((p) => ({ ...travel(p), life: countdown(p.life) }))
      .filter((p) => p.life > 0),
  };
  const sh = {
    ...s.ship,
    angle: s.ship.angle + c.turn * C.SHIP_TURN * C.TICK_DT,
    thrusting: c.thrust,
    invuln: countdown(s.ship.invuln),
    fireCooldown: Math.max(0, s.ship.fireCooldown - 1),
  };
  if (c.thrust) {
    sh.vx += Math.cos(sh.angle) * C.SHIP_THRUST * C.TICK_DT;
    sh.vy += Math.sin(sh.angle) * C.SHIP_THRUST * C.TICK_DT;
  }
  const drag = 0.5 ** (C.TICK_DT / C.SHIP_DRAG_HALFLIFE);
  sh.vx *= drag;
  sh.vy *= drag;
  const speed = Math.hypot(sh.vx, sh.vy);
  if (speed > C.SHIP_MAX) {
    sh.vx *= C.SHIP_MAX / speed;
    sh.vy *= C.SHIP_MAX / speed;
  }
  s = {
    ...s,
    ship: sh,
    torpedoCharge: Math.min(
      1,
      s.torpedoCharge + C.TICK_DT / C.TORPEDO_RECHARGE + 1e-14,
    ),
    extraLifeBanner: countdown(s.extraLifeBanner),
  };
  const nose = {
    x: sh.x + Math.cos(sh.angle) * C.SHIP_R,
    y: sh.y + Math.sin(sh.angle) * C.SHIP_R,
  };
  if (c.fire && sh.fireCooldown === 0 && s.bullets.length < C.MAX_BULLETS) {
    s = {
      ...s,
      nextId: s.nextId + 1,
      bullets: [
        ...s.bullets,
        {
          ...nose,
          id: s.nextId,
          vx: sh.vx + Math.cos(sh.angle) * C.MUZZLE_SPEED,
          vy: sh.vy + Math.sin(sh.angle) * C.MUZZLE_SPEED,
          life: C.BULLET_LIFE,
        },
      ],
      ship: { ...sh, fireCooldown: C.FIRE_INTERVAL_TICKS },
    };
    cues.add(C.CUES.fire);
  }
  if (c.torpedo && s.torpedoCharge === 1 && !s.torpedoes.length)
    s = {
      ...s,
      nextId: s.nextId + 1,
      torpedoCharge: 0,
      torpedoes: [
        {
          ...nose,
          id: s.nextId,
          vx: Math.cos(sh.angle) * C.TORPEDO_SPEED,
          vy: Math.sin(sh.angle) * C.TORPEDO_SPEED,
          heading: sh.angle,
          life: C.TORPEDO_LIFE,
          homing: true,
        },
      ],
    };
  const leave = () => {
    s = {
      ...s,
      saucer: null,
      saucerClock: 0,
      saucerDue: random(C.SAUCER_GAP_MIN, C.SAUCER_GAP_MAX),
    };
  };
  if (s.saucer) {
    let u = {
      ...s.saucer,
      age: s.saucer.age + C.TICK_DT,
      fireClock: countdown(s.saucer.fireClock),
      weaveClock: countdown(s.saucer.weaveClock),
    };
    if (u.mind && u.weaveClock === 0)
      u = {
        ...u,
        vy:
          u.vy === 0
            ? u.weave * C.SAUCER_WEAVE_SPEED
            : -Math.sign(u.vy) * C.SAUCER_WEAVE_SPEED,
        weaveClock: C.SAUCER_WEAVE_INTERVAL,
      };
    if (
      u.mind &&
      Math.abs(u.x - C.STAR_X) < 110 &&
      Math.abs(u.y - C.STAR_Y) < 85
    )
      u = { ...u, vy: (u.y < C.STAR_Y ? -1 : 1) * C.SAUCER_WEAVE_SPEED };
    if (u.gun && u.fireClock === 0) {
      const d = separation(u, s.ship),
        a =
          Math.atan2(d.y, d.x) +
          (s.nextSaucerAim ?? random(-C.SAUCER_AIM_ERROR, C.SAUCER_AIM_ERROR));
      s = {
        ...s,
        nextSaucerAim: null,
        nextId: s.nextId + 1,
        enemyBullets: [
          ...s.enemyBullets,
          {
            id: s.nextId,
            x: u.x,
            y: u.y,
            vx: u.vx + Math.cos(a) * C.SAUCER_BULLET_SPEED,
            vy: u.vy + Math.sin(a) * C.SAUCER_BULLET_SPEED,
            life: C.SAUCER_BULLET_LIFE,
          },
        ],
      };
      u.fireClock = C.SAUCER_FIRE_INTERVAL;
    }
    if (u.travel) u = travel(u);
    if (u.mind && distance(u, star) < C.CORE_R + C.SAUCER_R) {
      const a = Math.atan2(u.y - star.y, u.x - star.x);
      u = {
        ...u,
        x: star.x + Math.cos(a) * (C.CORE_R + C.SAUCER_R),
        y: star.y + Math.sin(a) * (C.CORE_R + C.SAUCER_R),
      };
    }
    s = { ...s, saucer: u };
    if (u.age >= C.SAUCER_LIFETIME - 1e-10) leave();
  } else {
    s = { ...s, saucerClock: s.saucerClock + C.TICK_DT };
    if (s.saucerSpawning && s.saucerClock >= s.saucerDue - 1e-10) {
      const edge = s.nextSaucerEdge ?? (Math.random() < 0.5 ? "left" : "right");
      s = {
        ...s,
        nextId: s.nextId + 1,
        saucer: {
          ...saucer(
            s.nextId,
            edge === "left" ? 0 : C.FIELD_W,
            s.nextSaucerRow ?? random(C.SAUCER_R, C.FIELD_H - C.SAUCER_R),
          ),
          vx: edge === "left" ? C.SAUCER_SPEED : -C.SAUCER_SPEED,
          weave: Math.random() < 0.5 ? 1 : -1,
        },
        nextSaucerEdge: null,
        nextSaucerRow: null,
      };
      cues.add(C.CUES.saucer);
    }
  }
  const advanceBullet = (b: BulletState) => ({
    ...travel(gravity(b)),
    life: countdown(b.life),
  });
  s = {
    ...s,
    ship: travel(s.ship),
    rocks: s.rocks.map((r) => ({
      ...travel(gravity(r)),
      spin: r.spin + C.TICK_DT * 0.18,
      flash: countdown(r.flash),
    })),
    bullets: s.bullets.map(advanceBullet),
    enemyBullets: s.enemyBullets.map(advanceBullet),
    torpedoes: s.torpedoes.map((t) => {
      let heading = t.heading;
      if (t.homing) {
        const candidates = [...s.rocks, ...(s.saucer ? [s.saucer] : [])]
          .map((b) => {
            const d = separation(t, b);
            const angle = Math.atan2(d.y, d.x);
            return {
              angle,
              error: wrap(angle - heading + Math.PI, Math.PI * 2) - Math.PI,
              d: Math.hypot(d.x, d.y),
            };
          })
          .filter((b) => Math.abs(b.error) <= C.TORPEDO_CONE)
          .sort((a, b) => a.d - b.d);
        if (candidates[0])
          heading += Math.max(
            -C.TORPEDO_TURN * C.TICK_DT,
            Math.min(C.TORPEDO_TURN * C.TICK_DT, candidates[0].error),
          );
      }
      return {
        ...travel({
          ...t,
          heading,
          vx: C.TORPEDO_SPEED * Math.cos(heading),
          vy: C.TORPEDO_SPEED * Math.sin(heading),
        }),
        life: countdown(t.life),
      };
    }),
  };
  // Resolve the solid core before damaging contacts.
  const slideTime = contactTime(s.ship, star, C.CORE_R + C.SHIP_R);
  if (Number.isFinite(slideTime)) {
    const p = s.ship;
    let x = p.x - p.vx * C.TICK_DT * (1 - slideTime) - star.x,
      y = p.y - p.vy * C.TICK_DT * (1 - slideTime) - star.y;
    let d = Math.hypot(x, y);
    if (d === 0) {
      x = 0;
      y = 1;
      d = 1;
    }
    x /= d;
    y /= d;
    const dot = Math.min(0, p.vx * x + p.vy * y);
    s = {
      ...s,
      ship: {
        ...p,
        x: star.x + x * (C.CORE_R + C.SHIP_R),
        y: star.y + y * (C.CORE_R + C.SHIP_R),
        vx: p.vx - dot * x,
        vy: p.vy - dot * y,
      },
    };
  }
  const recycled = s.rocks.map((r) => {
    if (!contact(r, star, C.CORE_R + C.ROCK_RADIUS[r.size])) return r;
    const edges = ["top", "bottom", "left", "right"] as const;
    const edge =
        s.nextRecycleEdge ?? edges[Math.floor(Math.random() * edges.length)],
      v =
        s.nextRockSpeed ??
        random(C.ROCK_SPEED_MIN[r.size], C.ROCK_SPEED_MAX[r.size]);
    s = { ...s, nextRecycleEdge: null, nextRockSpeed: null };
    return {
      ...r,
      x:
        edge === "left"
          ? 0
          : edge === "right"
            ? C.FIELD_W - 1e-7
            : random(0, C.FIELD_W),
      y:
        edge === "top"
          ? 0
          : edge === "bottom"
            ? C.FIELD_H - 1e-7
            : random(0, C.FIELD_H),
      vx: edge === "left" ? v : edge === "right" ? -v : 0,
      vy: edge === "top" ? v : edge === "bottom" ? -v : 0,
    };
  });
  s = { ...s, rocks: recycled };
  const coreFree = <T extends BulletState>(b: T, r: number) =>
    b.life > 0 && !contact(b, star, C.CORE_R + r);
  s = {
    ...s,
    bullets: s.bullets.filter((b) => b.life > 0),
    enemyBullets: s.enemyBullets.filter((b) => coreFree(b, C.SAUCER_BULLET_R)),
    torpedoes: s.torpedoes.filter((t) => t.life > 0),
  };
  let destroyed = false;
  const award = (n: number) => {
    const score = s.score + n,
      extra =
        Math.floor(score / C.EXTRA_LIFE_STEP) -
        Math.floor(s.score / C.EXTRA_LIFE_STEP);
    s = {
      ...s,
      score,
      lives: s.lives + extra,
      extraLifeBanner: extra ? 1.6 : s.extraLifeBanner,
    };
    if (extra) cues.add(C.CUES.extraLife);
  };
  for (const kind of ["bullets", "torpedoes"] as const) {
    for (const b of [...s[kind]]) {
      const heavy = kind === "torpedoes",
        radius = heavy ? C.TORPEDO_R : C.BULLET_R;
      const hits = s.rocks
        .map((r) => ({
          rock: r,
          time: contactTime(b, r, radius + C.ROCK_RADIUS[r.size]),
        }))
        .filter((h) => Number.isFinite(h.time))
        .sort((a, b) => a.time - b.time);
      const hit = hits[0];
      const coreTime = contactTime(b, star, radius + C.CORE_R);
      const saucerTime = s.saucer
        ? contactTime(b, s.saucer, radius + C.SAUCER_R)
        : Infinity;
      if (
        Number.isFinite(coreTime) &&
        coreTime <= (hit?.time ?? Infinity) &&
        coreTime <= saucerTime
      ) {
        s = { ...s, [kind]: s[kind].filter((v) => v.id !== b.id) };
        continue;
      }
      const r = hit?.rock;
      if (r && hit.time <= saucerTime) {
        s = { ...s, [kind]: s[kind].filter((v) => v.id !== b.id) };
        if (!heavy && r.health > 1) {
          burst(b, "#f5b96b", 5);
          s = {
            ...s,
            rocks: s.rocks.map((v) =>
              v.id === r.id
                ? { ...v, health: v.health - 1, flash: C.HIT_FLASH_TIME }
                : v,
            ),
          };
          continue;
        }
        destroyed = true;
        burst(r, heavy ? "#8ae9e8" : "#f5b96b", heavy ? 28 : 18);
        cues.add(C.CUES.shatter);
        award(
          r.size === "large"
            ? C.SCORE_LARGE
            : r.size === "medium"
              ? C.SCORE_MEDIUM
              : C.SCORE_SMALL,
        );
        let rocks = s.rocks.filter((v) => v.id !== r.id);
        const size = C.ROCK_CHILD[r.size];
        if (size) {
          const norm = Math.hypot(b.vx, b.vy) || 1,
            kick = heavy ? C.TORPEDO_SCATTER : C.SPLIT_KICK,
            dx = ((heavy ? b.vx : -b.vy) / norm) * kick,
            dy = ((heavy ? b.vy : b.vx) / norm) * kick;
          rocks = [
            ...rocks,
            ...[1, -1].map((sign, i) => ({
              ...r,
              id: s.nextId + i,
              size,
              health: C.ROCK_HEALTH[size],
              flash: 0,
              vx: r.vx + sign * dx,
              vy: r.vy + sign * dy,
            })),
          ];
          s = { ...s, nextId: s.nextId + 2 };
        }
        s = { ...s, rocks };
      } else if (s.saucer && Number.isFinite(saucerTime)) {
        burst(s.saucer, "#f0849b", 20);
        s = { ...s, [kind]: s[kind].filter((v) => v.id !== b.id) };
        award(C.SCORE_SAUCER);
        leave();
      }
    }
  }
  if (s.ship.collision && s.ship.invuln === 0) {
    const enemy = s.enemyBullets.find((b) =>
      contact(s.ship, b, C.SHIP_R + C.SAUCER_BULLET_R),
    );
    if (
      enemy ||
      s.rocks.some((r) =>
        contact(s.ship, r, C.SHIP_R + C.ROCK_RADIUS[r.size]),
      ) ||
      (s.saucer && contact(s.ship, s.saucer, C.SHIP_R + C.SAUCER_R))
    ) {
      burst(s.ship, "#8ae9e8", 28);
      cues.add(C.CUES.death);
      const lives = s.lives - 1;
      s = {
        ...s,
        lives,
        enemyBullets: enemy
          ? s.enemyBullets.filter((b) => b.id !== enemy.id)
          : s.enemyBullets,
        screen: lives > 0 ? "playing" : "gameover",
        menuIndex: 0,
        ship: lives > 0 ? { ...ship(), invuln: C.INVULN_TIME } : s.ship,
        torpedoCharge: lives > 0 ? 1 : s.torpedoCharge,
      };
    }
  }
  if (s.waveBanner > 0) {
    const waveBanner = countdown(s.waveBanner);
    s = { ...s, waveBanner };
    if (waveBanner === 0 && s.waveSpawning) s = spawnWave(s);
  } else if (destroyed && !s.rocks.length && s.waveSpawning)
    s = { ...s, wave: s.wave + 1, waveBanner: C.WAVE_BANNER_TIME };
  const trails: Record<number, readonly Point[]> = {};
  for (const b of [...s.bullets, ...s.enemyBullets])
    trails[b.id] = [...(s.trails[b.id] ?? []), { x: b.x, y: b.y }].slice(
      -C.TRAIL_TICKS - 1,
    );
  return { state: { ...s, trails }, cues: [...cues] };
}
