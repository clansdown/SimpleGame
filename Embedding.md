# Embedding SimpleGame

SimpleGame can be embedded into any Svelte 5 + TypeScript project. The engine
talks to a `<canvas>` element and a debug `<div>`; everything else is plain
TypeScript.

---

## Minimal Setup

Provide a canvas and a debug div, then call `initEngine`:

```svelte
<script lang="ts">
    import { onMount } from "svelte";
    import { initEngine } from "./lib/simplegame";

    let canvas: HTMLCanvasElement;
    let debug: HTMLDivElement;

    onMount(() => {
        initEngine(canvas, debug, false);
    });
</script>

<main>
    <canvas bind:this={canvas} width={1000} height={1000} style="width: 100%; height: 100%;" contenteditable="true"></canvas>
    <div bind:this={debug}></div>
</main>
```

The third argument (`clickToBegin`) controls whether the engine shows a
"Click to Begin" screen and waits for user input before starting the game loop.
The fourth argument (`setupFn`) lets you provide your own setup function instead
of the one in `game.ts`.

---

## The `clickToBegin` Parameter

```typescript
initEngine(canvas, debugDiv, clickToBegin = true, setupFn = defaultSetup)
```

| Param | Default | Behaviour |
|---|---|---|
| `clickToBegin` | `true` | Draws a "Click to Begin" screen and blocks the game loop until the user clicks anywhere on the canvas. Pass `false` to start immediately. |
| `setupFn` | from `game.ts` | Your own setup function, called after the engine initialises and before the game loop begins. |

---

## Controlling the Game

Pass your own setup function as the fourth argument to `initEngine`:

```typescript
import { initEngine, setBoardSize, whenLoaded, everyTick } from "./lib/simplegame";

function mySetup() {
    setBoardSize(1000, 1000);

    whenLoaded(() => {
        everyTick((delta_t) => {
            console.log("tick", delta_t);
        });
    });
}

onMount(() => {
    initEngine(canvas, debug, false, mySetup);
});
```

If you don't pass a setup function, `initEngine` uses the one exported from
`game.ts` (the default entry point).

---

## Lifecycle Hooks

| Function | Description |
|---|---|
| `whenLoaded(fn)` | Fires once when all game classes have loaded their images. |
| `everyTick(fn)` | Registers a callback invoked every frame (~40 fps). |
| `periodically(seconds, fn)` | Registers a callback invoked at a fixed interval. |
| `onPause(fn)` | Fires when the game is paused (p key). |
| `onResume(fn)` | Fires when the game resumes. |

---

## Canvas Lifecycle

If you need to swap canvases at runtime (e.g. switching screens):

```typescript
import { setCanvas, attachEventListeners, removeEventListeners } from "./lib/simplegame";

// Detach from the old canvas
removeEventListeners();

// Attach to a new canvas
setCanvas(newCanvas);
// attachEventListeners() is called inside setCanvas()
```

---

## Cleanup

To reset the engine entirely (all objects, players, enemies, etc.):

```typescript
import { clear } from "./lib/simplegame";

clear();
```

This empties every game collection and resets the camera position.

---

## Public API Reference

### Engine (`simplegame.ts`)

| Export | Kind | Description |
|---|---|---|
| `initEngine(canvas, debugDiv, clickToBegin?, setupFn?)` | function | Boot the engine. Must be called once. |
| `setCanvas(newCanvas)` | function | Swap the rendering canvas. |
| `attachEventListeners()` | function | Bind keyboard/mouse to the current canvas. |
| `removeEventListeners()` | function | Unbind keyboard/mouse from the current canvas. |
| `setBoardSize(width, height)` | function | Set the virtual world size. |
| `setSize(width, height)` | function | Alias for `setBoardSize`. |
| `setCameraFollowsPlayer(follows)` | function | Toggle camera tracking. |
| `setBackground(tiles, whenLoaded?)` | function | Set tiled background from image URLs. |
| `clear()` | function | Remove all game objects and reset state. |
| `debug(text)` | function | Write to the debug div. |
| `getMousePosition()` | function | Get current mouse coordinates on the board. |
| `everyTick(fn)` | function | Register a per-frame callback. |
| `periodically(seconds, fn)` | function | Register a timed callback. |
| `whenLoaded(fn)` | function | Callback when all images are loaded. |
| `onPause(fn)` / `onResume(fn)` | function | Pause/resume hooks. |
| `onKeyDown(key, fn)` / `onKeyUp(key, fn)` | function | Keyboard input hooks. |
| `onMouseClick(button, fn)` | function | Mouse click hook. |
| `gameObjects` | `Set<GameObject>` | All active game objects. |
| `players` | `Player[]` | Active players. |
| `enemies` | `Set<Enemy>` | Active enemies. |
| `projectiles` | `Set<Projectile>` | Active projectiles. |
| `items` | `Set<Item>` | Active items. |
| `boardWidth` / `boardHeight` | `number` | Current board dimensions. |

### Game Classes (`gameclasses.ts`)

| Export | Kind | Description |
|---|---|---|
| `GameObjectClass` | class | Base class for object types (defines image, defaults). |
| `PlayerClass` / `Player` | class | Player-controllable object. |
| `EnemyClass` / `Enemy` | class | Enemy object with hitpoints. |
| `ProjectileClass` / `Projectile` | class | Projectile object. |
| `ItemClass` / `Item` | class | Collectible / neutral object. |
| `EffectClass` / `Effect` | class | Visual effect (animated, auto-destroy). |
| `TextClass` / `Text` | class | Text overlay. |
| `createText(text, pos)` | function | Convenience factory for `Text`. |

### Utilities (`util.ts`)

| Export | Description |
|---|---|
| `vec2` | `[number, number]` tuple type. |
| `matrix2` | `[number, number, number, number]` tuple type. |
| `box2` | Object with `x`, `y`, `width`, `height`. |
| `Position2D` | Object with `x`, `y`. |
| `generate_rotation_matrix(radians)` | Build a 2×2 rotation matrix. |
| `scaleVector(v, scale)` | Scale a vector. |
| `dotProduct(v1, v2)` | Dot product. |
| `multiplyMatrixVector(m, v)` | Apply matrix to vector. |
| `multiplyMatrices(m1, m2)` | Multiply two matrices. |
| `transpose_matrix(m)` | Transpose a 2×2 matrix. |
| `applyMatrixToBox(m, b)` | Transform a box by a matrix. |
| `midpoint(o1, o2)` | Midpoint of two positions. |

### Audio (`audio.ts`)

| Export | Description |
|---|---|
| `Music(url)` | Looping background music. |
| `SoundEffect(url)` | One-shot sound effect. |

### UI (`button.ts`, `layout.ts`)

| Export | Description |
|---|---|
| `ButtonClass` / `Button` | Clickable button with text and optional image. |
| `Row` | Horizontal layout container. |
| `Column` | Vertical layout container. |
| `Page` | Page with optional border. |
| `ScrollablePage` | Scrollable page container. |
