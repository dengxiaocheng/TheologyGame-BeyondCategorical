# LEGACY_FIX_PLAN — 挑水人的午后

Generated: 2026-05-01
Worker: game8-beyond-categorical-legacy-planner

---

## 1. Objective

Make the game playable from title screen through trip 25 ending without crashes or silent state corruption. The codebase has 4 P0 bugs that block progress and 5 P1 bugs that silently corrupt game state. All P0 fixes are prerequisites for any meaningful playtesting.

---

## 2. Guiding Principles

1. **Minimal delta**: Each fix should be the smallest change that resolves the bug. No refactoring tangents.
2. **Preserve architecture**: The IIFE singleton + constructor pattern is consistent across the codebase. Fix bugs within this pattern rather than rewriting to a new architecture.
3. **No new files**: All fixes edit existing files. No new modules or utilities.
4. **Test after each P0**: Each P0 fix should be independently verifiable by loading the game and reaching the previously-blocking point.

---

## 3. Fix Strategy by Priority

### Phase A: P0 Crash Fixes (Must-do, no game works without these)

**FIX-001**: Container constructor overwrite (`main.js:79`)
- **Strategy**: Rename the instance variable. Change `W.Container = container` → `W.container = container`. Search for all references to `W.Container` that expect the instance (not the constructor) and update them.
- **Scope**: `js/main.js` only (constructor lives in `waterContainer.js`, unaffected)
- **Risk**: Low. Only `main.js` references the instance via `W.Container`.
- **Stop condition**: `W.Container` remains the constructor; `W.container` is the instance.

**FIX-002**: RouteMap global assignment order (`main.js:80,85`)
- **Strategy**: Move `W.RouteMap = routeMap;` to after the `new W.RouteMap(...)` call on line 85.
- **Scope**: `js/main.js` (1 line move)
- **Risk**: Minimal — purely a reordering.
- **Stop condition**: `Water.RouteMap` is a RouteMap instance with nodes and paths.

**FIX-003**: Add `'accident'` to valid phases (`gameState.js:58`)
- **Strategy**: Add `'accident'` to the `validPhases` array.
- **Scope**: `js/models/gameState.js` (1 token addition)
- **Risk**: None. Purely additive.
- **Stop condition**: `gameState.setPhase('accident')` succeeds; phase transitions to `'accident'` during accident events.

**FIX-004**: Add `setLanguageConfusion` method or safe guard (`narrativeEngine.js:226`)
- **Strategy A (preferred)**: Add `setLanguageConfusion(confused)` method to `npcSystem.js` that sets a flag on each NPC, affecting their `generateRequest` output to produce garbled text.
- **Strategy B (minimal)**: Wrap the call in a feature-check: `if (Water.NPCSystem.setLanguageConfusion) Water.NPCSystem.setLanguageConfusion(true);`
- **Scope**: Strategy A: `js/engine/npcSystem.js` + `js/models/npc.js`; Strategy B: `js/engine/narrativeEngine.js`
- **Risk**: Strategy A requires understanding NPC request flow. Strategy B is a 1-line guard.
- **Stop condition**: Game does not crash at trip 22. Trip 22 narrative triggers without error.

### Phase B: P1 State Corruption Fixes (Required for correct gameplay)

**FIX-005**: `pourToNPC` return type destructuring (`main.js:1068-1074`)
- **Strategy**: Destructure the return value: `var result = W.Physics.pourToNPC(container, amount); var poured = result.amount;` then use `poured` in subsequent calls.
- **Scope**: `js/main.js` (3-4 lines around 1068-1074)
- **Risk**: Low. The return type is well-defined in `waterPhysics.js`.

**FIX-006**: Dual NPC array consolidation
- **Strategy**: Remove local `npcs` array creation from `main.js`. Use `Water.NPCSystem.npcs` as the single source. Update all local references.
- **Scope**: `js/main.js` (remove ~10 lines of local NPC creation, update ~20 references)
- **Risk**: Medium. Touches many interaction points. Requires careful audit of all `npcs[i]` usage in main.js.
- **Stop condition**: Only one NPC array exists. Water given via main.js updates the same objects that NPCSystem reads.

**FIX-007**: Debt direction verification and fix (`main.js:1088`)
- **Strategy**: Read `debtTracker.addDebt` signature to confirm expected argument semantics. Fix the call if reversed.
- **Scope**: `js/main.js` (1 line) or `js/engine/debtTracker.js` (signature clarification)
- **Risk**: Low once semantics are confirmed.
- **Stop condition**: `W.Debt.getTotalDebt()` returns correct totals; forgiving debt actually clears it.

**FIX-008**: `_paid` operator precedence (`debtTracker.js:59`)
- **Strategy**: Replace `r.amount - r._paid || r.amount` with `Math.max(0, r.amount - (r._paid || 0))`.
- **Scope**: `js/engine/debtTracker.js` (1 line)
- **Risk**: None. Pure math fix.
- **Stop condition**: Fully-paid debts show remaining balance of 0.

**FIX-009**: Weather mutation via method call (`narrativeEngine.js:273-274`)
- **Strategy**: Replace direct mutation with `Water.Weather.forceSet('overcast', 0.3)` and add `forceSet` method to weather model, or use existing `setForTrip`.
- **Scope**: `js/engine/narrativeEngine.js` (2 lines) + `js/models/weather.js` (new method if needed)
- **Risk**: Low.
- **Stop condition**: Rain promise event changes weather without breaking transitions.

### Phase C: P2/P3 Polish (Optional, low priority)

These can be deferred. See BUG_INVENTORY for details.
- BUG-010: Add `sourceId` to route node data
- BUG-011: Move Grace load outside NPC loop
- BUG-012: Add `Silence.getPhase()` getter
- BUG-013-015: CSS, localStorage, namespace — design debt, not blocking

---

## 4. Dependency Graph

```
FIX-001 ─┐
FIX-002 ─┤ (independent, can be done in parallel)
FIX-003 ─┤
FIX-004 ─┘
     │
     ▼
FIX-006 (depends on FIX-001 for W.container clarity)
     │
     ├── FIX-005 (independent after P0s)
     ├── FIX-007 (needs verified debtTracker — independent)
     ├── FIX-008 (independent)
     └── FIX-009 (independent)
```

All P0 fixes (001-004) are independent of each other and can be done in parallel.
FIX-006 is the only P1 with a soft dependency on FIX-001 (clarifying instance vs constructor).

---

## 5. Stop Conditions (Overall)

The fix phase is complete when:

1. Game loads without errors in browser console
2. Player can complete trips 1-25 without crashes
3. Water giving produces correct numerical tracking (debt, gratitude, NPC trust)
4. Accident system transitions phases correctly
5. Trip 22 (language confusion) and trip 25 (ending) trigger without errors
6. No new console warnings introduced by fixes

---

## 6. Verification Method

Since this is a planner-only worker, verification is left to the implementation worker:

1. **Smoke test**: Open `index.html` in browser, click "开始挑水", complete trip 1.
2. **Console audit**: Check browser console for errors during trip 1-3.
3. **Accident test**: Force an accident (modify accident chance temporarily) and verify phase transition.
4. **Water give test**: Give water to NPC and verify `W.container.current` decreases, NPC trust increases.
5. **Trip 22 test**: Skip to trip 22 and verify no crash.
6. **Full playthrough**: Complete all 25 trips if time permits.

---

## 7. Files Modified (Maximum)

| File                    | Approximate Delta | Bugs Fixed          |
|-------------------------|-------------------|---------------------|
| `js/main.js`           | ~40 lines         | 001,002,005,006,007 |
| `js/models/gameState.js`| ~1 line          | 003                 |
| `js/engine/npcSystem.js`| ~15 lines        | 004,011             |
| `js/engine/debtTracker.js`| ~1 line        | 008                 |
| `js/engine/narrativeEngine.js`| ~3 lines  | 009                 |
| `js/models/npc.js`      | ~10 lines         | 004 (Strategy A)    |
| **Total**               | **~70 lines**     | **9 bugs**          |

Well within the 500 net line budget.

---

## 8. Out of Scope

- Refactoring to ES modules or TypeScript
- Adding new game features
- Rewriting the rendering engine
- Changing the narrative content
- Responsive CSS overhaul
- Test suite expansion (existing Playwright tests are separate concern)
- Design doc alignment (see RISK_REGISTER)
