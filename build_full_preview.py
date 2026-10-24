import os
import json
import base64

SPRITE_DIR = 'deck-and-tackle/public/assets/sprites/fishing'
SHOP_DIR = 'deck-and-tackle/public/assets/sprites/shop'
OUTPUT_FILE = r'C:\Users\olema\.gemini\antigravity\brain\cdc2674f-9d10-4f48-892f-2c40df76bc99\side_view_battle_redesign_preview.html'
WORKSPACE_OUTPUT = r'c:\Users\olema\Desktop\testing topdown\side_view_battle_redesign_preview.html'

FISHING_ASSETS = [
    # Fallback clean composite
    (SPRITE_DIR, 'bg_fishing_clean_environment.png'),

    # Vessel & Fisherman
    (SPRITE_DIR, 'boat_trawler_lit.png'),
    (SPRITE_DIR, 'fisherman_casting_rod.png'),
    (SPRITE_DIR, 'fisherman_reeling_pull.png'),
    (SPRITE_DIR, 'fisherman_sitting_crate.png'),
    (SPRITE_DIR, 'fisherman_holding_lantern.png'),
    (SPRITE_DIR, 'tackle_hook_bone.png'),
    (SPRITE_DIR, 'tackle_hook_iron.png'),
    (SPRITE_DIR, 'fx_water_ripple.png'),
    (SPRITE_DIR, 'fx_water_splash.png'),

    # Target & Ambient Fishes
    (SPRITE_DIR, 'fish_cod_large.png'),
    (SPRITE_DIR, 'fish_shadowy_perch_s6.png'),
    (SPRITE_DIR, 'fish_spiky_sculpin.png'),
    (SPRITE_DIR, 'fish_angler_pale_lure.png'),
    (SPRITE_DIR, 'fish_visceral_gut_swollen.png'),
    (SPRITE_DIR, 'leviathan_apex_dagon.png'),
    (SPRITE_DIR, 'fish_school_minnows.png'),
    (SPRITE_DIR, 'fish_shadowy_minnow_tiny1.png'),
    (SPRITE_DIR, 'fish_shadowy_trout_s2.png'),
    (SPRITE_DIR, 'fish_shadowy_mackerel_s1.png'),

    # UI & Gauges
    (SPRITE_DIR, 'ui_power_tension_gauge.png'),
    (SPRITE_DIR, 'ui_depth_gauge.png'),
    (SPRITE_DIR, 'ui_btn_flee.png'),
    (SPRITE_DIR, 'ui_frame_corner_bottom_left.png'),

    # Zone 1 Assets (Coastal Shoals - Innsmouth Coastal)
    (SPRITE_DIR, 'bg_coastal_lighthouse.png'),
    (SPRITE_DIR, 'prop_lighthouse_cliff.png'),
    (SPRITE_DIR, 'waves_misty_swell_1024_feathered.png'),
    (SPRITE_DIR, 'fx_calm_misty_swell.png'),
    (SPRITE_DIR, 'pier_breakwater_beam.png'),
    (SPRITE_DIR, 'pier_piling_pair.png'),
    (SPRITE_DIR, 'wood_piling_stump.png'),

    # Zone 2 Assets (Kelp Shallows / Sunken Reef)
    (SPRITE_DIR, 'bg_kelp_shallows.png'),
    (SPRITE_DIR, 'prop_dock_pilings_kelp.png'),
    (SPRITE_DIR, 'waves_moonlit_crest_1024_feathered.png'),
    (SPRITE_DIR, 'fx_wave_moonlit_curl.png'),
    (SPRITE_DIR, 'kelp_dense_cluster.png'),
    (SPRITE_DIR, 'kelp_slender_bush.png'),

    # Zone 3 Assets (Abyssal Trench / Sunken Galleon)
    (SPRITE_DIR, 'bg_abyssal_shipwreck.png'),
    (SPRITE_DIR, 'waves_storm_breaker_1024_feathered.png'),
    (SPRITE_DIR, 'fx_wave_whitecap_spray_crest.png'),
    (SPRITE_DIR, 'fx_wave_crashing_breaker_left.png'),
    (SPRITE_DIR, 'shipwreck_abyssal_galleon.png'),
    (SPRITE_DIR, 'shipwreck_wooden_hull.png'),
    (SPRITE_DIR, 'prop_biolum_anemone_teal.png'),
    (SPRITE_DIR, 'prop_biolum_anemone_cup.png'),
    (SPRITE_DIR, 'shadow_kraken_tentacles_bg.png'),
    (SPRITE_DIR, 'shadow_giant_sea_serpent.png'),

    # Zone 4 Assets (Subterranean Sea Cave / Dagon Abyssal Lair)
    (SPRITE_DIR, 'bg_subterranean_cave.png'),
    (SPRITE_DIR, 'prop_cave_stalactites.png'),
    (SPRITE_DIR, 'prop_cave_chimney_vent.png'),
    (SPRITE_DIR, 'waves_churning_foam_1024_feathered.png'),
    (SPRITE_DIR, 'fx_seafoam_churning_surf.png'),
    (SPRITE_DIR, 'prop_sea_cave_anchor.png'),
    (SPRITE_DIR, 'fx_seafoam_patch_heavy.png')
]

asset_files = FISHING_ASSETS + [
    (SHOP_DIR, 'parchment_item_plate.png')
]

encoded_assets = {}
for d, f in asset_files:
    p = os.path.join(d, f)
    if os.path.exists(p):
        with open(p, 'rb') as fp:
            encoded_assets[f] = f"data:image/png;base64,{base64.b64encode(fp.read()).decode('utf-8')}"
    else:
        print(f"Warning: {f} missing from {d}")

print(f"Encoded {len(encoded_assets)} assets.")

html_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Side-View Battle Redesign — Authentic Lovecraftian Canvas Engine Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Crimson+Pro:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030508;
      --card: #080d14;
      --border: #1e293b;
      --gold: #fde047;
      --amber: #f59e0b;
      --crimson: #ef4444;
      --emerald: #10b981;
    }
    body {
      background-color: var(--bg);
      color: #e2e8f0;
      font-family: 'Crimson Pro', Georgia, serif;
      overflow-x: hidden;
      user-select: none;
    }
    .cinzel {
      font-family: 'Cinzel', serif;
      letter-spacing: 0.05em;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      image-rendering: auto;
      cursor: default;
    }
  </style>
</head>
<body class="bg-[#030508] min-h-screen flex flex-col items-center justify-start p-3 sm:p-4">

  <!-- Top Toolbar -->
  <header class="w-full max-w-[1400px] mb-3 flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-xl px-5 py-3 shadow-xl">
    <div class="flex items-center gap-3">
      <span class="text-amber-400 font-bold text-lg cinzel tracking-wider flex items-center gap-2">
        <span>⚔️</span> AUTHENTIC SIDE-VIEW BATTLE
      </span>
      <span id="tier-badge" class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-sans font-bold">
        Stage 1: Innsmouth Perch (30m)
      </span>
      <span id="turn-badge" class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-sans">
        Turn 1 &bull; Player Phase
      </span>
    </div>
    
    <div class="flex flex-wrap items-center gap-2 font-sans text-xs">
      <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
        <button class="stage-btn px-2.5 py-1 rounded bg-amber-950 text-amber-200 border border-amber-600 font-bold" data-tier="1">Stage 1: Perch (Coastal)</button>
        <button class="stage-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200" data-tier="2">Stage 2: Pike (Reef)</button>
        <button class="stage-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200" data-tier="3">Stage 3: Angler (Trench)</button>
        <button class="stage-btn px-2.5 py-1 rounded text-purple-400 hover:text-purple-200" data-tier="4">Stage 4: Dagon (Boss)</button>
      </div>

      <button id="btn-force-thrash" class="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-200 border border-red-800 font-bold transition">
        ⚡ Fish Thrash!
      </button>

      <button id="btn-force-win" class="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-800 text-amber-200 border border-amber-700 font-bold transition">
        🏆 Test Victory Screen
      </button>

      <button id="btn-reset" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition">
        🔄 Reset Encounter
      </button>
    </div>
  </header>

  <!-- Canvas Frame: 100% In-World Canvas UI -->
  <div class="relative w-full max-w-[1400px] aspect-[16/9] max-h-[740px] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
    <canvas id="battleCanvas"></canvas>
  </div>

  <!-- Legend & Design Assessment Footer -->
  <footer class="w-full max-w-[1400px] mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3.5 font-sans text-xs">
    <div class="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm">
      <h3 class="text-amber-300 font-semibold cinzel text-sm mb-1.5 flex items-center gap-1.5">
        <span>🏆</span> Redesigned Sprite Victory Screen
      </h3>
      <p class="text-slate-400 leading-relaxed text-[11px]">
        • <strong class="text-slate-200">Modular Sprite Architecture</strong>: Decomposed from a flat dialog box into gothic frames, carved bone hooks, ornamental brackets, and parchment plates.<br/>
        • <strong class="text-slate-200">Quarry Showcase</strong>: Displays the actual caught fish sprite floating over water wake ripples.<br/>
        • <strong class="text-slate-200">Lantern Angler &amp; Bounty Ledger</strong>: Fisherman holding a warm lantern illuminates the catch, with gold bounty, distance, and preserved tackle stats.
      </p>
    </div>

    <div class="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm">
      <h3 class="text-amber-300 font-semibold cinzel text-sm mb-1.5 flex items-center gap-1.5">
        <span>📜</span> Restored "Old Cards" Style
      </h3>
      <p class="text-slate-400 leading-relaxed text-[11px]">
        • <strong class="text-slate-200">Vertical Tarot Grimoire Format</strong>: Authentic 138x196 cards from CardVisualSocket.ts with weathered leather frames.<br/>
        • <strong class="text-slate-200">Type Palettes &amp; Woodcuts</strong>: Crimson Reel (Barbed Hook), Cyan Drag (Nautical Shield), Occult Purple Technique (Dagon's Hook with Backlash).<br/>
        • <strong class="text-slate-200">Brass Manometer Medallions</strong>: Glowing ember cabochon stamina gems and hover elevation.
      </p>
    </div>

    <div class="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm">
      <h3 class="text-amber-300 font-semibold cinzel text-sm mb-1.5 flex items-center gap-1.5">
        <span>🛡️</span> 100% In-Game Combat Flow
      </h3>
      <p class="text-slate-400 leading-relaxed text-[11px]">
        • <strong class="text-slate-200">Line Integrity &amp; Slack</strong>: Thrash tension damage is absorbed by Line Slack before hitting Line Integrity (20 HP).<br/>
        • <strong class="text-slate-200">Fish Intent Previews</strong>: In-world ribbon above the quarry displays upcoming Thrash or Deep Dive actions.<br/>
        • <strong class="text-slate-200">Tiered Creature Staging</strong>: Shallows (Perch) &rarr; Reef (Pike) &rarr; Trench (Angler) &rarr; Chasm (Apex Dagon).
      </p>
    </div>
  </footer>

  <script>
    const ASSETS = __ASSETS_JSON__;

    // Preload Images
    const images = {};
    let loadedCount = 0;
    const totalImages = Object.keys(ASSETS).length;

    Object.entries(ASSETS).forEach(([key, src]) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
      };
      img.onerror = () => {
        console.error("Failed to load sprite:", key);
        loadedCount++;
      };
      img.src = src;
      images[key] = img;
    });

    // --- STAGE & SPECIES CONFIG (Mirrored from ZoneProfiles.ts) ---
    const STAGE_CONFIG = {
      1: {
        tier: 1,
        id: 'coastal_shoals',
        name: 'Coastal Shoals (Innsmouth Coastal)',
        speciesName: "Innsmouth Perch",
        zoneName: "Innsmouth Coastal Shoals",
        sprite: "fish_shadowy_perch_s6.png",
        w: 140,
        h: 70,
        depth: 18,
        startingDistance: 30,
        sellValue: 15,
        rarity: "Common Coastal Quarry",
        description: "A brackish dweller of the shallows. Its unblinking glassy eyes possess an eerie, almost human gaze.",
        sky: {
          type: 'open_sky',
          skyTop: '#02040a',
          skyBottom: '#182430',
          backdropSprite: 'bg_coastal_lighthouse.png',
          horizonProp: 'prop_lighthouse_cliff.png',
          celestialType: 'moon',
          showRain: false,
          showLighthouseBeam: true,
          showStalactites: false,
          showChimneyVents: false,
          fogColor: 'rgba(24, 36, 48, 0.35)',
          fogDensity: 0.25
        },
        waves: {
          primaryWaveSprite: 'waves_misty_swell_1024_feathered.png',
          secondaryWaveSprite: 'fx_calm_misty_swell.png',
          foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
          foamPatchSprite: 'fx_seafoam_patch_heavy.png',
          whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
          waveSpeed: 1.1,
          waveAmp: 2.5,
          waveDrift: 0.8,
          foamColor: 'rgba(167, 243, 208, 0.70)'
        },
        waterColumn: {
          theme: 'slate_green',
          midColor: '#12261f',
          deepColor: '#071510',
          bedColor: '#030a07',
          causticsColor: 'rgba(167, 243, 208, 0.15)',
          lightRayColor: 'rgba(167, 243, 208, 0.08)',
          particleType: 'plankton',
          props: [
            { sprite: 'prop_lighthouse_cliff.png', xRatio: 0.85, yRatio: 0.25, w: 181, h: 121, isHorizon: true },
            { sprite: 'pier_breakwater_beam.png', xRatio: 0.15, yRatio: 0.82, w: 90, h: 150, sway: false },
            { sprite: 'pier_piling_pair.png', xRatio: 0.82, yRatio: 0.80, w: 50, h: 172, sway: false },
            { sprite: 'wood_piling_stump.png', xRatio: 0.75, yRatio: 0.88, w: 46, h: 150, sway: false }
          ]
        },
        ambientFishSprites: [
          'fish_school_minnows.png',
          'fish_shadowy_minnow_tiny1.png',
          'fish_shadowy_perch_s6.png'
        ],
        intentPattern: [
          { type: 'Thrash', value: 8, name: 'Spine Thrash', desc: 'Twitches jagged spines for 8 Tension' },
          { type: 'Thrash', value: 6, name: 'Barbel Lash', desc: 'Whips chin feelers for 6 Tension' },
          { type: 'DeepDive', value: 5, name: 'Muck Burrow', desc: 'Burrows into rotting muck for +5m' },
          { type: 'Thrash', value: 9, name: 'Venom Surge', desc: 'Violently spasms for 9 Tension!' }
        ]
      },
      2: {
        tier: 2,
        id: 'sunken_reef',
        name: 'Kelp Shallows (Sunken Reef)',
        speciesName: "Blighted Pike",
        zoneName: "Blighted Sound & Sunken Reef",
        sprite: "fish_spiky_sculpin.png",
        w: 180,
        h: 90,
        depth: 45,
        startingDistance: 52,
        sellValue: 40,
        rarity: "Uncommon Mutant Predator",
        description: "A mottled predator prowling the fog-shrouded sound. Covered in pale sensory pustules and jagged translucent fangs.",
        sky: {
          type: 'open_sky',
          skyTop: '#040d08',
          skyBottom: '#142c1c',
          backdropSprite: 'bg_kelp_shallows.png',
          horizonProp: 'prop_dock_pilings_kelp.png',
          celestialType: 'fog_moon',
          showRain: false,
          showLighthouseBeam: false,
          showStalactites: false,
          showChimneyVents: false,
          fogColor: 'rgba(20, 44, 28, 0.45)',
          fogDensity: 0.40
        },
        waves: {
          primaryWaveSprite: 'waves_moonlit_crest_1024_feathered.png',
          secondaryWaveSprite: 'fx_wave_moonlit_curl.png',
          foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
          foamPatchSprite: 'fx_seafoam_patch_heavy.png',
          whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
          waveSpeed: 1.8,
          waveAmp: 3.5,
          waveDrift: 1.2,
          foamColor: 'rgba(94, 234, 212, 0.75)'
        },
        waterColumn: {
          theme: 'emerald_teal',
          midColor: '#0d3830',
          deepColor: '#051f18',
          bedColor: '#02100c',
          causticsColor: 'rgba(94, 234, 212, 0.22)',
          lightRayColor: 'rgba(94, 234, 212, 0.12)',
          particleType: 'plankton',
          props: [
            { sprite: 'prop_dock_pilings_kelp.png', xRatio: 0.18, yRatio: 0.75, w: 120, h: 183, sway: false },
            { sprite: 'kelp_dense_cluster.png', xRatio: 0.78, yRatio: 0.85, w: 174, h: 152, sway: true },
            { sprite: 'kelp_slender_bush.png', xRatio: 0.88, yRatio: 0.82, w: 84, h: 172, sway: true },
            { sprite: 'kelp_slender_bush.png', xRatio: 0.08, yRatio: 0.84, w: 84, h: 172, sway: true }
          ]
        },
        ambientFishSprites: [
          'fish_shadowy_trout_s2.png',
          'fish_shadowy_mackerel_s1.png',
          'fish_spiky_sculpin.png'
        ],
        intentPattern: [
          { type: 'Thrash', value: 13, name: 'Fang Tear', desc: 'Snaps needle-teeth for 13 Tension' },
          { type: 'DeepDive', value: 10, name: 'Fog Plunge', desc: 'Dives toward sunken timbers for +10m' },
          { type: 'Thrash', value: 16, name: 'Convulsive Surge', desc: 'Death rolls fiercely for 16 Tension!' },
          { type: 'DeepDive', value: 8, name: 'Abyssal Lurk', desc: 'Backs into the deep gloom for +8m' }
        ]
      },
      3: {
        tier: 3,
        id: 'abyssal_trench',
        name: 'Abyssal Trench (Sunken Galleon)',
        speciesName: "Pale Deep Angler",
        zoneName: "Midnight Abyssal Trench",
        sprite: "fish_angler_pale_lure.png",
        w: 220,
        h: 120,
        depth: 82,
        startingDistance: 75,
        sellValue: 90,
        rarity: "Rare Abyssal Horror",
        description: "An ancient monstrosity dredged from the sunken trench. Its bioluminescent lure pulses in the pitch darkness.",
        sky: {
          type: 'open_sky',
          skyTop: '#010206',
          skyBottom: '#080d1a',
          backdropSprite: 'bg_abyssal_shipwreck.png',
          horizonProp: undefined,
          celestialType: 'storm_obscured',
          showRain: true,
          showLighthouseBeam: false,
          showStalactites: false,
          showChimneyVents: false,
          fogColor: 'rgba(8, 13, 26, 0.65)',
          fogDensity: 0.60
        },
        waves: {
          primaryWaveSprite: 'waves_storm_breaker_1024_feathered.png',
          secondaryWaveSprite: 'fx_wave_whitecap_spray_crest.png',
          foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
          foamPatchSprite: 'fx_seafoam_patch_heavy.png',
          whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
          waveSpeed: 2.6,
          waveAmp: 6.5,
          waveDrift: 1.8,
          foamColor: 'rgba(148, 163, 184, 0.85)'
        },
        waterColumn: {
          theme: 'abyssal_navy',
          midColor: '#070f24',
          deepColor: '#010309',
          bedColor: '#000103',
          causticsColor: 'rgba(56, 189, 248, 0.12)',
          lightRayColor: 'rgba(56, 189, 248, 0.05)',
          particleType: 'plankton',
          props: [
            { sprite: 'shipwreck_abyssal_galleon.png', xRatio: 0.72, yRatio: 0.78, w: 400, h: 195, sway: false },
            { sprite: 'prop_biolum_anemone_teal.png', xRatio: 0.22, yRatio: 0.88, w: 115, h: 88, glow: '#2dd4bf' },
            { sprite: 'prop_biolum_anemone_cup.png', xRatio: 0.35, yRatio: 0.90, w: 80, h: 73, glow: '#38bdf8' },
            { sprite: 'shadow_kraken_tentacles_bg.png', xRatio: 0.50, yRatio: 0.65, w: 220, h: 95, sway: true, alpha: 0.35 }
          ]
        },
        ambientFishSprites: [
          'fish_angler_pale_lure.png',
          'fish_shadowy_minnow_tiny1.png'
        ],
        intentPattern: [
          { type: 'Thrash', value: 18, name: 'Runic Surge', desc: 'Basalt scutes grind against the line for 18 Tension' },
          { type: 'DeepDive', value: 16, name: 'Chasm Plunge', desc: 'Pulls toward the non-euclidean chasm for +16m' },
          { type: 'Thrash', value: 22, name: 'Titan Death-Roll', desc: 'Unleashes primordial fury for 22 Tension!' },
          { type: 'Thrash', value: 15, name: 'Abyssal Slam', desc: 'Slams armored snout for 15 Tension' }
        ]
      },
      4: {
        tier: 4,
        id: 'sea_cave',
        name: 'Subterranean Sea Cave (Dagon Abyssal Lair)',
        speciesName: "Apex Dagon",
        zoneName: "The Sunken Ruin of Dagon (Boss)",
        sprite: "leviathan_apex_dagon.png",
        w: 320,
        h: 210,
        depth: 130,
        startingDistance: 110,
        sellValue: 250,
        rarity: "Primordial Leviathan God",
        description: "The primordial cyclopean god-beast of the sunken city! Massive writhing tentacles and abyssal fury.",
        sky: {
          type: 'cave_ceiling',
          skyTop: '#0d0705',
          skyBottom: '#1c100a',
          backdropSprite: 'bg_subterranean_cave.png',
          horizonProp: 'prop_cave_stalactites.png',
          stalactiteProp: 'prop_cave_stalactites.png',
          chimneyVentProp: 'prop_cave_chimney_vent.png',
          celestialType: 'none',
          showRain: false,
          showLighthouseBeam: false,
          showStalactites: true,
          showChimneyVents: true,
          fogColor: 'rgba(28, 16, 10, 0.50)',
          fogDensity: 0.55
        },
        waves: {
          primaryWaveSprite: 'waves_churning_foam_1024_feathered.png',
          secondaryWaveSprite: 'fx_seafoam_churning_surf.png',
          foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
          foamPatchSprite: 'fx_seafoam_churning_surf.png',
          whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
          waveSpeed: 3.2,
          waveAmp: 5.0,
          waveDrift: 2.2,
          foamColor: 'rgba(253, 224, 71, 0.80)'
        },
        waterColumn: {
          theme: 'sulfurous_amber',
          midColor: '#1f1d0a',
          deepColor: '#0c0b03',
          bedColor: '#050401',
          causticsColor: 'rgba(251, 191, 36, 0.20)',
          lightRayColor: 'rgba(245, 158, 11, 0.10)',
          particleType: 'vent_sparks',
          props: [
            { sprite: 'prop_cave_chimney_vent.png', xRatio: 0.18, yRatio: 0.82, w: 80, h: 98, glow: '#f97316' },
            { sprite: 'prop_cave_chimney_vent.png', xRatio: 0.82, yRatio: 0.84, w: 80, h: 98, glow: '#f97316' },
            { sprite: 'prop_sea_cave_anchor.png', xRatio: 0.38, yRatio: 0.90, w: 115, h: 83 },
            { sprite: 'prop_cave_stalactites.png', xRatio: 0.50, yRatio: 0.15, w: 420, h: 85 }
          ]
        },
        ambientFishSprites: [
          'leviathan_abyssal_maw_worm.png',
          'fish_angler_pale_lure.png'
        ],
        intentPattern: [
          { type: 'Thrash', value: 28, name: 'Primordial Maw-Crush', desc: 'Towering jaws snap for a crushing 28 Tension!' },
          { type: 'DeepDive', value: 22, name: 'Chasm Void-Sink', desc: 'Sinks into the infinite abyss for +22m' },
          { type: 'Thrash', value: 36, name: 'Cyclopean Spasm', desc: 'Violent cataclysmic thrashing for 36 Tension!' },
          { type: 'Thrash', value: 25, name: 'Dagon\\'s Writhing Wave', desc: 'Tentacle wave inflicts 25 Tension' }
        ]
      }
    };

    // --- MASTER DECK TEMPLATE ---
    const MASTER_DECK_TEMPLATE = [
      {
        id: 'reel_in_1',
        title: 'Reel In',
        cardType: 'Reel',
        staminaCost: 1,
        pullDistance: 4,
        slackGain: 0,
        tensionSelf: 0,
        description: 'Crank the salt-crusted winch aboard your boat. Pull 4m toward the vessel.'
      },
      {
        id: 'reel_in_2',
        title: 'Reel In',
        cardType: 'Reel',
        staminaCost: 1,
        pullDistance: 4,
        slackGain: 0,
        tensionSelf: 0,
        description: 'Crank the salt-crusted winch aboard your boat. Pull 4m toward the vessel.'
      },
      {
        id: 'slack_drag_1',
        title: 'Slack Drag',
        cardType: 'Drag',
        staminaCost: 1,
        pullDistance: 0,
        slackGain: 4,
        tensionSelf: 0,
        description: 'Yield line to the abyssal surge. Gain 4 Slack against incoming thrash.'
      },
      {
        id: 'slack_drag_2',
        title: 'Slack Drag',
        cardType: 'Drag',
        staminaCost: 1,
        pullDistance: 0,
        slackGain: 4,
        tensionSelf: 0,
        description: 'Yield line to the abyssal surge. Gain 4 Slack against incoming thrash.'
      },
      {
        id: 'quick_tug',
        title: 'Snap Strike',
        cardType: 'Reel',
        staminaCost: 0,
        pullDistance: 2,
        slackGain: 0,
        tensionSelf: 0,
        description: 'A sharp, desperate yank on the rod. Pull 2m of line.'
      },
      {
        id: 'brace',
        title: 'Brace',
        cardType: 'Drag',
        staminaCost: 2,
        pullDistance: 0,
        slackGain: 8,
        tensionSelf: 0,
        description: 'Dig boots into wet deck, steeling against the surge. Gain 8 Slack.'
      },
      {
        id: 'power_winch',
        title: 'Black Iron Winch',
        cardType: 'Reel',
        staminaCost: 2,
        pullDistance: 12,
        slackGain: 0,
        tensionSelf: 0,
        description: 'Heavy whaling winch forged in salt and shadow. Pull a massive 12m.'
      },
      {
        id: 'desperate_haul',
        title: 'Desperate Haul',
        cardType: 'Technique',
        oncePerBattle: true,
        staminaCost: 1,
        pullDistance: 8,
        slackGain: 0,
        tensionSelf: 2,
        description: 'Wrench the rod with reckless fury. Pull 8m at the cost of 2 Line Backlash.'
      },
      {
        id: 'tension_strike',
        title: "Dagon's Hook",
        cardType: 'Technique',
        oncePerBattle: true,
        staminaCost: 1,
        pullDistance: 14,
        slackGain: 0,
        tensionSelf: 3,
        description: "Barbed basalt hook that bites into quarry maw. Pull 14m, taking 3 Line Backlash."
      },
      {
        id: 'kelp_snare',
        title: 'Kelp Snare Drag',
        cardType: 'Drag',
        staminaCost: 0,
        pullDistance: 0,
        slackGain: 3,
        tensionSelf: 0,
        drawCards: 1,
        description: 'Lash the spool with slick kelp sinew. Gain 3 Slack and draw 1 card.'
      }
    ];

    // --- BATTLE STATE ---
    const battleState = {
      currentStage: 1,
      maxLineIntegrity: 20,
      lineIntegrity: 20,
      lineSlack: 0,
      maxStamina: 2,
      stamina: 2,
      turnNumber: 1,
      turnPhase: 'player_turn', // 'player_turn' | 'fish_turn' | 'victory' | 'defeat'
      
      // Fish enemy state
      fishName: '',
      fishDistance: 30,
      fishMaxDistance: 30,
      fishDepth: 18,
      currentIntentIndex: 0,
      isThrashing: false,
      thrashTimer: 0,
      
      // Card piles
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      
      // Visual & UI interaction
      hoveredCardIdx: -1,
      cardHitboxes: [],
      endTurnBtnRect: { x: 0, y: 0, w: 140, h: 56 },
      isEndTurnHovered: false,
      fleeBtnRect: { x: 16, y: 14, w: 72, h: 32 },
      isFleeHovered: false,
      victoryBtnRect: { x: 0, y: 0, w: 260, h: 46 },
      isVictoryBtnHovered: false,
      defeatBtnRect: { x: 0, y: 0, w: 240, h: 46 },
      isDefeatBtnHovered: false,
      
      // Juice & Combat Feedback
      floatingTexts: [],
      splashes: [],
      screenShake: 0,
      fishermanPose: 'sitting', // 'sitting' | 'reeling' | 'casting'
      mouse: { x: -1000, y: -1000 },
      notification: null
    };

    const canvas = document.getElementById('battleCanvas');
    const ctx = canvas.getContext('2d');

    function shuffleArray(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function showNotification(text, color = '#fde047', duration = 3000) {
      battleState.notification = { text, color, expiry: performance.now() + duration };
    }

    function addFloatingText(text, x, y, color = '#48cae4') {
      battleState.floatingTexts.push({
        text,
        x,
        y,
        color,
        life: 0,
        maxLife: 1.5
      });
    }

    function getCurrentIntent() {
      const cfg = STAGE_CONFIG[battleState.currentStage];
      return cfg.intentPattern[battleState.currentIntentIndex % cfg.intentPattern.length];
    }

    function setStage(stageNum) {
      const cfg = STAGE_CONFIG[stageNum];
      battleState.currentStage = stageNum;
      battleState.fishName = cfg.speciesName;
      battleState.fishDistance = cfg.startingDistance;
      battleState.fishMaxDistance = cfg.startingDistance;
      battleState.fishDepth = cfg.depth;
      battleState.currentIntentIndex = 0;
      battleState.lineIntegrity = battleState.maxLineIntegrity;
      battleState.lineSlack = 0;
      battleState.stamina = battleState.maxStamina;
      battleState.turnNumber = 1;
      battleState.turnPhase = 'player_turn';
      battleState.isThrashing = false;
      battleState.fishermanPose = 'sitting';
      battleState.floatingTexts = [];
      battleState.splashes = [];
      battleState.screenShake = 0;

      battleState.drawPile = shuffleArray(MASTER_DECK_TEMPLATE.map(c => ({ ...c })));
      battleState.hand = [];
      battleState.discardPile = [];
      battleState.exhaustPile = [];

      drawCards(5);

      document.getElementById('tier-badge').textContent = `Stage ${stageNum}: ${cfg.speciesName} (${cfg.startingDistance}m)`;
      document.getElementById('turn-badge').textContent = `Turn 1 • Player Phase`;
      showNotification(`Encounter initiated: ${cfg.speciesName} in ${cfg.zoneName}`, '#38bdf8');
    }

    function drawCards(count) {
      for (let i = 0; i < count; i++) {
        if (battleState.drawPile.length === 0) {
          if (battleState.discardPile.length === 0) break;
          battleState.drawPile = shuffleArray(battleState.discardPile);
          battleState.discardPile = [];
          showNotification('Reshuffled discard pile into draw deck.', '#94a3b8', 2000);
        }
        const c = battleState.drawPile.pop();
        if (c) battleState.hand.push(c);
      }
    }

    function startPlayerTurn() {
      if (battleState.turnPhase === 'victory' || battleState.turnPhase === 'defeat') return;
      battleState.turnPhase = 'player_turn';
      battleState.stamina = battleState.maxStamina;
      battleState.lineSlack = 0;
      battleState.fishermanPose = 'sitting';
      drawCards(5);
      document.getElementById('turn-badge').textContent = `Turn ${battleState.turnNumber} • Player Phase`;
    }

    function endPlayerTurn() {
      if (battleState.turnPhase !== 'player_turn') return;
      battleState.turnPhase = 'fish_turn';
      document.getElementById('turn-badge').textContent = `Turn ${battleState.turnNumber} • Fish Thrashing...`;

      while (battleState.hand.length > 0) {
        const c = battleState.hand.pop();
        if (c) battleState.discardPile.push(c);
      }

      const intent = getCurrentIntent();
      battleState.isThrashing = true;
      battleState.thrashTimer = 1.4;
      battleState.fishermanPose = 'reeling';

      battleState.splashes.push({
        x: targetFishX,
        y: targetFishY,
        life: 1.2,
        maxLife: 1.2,
        scale: 1.3
      });

      setTimeout(() => {
        if (intent.type === 'Thrash') {
          battleState.screenShake = 14;
          const rawDamage = intent.value;
          const damageToSlack = Math.min(battleState.lineSlack, rawDamage);
          battleState.lineSlack -= damageToSlack;
          const unblocked = rawDamage - damageToSlack;

          if (damageToSlack > 0) {
            addFloatingText(`Blocked ${damageToSlack}!`, targetFishX - 120, targetFishY - 40, '#38bdf8');
          }

          if (unblocked > 0) {
            battleState.lineIntegrity = Math.max(0, battleState.lineIntegrity - unblocked);
            addFloatingText(`-${unblocked} Line Damage!`, W_CANVAS * 0.28, H_CANVAS * 0.38, '#ef4444');
            showNotification(`⚠️ ${battleState.fishName} thrashed for ${rawDamage} Tension! (${unblocked} unblocked)`, '#ef4444');
          } else {
            showNotification(`🛡️ Full Block! All ${rawDamage} tension absorbed by Line Slack!`, '#38bdf8');
          }
        } else if (intent.type === 'DeepDive') {
          battleState.fishDistance += intent.value;
          addFloatingText(`+${intent.value}m Dive!`, targetFishX, targetFishY - 40, '#f43f5e');
          showNotification(`${battleState.fishName} plunged deep into the muck! +${intent.value}m Distance.`, '#f43f5e');
        }

        const cfg = STAGE_CONFIG[battleState.currentStage];
        battleState.currentIntentIndex = (battleState.currentIntentIndex + 1) % cfg.intentPattern.length;

        if (battleState.lineIntegrity <= 0) {
          battleState.turnPhase = 'defeat';
          showNotification('💥 CRITICAL SNAP! Line integrity hit 0! The fish tore free.', '#ef4444', 5000);
          return;
        }

        setTimeout(() => {
          if (battleState.turnPhase === 'fish_turn') {
            battleState.turnNumber++;
            startPlayerTurn();
          }
        }, 800);

      }, 500);
    }

    function playCard(cardIndex) {
      if (battleState.turnPhase !== 'player_turn') return;
      const card = battleState.hand[cardIndex];
      if (!card) return;

      if (battleState.stamina < card.staminaCost) {
        showNotification(`Not enough stamina for ${card.title}! (Needs ${card.staminaCost})`, '#f87171');
        return;
      }

      battleState.stamina -= card.staminaCost;
      battleState.hand.splice(cardIndex, 1);

      if (card.pullDistance > 0) {
        battleState.fishDistance = Math.max(0, battleState.fishDistance - card.pullDistance);
        addFloatingText(`-${card.pullDistance}m`, targetFishX, targetFishY - 30, '#48cae4');
        battleState.fishermanPose = 'reeling';
      }

      if (card.slackGain > 0) {
        battleState.lineSlack += card.slackGain;
        addFloatingText(`+${card.slackGain} Slack`, W_CANVAS * 0.28, H_CANVAS * 0.38, '#38bdf8');
      }

      if (card.tensionSelf && card.tensionSelf > 0) {
        battleState.lineIntegrity = Math.max(0, battleState.lineIntegrity - card.tensionSelf);
        battleState.screenShake = 8;
        addFloatingText(`⚡ -${card.tensionSelf} Line Backlash!`, W_CANVAS * 0.28, H_CANVAS * 0.38, '#ef4444');
      }

      if (card.drawCards && card.drawCards > 0) {
        drawCards(card.drawCards);
      }

      if (card.oncePerBattle) {
        battleState.exhaustPile.push(card);
        addFloatingText('TECHNIQUE EXHAUSTED', W_CANVAS * 0.5, H_CANVAS * 0.45, '#c084fc');
      } else {
        battleState.discardPile.push(card);
      }

      if (battleState.fishDistance <= 0) {
        battleState.turnPhase = 'victory';
        showNotification(`🏆 VICTORY! Hauled the ${battleState.fishName} aboard!`, '#fde047', 6000);
        return;
      }

      if (battleState.lineIntegrity <= 0) {
        battleState.turnPhase = 'defeat';
        showNotification('💥 LINE SNAPPED from excessive technique backlash!', '#ef4444', 5000);
        return;
      }
    }

    let W_CANVAS = 1280;
    let H_CANVAS = 720;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      W_CANVAS = rect.width;
      H_CANVAS = rect.height;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resizeCanvas);

    function getLogicalMouse(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left),
        y: (e.clientY - rect.top)
      };
    }

    canvas.addEventListener('mousemove', (e) => {
      battleState.mouse = getLogicalMouse(e);
    });

    canvas.addEventListener('mouseleave', () => {
      battleState.mouse = { x: -1000, y: -1000 };
    });

    canvas.addEventListener('click', (e) => {
      const pos = getLogicalMouse(e);

      // Victory Modal Button Click
      if (battleState.turnPhase === 'victory') {
        const vBtn = battleState.victoryBtnRect;
        if (pos.x >= vBtn.x && pos.x <= vBtn.x + vBtn.w && pos.y >= vBtn.y && pos.y <= vBtn.y + vBtn.h) {
          const nextStage = battleState.currentStage < 4 ? battleState.currentStage + 1 : 1;
          setStage(nextStage);
          return;
        }
      }

      // Defeat Modal Button Click
      if (battleState.turnPhase === 'defeat') {
        const dBtn = battleState.defeatBtnRect;
        if (pos.x >= dBtn.x && pos.x <= dBtn.x + dBtn.w && pos.y >= dBtn.y && pos.y <= dBtn.y + dBtn.h) {
          setStage(battleState.currentStage);
          return;
        }
      }

      // Flee Button
      if (
        pos.x >= battleState.fleeBtnRect.x &&
        pos.x <= battleState.fleeBtnRect.x + battleState.fleeBtnRect.w &&
        pos.y >= battleState.fleeBtnRect.y &&
        pos.y <= battleState.fleeBtnRect.y + battleState.fleeBtnRect.h
      ) {
        showNotification('Returning to overworld harbor helm...', '#38bdf8');
        return;
      }

      // End Turn Button
      const et = battleState.endTurnBtnRect;
      if (
        battleState.turnPhase === 'player_turn' &&
        pos.x >= et.x && pos.x <= et.x + et.w &&
        pos.y >= et.y && pos.y <= et.y + et.h
      ) {
        endPlayerTurn();
        return;
      }

      // Hand Cards Click
      if (battleState.turnPhase === 'player_turn') {
        for (let i = 0; i < battleState.cardHitboxes.length; i++) {
          const b = battleState.cardHitboxes[i];
          if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
            playCard(b.idx);
            return;
          }
        }
      }
    });

    // Toolbar Event Listeners
    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stage-btn').forEach(b => {
          b.className = 'stage-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200';
        });
        btn.className = 'stage-btn px-2.5 py-1 rounded bg-amber-950 text-amber-200 border border-amber-600 font-bold';
        setStage(parseInt(btn.dataset.tier));
      });
    });

    document.getElementById('btn-force-thrash').addEventListener('click', () => {
      if (battleState.turnPhase === 'player_turn') {
        endPlayerTurn();
      }
    });

    document.getElementById('btn-force-win').addEventListener('click', () => {
      battleState.fishDistance = 0;
      battleState.turnPhase = 'victory';
      showNotification(`🏆 Test Victory Screen for Stage ${battleState.currentStage} (${battleState.fishName})`, '#fde047');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      setStage(battleState.currentStage);
    });

    let targetFishX = 0;
    let targetFishY = 0;

    // --- AUTHENTIC CARD RENDERER ---
    function renderTarotCard(ctx, card, cx, cy, isHovered, isPlayable, cardW = 132, cardH = 188) {
      ctx.save();
      ctx.translate(cx + cardW / 2, cy + cardH / 2);

      const w = cardW;
      const h = cardH;

      ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.50)';
      const shadowY = isHovered ? 14 : 6;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 + shadowY, w - 4, h, 8);
      ctx.fill();

      let frameColor = '#210e11';
      let innerParchment = '#2b1b1d';
      let headerBg = '#4c1118';
      let eldritchGlow = '#f43f5e';
      let typeTag = 'REEL (ATTACK)';
      let sigilColor = '#fca5a5';

      switch (card.cardType) {
        case 'Reel':
          frameColor = '#210e11';
          innerParchment = '#2b1b1d';
          headerBg = '#4c1118';
          eldritchGlow = '#f43f5e';
          typeTag = 'REEL (ATTACK)';
          sigilColor = '#fca5a5';
          break;
        case 'Drag':
          frameColor = '#0b1924';
          innerParchment = '#15242f';
          headerBg = '#0c3047';
          eldritchGlow = '#38bdf8';
          typeTag = 'DRAG (SLACK)';
          sigilColor = '#7dd3fc';
          break;
        case 'Technique':
          frameColor = '#241033';
          innerParchment = '#2d183d';
          headerBg = '#421659';
          eldritchGlow = '#c084fc';
          typeTag = card.oncePerBattle ? '★ TECHNIQUE (ONCE) ★' : 'TECHNIQUE';
          sigilColor = '#e9d5ff';
          break;
        case 'Power':
          frameColor = '#241b0b';
          innerParchment = '#2e2516';
          headerBg = '#54360e';
          eldritchGlow = '#34d399';
          typeTag = 'ANCIENT POWER';
          sigilColor = '#6ee7b7';
          break;
      }

      if (isPlayable) {
        ctx.shadowColor = eldritchGlow;
        ctx.shadowBlur = isHovered ? 20 : 8;
      }

      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();

      let borderColor = isPlayable ? eldritchGlow : '#475569';
      if (!isHovered && isPlayable) {
        borderColor = card.cardType === 'Reel' ? '#991b1b' : (card.cardType === 'Drag' ? '#0284c7' : '#7c3aed');
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = innerParchment;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, -h * 0.1, 22, 16, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.22, h * 0.28, 24, 12, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isHovered ? sigilColor : '#78716c';
      ctx.lineWidth = 1.6;
      const cSize = 8;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + cSize + 2, -h / 2 + 2);
      ctx.lineTo(-w / 2 + 2, -h / 2 + 2);
      ctx.lineTo(-w / 2 + 2, -h / 2 + cSize + 2);
      ctx.moveTo(w / 2 - cSize - 2, -h / 2 + 2);
      ctx.lineTo(w / 2 - 2, -h / 2 + 2);
      ctx.lineTo(w / 2 - 2, -h / 2 + cSize + 2);
      ctx.moveTo(-w / 2 + cSize + 2, h / 2 - 2);
      ctx.lineTo(-w / 2 + 2, h / 2 - 2);
      ctx.lineTo(-w / 2 + 2, h / 2 - cSize - 2);
      ctx.moveTo(w / 2 - cSize - 2, h / 2 - 2);
      ctx.lineTo(w / 2 - 2, h / 2 - 2);
      ctx.lineTo(w / 2 - 2, h / 2 - cSize - 2);
      ctx.stroke();

      ctx.fillStyle = headerBg;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 6, -h / 2 + 7, w - 12, 24, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10.5px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.title, 8, -h / 2 + 19);

      const gemX = -w / 2 + 14;
      const gemY = -h / 2 + 14;
      const gemR = 11.5;

      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(gemX, gemY, gemR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const gemGrad = ctx.createRadialGradient(gemX - 3, gemY - 3, 2, gemX, gemY, gemR - 2);
      gemGrad.addColorStop(0, '#fef08a');
      gemGrad.addColorStop(0.4, '#eab308');
      gemGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = gemGrad;
      ctx.beginPath();
      ctx.arc(gemX, gemY, gemR - 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.staminaCost.toString(), gemX, gemY + 0.5);

      const artW = w - 16;
      const artH = 58;
      const artX = -artW / 2;
      const artY = -h / 2 + 34;

      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(artX, artY, artW, artH);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.strokeRect(artX, artY, artW, artH);

      renderWoodcutArt(ctx, card, artX + artW / 2, artY + artH / 2, sigilColor);

      ctx.fillStyle = card.cardType === 'Technique' ? '#2e1065' : '#171412';
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 10, artY + artH + 4, w - 20, 13, 2);
      ctx.fill();
      ctx.strokeStyle = card.cardType === 'Technique' ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = sigilColor;
      ctx.font = 'bold 7.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typeTag, 0, artY + artH + 10.5);

      if (card.tensionSelf && card.tensionSelf > 0) {
        ctx.fillStyle = 'rgba(127, 29, 29, 0.90)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 10, artY + artH - 12, w - 20, 11, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`⚡ BACKLASH: -${card.tensionSelf} LINE`, 0, artY + artH - 6.5);
      }

      const descY = artY + artH + 22;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9.5px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      wrapText(ctx, card.description, 0, descY, w - 18, 12);

      if (!isPlayable) {
        ctx.fillStyle = 'rgba(10, 12, 16, 0.68)';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 6);
        ctx.fill();
      }

      ctx.restore();
    }

    function renderWoodcutArt(ctx, card, cx, cy, tint) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = tint;
      ctx.fillStyle = tint;
      ctx.lineWidth = 1.6;

      if (card.cardType === 'Reel') {
        ctx.beginPath();
        ctx.moveTo(-14, -16);
        ctx.lineTo(-14, 3);
        ctx.bezierCurveTo(-14, 16, 12, 16, 12, 3);
        ctx.lineTo(12, -3);
        ctx.lineTo(7, -1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(12, -3);
        ctx.lineTo(16, 3);
        ctx.lineTo(11, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-14, -16, 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(12, 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (card.cardType === 'Drag') {
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, -10);
        ctx.lineTo(10, 8);
        ctx.lineTo(0, 16);
        ctx.lineTo(-10, 8);
        ctx.lineTo(-14, -10);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.moveTo(-6, -2);
        ctx.lineTo(6, -2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.beginPath();
        ctx.arc(-16, 3, 7, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(16, -3, 7, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
      } else if (card.cardType === 'Technique') {
        ctx.beginPath();
        ctx.moveTo(-8, -16);
        ctx.lineTo(-8, 5);
        ctx.bezierCurveTo(-8, 18, 14, 18, 14, 3);
        ctx.lineTo(14, -5);
        ctx.lineTo(7, -1);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(14, -5);
        ctx.lineTo(18, 2);
        ctx.lineTo(13, -1);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(14, 14, 2, 0, Math.PI * 2);
        ctx.arc(8, 20, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-10, 14);
        ctx.lineTo(-4, -14);
        ctx.lineTo(4, -14);
        ctx.lineTo(10, 14);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      let curY = y;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, x, curY);
          line = words[n] + ' ';
          curY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, curY);
    }

    // --- DYNAMIC ZONE VISUAL RENDERERS ---
    function renderPreviewSkybox(ctx, W, waterlineY, cfg, t) {
      ctx.save();
      const sky = cfg.sky;
      const isCave = sky.type === 'cave_ceiling';

      if (isCave) {
        // ENCLOSED ROCK VAULT CEILING (Strictly NO open sky, NO moon)
        const caveGrad = ctx.createLinearGradient(0, 0, 0, waterlineY);
        caveGrad.addColorStop(0, sky.skyTop || '#0d0705');
        caveGrad.addColorStop(1, sky.skyBottom || '#1c100a');
        ctx.fillStyle = caveGrad;
        ctx.fillRect(0, 0, W, waterlineY);

        // Cavern rock ceiling background
        const caveBg = images[sky.backdropSprite || 'bg_subterranean_cave.png'];
        if (caveBg && caveBg.complete) {
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.drawImage(caveBg, 0, 0, W, waterlineY + 25);
          ctx.restore();
        }

        // Volcanic fissure heat glow along the rock vault
        const heatGlow = ctx.createRadialGradient(W * 0.5, waterlineY, 10, W * 0.5, waterlineY, W * 0.65);
        heatGlow.addColorStop(0, 'rgba(249, 115, 22, 0.32)');
        heatGlow.addColorStop(0.5, 'rgba(234, 88, 12, 0.15)');
        heatGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = heatGlow;
        ctx.fillRect(0, 0, W, waterlineY);

        // Hanging stalactites along the ceiling vault
        const stalactites = images['prop_cave_stalactites.png'];
        if (stalactites && stalactites.complete) {
          ctx.save();
          ctx.drawImage(stalactites, W * 0.05, -10, 420, 85);
          ctx.drawImage(stalactites, W * 0.55, -15, 460, 95);
          ctx.restore();
        }

        // Heavy sulfurous fog near the waterline
        if (sky.fogColor) {
          const fogGrad = ctx.createLinearGradient(0, waterlineY - 50, 0, waterlineY);
          fogGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          fogGrad.addColorStop(1, sky.fogColor);
          ctx.fillStyle = fogGrad;
          ctx.fillRect(0, waterlineY - 50, W, 50);
        }

      } else {
        // OPEN SKY (Zones 1, 2, 3)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, waterlineY);
        skyGrad.addColorStop(0, sky.skyTop);
        skyGrad.addColorStop(1, sky.skyBottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, waterlineY);

        // Sky backdrop sprite
        if (sky.backdropSprite && images[sky.backdropSprite]) {
          const bgImg = images[sky.backdropSprite];
          if (bgImg && bgImg.complete) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.drawImage(bgImg, 0, 0, W, waterlineY + 20);
            ctx.restore();
          }
        }

        // Celestial body (moon / fog moon / storm obscured)
        if (sky.celestialType === 'moon') {
          const moonX = W * 0.72;
          const moonY = waterlineY * 0.34;
          ctx.save();
          const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 65);
          glow.addColorStop(0, 'rgba(217, 249, 157, 0.65)');
          glow.addColorStop(0.5, 'rgba(167, 243, 208, 0.22)');
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(moonX, moonY, 65, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(moonX, moonY, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (sky.celestialType === 'fog_moon') {
          const moonX = W * 0.72;
          const moonY = waterlineY * 0.36;
          ctx.save();
          const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 80);
          glow.addColorStop(0, 'rgba(94, 234, 212, 0.40)');
          glow.addColorStop(0.6, 'rgba(20, 44, 28, 0.25)');
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(moonX, moonY, 80, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
          ctx.beginPath();
          ctx.arc(moonX, moonY, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (sky.celestialType === 'storm_obscured') {
          // Thundercloud lightning flicker
          const stormPulse = Math.sin(t * 0.45) > 0.93 ? 0.30 : 0.0;
          if (stormPulse > 0.05) {
            ctx.fillStyle = `rgba(147, 197, 253, ${stormPulse})`;
            ctx.fillRect(0, 0, W, waterlineY);
          }
        }

        // Horizon Prop
        if (sky.horizonProp && images[sky.horizonProp]) {
          const hProp = images[sky.horizonProp];
          if (hProp && hProp.complete) {
            if (sky.horizonProp === 'prop_lighthouse_cliff.png') {
              const lX = W * 0.74;
              const lY = waterlineY - 95;
              ctx.drawImage(hProp, lX, lY, 181, 121);

              // Rotating lighthouse searchlight beam
              if (sky.showLighthouseBeam) {
                ctx.save();
                const towerX = lX + 130;
                const towerY = lY + 28;
                const beamAngle = t * 0.8;
                ctx.translate(towerX, towerY);
                ctx.rotate(beamAngle);
                const beamGrad = ctx.createLinearGradient(0, -10, 360, 40);
                beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
                beamGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.20)');
                beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
                ctx.fillStyle = beamGrad;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(380, -35);
                ctx.lineTo(380, 35);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            } else if (sky.horizonProp === 'prop_dock_pilings_kelp.png') {
              ctx.drawImage(hProp, W * 0.82, waterlineY - 90, 100, 150);
            }
          }
        }

        // Rain for Stage 3
        if (sky.showRain) {
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 45; i++) {
            const rx = ((i * 37 + t * 450) % W);
            const ry = ((i * 29 + t * 600) % (waterlineY + 60));
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 8, ry + 18);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Fog overlay
        if (sky.fogColor) {
          const fogGrad = ctx.createLinearGradient(0, waterlineY - 60, 0, waterlineY);
          fogGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          fogGrad.addColorStop(1, sky.fogColor);
          ctx.fillStyle = fogGrad;
          ctx.fillRect(0, waterlineY - 60, W, 60);
        }
      }
      ctx.restore();
    }

    function renderPreviewWaterColumn(ctx, W, H, waterlineY, cfg, t) {
      ctx.save();
      const wc = cfg.waterColumn;

      // 1. Water Column Gradient
      const colGrad = ctx.createLinearGradient(0, waterlineY, 0, H);
      colGrad.addColorStop(0, wc.midColor);
      colGrad.addColorStop(0.65, wc.deepColor);
      colGrad.addColorStop(1.0, wc.bedColor);
      ctx.fillStyle = colGrad;
      ctx.fillRect(0, waterlineY, W, H - waterlineY);

      // 2. Light Rays / Thermal Updrafts
      const rayAlpha = Math.sin(t * (cfg.waves.waveSpeed || 1.5)) * 0.04 + 0.08;
      if (wc.particleType === 'vent_sparks') {
        // Thermal Updraft Glow from the seabed fissures
        const ventGrad = ctx.createLinearGradient(W * 0.5, H, W * 0.5, waterlineY);
        ventGrad.addColorStop(0, `rgba(249, 115, 22, ${rayAlpha * 1.6})`);
        ventGrad.addColorStop(0.5, `rgba(245, 158, 11, ${rayAlpha * 0.9})`);
        ventGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ventGrad;
        ctx.fillRect(0, waterlineY, W, H - waterlineY);
      } else {
        // Light rays penetrating down from waterline
        const rayGrad = ctx.createLinearGradient(W * 0.65, waterlineY, W * 0.35, H);
        rayGrad.addColorStop(0, wc.lightRayColor || `rgba(167, 243, 208, ${rayAlpha})`);
        rayGrad.addColorStop(0.7, wc.causticsColor || `rgba(6, 95, 70, ${rayAlpha * 0.4})`);
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fillRect(0, waterlineY, W, H - waterlineY);
      }

      // 3. Dynamic Water Particles (Plankton or Vent Sparks)
      ctx.save();
      if (wc.particleType === 'vent_sparks') {
        // Rising heat bubbles & sulfur embers
        for (let i = 0; i < 30; i++) {
          const bx = ((i * 47 + Math.sin(t * 2 + i) * 20) % W);
          const by = H - ((t * 85 + i * 25) % (H - waterlineY));
          const br = (i % 3) + 1.5;
          ctx.fillStyle = (i % 2 === 0) ? 'rgba(253, 224, 71, 0.70)' : 'rgba(249, 115, 22, 0.65)';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Drifting bioluminescent plankton
        for (let i = 0; i < 25; i++) {
          const px = ((i * 53 + Math.sin(t * 0.8 + i) * 30) % W);
          const py = waterlineY + ((t * 12 + i * 22) % (H - waterlineY));
          const pr = (i % 2) + 1;
          ctx.fillStyle = (cfg.tier === 3) ? 'rgba(56, 189, 248, 0.50)' : 'rgba(167, 243, 208, 0.45)';
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Underwater Props matching cfg.waterColumn.props
      const kelpSway = Math.sin(t * 1.5) * 8;
      if (wc.props && Array.isArray(wc.props)) {
        wc.props.forEach(p => {
          if (p.isHorizon) return; // Handled in skybox
          if (p.yRatio <= 0.30) return; // Stalactites in ceiling vault handled in skybox
          const img = images[p.sprite];
          if (!img || !img.complete) return;

          ctx.save();
          const px = W * p.xRatio;
          const py = H * p.yRatio;

          if (p.alpha !== undefined) {
            ctx.globalAlpha = p.alpha;
          }

          if (p.glow) {
            ctx.shadowColor = p.glow;
            ctx.shadowBlur = 18;
          }

          if (p.sway) {
            ctx.translate(px, py);
            ctx.transform(1, 0, kelpSway * 0.012, 1, 0, 0);
            ctx.drawImage(img, -p.w / 2, -p.h, p.w, p.h);
          } else {
            ctx.drawImage(img, px - p.w / 2, py - p.h, p.w, p.h);
          }
          ctx.restore();
        });
      }

      // Ambient fauna
      if (cfg.tier === 1) {
        const minnows = images['fish_school_minnows.png'];
        if (minnows && minnows.complete) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          const mx = (W * 0.40 + t * 18) % (W + 200) - 100;
          const my = waterlineY + 80 + Math.sin(t * 1.6) * 12;
          ctx.drawImage(minnows, mx, my, 110, 45);
          ctx.restore();
        }
      }

      ctx.restore();
    }

    function renderPreviewWaterSurface(ctx, W, waterlineY, cfg, t) {
      ctx.save();
      const waves = cfg.waves;
      const wSpeed = waves.waveSpeed || 1.5;
      const wAmp = waves.waveAmp || 3.0;
      const wDrift = waves.waveDrift || 1.0;

      // 1. Primary Full-Width Wave Swell Layer
      const primaryWave = images[waves.primaryWaveSprite];
      if (primaryWave && primaryWave.complete) {
        ctx.save();
        const driftX = Math.sin(t * wSpeed) * (14 * wDrift);
        const bobY = Math.cos(t * wSpeed * 1.3) * wAmp;
        ctx.globalAlpha = 0.88;
        ctx.drawImage(primaryWave, -25 + driftX, waterlineY - 32 + bobY, W + 50, 115);
        ctx.restore();
      }

      // 2. Secondary Wave / Surf / Breaker Layer
      const secondaryWave = images[waves.secondaryWaveSprite];
      if (secondaryWave && secondaryWave.complete) {
        ctx.save();
        const driftX2 = Math.cos(t * wSpeed * 0.85) * (-12 * wDrift);
        const bobY2 = Math.sin(t * wSpeed * 1.2 + 1.1) * (wAmp * 0.7);
        ctx.globalAlpha = (cfg.tier === 4) ? 0.78 : 0.48;
        ctx.drawImage(secondaryWave, -30 + driftX2, waterlineY - 26 + bobY2, W + 60, 105);
        ctx.restore();
      }

      // 3. Zone-Specific Whitecap & Foam Overlays
      if (cfg.tier === 3) {
        const whitecap = images['fx_wave_whitecap_spray_crest.png'];
        if (whitecap && whitecap.complete) {
          ctx.save();
          const capX = W * 0.68 + Math.sin(t * 0.9) * 20;
          const capY = waterlineY - 24 + Math.cos(t * 2.2) * 4;
          ctx.globalAlpha = 0.65 + Math.sin(t * 2.5) * 0.2;
          ctx.drawImage(whitecap, capX, capY, 125, 84);
          ctx.restore();
        }
      } else if (cfg.tier === 4) {
        const surfFoam = images['fx_seafoam_churning_surf.png'];
        if (surfFoam && surfFoam.complete) {
          ctx.save();
          const foamX = W * 0.35 + Math.sin(t * 2.8) * 15;
          const foamY = waterlineY - 18 + Math.cos(t * 3.2) * 5;
          ctx.globalAlpha = 0.75 + Math.sin(t * 3.0) * 0.15;
          ctx.drawImage(surfFoam, foamX, foamY, 180, 75);
          ctx.restore();
        }
      }

      // 4. Foam Crest Line across the waterline
      ctx.strokeStyle = waves.foamColor || 'rgba(167, 243, 208, 0.70)';
      ctx.lineWidth = (cfg.tier >= 3) ? 2.4 : 1.8;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const wave = Math.sin(x * 0.035 + t * (wSpeed * 2.5)) * wAmp + Math.cos(x * 0.018 - t * (wSpeed * 1.5)) * (wAmp * 0.6);
        const y = waterlineY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    }

    // --- MAIN RENDER LOOP ---
    function renderLoop(time) {
      const t = time * 0.001;
      resizeCanvas();
      const W = W_CANVAS;
      const H = H_CANVAS;

      if (battleState.screenShake > 0) {
        battleState.screenShake = Math.max(0, battleState.screenShake - 0.6);
      }

      ctx.save();
      if (battleState.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * battleState.screenShake;
        const shakeY = (Math.random() - 0.5) * battleState.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      if (battleState.isThrashing) {
        battleState.thrashTimer -= 0.016;
        if (battleState.thrashTimer <= 0) {
          battleState.isThrashing = false;
        }
      }

      ctx.clearRect(0, 0, W, H);

      const waterlineY = Math.floor(H * 0.305);
      const cfg = STAGE_CONFIG[battleState.currentStage];
      const stageConfig = cfg;
      const currentEnv = cfg;

      // LAYER 1: DYNAMIC SKYBOX / CAVERN CEILING (Stage-dependent)
      renderPreviewSkybox(ctx, W, waterlineY, cfg, t);

      // LAYER 2: DYNAMIC WATER COLUMN & UNDERWATER PROPS (Stage-dependent)
      renderPreviewWaterColumn(ctx, W, H, waterlineY, cfg, t);

      // LAYER 3: TARGET FISH & TENSION LINE

      const distNorm = Math.max(0, battleState.fishDistance / battleState.fishMaxDistance);
      const minX = W * 0.38;
      const maxX = W * 0.76;
      targetFishX = minX + distNorm * (maxX - minX);

      const depthNorm = Math.min(1.0, battleState.fishDepth / 140);
      const minY = waterlineY + 35;
      const maxY = H * 0.72;
      targetFishY = minY + depthNorm * (maxY - minY);

      let fishAnimX = targetFishX;
      let fishAnimY = targetFishY + Math.sin(t * 2.5) * 7;
      let fishAngle = Math.sin(t * 2.0) * 0.05;

      if (battleState.isThrashing) {
        fishAnimX += (Math.random() - 0.5) * 14;
        fishAnimY += (Math.random() - 0.5) * 16;
        fishAngle = (Math.random() - 0.5) * 0.25;
      }

      const boatW = 240;
      const boatH = 179;
      const boatBob = Math.sin(t * 2.2) * 3.5;
      const boatRoll = Math.sin(t * 1.8) * 0.018;

      const boatX = W * 0.07;
      const boatY = waterlineY - Math.floor(boatH * 0.90) + boatBob;

      const fmW = 60;
      const fmH = 76;
      const fmX = boatX + Math.floor(boatW * 0.58);
      const fmY = boatY + Math.floor(boatH * 0.40);

      const rodTipX = fmX + Math.floor(fmW * 0.96);
      const rodTipY = fmY + Math.floor(fmH * 0.16);

      const fishMouthX = fishAnimX - cfg.w * 0.42;
      const fishMouthY = fishAnimY;

      ctx.save();
      const lineDamageRatio = 1.0 - (battleState.lineIntegrity / battleState.maxLineIntegrity);
      const sagAmount = (1.0 - lineDamageRatio) * 45;

      const midX = (rodTipX + fishMouthX) / 2;
      const midY = (rodTipY + fishMouthY) / 2 + sagAmount;

      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.quadraticCurveTo(midX, midY, fishMouthX, fishMouthY);

      if (battleState.lineIntegrity < 6) {
        ctx.strokeStyle = (Math.floor(t * 12) % 2 === 0) ? '#ef4444' : '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.85)';
        ctx.shadowBlur = 8;
      } else if (battleState.isThrashing) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
      ctx.restore();

      const fishImg = images[cfg.sprite];
      if (fishImg && fishImg.complete) {
        ctx.save();
        ctx.translate(fishAnimX, fishAnimY);
        ctx.rotate(fishAngle);
        ctx.scale(-1, 1);

        if (battleState.currentStage >= 3) {
          const auraPulse = Math.sin(t * 2.5) * 0.15 + 0.85;
          ctx.shadowColor = battleState.currentStage === 4 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(52, 211, 153, 0.45)';
          ctx.shadowBlur = 20 * auraPulse;
        }

        ctx.drawImage(fishImg, -cfg.w / 2, -cfg.h / 2, cfg.w, cfg.h);
        ctx.restore();
      }

      renderFishFloatingHUD(ctx, fishAnimX, fishAnimY - cfg.h / 2 - 14, cfg);

      battleState.splashes = battleState.splashes.filter(sp => {
        sp.life -= 0.02;
        const spImg = images['fx_water_splash.png'];
        if (spImg && spImg.complete && sp.life > 0) {
          ctx.save();
          ctx.globalAlpha = sp.life / sp.maxLife;
          const sw = 90 * sp.scale;
          const sh = 55 * sp.scale;
          ctx.drawImage(spImg, sp.x - sw/2, sp.y - sh/2, sw, sh);
          ctx.restore();
        }
        return sp.life > 0;
      });

      // LAYER 4: DYNAMIC WATER SURFACE & WAVE CRESTS (Stage-dependent)
      renderPreviewWaterSurface(ctx, W, waterlineY, cfg, t);

      // LAYER 5: SURFACE BOAT & ANGLER
      const boatImg = images['boat_trawler_lit.png'];
      if (boatImg && boatImg.complete) {
        ctx.save();
        ctx.translate(boatX + boatW/2, boatY + boatH/2);
        ctx.rotate(boatRoll);
        ctx.drawImage(boatImg, -boatW/2, -boatH/2, boatW, boatH);

        const fmImg = battleState.fishermanPose === 'reeling' 
          ? images['fisherman_reeling_pull.png']
          : (battleState.fishermanPose === 'casting' ? images['fisherman_casting_rod.png'] : images['fisherman_sitting_crate.png']);

        if (fmImg && fmImg.complete) {
          ctx.drawImage(fmImg, boatW * 0.08, -boatH * 0.22, fmW, fmH);
        }
        ctx.restore();
      }

      const ripple = images['fx_water_ripple.png'];
      if (ripple && ripple.complete) {
        ctx.drawImage(ripple, boatX - 20, waterlineY - 10, boatW + 35, 24);
      }

      // LAYER 6: IN-WORLD HUD
      renderTopGothicHUD(ctx, W, H);
      renderFleeButton(ctx);
      renderDepthGauge(ctx, W, H);
      renderBattleDeck(ctx, W, H);
      renderFloatingTexts(ctx, W, H);

      if (battleState.notification && performance.now() < battleState.notification.expiry) {
        renderNotification(ctx, W, H);
      }

      // REDESIGNED MODULAR SPRITE VICTORY & DEFEAT OVERLAYS
      if (battleState.turnPhase === 'victory') {
        renderVictoryModal(ctx, W, H, t);
      } else if (battleState.turnPhase === 'defeat') {
        renderDefeatModal(ctx, W, H);
      }

      ctx.restore();

      const isCardHovered = battleState.hoveredCardIdx !== -1;
      canvas.style.cursor = (battleState.isFleeHovered || battleState.isEndTurnHovered || isCardHovered || battleState.isVictoryBtnHovered || battleState.isDefeatBtnHovered) ? 'pointer' : 'default';

      requestAnimationFrame(renderLoop);
    }

    // --- FLOATING FISH HUD ---
    function renderFishFloatingHUD(ctx, fx, fy, cfg) {
      ctx.save();
      const intent = getCurrentIntent();
      const bannerW = 190;
      const bannerH = 40;
      const bx = fx - bannerW / 2;
      const by = fy - bannerH;

      const distBarW = 160;
      const distBarH = 6;
      const dbx = fx - distBarW / 2;
      const dby = by + bannerH + 4;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(dbx, dby, distBarW, distBarH, 3);
      ctx.fill();
      ctx.stroke();

      const distRatio = Math.max(0, battleState.fishDistance / battleState.fishMaxDistance);
      const distFillW = Math.max(2, Math.floor(distBarW * distRatio));
      ctx.fillStyle = '#fde047';
      ctx.fillRect(dbx, dby, distFillW, distBarH);

      ctx.fillStyle = 'rgba(8, 14, 22, 0.92)';
      ctx.strokeStyle = intent.type === 'Thrash' ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bannerW, bannerH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${battleState.fishName} &bull; ${battleState.fishDistance}m`, fx, by + 4);

      const intentIcon = intent.type === 'Thrash' ? '⚔️' : (intent.type === 'DeepDive' ? '🌊' : '💤');
      const intentColor = intent.type === 'Thrash' ? '#f87171' : (intent.type === 'DeepDive' ? '#38bdf8' : '#94a3b8');
      
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillStyle = intentColor;
      ctx.fillText(`${intentIcon} ${intent.name} (${intent.value} ${intent.type === 'Thrash' ? 'Tension' : 'Meters'})`, fx, by + 16);

      ctx.font = 'italic 7.5px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(intent.desc, fx, by + 28);
      ctx.restore();
    }

    // --- TOP GOTHIC HUD ---
    function renderTopGothicHUD(ctx, W, H) {
      ctx.save();

      const gaugeW = 320;
      const gaugeH = 76;
      const gaugeX = (W - gaugeW) / 2;
      const gaugeY = 12;

      const gaugeImg = images['ui_power_tension_gauge.png'];
      if (gaugeImg && gaugeImg.complete) {
        ctx.drawImage(gaugeImg, gaugeX, gaugeY, gaugeW, gaugeH);
      }

      const meterX = gaugeX + Math.floor(gaugeW * 0.14);
      const meterY = gaugeY + Math.floor(gaugeH * 0.40);
      const meterW = Math.floor(gaugeW * 0.72);
      const meterH = Math.floor(gaugeH * 0.24);

      ctx.fillStyle = '#060a0f';
      ctx.fillRect(meterX, meterY, meterW, meterH);

      const healthRatio = Math.max(0, battleState.lineIntegrity / battleState.maxLineIntegrity);
      const fillW = Math.max(2, Math.floor(meterW * healthRatio));

      const fillGrad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
      if (healthRatio < 0.35) {
        fillGrad.addColorStop(0, '#ef4444');
        fillGrad.addColorStop(1, '#991b1b');
      } else if (healthRatio < 0.65) {
        fillGrad.addColorStop(0, '#f59e0b');
        fillGrad.addColorStop(1, '#d97706');
      } else {
        fillGrad.addColorStop(0, '#10b981');
        fillGrad.addColorStop(1, '#059669');
      }

      ctx.fillStyle = fillGrad;
      ctx.fillRect(meterX, meterY, fillW, meterH);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(meterX, meterY, meterW, meterH);

      ctx.font = 'bold 9px "Cinzel", serif';
      ctx.fillStyle = healthRatio < 0.35 ? '#fef2f2' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LINE INTEGRITY: ${battleState.lineIntegrity} / ${battleState.maxLineIntegrity} HP`, meterX + meterW / 2, meterY + meterH / 2);

      const slackX = gaugeX + gaugeW + 12;
      const slackY = gaugeY + 18;
      const slackW = 110;
      const slackH = 38;

      ctx.fillStyle = 'rgba(11, 25, 36, 0.95)';
      ctx.strokeStyle = battleState.lineSlack > 0 ? '#38bdf8' : '#334155';
      ctx.lineWidth = battleState.lineSlack > 0 ? 1.8 : 1.0;
      ctx.beginPath();
      ctx.roundRect(slackX, slackY, slackW, slackH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px "Cinzel", serif';
      ctx.fillStyle = battleState.lineSlack > 0 ? '#38bdf8' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🛡️ SLACK: +${battleState.lineSlack}`, slackX + slackW / 2, slackY + slackH / 2);

      const stamX = gaugeX - 145;
      const stamY = gaugeY + 18;
      const stamW = 130;
      const stamH = 38;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(stamX, stamY, stamW, stamH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`STAMINA:`, stamX + 10, stamY + stamH / 2);

      for (let s = 0; s < battleState.maxStamina; s++) {
        const ox = stamX + 78 + s * 22;
        const oy = stamY + stamH / 2;
        const or = 8.5;

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(ox, oy, or, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (s < battleState.stamina) {
          const gemGrad = ctx.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, or - 1);
          gemGrad.addColorStop(0, '#fef08a');
          gemGrad.addColorStop(0.5, '#eab308');
          gemGrad.addColorStop(1, '#78350f');
          ctx.fillStyle = gemGrad;
          ctx.beginPath();
          ctx.arc(ox, oy, or - 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    function renderFleeButton(ctx) {
      battleState.fleeBtnRect.x = 16;
      battleState.fleeBtnRect.y = 14;
      const fleeImg = images['ui_btn_flee.png'];
      if (fleeImg && fleeImg.complete) {
        ctx.save();
        battleState.isFleeHovered = 
          battleState.mouse.x >= battleState.fleeBtnRect.x &&
          battleState.mouse.x <= battleState.fleeBtnRect.x + battleState.fleeBtnRect.w &&
          battleState.mouse.y >= battleState.fleeBtnRect.y &&
          battleState.mouse.y <= battleState.fleeBtnRect.y + battleState.fleeBtnRect.h;

        if (battleState.isFleeHovered) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(battleState.fleeBtnRect.x - 1, battleState.fleeBtnRect.y - 1, battleState.fleeBtnRect.w + 2, battleState.fleeBtnRect.h + 2);
        }
        ctx.drawImage(fleeImg, battleState.fleeBtnRect.x, battleState.fleeBtnRect.y, battleState.fleeBtnRect.w, battleState.fleeBtnRect.h);
        ctx.restore();
      }
    }

    function renderDepthGauge(ctx, W, H) {
      const depthImg = images['ui_depth_gauge.png'];
      const depthW = 34;
      const depthH = H * 0.70;
      const depthX = W - depthW - 8;
      const depthY = H * 0.14;

      if (depthImg && depthImg.complete) {
        ctx.drawImage(depthImg, depthX, depthY, depthW, depthH);

        const needleRatio = Math.min(1.0, battleState.fishDepth / 140);
        const needleY = depthY + 32 + needleRatio * (depthH - 65);

        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#1e1b18';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(depthX - 4, needleY);
        ctx.lineTo(depthX + 9, needleY - 4);
        ctx.lineTo(depthX + 9, needleY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px "Cinzel", serif';
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'right';
        ctx.fillText(`${battleState.fishDepth}m`, depthX - 6, needleY + 3);
        ctx.restore();
      }
    }

    function renderBattleDeck(ctx, W, H) {
      const numCards = battleState.hand.length;
      const cardW = 126;
      const cardH = 180;
      const cardGap = 12;
      const totalW = numCards * cardW + (numCards - 1) * cardGap;
      const deckStartX = (W - totalW) / 2;
      const deckY = H - cardH - 14;

      battleState.cardHitboxes = [];
      battleState.hoveredCardIdx = -1;

      const drawPileX = deckStartX - 100;
      const drawPileY = deckY + 80;
      ctx.save();
      ctx.fillStyle = 'rgba(8, 14, 22, 0.90)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(drawPileX, drawPileY, 82, 42, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`DRAW PILE`, drawPileX + 41, drawPileY + 16);
      ctx.font = 'bold 14px "Georgia", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${battleState.drawPile.length}`, drawPileX + 41, drawPileY + 33);
      ctx.restore();

      battleState.hand.forEach((card, idx) => {
        const cx = deckStartX + idx * (cardW + cardGap);
        let cy = deckY;

        const isHovered =
          battleState.mouse.x >= cx &&
          battleState.mouse.x <= cx + cardW &&
          battleState.mouse.y >= cy &&
          battleState.mouse.y <= cy + cardH;

        if (isHovered && battleState.turnPhase === 'player_turn') {
          battleState.hoveredCardIdx = idx;
          cy -= 24;
        }

        const isPlayable = (battleState.turnPhase === 'player_turn') && (battleState.stamina >= card.staminaCost);
        battleState.cardHitboxes.push({ idx, card, x: cx, y: cy, w: cardW, h: cardH });

        renderTarotCard(ctx, card, cx, cy, isHovered, isPlayable, cardW, cardH);
      });

      const discX = deckStartX + totalW + 18;
      const discY = deckY + 80;
      ctx.save();
      ctx.fillStyle = 'rgba(8, 14, 22, 0.90)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(discX, discY, 82, 42, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`DISCARD`, discX + 41, discY + 16);
      ctx.font = 'bold 14px "Georgia", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${battleState.discardPile.length}`, discX + 41, discY + 33);
      ctx.restore();

      const etW = 145;
      const etH = 54;
      const etX = discX + 96;
      const etY = deckY + 70;
      battleState.endTurnBtnRect = { x: etX, y: etY, w: etW, h: etH };

      const isEth = 
        battleState.mouse.x >= etX &&
        battleState.mouse.x <= etX + etW &&
        battleState.mouse.y >= etY &&
        battleState.mouse.y <= etY + etH;

      battleState.isEndTurnHovered = isEth && battleState.turnPhase === 'player_turn';

      ctx.save();
      ctx.fillStyle = battleState.isEndTurnHovered ? '#451a03' : '#1c1917';
      ctx.strokeStyle = battleState.isEndTurnHovered ? '#f59e0b' : '#78350f';
      ctx.lineWidth = battleState.isEndTurnHovered ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.roundRect(etX, etY, etW, etH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.fillStyle = battleState.turnPhase === 'player_turn' ? (battleState.isEndTurnHovered ? '#fef08a' : '#fde047') : '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(`⏳ END TURN`, etX + etW / 2, etY + 22);

      ctx.font = 'italic 9.5px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Fish Thrash Next`, etX + etW / 2, etY + 40);
      ctx.restore();
    }

    function renderFloatingTexts(ctx, W, H) {
      battleState.floatingTexts = battleState.floatingTexts.filter(ft => {
        ft.life += 0.016;
        ft.y -= 0.5;
        if (ft.life >= ft.maxLife) return false;

        ctx.save();
        ctx.globalAlpha = 1.0 - (ft.life / ft.maxLife);
        ctx.font = 'bold 15px "Cinzel", serif';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
        return true;
      });
    }

    function renderNotification(ctx, W, H) {
      ctx.save();
      const notifW = Math.min(560, W - 40);
      const notifH = 36;
      const notifX = (W - notifW) / 2;
      const notifY = 92;

      ctx.fillStyle = 'rgba(8, 12, 16, 0.95)';
      ctx.strokeStyle = battleState.notification.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(notifX, notifY, notifW, notifH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = battleState.notification.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(battleState.notification.text, notifX + notifW / 2, notifY + notifH / 2);
      ctx.restore();
    }

    // =========================================================================
    // REDESIGNED SPRITE-POWERED VICTORY MODAL (DECOMPOSED MODULAR ARCHITECTURE)
    // =========================================================================
    function renderVictoryModal(ctx, W, H, t) {
      ctx.save();

      // 1. Dark Abyssal Backdrop Overlay
      ctx.fillStyle = 'rgba(2, 5, 10, 0.88)';
      ctx.fillRect(0, 0, W, H);

      // 2. Main Frame Architecture
      const mW = 680;
      const mH = 470;
      const mx = (W - mW) / 2;
      const my = (H - mH) / 2;

      // Heavy Eldritch Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 32;

      // Dark tarnished iron / obsidian base
      const bgGrad = ctx.createLinearGradient(mx, my, mx, my + mH);
      bgGrad.addColorStop(0, '#0c131d');
      bgGrad.addColorStop(1, '#05080e');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(mx, my, mW, mH, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Tarnished Brass & Bone Border
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Inner Fine Gold Inset
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mx + 6, my + 6, mW - 12, mH - 12, 6);
      ctx.stroke();

      // 3. Four Gothic Ornamental Corners (Using ui_frame_corner_bottom_left.png)
      const cornerImg = images['ui_frame_corner_bottom_left.png'];
      if (cornerImg && cornerImg.complete) {
        const cw = 34;
        const ch = 52;
        // Bottom-Left
        ctx.drawImage(cornerImg, mx + 4, my + mH - ch - 4, cw, ch);
        // Bottom-Right
        ctx.save();
        ctx.translate(mx + mW - 4, my + mH - ch - 4);
        ctx.scale(-1, 1);
        ctx.drawImage(cornerImg, 0, 0, cw, ch);
        ctx.restore();
        // Top-Left
        ctx.save();
        ctx.translate(mx + 4, my + ch + 4);
        ctx.scale(1, -1);
        ctx.drawImage(cornerImg, 0, 0, cw, ch);
        ctx.restore();
        // Top-Right
        ctx.save();
        ctx.translate(mx + mW - 4, my + ch + 4);
        ctx.scale(-1, -1);
        ctx.drawImage(cornerImg, 0, 0, cw, ch);
        ctx.restore();
      }

      // 4. Header Plate (Engraved Metal Ribbon Flanked by Bone Hooks)
      const headW = mW - 80;
      const headH = 48;
      const headX = mx + 40;
      const headY = my + 18;

      ctx.fillStyle = '#171412';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, 4);
      ctx.fill();
      ctx.stroke();

      const hookImg = images['tackle_hook_bone.png'];
      if (hookImg && hookImg.complete) {
        ctx.drawImage(hookImg, headX + 16, headY + 6, 18, 36);
        ctx.save();
        ctx.translate(headX + headW - 16, headY + 6);
        ctx.scale(-1, 1);
        ctx.drawImage(hookImg, 0, 0, 18, 36);
        ctx.restore();
      }

      // Header Typography
      ctx.font = 'bold 20px "Cinzel", serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚓ QUARRY HAULED ABOARD! ⚓', mx + mW / 2, headY + 18);

      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('BOUNTY SECURED • TACKLE SURVIVED THE DEEP', mx + mW / 2, headY + 35);

      // 5. Left Section: Angler with Lantern Celebrating Catch
      const fmImg = images['fisherman_holding_lantern.png'];
      const fmW = 100;
      const fmH = 134;
      const fmX = mx + 36;
      const fmY = my + 130;

      if (fmImg && fmImg.complete) {
        const lanternGrad = ctx.createRadialGradient(fmX + 68, fmY + 75, 4, fmX + 68, fmY + 75, 90);
        lanternGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        lanternGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.15)');
        lanternGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lanternGrad;
        ctx.beginPath();
        ctx.arc(fmX + 68, fmY + 75, 90, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(fmImg, fmX, fmY, fmW, fmH);
      }

      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText('ANGLER OF INNSMOUTH', fmX + fmW / 2, fmY + fmH + 16);

      // 6. Center-Right: Caught Specimen Showcase Alcove
      const cfg = STAGE_CONFIG[battleState.currentStage];
      const alcoveW = 464;
      const alcoveH = 148;
      const alcoveX = mx + 172;
      const alcoveY = my + 80;

      const alcoveGrad = ctx.createLinearGradient(alcoveX, alcoveY, alcoveX, alcoveY + alcoveH);
      alcoveGrad.addColorStop(0, '#040d16');
      alcoveGrad.addColorStop(0.5, '#081726');
      alcoveGrad.addColorStop(1, '#02060a');
      ctx.fillStyle = alcoveGrad;
      ctx.beginPath();
      ctx.roundRect(alcoveX, alcoveY, alcoveW, alcoveH, 6);
      ctx.fill();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const rippleImg = images['fx_water_ripple.png'];
      if (rippleImg && rippleImg.complete) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(rippleImg, alcoveX + 35, alcoveY + alcoveH - 30, alcoveW - 70, 22);
        ctx.globalAlpha = 1.0;
      }

      // Draw the Caught Fish Sprite (Bobbing gently in showcase alcove)
      const fishSprite = images[cfg.sprite];
      if (fishSprite && fishSprite.complete) {
        ctx.save();
        const fishBobY = Math.sin(t * 2.8) * 3.5;
        const fishScale = Math.min(1.0, 190 / Math.max(cfg.w, cfg.h * 1.5));
        const dw = cfg.w * fishScale;
        const dh = cfg.h * fishScale;
        const fx = alcoveX + alcoveW / 2;
        const fy = alcoveY + alcoveH / 2 - 6 + fishBobY;

        if (battleState.currentStage >= 3) {
          ctx.shadowColor = battleState.currentStage === 4 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(52, 211, 153, 0.5)';
          ctx.shadowBlur = 18;
        }

        ctx.translate(fx, fy);
        ctx.scale(-1, 1);
        ctx.drawImage(fishSprite, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }

      const rarityColors = { 1: '#38bdf8', 2: '#34d399', 3: '#c084fc', 4: '#f43f5e' };
      ctx.font = 'bold 12.5px "Cinzel", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.speciesName.toUpperCase(), alcoveX + alcoveW / 2, alcoveY + 18);

      ctx.font = 'bold 8px "Segoe UI", sans-serif';
      ctx.fillStyle = rarityColors[battleState.currentStage] || '#38bdf8';
      ctx.fillText(`★ ${cfg.rarity.toUpperCase()} ★`, alcoveX + alcoveW / 2, alcoveY + 31);

      // 7. Middle: Parchment Catch Ledger & Bounty Plate
      const plateX = alcoveX;
      const plateY = alcoveY + alcoveH + 10;
      const plateW = alcoveW;
      const plateH = 118;

      const plateImg = images['parchment_item_plate.png'];
      if (plateImg && plateImg.complete) {
        ctx.drawImage(plateImg, plateX, plateY, plateW, plateH);
      } else {
        ctx.fillStyle = '#1c1714';
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, plateH, 4);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const gold = cfg.sellValue || 25;
      const colW = plateW / 3;

      // Col 1: Bounty
      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#78350f';
      ctx.textAlign = 'center';
      ctx.fillText('BOUNTY EARNED', plateX + colW * 0.5, plateY + 22);

      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText(`+${gold} Gold`, plateX + colW * 0.5, plateY + 44);

      // Col 2: Haul
      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText('HAUL DISTANCE', plateX + colW * 1.5, plateY + 22);

      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${cfg.startingDistance}m Hauled`, plateX + colW * 1.5, plateY + 44);

      // Col 3: Line Condition
      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText('TACKLE INTEGRITY', plateX + colW * 2.5, plateY + 22);

      const durabilityPct = Math.round((battleState.lineIntegrity / battleState.maxLineIntegrity) * 100);
      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = durabilityPct >= 50 ? '#065f46' : '#991b1b';
      ctx.fillText(`${battleState.lineIntegrity}/20 HP (${durabilityPct}%)`, plateX + colW * 2.5, plateY + 44);

      // Lore
      ctx.font = 'italic 8px "Georgia", serif';
      ctx.fillStyle = '#44382c';
      wrapText(ctx, `"${cfg.description}"`, plateX + plateW / 2, plateY + 68, plateW - 24, 11);

      // 8. Action Button (Gothic Metal Plate with Hover Glow)
      const btnW = 280;
      const btnH = 46;
      const btnX = alcoveX + (alcoveW - btnW) / 2;
      const btnY = my + mH - 58;
      battleState.victoryBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      battleState.isVictoryBtnHovered = 
        battleState.mouse.x >= btnX &&
        battleState.mouse.x <= btnX + btnW &&
        battleState.mouse.y >= btnY &&
        battleState.mouse.y <= btnY + btnH;

      const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      if (battleState.isVictoryBtnHovered) {
        btnGrad.addColorStop(0, '#d97706');
        btnGrad.addColorStop(1, '#92400e');
      } else {
        btnGrad.addColorStop(0, '#92400e');
        btnGrad.addColorStop(1, '#451a03');
      }
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.fill();

      ctx.strokeStyle = battleState.isVictoryBtnHovered ? '#fef08a' : '#f59e0b';
      ctx.lineWidth = battleState.isVictoryBtnHovered ? 2.2 : 1.5;
      ctx.stroke();

      ctx.font = 'bold 12.5px "Cinzel", serif';
      ctx.fillStyle = battleState.isVictoryBtnHovered ? '#ffffff' : '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const nextStageNum = battleState.currentStage < 4 ? battleState.currentStage + 1 : 1;
      const btnLabel = battleState.currentStage < 4 
        ? `⚓ CLAIM BOUNTY & ADVANCE (STAGE ${nextStageNum}) →`
        : `⚓ RESTART JOURNEY (STAGE 1)`;
      ctx.fillText(btnLabel, btnX + btnW / 2, btnY + btnH / 2);

      ctx.restore();
    }

    // --- DEFEAT MODAL OVERLAY ---
    function renderDefeatModal(ctx, W, H) {
      ctx.save();
      ctx.fillStyle = 'rgba(3, 5, 8, 0.90)';
      ctx.fillRect(0, 0, W, H);

      const mW = 500;
      const mH = 280;
      const mx = (W - mW) / 2;
      const my = (H - mH) / 2;

      ctx.fillStyle = '#1c1917';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(mx, my, mW, mH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 22px "Cinzel", serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('💥 LINE SNAPPED IN THE DEEP!', mx + mW / 2, my + 45);

      ctx.font = '13px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`The tackle could not withstand the abyssal thrash force.`, mx + mW / 2, my + 80);
      ctx.fillText(`The ${battleState.fishName} tore into the gloom with your lure.`, mx + mW / 2, my + 105);

      const btnW = 220;
      const btnH = 46;
      const btnX = mx + (mW - btnW) / 2;
      const btnY = my + 185;
      battleState.defeatBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      battleState.isDefeatBtnHovered = 
        battleState.mouse.x >= btnX &&
        battleState.mouse.x <= btnX + btnW &&
        battleState.mouse.y >= btnY &&
        battleState.mouse.y <= btnY + btnH;

      ctx.fillStyle = battleState.isDefeatBtnHovered ? '#991b1b' : '#7f1d1d';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('RE-RIG TACKLE & RETRY 🔄', btnX + btnW / 2, btnY + btnH / 2 + 4);

      ctx.restore();
    }

    setStage(1);

    requestAnimationFrame(renderLoop);
  </script>
</body>
</html>
"""

full_html = html_template.replace('__ASSETS_JSON__', json.dumps(encoded_assets))

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(full_html)
print(f"Written preview to {OUTPUT_FILE} ({len(full_html)} chars)")

with open(WORKSPACE_OUTPUT, 'w', encoding='utf-8') as f:
    f.write(full_html)
print(f"Written preview to {WORKSPACE_OUTPUT} ({len(full_html)} chars)")
