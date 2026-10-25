extends Node2D
## Main Overworld Scene Controller (Overworld.gd)
## Connects the 8000x8000 GPU Ocean Shader, Dynamic 2D Lighting, Whirlpool Spawner,
## Roaming Hostiles, Sea Chart [M], and Turn-Based Grimoire Card Preview Overlay.

@onready var ocean_rect: ColorRect = $OceanShaderRect
@onready var world_modulate: CanvasModulate = $WorldDarknessModulate
@onready var boat: PlayerBoat = $PlayerBoat
@onready var camera: Camera2D = $PlayerBoat/Camera2D
@onready var whirlpools_node: Node2D = $WhirlpoolsContainer
@onready var hostiles_node: Node2D = $HostilesContainer
@onready var vignette_rect: ColorRect = $UILayer/AtmosphereVignette
@onready var hud_drawer: Control = $UILayer/HUDDrawer

var time_sec: float = 0.0
var is_sea_chart_open: bool = false
var active_encounter_modal: Dictionary = {} # Empty when closed

# Turn-Based Combat / Fishing Preview State inside Godot 4
var combat_turn: int = 1
var combat_stamina: int = 3
var combat_max_stamina: int = 3
var combat_tether: int = 0
var combat_tension: int = 15
var combat_enemy_hp: int = 80
var combat_enemy_max_hp: int = 80
var combat_phase: int = 1
var combat_hovered_card: int = -1
var combat_log_msg: String = ""

const PREVIEW_CARDS: Array = [
	{"title": "Harpoon Iron", "cost": 1, "type": "HARPOON (TETHER)", "stat": "+35% TETHER • 8 DMG", "desc": "Launches barbed harpoon cable into the beast.", "color": "#c084fc", "tether": 35, "tension": 20, "dmg": 8, "armor": 0},
	{"title": "Ease Winch Slack", "cost": 1, "type": "WINCH (SLACK)", "stat": "-25% TENSION • +10 ARM", "desc": "Feeds slack into the capstan drum and braces hull.", "color": "#38bdf8", "tether": 0, "tension": -25, "dmg": 0, "armor": 10},
	{"title": "Swivel Gun", "cost": 1, "type": "CANNON (ATTACK)", "stat": "14 DMG • +15% TETHER", "desc": "Fires deck-mounted swivel gun at exposed flesh.", "color": "#f43f5e", "tether": 15, "tension": 5, "dmg": 14, "armor": 0},
	{"title": "Broadside Salvo", "cost": 2, "type": "CANNON (ATTACK)", "stat": "28 DMG • +25% TETHER", "desc": "Unleashes a devastating full salvo of 4-pounders!", "color": "#f43f5e", "tether": 25, "tension": 10, "dmg": 28, "armor": 0},
	{"title": "Bilge Patch", "cost": 2, "type": "REPAIR (HULL)", "stat": "+18 HULL HP", "desc": "Hammers lead sheeting over splintered timbers.", "color": "#34d399", "tether": 0, "tension": -10, "dmg": 0, "armor": 0, "heal": 18}
]

func _ready() -> void:
	randomize()
	boat.global_position = GameState.HARBOR_DOCK_POS
	_spawn_initial_whirlpools()
	_spawn_initial_hostiles()
	hud_drawer.draw.connect(_on_hud_draw)

func _spawn_initial_whirlpools() -> void:
	for i in range(14):
		_spawn_whirlpool_near(boat.global_position, 280.0, 2600.0)

func _spawn_whirlpool_near(center: Vector2, min_r: float, max_r: float) -> void:
	var spot := WhirlpoolSpot.new()
	var angle := randf() * TAU
	var r := randf_range(min_r, max_r)
	var pos := center + Vector2.from_angle(angle) * r
	pos.x = clampf(pos.x, 250.0, GameState.WORLD_WIDTH - 250.0)
	pos.y = clampf(pos.y, 250.0, GameState.WORLD_HEIGHT - 250.0)
	spot.global_position = pos
	whirlpools_node.add_child(spot)

func _spawn_initial_hostiles() -> void:
	var roster := [
		{"name": "Crazed Fishing Vessel", "cat": "patrol_vessel", "zone": 1, "dist": 1350.0, "hp": 65, "gold": 35, "sprite": "res://assets/sprites/fishing/boat_trawler_lit.png"},
		{"name": "Slightly Mutated Whale", "cat": "ambush_beast", "zone": 1, "dist": 1480.0, "hp": 90, "gold": 45, "sprite": "res://assets/sprites/fishing/fish_brown_mutant.png"},
		{"name": "Smuggler's Brigantine", "cat": "patrol_vessel", "zone": 2, "dist": 1950.0, "hp": 95, "gold": 55, "sprite": "res://assets/sprites/fishing/boat_trawler_derelict.png"},
		{"name": "Kelp Leviathan", "cat": "ambush_beast", "zone": 2, "dist": 2150.0, "hp": 120, "gold": 65, "sprite": "res://assets/sprites/fishing/fish_leviathan_horror.png"},
		{"name": "Ironclad Revenue Cutter", "cat": "patrol_vessel", "zone": 3, "dist": 2900.0, "hp": 135, "gold": 85, "sprite": "res://assets/sprites/fishing/boat_trawler_lit.png"},
		{"name": "Abyssal Serpent", "cat": "ambush_beast", "zone": 3, "dist": 3100.0, "hp": 150, "gold": 95, "sprite": "res://assets/sprites/fishing/fish_abyssal_eel.png"},
		{"name": "Phantom Ghost Galleon", "cat": "patrol_vessel", "zone": 4, "dist": 3950.0, "hp": 180, "gold": 135, "sprite": "res://assets/sprites/fishing/boat_trawler_derelict.png"},
		{"name": "Star-Spawn of Cthulhu", "cat": "ambush_beast", "zone": 4, "dist": 4150.0, "hp": 220, "gold": 175, "sprite": "res://assets/sprites/fishing/fish_cthulhu_tentacled.png"}
	]

	for i in range(roster.size()):
		var cfg: Dictionary = roster[i]
		var h := RoamingHostile.new()
		h.hostile_name = cfg["name"]
		h.category = cfg["cat"]
		h.zone_id = cfg["zone"]
		h.max_hp = cfg["hp"]
		h.gold_reward = cfg["gold"]
		if ResourceLoader.exists(cfg["sprite"]):
			h.custom_enemy_sprite = load(cfg["sprite"])
		var angle := (TAU / float(roster.size())) * float(i) + randf_range(-0.2, 0.2)
		var pos := GameState.HARBOR_ORIGIN + Vector2.from_angle(angle) * float(cfg["dist"])
		pos.x = clampf(pos.x, 250.0, GameState.WORLD_WIDTH - 250.0)
		pos.y = clampf(pos.y, 250.0, GameState.WORLD_HEIGHT - 250.0)
		h.global_position = pos
		hostiles_node.add_child(h)

func _process(delta: float) -> void:
	time_sec += delta

	# Update GPU Ocean Shader time
	var ocean_mat := ocean_rect.material as ShaderMaterial
	if ocean_mat:
		ocean_mat.set_shader_parameter("time_sec", time_sec)

	# Smoothly interpolate Dynamic 2D Darkness (CanvasModulate) & Vignette Shader based on distance from Harbor
	var dist := GameState.get_distance_from_harbor(boat.global_position)
	var dread_ratio := clampf(dist / 4200.0, 0.0, 1.0)
	world_modulate.color = Color(0.86, 0.92, 0.88).lerp(Color(0.08, 0.12, 0.18), dread_ratio)

	var vig_mat := vignette_rect.material as ShaderMaterial
	if vig_mat:
		vig_mat.set_shader_parameter("time_sec", time_sec)
		vig_mat.set_shader_parameter("vignette_intensity", lerpf(0.22, 0.86, dread_ratio))
		vig_mat.set_shader_parameter("fog_density", lerpf(0.06, 0.48, dread_ratio))
		vig_mat.set_shader_parameter("eldritch_pulse", clampf((dist - 2800.0) / 1200.0, 0.0, 1.0))

	# Pause overworld simulation while modal is open
	boat.set_physics_process(active_encounter_modal.is_empty() and not is_sea_chart_open)
	if not active_encounter_modal.is_empty() or is_sea_chart_open:
		hud_drawer.queue_redraw()
		return

	# Update Whirlpools & check [E] interaction
	var active_count := 0
	for child in whirlpools_node.get_children():
		var spot := child as WhirlpoolSpot
		if spot == null:
			continue
		spot.update_spot(delta, boat.global_position)
		if spot.state == WhirlpoolSpot.State.EXPIRED:
			spot.queue_free()
		else:
			active_count += 1
			if spot.is_player_in_range and Input.is_key_pressed(KEY_E):
				spot.trigger_despawn()
				_open_fishing_encounter(spot.zone_id)
				break

	if active_count < 14:
		_spawn_whirlpool_near(boat.global_position, 450.0, 2200.0)

	# Update Roaming Hostiles & check Hull-to-Hull Touch Combat Initiation
	for child in hostiles_node.get_children():
		var h := child as RoamingHostile
		if h == null:
			continue
		var touched := h.update_hostile(delta, boat.global_position, boat.heading_rad)
		if touched:
			_open_hostile_combat(h)
			break

	# Harbor Dock Repair [E]
	if boat.global_position.distance_to(GameState.HARBOR_ORIGIN) <= 130.0 and Input.is_key_pressed(KEY_E):
		GameState.hull_hp = GameState.max_hull_hp
		GameState.last_event_message = "Docked at Safe Harbor! Vessel Hull restored to 60/60 HP."

	hud_drawer.queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_M or event.keycode == KEY_TAB:
			if active_encounter_modal.is_empty():
				is_sea_chart_open = not is_sea_chart_open
				hud_drawer.queue_redraw()
		elif event.keycode == KEY_ESCAPE:
			is_sea_chart_open = false
			active_encounter_modal.clear()
			hud_drawer.queue_redraw()
		elif not active_encounter_modal.is_empty():
			if event.keycode == KEY_SPACE or event.keycode == KEY_ENTER:
				_resolve_combat_end_turn()
			elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
				_play_preview_card(event.keycode - KEY_1)

	if event is InputEventMouseMotion and not active_encounter_modal.is_empty():
		_update_card_hover(event.position)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and not active_encounter_modal.is_empty():
		_handle_modal_click(event.position)

func _open_fishing_encounter(zone_id: int) -> void:
	var species_list: Array = GameState.ZONE_SPECIES.get(zone_id, GameState.ZONE_SPECIES[1])
	var chosen: String = species_list[randi() % species_list.size()]
	combat_turn = 1
	combat_stamina = 3
	combat_tether = 25
	combat_tension = 15
	combat_enemy_max_hp = 50 + zone_id * 25
	combat_enemy_hp = combat_enemy_max_hp
	combat_phase = 1
	combat_log_msg = "Hooked %s in Zone %d! Play Grimoire cards or press [SPACE] to End Turn." % [chosen, zone_id]
	active_encounter_modal = {
		"title": "🎣 FISHING BATTLE — %s" % chosen.to_upper(),
		"subtitle": "Turn-Based Grimoire Card Battle (Godot 4 Preview)",
		"reward": 15 + zone_id * 18,
		"kind": "fishing"
	}

func _open_hostile_combat(h: RoamingHostile) -> void:
	# Push hostile slightly back so it doesn't immediately re-trigger on close
	var push_dir := (h.global_position - boat.global_position).normalized()
	if push_dir.length() < 0.1:
		push_dir = Vector2.RIGHT
	h.global_position += push_dir * 160.0

	combat_turn = 1
	combat_stamina = 3
	combat_tether = 0
	combat_tension = 15
	combat_enemy_max_hp = h.max_hp
	combat_enemy_hp = h.max_hp
	combat_phase = 1
	combat_log_msg = "%s engaged! Play cards [1-5] to tether/strike, then End Turn [SPACE]!" % h.hostile_name
	active_encounter_modal = {
		"title": "⚔️ %s — %s" % ["SEA BEAST STANDOFF" if h.category == "ambush_beast" else "NAVAL BROADSIDE", h.hostile_name.to_upper()],
		"subtitle": "Phase 1: Turn-Based Harpoon Tethering & Grimoire Cards",
		"reward": h.gold_reward,
		"kind": h.category
	}

func _play_preview_card(index: int) -> void:
	if index < 0 or index >= PREVIEW_CARDS.size():
		return
	var card: Dictionary = PREVIEW_CARDS[index]
	if combat_stamina < int(card["cost"]):
		combat_log_msg = "Not enough Stamina for %s!" % card["title"]
		hud_drawer.queue_redraw()
		return

	combat_stamina -= int(card["cost"])
	var dmg := int(card.get("dmg", 0)) * (2 if combat_phase == 2 else 1)
	combat_enemy_hp = max(0, combat_enemy_hp - dmg)
	combat_tether = clampi(combat_tether + int(card.get("tether", 0)), 0, 100)
	combat_tension = clampi(combat_tension + int(card.get("tension", 0)), 0, 100)
	if card.has("heal"):
		GameState.hull_hp = min(GameState.max_hull_hp, GameState.hull_hp + int(card["heal"]))

	combat_log_msg = "Played %s! (%s)" % [card["title"], card["stat"]]

	if combat_tether >= 100 and combat_phase == 1:
		combat_phase = 2
		combat_stamina = combat_max_stamina
		combat_log_msg = "BEAST ANCHORED! Phase 2: Weak Point Exposed (2.0x Critical Damage)!"

	if combat_enemy_hp <= 0:
		var reward := int(active_encounter_modal.get("reward", 40))
		GameState.gold += reward
		GameState.catch_count += 1
		GameState.last_event_message = "Victory! Earned +%dg from %s." % [reward, active_encounter_modal.get("title", "Encounter")]
		active_encounter_modal.clear()

	hud_drawer.queue_redraw()

func _resolve_combat_end_turn() -> void:
	combat_turn += 1
	combat_stamina = combat_max_stamina
	combat_tension = min(95, combat_tension + 15)
	GameState.hull_hp = max(1, GameState.hull_hp - 8)
	combat_log_msg = "Round %d: Beast thrashed for 8 Hull DMG (+15%% Tension)! Stamina refilled." % combat_turn
	hud_drawer.queue_redraw()

func _update_card_hover(mouse_pos: Vector2) -> void:
	var vp := get_viewport_rect().size
	var card_w := 138.0
	var card_h := 196.0
	var total_w := PREVIEW_CARDS.size() * (card_w + 14.0)
	var start_x := (vp.x - total_w) * 0.5 + card_w * 0.5
	var base_y := vp.y - card_h * 0.5 - 22.0

	combat_hovered_card = -1
	for i in range(PREVIEW_CARDS.size()):
		var cx := start_x + i * (card_w + 14.0)
		var rect := Rect2(cx - card_w * 0.5, base_y - card_h * 0.5 - 30.0, card_w, card_h + 40.0)
		if rect.has_point(mouse_pos):
			combat_hovered_card = i
			break
	hud_drawer.queue_redraw()

func _handle_modal_click(mouse_pos: Vector2) -> void:
	var vp := get_viewport_rect().size
	var end_turn_rect := Rect2(vp.x - 190.0, vp.y - 145.0, 160.0, 52.0)
	if end_turn_rect.has_point(mouse_pos):
		_resolve_combat_end_turn()
		return
	if combat_hovered_card != -1:
		_play_preview_card(combat_hovered_card)

func _on_hud_draw() -> void:
	var font := ThemeDB.fallback_font
	var vp := get_viewport_rect().size
	var zone_id := GameState.get_zone_id(boat.global_position)
	var zone_col := GameState.get_zone_color(zone_id)
	var dist_m := GameState.get_metric_distance(boat.global_position)
	var bearing := GameState.get_compass_bearing(boat.global_position)

	# 1. Top-Left Maritime Telemetry Panel
	var panel_rect := Rect2(16, 16, 390, 132)
	hud_drawer.draw_rect(panel_rect, Color(0.03, 0.06, 0.11, 0.90), true)
	hud_drawer.draw_rect(panel_rect, zone_col, false, 2.0)

	hud_drawer.draw_string(font, Vector2(28, 40), GameState.get_zone_name(zone_id), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, zone_col)
	hud_drawer.draw_string(font, Vector2(28, 62), "Distance: %dm from Harbor  •  Bearing: %s" % [dist_m, bearing], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#e2e8f0"))
	hud_drawer.draw_string(font, Vector2(28, 84), "Vessel Hull: %d/%d HP   •   Gold: %dg   •   Hauls: %d" % [GameState.hull_hp, GameState.max_hull_hp, GameState.gold, GameState.catch_count], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#fde047"))
	hud_drawer.draw_string(font, Vector2(28, 108), GameState.last_event_message, HORIZONTAL_ALIGNMENT_LEFT, 365, 11, Color("#94a3b8"))
	hud_drawer.draw_string(font, Vector2(28, 134), "[WASD] Sail   [E] Fish/Dock   [M] Sea Chart   (Godot 4 Prototype)", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#38bdf8"))

	# 2. Harbor Distance Indicator when near dock
	if boat.global_position.distance_to(GameState.HARBOR_ORIGIN) <= 130.0:
		hud_drawer.draw_string(font, Vector2(vp.x * 0.5 - 140, vp.y - 60), "⚓ SAFE HARBOR DOCK — Press [E] to Repair Hull", HORIZONTAL_ALIGNMENT_CENTER, 280, 15, Color("#fde047"))

	# 3. Full-Screen Sea Chart Radar [M]
	if is_sea_chart_open:
		_draw_sea_chart_modal(vp, font)

	# 4. Turn-Based Grimoire Card Encounter Modal
	if not active_encounter_modal.is_empty():
		_draw_encounter_card_modal(vp, font)

func _draw_sea_chart_modal(vp: Vector2, font: Font) -> void:
	hud_drawer.draw_rect(Rect2(Vector2.ZERO, vp), Color(0.01, 0.03, 0.06, 0.88), true)
	var map_size := minf(vp.x, vp.y) - 110.0
	var map_origin := (vp - Vector2(map_size, map_size)) * 0.5
	var center := map_origin + Vector2(map_size * 0.5, map_size * 0.5)
	var scale_f := map_size / GameState.WORLD_WIDTH

	hud_drawer.draw_rect(Rect2(map_origin, Vector2(map_size, map_size)), Color("#07131c"), true)
	hud_drawer.draw_rect(Rect2(map_origin, Vector2(map_size, map_size)), Color("#b45309"), false, 2.5)

	# Concentric Zone Rings
	hud_drawer.draw_arc(center, 1200.0 * scale_f, 0.0, TAU, 64, Color(0.2, 0.8, 0.6, 0.4), 1.5)
	hud_drawer.draw_arc(center, 2500.0 * scale_f, 0.0, TAU, 64, Color(0.2, 0.7, 0.9, 0.4), 1.5)
	hud_drawer.draw_arc(center, 3800.0 * scale_f, 0.0, TAU, 64, Color(0.95, 0.3, 0.4, 0.4), 1.5)

	# Harbor Star
	hud_drawer.draw_circle(center, 6.0, Color("#fde047"))

	# Whirlpools (Cyan blips)
	for child in whirlpools_node.get_children():
		var sp := child as Node2D
		if sp:
			hud_drawer.draw_circle(map_origin + sp.global_position * scale_f, 3.5, Color("#38bdf8"))

	# Roaming Hostiles (Red blips)
	for child in hostiles_node.get_children():
		var h := child as Node2D
		if h:
			hud_drawer.draw_circle(map_origin + h.global_position * scale_f, 4.5, Color("#ef4444"))

	# Player Boat (Green blip)
	var boat_map_pos := map_origin + boat.global_position * scale_f
	hud_drawer.draw_circle(boat_map_pos, 5.5, Color("#34d399"))

	hud_drawer.draw_string(font, Vector2(vp.x * 0.5 - 180, map_origin.y - 16), "🧭 NAUTICAL SEA CHART (8000x8000) — Press [M] or [ESC] to Close", HORIZONTAL_ALIGNMENT_CENTER, 360, 15, Color("#fde047"))

func _draw_encounter_card_modal(vp: Vector2, font: Font) -> void:
	hud_drawer.draw_rect(Rect2(Vector2.ZERO, vp), Color(0.01, 0.03, 0.06, 0.88), true)

	# Top Telemetry Bar
	hud_drawer.draw_rect(Rect2(0, 0, vp.x, 90), Color(0.03, 0.05, 0.10, 0.95), true)
	hud_drawer.draw_string(font, Vector2(vp.x * 0.5 - 240, 28), String(active_encounter_modal.get("title", "ENCOUNTER")), HORIZONTAL_ALIGNMENT_CENTER, 480, 17, Color("#fde047"))
	hud_drawer.draw_string(font, Vector2(vp.x * 0.5 - 240, 52), "TETHER: %d%%   •   CABLE TENSION: %d%%   •   TARGET HP: %d/%d   •   STAMINA: %d/%d ⚡" % [combat_tether, combat_tension, combat_enemy_hp, combat_enemy_max_hp, combat_stamina, combat_max_stamina], HORIZONTAL_ALIGNMENT_CENTER, 480, 13, Color("#38bdf8"))
	hud_drawer.draw_string(font, Vector2(vp.x * 0.5 - 280, 76), combat_log_msg, HORIZONTAL_ALIGNMENT_CENTER, 560, 12, Color("#a7f3d0"))

	# End Turn Button (Bottom Right, Fishing Minigame Style)
	var end_btn := Rect2(vp.x - 190.0, vp.y - 145.0, 160.0, 52.0)
	hud_drawer.draw_rect(end_btn, Color("#451a03"), true)
	hud_drawer.draw_rect(end_btn, Color("#f59e0b"), false, 2.0)
	hud_drawer.draw_string(font, Vector2(end_btn.position.x + 20, end_btn.position.y + 24), "⏳ END TURN [SPACE]", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#fef08a"))
	hud_drawer.draw_string(font, Vector2(end_btn.position.x + 28, end_btn.position.y + 42), "Beast Acts Next", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#cbd5e1"))

	# Curved Hand Arc of Weathered Grimoire Cards
	var card_w := 138.0
	var card_h := 196.0
	var total_w := PREVIEW_CARDS.size() * (card_w + 14.0)
	var start_x := (vp.x - total_w) * 0.5 + card_w * 0.5
	var base_y := vp.y - card_h * 0.5 - 22.0

	for i in range(PREVIEW_CARDS.size()):
		var card: Dictionary = PREVIEW_CARDS[i]
		var is_hovered := (i == combat_hovered_card)
		var can_afford := combat_stamina >= int(card["cost"])
		var cx := start_x + i * (card_w + 14.0)
		var center_dist := float(i) - float(PREVIEW_CARDS.size() - 1) * 0.5
		var cy := base_y + center_dist * center_dist * 4.5 - (32.0 if is_hovered else 0.0)
		var c_rect := Rect2(cx - card_w * 0.5, cy - card_h * 0.5, card_w, card_h)

		# Card Shadow & Grimoire Frame
		hud_drawer.draw_rect(Rect2(c_rect.position + Vector2(3, 8), c_rect.size), Color(0, 0, 0, 0.65), true)
		hud_drawer.draw_rect(c_rect, Color("#1c1514") if can_afford else Color("#111318"), true)
		hud_drawer.draw_rect(c_rect, Color(String(card["color"])) if can_afford else Color("#475569"), false, 2.4 if is_hovered else 1.5)

		# Inner Parchment
		hud_drawer.draw_rect(c_rect.grow(-5.0), Color("#241e1b"), true)

		# Header Ribbon
		var head_rect := Rect2(c_rect.position.x + 6, c_rect.position.y + 7, card_w - 12, 24)
		hud_drawer.draw_rect(head_rect, Color("#361517"), true)
		hud_drawer.draw_string(font, Vector2(c_rect.position.x + 28, c_rect.position.y + 23), String(card["title"]), HORIZONTAL_ALIGNMENT_LEFT, 104, 11, Color("#f8fafc"))

		# Brass Stamina Cost Gem
		var gem_center := c_rect.position + Vector2(15, 15)
		hud_drawer.draw_circle(gem_center, 11.5, Color("#b45309"))
		hud_drawer.draw_circle(gem_center, 9.0, Color("#fde047"))
		hud_drawer.draw_string(font, gem_center + Vector2(-4, 4), str(card["cost"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#0f172a"))

		# Woodcut Artwork Box
		var art_rect := Rect2(c_rect.position.x + 8, c_rect.position.y + 36, card_w - 16, 60)
		hud_drawer.draw_rect(art_rect, Color("#0a0d12"), true)
		hud_drawer.draw_rect(art_rect, Color("#292524"), false, 1.0)
		hud_drawer.draw_string(font, Vector2(art_rect.position.x + 6, art_rect.position.y + 34), String(card["stat"]), HORIZONTAL_ALIGNMENT_CENTER, art_rect.size.x - 12, 10, Color("#fde047"))

		# Type Tag Ribbon
		var tag_rect := Rect2(c_rect.position.x + 10, c_rect.position.y + 100, card_w - 20, 14)
		hud_drawer.draw_rect(tag_rect, Color("#171412"), true)
		hud_drawer.draw_string(font, Vector2(tag_rect.position.x + 4, tag_rect.position.y + 11), String(card["type"]), HORIZONTAL_ALIGNMENT_CENTER, tag_rect.size.x - 8, 9, Color(String(card["color"])))

		# Description
		hud_drawer.draw_string(font, Vector2(c_rect.position.x + 10, c_rect.position.y + 132), String(card["desc"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 20, 10, Color("#cbd5e1"))

		# Keybind Badge [1]..[5]
		var badge_pos := Vector2(cx, c_rect.position.y - 12)
		hud_drawer.draw_circle(badge_pos, 10.0, Color("#38bdf8") if can_afford else Color("#64748b"))
		hud_drawer.draw_string(font, badge_pos + Vector2(-3.5, 4), str(i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#0f172a"))
