# Deck & Tackle — Godot 4 Overworld Prototype (`godot-port/`)

This folder contains the **Option C Playable Godot 4 Overworld Prototype Slice** so you can test-drive *Deck & Tackle* inside **Godot 4.3+** and compare its visual workflow, GPU shaders, and dynamic 2D lighting against the TypeScript/Canvas2D engine.

---

## 🚀 How to Open & Run in Godot 4

1. Download **Godot Engine 4.3 (or newer)** (Standard GDScript version — a single ~60 MB portable `.exe` from [godotengine.org](https://godotengine.org/download/)).
2. Open the Godot Project Manager, click **Import**, and select:
   ```text
   c:\Users\olema\Desktop\testing topdown\godot-port\project.godot
   ```
3. Click **Import & Edit**.
4. Press **F5** (or the **Play ▶** button in the top-right corner) to play the Overworld Prototype!

---

## 🎨 How to Visually Swap & Edit Sprites in the Godot Editor

1. In the FileSystem dock (bottom-left), double-click **`res://scenes/Overworld.tscn`** to open the 2D Overworld in the visual viewport.
2. **Move, Scale, or Swap Islands**:
   - Expand the **`Islands`** node in the Scene tree (top-left) and click any island (e.g., `Island1_WhaleSandbar`, `Island4_ShipwreckReef`).
   - Drag it anywhere on the 8000×8000 ocean with your mouse, or expand its **`Sprite2D`** child and drag any PNG from `res://assets/sprites/` into the **Texture** slot in the Inspector (right panel).
   - Notice each island has a **`LightOccluder2D`** child—this polygon automatically casts real-time dynamic 2D shadows when your boat's brass lantern passes by!
3. **Swap the Player Boat Sprite**:
   - Click **`PlayerBoat`** in the Scene tree.
   - In the Inspector on the right, under **Visual Customization (Drag & Drop Sprite Here)**, drag any PNG into **`Custom Boat Sprite`**.
4. **Tweak GPU Water & Fog Shaders Live**:
   - Click **`OceanShaderRect`** -> **Material** -> **Shader Parameters** in the Inspector to tweak the 4 radial zone water colors (`zone1_color`..`zone4_color`) and bioluminescent vein colors in real time!

---

## 🎮 Prototype Controls & Features Included

- **`[W/A/S/D]` or `[Arrow Keys]`**: Sail across the 8000×8000 world with smooth rudder physics (`CharacterBody2D`).
- **Real-Time 2D Dynamic Lighting (`CanvasModulate` + `PointLight2D` + `LightOccluder2D`)**:
  - As you sail further from Safe Harbor `(4000, 4000)`, the world smoothly darkens across the 4 radial zones while your boat's brass lantern casts real-time shadows behind islands and rocks.
- **Dynamic Ephemeral Whirlpools (`WhirlpoolSpot.gd` + `whirlpool.gdshader`)**:
  - Whirlpools fade in (`SPAWNING`), swirl with a custom GPU shader (`ACTIVE`), and shrink away (`DESPAWNING`).
  - Press **`[E]`** inside an active whirlpool to open the **Turn-Based Grimoire Card Battle Preview**.
- **Roaming Patrol Vessels & Ambush Sea Beasts (`RoamingHostile.gd`)**:
  - 8 roaming enemies across Zones 1–4 with `PointLight2D` searchlight cones and hull-to-hull **Touch Combat Initiation**.
- **`[M]` or `[Tab]`**: Toggle the full-screen **Nautical Sea Chart** radar overlay showing concentric zone rings, active whirlpools, and roaming hostiles.
