# RISK_REGISTER — 挑水人的午后

Generated: 2026-05-01
Worker: game8-beyond-categorical-legacy-planner

---

## Risk Classification

- **Decision Required**: Needs manager/engineer decision before fix can proceed.
- **Assumption Logged**: Planner made an assumption; verify before implementing.
- **Watch Item**: Low risk now, may escalate if conditions change.

---

## RISK-001: Design Document Describes Entirely Different Game

**Severity**: CRITICAL — Architectural
**Category**: Decision Required

**Description**: The design document context provided with the Worker Packet describes a game called "范畴之外" (Beyond the Categorical) featuring a **2.5D isometric Tower of Babel puzzle** with grid-based movement, room navigation, and categorical logic puzzles. The actual implementation is **"挑水人的午后" (The Water Carrier's Afternoon)** — a top-down water-carrying simulation with NPC interactions, route traversal, and a narrative about water distribution ethics.

These are two completely different games. The codebase has nothing to do with the design document.

**Impact**:
- Any fixes derived from the design document will be wrong for this codebase.
- Game mechanics, NPC behavior, and narrative progression described in the design doc do not match implementation.
- The "范畴之外" subtitle on the title screen appears to be a thematic label, not the game name.

**Recommendation**: **Confirm with manager** — is this the correct codebase? Was the wrong design doc provided? Should the planner proceed with fixing the implementation as-is (water carrier game), or should the implementation be rewritten to match the design doc (Babel puzzle)?

**Status**: UNRESOLVED — Awaiting manager decision.

---

## RISK-002: Dual NPC System Architectural Ambiguity

**Severity**: HIGH
**Category**: Decision Required

**Description**: The codebase has two NPC management systems:
1. `main.js` creates a local `npcs` array from `W.Data.createNPCs()`
2. `npcSystem.js` creates `Water.NPCSystem.npcs` via `initNPCs()`

These produce separate object instances. It's unclear which was intended as the authoritative source. The NPCSystem has richer behavior (trust tracking, request generation, summary for endings), but main.js directly handles water-giving and rendering using its local array.

**Impact**:
- Fixing BUG-006 requires choosing one system as canonical. The wrong choice could break either the gameplay loop (main.js) or the ending calculation (NPCSystem).
- Consolidating to NPCSystem's array requires verifying that main.js's NPC interaction code works with NPCSystem's NPC objects (different construction path, potentially different shape).

**Recommendation**: **Consolidate to `Water.NPCSystem.npcs`** as single source. NPCSystem has more complete NPC lifecycle management. But verify object shapes match before removing main.js's array.

**Status**: UNRESOLVED — Needs verification of NPC object shape compatibility before PACKET 005 execution.

---

## RISK-003: Debt Tracker Semantic Ambiguity

**Severity**: MEDIUM
**Category**: Assumption Logged

**Description**: `W.Debt.addDebt(npcId, amount, 'player')` at `main.js:1088` — the third argument's semantics are unclear. Is `'player'` the creditor (player is owed) or the debtor (player owes)? The context (player gave water to NPC) suggests NPC is in debt to player, meaning player is creditor. But the argument name and usage in `debtTracker.js` needs careful reading.

**Impact**: If the assumption is wrong, debt forgiveness and collection will target the wrong party. Not crash-inducing, but silently produces wrong economic behavior.

**Recommendation**: Implementer must read `debtTracker.js` fully and confirm semantics before fixing BUG-007. Add a code comment documenting the convention.

**Status**: ASSUMPTION — Planner assumes `'player'` means creditor based on context. Verify before fix.

---

## RISK-004: No Automated Test Coverage for Bug Fixes

**Severity**: MEDIUM
**Category**: Watch Item

**Description**: The existing test suite (`test.mjs`) is described as a "基础玩法测试框架" (basic gameplay test framework) that's awaiting game implementation. It likely provides minimal or no coverage for the specific code paths affected by these bugs.

**Impact**: Bug fixes cannot be regression-tested automatically. Each fix relies on manual browser testing.

**Recommendation**: Implementation worker should test each fix manually in browser. Consider adding targeted tests for P0 fixes if test infrastructure permits.

**Status**: WATCH — No action required from planner.

---

## RISK-005: Packet 005 (NPC Consolidation) Has Highest Regressive Potential

**Severity**: MEDIUM
**Category**: Watch Item

**Description**: PACKET 005 (consolidating dual NPC arrays) touches ~30 references across main.js and is the highest-complexity fix. If NPC object shapes differ between the two creation paths, the consolidation could break NPC rendering, interaction, or water-giving in ways that are hard to trace.

**Impact**: Could introduce new bugs if NPC object shapes are incompatible. These would manifest as undefined property access or wrong rendering during NPC interactions.

**Recommendation**:
1. Before executing PACKET 005, print both NPC objects to console and compare shapes.
2. If shapes differ, write adapter code rather than blindly swapping references.
3. Test all NPC interaction flows after the fix: greeting, water request, water give, refuse, trust change.

**Status**: WATCH — Implementer should exercise extra caution on this packet.

---

## RISK-006: Grace System Cross-Game Data May Be Stale

**Severity**: LOW
**Category**: Watch Item

**Description**: The grace system reads from `localStorage` keys with prefix `shinar_*` to share data across games in the microgame collection. If no other games have been played, or if localStorage was cleared, the grace system may have no prior data, making its cross-game compassion tracking meaningless for the first playthrough.

**Impact**: Grace-based ending calculations may produce unexpected results if no prior game data exists. Not a crash, but the "hidden compassion tracking" feature will have no input.

**Recommendation**: Verify grace system handles empty/missing localStorage gracefully. No fix likely needed — this is expected behavior for first play.

**Status**: WATCH — No action required.

---

## RISK-007: File Budget Underutilized

**Severity**: LOW (positive)
**Category**: Informational

**Description**: The worker packet allows max 500 net line changes. The planned fixes total ~70-80 lines across 6-7 files. This leaves significant headroom (~420 lines) for unexpected fixes discovered during implementation.

**Impact**: Positive — ample budget for implementation worker to address issues found during testing.

**Status**: INFORMATIONAL — No action.

---

## Summary

| ID     | Severity | Category           | Status      | Action Required               |
|--------|----------|--------------------|-------------|-------------------------------|
| RISK-001 | CRITICAL | Decision Required | UNRESOLVED  | Manager: confirm correct codebase vs design doc |
| RISK-002 | HIGH     | Decision Required | UNRESOLVED  | Verify NPC object shapes before PACKET 005 |
| RISK-003 | MEDIUM   | Assumption Logged | ASSUMPTION  | Verify debtTracker semantics before PACKET 006 |
| RISK-004 | MEDIUM   | Watch Item        | WATCH       | Manual testing required       |
| RISK-005 | MEDIUM   | Watch Item        | WATCH       | Extra caution on NPC consolidation |
| RISK-006 | LOW      | Watch Item        | WATCH       | Grace system handles empty data |
| RISK-007 | LOW      | Informational     | INFO        | Budget headroom available     |
