# BUG_INVENTORY — 挑水人的午后 (Beyond the Categorical)

Generated: 2026-05-01
Worker: game8-beyond-categorical-legacy-planner
Method: Static analysis of all 19 JS files + HTML + CSS (no runtime testing)

---

## Severity Scale

- **P0 — Crash / Hard Block**: Game cannot progress; JS error halts execution.
- **P1 — Wrong Behavior**: Game runs but produces incorrect game-state, silently corrupting data.
- **P2 — Cosmetic / Minor**: Visual glitch, minor inconsistency, or wasted computation.
- **P3 — Design Debt**: Architectural issue that may cause future bugs but not currently breaking.

---

## P0 — Crash / Hard Block

### BUG-001: `W.Container` constructor overwritten by instance
- **File**: `js/main.js:79`
- **Reproducibility**: 100% on every boot
- **Evidence**: Line 79 does `W.Container = container;` where `container` is an *instance* of `W.Container`. This overwrites the constructor function, so any subsequent `new W.Container(...)` call throws `TypeError: W.Container is not a constructor`.
- **Owner**: `js/main.js`
- **Blast Radius**: Any code path that tries to construct a new Container after init (e.g., save/load restoring a container, accident system replacing container).
- **Fix**: Rename to `W.containerInstance` or similar; preserve `W.Container` as constructor.

### BUG-002: `W.RouteMap` never assigned globally
- **File**: `js/main.js:80,85`
- **Reproducibility**: 100% on every boot
- **Evidence**: Line 80 runs `W.RouteMap = routeMap;` *before* `routeMap` is assigned (line 85: `var routeMap = new W.RouteMap(data.nodes, data.paths);`). Due to hoisting, `W.RouteMap` ends up as `undefined`. No subsequent code corrects this.
- **Owner**: `js/main.js`
- **Blast Radius**: `narrativeEngine.js` references `Water.RouteMap` at lines 28, 58, 127, 129 — tutorial mode and dark mode toggles silently fail. `routeOptimizer.js` may also be affected.
- **Fix**: Move `W.RouteMap = routeMap;` to *after* the RouteMap is constructed (after line 85).

### BUG-003: `'accident'` not in valid phases
- **File**: `js/models/gameState.js:58`
- **Reproducibility**: 100% when an accident triggers
- **Evidence**: `setPhase('accident')` called at `js/main.js:543`, but `validPhases` array on line 58 of `gameState.js` does not include `'accident'`. The `setPhase` method silently rejects the transition, leaving the game in `walking` phase while the accident overlay renders.
- **Owner**: `js/models/gameState.js`
- **Blast Radius**: Accident recovery may not work correctly; phase-dependent logic (pause/resume, save system, silence system) may misbehave during accidents.
- **Fix**: Add `'accident'` to `validPhases` array.

### BUG-004: `setLanguageConfusion` method does not exist
- **File**: `js/engine/narrativeEngine.js:226`
- **Reproducibility**: 100% at trip 22
- **Evidence**: `Water.NPCSystem.setLanguageConfusion(true)` is called at trip 22, but `npcSystem.js` defines no such method. This throws `TypeError: Water.NPCSystem.setLanguageConfusion is not a function`.
- **Owner**: `js/engine/npcSystem.js` (missing method) OR `js/engine/narrativeEngine.js` (incorrect call)
- **Blast Radius**: Game crashes at trip 22, blocking all progress beyond ~85% of the game.
- **Fix**: Either add `setLanguageConfusion` method to NPCSystem, or remove/adjust the narrative effect.

---

## P1 — Wrong Behavior

### BUG-005: `pourToNPC` return type mismatch
- **File**: `js/main.js:1068-1074`
- **Reproducibility**: 100% when player gives water to NPC
- **Evidence**: `W.Physics.pourToNPC(container, amount)` returns `{amount, quality}` (object), but `main.js:1068` assigns this to `amount` and then uses it as a number on line 1074 for `recordWaterGiven` and `addDebt`. These calls receive `NaN` or `[object Object]`.
- **Owner**: `js/main.js`
- **Blast Radius**: Water-giving produces no correct numerical tracking; debt and gratitude systems receive garbage data.
- **Fix**: Destructure: `var result = W.Physics.pourToNPC(container, amount); var actualAmount = result.amount;`

### BUG-006: Dual NPC array state divergence
- **File**: `js/main.js:715` vs `js/engine/npcSystem.js`
- **Reproducibility**: 100% throughout gameplay
- **Evidence**: `main.js` creates a local `npcs` array from `W.Data.createNPCs()` (line ~715), while `npcSystem.js:34` creates `Water.NPCSystem.npcs` via `initNPCs()` using the same factory. These are **separate object instances**. Water given to NPCs in main.js updates local `npcs[i]` but not `Water.NPCSystem.npcs[i]`, and vice versa. Trust, thirst, and alive state diverge.
- **Owner**: Cross-cutting: `js/main.js` + `js/engine/npcSystem.js`
- **Blast Radius**: NPCSystem summaries for ending calculation are wrong; narrative engine NPC checks (trip 21 gratitude boost) operate on wrong objects.
- **Fix**: Eliminate one array. Prefer using `Water.NPCSystem.npcs` as single source of truth; remove local `npcs` from main.js.

### BUG-007: Debt direction reversed
- **File**: `js/main.js:1088`
- **Reproducibility**: 100% when player gives water on credit
- **Evidence**: `W.Debt.addDebt(npcId, amount, 'player')` — the debt tracker records this as NPC owing the player, but semantically the *player* gave water to the NPC and the NPC is now in debt. The `'player'` third argument may indicate "player is creditor", but the tracker may interpret it differently depending on implementation. Need to verify against `debtTracker.js` semantics.
- **Owner**: `js/main.js`
- **Blast Radius**: Debt forgiveness and collection logic may be inverted.
- **Fix**: Verify debtTracker semantics and correct the call signature. May need `W.Debt.addDebt(npcId, amount, 'npc')` or restructure arguments.

### BUG-008: Debt tracker `_paid` operator precedence
- **File**: `js/engine/debtTracker.js:59`
- **Reproducibility**: 100% when partial payment makes debt fully paid
- **Evidence**: `r.amount - r._paid || r.amount` — when `r.amount - r._paid === 0` (fully paid), the `||` operator falls through to `r.amount`, returning the original (non-zero) debt instead of 0.
- **Owner**: `js/engine/debtTracker.js`
- **Blast Radius**: Fully-paid debts never show as cleared; interest continues to accrue on zeroed debts.
- **Fix**: Use explicit check: `(r._paid ? r.amount - r._paid : r.amount)` or `Math.max(0, r.amount - (r._paid || 0))`.

### BUG-009: Weather object mutated directly bypassing model
- **File**: `js/engine/narrativeEngine.js:273-274`
- **Reproducibility**: When `rain_promise` random event triggers
- **Evidence**: `Water.Weather.type = 'overcast'` and `Water.Weather.intensity = 0.3` directly mutate the Weather singleton, bypassing its `setForTrip` and `update` methods that manage transitions and side effects.
- **Owner**: `js/engine/narrativeEngine.js`
- **Blast Radius**: Weather transitions may break; visual rendering of weather effects may not update correctly.
- **Fix**: Call `Water.Weather.setForTrip(trip, 'overcast')` or add a `Weather.forceSet(type, intensity)` method.

---

## P2 — Cosmetic / Minor

### BUG-010: `sourceId` not defined on route nodes
- **File**: `js/engine/mapEngine.js:614`
- **Reproducibility**: When rendering source gauges on map view
- **Evidence**: `_renderSourceGauges` iterates nodes looking for `nodes[i].sourceId`, but `js/data/routes.js` node definitions don't include a `sourceId` field. The check `if (nodes[i].sourceId)` will always be falsy, so gauge rendering silently skips all sources.
- **Owner**: `js/data/routes.js` (missing data) or `js/engine/mapEngine.js` (wrong field name)
- **Blast Radius**: Water source gauges never render on the map. Players have no visual indicator of source status.
- **Fix**: Add `sourceId` to relevant nodes in route data, or map existing field names.

### BUG-011: Grace data loaded 9 times redundantly
- **File**: `js/engine/npcSystem.js:52`
- **Reproducibility**: 100% on initialization
- **Evidence**: `initNPCs` calls `Water.Grace.loadPreviousData()` inside the NPC creation loop (9 NPCs = 9 calls). This reads from localStorage each time. Should be called once before the loop.
- **Owner**: `js/engine/npcSystem.js`
- **Blast Radius**: Performance (9 unnecessary localStorage reads); no functional impact since `loadPreviousData` is likely idempotent.
- **Fix**: Move `Water.Grace.loadPreviousData()` call to before the loop.

### BUG-012: Silence system encapsulation break
- **File**: `js/main.js:879` (accesses `W.Silence._phase` directly)
- **Reproducibility**: During silence phase checks
- **Evidence**: main.js reads `W.Silence._phase` directly instead of using a public API. The underscore prefix signals a private field. If silence system refactors internal state, main.js breaks.
- **Owner**: `js/main.js`
- **Blast Radius**: Low — currently works, but fragile coupling.
- **Fix**: Add `Silence.getPhase()` getter; use it in main.js.

---

## P3 — Design Debt

### BUG-013: CSS fixed dimensions with no responsive fallback
- **File**: `css/style.css`
- **Reproducibility**: On any screen != 375x812
- **Evidence**: Canvas and overlay use fixed `375px` / `812px` dimensions. No media queries or flex/grid layout for adaptation. On tablets or desktop, the game is a small fixed box.
- **Owner**: `css/style.css`
- **Blast Radius**: Visual only on non-mobile viewports.
- **Fix**: Low priority; acceptable for mobile-first game.

### BUG-014: No error boundary around localStorage operations
- **File**: `js/engine/saveSystem.js`, `js/engine/graceSystem.js`
- **Reproducibility**: In private browsing or full storage
- **Evidence**: `localStorage.setItem` / `getItem` calls have no try/catch. Private browsing mode or full storage quota throws `QuotaExceededError` or `SecurityError`.
- **Owner**: `js/engine/saveSystem.js`
- **Blast Radius**: Save fails silently; grace system cross-game data lost.
- **Fix**: Wrap localStorage calls in try/catch.

### BUG-015: `W.Data` namespace initialized as empty but used as method host
- **File**: `js/namespace.js` vs `js/data/*.js`
- **Reproducibility**: Not a runtime bug currently
- **Evidence**: namespace.js sets `W.Data = {}`, and data files attach methods like `W.Data.createRoutes`. This pattern works but is fragile — load order matters, and no single file owns the Data namespace.
- **Owner**: Architecture
- **Blast Radius**: Currently none; latent risk if load order changes.
- **Fix**: Document load-order dependency; consider a Data module initializer.

---

## Summary Table

| ID    | Severity | File(s)                    | Line(s)     | Description                          | Reproducibility |
|-------|----------|----------------------------|-------------|--------------------------------------|-----------------|
| 001   | P0       | main.js                    | 79          | Container constructor overwrite      | 100%            |
| 002   | P0       | main.js                    | 80,85       | RouteMap never assigned globally     | 100%            |
| 003   | P0       | gameState.js               | 58          | 'accident' missing from validPhases  | 100% on accident|
| 004   | P0       | narrativeEngine.js         | 226         | setLanguageConfusion undefined       | 100% at trip 22 |
| 005   | P1       | main.js                    | 1068-1074   | pourToNPC return type mismatch       | 100% on give    |
| 006   | P1       | main.js + npcSystem.js     | 715, 34     | Dual NPC array divergence            | 100%            |
| 007   | P1       | main.js                    | 1088        | Debt direction possibly reversed     | 100% on credit  |
| 008   | P1       | debtTracker.js             | 59          | Operator precedence in _paid calc    | 100% on payoff  |
| 009   | P1       | narrativeEngine.js         | 273-274     | Weather bypassed via direct mutation | On rain_promise |
| 010   | P2       | mapEngine.js + routes.js   | 614         | sourceId missing from node data      | 100%            |
| 011   | P2       | npcSystem.js               | 52          | Grace data loaded 9x redundantly     | 100%            |
| 012   | P2       | main.js                    | 879         | Silence _phase accessed directly     | During silence  |
| 013   | P3       | style.css                  | —           | No responsive layout                 | Non-mobile      |
| 014   | P3       | saveSystem.js              | —           | No localStorage error handling       | Full storage    |
| 015   | P3       | namespace.js               | —           | W.Data namespace ownership unclear   | Latent          |

**Total**: 15 bugs (4 P0, 5 P1, 3 P2, 3 P3)
