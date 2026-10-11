import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { ShatterState as S, RockState } from "./game";
import { delta, menuItems, menuRect } from "./model";
const cyan = "#8ae9e8",
  amber = "#f5b96b",
  white = "#e5edf1",
  muted = "#718590";
type Ctx = CanvasRenderingContext2D;
function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size = 14,
  color = white,
  font = "monospace",
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${size >= 40 ? "800" : "500"} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}
function line(
  ctx: Ctx,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function circle(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  fill = false,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function vessel(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  scale = 1,
  flame = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  if (flame) {
    ctx.fillStyle = amber;
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-33, 0);
    ctx.lineTo(-12, 6);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-14, 13);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-14, -13);
  ctx.closePath();
  ctx.fillStyle = "#14333c";
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = cyan;
  ctx.stroke();
  line(ctx, 0, 0, 11, 0, white, 2);
  ctx.restore();
}
function rock(ctx: Ctx, r: RockState) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.spin);
  const radius = C.ROCK_RADIUS[r.size];
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr =
      radius * (0.77 + 0.23 * (0.5 + 0.5 * Math.sin(i * 17.3 + r.id * 6.2)));
    const x = Math.cos(a) * rr,
      y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = r.flash > 0 ? "#e9d7af" : "#182026";
  ctx.fill();
  ctx.strokeStyle = r.flash > 0 ? white : "#a99273";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  line(
    ctx,
    -radius * 0.5,
    -radius * 0.2,
    radius * 0.05,
    -radius * 0.5,
    "#394147",
  );
  line(
    ctx,
    radius * 0.05,
    -radius * 0.5,
    radius * 0.5,
    -radius * 0.1,
    "#394147",
  );
  for (let i = 0; i < C.ROCK_HEALTH[r.size] - r.health; i++) {
    ctx.strokeStyle = amber;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, radius * (i * 0.4 - 0.3));
    ctx.lineTo(-radius * 0.15, radius * 0.1);
    ctx.lineTo(radius * 0.1, -radius * 0.25);
    ctx.lineTo(radius * 0.7, radius * (i * 0.4 - 0.4));
    ctx.stroke();
  }
  if (r.size !== "small") {
    for (let i = 0; i < C.ROCK_HEALTH[r.size]; i++) {
      ctx.fillStyle = i < r.health ? "#bba17c" : "#42474a";
      ctx.fillRect(-8 + i * 7, radius * 0.5, 4, 2);
    }
  }
  ctx.restore();
}
function duplicates(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  draw: () => void,
) {
  for (const dx of [
    0,
    ...(x < r ? [C.FIELD_W] : []),
    ...(x > C.FIELD_W - r ? [-C.FIELD_W] : []),
  ])
    for (const dy of [
      0,
      ...(y < r ? [C.FIELD_H] : []),
      ...(y > C.FIELD_H - r ? [-C.FIELD_H] : []),
    ]) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
}
function background(ctx: Ctx) {
  ctx.fillStyle = "#070d14";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  for (let i = 0; i < 170; i++) {
    const x = (Math.sin(i * 731.13) * 0.5 + 0.5) * C.FIELD_W,
      y = (Math.sin(i * 371.79 + 7) * 0.5 + 0.5) * C.FIELD_H;
    ctx.fillStyle = i % 9 === 0 ? "#52616a" : "#24313d";
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
  }
  ctx.strokeStyle = "#0c1822";
  ctx.lineWidth = 1;
  for (let x = 40; x < C.FIELD_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.FIELD_H);
    ctx.stroke();
  }
  for (let y = 40; y < C.FIELD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.FIELD_W, y);
    ctx.stroke();
  }
}
function well(ctx: Ctx, time: number) {
  const g = ctx.createRadialGradient(
    C.STAR_X,
    C.STAR_Y,
    C.CORE_R * 0.6,
    C.STAR_X,
    C.STAR_Y,
    C.HALO_R * 1.5,
  );
  g.addColorStop(0, "#faddad");
  g.addColorStop(0.12, "#ce884d88");
  g.addColorStop(0.4, "#bd703425");
  g.addColorStop(1, "#bd703400");
  ctx.fillStyle = g;
  ctx.fillRect(
    C.STAR_X - C.HALO_R * 1.5,
    C.STAR_Y - C.HALO_R * 1.5,
    C.HALO_R * 3,
    C.HALO_R * 3,
  );
  for (const r of [65, 100, 145]) {
    ctx.save();
    ctx.translate(C.STAR_X, C.STAR_Y);
    ctx.rotate(time * 0.07 + r);
    ctx.strokeStyle = "#73513955";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.76, 0, 0.2, 5.6);
    ctx.stroke();
    ctx.restore();
  }
  circle(ctx, C.STAR_X, C.STAR_Y, C.CORE_R, "#f9dfaf", true);
  circle(ctx, C.STAR_X, C.STAR_Y, C.CORE_R - 5, "#fff0cb", true);
  circle(ctx, C.STAR_X, C.STAR_Y, C.CORE_R + 5, "#c8955b");
}
function field(s: S, ctx: Ctx) {
  well(ctx, s.playTime);
  for (const p of s.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    line(ctx, p.x, p.y, p.x - p.vx * 0.035, p.y - p.vy * 0.035, p.color, 1.5);
  }
  ctx.globalAlpha = 1;
  for (const r of s.rocks)
    duplicates(ctx, r.x, r.y, C.ROCK_RADIUS[r.size], () => rock(ctx, r));
  for (const b of [...s.bullets, ...s.enemyBullets]) {
    const enemy = s.enemyBullets.includes(b);
    const points = s.trails[b.id] ?? [];
    const reach = Math.max(
      C.BULLET_R,
      ...points.map((p) =>
        Math.hypot(delta(b.x, p.x, C.FIELD_W), delta(b.y, p.y, C.FIELD_H)),
      ),
    );
    duplicates(ctx, b.x, b.y, reach, () => {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          p = points[i];
        const ax = b.x + delta(b.x, a.x, C.FIELD_W),
          ay = b.y + delta(b.y, a.y, C.FIELD_H),
          px = ax + delta(a.x, p.x, C.FIELD_W),
          py = ay + delta(a.y, p.y, C.FIELD_H);
        ctx.globalAlpha = i / points.length;
        line(
          ctx,
          ax,
          ay,
          px,
          py,
          enemy ? "#fb877e" : cyan,
          Math.max(0.3, (i / points.length) * 3),
        );
      }
      ctx.globalAlpha = 1;
      circle(ctx, b.x, b.y, C.BULLET_R, enemy ? "#ffb5a6" : white, true);
    });
  }
  for (const t of s.torpedoes)
    duplicates(ctx, t.x, t.y, 25, () => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.heading);
      line(ctx, -24, 0, 1, 0, amber, 3);
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-8, -4);
      ctx.lineTo(0, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  if (s.saucer) {
    const u = s.saucer;
    duplicates(ctx, u.x, u.y, 24, () => {
      ctx.strokeStyle = "#f0849b";
      ctx.fillStyle = "#3e2033";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(u.x, u.y, 23, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(u.x, u.y - 5, 11, 10, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      line(ctx, u.x - 14, u.y, u.x + 14, u.y, "#ffb2c3");
    });
  }
  if (s.lives > 0) {
    ctx.globalAlpha =
      s.ship.invuln > 0
        ? 0.35 + 0.65 * (Math.sin(s.playTime * 25) > 0.0 ? 1 : 0)
        : 1;
    duplicates(ctx, s.ship.x, s.ship.y, 35, () => {
      vessel(ctx, s.ship.x, s.ship.y, s.ship.angle, 1, s.ship.thrusting);
      if (s.ship.invuln > 0) circle(ctx, s.ship.x, s.ship.y, 25, "#8ae9e855");
    });
    ctx.globalAlpha = 1;
  }
}
function hud(s: S, ctx: Ctx) {
  ctx.fillStyle = "#070d14d9";
  ctx.fillRect(28, 18, 152, 171);
  ctx.fillRect(1090, 18, 164, 61);
  text(ctx, "SCORE", 40, 38, 11, muted);
  text(ctx, String(s.score).padStart(6, "0"), 38, 76, 36, white);
  for (let i = 0; i < s.lives - 1; i++)
    vessel(ctx, 48 + i * 24, 98, C.FACE_UP, 0.4);
  text(ctx, "F", 40, 142, 12, s.torpedoCharge === 1 ? cyan : muted);
  const chargeColor = s.torpedoCharge === 1 ? cyan : muted;
  line(ctx, 66, 135, 107, 135, chargeColor, 2);
  line(ctx, 107, 135, 97, 130, chargeColor, 2);
  line(ctx, 107, 135, 97, 140, chargeColor, 2);
  line(ctx, 70, 135, 64, 129, chargeColor);
  line(ctx, 70, 135, 64, 141, chargeColor);
  ctx.fillStyle = "#243039";
  ctx.fillRect(40, 154, 120, 3);
  ctx.fillStyle = cyan;
  ctx.fillRect(40, 154, 120 * s.torpedoCharge, 3);
  text(
    ctx,
    s.torpedoCharge === 1
      ? "WARHEAD READY"
      : `REARMING ${Math.ceil((1 - s.torpedoCharge) * C.TORPEDO_RECHARGE)}s`,
    40,
    176,
    10,
    s.torpedoCharge === 1 ? cyan : muted,
  );
  text(
    ctx,
    `SECTOR / ${String(s.wave).padStart(2, "0")}`,
    1240,
    40,
    13,
    white,
    "monospace",
    "right",
  );
  text(
    ctx,
    `${s.rocks.length} CONTACTS`,
    1240,
    63,
    11,
    muted,
    "monospace",
    "right",
  );
  text(
    ctx,
    "P  PAUSE     M  " + (s.muted ? "SOUND OFF" : "SOUND ON"),
    1240,
    687,
    11,
    muted,
    "monospace",
    "right",
  );
  if (s.waveBanner > 0) {
    text(
      ctx,
      `WAVE ${s.wave}`,
      C.STAR_X,
      C.STAR_Y - 75,
      38,
      white,
      "sans-serif",
      "center",
    );
    text(
      ctx,
      "INCOMING ROCK FIELD",
      C.STAR_X,
      C.STAR_Y - 48,
      11,
      amber,
      "monospace",
      "center",
    );
  }
  if (s.extraLifeBanner > 0)
    text(
      ctx,
      "+1 SHIP / REINFORCEMENT",
      C.STAR_X,
      110,
      18,
      cyan,
      "monospace",
      "center",
    );
}
function menu(s: S, ctx: Ctx) {
  for (const [i, item] of menuItems(s).entries()) {
    const r = menuRect(s, i)!;
    const on = i === s.menuIndex;
    ctx.fillStyle = on ? "#153038" : "#0b151d";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = on ? cyan : "#26353d";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (on) {
      ctx.fillStyle = cyan;
      ctx.fillRect(r.x, r.y, 3, r.h);
    }
    text(ctx, item, r.x + 22, r.y + 31, 15, on ? white : muted);
    text(
      ctx,
      on ? "↗" : "—",
      r.x + r.w - 25,
      r.y + 31,
      18,
      on ? cyan : muted,
      "monospace",
      "center",
    );
  }
}
export function render(s: S, api: RenderApi): void {
  const ctx = api.ctx;
  background(ctx);
  if (s.screen === "title") {
    well(ctx, s.simTime);
    ctx.save();
    ctx.translate(335, 0);
    for (const [i, x, y] of [
      [1, 575, 175],
      [2, 755, 475],
      [3, 390, 568],
      [4, 825, 290],
    ])
      rock(ctx, {
        id: i,
        x,
        y,
        vx: 0,
        vy: 0,
        size: i % 2 ? "large" : "medium",
        health: i % 2 ? 3 : 2,
        spin: s.simTime * 0.09 + i,
        flash: 0,
      });
    vessel(ctx, 555, 370, -0.65, 1.6, true);
    ctx.restore();
    ctx.fillStyle = "#070d14da";
    ctx.fillRect(0, 0, 525, C.FIELD_H);
    text(ctx, "S H A T T E R   /   W A R H E A D", 100, 113, 11, amber);
    line(ctx, 100, 134, 166, 134, amber, 2);
    text(ctx, C.TITLE_TEXT, 94, 265, 88, white, "sans-serif");
    text(ctx, C.TAGLINE_TEXT, 100, 304, 15, cyan);
    text(ctx, "BEND THE SHOT.", 100, 352, 13, muted);
    text(ctx, "BREAK THE FIELD.", 100, 374, 13, muted);
    menu(s, ctx);
    text(ctx, "ARROWS / WASD   PILOT", 100, 589, 11, muted);
    text(ctx, "SPACE   FIRE     F   TORPEDO", 100, 614, 11, muted);
    text(ctx, "01 / INERTIA IS YOUR ALLY", 100, 681, 10, muted);
    text(
      ctx,
      "A SINGLE SHIP. AN UNSTABLE ORBIT.",
      1180,
      681,
      10,
      muted,
      "monospace",
      "right",
    );
    text(ctx, "GRAVITATIONAL ANOMALY", 834, 110, 10, amber);
    line(ctx, 834, 122, 950, 122, "#72533b");
    return;
  }
  if (s.screen === "howto") {
    text(ctx, "FLIGHT MANUAL / 01", 100, 88, 12, amber);
    text(ctx, "MAKE GRAVITY WORK FOR YOU.", 96, 151, 43, white, "sans-serif");
    const paragraphs = [
      [
        "01",
        "SHATTER THE FIELD",
        "Break every rock, then its fragments, to clear a wave.",
        "Larger rocks wear armor. Cracks reveal how close they are to breaking.",
      ],
      [
        "02",
        "READ THE WELL",
        "The star bends bullets and rocks, but never your ship. Curve your shots.",
        "Swallowed rocks return from an edge. The solid core absorbs your weapons.",
      ],
      [
        "03",
        "COMMIT THE WARHEAD",
        "F launches one guided torpedo. Recharge: ten seconds.",
        "It seeks the nearest rock or saucer in a narrow forward cone, ignores gravity,",
        "and destroys any rock outright. Watch for the hunting saucer.",
      ],
    ];
    paragraphs.forEach(([n, title, ...rows], i) => {
      const y = 221 + i * 117;
      text(ctx, n, 100, y, 16, cyan);
      text(ctx, title, 150, y, 17, white);
      rows.forEach((row, j) => text(ctx, row, 150, y + 27 + j * 22, 13, muted));
    });
    line(ctx, 100, 569, 1180, 569, "#293942");
    text(
      ctx,
      "ARROWS / WASD  TURN + THRUST     SPACE  FIRE     F  TORPEDO",
      100,
      602,
      13,
      cyan,
    );
    text(
      ctx,
      "P / ESC  PAUSE     M  SOUND     ENTER / SPACE  CONFIRM",
      100,
      630,
      13,
      muted,
    );
    text(ctx, "ENTER / ESC   RETURN TO MENU", 100, 680, 12, white);
    return;
  }
  field(s, ctx);
  hud(s, ctx);
  if (s.screen === "paused" || s.screen === "gameover") {
    ctx.fillStyle = "#070d14d9";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    text(
      ctx,
      s.screen === "paused" ? "FLIGHT SUSPENDED" : "SIGNAL LOST",
      C.STAR_X,
      229,
      12,
      amber,
      "monospace",
      "center",
    );
    text(
      ctx,
      s.screen === "paused" ? "PAUSED" : "GAME OVER",
      C.STAR_X,
      299,
      60,
      white,
      "sans-serif",
      "center",
    );
    text(
      ctx,
      `SCORE ${String(s.score).padStart(6, "0")}   /   WAVE ${s.wave}`,
      C.STAR_X,
      339,
      14,
      muted,
      "monospace",
      "center",
    );
    menu(s, ctx);
  }
}
