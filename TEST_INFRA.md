# E2E Test Infra: Fishing Zones Environment Redesign

## Test Philosophy
- Opaque-box, requirement-driven validation derived directly from `ORIGINAL_REQUEST.md` (R1–R4).
- Independent verification across both the TypeScript game engine (`deck-and-tackle`) and the standalone preview (`side_view_battle_redesign_preview.html`).
- Methodology: Systematic 4-tier testing (Category-Partition, Boundary Value Analysis, Pairwise Combinations, Real-World Workloads).

## Feature Inventory & Test Mapping
| # | Feature | Requirement | Tier 1 (Specs) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Scenarios) |
|---|---------|-------------|:--------------:|:-------------------:|:----------------------:|:------------------:|
| 1 | Zone 1 Coastal Atmosphere | R1: Calm stormy night sky, lighthouse cliff | 5 | 5 | ✓ | ✓ |
| 2 | Zone 2 Reef Atmosphere | R1: Twilight fog, dock pilings, kelp | 5 | 5 | ✓ | ✓ |
| 3 | Zone 3 Trench Atmosphere | R1: Tempest squall, rain haze | 5 | 5 | ✓ | ✓ |
| 4 | Zone 4 Cavern Rock Ceiling | R1: Subterranean rock vault, stalactites, no open sky | 5 | 5 | ✓ | ✓ |
| 5 | Zone 1 Wave Swells | R2: Misty rolling swell, low freq, pale foam | 5 | 5 | ✓ | ✓ |
| 6 | Zone 2 Moonlit Wave Chop | R2: Moonlit crest ribbons, shallow chop | 5 | 5 | ✓ | ✓ |
| 7 | Zone 3 Storm Breakers | R2: Crashing breakers, whitecap spray | 5 | 5 | ✓ | ✓ |
| 8 | Zone 4 Churning Seafoam | R2: Churning foam, boiling froth, heat bubbles | 5 | 5 | ✓ | ✓ |
| 9 | Water Column Color Palettes | R3: Slate green, emerald teal, abyssal navy, sulfurous amber | 5 | 5 | ✓ | ✓ |
| 10 | Environmental Props & Fauna | R3: Anemones, galleon wreck, kraken, chimney vents, minnows | 5 | 5 | ✓ | ✓ |
| 11 | Engine Dynamic Binding | R4: SideViewDiorama zone switching | 5 | 5 | ✓ | ✓ |
| 12 | Preview Stage Synchronization | R4: Buttons 1..4 switch all layers dynamically | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Node v20 built-in test runner (`node --test tests/e2e/*.test.mjs`) supplemented by Python asset/DOM validation (`py tests/e2e/verify_preview.py`).
- **Test Suite Location**: `c:\Users\olema\Desktop\testing topdown\tests\e2e\`
- **Execution Script**: `npm run build && node --test tests/e2e/zone_e2e.test.mjs`
- **Output / Reporting**: TAP / spec reporter with exit code 0 on 100% pass.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Expected Outcome |
|---|----------|--------------------|------------------|
| S1 | Coastal Perch Excursion | F1, F5, F9, F10, F11, F12 | Calm dark sky, lighthouse cliff on horizon, gentle rolling swell, slate water |
| S2 | Sunken Reef Pike Hunt | F2, F6, F9, F10, F11, F12 | Eerie twilight dusk, dock pilings, moonlit wave chop, emerald water, kelp |
| S3 | Deep Abyss Galleon Expedition | F3, F7, F9, F10, F11, F12 | Dark tempest squall, storm breakers with spray, galleon wreck, anemones, kraken |
| S4 | Subterranean Dagon Lair Descent | F4, F8, F9, F10, F11, F12 | Enclosed rock vault ceiling (NO sky/moon), stalactites, boiling foam, vents |
| S5 | Rapid Stage Cycling (1 &rarr; 2 &rarr; 3 &rarr; 4 &rarr; 1) | F11, F12 | Immediate switch of all visual layers without texture popping or stale state |

## Coverage Thresholds
- Tier 1: ≥ 60 test cases (≥5 per feature across 12 features)
- Tier 2: ≥ 60 boundary and edge test cases (depth boundaries, missing parameters, invalid zones)
- Tier 3: Pairwise combinations of depth transitions, species assignments, and stage toggles
- Tier 4: ≥ 5 realistic application workflows
