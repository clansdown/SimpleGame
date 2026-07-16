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
| `onPause(fn)` | Fires when the game is paused (`pauseGame()`, `togglePause()`, or p key). |
| `onResume(fn)` | Fires when the game resumes (`resumeGame()`, `togglePause()`, or p key). |
| `afterDraw(fn)` | Registers a callback that runs after game objects are drawn each frame. Receives `(ctx, offsetX, offsetY)`. |

---

### Pause / Resume (programmatic)

| Function | Description |
|---|---|
| `pauseGame()` | Pause the game loop immediately. No-op if already paused. |
| `resumeGame()` | Resume the game loop immediately. No-op if already running. |
| `togglePause()` | Toggle between paused and running. |
| `isPaused()` | Returns `true` if the game is currently paused. |

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
| `setBackground(tiles, whenLoaded?)` | function | Set background from image URLs. |
| `setBackgroundMode(mode)` | function | `"tile"` (default, scrolls with camera) or `"stretch"` (fills viewport, no scroll). |
| `clear()` | function | Remove all game objects and reset state. |
| `debug(text)` | function | Write to the debug div. |
| `getMousePosition()` | function | Get current mouse coordinates on the board. |
| `everyTick(fn)` | function | Register a per-frame callback. |
| `periodically(seconds, fn)` | function | Register a timed callback. |
| `whenLoaded(fn)` | function | Callback when all images are loaded. |
| `onPause(fn)` / `onResume(fn)` | function | Pause/resume hooks. See also `pauseGame`, `resumeGame`, `togglePause`, `isPaused`. |
| `pauseGame()` / `resumeGame()` | function | Programmatic pause/resume. |
| `togglePause()` | function | Toggle pause state. |
| `isPaused()` | function | Returns `boolean` — `true` if the game is paused. |
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
| `GameObjectClass` | class | Base class for object types (defines image, defaults). `defaultSingleCollisionOnly` sets the default for spawned instances. |
| `GameObject` | class | Base game object. Provides `onClick`, `onMouseDown`, `onMouseUp`, `onMouseOver`, `onMouseOut`, `onArrival`, `logMovement`. Supports sprite mirroring with `mirrorOnDirection` / `spriteForwardVector`. `singleCollisionOnly` stops collision checks after the first hit per frame. `visible` controls both rendering and interaction (hiding a container hides all attached children). |
| `PlayerClass` / `Player` | class | Player-controllable object. |
| `EnemyClass` / `Enemy` | class | Enemy object with hitpoints. |
| `ProjectileClass` / `Projectile` | class | Projectile object. Has `alignToTravel` (default `true`) which recalculates facing direction from actual movement each frame. |
| `ItemClass` / `Item` | class | Collectible / neutral object. |
| `EffectClass` / `Effect` | class | Visual effect (animated, auto-destroy). |
| `TextClass` / `Text` | class | Text overlay with highlight, drop shadow, alignment, and inline image support (`{img:name}` syntax). |
| `createText(text, pos, inlineImages?)` | function | Convenience factory for `Text`. |
| `InlineImageDef` | interface | `{ image: HTMLImageElement \| string, width: number, height: number }` — inline image definition. |
| `InlineImageMap` | type | `Record<string, InlineImageDef>` — map of identifiers to inline image definitions. |

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
| `ButtonClass` / `Button` | Clickable button with text, optional icon & background image. Has built-in hover highlight, click press indication, disabled state, and configurable icon layout (`IconLayout` type). |
| `IconLayout` | `"left" \| "right" \| "above" \| "below"` — icon position relative to text. |
| `ButtonOptions` | Optional config object for `ButtonClass.spawn()`: `width`, `height`, `backgroundImage`, `color`, `iconWidth`, `iconHeight`, `iconPadding`, `iconLayout`, `backgroundOpacity`. |
| `Row` | Horizontal layout container. |
| `Column` | Vertical layout container. |
| `Page` | Page with optional border. |
| `ScrollablePage` | Scrollable page container. |

---

## Buttons

### Creating a button

Buttons auto-size to fit their content (icon + text). Provide `width` / `height` in `ButtonOptions` to override.

```typescript
import { ButtonClass } from "./lib/button";

const buttonClass = new ButtonClass("btn");

// Auto-sized text-only button
buttonClass.spawn(100, 100, "Play");

// Auto-sized with icon above text (default layout)
buttonClass.spawn(100, 100, "Settings", "gear.png");

// Override width (uniform buttons), let height auto-compute
buttonClass.spawn(100, 100, "OK", "check.png", {
    width: 120,
});

// Full control
buttonClass.spawn(
    100, 100,
    "Click Me",
    "icon.png",
    {
        width: 140,
        height: 60,
        color: "#A0A080",
        iconLayout: "left",
        iconWidth: 20,
        iconHeight: 20,
        iconPadding: 10,
        backgroundOpacity: 0.85,
    },
);
```

### Icon layout

The icon can be positioned relative to the text:

| Layout  | Description |
|---------|-------------|
| `"above"` (default) | Icon above text, centred horizontally |
| `"below"` | Icon below text, centred horizontally |
| `"left"` | Icon to the left of text, vertically centred |
| `"right"` | Icon to the right of text, vertically centred |

Set via `ButtonOptions` on spawn or at runtime:

```typescript
button.setIconLayout("right");
button.setIconWidth(24);
button.setIconHeight(24);
button.setIconPadding(12);
```

### Auto-sizing

Buttons compute their own size from content. The auto-size logic uses these
approximations for 16px Arial:

| Constant | Value | Used for |
|---|---|---|
| `EST_CHAR_WIDTH` | 8px | Average character width |
| `EST_TEXT_HEIGHT` | 20px | Line height |
| `CONTENT_PAD` | 12px | Minimum edge padding |

When you provide `width` or `height` in `ButtonOptions`, it overrides that
dimension (the other still auto-computes). Useful for uniform-width buttons.

The button will never shrink below 40×30 pixels.

### Background opacity

Control the transparency of the background layer (fill, image, border) without
affecting the icon, text, or disabled overlay:

```typescript
buttonClass.spawn(100, 100, "Start", "play.png", {
    backgroundOpacity: 0.8,
});
```

Default is `1.0` (fully opaque). Values between `0` and `1` are valid.

### Icon loading fallback

If an icon or background image fails to load, the button logs an error to the
console and substitutes a 1×1 transparent GIF. The icon still reserves layout
space — there's no visual jump when the real image loads.

### Examples

```typescript
// Text-only button (auto-sized)
buttonClass.spawn(100, 100, "Play");

// Icon-only button (auto-sized)
buttonClass.spawn(100, 100, null, "close.png");

// Text + icon with custom layout
buttonClass.spawn(100, 100, "Settings", "gear.png", {
    iconLayout: "left",
    iconWidth: 20,
    iconHeight: 20,
});

// Uniform width, auto height
buttonClass.spawn(100, 200, "Save", "disk.png", { width: 140 });
buttonClass.spawn(100, 400, "Delete", "trash.png", { width: 140 });
```

### Hover & click visuals

Buttons automatically lighten on hover and darken on click. You can customise:

```typescript
button.hoverColor = "#D0D0B0";
button.clickColor = "#707050";
```

For buttons with a `backgroundImage`, hover adds a semi-transparent white overlay and click adds a semi-transparent black overlay.

### Disabled state

Buttons can be disabled to prevent interaction and visually grey them out:

```typescript
button.setDisabled(true);   // greyed out, no clicks, no drags, no hover
button.setDisabled(false);  // normal
```

When disabled: base color is used (no hover/click tints), a 40% gray overlay is drawn, and all mouse events (hover, click, drag) are suppressed via `canDrag()` returning `false`.

### Mouseover events

Any `GameObject` (not just buttons) can listen for hover:

```typescript
obj.onMouseOver(0, () => console.log("mouse entered"));
obj.onMouseOut(0, () => console.log("mouse left"));
```

The `isHovered` boolean is updated every frame for all game objects.

### Button API reference

| Member | Description |
|---|---|
| `setText(text)` | Change the button label. |
| `setOnClick(callback)` | Register a click handler. |
| `setDisabled(disabled)` | Enable/disable the button. |
| `setIcon(iconFile)` | Set or replace the icon image. |
| `setIconWidth(w)` | Icon render width in pixels (default 16). |
| `setIconHeight(h)` | Icon render height in pixels (default 16). |
| `setIconPadding(pad)` | Gap between icon and text (default 8). |
| `setIconLayout(layout)` | `"left"` \| `"right"` \| `"above"` (default) \| `"below"`. |

`ButtonOptions` fields: `width`, `height`, `backgroundImage`, `color`,
`iconWidth`, `iconHeight`, `iconPadding`, `iconLayout`, `backgroundOpacity`.

Buttons auto-size from content. Set `width`/`height` to override. Minimum
40×30. `backgroundOpacity` (default 1.0) controls background layer alpha.

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
| `canDrag()` | method | Override to prevent drag origination. Default returns `true`. `Button` overrides to return `!disabled`. |

---

## Sprite Alignment

The engine automatically aligns the sprite image so its `spriteForwardVector` points in the object's facing direction (`direction_x`, `direction_y`). For side-view games, set `defaultSpriteForwardVector` on the class and enable `mirrorOnDirection` so the sprite flips instead of rotating past 90°.

```typescript
// On the class (all instances inherit):
const ratClass = new EnemyClass("dire_rat", "rat.png");
ratClass.defaultSpriteForwardVector = [1, 0];  // sprite faces right

// On the instance:
const rat = ratClass.spawn(100, 100);
rat.mirrorOnDirection = true;                   // flip when moving left
```

The transform is: compute the signed angle from `spriteForwardVector` to the facing direction. If the angle exceeds ±90° and `mirrorOnDirection` is true, mirror the sprite horizontally and rotate by the residual. Otherwise rotate by the full angle.

### API reference

| Field | Type | Default | Location | Description |
|---|---|---|---|---|
| `defaultSpriteForwardVector` | `vec2` | `[0, -1]` | `GameObjectClass` | The direction the raw sprite image faces. Set once after constructing the class. |
| `spriteForwardVector` | `vec2` | inherited from class | `GameObject` | Per-instance override (rarely needed). |
| `mirrorOnDirection` | `boolean` | `false` | `GameObject` | Enable mirror when the required rotation > 90°. |

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

## Collision Behaviour

### Single collision per frame

Set `singleCollisionOnly` on a game object to stop collision detection after
the first hit each frame. Useful for projectiles so one bullet only hits one
target.

```typescript
const bullet = bulletClass.spawn(x, y);
bullet.singleCollisionOnly = true;

// Or set on the class so all instances inherit it:
bulletClass.defaultSingleCollisionOnly = true;
```

Default is `false` (existing behaviour — one object can collide with multiple
targets per frame).

### API reference

| Field | Type | Default | Location | Description |
|---|---|---|---|---|
| `defaultSingleCollisionOnly` | `boolean` | `false` | `GameObjectClass` | Set once on the class to control the default for spawned instances. |
| `singleCollisionOnly` | `boolean` | inherited from class | `GameObject` | Per-instance override. When `true`, only the first collision per frame fires; remaining checks for that object are skipped. |

---

## Visibility

Set `visible` on any game object to hide it. Invisible objects are not rendered,
cannot be clicked, and do not register as hovered. Hiding a container hides all
attached children automatically via the ancestor-chain check.

```typescript
const panel = new Column(500, 400);
panel.addChild(btn1);
panel.addChild(btn2);

// Hide everything — buttons disappear, no interaction
panel.setVisible(false);

// Show again — everything restored
panel.setVisible(true);
```

### API reference

| Member | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `true` | Set directly or via `setVisible()` on containers. |

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

---

## Orbital (Circular) Movement

Move a game object in a circular orbit around a fixed point or another
game object. The object's position and facing are updated every frame.

```typescript
// Orbit a fixed point — one revolution at race-car tangent facing
const sentry = guardClass.spawn(100, 100);
sentry.circleAround({
    center: { x: 500, y: 300 },
    radius: 150,
    velocity: 100,
    startAngleDeg: 0,
    facing: { x: 1, y: 0 },
    arcDeg: 360,
    onComplete: () => sentry.destroy(),
});
```

```typescript
// Orbit a player — face outward, smooth start, indefinite
drone.circleAround({
    center: player,
    radius: 80,
    velocity: 40,
    startAngleRad: 0,
    facing: { x: 0, y: 1 },
    fadeInTime: 0.5,
});
```

### Arc limits

When `arcDeg` or `arcRad` is set, the object sweeps exactly that angle
and stops (firing `onComplete`). Omit both for indefinite orbiting.

### Fade-in / fade-out

- **fadeInTime**: velocity ramps linearly from 0 to full over the given
  seconds at the start of the orbit.
- **fadeOutTime**: velocity ramps linearly to 0 over the given seconds
  as the object approaches the end of its arc (`arcDeg`/`arcRad` must
  be set). This provides a smooth deceleration into the final position.

### Centre following

When `center` is a `GameObject`, the orbit tracks the centre's position
and rotation every frame. All angles are relative to the centre's local
coordinate system — if the centre rotates, the entire orbit rotates with
it. If the centre is destroyed, the orbit continues around the centre's
last known position.

### Cancellation

Call `cancelCircleAround()` to end the orbit early. The object stays
at its current position. Calling `moveTo()` also cancels the orbit
(and vice versa).

### CircleAroundOptions reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `center` | `Position2D \| GameObject` | (required) | Point or object to orbit. GameObjects are tracked every frame including rotation. |
| `radius` | `number` | (required) | Orbit radius in board units. |
| `velocity` | `number` | (required) | Linear speed along the circular path (board units/sec). |
| `startAngleRad` | `number` | — | Starting angle in radians. 0=right, π/2=down (screen). Ignored if `startAngleDeg` is also set. |
| `startAngleDeg` | `number` | — | Starting angle in degrees. Takes precedence over `startAngleRad`. 0=right. |
| `facing` | `{x: number, y: number}` | `{x: 1, y: 0}` | Direction the object faces in a local frame where x=clockwise tangent, y=radially outward from centre. |
| `fadeInTime` | `number` | `0` | Seconds to ramp velocity from 0 to full at the start. |
| `fadeOutTime` | `number` | `0` | Seconds to ramp velocity to 0 near the end of the arc. Only used when `arcDeg`/`arcRad` is set. |
| `arcRad` | `number` | — | Total arc to sweep in radians. Omit for indefinite orbit. |
| `arcDeg` | `number` | — | Total arc to sweep in degrees. Takes precedence over `arcRad`. Omit for indefinite orbit. |
| `onComplete` | `() => void` | — | Called once after the arc is fully traversed. The object is snapped to the exact final position before the callback fires. |

### Methods

| Method | Description |
|--------|-------------|
| `circleAround(options)` | Start circular orbit. Cancels any active `moveTo`. |
| `cancelCircleAround()` | End orbit immediately. Object stays at current position. |

---

## Text

The `Text` class renders text with optional highlight, drop shadow, alignment,
and inline images.

### Creating text

```typescript
import { createText, InlineImageDef } from "./lib/gameclasses";

// Simple text
const label = createText("Hello World", { x: 100, y: 200 });
label.size = 48;
label.foreground = "#FF0000";
```

### Highlight & shadow

```typescript
label.setHighlight("#FFFF00", 6);             // yellow highlight, 6px padding
label.setShadow("#000000", 4, 2, 2);           // black drop shadow, 4px blur, 2px offset
```

### Alignment

```typescript
label.setTextAlign("center");  // "left" (default), "center", "right"
```

### Inline images

Insert images into text using `{img:name}` syntax. Define the images with
`InlineImageDef` objects specifying the image source and display dimensions:

```typescript
const score = createText(
    "Score: {img:star} 5 / 10",
    { x: 100, y: 300 },
    {
        star: { image: "star.png", width: 24, height: 24 },
    },
);

// Or set at runtime:
score.setInlineImages({
    heart: { image: heartImageElement, width: 20, height: 20 },
    coin:  { image: "coin.png", width: 18, height: 18 },
});
```

When an image source is a string URL, the engine loads it automatically and
falls back to a transparent GIF on error. Layout space is always reserved for
the defined width — no visual jump when the image loads.

### Text API reference

| Member | Description |
|---|---|
| `size` | Font size in px (default 32). |
| `foreground` | Text fill colour (default `"white"`). |
| `setHighlight(color, padding?)` | Enable highlight with given colour and optional padding around text (default 4). |
| `setShadow(color, blur?, offsetX?, offsetY?)` | Enable drop shadow with given colour, blur radius (default 4), and offsets (default 2). |
| `setTextAlign(align)` | `"left"` (default), `"center"`, or `"right"`. |
| `setInlineImages(images)` | Provide `InlineImageMap` for `{img:name}` syntax. |

### Engine API

| Function | Description |
|---|---|
| `setButtonDebugLevel(level)` | Enable `[ButtonDebug]` logs at the given verbosity level. `0` = off, `1` = events, `10` = per-object geometry. |
