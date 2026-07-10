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
| `afterDraw(fn)` | Registers a callback that runs after game objects are drawn each frame. Receives `(ctx, offsetX, offsetY)`. |

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
| `GameObject` | class | Base game object. Provides `onClick`, `onMouseDown`, `onMouseUp`, `onMouseOver`, `onMouseOut`, `onArrival`. |
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
| `ButtonClass` / `Button` | Clickable button with text, optional icon & background image. Has built-in hover highlight and click press indication. |
| `Row` | Horizontal layout container. |
| `Column` | Vertical layout container. |
| `Page` | Page with optional border. |
| `ScrollablePage` | Scrollable page container. |

---

## Buttons

### Creating a button

```typescript
import { ButtonClass } from "./lib/button";

const buttonClass = new ButtonClass("btn");

buttonClass.spawn(
    x, y,                    // position (centre)
    "Click Me",              // text
    120, 50,                 // width, height
    undefined,               // backgroundImage (optional)
    "#A0A080",               // color
    "icon.png"               // iconFile (optional)
);
```

### Hover & click visuals

Buttons automatically lighten on hover and darken on click. You can customise:

```typescript
button.hoverColor = "#D0D0B0";
button.clickColor = "#707050";
```

For buttons with a `backgroundImage`, hover adds a semi-transparent white overlay and click adds a semi-transparent black overlay.

### Icons

Pass an icon file path to `spawn()` or call `setIcon()`:

```typescript
button.setIcon("path/to/icon.png");
```

Adjust icon rendering:

```typescript
button.iconSize = 24;       // default 16
button.iconPadding = 12;    // default 8
```

### Mouseover events

Any `GameObject` (not just buttons) can listen for hover:

```typescript
obj.onMouseOver(0, () => console.log("mouse entered"));
obj.onMouseOut(0, () => console.log("mouse left"));
```

The `isHovered` boolean is updated every frame for all game objects.

---

## Overlays

Overlays render a semi-transparent coloured region with optional cutout holes.
Use them to show placement zones, danger areas, line-of-sight, etc.

### Creating an overlay

```typescript
import { Overlay } from "./lib/overlay";

const zone = new Overlay(
    [
        { x: 100, y: 100 },
        { x: 900, y: 100 },
        { x: 900, y: 900 },
        { x: 100, y: 900 },
    ],
    "rgba(0, 200, 0, 0.25)",
);
```

### Adding cutouts (holes)

```typescript
// Polygon cutout
zone.addCutout([
    { x: 300, y: 300 },
    { x: 500, y: 300 },
    { x: 500, y: 500 },
    { x: 300, y: 500 },
]);

// Rectangular cutout (convenience)
zone.addRectCutout(600, 600, 100, 100);

// Circular cutout (convenience)
zone.addCircleCutout(700, 200, 80, 32);
```

### Drawing

Register an `afterDraw` callback in your setup to render the overlay on
top of all game objects each frame:

```typescript
import { afterDraw } from "./lib/simplegame";

whenLoaded(() => {
    afterDraw((ctx, offsetX, offsetY) => {
        zone.draw(ctx, offsetX, offsetY);
    });
});
```

### Triangulation

If you need the overlay geometry as triangles (e.g. for WebGL or custom
rendering), call `triangulate()`:

```typescript
const triangles = zone.triangulate();
// Each triangle is [Position2D, Position2D, Position2D]
```

The triangulation uses ear-clipping with hole bridging, producing
non-overlapping triangles covering the entire region.

### API reference

| Member | Description |
|---|---|
| `boundary` | The outer polygon vertices. |
| `cutouts` | Array of hole polygons. |
| `color` | Fill colour (any valid CSS `rgba` / `hsla` string). |
| `addCutout(polygon)` | Add a hole defined by a polygon. |
| `addRectCutout(x, y, w, h)` | Add a rectangular hole. |
| `addCircleCutout(cx, cy, r, segments?)` | Add a circular hole (default 24 segments). |
| `draw(ctx, offsetX, offsetY)` | Render the overlay using the canvas `evenodd` fill rule. |
| `triangulate()` | Compute non-overlapping triangles covering the region. |

---

## Dragging

Any `GameObject` can be made draggable. While being dragged, the object's
position follows the mouse cursor automatically.

### Enabling drag

```typescript
const unit = playerClass.spawn(100, 100);
unit.draggable = true;
```

### Drag lifecycle callbacks

```typescript
unit.onDragStart(0, () => console.log("picked up"));
unit.onDrag(0, () => console.log("dragging to", unit.x, unit.y));
unit.onDragEnd(0, () => console.log("dropped at", unit.x, unit.y));
```

The button parameter (here `0` for left mouse button) works the same as
`onMouseDown` / `onMouseUp`.

While dragging the object's `isDragging` property is `true` and its velocity is
set to zero so the engine's movement system doesn't interfere.

### API reference

| Member | Type | Description |
|---|---|---|
| `draggable` | `boolean` | Set to `true` to enable dragging via mouse. |
| `dragFollowsCursor` | `boolean` | Default `true`. Set to `false` to suppress automatic position updates during drag and handle positioning yourself in `onDrag`. |
| `isDragging` | `boolean` | Read-only; `true` while the object is being dragged. |
| `onDragStart(button, handler)` | method | Fires once when drag begins. |
| `onDrag(button, handler)` | method | Fires every frame while dragging. |
| `onDragEnd(button, handler)` | method | Fires when the drag ends (mouse released). |

---

## Arrival Callback

Register a callback to fire when a `moveTo` movement completes:

```typescript
enemy.moveTo({x: 1000, y: 500}, 3.0);
enemy.onArrival(() => {
    console.log("Reached the target!");
    enemy.destroy();
});
```

The callback fires once when the object comes within 0.01 units of its
destination. The object is snapped to the exact destination coordinates
before the callback runs.

### API reference

| Member | Description |
|---|---|
| `onArrival(callback)` | Register a callback that fires when `moveTo` reaches its destination. |

---

## Debug Logging

Enable verbose console logging for all button interactions to diagnose
hover, click, and drag issues:

```typescript
import { setButtonDebugLevel } from "./lib/simplegame";

initEngine(canvas, debug, false, mySetup);
setButtonDebugLevel(1);
```

All logs are prefixed with `[ButtonDebug]` and cover:

| Trigger | Level | Log example |
|---|---|---|
| Button created | 1 | `[ButtonDebug] created text="OK" pos=(500,500) size=120x50 color=#A0A080 hover=#C0C0A0 click=#808060 bg=none icon=none` |
| Frame hover check | 1 | `[ButtonDebug] detectHover: 5 objects, mouse (502.1, 498.3)` |
| Mouse enters button | 1 | `[ButtonDebug] mouseOver: obj=btn at (500, 500)` |
| Mouse leaves button | 1 | `[ButtonDebug] mouseOut: obj=btn` |
| Button-specific hover | 1 | `[ButtonDebug] "OK": mouseOver` / `mouseOut` |
| Button press | 1 | `[ButtonDebug] "OK": mouseDown` / `mouseUp` |
| Button click | 1 | `[ButtonDebug] "OK": click` |
| Drag start | 1 | `[ButtonDebug] dragStart: obj=btn at (500, 500)` |
| Dragging | 1 | `[ButtonDebug] drag: target=btn to (510, 490)` |
| Drag end | 1 | `[ButtonDebug] dragEnd: obj=btn at (510, 490)` |
| Draw (when hovered/clicked) | 1 | `[ButtonDebug] draw "OK" hovered=true clicked=false fill=#C0C0A0` |
| Per-object geometry | 10 | `[ButtonDebug]   obj="btn" pos=(500,500) hitbox=120x50 bounds=[440-560, 475-525] hit=true` |

Set level to `10` to see the full per-object enumeration in `detectHover` and `handleMouseDown`.

### Engine API

| Function | Description |
|---|---|
| `setButtonDebugLevel(level)` | Enable `[ButtonDebug]` logs at the given verbosity level. `0` = off, `1` = events, `10` = per-object geometry. |
