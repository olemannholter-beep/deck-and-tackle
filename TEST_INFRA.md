# E2E Test Infra: Deck and Tackle Overworld 8000x8000 Expansion

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived strictly from `ORIGINAL_REQUEST.md` (2026-10-25T11:46:20Z) and user-facing acceptance criteria.
- Zero dependencies on internal private engine variables; exercises the game through external entry points, coordinate states, and verifiable behaviors.
- Methodology: Category-Partition (Tier 1), Boundary Value Analysis (Tier 2), Pairwise Combinations (Tier 3), and Real-World Nautical Workloads (Tier 4).

---

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | 8000x8000 Map Dimensions & Harbor Center (4000, 4000) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Camera Boundary Clamping at (0,0) and (8000,8000) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Visual Drift Cues (Particles, Wave Crests, Bathymetry) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Concentric Radial Difficulty Zones (1200, 2400, 3600 px) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Atmospheric Transitions (Water, Fog, Lantern, Vignette) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Ephemeral Whirlpool Spawner Quotas (6-8 Global, 2-3 Local) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | Whirlpool State Machine (Spawn 2.5s, Active, Despawn 3.0s) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 8 | Despawn Proximity Locking & Post-Fishing Despawn | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 9 | Radial Zone Fish Encounter Binding (Perch, Pike, Gar, Dagon)| ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 10 | Brass Compass Rose Bearing & Harbor Metric Distance | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 11 | Interactive Sea Chart Overlay (M / Tab Toggle & Markers) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 12 | Build Integrity & Zero Regressions (npm run build) | ORIGINAL_REQUEST AC | 5 | 5 | ✓ |

---

## Test Architecture
- **Runner**: Node.js / TypeScript automated headless runner (`tests/run_e2e_overworld_tests.ts` or standalone JS runner).
- **Execution Command**: `npm run build && npx tsx tests/run_e2e_overworld_tests.ts`
- **Output**: JSON test report and standard console exit code (0 for pass, non-zero for failure).
- **Artifacts**: Publishes `TEST_READY.md` upon completion with full pass/fail matrix.

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Circumferential Voyage | F1, F2, F4, F5, F10 | High |
| 2 | Trench Deep Delve & Dagon Encounter | F1, F4, F5, F8, F9 | High |
| 3 | Whirlpool Proximity Lock & Post-Catch Despawn | F6, F7, F8, F9 | Medium |
| 4 | High-Speed Open Water Navigation via Compass & Sea Chart | F1, F3, F10, F11 | Medium |
| 5 | Multi-Zone Fishing Expedition (Harbor to Abyss to Harbor) | F1, F4, F6, F9, F10, F11 | High |

---

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥5 test cases per feature (12 features × 5 = 60 test cases)
- **Tier 2 (Boundary & Corner Cases)**: ≥5 test cases per feature (12 features × 5 = 60 test cases)
- **Tier 3 (Cross-Feature Combinations)**: ≥12 pairwise test cases
- **Tier 4 (Real-World Application Scenarios)**: ≥5 end-to-end voyage scenarios
- **Total Minimum Target**: ≥137 comprehensive test cases
