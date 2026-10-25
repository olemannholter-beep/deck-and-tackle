extends Node2D
class_name RoamingHostile
## Roaming Overworld Enemy (Patrol Vessel or Ambush Sea Beast)
## Drag-and-drop any enemy sprite into `custom_enemy_sprite` in the Godot Inspector!

@export_group("Visual Customization (Drag & Drop Sprite Here)")
@export var custom_enemy_sprite: Texture2D:
	set(value):
		custom_enemy_sprite = value
		if is_inside_tree():
			_update_sprite()

@export_group("Hostile Configuration")
@export var hostile_name: String = "Crazed Fishing Vessel"
@export_enum("patrol_vessel", "ambush_beast") var category: String = "patrol_vessel"
@export var zone_id: int = 1
@export var max_hp: int = 60
@export var patrol_speed: float = 95.0
@export var pursuit_speed: float = 175.0
@export var gold_reward: int = 40

var velocity: Vector2 = Vector2.ZERO
var heading_rad: float = 0.0
var alert_state: String = "patrol" # patrol, alert, pursuit, submerged_lurk, breach_charge
var alert_timer: float = 0.0
var charge_timer: float = 0.0
var sprite_node: Sprite2D
var searchlight: PointLight2D

const CONE_DISTANCE: float = 380.0
const CONE_ANGLE_RAD: float = deg_to_rad(55.0)
const HARBOR_SAFE_RADIUS: float = 1200.0

func _ready() -> void:
	heading_rad = randf() * TAU
	if category == "ambush_beast":
		alert_state = "submerged_lurk"
		velocity = Vector2.from_angle(heading_rad) * (patrol_speed * 0.55)
	else:
		alert_state = "patrol"
		velocity = Vector2.from_angle(heading_rad) * patrol_speed

	sprite_node = Sprite2D.new()
	sprite_node.name = "EnemySprite2D"
	add_child(sprite_node)
	_update_sprite()

	# Real-time PointLight2D Searchlight or Bioluminescent Aura
	searchlight = PointLight2D.new()
	searchlight.texture = PlayerBoat._create_radial_light_texture(192)
	if category == "patrol_vessel":
		searchlight.color = Color(1.0, 0.72, 0.25, 1.0)
		searchlight.energy = 1.15
		searchlight.position = Vector2(90, 0)
		searchlight.texture_scale = 1.6
	else:
		searchlight.color = Color(0.2, 0.95, 0.65, 1.0)
		searchlight.energy = 0.85
		searchlight.texture_scale = 1.3
	add_child(searchlight)

func _update_sprite() -> void:
	if sprite_node:
		sprite_node.texture = custom_enemy_sprite
		if custom_enemy_sprite:
			var max_dim := maxf(custom_enemy_sprite.get_width(), custom_enemy_sprite.get_height())
			if max_dim > 0:
				var s := 84.0 / max_dim
				sprite_node.scale = Vector2(s, s)
		queue_redraw()

func update_hostile(delta: float, boat_pos: Vector2, boat_heading: float) -> bool:
	var to_boat := boat_pos - global_position
	var dist := to_boat.length()

	# Hull-to-hull touch combat initiation (matching RoamingHostileManager.ts checkBoatCollision)
	if _check_boat_touch(boat_pos, boat_heading):
		return true

	if category == "patrol_vessel":
		var in_cone := _is_in_searchlight_cone(boat_pos)
		if alert_state == "patrol":
			if in_cone or dist < 130.0:
				alert_state = "alert"
				alert_timer = 0.85
		elif alert_state == "alert":
			heading_rad = lerp_angle(heading_rad, to_boat.angle(), min(1.0, delta * 4.5))
			if in_cone or dist < 180.0:
				alert_timer -= delta
				if alert_timer <= 0.0:
					alert_state = "pursuit"
			else:
				alert_state = "patrol"
		elif alert_state == "pursuit":
			heading_rad = lerp_angle(heading_rad, to_boat.angle(), min(1.0, delta * 5.0))
			velocity = Vector2.from_angle(heading_rad) * pursuit_speed
			if dist > 620.0:
				alert_state = "patrol"
				velocity = Vector2.from_angle(heading_rad) * patrol_speed
	else:
		# Ambush Sea Beast AI
		if alert_state == "submerged_lurk":
			if dist <= 185.0:
				alert_state = "breach_charge"
				charge_timer = 2.6
				heading_rad = to_boat.angle()
				velocity = Vector2.from_angle(heading_rad) * (pursuit_speed * 1.15)
		elif alert_state == "breach_charge":
			charge_timer -= delta
			heading_rad = lerp_angle(heading_rad, to_boat.angle(), min(1.0, delta * 5.0))
			velocity = Vector2.from_angle(heading_rad) * (pursuit_speed * 1.15)
			if charge_timer <= 0.0 and dist > 200.0:
				alert_state = "submerged_lurk"
				velocity = Vector2.from_angle(heading_rad) * (patrol_speed * 0.55)

	global_position += velocity * delta
	rotation = heading_rad

	# Enforce Harbor 1200px Safe Exclusion Zone
	var from_harbor := global_position - GameState.HARBOR_ORIGIN
	if from_harbor.length() < HARBOR_SAFE_RADIUS:
		var push_dir := from_harbor.normalized() if from_harbor.length() > 0.1 else Vector2.RIGHT
		global_position = GameState.HARBOR_ORIGIN + push_dir * HARBOR_SAFE_RADIUS
		heading_rad = push_dir.angle()
		velocity = push_dir * velocity.length()

	# Clamp to 8000x8000 world bounds
	if global_position.x < 120.0 or global_position.x > GameState.WORLD_WIDTH - 120.0:
		velocity.x *= -1.0
		heading_rad = velocity.angle()
	if global_position.y < 120.0 or global_position.y > GameState.WORLD_HEIGHT - 120.0:
		velocity.y *= -1.0
		heading_rad = velocity.angle()

	queue_redraw()
	return false

func _check_boat_touch(boat_pos: Vector2, boat_heading: float) -> bool:
	var fwd := Vector2.from_angle(boat_heading)
	var sample_pts := [
		boat_pos,
		boat_pos + fwd * 22.0,
		boat_pos - fwd * 22.0
	]
	var touch_radius := 52.0 if category == "patrol_vessel" else 48.0
	for pt in sample_pts:
		if global_position.distance_to(pt) <= touch_radius:
			return true
	return false

func _is_in_searchlight_cone(target_pos: Vector2) -> bool:
	var to_target := target_pos - global_position
	var d := to_target.length()
	if d > CONE_DISTANCE or d < 0.01:
		return false
	var angle_diff := absf(wrapf(to_target.angle() - heading_rad, -PI, PI))
	return angle_diff <= (CONE_ANGLE_RAD * 0.5)

func _draw() -> void:
	# 1. Searchlight Cone (for Patrol Vessels)
	if category == "patrol_vessel":
		var cone_col := Color(0.98, 0.80, 0.15, 0.16)
		if alert_state == "pursuit":
			cone_col = Color(0.95, 0.25, 0.25, 0.28)
		elif alert_state == "alert":
			cone_col = Color(0.96, 0.62, 0.05, 0.24)

		var cone_pts := PackedVector2Array([Vector2.ZERO])
		var half_a := CONE_ANGLE_RAD * 0.5
		for i in range(13):
			var a := lerpf(-half_a, half_a, float(i) / 12.0)
			cone_pts.append(Vector2.from_angle(a) * CONE_DISTANCE)
		draw_colored_polygon(cone_pts, cone_col)

	# 2. If no custom sprite is set, draw crisp procedural vessel or sea beast silhouette
	if custom_enemy_sprite == null:
		if category == "patrol_vessel":
			var hull_pts := PackedVector2Array([
				Vector2(-28, -13),
				Vector2(14, -14),
				Vector2(32, 0),
				Vector2(14, 14),
				Vector2(-28, 13)
			])
			draw_colored_polygon(hull_pts, Color("#1e293b"))
			var border_col := Color("#ef4444") if alert_state == "pursuit" else Color("#f59e0b")
			draw_polyline(hull_pts + PackedVector2Array([hull_pts[0]]), border_col, 2.0)
			draw_circle(Vector2(24, 0), 4.5, Color("#fef08a"))
		else:
			var is_breaching := (alert_state == "breach_charge")
			var body_col := Color(0.06, 0.72, 0.50, 0.88) if is_breaching else Color(0.02, 0.18, 0.14, 0.68)
			draw_circle(Vector2.ZERO, 24.0, body_col)
			draw_arc(Vector2.ZERO, 28.0, 0.0, TAU, 28, Color("#ef4444") if is_breaching else Color("#34d399"), 2.0)
			# Glowing abyssal eyes
			draw_circle(Vector2(14, -6), 3.0, Color("#facc15"))
			draw_circle(Vector2(14, 6), 3.0, Color("#facc15"))

	# 3. Alert Status Badge above hostile (drawn unrotated in local space)
	if alert_state in ["alert", "pursuit", "breach_charge"]:
		var badge := "❗ PURSUIT!" if alert_state != "alert" else "⚠️ SPOTTED!"
		draw_string(ThemeDB.fallback_font, Vector2(-40, -34), badge, HORIZONTAL_ALIGNMENT_CENTER, 80, 12, Color("#f87171"))
