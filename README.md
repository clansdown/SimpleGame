# SimpleGame

A simple TypeScript-based 2D game engine for browser games, built on Svelte 5.

SimpleGame is primarily a teaching tool: it makes it easy to write small
programs that do fun things with immediate feedback. It ships with two sample
games — Brick Breaker and Space Fighter — that beginners can read and modify.

## Features

- **Sprites & game objects** — players, enemies, projectiles, items, effects, text
- **Movement** — `moveTo` with deceleration, circular orbits (`circleAround`), keyboard input
- **Collision detection** — quadtree-based, class-level and instance-level handlers
- **Camera** — player-following, manual `setCameraPosition`, drag-to-pan, pinch/scroll zoom
- **UI** — buttons, toggle buttons, layout containers (rows, columns, pages), tooltips
- **Effects** — fade in/out, grow, damage sprites, drop shadows, progress bars
- **Audio** — looping music and one-shot sound effects
- **HUD** — screen-space game objects that stay fixed while the world scrolls

## Running

```bash
cd ui
npm install
npm run dev        # start the dev server (hot reload)
npm run build      # production build
npm run check      # type-check (svelte-check + tsc)
```

## Layout

```
ui/src/
├── main.ts                    # App entry point (mounts App.svelte)
├── game.ts                    # Game entry point — setup() selects a sample game
├── App.svelte                 # Root Svelte component (canvas + debug div)
├── lib/
│   ├── simplegame.ts          # Engine: game loop, events, camera, input, drawing
│   ├── gameclasses.ts         # GameObject and subclasses (Player, Enemy, Projectile, …)
│   ├── collision.ts           # Quadtree collision detection
│   ├── audio.ts               # Music and SoundEffect
│   ├── button.ts              # Button, ToggleButton, layout helpers
│   ├── layout.ts              # Row, Column, Page, ScrollablePage
│   ├── overlay.ts             # Polygon overlay with cutouts
│   └── util.ts                # Vec/matrix math types and functions
├── brickbreaker_sample.ts     # Sample game: Brick Breaker
└── spacefighter_sample.ts     # Sample game: Space Fighter
```

## Quick start

```typescript
import { initEngine, setBoardSize, whenLoaded, everyTick } from "./lib/simplegame";

function mySetup() {
    setBoardSize(1000, 1000);

    whenLoaded(() => {
        everyTick((delta_t) => {
            // per-frame game logic
        });
    });
}

onMount(() => {
    initEngine(canvas, debugDiv, false, mySetup);
});
```

## Documentation

The full API reference — including every engine function, `GameObject` feature,
and UI component — is in [`Embedding.md`](./Embedding.md).
