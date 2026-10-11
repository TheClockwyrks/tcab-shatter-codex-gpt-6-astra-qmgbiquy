import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { ShatterState } from "./game";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
import { debug } from "./debug";
import { contact, gravity, tick, spawnWave } from "./physics";
import { initial } from "./model";
const engines: ReturnType<
  typeof createEngine<import("./game").ShatterState, typeof debug>
>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup() {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, down = true) => {
    const e = new Event(down ? "keydown" : "keyup");
    Object.assign(e, { code, repeat: false });
    target.dispatchEvent(e);
  };
  return { engine, key, target };
}
const controls = { turn: 0, thrust: false, fire: false, torpedo: false };
const arena = (): ShatterState => ({
  ...initial(),
  screen: "playing" as const,
  waveSpawning: false,
  saucerSpawning: false,
  ship: { ...initial().ship, collision: false },
});
describe("engine integration", () => {
  it("opens menus, starts a wave, freezes pause, and resumes with Escape", async () => {
    const { engine: e, key } = await setup();
    key("ArrowDown");
    await e.advance(1);
    key("ArrowDown", false);
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    key("Enter", false);
    key("Escape");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(1);
    key("Escape", false);
    key("ArrowUp");
    await e.advance(1);
    key("Enter");
    await e.advance(181);
    expect(e.state.rocks).toHaveLength(4);
    key("Enter", false);
    key("Escape");
    await e.advance(1);
    const frozen = e.state;
    await e.advance(20);
    expect(e.state.rocks).toEqual(frozen.rocks);
    expect(e.state.simTime).toBeGreaterThan(frozen.simTime);
    key("Escape", false);
    key("Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
  });
  it("handles gun holds, torpedo press, diagnostics and mute", async () => {
    const { engine: e, key } = await setup();
    e.apply(() => arena());
    key("Space");
    key("KeyF");
    key("KeyM");
    await e.advance(1);
    expect(e.state.bullets).toHaveLength(1);
    expect(e.state.torpedoes).toHaveLength(1);
    expect(e.state.muted).toBe(true);
    await e.advance(C.FIRE_INTERVAL_TICKS);
    expect(e.state.bullets).toHaveLength(2);
    expect(e.diagnostics().every((d) => !d.error)).toBe(true);
  });
  it("renders every screen and records real drawing", async () => {
    const { engine: e } = await setup();
    e.startRecording();
    for (const screen of [
      "title",
      "howto",
      "playing",
      "paused",
      "gameover",
    ] as const) {
      e.apply((s) => debug.setScreen(s, screen));
      await e.advance(1);
    }
    const rec = e.stopRecording();
    expect(rec.frames).toHaveLength(5);
    expect(rec.ops.length).toBeGreaterThan(100);
    expect(rec.frames.some((f) => f.truncated)).toBe(false);
  });
  it("confirms pointer press and release in one frame", async () => {
    const { engine: e, target } = await setup();
    for (const type of ["pointerdown", "pointerup"]) {
      const event = new Event(type);
      Object.assign(event, {
        clientX: 200,
        clientY: 430,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
      });
      target.dispatchEvent(event);
    }
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
  });
});
describe("simulation", () => {
  it("applies softened direct gravity only to ballistics", () => {
    const b = gravity({ x: C.STAR_X + 200, y: C.STAR_Y, vx: 0, vy: 0 });
    expect(b.vx).toBeCloseTo(-112.5 * C.TICK_DT);
    let s = debug.setShipPosition(arena(), C.STAR_X + 100, C.STAR_Y);
    s = tick(s, controls).state;
    expect(s.ship.vx).toBe(0);
  });
  it("chips armor without scoring and splits on its final hit", () => {
    let s = debug.addRock(arena(), "large", 100, 100);
    for (let i = 0; i < 3; i++) {
      s = debug.addBullet(s, s.rocks[0].x, s.rocks[0].y, 100, 0);
      s = tick(s, controls).state;
      if (i < 2) {
        expect(s.score).toBe(0);
        expect(s.rocks[0].health).toBe(2 - i);
      }
    }
    expect(s.score).toBe(C.SCORE_LARGE);
    expect(s.rocks.map((r) => r.size)).toEqual(["medium", "medium"]);
    expect(Math.abs(s.rocks[0].vy - s.rocks[1].vy)).toBeCloseTo(
      C.SPLIT_KICK * 2,
      2,
    );
  });
  it("torpedo defeats full armor with a longitudinal fragment fan", () => {
    let s = debug.addRock(arena(), "large", 100, 100);
    s = debug.addTorpedo(s, 100, 100, 0);
    s = tick(s, controls).state;
    expect(s.torpedoes).toHaveLength(0);
    expect(s.rocks).toHaveLength(2);
    expect(s.rocks[0].vx - s.rocks[1].vx).toBeCloseTo(C.TORPEDO_SCATTER * 2);
  });
  it("recycles identity and damage and consumes both posed draws", () => {
    let s = debug.addRock(arena(), "large", C.STAR_X, C.STAR_Y);
    s = debug.setRockHealth(s, s.rocks[0].id, 2);
    s = debug.setNextRecycleEdge(s, "left");
    s = debug.setNextRockSpeed(s, 75);
    const id = s.rocks[0].id;
    s = tick(s, controls).state;
    expect(s.rocks[0]).toMatchObject({ id, health: 2, x: 0, vx: 75, vy: 0 });
    expect(s.nextRecycleEdge).toBe(null);
    expect(s.nextRockSpeed).toBe(null);
    expect(s.score).toBe(0);
  });
  it("sweeps high speed contacts including multiple wrap crossings", () => {
    expect(
      contact(
        { x: 400, y: 100, vx: 60000, vy: 0 },
        { x: 200, y: 100, vx: 0, vy: 0 },
        17,
      ),
    ).toBe(true);
    expect(
      contact(
        { x: 5, y: 10, vx: 0, vy: 0 },
        { x: 1275, y: 10, vx: 0, vy: 0 },
        15,
      ),
    ).toBe(true);
    expect(
      contact(
        { x: 400, y: 100, vx: 400000, vy: 0 },
        { x: 200, y: 100, vx: 0, vy: 0 },
        17,
      ),
    ).toBe(true);
  });
  it("awards an extra ship, then arms the next wave only on destruction", () => {
    let s = { ...arena(), waveSpawning: true, wave: 1, score: 9950 };
    expect(tick(s, controls).state.wave).toBe(1);
    s = debug.addRock(s, "small", 100, 100);
    s = debug.addBullet(s, 100, 100, 0, 0);
    s = tick(s, controls).state;
    expect(s.lives).toBe(4);
    expect(s.wave).toBe(2);
    expect(s.waveBanner).toBe(C.WAVE_BANNER_TIME);
    for (let i = 0; i < 180; i++) s = tick(s, controls).state;
    expect(s.rocks).toHaveLength(5);
  });
  it("respawns with grace and refilled torpedo, then ends on the last ship", () => {
    let s = {
      ...arena(),
      ship: { ...arena().ship, collision: true },
      torpedoCharge: 0,
    };
    s = debug.addRock(s, "small", C.SAFE_X, C.SAFE_Y);
    s = tick(s, controls).state;
    expect(s.lives).toBe(2);
    expect(s.ship.invuln).toBe(C.INVULN_TIME);
    expect(s.torpedoCharge).toBe(1);
    s = debug.setLives(debug.setShipInvuln(s, 0), 1);
    s = tick(s, controls).state;
    expect(s.screen).toBe("gameover");
  });
  it("obeys saucer faculties, entry poses and firing clocks", () => {
    let s: ShatterState = {
      ...arena(),
      saucerSpawning: true,
      saucerDue: C.TICK_DT,
      nextSaucerEdge: "right" as const,
      nextSaucerRow: 100,
    };
    s = tick(s, controls).state as typeof s;
    expect(s.saucer?.vx).toBe(-C.SAUCER_SPEED);
    expect(s.nextSaucerEdge).toBe(null);
    let next = debug.setSaucerTravel(s, false);
    next = debug.setSaucerMind(next, false);
    next = debug.setNextSaucerAim(next, 0);
    const x = next.saucer!.x;
    for (let i = 0; i < 192; i++) next = tick(next, controls).state;
    expect(next.saucer!.x).toBe(x);
    expect(next.enemyBullets).toHaveLength(1);
    expect(next.nextSaucerAim).toBe(null);
  });
  it("keeps source state immutable and exposes derived snapshot values", () => {
    const s = arena();
    const next = debug.setShipVelocity(s, 3, 4);
    expect(s.ship.vx).toBe(0);
    expect(debug.snapshot(next).ship.speed).toBe(5);
    expect(debug.reconcile(next)).toEqual(next);
    expect(() => debug.removeRock(s, 100)).toThrow();
    expect(() => debug.setScore(s, NaN)).toThrow();
    expect(debug.reset(next).screen).toBe("title");
  });
  it("spawns safe waves with the capped posed multiplier", () => {
    const s = spawnWave({ ...arena(), wave: 11, nextRockSpeed: 100 });
    expect(s.rocks).toHaveLength(14);
    for (const r of s.rocks) expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(140);
    expect(s.nextRockSpeed).toBe(null);
  });
  it("recharges in exactly ten seconds and guidance turns within its limit", () => {
    let s = debug.addRock(arena(), "small", 350, 120);
    s = debug.addTorpedo(s, 100, 100, 0);
    s = tick(s, controls).state;
    expect(s.torpedoes[0].heading).toBeGreaterThan(0);
    expect(s.torpedoes[0].heading).toBeLessThanOrEqual(
      C.TORPEDO_TURN * C.TICK_DT,
    );
    s = { ...arena(), torpedoCharge: 0 };
    for (let i = 0; i < 1200; i++) s = tick(s, controls).state;
    expect(s.torpedoCharge).toBe(1);
  });
});

describe("regressions and automation contract", () => {
  it("preserves fractional ticks and produces the same motion at different frame rates", async () => {
    const { engine: a } = await setup();
    const { engine: b } = await setup();
    const posed = debug.setShipVelocity(
      debug.setShipPosition(arena(), 200, 200),
      80,
      30,
    );
    a.apply(() => posed);
    b.apply(() => posed);
    a.setClock(new ConstantClock(1000 / 30));
    b.setClock(new ConstantClock(1000 / 240));
    await b.advance(1);
    expect(b.state.ship).toEqual(posed.ship);
    await b.advance(239);
    await a.advance(30);
    expect(a.state.ship.x).toBeCloseTo(b.state.ship.x, 9);
    expect(a.state.simTime).toBeCloseTo(1, 9);
  });

  it("hits the first rock on a sweep rather than absorbing a shot at a later core contact", () => {
    let s = debug.addRock(arena(), "small", 400, C.STAR_Y);
    s = debug.addBullet(s, 100, C.STAR_Y, 80000, 0);
    s = tick(s, controls).state;
    expect(s.score).toBe(C.SCORE_SMALL);
    expect(s.rocks).toHaveLength(0);
  });

  it("slides along the star independently of the lethal-contact gate", () => {
    let s = debug.setShipPosition(arena(), C.STAR_X + 43, C.STAR_Y);
    s = debug.setShipVelocity(s, -100, 70);
    s = tick(s, controls).state;
    expect(Math.hypot(s.ship.x - C.STAR_X, s.ship.y - C.STAR_Y)).toBeCloseTo(
      C.CORE_R + C.SHIP_R,
    );
    const dx = s.ship.x - C.STAR_X,
      dy = s.ship.y - C.STAR_Y;
    expect(s.ship.vx * dx + s.ship.vy * dy).toBeCloseTo(0, 7);
    expect(s.lives).toBe(C.START_LIVES);
  });

  it("absorbs all three weapon classes at the core without scoring", () => {
    let s = debug.addBullet(arena(), C.STAR_X, C.STAR_Y, 0, 0);
    s = debug.addEnemyBullet(s, C.STAR_X, C.STAR_Y, 0, 0);
    s = debug.addTorpedo(s, C.STAR_X, C.STAR_Y, 0);
    s = tick(s, controls).state;
    expect([
      s.bullets.length,
      s.enemyBullets.length,
      s.torpedoes.length,
      s.score,
    ]).toEqual([0, 0, 0, 0]);
  });

  it("turns off homing without changing a torpedo’s powered speed", () => {
    let s = debug.addTorpedo(arena(), 100, 100, 0);
    const id = s.torpedoes[0].id;
    s = debug.setTorpedoHeading(s, id, Math.PI / 2);
    s = debug.setTorpedoHoming(s, id, false);
    s = tick(s, controls).state;
    expect(s.torpedoes[0].x).toBeCloseTo(100);
    expect(s.torpedoes[0].vy).toBeCloseTo(C.TORPEDO_SPEED);
    s = debug.removeTorpedo(s, id);
    expect(s.torpedoes).toHaveLength(0);
    expect(() => debug.setTorpedoHeading(s, id, 0)).toThrow();
  });

  it("round-trips roster poses, rejects unknown entities, and resets every draw", () => {
    let s = debug.addBullet(arena(), 10, 20, 30, 40);
    s = debug.addEnemyBullet(s, 50, 60, 70, 80);
    s = debug.addRock(s, "medium", 90, 100);
    s = debug.addSaucer(s, 200, 200);
    s = debug.setSaucerVelocity(s, 3, 4);
    s = debug.setSaucerWeave(s, -1);
    s = debug.setSaucerGun(s, false);
    s = debug.setRockVelocity(s, s.rocks[0].id, 8, 9);
    const snapshot = debug.snapshot(s);
    expect(snapshot.rocks[0]).toMatchObject({
      radius: C.ROCK_RADIUS.medium,
      vx: 8,
      vy: 9,
    });
    expect(snapshot.saucer).toMatchObject({
      vx: 3,
      vy: 4,
      weave: -1,
      gun: false,
    });
    expect(
      new Set([
        snapshot.bullets[0].id,
        snapshot.enemyBullets[0].id,
        snapshot.rocks[0].id,
        snapshot.saucer!.id,
      ]).size,
    ).toBe(4);
    s = debug.removeBullet(s, s.bullets[0].id);
    s = debug.removeEnemyBullet(s, s.enemyBullets[0].id);
    s = debug.removeRock(s, s.rocks[0].id);
    s = debug.removeSaucer(s);
    expect(() => debug.setSaucerVelocity(s, 0, 0)).toThrow();
    expect(() => debug.setRockHealth(s, 900, 1)).toThrow();
    s = debug.setNextSaucerEdge(s, "left");
    s = debug.setNextSaucerRow(s, 100);
    s = debug.setNextSaucerAim(s, 0.1);
    s = debug.setNextRockSpeed(s, 100);
    s = debug.setNextRecycleEdge(s, "top");
    s = debug.reset(s);
    expect([
      s.nextSaucerEdge,
      s.nextSaucerRow,
      s.nextSaucerAim,
      s.nextRockSpeed,
      s.nextRecycleEdge,
    ]).toEqual([null, null, null, null, null]);
  });

  it("poses run values and faculties without implicitly spawning or scoring", () => {
    let s = debug.setScore(initial(), 20000);
    s = debug.setWave(s, 7);
    s = debug.setMenuIndex(s, 1);
    s = debug.setWaveBanner(s, 1);
    s = debug.setWaveSpawning(s, false);
    s = debug.setSaucerSpawning(s, false);
    s = debug.setSaucerDue(s, 3);
    s = debug.setShipAngle(s, 0.8);
    s = debug.setFireCooldown(s, 14);
    s = debug.setShipCollision(s, false);
    s = debug.setTorpedoCharge(s, 0.25);
    expect(s.lives).toBe(C.START_LIVES);
    expect(s.rocks).toHaveLength(0);
    expect(debug.snapshot(s)).toMatchObject({
      score: 20000,
      wave: 7,
      menuIndex: 1,
      waveBanner: 1,
      torpedoReady: false,
      saucerDue: 3,
    });
    expect(debug.menuItemRect(s, 1)).not.toBe(null);
    expect(debug.menuItemRect(s, 20)).toBe(null);
    for (const clear of [
      debug.clearRocks,
      debug.clearBullets,
      debug.clearEnemyBullets,
      debug.clearTorpedoes,
    ])
      s = clear(s);
    expect(s.score).toBe(20000);
  });

  it("freezes cues, recharge and all world clocks on pause", async () => {
    const { engine: e } = await setup();
    const cues: string[] = [];
    e.events.on("cue:played", (event) => cues.push(event.cue));
    e.apply(() =>
      debug.addSaucer(
        { ...arena(), screen: "paused", torpedoCharge: 0.2 },
        200,
        200,
      ),
    );
    const frozen = e.state;
    await e.advance(240);
    expect(e.state.saucer).toEqual(frozen.saucer);
    expect(e.state.playTime).toBe(frozen.playTime);
    expect(e.state.torpedoCharge).toBe(frozen.torpedoCharge);
    expect(cues).toHaveLength(0);
    expect(e.state.simTime).toBeGreaterThan(frozen.simTime);
  });
});
