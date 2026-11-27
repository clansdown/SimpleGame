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

## Coordinate System

SimpleGame uses an abstract **board space** for all positions and sizes. The
board is defined by `boardWidth` × `boardHeight` (set via `setBoardSize()`).

- All positions (`GameObject.x`, `GameObject.y`, `createText` coordinates,
  `center` in `circleAround`, etc.) and distances (`radius`, `width`,
  `height`, `padding`, `gutter`, `velocity`) are in **board units**, except for
  objects whose `hud` flag is true (including inherited HUD objects). HUD
  objects use viewport-relative **default-zoom units**, which match board units
  at 1× zoom.
- The canvas is a **viewport** into the board. The engine draws objects at
  `(object.x - windowX, object.y - windowY)` canvas pixels, where
  `windowX`/`windowY` are the current scroll offset.
- By default `windowX = windowY = 0` and the viewport (`windowWidth` ×
  `windowHeight`) matches the canvas resolution, so one board unit equals
  one canvas pixel. Scrolling the viewport, resizing the canvas, or zooming
  breaks this 1:1 mapping.

Board units have no inherent physical scale — you choose what one unit
represents (e.g., 1 pixel, 1 metre, 1 tile).

### Viewport units

There are two distinct viewport measurements:

- `getVisibleBoardBounds()` returns the current camera view in **board units**.
  It changes with panning and zoom.
- `getHudSize()` returns the viewport in **default-zoom HUD units**. It changes
  with canvas resizing, but not with zoom.

The engine observes canvas CSS size by default and updates the logical viewport
on browser resize or orientation change. Disable this for fixed virtual
resolution with `setViewportAutoResize(false)`.

---

## Zoom

Zoom changes how much of the board is visible on screen. It is off by default
and must be enabled explicitly.

```typescript
import { setZoomEnabled, setZoomLevel, getZoomLevel } from "./lib/simplegame";

setZoomEnabled(true);               // enable wheel + pinch zoom (defaults)
setZoomEnabled(true, 0.25, 4.0);    // custom min/max zoom
```

| Function | Description |
|---|---|
| `setZoomEnabled(enabled, min?, max?, step?)` | Enable/disable zoom. Defaults: `min=0.5`, `max=3.0`, `step=0.1`. Disabling resets to 1×. |
| `setZoomLevel(level)` | Set zoom programmatically (clamped to min/max). `1.0` = native. |
| `getZoomLevel()` | Current zoom factor. |

- **Mouse wheel** zooms toward the cursor — the board point under the cursor stays put.
- **Touch pinch** zooms toward the midpoint of the two fingers.
- `setViewportSize(width, height)` sets the base (1×) viewport size and aspect
  ratio; zoom scales from there.

Call `setCameraFollowsPlayer(false)` if you want manual zoom/pan to persist —
otherwise the camera may override it on the next tick.

---

## Board Panning

Drag-to-scroll the viewport with the left mouse button (or a single-finger
touch) on empty board space. Off by default.

```typescript
import { setBoardPanEnabled, setBoardPanRate, isBoardPanning } from "./lib/simplegame";

setCameraFollowsPlayer(false); // prevent the camera fighting manual panning
setBoardPanEnabled(true);      // enable drag-to-pan
setBoardPanRate(1.0);          // 1:1 grip (default); 0.5 = slow, 2.0 = fast
```

| Function | Description |
|---|---|
| `setBoardPanEnabled(enabled)` | Enable/disable panning (default `false`). |
| `setBoardPanRate(rate)` | Pan speed multiplier (default `1.0`). |
| `isBoardPanning()` | `true` while the user is actively dragging the board. |

Panning only starts when the click hits empty space — if a game object is
under the cursor, it receives the click instead.

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
| `everyTick(fn)` | Registers a callback invoked every frame (~40 fps). The callback receives `delta_t` in seconds. |
| `nextTick(fn)` | Registers a one-shot callback to run in the next game tick, after normal tick callbacks and before rendering. Does not run while paused. |
| `periodically(seconds, fn)` | Registers a callback invoked at a fixed interval. |
| `onPause(fn)` | Fires when the game is paused (`pauseGame()`, `togglePause()`, or p key). |
| `onResume(fn)` | Fires when the game resumes (`resumeGame()`, `togglePause()`, or p key). |
| `afterDraw(fn)` | Registers a callback that runs after board objects are drawn each frame (inside the zoom transform, before HUD objects). Receives `(ctx, offsetX, offsetY)`. |

---

### Pause / Resume (programmatic)

| Function | Description |
|---|---|
| `pauseGame()` | Pause the game loop, run `onPause` callbacks, and repaint the frozen frame. No-op before the game has fully started or if already paused. |
| `resumeGame()` | Resume the game loop immediately. No-op if already running. |
| `togglePause()` | Toggle between paused and running. |
| `isPaused()` | Returns `true` if the game is currently paused. |
| `redraw()` | Synchronously repaint the current frame. Works while paused; no-op before the game has started. |

### Repainting while paused and deferred work

`pauseGame()` runs all `onPause` callbacks and then calls `redraw()`. This lets
a pause callback update canvas-drawn UI — labels, overlays, HUD buttons — and
have those changes appear immediately.

`redraw()` runs the normal draw path, including `afterDraw` callbacks,
`drawOverlay` hooks, and progress-bar getters. It is not a cached-frame blit.
Do not call `redraw()` from inside a render callback.

`pauseGame()` is idempotent: once paused, calling it again does nothing. To
update an already-paused menu, change the relevant state and call `redraw()`
explicitly. If an asynchronous operation updates the paused frame later, call
`redraw()` again when it completes.

`pauseGame()` must be called from outside the game loop, such as a keyboard or
mouse event handler, a UI callback, or async code. Calling it from
`everyTick()`, `periodically()`, `nextTick()`, `afterDraw()`, or a draw overlay
will not stop the current loop.

Use `nextTick(fn)` for one-shot work that must happen outside the current tick.
The callback runs after the normal tick and periodic callbacks, but before the
camera update and rendering. Work registered from normal tick callbacks runs on
the following tick. Work registered from `whenLoaded()` or other startup
callbacks runs in the first normal tick, because that is the next tick from the
game loop's perspective. Queued work waits while the game is paused and is
discarded by `clear()` and `destroyEngine()`. Like all in-loop callbacks, it
must not call `pauseGame()`.

```typescript
onPause(() => {
    pauseOverlay.visible = true;
    resumeButton.visible = true;
    // pauseGame() repaints automatically after all onPause callbacks.
});

onPause(() => {
    loadPauseIcon().then(() => {
        pauseIcon.visible = true;
        redraw(); // Repaint again after the asynchronous update.
    });
});

// Already paused: update state, then repaint manually.
resumeButton.setText("Resuming...");
redraw();
```

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

## Destroying the Engine

To completely tear down an embedded SimpleGame instance — stopping the game
loop, removing all DOM event listeners, clearing callbacks, and releasing all
game state — call `destroyEngine()`. After this call the engine is inert; you
must call `initEngine()` again to restart.

```typescript
import { initEngine, destroyEngine } from "./lib/simplegame";

// Svelte: call in onDestroy
// onDestroy(() => { destroyEngine(); });

// React: call in useEffect cleanup
// useEffect(() => {
//     initEngine(canvas, debugDiv);
//     return () => { destroyEngine(); };
// }, []);
```

For resetting game state without tearing down the engine (e.g. restarting a
level), use `clear()` instead. `clear()` keeps the game loop running,
preserves registered callbacks, and keeps event listeners intact. It removes
game objects, resets the camera and viewport offset, drops pending `nextTick()`
work, and clears the layout-participant registry.

`destroyEngine()` resets all internal engine state, disconnects the automatic
viewport observer, removes listeners, clears layout registries, and clears the
input transform. The host-owned `canvas` and `debugElement` references are not
nulled or disposed.

---

## Public API Reference

### Engine (`simplegame.ts`)

| Export | Kind | Description |
|---|---|---|
| `initEngine(canvas, debugDiv, clickToBegin?, setupFn?)` | function | Boot the engine. Must be called once. |
| `setCanvas(newCanvas)` | function | Swap the rendering canvas. Preserves the viewport, repaints a paused frame, and redraws the click-to-begin screen before start. |
| `attachEventListeners()` | function | Bind keyboard/mouse to the current canvas. |
| `removeEventListeners()` | function | Unbind keyboard/mouse from the current canvas. |
| `setBoardSize(width, height)` | function | Set the virtual world size. |
| `setSize(width, height)` | function | Alias for `setBoardSize`. |
| `setCameraFollowsPlayer(follows)` | function | Toggle camera tracking. |
| `setCameraPosition(centerX, centerY)` | function | Centre the viewport on board coordinates. Clamped to board edges. Disable `setCameraFollowsPlayer` first to keep control. |
| `setViewportSize(width, height)` | function | Set canvas resolution and base viewport size (board units at 1× zoom). Also sets the viewport aspect ratio. Re-clamps camera. |
| `setBoardPanEnabled(enabled)` | function | Allow left-click/touch drag on empty space to pan the viewport (default `false`). Opt-in. Caller should also disable `setCameraFollowsPlayer`. |
| `setBoardPanRate(rate)` | function | Pan speed multiplier (default `1.0` = 1:1 grip). `0.5` = slow, `2.0` = fast. |
| `isBoardPanning()` | function | Returns `boolean` — is the board currently being dragged? |
| `setZoomEnabled(enabled, min?, max?, step?)` | function | Enable mouse-wheel and pinch-to-zoom (default `false`). `min`/`max`/`step` default to `0.5`/`3.0`/`0.1`. Disabling resets to 1×. |
| `setZoomLevel(level)` | function | Programmatic zoom (clamped to min/max). `1.0` = native. |
| `getZoomLevel()` | function | Returns current zoom factor (`number`). |
| `getHudSize()` | function | Returns `{ width, height }` in default-zoom HUD units. Does not change with zoom. |
| `getVisibleBoardBounds()` | function | Returns `{ x, y, width, height }` for the current camera viewport in board units. |
| `onViewportResize(fn)` | function | Register a callback for nominal viewport size changes. Returns an unsubscribe function. Zoom-only changes do not fire it. |
| `setViewportAutoResize(enabled)` | function | Enable/disable `ResizeObserver` viewport updates. Default `true`. |
| `setInputTransform(transform)` | function | Map raw client CSS coordinates to canvas-local CSS coordinates. Pass `null` to reset. |
| `registerLayoutParticipant(participant)` | function | Register a custom layout container for engine reflow. Built-in containers register automatically. |
| `setBackground(tiles, whenLoaded?)` | function | Set background from image URLs. |
| `setBackgroundMode(mode)` | function | `"tile"` (default, scrolls with camera) or `"stretch"` (fills viewport, no scroll). |
| `setBackgroundTileSize(width, height)` | function | Tile size in board coordinates for tiled backgrounds. Both dimensions required; images scaled to fit. Tile mode only. |
| `clear()` | function | Remove all game objects, reset camera, discard pending `nextTick()` work, and clear layout participants. Use for level restart. Keeps engine running. |
| `destroyEngine()` | function | Full teardown of internal engine state. Stops loop, removes listeners, disconnects viewport observation, clears callbacks, layout registries, input transform, and game state. `canvas` / `debugElement` references are retained as external host state. Engine must be re-initialised with `initEngine()` afterwards. |
| `debug(text)` | function | Write to the debug div. |
| `getMousePosition()` | function | Get current mouse coordinates on the board. |
| `everyTick(fn)` | function | Register a per-frame callback. The callback receives `delta_t` in seconds; zero-argument callbacks are still valid. |
| `nextTick(fn)` | function | Register a one-shot callback for the next game tick. Runs after normal tick callbacks and before rendering; waits while paused. |
| `periodically(seconds, fn)` | function | Register a timed callback. |
| `whenLoaded(fn)` | function | Callback when all images are loaded. |
| `onPause(fn)` / `onResume(fn)` | function | Pause/resume hooks. See also `pauseGame`, `resumeGame`, `togglePause`, `isPaused`, `redraw`. |
| `pauseGame()` / `resumeGame()` | function | Programmatic pause/resume. `pauseGame()` repaints after pause callbacks and is a no-op before the game has started. |
| `togglePause()` | function | Toggle pause state. |
| `isPaused()` | function | Returns `boolean` — `true` if the game is paused. |
| `redraw()` | function | Synchronously repaint the current frame. Works while paused; no-op before the game has started. |
| `onKeyDown(key, fn)` / `onKeyUp(key, fn)` | function | Keyboard input hooks. |
| `onMouseClick(button, fn)` | function | **Global** mouse click fallback. Fires when no matching object (by z-order targeting) has an `onClick` handler and mouseup occurs within 600ms of mousedown. The handler receives `(event, x, y)` in board coordinates. For per-object clicks, use `obj.onClick()` instead — see [Z-Order](#z-order) for how the topmost handler-owning object is selected. |
| `onButtonDown(btn, fn)` | function | ⚠️ Not yet implemented — no-op stub. |
| `onButtonUp(btn, fn)` | function | ⚠️ Not yet implemented — no-op stub. |
| `afterDraw(fn)` | function | Registers a callback that runs after all board objects are drawn each frame. Receives `(ctx, offsetX, offsetY)` in board coordinates. Runs inside the zoom transform and **before** HUD objects, so HUD elements render on top of `afterDraw` overlays. |
| `clearAfterDraw()` | function | Clear all registered `afterDraw` callbacks. |
| `setButtonDebugLevel(level)` | function | Enable `[ButtonDebug]` logs. `0`=off, `1`=events, `10`=per-object geometry. |
| `collisionActions` | `CollisionAction[]` | Active collision action registry. Read by the engine each frame. |
| `CollisionAction` | class | `{ sourceGameClass, sourceGameObject, targetGameClass, targetGameObject, work }` — internal collision action record. |
| `gameObjects` | `Set<GameObject>` | All active game objects. |
| `players` | `Player[]` | Active players. |
| `enemies` | `Set<Enemy>` | Active enemies. |
| `projectiles` | `Set<Projectile>` | Active projectiles. |
| `items` | `Set<Item>` | Active items. |
| `boardWidth` / `boardHeight` | `number` | Current board dimensions. |

### Game Classes (`gameclasses.ts`)

| Export | Kind | Description |
|---|---|---|
| `GameObjectClass` | class | Base class for object types. Defines image, instance defaults (`defaultSpeed`, `defaultWidth`, `defaultHeight`, `defaultHitpoints`), hitbox defaults (`hitboxWidth`/`hitboxHeight`/`hitboxXOffset`/`hitboxYOffset`), and class-level behaviour (`defaultSingleCollisionOnly`, `defaultSpriteForwardVector`, `defaultSpriteUpVector`, `defaultSpriteAlignmentMode`, `defaultSpriteReflectionHysteresisDeg`). Key methods: `setDefaultSpeed()`, `setBoundingBox()`, `addDamageSprite()`, `onCollisionWith()`, `onDestroy()`. Each class tracks its alive instances in a `gameObjects` Set. |
| `GameObject` | class | Base game object. Provides mouse events (`onClick`, `onMouseDown`, `onMouseUp`, `onMouseOver`, `onMouseOut`), drag (`onDragStart`/`onDrag`/`onDragEnd`), collision registration (`onCollisionWith`, `onCollisionWithParticular`, `onCollisionWithEnemy`), movement (`moveTo`, `move`, `setLocation`, `circleAround`), orientation (`setOrientation`, `setOrientationRadians`, `setOrientationTowards`), life-cycle (`setMaxDuration`, `onDestroy`, `onArrival`), attachments (`attach`/`detach`), layout (`getLayoutWidth`, `getLayoutHeight`, `getLayoutOffsetX`, `getLayoutOffsetY`, `setLayoutMinWidth`, `setLayoutMinHeight`, `invalidateLayout`), and debug (`logMovement`). Key fields: `var` (user data), `speed`/`velocity`/`acceleration`, `width`/`height`, `layoutMinWidth`/`layoutMinHeight`, `visible`, `opacity`, `zIndex`, `draggable`, `hud`, `lockOrientation`, `worldUpVector`, `spriteForwardVector`, `spriteUpVector`, `spriteAlignmentMode`, `spriteReflectionHysteresisDeg`, `boundToBoard`, `destroyIfOffBoard`, `fadeInMillis`/`fadeOutMillis`/`growInMillis`/`growOutMillis`, `maxDurationMillis`, `decelerationDistance`/`decelerationTime`. |
| `PlayerClass` / `Player` | class | Player-controllable object with keyboard input (`enableArrowKeysMovement`, `enableWasdKeysMovement`). Uses `speed` as max cap, `acceleration` as ramp time, and `x_speed`/`y_speed` for axis movement. Overrides `standardMovement = false`. |
| `EnemyClass` / `Enemy` | class | Enemy object with hitpoints. |
| `ProjectileClass` / `Projectile` | class | Projectile object. Has `alignToTravel` (default `true`) which recalculates facing direction from actual movement each frame. |
| `ItemClass` / `Item` | class | Collectible / neutral object. |
| `EffectClass` / `Effect` | class | Visual effect (animated, auto-destroy). |
| `TextClass` / `Text` | class | Text overlay with highlight, drop shadow, alignment, and inline image support (`{img:name}` syntax). Fields: `size` (px), `foreground` (colour). |
| `createText(text, pos, inlineImages?)` | function | Convenience factory — returns `textClass.spawnAt(text, pos, inlineImages)`. |
| `InlineImageDef` | interface | `{ image: HTMLImageElement \| string, width: number, height: number }` — inline image definition. |
| `InlineImageMap` | type | `Record<string, InlineImageDef>` — map of identifiers to inline image definitions. |

### Utilities (`util.ts`)

| Export | Description |
|---|---|
| `vec2` | `[number, number]` tuple type. |
| `matrix2` | `[number, number, number, number]` tuple type. |
| `box2` | 8-number tuple — four corners `[x1, y1, x2, y2, x3, y3, x4, y4]` (top-left, top-right, bottom-right, bottom-left). |
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
| `Music(url)` | Looping background music (loop enabled by default). Methods: `play()`, `setVolume(0–1)`, `setLoop(bool)`, `stop()`, `pause()`. |
| `SoundEffect(url)` | One-shot sound effect. Methods: `play()`. |

### UI (`button.ts`, `layout.ts`)

| Export | Description |
|---|---|
| `ButtonClass` / `Button` | Clickable button with text, optional icon & background image. Has built-in hover highlight (`hoverColor`), click press indication (`clickColor`), disabled state (`disabled`), background alpha (`backgroundOpacity`), rounded corners (`cornerRadius`), configurable foreground text colour (`foregroundColor`), tooltip support, and configurable icon layout (`IconLayout`). |
| `ToggleButtonClass` / `ToggleButton` | Toggle (on/off) button extending `Button`. Two-state with separate colours, text, icons, and callbacks per state. ON state draws a bright border highlight by default. See [ToggleButton API](#togglebutton-api-reference) for full reference. |
| `IconLayout` | `"left" \| "right" \| "above" \| "below"` — icon position relative to text. |
| `ButtonOptions` | Optional config object for `ButtonClass.spawn()`: `width`, `height`, `backgroundImage`, `color`, `iconWidth`, `iconHeight`, `iconPadding`, `iconLayout`, `backgroundOpacity`, `cornerRadius`, `foregroundColor`. |
| `ToggleButtonOptions` | Extends `ButtonOptions`. Adds: `toggled`, `onColor`, `offColor`, `onForegroundColor`, `offForegroundColor`, `onText`, `offText`, `onIcon`, `offIcon`, `onBorderHighlight`, `onBorderHighlightColor`. |
| `LayoutContainer` | Base class for `Row`, `Column`, and `HudLayout`. Provides `padding`, `gutter`, `borderWidth`/`borderColor`, `setJustify()`, `setAlign()`, `setWidth()`/`setHeight()`, `invalidateLayout()`, `addChild()`/`removeChild()`, `layout()`. |
| `LayoutJustify` | Enum: `START`, `CENTER`, `END`, `SPACE_BETWEEN`, `SPACE_AROUND`. |
| `LayoutAlign` | Enum: `START`, `CENTER`, `END`, `STRETCH`. |
| `Row` | Horizontal layout container. Supports optional wrapping with `setWrap()`, `setLineGap()`, and `setMaxWidth()`. |
| `Column` | Vertical layout container. |
| `Page` | Board-space page with `topRow`, `bottomRow`, `leftColumn`, `rightColumn`, `centerColumn` sub-containers. Participates in reflow. |
| `ScrollablePage` | Board-space scrollable page with top/bottom/left/right regions and `setContentHeight()` / `scroll()`. |
| `HudLayout` | Viewport-relative HUD border layout with `top`, `bottom`, `left`, `right`, and free-form `center` regions. See `hud-layout.ts`. |
| `ScrollablePage` | Scrollable page container with `scrollOffset`, `scrollbar`, `setContentHeight()`, `scroll(delta)`. |

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

### Tooltips

Any `GameObject` can be used as a tooltip on a button. The tooltip appears when
hovering over the button for 1 second, or when pressing and holding the button
for 1 second without dragging.

```typescript
const label = textClass.spawnAt(0, 0, "Save your progress");
label.zIndex = 100;
saveButton.setTooltip(label);

// Customise timing
saveButton.setTooltipDelay(1000);           // 1s before showing (default)
saveButton.setTooltipFadeDuration(200);     // fade in/out over 200ms (default)
```

Behaviour:
- **Show**: Hover for 1s, or press-and-hold for 1s (no drag)
- **Hide**: Release mouse, move cursor away, or start dragging
- **Fade**: Fades in/out over the configured duration
- **Position**: Centered below the button, updated every frame

The caller supplies any `GameObject` — the button only manages `visible`,
`opacity`, `x`, and `y`. You control appearance (size, colour, zIndex, etc.).

### Mouseover events

Any `GameObject` (not just buttons) can listen for hover:

```typescript
obj.onMouseOver(0, () => console.log("mouse entered"));
obj.onMouseOut(0, () => console.log("mouse left"));
```

The `isHovered` boolean is updated every frame for all game objects.

### Button API reference

| Member | Description |
|---|---|---|
| `setText(text, options?)` | Change the button label. Fixed-size buttons normally do not invalidate layout. |
| `setOnClick(callback)` | Register a click handler. |
| `setDisabled(disabled)` | Enable/disable the button. |
| `setIcon(iconFile)` | Set or replace the icon image. |
| `setIconWidth(w)` | Icon render width in pixels (default 16). |
| `setIconHeight(h)` | Icon render height in pixels (default 16). |
| `setIconPadding(pad)` | Gap between icon and text (default 8). |
| `setIconLayout(layout)` | `"left"` \| `"right"` \| `"above"` (default) \| `"below"`. |
| `setBackgroundColor(color)` | Change background colour and re-derive hover/click variants. |
| `setForegroundColor(color)` | Change text colour. |
| `setBackgroundOpacity(opacity)` | Background opacity 0–1. |
| `setCornerRadius(radius)` | Corner rounding in game units. `0` = square (default). |
| `setTooltip(obj)` | Assign any `GameObject` as the tooltip (or `null` to remove). |
| `setTooltipDelay(ms)` | Milliseconds of hover/press before tooltip appears (default 1000). |
| `setTooltipFadeDuration(ms)` | Fade in/out duration in ms (default 200). |

**Settable fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hoverColor` | `string` | auto-derived | Colour when hovered (auto-brightened from `color`). |
| `clickColor` | `string` | auto-derived | Colour when pressed (auto-darkened from `color`). |
| `disabled` | `boolean` | `false` | When `true`, suppresses all interaction and draws a 40% gray overlay. |
| `backgroundOpacity` | `number` | `1` | Opacity of the background fill/image (0–1). Multiplied by `opacity` at draw time. |
| `cornerRadius` | `number` | `0` | Radius for rounded button corners in game units. `0` = square. |
| `foregroundColor` | `string` | `"#000000"` | Text colour (CSS string). |

`ButtonOptions` fields: `width`, `height`, `backgroundImage`, `color`,
`iconWidth`, `iconHeight`, `iconPadding`, `iconLayout`, `backgroundOpacity`,
`cornerRadius`, `foregroundColor`.

Buttons auto-size from content. Set `width`/`height` to override. Minimum
40×30. `backgroundOpacity` (default 1.0) controls background layer alpha.

### ToggleButton API reference

| Member | Description |
|--------|-------------|
| `toggle()` | Flip the state and fire the matching callback. |
| `setToggled(state)` | Set state (`true`=ON, `false`=OFF) without firing callbacks. |
| `setOnToggleOn(callback)` | Register callback for ON transition. |
| `setOnToggleOff(callback)` | Register callback for OFF transition. |
| `setOnColor(color)` | Set ON-state background colour and re-derive hover/click variants. |
| `setOffColor(color)` | Set OFF-state background colour and re-derive hover/click variants. |
| `setOnForegroundColor(color)` | Set ON-state text colour. |
| `setOffForegroundColor(color)` | Set OFF-state text colour. |
| `setOnText(text)` | Override label text for ON state. Omit to use base text. |
| `setOffText(text)` | Override label text for OFF state. Omit to use base text. |
| `setOnIcon(file)` | Load icon for ON state. Omit to use base icon. |
| `setOffIcon(file)` | Load icon for OFF state. Omit to use base icon. |
| `setOnBorderHighlight(on)` | Enable/disable the bright border accent on ON state (default `true`). |

**Settable fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `toggled` | `boolean` | `false` | Current state (`true`=ON, `false`=OFF). Read directly; use `toggle()` or `setToggled()` to change it. |
| `onColor` | `string` | `"#4060A0"` | ON background colour. |
| `offColor` | `string` | `"#707088"` | OFF background colour. |
| `onBorderHighlight` | `boolean` | `true` | Draw a bright 3px border accent in ON state. |
| `onBorderHighlightColor` | `string` | `"#60A0F0"` | Colour for the ON-state border accent. |

`ToggleButtonOptions` extends `ButtonOptions` with: `toggled`, `onColor`, `offColor`, `onForegroundColor`, `offForegroundColor`, `onText`, `offText`, `onIcon`, `offIcon`, `onBorderHighlight`, `onBorderHighlightColor`.

```typescript
const toggleBtn = toggleButtonClass.spawn(100, 100, "Music", null, {
    toggled: true,
    onColor: "#40A040",
    offColor: "#804040",
    onText: "Music: ON",
    offText: "Music: OFF",
    onIcon: "icons/sound-on.png",
    offIcon: "icons/sound-off.png",
    cornerRadius: 6,
});
toggleBtn.setOnToggleOn(() => playMusic());
toggleBtn.setOnToggleOff(() => stopMusic());
```

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

## HUD (Screen-Space Objects)

Set `hud = true` on any `GameObject` to position it in viewport-relative
default-zoom coordinates instead of board coordinates. HUD objects stay fixed
on screen regardless of camera movement, zoom, or panning.

```typescript
import { createText } from "./lib/gameclasses";

const healthLabel = createText("HP: 100", { x: 10, y: 10 });
healthLabel.hud = true;    // (10, 10) is now a viewport-relative HUD unit
healthLabel.zIndex = 100;  // high z so it sits above board objects
```

HUD objects:

- Are drawn **after** all board objects (always on top) and after `afterDraw` callbacks.
- Receive mouse input **before** board objects (highest `zIndex` first).
- Ignore the zoom transform — they render at native canvas scale.
- Use **default-zoom board units** as their coordinate unit. At 1× zoom this is
  the same as board units and canvas pixels; zooming the board does not resize
  the HUD.
- Inherit HUD status through `attachedTo`. Setting `hud = true` on one container
  makes all attached descendants HUD.
- Are excluded from board collision detection.
- Support the full `GameObject` feature set: mouse events, dragging, opacity,
  `drawOverlay`, progress bars, tooltips, etc.

> **Note:** HUD objects still run the normal movement system. Avoid
> `boundToBoard` / `destroyIfOffBoard` on HUD objects — they clamp and destroy
> against *board* bounds, not screen bounds.

### HUD and viewport sizes

Use `getHudSize()` for HUD layout. It returns default-zoom units and does not
change when zoom changes:

```typescript
import { getHudSize, getVisibleBoardBounds } from "./lib/simplegame";

const hudSize = getHudSize();                 // HUD/default-zoom units
const boardView = getVisibleBoardBounds();    // current camera view in board units
```

The canvas is observed automatically by default. A browser resize or phone
orientation change updates the viewport, invalidates layouts, and reflows them.
Disable this for fixed virtual-resolution games:

```typescript
import { setViewportAutoResize } from "./lib/simplegame";

// Safe to call before initEngine() or inside the setup function.
setViewportAutoResize(false);
```

Use `onViewportResize()` to react to nominal viewport changes. It does not fire
for zoom-only changes.

### HUD border layout

`HudLayout` provides viewport-relative top, bottom, left, right, and centre
regions. Top/bottom regions are normally `Row`s and auto-size their height;
left/right regions are normally `Column`s and auto-size their width; the centre
receives the remainder. A free-form `LayoutContainer` region needs an explicit
size for the dimension it should not auto-size.

```typescript
import { HudLayout } from "./lib/hud-layout";
import { Row, Column, LayoutContainer } from "./lib/layout";

const hud = new HudLayout();
hud.setInset(12);
hud.setRegionGap(8);

const top = new Row(0, 0);
top.setWrap(true);
top.setGutter(8);
hud.setTop(top);

const left = new Column(0, 0);
hud.setLeft(left);

const centre = new LayoutContainer(0, 0);
hud.setCenter(centre);
centre.addChild(reticle); // centred at the centre region's origin
centre.addChildAt(label, centre.x + 40, centre.y + 20); // free-form offset

hud.layout();
```

`HudLayout.center` is a free-form `LayoutContainer` by default. To use standard
layout in the centre, pass a `Row` or `Column` to `setCenter()`.

Replacing or clearing a region hides the old region. Setting a region shows the
newly attached region, so `setTop(null)` followed by `setTop(oldRow)` works.
Removed regions can still be reused elsewhere after calling `setVisible(true)`.

Destroying a `HudLayout` destroys its center and regions. Destroying the center
while the HUD is alive creates a fresh default center.

### Input transforms

If the canvas is CSS-rotated or scaled by a host page, provide a pointer
transform. It receives raw client CSS coordinates and must return canvas-local
CSS coordinates in `0..canvas.clientWidth` × `0..canvas.clientHeight`:

```typescript
import { setInputTransform } from "./lib/simplegame";

setInputTransform(({ x, y }) => {
    return { x: x - canvasRect.left, y: y - canvasRect.top };
});
```

Pass `null` to restore the default `getBoundingClientRect()` mapping.

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

Every game object has a local sprite frame:

- `spriteForwardVector` — the direction the raw image faces.
- `spriteUpVector` — which side of the raw image is its "up" or head side.

The engine maps that local frame onto the object's world-space facing
direction on every draw. `spriteAlignmentMode` selects how the mapping is
performed. Only rotation and reflection preserve the sprite's shape; modes
that try to satisfy two independent axes can shear or non-uniformly scale it.

### Alignment modes

| Mode | Shape preserved | Uses `spriteUpVector` | Uses `worldUpVector` | Typical use |
|---|---|---|---|---|
| `"head-up"` (default) | Yes | Yes, for reflection parity | Yes, preferred up | Side-view games, characters that should stay upright where possible |
| `"rotate"` | Yes | No | No | Top-down games where sprites simply rotate to face movement |
| `"transform"` | No | Yes, as an independent axis | Yes, as an independent axis | Opt-in legacy/effects mode; can shear and shrink/stretch |

`"head-up"` rotates the sprite to face its movement direction, then optionally
reflects it across its forward axis so its up side points as close to
`worldUpVector` as rotation/reflection allow. Reflection parity is stabilised
by a hysteresis deadband, so near-vertical movement does not rapidly toggle
between mirror images.

`"rotate"` applies only the rotation that maps `spriteForwardVector` onto the
facing direction. It never reflects, and it ignores both up vectors. This is
the usual choice for tower-defence mobs or other top-down art that should spin
freely.

`"transform"` is the original engine behaviour: it solves a linear system that
maps forward to the facing direction and up to `worldUpVector`
simultaneously. It is not a true perspective transform, but because two
independent axes overconstrain the mapping, it can shear and scale the sprite
non-uniformly. It is most visible near vertical movement, where the sprite can
collapse to a few pixels wide. Use it only when that effect is desired.

### Configuring the raw sprite frame

```typescript
// On the class (all instances inherit):
const ratClass = new EnemyClass("dire_rat", "rat.png");
ratClass.defaultSpriteForwardVector = [1, 0];   // sprite faces right
ratClass.defaultSpriteUpVector      = [0, -1];  // top of image = head

// On an instance (override per-object):
const rat = ratClass.spawn(100, 100);
rat.spriteForwardVector = [-1, 0];  // this one faces left
rat.worldUpVector       = [0, 1];   // ceiling walk
```

### Choosing a mode

```typescript
// Right-facing tower-defence art: default "head-up" keeps it upright
// when possible and reflects correctly when reversing.
const mobClass = new EnemyClass("mob", "mob.png");
mobClass.defaultSpriteForwardVector = [1, 0];
mobClass.defaultSpriteUpVector      = [0, -1];

// Pure rotation for a top-down game:
mobClass.defaultSpriteAlignmentMode = "rotate";

// Legacy independent-axis transform (can shear/shrink):
mobClass.defaultSpriteAlignmentMode = "transform";
```

### World up direction

The `worldUpVector` is set automatically by `moveTo` and `circleAround`
(default screen-up `[0, -1]`, or radially outward for orbits). You can pass a
custom `up` vector to either call for ceiling-walking, wall-clinging, or
inward-facing orbits.

In `"head-up"` mode, `worldUpVector` is a preference rather than a strict
second axis. When the facing direction is parallel to `worldUpVector`, no
rotation/reflection can keep the sprite's head pointing along it; the engine
chooses one of the two possible sideways orientations. This is expected
geometry, not a bug. `"rotate"` ignores `worldUpVector` entirely, while
`"transform"` uses it as the independent target for `spriteUpVector`.

### Reflection hysteresis

`spriteReflectionHysteresisDeg` controls how sticky the `"head-up"` reflection
state is. It is the half-width of the deadband in degrees around the reflection
boundary:

- `0` — reflect immediately when the up vectors cross the boundary.
- `6` (default) — ignore small crossings; roughly a ±6° deadband.
- Larger values — even stickier, but slower to correct after a sharp turn.

Values are clamped to `0..89.9`. Hysteresis only applies to `"head-up"` mode.

Changing `spriteAlignmentMode` automatically resets the stored reflection
parity. If you teleport an object, change its art, or set `worldUpVector` to a
discontinuous new value, call `resetSpriteReflectionState()` so the next draw
chooses parity afresh.

### API reference

| Field | Type | Default | Location | Description |
|---|---|---|---|---|
| `defaultSpriteForwardVector` | `vec2` | `[0, -1]` | `GameObjectClass` | The direction the raw sprite image faces. Drives rotation in every mode. |
| `spriteForwardVector` | `vec2` | inherited from class | `GameObject` | Per-instance override (rarely needed). |
| `defaultSpriteUpVector` | `vec2` | `[-1, 0]` | `GameObjectClass` | The raw image's up/head direction. Used for reflection parity in `"head-up"` and as an independent axis in `"transform"`. |
| `spriteUpVector` | `vec2` | inherited from class | `GameObject` | Per-instance override of the sprite's up direction. |
| `worldUpVector` | `vec2` | `[0, -1]` | `GameObject` | Preferred world-space up direction. Used by `"head-up"` and `"transform"`; ignored by `"rotate"`. Set automatically by movement functions. |
| `defaultSpriteAlignmentMode` | `SpriteAlignmentMode` | `"head-up"` | `GameObjectClass` | Default alignment mode for spawned instances. |
| `spriteAlignmentMode` | `SpriteAlignmentMode` | inherited from class | `GameObject` | Per-instance alignment mode: `"head-up"`, `"rotate"`, or `"transform"`. |
| `defaultSpriteReflectionHysteresisDeg` | `number` | `6` | `GameObjectClass` | Default reflection deadband half-width in degrees for spawned instances. |
| `spriteReflectionHysteresisDeg` | `number` | inherited from class | `GameObject` | Reflection deadband half-width in degrees for `"head-up"` mode. |

| Method | Description |
|---|---|
| `resetSpriteReflectionState()` | Clears the stored `"head-up"` reflection parity so the next draw chooses it afresh. |

### Orientation helpers

These methods set the object's facing direction (and thus which way the sprite
points). They update `orientation`, `direction_x`, and `direction_y` together.

| Method | Description |
|--------|-------------|
| `setOrientation(degrees)` | Set facing from degrees. 0 = up, 90 = right, 180 = down. |
| `setOrientationRadians(radians)` | Set facing from radians. 0 = up, π/2 = right. |
| `setOrientationTowards(position)` | Point toward a target position `{x, y}`. Updates every call — use in `everyTick` for tracking behaviour. |

```typescript
// Point toward the mouse every frame
everyTick(() => {
    enemy.setOrientationTowards(getMousePosition());
});
```

---

## Damage Sprites

Swap the drawn sprite based on the object's current HP to show visual
damage stages. Add sprites to the class with an HP threshold and the
engine automatically picks the right one each frame.

```typescript
const goblin = new EnemyClass("goblin", "goblin.png", 100);
goblin.addDamageSprite(100, "goblin_full.png");    // HP 76–100
goblin.addDamageSprite(50,  "goblin_damaged.png"); // HP 36–50
goblin.addDamageSprite(20,  "goblin_crit.png");    // HP 1–20
```

### How selection works

Sprites are sorted by `hpThreshold` ascending. The engine clamps the current
HP to `defaultHitpoints` (so a boost over max HP goes to the full-cover sprite).
It then picks the sprite with the **smallest threshold that is ≥ the clamped
HP**.

| HP | Clamped HP | Matching sprite |
|----|------------|----------------|
| 80 | 80 | Full (threshold 100, the smallest ≥ 80) |
| 35 | 35 | Damaged (threshold 50, the smallest ≥ 35) |
| 10 | 10 | Crit (threshold 20, the smallest ≥ 10) |
| 150 | min(150,100)=100 | Full |
| 0 | 0 | Crit |

If no sprite matches (HP is above all thresholds, or no sprites are defined),
the base image from the constructor is used.

### Loading

Damage sprite images are loaded asynchronously. The engine waits for all class
images and all damage sprite images to finish loading before starting the game
loop.

### API reference

| Member | Description |
|--------|-------------|
| `addDamageSprite(hpThreshold, imageFile)` | Add a damage sprite to the class. Sprites are automatically sorted ascending by `hpThreshold`. |
| `damageSprites` | The sorted array of `{hpThreshold, image, loaded}` objects. |

---

## Movement (`moveTo`)

Move an object toward a destination over a given time. The engine handles
acceleration, direction, deceleration, and arrival detection.

```typescript
enemy.moveTo({x: 1000, y: 500}, 3.0);
```

The object's orientation is automatically set to face the destination.
Velocity is calculated to arrive on schedule.

### World up direction

The third (optional) parameter `up` sets `worldUpVector` — the direction the
character's head should preferably point in world space. Default is `[0, -1]`
(screen up).

This value only affects alignment modes that use `worldUpVector`:

- `"head-up"` (default) uses it to choose reflection parity.
- `"transform"` uses it as the independent target for `spriteUpVector`.
- `"rotate"` ignores it.

```typescript
// Ceiling walk: character moves right with head pointing down
player.moveTo({x: 500, y: 0}, 2.0, [0, 1]);
```

For `circleAround`, the default up is radially outward from the orbit centre
(centrifugal). Pass `worldUp` in the options to override:

```typescript
drone.circleAround({
    center: player, radius: 80, velocity: 40,
    worldUp: [0, -1],   // head stays at screen top regardless of orbit position
});
```

In `"head-up"` mode, `worldUpVector` is a preference rather than a strict axis.
When the facing direction is parallel to it, the sprite cannot keep its head
pointing exactly along `worldUpVector`; rotation and reflection only choose one
of the two sideways orientations.

### Deceleration

The object slows down as it approaches the target for a smooth stop:

| Field | Default | Description |
|-------|---------|-------------|
| `decelerationDistance` | `4` | Distance from destination where deceleration begins. Larger values = earlier slowdown. |
| `decelerationTime` | `1.0` | Minimum velocity divisor during final approach. Higher values = slower crawl into position. |

### Arrival callback

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

### Locking orientation

Set `lockOrientation = true` to prevent `moveTo` and `circleAround` from
changing the object's orientation. The object still moves along the path but
keeps its original facing direction unchanged. Useful for tools, thrown
objects, or animated sprites with a fixed angle.

```typescript
const axe = itemClass.spawn(0, 0);
axe.lockOrientation = true;
axe.setOrientation(45);            // fixed 45° angle
axe.moveTo({x: 500, y: 300}, 2.0); // moves but keeps 45° facing
```

The `lockOrientation` flag applies to all automatic orientation updates:
- `moveTo()` initial and per-frame re-orientation
- `circleAround()` orbit-facing orientation

For `Projectile`, use `alignToTravel = false` instead (it has its own
orientation system separate from `lockOrientation`).

### moveTo vs setOrientationTowards

Calling `moveTo` sets both `destination` (for movement) and orientation
(toward the target). To point an object toward a target without moving,
use `setOrientationTowards()` instead.

### Speed vs velocity

- `speed` — maximum possible speed cap (default 200). Used by `Player` keyboard
  input and as the default for `Projectile` / `Item`.
- `velocity` — current speed along the direction vector. Used by `moveTo` and
  the base `doMovement` system.
- `setSpeed(n)` sets **`velocity`**, not `speed`. This is a common point of
  confusion.

### Other movement helpers

| Method | Description |
|--------|-------------|
| `moveTo(position, time)` | Move to a position in the given time (seconds). Cancels any active `circleAround`. |
| `move(vector)` | Translate by `[dx, dy]`. Updates attachments. |
| `setLocation(x, y)` | Absolute position set. Updates attachments. |
| `onArrival(callback)` | Fires when `moveTo` reaches its destination. |

---

## Collisions

Register collision handlers at the class level (fires for all instances) or the
instance level (fires only for specific objects).

All collision checks are performed every frame by the engine using the
`collisionActions` registry. Handlers receive the two colliding objects.

### Class-level registration

Set up once on the class — fires for every instance when it hits any instance
of the target class:

```typescript
bulletClass.onCollisionWith(enemyClass, (bullet, enemy) => {
    enemy.takeDamage(10);
    bullet.destroy();
});
```

### Instance-level registration

Fires only for that specific object instance:

```typescript
// This player vs any enemy
player.onCollisionWith(enemyClass, (enemy) => {
    player.takeDamage(5);
});

// This object vs a specific other object
ball.onCollisionWithParticular(paddle, () => {
    ball.direction_y *= -1;
});

// Convenience: this object vs any Enemy
bullet.onCollisionWithEnemy((enemy) => {
    enemy.takeDamage(10);
});
```

### Single collision per frame

Set `singleCollisionOnly` to stop collision detection after the first hit each
frame. Useful for projectiles so one bullet only hits one target.

```typescript
const bullet = bulletClass.spawn(x, y);
bullet.singleCollisionOnly = true;

// Or set on the class so all instances inherit it:
bulletClass.defaultSingleCollisionOnly = true;
```

Default is `false` (one object can collide with multiple targets per frame).

### API reference

| Method | Scope | Signature |
|--------|-------|-----------|
| `class.onCollisionWith(otherClass, work)` | Class-level | `(GameObjectClass, (self, other) => void) => void` |
| `class.onDestroy(work)` | Class-level | `((GameObject) => void) => void` — fires when any instance is destroyed. |
| `obj.onCollisionWith(otherClass, work)` | Instance | `(GameObjectClass, (other) => void) => void` |
| `obj.onCollisionWithParticular(otherObj, work)` | Instance | `(GameObject, () => void) => void` |
| `obj.onCollisionWithEnemy(work)` | Instance | `((GameObject) => void) => void` — convenience for `EnemyClass`. |

| Field | Type | Default | Location | Description |
|-------|------|---------|----------|-------------|
| `defaultSingleCollisionOnly` | `boolean` | `false` | `GameObjectClass` | Default for spawned instances. |
| `singleCollisionOnly` | `boolean` | inherited | `GameObject` | Per-instance override. When `true`, only the first collision per frame fires. |

---

## User Data (`var`)

Every `GameObject` has a `var` field of type `any` for storing custom per-object
state. This is the idiomatic pattern used in both sample games:

```typescript
const enemy = enemyClass.spawn(100, 100);
enemy.var = { hp: 10, level: 3, powerups: [], isBoss: true };
```

There is no restriction on what you store — use it for health, ammo, scores,
timers, AI state, or anything else.

---

## Attachments

Attach one game object to another so the child follows the parent's position
and orientation:

```typescript
const paddle = playerClass.spawn(400, 900);
const ball = ballClass.spawn(400, 870);

// Ball follows paddle with an offset
paddle.attach(ball, 0, -30, 0);
```

### How it works

- The child's position is recomputed every frame based on the parent's position
  and orientation plus the offset given at attach-time.
- Children do not perform independent `doMovement` — they move with their parent.
- Visibility propagates through the chain: hiding the parent hides all attached
  children (see [Visibility](#visibility)).
- The `attachedTo` field on the child is set automatically to the parent.

### Detaching

```typescript
paddle.detach(ball);  // ball becomes independent
ball.velocity = 500;  // now it can move on its own
```

### API reference

| Method | Description |
|--------|-------------|
| `parent.attach(child, offsetX, offsetY, orientationOffset)` | Attach `child` to `parent`. The child follows at the given offset. |
| `parent.detach(child)` | Remove the attachment. The child is no longer updated by the parent. |

| Field | Type | Description |
|-------|------|-------------|
| `attachedTo` | `GameObject \| null` | The parent this object is attached to, if any. Read-only (set by `attach()`). |
| `attachedObjects` | `AttachedGameObject[]` | Array of attached children. Managed by `attach()`/`detach()`. |

---

## Player Input

`Player` objects have built-in keyboard input. When movement keys are pressed,
the player moves in that direction.

### Enabling keyboard controls

```typescript
const ship = playerClass.spawn(500, 500);
ship.enableArrowKeysMovement();   // ← ↑ ↓ →
ship.enableWasdKeysMovement();    // W A S D
```

Both are enabled by default (`wasdKeys = true`, `arrowKeys = true`). Call either
method to enable them (idempotent).

### How movement works

- `speed` — maximum speed in board units/second (default 200).
- `acceleration` — seconds to ramp from 0 to full speed (default 0.5).
- The player uses `x_speed` / `y_speed` as per-axis velocity components,
  capped by `speed`. Keyboard input accelerates toward ±`speed` on each axis.
- The player sets `standardMovement = false`, so the base `doMovement` is
  skipped. Instead, `Player.doMovement` applies its own axis-based movement.
- `setSpeed(n)` sets `velocity` (used by `moveTo`), not `speed` (the max cap).

### Brickbreaker example (mouse-following)

```typescript
const paddle = playerClass.spawn(400, 900);
everyTick(() => {
    const mouse = getMousePosition();
    paddle.x = mouse.x;
});
```

### Spacefighter example (keyboard + firing)

```typescript
ship.enableWasdKeysMovement();
ship.speed = 400;
ship.setSpeed(0);

periodically(0.3, () => {
    const shot = bulletClass.spawnAt(ship);
    shot.onCollisionWithEnemy((enemy) => { enemy.takeDamage(1); });
});
```

### API reference

| Method / Field | Description |
|----------------|-------------|
| `enableArrowKeysMovement()` | Enable ← ↑ ↓ → control. |
| `enableWasdKeysMovement()` | Enable W A S D control. |
| `wasdKeys` | `boolean` — enable/disable WASD (default `true`). |
| `arrowKeys` | `boolean` — enable/disable arrow keys (default `true`). |
| `speed` | Maximum speed cap in board units/sec (default 200). |
| `acceleration` | Seconds to reach full speed (default 0.5). |
| `x_speed` / `y_speed` | Current per-axis velocity (set by keyboard input). |

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
| `opacity` | `number` | `1` | Opacity multiplier (0–1) for rendering. `1` = fully opaque (default — no performance cost; `globalAlpha` is not touched). `0` = fully invisible. Compounds with fade-in/out effects. |
| `zIndex` | `number` | `0` | Draw order. Lower values draw first (behind), higher values draw on top. Same-index objects preserve insertion order. |
| `hud` | `boolean` | `false` | When `true`, the object uses viewport-relative default-zoom coordinates instead of board coordinates. It stays fixed on screen regardless of camera movement, zoom, or panning. HUD status is inherited through `attachedTo`; effective-HUD objects are excluded from board collision. |

### Lifetime & boundaries

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxDurationMillis` | `number` | `0` | Auto-destroy after this many milliseconds. `0` = no auto-destroy. Set via `setMaxDuration(ms)`. |
| `timeExistedMillis` | `number` | `0` | Accumulated age in milliseconds (read-only, incremented each frame). |
| `boundToBoard` | `boolean` | `false` | When `true`, position is clamped to `[0, boardWidth] × [0, boardHeight]`. |
| `destroyIfOffBoard` | `boolean` | `false` | When `true`, the object is destroyed as soon as it leaves the board. Automatically `true` for `Projectile`. |
| `growInMillis` | `number` | `0` | Scale-in animation duration (ms). The object scales from 0 to 1 over this period at spawn. |
| `growOutMillis` | `number` | `0` | Scale-out animation duration (ms). The object scales from 1 to 0 before `maxDurationMillis` expires. |
| `setMaxDuration(ms)` | method | — | Set `maxDurationMillis`. The object is destroyed after `ms` milliseconds. |

### Z-Order

Set `zIndex` to control draw order and input targeting. Lower values draw first
(behind), higher values draw on top. Default is `0`. Objects with the same
`zIndex` preserve their insertion order.

When the user clicks or taps, the engine finds the **topmost** (highest `zIndex`)
visible object whose hitbox contains the point and that has at least one mouse
handler registered (`onMouseDown`, `onMouseUp`, or `onClick`). That object
**owns** the entire press-release cycle — `onMouseDown`, `onMouseUp`, and
`onClick` are all delivered exclusively to it. Objects below it receive nothing.

If the topmost handler-owning object is being dragged, its `onClick` is
suppressed (the click is consumed but not fired). This prevents spurious clicks
after a drag.

If no matching object has any mouse handler, the global `onMouseClick` fallback
fires instead (if registered and the mouseup occurs within 600ms of mousedown).

```typescript
background.zIndex = -10;   // behind everything — never intercepts clicks
ui_panel.zIndex = 100;     // on top of everything — captures all input
```

### Overlay & Progress Bar

| Member | Type | Default | Description |
|--------|------|---------|-------------|
| `drawOverlay` | `((ctx: CanvasRenderingContext2D) => void) \| null` | `null` | Called in `draw()` after the sprite image. The context is already translated, rotated, and scaled to the object's position and orientation — draw in local coords. Set to `null` to disable. |
| `setProgressBar(getter, fgColor, outlineColor, opacity, height?)` | method | — | Draw a bar on this object. `getter` returns 0–1 (or `null` to clear). Bar is 80% of object width × `height` game units (default 6), centered 20 game units below the origin. Drawn in game coords before the sprite scale transform. `fgColor`/`outlineColor` are CSS colour strings. `opacity` is 0–1, multiplied by the object's own opacity. |

### Fade-in / Fade-out

Any `GameObject` can fade in at spawn and fade out before auto-destruction.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fadeInMillis` | `number` | `0` | Duration (ms) to fade from invisible to fully opaque at spawn. `0` = no fade-in. |
| `fadeOutMillis` | `number` | `0` | Duration (ms) to fade out before `maxDurationMillis` expires. `0` = no fade-out. |

```typescript
const enemy = enemyClass.spawn(100, 100);
enemy.fadeInMillis = 500;   // fades in over 500ms
enemy.maxDurationMillis = 3000;
enemy.fadeOutMillis = 400;  // fades out over 400ms before destruction
```

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

```typescript
// Counter-clockwise swing — 90 degrees with smooth stop
enemy.circleAround({
    center: { x: 500, y: 300 },
    radius: 150,
    velocity: 100,
    startAngleDeg: 0,
    arcDeg: 90,
    direction: -1,
    fadeOutTime: 0.3,
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
| `arcRad` | `number` | — | Total arc to sweep in radians. Omit for indefinite orbit. Direction (`+`/`-`) is ignored — use `direction` instead. |
| `arcDeg` | `number` | — | Total arc to sweep in degrees. Takes precedence over `arcRad`. Omit for indefinite orbit. |
| `direction` | `number` | `1` | Swing direction: `1` = clockwise (default), `-1` = counter-clockwise. |
| `worldUp` | `vec2` | `—` | Preferred world-space up direction for the orbiting object. Used by `"head-up"` and `"transform"` alignment modes; ignored by `"rotate"`. Default: radially outward from centre (centrifugal). Pass `[0, -1]` for screen-up always, or a custom vector for wall/ceiling orbits. |
| `onComplete` | `() => void` | — | Called once after the arc is fully traversed. The object is snapped to the exact final position before the callback fires. |

### Methods

| Method | Description |
|--------|-------------|
| `circleAround(options)` | Start circular orbit. Cancels any active `moveTo`. |
| `cancelCircleAround()` | End orbit immediately. Object stays at current position. |

---

## Layout Containers

`Row` and `Column` lay out child `GameObject`s in horizontal or vertical stacks,
with configurable padding, gutters, alignment, and optional borders.

```typescript
const panel = new Column(400, 300);
panel.setPadding(20);
panel.setGutter(10);
panel.setBorder(2, "#FFFFFF");

// Children are positioned by layout()
panel.addChild(button1);
panel.addChild(button2);
panel.layout();
```

### Padding & gutter

- **`padding`** — space between the container's edge and its children (default 0).
- **`gutter`** — space between adjacent children (default 0). Separate from padding.

```typescript
panel.setPadding(16);   // 16px inset from all edges
panel.setGutter(8);     // 8px between each child
```

### Borders

Set a border width and colour on any `LayoutContainer`:

```typescript
panel.setBorder(3, "#00FF00");   // 3px green border
// Omit colour to keep the existing borderColor (default "#000000"):
panel.setBorder(2);
```

Borders render as a stroked rect at the container's bounding box. The container
is automatically added to the draw loop so the border is visible.

### Alignment

```typescript
panel.setJustify(LayoutJustify.CENTER);      // group children vertically/horizontally centered
panel.setAlign(LayoutAlign.STRETCH);         // stretch children to fill cross-axis
```

`Row` and `Column` can themselves be stretched or maximized by a parent layout
container. Their interiors reflow to the assigned size, so a `Column` with
`align = STRETCH` can produce full-width nested rows.

When single-line content is larger than the container, justify falls back to
`START` so overflow goes to the right/bottom instead of starting before the
leading inner edge.

### Child positioning

After `layout()` runs, each child's attach offset is updated so that moving the
container repositions all children correctly.

For free-form containers, use `addChildAt()` to place a child at an explicit
position. Manual `setLocation()` calls also survive parent moves because
`LayoutContainer.setLocation()` refreshes child offsets before moving.

```typescript
const panel = new LayoutContainer(500, 500);
panel.addChildAt(label, 540, 520);
```

Move free-form containers with `setLocation()` or `move()`. Both propagate the
movement through attached children. Directly assigning `container.x` / `y`
bypasses that propagation and is not supported for free-form containers.

### Layout ownership and destruction

Layout containers own their attached children. Destroying a `LayoutContainer`,
`HudLayout`, `Page`, or `ScrollablePage` destroys its layout children and
regions. Destroying a layout child removes it from its parent's `children` and
invalidates the parent, so no empty layout slot remains.

Non-layout `GameObject`s detach attached children when destroyed rather than
destroying them.

`removeChild()` hides an effective-HUD child by default. Call `setVisible(true)`
on it before reusing it in another container, or pass `{ keepVisible: true }` if
you intentionally want it to remain visible at its detached position.

### API reference

**`LayoutContainer` fields**

| Member | Type | Default | Description |
|--------|------|---------|-------------|
| `padding` | `number` | `0` | Edge inset in board units. |
| `gutter` | `number` | `0` | Space between children in board units. |
| `borderWidth` | `number` | `0` | Border thickness. `0` = no border. |
| `borderColor` | `string` | `"#000000"` | Border stroke colour. |
| `explicitWidth` / `explicitHeight` | `number \| undefined` | `undefined` | Fixed dimensions. Unset dimensions auto-size from children. |
| `maxWidth` | `number \| undefined` | `undefined` | Maximum width used when auto-sizing and wrapping. |
| `layoutDirty` | `boolean` | `true` | Whether the container needs a reflow. |

**`LayoutContainer` methods**

| Method | Description |
|--------|-------------|
| `setPadding(n)` | Set padding and invalidate layout. |
| `setGutter(n)` | Set gutter and invalidate layout. |
| `setBorder(width, color?)` | Set border width and optional colour. |
| `setJustify(j)` | Set justify mode (`START`, `CENTER`, `END`, `SPACE_BETWEEN`, `SPACE_AROUND`). |
| `setAlign(a)` | Set align mode (`START`, `CENTER`, `END`, `STRETCH`). |
| `setSize(w, h)` | Set fixed width and height. |
| `setWidth(w)` | Set fixed width; height auto-sizes. |
| `setHeight(h)` | Set fixed height; width auto-sizes. |
| `setAvailableWidth(w)` | Set an available width while preserving any explicit height. |
| `setAvailableHeight(h)` | Set an available height while preserving any explicit width. |
| `setMaxWidth(w)` | Limit auto-sized width; pass `null` to clear. |
| `setAutoWidth()` / `setAutoHeight()` | Clear the corresponding explicit dimension. |
| `setVisible(visible)` | Set visibility and invalidate parent layout. |
| `addChild(child)` | Add a child at the container origin and invalidate layout. |
| `addChildAt(child, x, y)` | Add a child at an explicit position and invalidate layout. |
| `removeChild(child, { keepVisible? })` | Remove a child and invalidate layout. Effective-HUD children are hidden unless `keepVisible` is true. |
| `invalidateLayout()` | Mark this container and its layout ancestors dirty. |
| `layout()` | Recalculate child positions and clear the dirty flag. |

Setters now invalidate rather than laying out immediately. The engine reflows
dirty layout containers once before drawing, and again before `redraw()` while
paused.

`setWidth()` and `setHeight()` clear the other explicit dimension so it can
auto-size. Use `setAvailableWidth()` / `setAvailableHeight()` when the other
dimension is intentionally fixed.

### Wrapping rows

`Row` can wrap children onto multiple lines:

```typescript
const bar = new Row(500, 50);
bar.setWidth(320);
bar.setWrap(true);
bar.setGutter(8);
bar.setLineGap(8);
bar.setJustify(LayoutJustify.END);
bar.setAlign(LayoutAlign.CENTER);

bar.addChild(label);
bar.addChild(menuButton);
bar.addChild(pauseButton);
bar.layout();
```

- `wrap` defaults to `false`.
- Hidden children are skipped by `Row` and `Column`.
- A child wider than the available width goes on its own line and overflows.
- `maximizeX`, `maximizeY`, and `LayoutAlign.STRETCH` are ignored when
  `wrap = true`.
- Measurement uses `getLayoutWidth()` / `getLayoutHeight()`, so `Text` contributes
  its real measured size.
- Nested layout containers receive bounded width and height from their parent.
  A wrapping `Row` inside a fixed-width `Column` or HUD center wraps to that
  width without a separate `setWidth()` call.
- `maximizeX`, `maximizeY`, and `LayoutAlign.STRETCH` respect padding and
  gutters.
- Layout-assigned stretches and maximizes do not permanently freeze a child's
  intrinsic size. A later external size change becomes the new baseline.
- Use `setVisible(false)` to hide a child and invalidate layout. Directly
  assigning `visible` still hides it but does not invalidate automatically.

### Page

`Page` is a full-screen layout with named sub-containers for the top, bottom,
left, right, and center regions:

```typescript
const page = new Page(1000, 900);
page.setTopRow(headerPanel);
page.setBottomRow(footerPanel);
page.setLeftColumn(sidebar);
page.setRightColumn(buttonPanel);
// centerColumn is created automatically and receives the remaining area.
page.centerColumn.addChild(mainContent);
```

| Member | Description |
|--------|-------------|
| `topRow` / `bottomRow` | `Row` — top/bottom strips. |
| `leftColumn` / `rightColumn` | `Column` — left/right side panels. |
| `centerColumn` | `Column` — main content area, created automatically. |
| `setTopRow(row)` / `setBottomRow(row)` | Place a row in the top/bottom region. |
| `setLeftColumn(col)` / `setRightColumn(col)` | Place a column in the left/right region. |

`Page` participates in layout reflow. Region sizes are recalculated when a
child changes size, such as a wrapping top row changing height.

Region setters show newly attached regions and hide replaced regions. Destroying
a page destroys its regions and center. Destroying `centerColumn` while the page
is alive creates a fresh default center.

### ScrollablePage

`ScrollablePage` is a full-page container (extends `GameObject`) with vertical
scrolling:

```typescript
const scrollPage = new ScrollablePage(400, 600);
scrollPage.setContentHeight(2000);  // tall content
scrollPage.scroll(50);              // scroll down 50px
```

| Member | Description |
|--------|-------------|
| `scrollOffset` | Current scroll position in board units. |
| `contentHeight` | Total scrollable content height. |
| `scrollbar` | Optional `GameObject` used as a scrollbar indicator. |
| `setContentHeight(height)` | Set the total scrollable content height and invalidate layout. |
| `scroll(delta)` | Scroll by `delta` board units, clamped to bounds. |

`ScrollablePage` also supports top/bottom/left/right regions and participates in
layout reflow.

---

## Effects

`Effect` objects are visual effects that auto-destroy after a set duration,
with optional fade-in and fade-out. Use them for explosions, damage numbers,
particle effects, and screen flashes.

### Creating effects

```typescript
const explosionClass = new EffectClass("explosion", "explosion.png", 500, 50, 200);
//                                    name          image_file       duration^  ^fadeIn ^fadeOut
// Duration in milliseconds, fade-in and fade-out in milliseconds.

// Spawn at a position
const effect = explosionClass.spawn(200, 300);

// Or spawn at an existing object's position
explosionClass.spawnAt(targetEnemy);
```

### Spawning at runtime

```typescript
// In a collision handler:
bullet.onCollisionWithEnemy((enemy) => {
    explosionClass.spawnAt(enemy);
    enemy.destroy();
});
```

### API reference

| Class member | Description |
|---|---|
| `EffectClass(name, image, duration?, fadeIn?, fadeOut?)` | Constructor. `duration`/`fadeIn`/`fadeOut` in milliseconds. |
| `spawn(x, y)` | Spawn at absolute position. |
| `spawnAt(position)` | Spawn at a `Position2D` or `GameObject`'s position. |

The effect uses `maxDurationMillis`, `fadeInMillis`, `fadeOutMillis` from the
base `GameObject` — see [Fade-in / Fade-out](#fade-in--fade-out).

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

// If the label is inside a layout container, use the setter so a
// measurement-changing size update can invalidate layout:
label.setSize(48);
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

### Layout measurement and minimum sizes

`Text` provides measured layout dimensions and can reserve a stable minimum size
to prevent labels from jumping when digit counts change:

```typescript
const score = createText("9", { x: 500, y: 40 });
score.setLayoutMinWidthSample("0000");  // reserve width for four digits
score.setTextAlign("right");            // keep the right edge stable

score.setText("10");                    // no reflow if it still fits
score.setText("1000");                  // may grow beyond the sample
```

- `getLayoutWidth()` / `getLayoutHeight()` return measured sizes including
  numeric and sample minimums.
- Text height uses stable font metrics, raised to the tallest inline image.
  Empty text still reserves a line height.
- Layout containers place text using `getLayoutOffsetX()`, so left/centre/right
  alignment respects the reserved box.
- `setText()` / `setSize()` invalidate layout only when the effective size
  changes.
- Public `text` / `size` fields remain available. Direct assignment does not
  invalidate layout; that is useful for batching:

```typescript
score.text = "100";
lives.text = "3";
timer.text = "01:23";
hud.invalidateLayout();
```

Direct `textAlign` assignment has the same caveat; use `setTextAlign()` when
changing alignment inside a layout container.

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
| `layoutMinWidth` / `layoutMinHeight` | Numeric minimum layout size in layout units. |
| `layoutMinWidthSample` / `layoutMinHeightSample` | Text samples whose measured size reserves a minimum. |
| `getLayoutWidth()` / `getLayoutHeight()` | Effective measured layout size, including minimums. |
| `getLayoutOffsetX()` / `getLayoutOffsetY()` | Offset from the draw origin to the layout centre. |
| `setText(text, options?)` | Set text and conditionally invalidate layout. |
| `setSize(size, options?)` | Set font size and conditionally invalidate layout. |
| `setLayoutMinWidth(n)` / `setLayoutMinHeight(n)` | Set or clear numeric minimums. |
| `setLayoutMinWidthSample(s)` / `setLayoutMinHeightSample(s)` | Set or clear sample-based minimums. |
| `setHighlight(color, padding?)` | Enable highlight with given colour and optional padding around text (default 4). |
| `setShadow(color, blur?, offsetX?, offsetY?)` | Enable drop shadow with given colour, blur radius (default 4), and offsets (default 2). |
| `setTextAlign(align)` | `"left"` (default), `"center"`, or `"right"`. |
| `setInlineImages(images, options?)` | Provide `InlineImageMap` for `{img:name}` syntax. |

Layout invalidation options are `"auto"` (default), `"always"`, or `"never"`.
