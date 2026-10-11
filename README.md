# Shatter / Warhead

An original browser space shooter built around a gravity well. Pilot an inertial ship through a wrapping rock field, curve shots around the star, chip through armor, and finish dangerous targets with a guided torpedo. Clear every fragment to advance. A hunting saucer keeps the field unpredictable.

All graphics and sound are generated locally. No accounts, services, downloads, or art assets are needed at runtime.

## Run

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To build the static site:

```sh
npm run build
```

Serve `dist/` from any static web server, including under a subpath. `npm run preview` previews the production build locally.

## Controls

| Key | Action |
| --- | --- |
| Up / W | Thrust |
| Left / A, Right / D | Turn |
| Space | Fire; hold for repeated shots |
| F | Launch guided torpedo; ten-second recharge |
| P / Escape | Pause or resume |
| M | Toggle sound |
| Up / Down or W / S | Select a menu entry |
| Enter / Space | Confirm |
| Escape | Return from a menu |
| Backtick | Toggle the read-only diagnostic overlay |

Menus also support mouse and touch. The engine supplies on-screen controls on touch devices. Down / S does not brake the ship: turn and thrust against your momentum.

Large rocks take three gun hits; medium rocks take two. A torpedo destroys either outright and throws its fragments along its flight path. The star pulls rocks and bullets, absorbs weapons at its core, and returns swallowed rocks from a field edge. Your ship slides safely along the core.

## Checks

```sh
npx tsc --noEmit
npx eslint .
npx prettier --check .
npx vitest run --coverage
```

Tests use the actual engine with a counted clock and a canvas in Node. Coverage reports are written to `coverage/`.

The simulation runs at 120 Hz independently of rendering. `src/game.ts` exports the state and game contract; `physics.ts` handles simulation, `runtime.ts` handles engine input and audio, `debug.ts` implements the complete state-pose surface, and `render.ts` draws the field and screens. Debug operations are available only from an engine instance's `debug` property. They take an immutable state and return the next one; no page globals are installed.

See `showcase/` for screenshots and a captured draw-command replay of live play.
