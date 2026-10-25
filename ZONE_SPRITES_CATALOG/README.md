# ⚓ Deck & Tackle — Zone Visual Sprites & Assets Catalog

This catalog directory organizes all **156 sprites, animated textures, videos, and UI elements** used throughout **Deck & Tackle**, categorized cleanly by zone and feature.

---

## 🖥️ Interactive Visual Gallery
You can preview every single sprite visually in your browser by opening:
👉 **[`Visual_Sprite_Gallery.html`](./Visual_Sprite_Gallery.html)**  
*(Double-click to open in Safari, Chrome, Edge, or Brave to see all images, animated sheets, and looped videos with their filenames and sizes).*

---

## 📂 Catalog Directory Structure

```text
ZONE_SPRITES_CATALOG/
│
├── 🌊 Zone 1 - The Shallows (Coastal Shoals)/
│   ├── 01_Backgrounds_and_Sky/        # Coastal lighthouse backdrop & animated first_area.mp4
│   ├── 02_Waves_and_Water_FX/         # Misty swell & moonlit wave strips, splashes, ripples
│   ├── 03_Props_and_Seabed/           # Wooden pier pilings, breakwaters, animated kelp sheets
│   └── 04_Fish_and_Creatures/         # Innsmouth Perch, minnows, flatfish, cod
│
├── 🌫️ Zone 2 - The Foggy Banks (Kelp Shallows)/
│   ├── 01_Backgrounds_and_Sky/        # Kelp shallows backdrop & second_area.mp4 video
│   ├── 02_Waves_and_Water_FX/         # Moonlit wave crests & wave curling spray
│   ├── 03_Props_and_Seabed/           # Dense kelp clusters, slender bushes, wooden ship hulls
│   └── 04_Fish_and_Creatures/         # Blighted Pike, mackerel, spiky sculpins, rockfish
│
├── ⚡ Zone 3 - The Sunken Reefs (Abyssal Trench)/
│   ├── 01_Backgrounds_and_Sky/        # Abyssal shipwreck backdrop & seabed floor
│   ├── 02_Waves_and_Water_FX/         # Storm breaker waves, claw surges, heavy foam patches
│   ├── 03_Props_and_Shipwreck/        # Galleon wreck, glowing anemones, kraken shadows
│   └── 04_Fish_and_Horrors/           # Abyssal Void-Gar, pale lure anglers, mutant bio-lum fish
│
├── 🌌 Zone 4 - The Eldritch Trench (Subterranean Sea Cave)/
│   ├── 01_Backgrounds_and_Ceiling/    # Subterranean basalt cave backdrop & stalactites
│   ├── 02_Waves_and_Churning_Brine/   # Churning sulfur foam & heavy breaker surf
│   ├── 03_Thermal_Vents_and_Anchors/  # Geothermal chimney vents & cyclopean sea anchor
│   └── 04_Apex_Horrors_and_Dagon/     # Apex Leviathan Dagon, Maw Worm, Kraken Colossus
│
├── ⛵ Shared_Vessel_Angler_and_Tackle/
│   ├── 01_Boat_and_Fisherman/         # Trawler boat sprites, fisherman casting/reeling
│   ├── 02_Tackle_and_Rods/            # Bone & iron hooks, rods, bobber, shrimp/snail lures
│   └── 03_Battle_UI_and_Gauges/       # Power tension gauge, depth gauge, flee button, plates
│
└── 💰 Shop_and_Harbor_Chandlery/
    ├── 01_Shopkeeper_and_Diorama/     # Merchant portrait, specimen aquarium, grimoire ledger
    └── 02_Item_and_Upgrade_Icons/     # Winches, snares, void pumps, lures, barbed hooks
```

---

## 🎨 How to Review & Replace Sprites

All in-game sprites are loaded directly from the game's public asset directories:
- **Fishing & Diorama Sprites**: `deck-and-tackle/public/assets/sprites/fishing/`
- **Shop & Upgrade Icons**: `deck-and-tackle/public/assets/sprites/shop/`
- **Background Videos**: `deck-and-tackle/public/video/`

### Steps to Replace a Sprite:
1. Open this catalog (or **[`Visual_Sprite_Gallery.html`](./Visual_Sprite_Gallery.html)**) to identify the filename of the sprite you want to change.
2. Edit or replace the image file.
3. Save your replacement in **`deck-and-tackle/public/assets/sprites/fishing/`** (or `shop/`) using the **exact same filename**.
4. Requirements:
   - **Format**: PNG with transparency (alpha channel).
   - **Color Mode**: RGB / 32-bit RGBA.
   - **Dimensions**: Keeping close to the original dimensions preserves alignment and animations.
