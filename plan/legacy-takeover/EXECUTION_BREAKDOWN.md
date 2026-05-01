# EXECUTION_BREAKDOWN — 挑水人的午后

Generated: 2026-05-01
Worker: game8-beyond-categorical-legacy-planner

---

## Execution Packets

Ordered by dependency: P0 crashes first, then P1 state corruption. Each packet is a self-contained unit of work that can be assigned to an implementation worker.

---

### PACKET 001: Fix Container/RouteMap Namespace Collision

**Priority**: P0 (blocks everything)
**Bugs**: BUG-001, BUG-002
**Scope**: `js/main.js` only

**Changes**:
1. Line 79: Change `W.Container = container;` → `W.container = container;`
2. Lines 80→85: Reorder so `W.RouteMap = routeMap;` comes *after* `var routeMap = new W.RouteMap(data.nodes, data.paths);`
3. Update all references to `W.Container` (the instance) throughout main.js to use `W.container` instead. Search for:
   - `W.Container.current` → `W.container.current`
   - `W.Container.capacity` → `W.container.capacity`
   - `W.Container.quality` → `W.container.quality`
   - `W.Container.leakRate` → `W.container.leakRate`
   - Any other property access on the instance
4. Verify `W.Container` (constructor) is NOT called with `new` anywhere in main.js after init. (It shouldn't be, but check.)

**Acceptance Test**:
- [ ] `typeof W.Container === 'function'` (constructor preserved)
- [ ] `W.container instanceof W.Container` (instance accessible)
- [ ] `Water.RouteMap` has `.nodes` and `.paths` properties (not undefined)
- [ ] No console errors on game load

**File Budget**: 1 file (`js/main.js`)
**Line Delta**: ~20 lines changed (rename references + reorder)

---

### PACKET 002: Add 'accident' to Valid Phases

**Priority**: P0 (blocks accident system)
**Bugs**: BUG-003
**Scope**: `js/models/gameState.js` only

**Changes**:
1. Line 58: Add `'accident'` to the `validPhases` array:
   ```js
   var validPhases = ['title', 'walking', 'atSource', 'atNPC', 'dialogue', 'silence', 'accident', 'paused', 'ending'];
   ```

**Acceptance Test**:
- [ ] `gameState.setPhase('accident')` sets `gameState.phase === 'accident'`
- [ ] Accident system triggers phase change without silent rejection
- [ ] `gameState.resume()` after accident returns to correct previous phase

**File Budget**: 1 file (`js/models/gameState.js`)
**Line Delta**: 1 line

---

### PACKET 003: Fix setLanguageConfusion Crash at Trip 22

**Priority**: P0 (blocks trip 22+)
**Bugs**: BUG-004
**Scope**: `js/engine/npcSystem.js` + `js/models/npc.js`

**Strategy A — Add the method (recommended)**:

1. In `js/engine/npcSystem.js`, add to the NPCSystem prototype:
   ```js
   npcSystemProto.setLanguageConfusion = function setLanguageConfusion(confused) {
     for (var i = 0; i < this.npcs.length; i++) {
       this.npcs[i].languageConfused = confused;
     }
   };
   ```

2. In `js/models/npc.js`, add `languageConfused: false` to NPC constructor defaults.

3. In `js/models/npc.js`, modify `generateRequest()` to check `this.languageConfused` and garble the request text when true. Simple approach: shuffle characters or replace with placeholder text like `"……水……给我……"`.

**Strategy B — Guard the call (fallback)**:

1. In `js/engine/narrativeEngine.js:226`, wrap in feature check:
   ```js
   if (Water.NPCSystem.setLanguageConfusion) {
     Water.NPCSystem.setLanguageConfusion(true);
   }
   ```

**Acceptance Test**:
- [ ] Trip 22 triggers without `TypeError`
- [ ] (Strategy A) NPC requests at trip 22 show garbled/confused text
- [ ] (Strategy B) Trip 22 passes without crash; NPCs behave normally

**File Budget**: 2-3 files
**Line Delta**: Strategy A ~15 lines; Strategy B ~3 lines

---

### PACKET 004: Fix pourToNPC Return Type Handling

**Priority**: P1 (state corruption)
**Bugs**: BUG-005
**Scope**: `js/main.js` only

**Changes**:
1. Around line 1068, replace:
   ```js
   amount = W.Physics.pourToNPC(container, amount);
   ```
   with:
   ```js
   var pourResult = W.Physics.pourToNPC(container, amount);
   var actualAmount = pourResult.amount;
   ```
2. Update all downstream uses of `amount` in the same block (lines 1070-1090) to use `actualAmount`:
   - `gameState.recordWaterGiven(npc.id, actualAmount)`
   - `W.Debt.addDebt(npc.id, actualAmount, ...)`
   - Any quality-related tracking: `pourResult.quality`

**Acceptance Test**:
- [ ] `typeof actualAmount === 'number'` after pourToNPC call
- [ ] `gameState.waterGiven[npcId]` accumulates correct numeric values
- [ ] No `NaN` in debt tracker after giving water on credit

**File Budget**: 1 file (`js/main.js`)
**Line Delta**: ~5 lines

---

### PACKET 005: Consolidate Dual NPC Arrays

**Priority**: P1 (state corruption — highest complexity)
**Bugs**: BUG-006
**Scope**: `js/main.js` primarily

**Changes**:
1. In `js/main.js` init function (~line 715), remove local NPC array creation:
   ```js
   // DELETE: var npcs = W.Data.createNPCs();
   ```
2. Ensure `Water.NPCSystem.initNPCs()` is called and `Water.NPCSystem.npcs` is populated.
3. Replace all references to local `npcs` variable with `Water.NPCSystem.npcs`:
   - NPC iteration loops
   - NPC at-location checks
   - Water-giving interactions
   - NPC rendering calls
4. If `W.NPCSystem.npcs` uses different object shape than local `npcs`, add adapter code or align the data structures.

**Acceptance Test**:
- [ ] Only one NPC array exists: `Water.NPCSystem.npcs`
- [ ] Giving water to an NPC updates trust on the same object NPCSystem reads
- [ ] NPCSystem summary at ending reflects actual gameplay interactions
- [ ] No local `var npcs = ...` remains in main.js

**File Budget**: 1 file (`js/main.js`)
**Line Delta**: ~30 lines changed (remove creation + update references)

**Warning**: This is the highest-risk packet. Extensive testing needed after.

---

### PACKET 006: Fix Debt Tracker and Direction Issues

**Priority**: P1 (state corruption)
**Bugs**: BUG-007, BUG-008
**Scope**: `js/main.js` + `js/engine/debtTracker.js`

**Changes**:

1. **BUG-008** — In `js/engine/debtTracker.js:59`, replace:
   ```js
   r.amount - r._paid || r.amount
   ```
   with:
   ```js
   Math.max(0, r.amount - (r._paid || 0))
   ```

2. **BUG-007** — Read `addDebt(npcId, amount, creditor)` signature in `debtTracker.js` to confirm:
   - Does `creditor='player'` mean "player is the creditor" or "player is the debtor"?
   - Based on context (player gave water to NPC → NPC owes player), correct call should identify NPC as debtor.
   - Fix `main.js:1088` accordingly once semantics are confirmed.

**Acceptance Test**:
- [ ] `debtTracker.getTotalDebt()` returns correct sum
- [ ] Fully-paid debt shows remaining = 0 (not original amount)
- [ ] `forgiveDebt` clears the correct direction
- [ ] Debt direction is semantically correct: NPC owes player when player gave water on credit

**File Budget**: 2 files
**Line Delta**: ~3 lines

---

### PACKET 007: Fix Weather Direct Mutation

**Priority**: P1 (potential rendering/transitions break)
**Bugs**: BUG-009
**Scope**: `js/engine/narrativeEngine.js` + `js/models/weather.js`

**Changes**:
1. In `js/engine/narrativeEngine.js:273-274`, replace direct mutation:
   ```js
   Water.Weather.type = 'overcast';
   Water.Weather.intensity = 0.3;
   ```
   with a method call:
   ```js
   if (Water.Weather.forceSet) {
     Water.Weather.forceSet('overcast', 0.3);
   }
   ```

2. In `js/models/weather.js`, add `forceSet` method:
   ```js
   W.Weather.prototype.forceSet = function forceSet(type, intensity) {
     this.type = type;
     this.intensity = intensity;
     this._transitionTimer = 0; // Reset transition state
   };
   ```

**Acceptance Test**:
- [ ] `rain_promise` event triggers without error
- [ ] Weather visuals update to overcast during/after event
- [ ] Weather transitions back to normal on next trip

**File Budget**: 2 files
**Line Delta**: ~8 lines

---

### PACKET 008 (Optional): P2/P3 Polish Fixes

**Priority**: P2/P3 (optional)
**Bugs**: BUG-010, BUG-011, BUG-012
**Scope**: Multiple files, small changes each

**Changes**:
1. **BUG-010**: Add `sourceId` to route nodes in `js/data/routes.js` (e.g., `sourceId: 'spring_north'` to node at spring location).
2. **BUG-011**: Move `Water.Grace.loadPreviousData()` before the NPC creation loop in `js/engine/npcSystem.js:52`.
3. **BUG-012**: Add `getPhase()` method to `js/engine/silenceSystem.js` and use it in `js/main.js:879`.

**Acceptance Test**:
- [ ] Source gauges render on map for water-source nodes
- [ ] Grace `loadPreviousData` called exactly once per init
- [ ] main.js uses `W.Silence.getPhase()` instead of `W.Silence._phase`

**File Budget**: 3 files
**Line Delta**: ~10 lines

---

## Execution Order

```
Round 1 (parallel — all P0):
  PACKET 001  ├── Start
  PACKET 002  ├── Start
  PACKET 003  └── Start

Round 2 (after Round 1 — P1):
  PACKET 004  ├── Start (independent)
  PACKET 005  ├── Start (depends on PACKET 001 for W.container rename)
  PACKET 006  ├── Start (independent)
  PACKET 007  └── Start (independent)

Round 3 (optional — P2/P3):
  PACKET 008  ── Start (anytime)
```

**Total estimated delta**: ~70-80 lines across 6-7 files. Well within 500-line budget.

---

## Summary

| Packet | Bugs   | Files | Lines | Risk  | Dependency |
|--------|--------|-------|-------|-------|------------|
| 001    | 001,002| 1     | ~20   | Low   | None       |
| 002    | 003    | 1     | ~1    | None  | None       |
| 003    | 004    | 2-3   | ~15   | Low   | None       |
| 004    | 005    | 1     | ~5    | Low   | None       |
| 005    | 006    | 1     | ~30   | Med   | Packet 001 |
| 006    | 007,008| 2     | ~3    | Low   | None       |
| 007    | 009    | 2     | ~8    | Low   | None       |
| 008    | 010-012| 3     | ~10   | Low   | None       |
