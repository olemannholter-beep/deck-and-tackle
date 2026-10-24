# Deck & Tackle — Project Task Tracker & Roadmap

**Status:** In Development  
**Integrity Mode:** Development  
**Active Phase:** Phase 2 (Completed & Updated)

---

## Roadmap & Strict Phase Gating

- [x] **Phase 1: Top-Down Overworld Boat Exploration & Seamless View Transition** *(COMPLETED & VERIFIED)*
  - [x] Engine & Environment Setup (Vite + TypeScript + Canvas 2D)
  - [x] Eldritch Video Main Menu & Interactive Plaque Button:
    - [x] Dedicated `GameState.MainMenu` state in `GameStateManager`; the game boots directly into the Main Menu
    - [x] High-resolution video background (`/video/main_menu.mp4`) autoplaying seamlessly on canvas with aspect-ratio cover and vertical clamping
    - [x] Interactive stone plaque button "DELVE INTO THE DEPTHS": normalized coordinate hit-testing, dynamic pointer cursor, eerie cyan bioluminescent aura, stone bevel highlights, engraved rune shimmer, rising motes, and click shockwave
    - [x] Click feedback (`sfx_button_click`), smooth video audio fade, and seamless dark wipe transition directly into Overworld Boat Exploration
  - [x] Decoupled Visual Sockets Architecture (`IVisualSocket`, `BoatVisualSocket`, `FishingSpotVisualSocket`, `FishVisualSocket`, `DockVisualSocket`)
  - [x] Top-Down Overworld Map
    - [x] Water depth zones: Shallow Reeds, Open Lake, Deep Abyssal Trench
    - [x] Shoreline colliders & island geometry
    - [x] Harbor Dock zone & trigger
  - [x] Smooth 2D Top-Down Boat Controller
    - [x] WASD movement with relaxed, controlled cruising pace (slowed down from high speeds for comfortable exploration)
    - [x] Gentle water momentum, drag, acceleration, and angular steering/drift
    - [x] Decoupled boat placeholder visual socket (for future sprite swap)
    - [x] Weathered Worn-Down Boat & Detailed Angler (Chipped paint, riveted repair patch, multi-tone aged planks, coiled rope, tackle box, and angler in yellow sou'wester hat & green oilskins in both top-down & side-profile views)
    - [x] Lovecraftian / Shadow over Innsmouth & Cthulhu Thematic Transformation:
      - [x] Atmospheric coastal map: rolling mist/fog banks, craggy black basalt islands, barnacles, sunken cyclopean monolith with glowing emerald runes
      - [x] Innsmouth Wharves & Chandlery Storefront Redesign (Inspired by Reference Art):
        - [x] Left Cutaway Shack: A-frame timber rafters, cobwebs, hanging meat hooks, brick chimney, wall lantern with amber glow, and attic loft shelf with specimen jars & chests
        - [x] Subterranean Green Aquarium: Heavy riveted iron frame with diagonal wire mesh grating, glowing murky emerald water, submerged animated aberrations (writhing kraken tentacles, surface viperfish, deep-sea leviathan), rising bubbles, floating specimen tags, dangling chains, and stone foundation with green lamp
        - [x] Shopkeeper Room & Cellar: Old salt shopkeeper in yellow sou'wester hat & oilskin slicker smoking pipe with rising smoke curls, hurricane lantern on slatted crate casting warm amber radial light, wooden chest, and basement crawlspace with hanging rope coil & jars
        - [x] Right Open Grimoire Ledger: Two-page open aged-parchment ledger book bound in heavy leather with stitched rope trim and brass corner caps; Left Page (Black Iron Winch 25g, Kelp Snare Drag 45g, Void Pump 45g, Cyclopean Gantry 80g), Right Page (Eldritch Lure 45g, Dagon's Barbed Hook 35g, Abyssal Chum 15g); stamped Roman numeral stamina medallions, woodcut item engravings, interactive price plaque purchase buttons, Inspect Ledger mode, and Return to Vessel [ESC]
        - [x] Vessel & Angler Upgrades (Stamina & Line Health):
          - [x] Dedicated "⚙ UPGRADES" tab on the shop header alongside "⚓ LEDGERS" and "★ TECHNIQUES"
          - [x] Left Page (Angler Stamina & Vigor): Current Max Stamina plaque with 5 watch-style brass energy orbs (cyan glow), 3 progressive upgrade tiers (Brass Diver's Bellows 40g [+1], Eldritch Heart Conduit 80g [+1], Leviathan's Pulse 150g [+1]), purchase validation, and instant stamina economy expansion
          - [x] Right Page (Line Integrity & Reinforcement): Current Max Line Integrity plaque with braided wire tensile gauge, 4 progressive reinforcement tiers (Tar-Boiled Cordage 25g [+5], Braided Steel Wire Line 45g [+5], Kraken Sinew Filaments 70g [+5], Void-Bound Tensile Weave 100g [+5]), purchase validation, and instant line health expansion
          - [x] Seamless Battle Integration: `BattleEngine` and `SideViewDiorama` combat HUD immediately initialize every fight with the player's upgraded Max Stamina and Max Line Health
          - [x] Deck Viewer Integration: Displays vessel capacity summary bar (`Max Stamina: X ⚡ • Max Line: Y HP • Active Deck: Z Cards`)
      - [x] Eldritch fish species (*Innsmouth Perch*, *Blighted Pike*, *Abyssal Void-Gar*) with uncanny eyes, bioluminescent runes, and saw-teeth
      - [x] Occult grimoire technique cards with brass corner brackets, eldritch aura, and mythos lore descriptions
  - [x] Interactive Fishing Spot & Harbor Shop Nodes
    - [x] Interactive Fishing Spot nodes with animated bubbling water ripples
    - [x] Harbor Shop trigger at the dock
  - [x] GameStateManager & View Transition
    - [x] States: `OverworldExploration`, `SideViewBattle`, `HarborShop`
    - [x] Interaction trigger ('E' / Space) at Fishing Spot
    - [x] Power Throw Minigame before casting (oscillating power meter with sweet spot, rating, and dynamic launch distance)
    - [x] Interactive Bobber Minigame before battle (Casting arc -> Waiting -> Nibble -> Sudden Bite timing ring -> Hooked!)
    - [x] Dynamic Autonomous Swimming Fish in side view (patrol waypoints, banking pitch, thrash surges, trailing bubbles)
    - [x] Rich Side-View Diorama Details (Volumetric god-rays, multi-ridge parallax sky, seagulls, lighthouse beacon, caustics, seabed flora, underwater vents)
    - [x] Diverse Ambient Fish Fauna (Silvery minnow schools, midwater cruisers, benthic bottom-skimming catfish with barbels, glowing abyssal jellyfish with trailing tentacles, emerald reed-fry; fixed sprite facing orientation so all fish swim head-first in direction of velocity)
    - [x] Debug "Return to Overworld" button with camera/input state restoration (zero camera or input bugs)

---

- [x] **Phase 2: Slay the Spire-Style Angling Card Battle Engine & Lovecraftian Combat Juice** *(COMPLETED & POLISHED)*
  - [x] Data-Driven Architecture (`CardData`, `FishData`, Card registry, Fish registry)
  - [x] Once-Per-Battle Mythos Relic Techniques & Blood Backlash System:
    - [x] Data-driven `oncePerBattle: true` and `tensionSelf: number` (Line Backlash) on Technique cards
    - [x] Dedicated `exhaustPile` in `BattleEngine`; playing a Technique permanently exhausts it for the remainder of that fight, preventing it from ever being redrawn after reshuffles
    - [x] Starter Technique added to player vessel: *Desperate Haul* (1 stamina, 8m pull, -2 Line Backlash, once per fight)
    - [x] Occult Card Styling in `CardVisualSocket`: Deep purple grimoire borders, `[★ TECHNIQUE (ONCE) ★]` header tag, stark crimson `⚡ BACKLASH: -X LINE` pill, and custom woodcut engravings for each technique
    - [x] Visceral Technique Feedback in `SideViewDiorama`: Occult purple ink shockwave (`#c084fc`), blood backlash sparks, heavy screen-shake (18), red screen flash vignette, and `"TECHNIQUE EXHAUSTED"` + `"-X Line Backlash!"` floating combat text
    - [x] Bottom Battle HUD `EXHAUSTED (X)` pile indicator tracking consumed once-per-battle arts
    - [x] Both *Exhausted* (-X Thrash Power) and *Chummed* (+3m to all pulls, X turns) debuff badges rendered in fish telemetry
  - [x] Storefront Catalogue & Grimoire Deck Viewer Overhaul:
    - [x] Storefront Right Page features powerful Mythos Techniques: *Eldritch Lure* (+6m, 4 Exhausted, -2 Line, 45g), *Dagon's Barbed Hook* (+14m, -3 Line, 35g), *Abyssal Chum* (6 Chummed, -2 Line, 15g)
    - [x] Storefront Left Page features Heavy Tackle Ledgers: *Black Iron Winch* (12m pull), *Kelp Snare Drag* (3 slack + Draw 1 card), *Void Pump* (16m pull), *Cyclopean Gantry* (24m pull)
    - [x] Deck Viewer modal accurately categorizes Left Page as Active Vessel Tackle (grouping all owned winches/drags) and Right Page as Inscribed Relic Techniques with count, once-per-fight badges, and backlash stats
  - [x] Simplified Starter Deck (Handful of simple cards: 3x Reel In, 2x Slack Drag, 1x Quick Tug, 1x Brace, 1x Desperate Haul)
  - [x] Gold Economy & Harbor Card Shop:
    - [x] Catching fish awards Gold directly to wallet
    - [x] Harbor Tackle Shop sells advanced cards for gold (Power Winch, Feather Lure, Spring Drag, Tension Strike, Deep Pump, Chum Scatter, Titan Crane)
    - [x] Deck Viewer modal to inspect current permanent deck
  - [x] Turn-Based Angling Combat Loop
    - [x] Distance to Boat (Enemy HP: Innsmouth Perch 30m, Blighted Pike 52m, Abyssal Gar 75m; Reel In tuned to 4m, Snap Strike to 2m, Black Iron Winch to 12m)
    - [x] Line Integrity (Player HP: 20/20, reduced to 20 for tight, punishing encounters; attack-only playstyles mathematically snap line by Turn 4)
    - [x] Line Slack (Block: absorbs fish thrash tension damage; rebalanced: Slack Drag 4, Brace 8, Kelp Snare Drag 3 so tension cards mitigate rather than completely negate all damage)
    - [x] Angler Stamina (Energy: 2/2 per turn, reduced from 3 to 2 for tighter tactical decision-making)
    - [x] Draw Pile, Hand (5 cards drawn per turn), Discard Pile & reshuffle
    - [x] Fish Intent Telegraph (Thrash tension damage, Deep Dive distance increase, Rest, etc.)
    - [x] Status Effects (Exhausted reduces fish thrash power, Chummed)
    - [x] Card Play Mechanics (Click to select & play, 1-5 number keys, stamina deduction, floating combat feedback)
    - [x] Interactive End Turn button (`[END TURN]` + Spacebar shortcut)
    - [x] Dynamic Fishing Line reacting physically to distance changes (shifting left/right in side view)
  - [x] 3 Distinct Fish Species with tailored intent patterns:
    - Sunny Perch (Shallow Reeds: 28m distance)
    - River Pike (Open Lake: 45m distance)
    - Abyssal Gar (Abyssal Trench: 65m distance)
  - [x] Battle Result Screens (Catch Victory with Gold reward & Line Snapped Defeat with return to Overworld)
  - [x] Lovecraftian Visual Polish & Cosmic-Horror "Game Juice" Upgrade Pass:
    - [x] Desaturated, oppressive cosmic-horror palette (bile greens, abyssal blacks, bruised purples, slate greys, rusted iron)
    - [x] Screen-wide post-processing: claustrophobic dark vignette & subtle atmospheric film grain / miasma dust
    - [x] Overworld Visual Rendering System Overhaul (Lovecraftian Hand-Drawn Murk & Atmosphere):
      - [x] Organic Shorelines & Terrain: Completely eliminated flat circular island primitives; replaced with 13 precomputed multi-harmonic jagged rock and island polygons, multi-band shore edges (dark craggy rock, wet mud ring `#1e2b20`, animated lapping foam outline `sin(time * 2.6 + theta * 5)`, gnarled dead pines with cast shadows, rotting jetty planks, and sunken monoliths with glowing runes `#2dd4bf`)
      - [x] Murky Abyssal Water & Caustics: Deep midnight-abyss base `#040914`, shallow turquoise-scum gradients (`#0e2b24`), abyssal trench core (`#010307`), animated winding caustic drift lines (alpha 0.14-0.22), bioluminescent kelp patches, and 4 submerged writhing deep-sea tentacle silhouettes with pulsing spines
      - [x] Swirling Bioluminescent Fishing Spots: Spiraling eldritch vortexes / whirlpools (`#2dd4bf` / `#5eead4`) with 4 inward spiral arms, central abyssal void eye, pulsating ripple rings, rising glowing motes, lurking beast silhouette, and proximity occult runes
      - [x] Dynamic Lighting & Volumetric Rolling Fog: Offscreen darkness mask (`rgba(2, 6, 14, 0.84)`) with `destination-out` light pool punching for boat directional conical searchlight beam (490px forward reach, feathered 4-pass penumbra, amber/green bloom following boat heading) + ambient hull circle, and 4 world lanterns (Harbor Dock, Central Shrine, Spire Beacon, Outpost); 3 parallax layers of low-opacity grey-green rolling fog patches drifting at 7, 17, and 27 px/s with camera parallax; heavy claustrophobic camera vignette and 45 drifting bioluminescent spores particle system
      - [x] Full Mechanical Integrity: Boat physics, shoreline collisions against jagged coastlines, E/Spacebar interaction triggers at fishing spots and harbor dock, and screen HUD counters remain fully functional and error-free
    - [x] Side-View bruised-purple/bile-green storm sky with heavy rain squalls, distant lighthouse beacon, faint eerie moonbeams piercing abyssal depths, parallax sunken cyclopean monoliths & writhing deep-sea tendrils, rising dark mire bubbles, and churning dark surface waves
    - [x] Weathered rotting dory hull with rusted iron fittings, algae waterline, flickering yellow-green oil lantern casting a fragile light pool against darkness, churning dark wake trail, hunched rain-slicked angler silhouette, and violent rod bending & vibration under Line Tension
    - [x] Articulated mutated Lovecraftian fish silhouettes (Innsmouth Perch, Blighted Pike, Abyssal Void-Gar) with multi-segment spine undulation, multiple uncanny glowing eyes, needle teeth, exposed ribs, writhing tendrils, pulsing bioluminescent runes, and fin spasms
    - [x] Waterlogged salt-stained grimoire / woodcut tarot cards with tarnished iron/bone borders, woodcut art engravings, and sickly eldritch aura glows (blood crimson, abyssal cyan, occult violet)
    - [x] Curved Hand Arc fan layout with smooth hover lift, 3D mouse perspective tilt, scale highlight, and keyboard badges
    - [x] Visceral Combat Feedback: jagged iron-hook slash VFX, dark inky brine bursts, ward wave sigils, heavy screen-shake on pulls & thrashes, violent crimson screen-edge damage flash vignette on Line Integrity loss, line water cut spray particles, and stark antique floating combat text with pop bounce
  - [x] Comprehensive Lovecraftian Audio Engine & Horror SFX Integration:
    - [x] Decoupled `AudioManager` singleton managing Web Audio API gain graph, low-latency polyphonic SFX caching, and autoplay gesture unlocking
    - [x] Seamless Overworld Slow Suite soundtrack loop with dynamic volume ducking on battle encounters and major impacts
    - [x] Speed-modulated boat engine audio (vintage 312 RPM diesel chug) and ambient distant foghorn / haunted bell tolls
    - [x] Collision audio triggers (dock bump & wooden hull creak upon pier/island impacts)
    - [x] Angling & Bobber minigame SFX (rod cast whip, cavernous water plunge, uncanny line scrape nibble, and explosive bite breach)
    - [x] Card combat audio feedback (grimoire parchment draw, mechanical reel clicks, drag slip hiss, tension strike, fish tail thrash, abyssal deep dive, microtonal line scream warning, and gunshot line snap)
    - [x] Economy & UI audio (Innsmouth cursed gold coins on victory/purchase, brass UI clicks, and HUD audio status badge with [M] toggle)

---

### [STRICT GATE: DO NOT WRITE CODE OR CREATE FILES FOR PHASE 3 UNTIL PHASE 2 IS EXPLICITLY TESTED AND APPROVED]

- [ ] **Phase 3: Deckbuilding Progression, Harbor Shop, Relics & Polish** *(QUEUED - LOCKED)*
  - [ ] Post-Catch Rewards & Keepnet (1-of-3 Card Reward screen, keepnet inventory)
  - [ ] Harbor Shop & Campfire Dock (Sell fish for Gold, buy cards/Tackle Relics, repair line, card removal)
  - [ ] Field Journal & Boss Encounter (Catch tracking, 1 Legendary Boss Fish with multi-phase intents)
