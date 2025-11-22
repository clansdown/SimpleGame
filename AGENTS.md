# Agent Guidelines for SimpleGame

## Build/Lint/Test Commands
- **Build**: `npm run build` (in ui/ directory)
- **Dev server**: `npm run dev` (in ui/ directory)
- **Type checking**: `npm run check` (runs svelte-check and tsc)
- **Preview**: `npm run preview` (in ui/ directory)
- **No test framework configured** - run manual testing

## Code Style Guidelines

### Language & Framework
- **TypeScript** with strict typing enabled
- **Svelte 5** for UI components
- **ESNext** modules and syntax
- Target modern browsers (ESNext)

### Imports
- Use relative imports: `import { setup } from '../game'`
- Group imports: standard library, then third-party, then local
- Avoid wildcard imports (`import *`)

### Naming Conventions
- **Variables/Functions**: camelCase (`gameObjects`, `doMovement`)
- **Classes**: PascalCase (`GameObjectClass`, `CollisionAction`)
- **Constants**: UPPER_SNAKE_CASE for exported constants
- **Files**: kebab-case for components, camelCase for utilities (`simplegame.ts`)

### Types & Interfaces
- Use explicit types: `let canvas: HTMLCanvasElement`
- Define interfaces for complex objects: `type Position2D = {x: number, y: number}`
- Prefer `type` over `interface` for simple object types
- Use union types where appropriate

### Error Handling
- Defensive programming over try/catch blocks
- Null checks: `if(object) { ... }`
- Optional chaining: `object?.method()`
- Early returns for invalid states

### Formatting
- **Indentation**: 4 spaces (inconsistent in codebase, prefer 4)
- **Line length**: No strict limit, break long lines logically
- **Spacing**: Space around operators, after commas
- **Braces**: Same line for functions, new line for classes

### Code Structure
- Export functions/classes explicitly: `export function everyTick(callback)`
- Use arrow functions for callbacks: `(delta_t) => { ... }`
- Prefer functional programming where possible
- Keep functions focused on single responsibility

### Comments
- JSDoc for public APIs: `/** Register a callback to be called every tick */`
- Inline comments for complex logic only
- TODO comments for future work: `// TODO: implement touchscreen support`

### Security
- No secrets or keys in code
- Validate user inputs
- Use HTTPS for external resources