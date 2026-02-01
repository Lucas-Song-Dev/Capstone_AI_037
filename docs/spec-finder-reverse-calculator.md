# Spec Finder (Reverse Calculator) — What Changed

This document describes the changes made to add a **Spec Finder / Reverse Calculator** feature to the DDR5 Power Calculator frontend, how it works, and where to review the code.

---

## Summary of the feature

The **Spec Finder** page lets you enter target power values (Core and optional DIMM total), then it **searches for a DDR5 `memspec`** that best matches those targets. Once it finds a good candidate, you can click **Use in Calculator** to copy the found `memspec` into the existing flow and jump to **Configuration**.

---

## Where it lives in the UI

- **Route**: `/target-power`
- **Top navigation order** (left to right):
  1. Spec Finder
  2. Configuration
  3. Core Power
  4. DIMM Power
- **Home page CTA** now starts at Spec Finder (instead of Configuration)

Files involved:
- `frontend/src/pages/TargetPower.tsx` (main UI for reverse calculator)
- `frontend/src/components/Header.tsx` (nav bar ordering + new item)
- `frontend/src/App.tsx` (route registration for `/target-power`)
- `frontend/src/pages/Home.tsx` (CTA updated to start at Spec Finder)

---

## What inputs were added

The reverse calculator now has:

### 1) Targets (numeric inputs)
- **Target Total Core Power (W)** (required)
- **Target Total DIMM Power (W)** (optional)

### 2) Optimization controls (new inputs)
- **Dropdown**: Optimization Profile
  - Balanced (Core + DIMM)
  - Core-Optimized
  - DIMM-Optimized
- **Slider**: Core vs DIMM Emphasis
  - Only enabled when Profile = Balanced
  - Controls how much the solver prioritizes matching core vs DIMM totals

---

## What visuals were added

After a solution is found, the page shows a small “what’s happening” visualization using existing chart components:

- `TotalPowerDisplay` (big number for total core power with VDD/VPP)
- `PowerBreakdownChart` (bar chart showing contribution of core sub-components)

This is rendered on the Spec Finder page when a result exists.

---

## How the reverse solver works (current behavior)

### High-level approach

The reverse solver currently runs **in the frontend** (TypeScript) and performs a **random search**:

- For each vendor preset in `memoryPresets`:
  - Randomly perturb a subset of currents and voltages (within bounds)
  - Compute forward power (core + DIMM) using the existing calculator functions
  - Compute a weighted loss vs your target(s)
  - Keep the best candidate
- Return the overall best candidate among all presets

### Code location

- `frontend/src/lib/inverseDDR5.ts`

Key details:
- Uses existing forward models:
  - `computeCorePower(...)`
  - `computeDIMMPower(...)`
- Returns:
  - `optimizedMemspec`
  - `power` (core breakdown)
  - `dimmPower` (DIMM totals)
  - `loss`
  - base preset identifiers for traceability

---

## The “Use in Calculator” behavior

From the result card on Spec Finder:

- Clicking **Use in Calculator**:
  - Calls `setMemspec(...)` in `ConfigContext`
  - Navigates to `/configuration`

This makes it easy to “accept” the found spec and then tweak it in the normal configuration UI.

Primary file:
- `frontend/src/pages/TargetPower.tsx`

---

## Tests added/updated

### New test
- `frontend/src/lib/inverseDDR5.test.ts`

What it checks (sanity):
- If you take a known preset, compute its forward core + DIMM totals, and feed those totals into the inverse search, the solver should recover something **reasonably close** (within a tolerance).

### Existing tests
All existing frontend tests were preserved and still pass.

---

## How to run tests/build

From `frontend/`:

```bash
npm test
npm run build
```

---

## Notes about backend/Python

This Spec Finder feature was intentionally adjusted to be **deployable on GitHub Pages** (static hosting), which means the reverse solver runs client-side.

If your `main` branch now includes Python backend changes for calculations, those are separate from this Spec Finder’s current frontend-only inverse search implementation.

If you want the Spec Finder to call a backend inverse endpoint instead (for more advanced optimization), the integration point would be:
- Replace the `inverseSearchForTarget(...)` call in `frontend/src/pages/TargetPower.tsx` with a `fetch(...)` to your API.

---

## Quick verification checklist

- Navigation shows **Spec Finder** first and it routes to `/target-power`
- Spec Finder accepts:
  - Core target
  - Optional DIMM target
  - Dropdown profile
  - Slider emphasis (enabled only for Balanced)
- Clicking **Find Matching Spec** populates:
  - Base preset name
  - Loss value
  - Resulting core and DIMM totals
  - Charts on the right side
- Clicking **Use in Calculator**:
  - Brings you to `/configuration`
  - The calculator uses the new memspec in Core/DIMM pages





