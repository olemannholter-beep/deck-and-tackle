# Project: Deck and Tackle — 2D Top-Down Overworld 8000x8000 Refactor & Expansion

## Architecture
- **Engine Framework**: HTML5 Canvas 2D + Vite + TypeScript in `deck-and-tackle`.
- **Coordinate Space**: 8000x8000 pixels with origin at top-left `(0, 0)` and Central Safe Harbor at `(4000, 4000)`.
- **Camera System**: Boundary-clamped camera tracking centered on player vessel with `[0, 8000]` extents.
- **Atmospheric Pipeline**: Dedicated `AtmosphereManager` driving screen-space dual-canvas darkness masking (`lightingCanvas`), volumetric rolling fog, dynamic vignette, boat lantern radius, and zone weather FX.
- **Spawner System**: `WhirlpoolSpawner` managing dynamic lifecycle of 6–8 concurrent whirlpools with annular proximity biasing (600–1800 px), despawn locks, and radial zone encounter binding.
- **Navigation UI**: Screen-space Brass Compass Rose HUD with live bearing and metric distance meter, plus full-screen interactive `SeaChartOverlay` parchment modal.

```
+-----------------------------------------------------------------------------------+
|                                  Main Engine Loop                                 |
|                                     (main.ts)                                     |
|  - Frame lifecycle & state transitions (MainMenu, Overworld, Battle, Shop)         |
|  - Dual canvas composition (this.canvas + this.lightingCanvas)                    |
|  - Input dispatch & key conflict isolation ([M] -> SeaChart, [U] -> Mute)         |
+-----------------------------------------------------------------------------------+
       |                       |                            |                |
       v                       v                            v                v
+---------------+    +--------------------+    +-------------------+   +------------+
| OverworldMap  |    | AtmosphereManager  |    | WhirlpoolSpawner  |   |    HUD     |
| (8000x8000)   |    | - 4 Radial Zones   |    | - 6-8 Global      |   | - Compass  |
| - Harbordock  |    | - Smoothstep lerp  |    | - 2-3 Local Bias  |   | - SeaChart |
| - View culling|    | - Rain & Miasma    |    | - State Machine   |   | - Badges   |
| - Drift cues  |    | - Lantern & Fog    |    | - Zone Fish Loot  |   +------------+
+---------------+    +--------------------+    +-------------------+
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Map Expansion (8000x8000) | Expand map bounds from 2400x1800 to 8000x8000 px | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Central Safe Harbor | Position harbor dock, pier, lantern, and boat spawn at (4000, 4000) | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Camera Clamping | Clamp camera viewport strictly within (0, 0) and (8000, 8000) | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Open-Water Drift Particles | Camera-anchored toroidal particle field indicating vessel velocity | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Wave Crest Ribbons | Directional undulating wave ribbons with foam caps drifting across water | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Bathymetric Contour Lines | Concentric dashed depth isolines at 600px intervals with depth markings | M1 | ORIGINAL_REQUEST §R1 |
| 7 | Viewport Culling | Cull terrain polygons, caustics, and props outside camera viewport | M1 | survey_overworld |
| 8 | Concentric Radial Zones Math | Calculate 4 concentric zones via Euclidean distance from (4000, 4000) | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Continuous Atmosphere Lerp | Smoothstep interpolation across water color, darkness, fog, and vignette | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Dynamic Lantern Scaling | Scale boat searchlight beam and ambient lantern radius inversely with distance | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Zone 3 Tempest Weather | Screen-space slanted rain streaks and storm squall effects | M2 | ORIGINAL_REQUEST §R2 |
| 12 | Zone 4 Whispering Miasma | Ethereal cyan swirling particles and oppressive claustrophobic vignette | M2 | ORIGINAL_REQUEST §R2 |
| 13 | Ephemeral Whirlpool Spawner | Dynamic spawner maintaining 6–8 active whirlpools globally | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Local Whirlpool Bias | Ensure 2–3 whirlpools spawn in the annular band 600–1800 px from vessel | M3 | ORIGINAL_REQUEST §R3 |
| 15 | Whirlpool State Machine | SPAWNING (2.5s) -> ACTIVE (35–55s) -> DESPAWNING (3.0s) | M3 | ORIGINAL_REQUEST §R3 |
| 16 | Despawn Proximity Lock | Lock whirlpool from despawning when player is nearby or fishing | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Post-Fishing Despawn | Immediately initiate 3.0s despawn upon successful battle return | M3 | ORIGINAL_REQUEST §R3 |
| 18 | Radial Encounter Binding | Bind Zone 1–4 species (perch, pike, gar, dagon) & ZoneProfiles to whirlpools | M3 | ORIGINAL_REQUEST §R3 |
| 19 | Brass Compass Rose HUD | HUD compass pointing toward (4000, 4000) with 8-wind bearing and metric distance | M4 | ORIGINAL_REQUEST §R4 |
| 20 | Interactive Sea Chart Modal | Full-screen parchment overlay toggled via M or Tab showing vessel, harbor, zones | M4 | ORIGINAL_REQUEST §R4 |
| 21 | Key Conflict Isolation | Remap MuteButton from [M] to [U] and add Tab to Input preventDefault | M4 | survey_hud |
| 22 | E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test runner covering all requirements | M5 | Project Pattern |
| 23 | Adversarial Hardening (Tier 5) | White-box stress-testing and boundary verification | M6 | Project Pattern |
| 24 | Forensic Integrity Audit | Systematic runtime tracing and static analysis verifying zero cheating | M6 | Project Pattern |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Overworld Engine Refactor & World Expansion | 8000x8000 map, harbor at (4000, 4000), camera clamping, viewport culling, and open-water drift cues (particles, wave ribbons, bathymetric contours) | none | DONE |
| M2 | Concentric Radial Zones & Atmospheric Scaling | Dedicated `AtmosphereManager`, Euclidean distance lookup, smooth continuous water/fog/vignette/lantern scaling, Zone 3 rain squall, Zone 4 whispering miasma | M1 | DONE |
| M3 | Dynamic Ephemeral Whirlpool Spawner | `WhirlpoolSpawner` (6-8 global, 2-3 local bias), 3-phase state machine, despawn locking, post-victory despawn, encounter profile binding | M1, M2 | DONE |
| M4 | Nautical Navigation HUD & Interactive Sea Chart | Brass Compass Rose HUD dial, bearing readout, live distance meter, `SeaChartOverlay.ts` toggled via M/Tab, key conflict fixes | M1, M2, M3 | DONE |
| M5 | E2E Testing Suite Creation | Requirement-driven test suite (Tiers 1-4), automated runner, test report | none (parallel track) | DONE |
| M6 | Final Verification, Adversarial Hardening & Audit | Run 100% E2E tests, Tier 5 challenger stress-tests, forensic integrity audit | M1, M2, M3, M4, M5 | DONE |

---

## Interface Contracts

### OverworldMap ↔ AtmosphereManager
- `AtmosphereManager.calculateAtmosphere(distanceToHarbor: number): AtmosphereParameters`
- Returns: `{ distanceToHarbor, zoneIndex, zoneName, zoneType, waterColor, darknessAlpha, lanternAmbientRadius, lanternBeamLength, lanternFlicker, fogDensity, fogColorRgb, vignetteInnerRatio, vignetteOuterRatio, vignetteDarkness, rainIntensity, miasmaIntensity }`
- `AtmosphereManager.renderWaterBackground(ctx, cam, width, height)`
- `AtmosphereManager.renderConcentricBathymetryRings(ctx, cam)`
- `AtmosphereManager.renderOpenWaterDriftCues(ctx, cam, boatVelocity)`
- `AtmosphereManager.renderLightingAndAtmosphere(ctx, lightingCanvas, lightingCtx, cam, boat, worldLanterns, fishingSpots, width, height)`

### OverworldMap ↔ WhirlpoolSpawner
- `WhirlpoolSpawner.update(dt: number, boatPos: Vector2, isFishing: boolean): void`
- `WhirlpoolSpawner.getActiveWhirlpools(): FishingSpot[]`
- `WhirlpoolSpawner.onFishingVictory(completedSpotId: string): void`
- `WhirlpoolSpawner.getNearbySpot(boatPos: Vector2): FishingSpot | null`

### HUD / SeaChartOverlay ↔ Game State
- `HUD.renderOverworld(ctx, width, height, boat, zoneType, zoneName, distanceToHarbor, bearingStr, angleToHarbor, isNearbySpot, spotName)`
- `SeaChartOverlay.toggle(): void`
- `SeaChartOverlay.isOpen(): boolean`
- `SeaChartOverlay.render(ctx, width, height, boatPos, boatHeading, activeWhirlpools, harborPos, islandColliders)`

---

## Code Layout
- `deck-and-tackle/src/engine/Input.ts`: Key input listener, prevents default browser behavior on Tab, Space, Arrows.
- `deck-and-tackle/src/engine/Camera.ts`: Viewport transforms and boundary clamping.
- `deck-and-tackle/src/game/overworld/OverworldMap.ts`: 8000x8000 world geometry, harbor dock, island colliders, viewport culling, and drift cue integration.
- `deck-and-tackle/src/game/overworld/AtmosphereManager.ts`: NEW module handling radial zone mathematics, continuous smoothstep interpolation, and atmospheric rendering passes.
- `deck-and-tackle/src/game/overworld/FishingSpot.ts`: Whirlpool entity with 3-phase state machine, scale/alpha animation, and despawn lock.
- `deck-and-tackle/src/game/overworld/WhirlpoolSpawner.ts`: NEW module managing candidate generation, density quotas, and encounter assignment.
- `deck-and-tackle/src/game/ui/HUD.ts`: Brass Compass Rose dial, harbor distance meter, zone badge.
- `deck-and-tackle/src/game/ui/SeaChartOverlay.ts`: NEW full-screen parchment modal chart.
- `deck-and-tackle/src/game/ui/MuteButton.ts`: Audio mute shortcut remapped to `[U]` to free `[M]`.
- `deck-and-tackle/src/main.ts`: Engine orchestrator coordinating loop, boat spawn at (4000, 4000), camera bounds, and diorama transitions.
