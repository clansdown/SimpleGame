# Agent Guidelines for SimpleGame

SimpleGame is a simple 2D game engine written in TypeScript and Svelte for browser-based games.
It comes packaged with demo games (brick breaker, space fighter) that beginners can use to learn game programming.

## Build/Lint/Test Commands

- **Build**: `npm run build` (in ui/ directory) - Compiles the project for production
- **Dev server**: `npm run dev` (in ui/) - Starts the development server with hot reload
- **Type checking**: `npm run check` - Runs svelte-check and tsc for full type validation (REQUIRED before commits)
- **Preview**: `npm run preview` (in ui/) - Previews the production build locally
- **No test framework** - Manual testing required via dev server; no automated test commands exist

## Git Commit Rules

- NEVER execute `git commit` unless explicitly instructed via /commit command
- If commit seems necessary, suggest changes and prompt user to use /commit command

## Code Style Guidelines

### Language & Framework

- TypeScript with strict typing enabled
- Svelte 5 for UI components
- ESNext modules
- Vite build system

### Types (STRICT - REQUIRED)

- Explicit types are REQUIRED for ALL variables, function parameters, and return values
- Prefer `type` over `interface` where possible
- Use union types appropriately
- **NEVER use `any` type** except when absolutely unavoidable and must be documented with a comment explaining why it's necessary
- Run `npm run check` before commits to validate types

### Naming Conventions

- Variables and functions: camelCase with highly descriptive names
  - Good: `findCollisionsForGameObject`, `insertIntoChildNodes`, `periodicWorkInterval`
  - Bad: `findCols`, `insChild`, `pwi`
- Exception: trivial loop iterators (`i`, `j`, `k`) are acceptable
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Svelte components: kebab-case (e.g., `game-canvas.svelte`)
- TypeScript files: kebab-case (e.g., `simple-game.ts`)

### Imports

- Use relative imports
- Group imports in order: standard library → third-party → local
- Never use wildcard imports (e.g., `import * as utils`)

### Formatting

- 4 spaces indentation (no tabs)
- Spaces around operators (e.g., `x + y`, `delta_t * speed`)
- Logical line breaks for readability
- Consistent style throughout

### Documentation (CRITICAL - REQUIRED)

Every function MUST have detailed JSDoc comments that include:

- Purpose: What the function does and why it exists
- Parameters: All parameters with types and descriptions
- Return value: Type and description (or void if none)
- Usage: Example or explanation if non-obvious

```typescript
/**
 * Registers a callback function to be invoked on every game tick.
 * Use this for continuous game logic like movement, AI, or state updates.
 *
 * @param callback - The function to call each tick; receives delta_t (seconds since last tick)
 * @example
 *   everyTick((delta_t) => {
 *     player.x += player.velocityX * delta_t;
 *   });
 */
export function everyTick(callback: (delta_t: number) => void): void
```

- Public APIs: Full JSDoc with @param, @returns, @example tags
- Complex inline logic: Brief inline comments explaining the approach
- Future work: TODO comments with description

### Error Handling

- Defensive programming: Always validate inputs
- Use null checks and optional chaining
- Early returns to avoid nested conditions
- Never expose secrets or keys in code

### Code Structure

- Use explicit exports (named exports preferred)
- Prefer real functions at top level (not arrow function assignments like `const myFunc = () => {}`)
- Arrow functions are appropriate for callbacks only
- Functional programming patterns preferred
- Single responsibility principle: each function/class should do one thing well

## Project Structure

```
ui/src/
├── main.ts                      # Application entry point (mounts App.svelte)
├── game.ts                      # Game entry point - contains setup() function
├── App.svelte                   # Root Svelte component
├── lib/
│   ├── simplegame.ts            # Main engine: game loop, event handling, game state management
│   ├── gameclasses.ts           # Game object classes: GameObject, Player, Enemy, Projectile, Item, Effect, Text
│   ├── collision.ts             # Collision detection using quadtree spatial partitioning
│   ├── audio.ts                 # Audio system: Music and SoundEffect classes
│   ├── util.ts                 # Utility types (vec2, matrix2, box2, Position2D) and math functions
│   ├── layout.ts                # Layout containers: Row, Column, Page, ScrollablePage
│   └── button.ts                # UI button component
├── brickbreaker_sample.ts       # Sample game: Brick Breaker
├── spacefighter_sample.ts       # Sample game: Space Fighter
└── vite-env.d.ts                # Vite type definitions
```

## Common Patterns

### Game Setup Pattern

```typescript
export function setup() {
    // 1. Set board dimensions
    setBoardSize(width, height);

    // 2. Define game object classes (EnemyClass, ItemClass, PlayerClass, etc.)
    const playerClass = new PlayerClass("player", "player.png");
    
    // 3. Load resources and set up callbacks
    whenLoaded(() => {
        // 4. Spawn initial game objects
        playerClass.spawn(x, y);
        
        // 5. Register game loop callbacks
        everyTick((delta_t) => { /* update logic */ });
        periodically(seconds, () => { /* periodic logic */ });
        
        // 6. Set up collision handlers
        player.onCollisionWithEnemy((enemy) => { /* collision logic */ });
    });
}
```

### Game Loop

- `everyTick(callback)` - Called every frame (40 times/second by default)
- `periodically(seconds, callback)` - Called at specified intervals
- Input handling: `onKeyDown`, `onKeyUp`, `onMouseClick`
- Pause/Resume: `onPause`, `onResume`

## Testing

- No automated test framework is configured
- Test manually using `npm run dev` to start the development server
- Open browser at the displayed URL to verify changes
- Use `npm run check` to verify type correctness before considering changes complete
