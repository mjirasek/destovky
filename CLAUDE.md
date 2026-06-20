# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # type-check + production build (base path: /destovky/)
npm run preview   # preview the production build
npm run lint      # ESLint
npm test          # run all Vitest tests (non-watch)
```

Run a single test file:
```bash
npx vitest run src/chessEngine.test.ts
```

## Architecture

Destovky is a browser chess variant where players place pieces from a shuffled deck before making chess moves. The stack is React 19 + TypeScript + Vite, Tailwind CSS v4, chessground (board UI), and chessops (move generation / attack detection). Multiplayer is backed by Supabase.

### Folder boundaries (strict)

| Folder | Responsibility |
|---|---|
| `src/rules/` | Source of truth for all game rules — types, deck, chess engine, state transitions, serialization. No React or engine imports allowed here. |
| `src/engine/` | Computer-player decision logic. Imports `src/rules/`, never the other way. |
| `src/components/` | React UI only. |
| `src/App.tsx` | Wires UI, rules, multiplayer, and engine together. All top-level game state lives here as React state. |
| `src/multiplayer.ts` | Supabase CRUD helpers (challenges, games, profiles, chat). |

### Re-export shim pattern

`src/types.ts`, `src/gameState.ts`, `src/gameSerialization.ts`, and `src/chessEngine.ts` are thin re-exports that proxy their equivalents from `src/rules/`. Prefer importing directly from `src/rules/*` in new rules/engine code; the shims exist so older imports still work.

### Key types (`src/rules/types.ts`)

- `GameState` — the entire game: board (`Map<Square, CGPiece>`), two `Deck`s, promotion tracking, `turn`, `turnMode`, precomputed `legalPlacementSquares` and `legalMoves`, and game-over state.
- `TurnMode` — `'must-place'` (king not yet on board), `'choose'` (flip or move), `'must-move'` (in check).
- `Square` — a number 0–63 (`sq % 8` = file, `sq >> 3` = rank).

### Game state flow (`src/rules/gameState.ts`)

State is immutable; each action returns a new `GameState` with updated `legalPlacementSquares` and `legalMoves` already computed:

1. `flipCard` — reveals top deck card; filters placements to check-resolving squares when in check; ends game if card can't resolve check.
2. `placePiece` — places revealed card on the board, advances turn.
3. `makeMove` — makes a chess move; sets `pendingPromotion` on back-rank pawn arrival.
4. `completePromotion` — resolves the pending promotion choice.

### Engine (`src/engine/randomEngine.ts`)

`chooseRandomEngineAction` picks a weighted random legal action (draw vs. move). `applyEngineAction` applies it to state. `App.tsx` calls `playEngineTurnWithNotation` in a `setTimeout` when `localMode === 'computer'` and it is black's turn.

Future engines must implement the `Engine` interface sketched in `src/engine/ENGINE_PLAN.md`.

### Multiplayer sync

`App.tsx` subscribes to Supabase Realtime channels for the active game and falls back to polling every 1.5 s. Game state is serialized to JSON via `src/rules/gameSerialization.ts` and stored in `games.state_json`. The Supabase URL and anon key are in `.env.production`; no service-role key should ever be in the repo.

### Snapshot / move history

`snapshots: GameState[]` and `notations: string[]` grow with each committed action. `snapshotCursor` is `null` for the live position and a numeric index when browsing history. Left/Right arrow keys navigate history.
