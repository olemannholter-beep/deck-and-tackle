# ⚓ Deck & Tackle

> *"What sleeps beneath never starves."*

**Deck & Tackle** is a dark Lovecraftian 2D game combining top-down overworld nautical exploration with an eerie side-view diorama card battler and fishing RPG. Built entirely with TypeScript, HTML5 Canvas 2D, and the Web Audio API.

---

## 🌊 Overview & Story

In the fog-shrouded waters off the coast of Innsmouth, an old solitary angler steers a weathered trawler into abyssal depths. Cast your line into murky currents, contend with monstrous aberrations thrashing in the deep, inscribe forbidden occult angling techniques into your grimoire ledger, and upgrade your vessel to survive what lurks in the lowest trenches.

---

## 🎮 Core Features

### 1. 🕯️ Atmospheric Top-Down Overworld
* **Dark Murky Depths**: Deep midnight abyss waters fading into shallow turquoise scum edges, with procedural organic shorelines and jagged basalt rocks.
* **Dynamic Lantern Lighting**: The player's boat lantern casts a directional cone of warm illumination that cuts through a heavy camera vignette and dynamic darkness mask.
* **Rolling Volumetric Fog & Spores**: Multi-layered semi-transparent mist patches drifting across the water accompanied by drifting bioluminescent spores.
* **Hydrodynamic Boat Controller**: Smooth acceleration, angular drag, water momentum, and shoreline collision resolution.

### 2. 🎣 Side-View Diorama & Fishing Minigames
* **Power Throw Casting**: Oscillating timing meter with dynamic launch power and sweet-spot bonus.
* **Interactive Bobber Minigame**: Visual water ripples, nibble twitches, and sudden bite timing rings before engaging quarry.
* **4 Distinct Water Depth Zones**:
  * **Zone 1: Coastal Shoals (0–30m)** — Slate green shallows, moonlit clouds, cliffside lighthouse.
  * **Zone 2: Kelp Shallows (30–60m)** — Emerald murky waters, curling chop, dense kelp forests.
  * **Zone 3: Abyssal Trench (60–100m)** — Navy darkness, rain haze, crashing breakers, sunken galleon ruins.
  * **Zone 4: Subterranean Sea Cave (100m+)** — Enclosed rock vaults, stalactites, volcanic bubbles, sulfurous amber currents.
* **Dynamic Fish Simulation & Ambient Fauna**: Animated quarry banking into turns, swimming forward in direction of travel, accompanied by schools of minnows and deep-sea benthic cruisers.

### 3. 🃏 Tactical Card Battler & Tension System
* **Stamina & Resource Economy**: Spend Stamina to play Reel, Drag, and Strike cards.
* **Line Integrity vs. Quarry Distance**: Reel the fish closer (0m = catch victory) while preserving your boat's Line Integrity against violent thrash tension.
* **Line Slack (Block)**: Absorb sudden thrashing tension without snapping your line.
* **Mythos Relic Techniques (Once-Per-Battle)**:
  * Highly potent abilities (e.g. *Desperate Haul*, *Dagon's Barbed Hook*, *Eldritch Lure*, *Abyssal Chum*).
  * Consumes line integrity on play as self-backlash damage.
  * Permanently exhausts from the deck for the duration of that encounter upon use.

### 4. 🛒 Innsmouth Chandlery & Grimoire Ledger (O. Marsh & Sons)
* **Cutaway Shanty Diorama**: Timber rafters, attic specimen jars, hanging chains, and a living green subterranean aquarium tank housing submerged tentacles and leviathans.
* **Shopkeeper Room**: Sea-worn merchant in oilskins beside a glowing counter lantern.
* **Three-Tab Grimoire Ledger**:
  * **⚓ Ledgers**: Reusable vessel hardware (Black Iron Winch, Kelp Snare Drag, Void Pump, Cyclopean Gantry).
  * **★ Techniques**: Purchasable once-per-battle mythos relic cards with line backlash warnings.
  * **⚙ Upgrades**: Permanent vessel & angler enhancements:
    * **Angler Stamina & Vigor**: Increase max stamina per turn (up to 5) with animated brass pocket-watch orbs.
    * **Line Integrity & Reinforcement**: Increase max line health (up to 40) with braided steel/kraken sinew line gauges.
* **Inspect Ledger Modal (`V` / `D`)**: Full deck inspection categorizing Active Tackle vs. Inscribed Techniques, complete with vessel capacity summary metrics.

### 5. 🔊 Lovecraftian Web Audio Engine
* Adaptive soundtrack channels with smooth crossfading between Main Menu, Overworld, and Chandlery Storefront.
* Dynamic boat engine chug modulation scaling with vessel velocity.
* Polyphonic environmental audio: distant bell buoys, eerie foghorns, reel ratchets, line strain warnings, water slaps, and violent snap strikes.

---

## ⌨️ Controls & Keybindings

### Overworld Exploration
| Key | Action |
| :--- | :--- |
| **`W` / `S`** | Throttle Forward / Reverse |
| **`A` / `D`** | Steer Port (Left) / Starboard (Right) |
| **`E` or `Space`** | Interact with nearby Fishing Spot or Harbor Dock |
| **`M`** | Toggle Audio Mute |

### Encounter & Battle
| Key / Input | Action |
| :--- | :--- |
| **Mouse Left-Click** | Cast Line / Play Selected Card / Click Buttons |
| **`Space`** | End Player Turn |
| **`Esc`** | Flee Encounter / Return to Overworld |

### Chandlery Shop & Ledger
| Key / Input | Action |
| :--- | :--- |
| **`L`** | Switch to **Tackle Ledgers** Tab |
| **`T`** | Switch to **Mythos Techniques** Tab |
| **`U`** | Switch to **Vessel Upgrades** Tab |
| **`D` or `V`** | Toggle **Inspect Ledger / Deck Viewer** |
| **`Esc`** | Exit Shop and Return to Vessel |

---

## 🛠️ Project Structure

```text
├── deck-and-tackle/           # Primary game application
│   ├── src/
│   │   ├── engine/            # Audio, Camera, Input, Vector2, VisualSockets
│   │   ├── game/
│   │   │   ├── battle/        # BattleEngine, CardData, FishData
│   │   │   ├── minigame/      # BobberMinigame
│   │   │   ├── overworld/     # Boat, FishingSpot, HarborDock, OverworldMap
│   │   │   ├── player/        # PlayerInventory (Stats, Gold, Upgrades)
│   │   │   ├── sideview/      # SideViewDiorama, ZoneProfiles
│   │   │   ├── sockets/       # Decoupled Visual Sockets (Boat, Fish, Cards, Docks)
│   │   │   └── ui/            # HUD, HarborShopOverlay, MainMenuOverlay, MuteButton
│   │   ├── main.ts            # Core Game loop and state manager initialization
│   │   └── style.css
│   ├── public/                # Game assets, audio SFX, soundtrack, sprites, video
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
├── assets/                    # Project source sprite sheets & reference assets
├── tests/                     # Automated E2E verification test suites
├── PROJECT.md                 # Architecture documentation
├── TODO.md                    # Roadmap & task tracker
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* `npm` (included with Node.js)

### Installation & Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/olemannholter-beep/deck-and-tackle.git
   cd deck-and-tackle/deck-and-tackle
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the local address displayed in the terminal (typically `http://localhost:5173/`).

4. **Build for production**:
   ```bash
   npm run build
   ```
   The bundled production assets will be output to the `dist/` directory.

---

## 📜 License & Credits

Created by Ole Mann Holter.  
Inspired by Lovecraftian cosmic horror and vintage nautical woodcut aesthetics.
