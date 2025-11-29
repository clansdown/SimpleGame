# Agent Guidelines for SimpleGame
SimpleGame is a simple game engine for 2D games written in typescript and svelte to be run in a web browser.
It comes packaged with some demo games that beginners can start with.

## Build/Lint/Test Commands
- **Build**: `npm run build` (in ui/ directory)
- **Dev server**: `npm run dev` (in ui/ directory)
- **Type checking**: `npm run check` (runs svelte-check and tsc)
- **Preview**: `npm run preview` (in ui/ directory)
- **No test framework** - run manual testing

## Git Commit Rules
- NEVER execute `git commit` unless explicitly instructed via /commit command
- If commit seems necessary, suggest changes and prompt user to use /commit command

## Code Style Guidelines
- **Language**: TypeScript with strict typing, Svelte 5, ESNext modules
- **Imports**: Relative imports, group by: standard → third-party → local, no wildcards
- **Naming**: camelCase (variables/functions), PascalCase (classes), UPPER_SNAKE_CASE (constants), kebab-case (components)
- **Types**: Explicit types, prefer `type` over `interface`, use union types
- **Error Handling**: Defensive programming, null checks, optional chaining, early returns
- **Formatting**: 4 spaces indentation, spaces around operators, logical line breaks
- **Structure**: Explicit exports, arrow functions for callbacks, functional programming, single responsibility
- **Comments**: JSDoc for public APIs, inline for complex logic, TODO for future work
- **Security**: No secrets/keys in code, validate inputs, use HTTPS