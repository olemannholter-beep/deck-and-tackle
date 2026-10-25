extends CharacterBody2D
class_name PlayerBoat
## Playable Overworld Vessel (CharacterBody2D)
## Drag-and-drop any top-down boat sprite into `custom_boat_sprite` in the Godot Inspector!

@export_group("Visual Customization (Drag & Drop Sprite Here)")
@export var custom_boat_sprite: Texture2D:
	set(value):
		custom_boat_sprite = value
		if is_inside_tree():
			_update_sprite()

@export_group("Navigation & Physics")
@export var max_speed: float = 290.0
@export var acceleration: float = 480.0
@export var water_drag: float = 2.6

var heading_rad: float = -PI / 2.0
var wake_points: PackedVector2Array = PackedVector2Array()
var sprite_node: Sprite2D
var lantern_light: PointLight2D

func _ready() -> void:
	# Collision shape for island bumps & hull-to-hull touch combat
	var col := CollisionShape2D.new()
	var shape := CapsuleShape2D.new()
	shape.radius = 16.0
	shape.height = 48.0
	col.rotation = PI / 2.0
	col.shape = shape
	add_child(col)

	# Optional Custom Sprite2D (if assigned in Inspector)
	sprite_node = Sprite2D.new()
	sprite_node.name = "BoatSprite2D"
	add_child(sprite_node)
	_update_sprite()

	# Real-Time 2D Brass Lantern PointLight2D (casts dynamic shadows on islands!)
	lantern_light = PointLight2D.new()
	lantern_light.name = "BrassLanternLight"
	lantern_light.color = Color(1.0, 0.85, 0.52, 1.0)
	lantern_light.energy = 1.35
	lantern_light.shadow_enabled = true
	lantern_light.shadow_filter = PointLight2D.SHADOW_FILTER_PCF5
	lantern_light.shadow_filter_smooth = 4.0
	lantern_light.texture = _create_radial_light_texture(256)
	lantern_light.texture_scale = 2.4
	add_child(lantern_light)

func _update_sprite() -> void:
	if sprite_node:
		sprite_node.texture = custom_boat_sprite
		queue_redraw()

func _physics_process(delta: float) -> void:
	var input_dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input_dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input_dir.y += 1.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input_dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input_dir.x += 1.0

	if input_dir.length_squared() > 0.001:
		input_dir = input_dir.normalized()
		velocity += input_dir * acceleration * delta
		if velocity.length() > max_speed:
			velocity = velocity.normalized() * max_speed
		heading_rad = lerp_angle(heading_rad, velocity.angle(), min(1.0, delta * 9.0))
	else:
		velocity = velocity.move_toward(Vector2.ZERO, max_speed * water_drag * delta)

	rotation = heading_rad
	move_and_slide()

	# Clamp within 8000x8000 world boundaries
	global_position.x = clampf(global_position.x, 80.0, GameState.WORLD_WIDTH - 80.0)
	global_position.y = clampf(global_position.y, 80.0, GameState.WORLD_HEIGHT - 80.0)

	queue_redraw()

func _draw() -> void:
	# If the user assigned a custom_boat_sprite in the Inspector, Sprite2D renders it!
	# Otherwise, draw our crisp procedural top-down trawler with glowing brass lantern.
	if custom_boat_sprite != null:
		return

	# Stern foam wake vee
	if velocity.length() > 20.0:
		var foam_col := Color(0.82, 0.96, 1.0, 0.35)
		draw_line(Vector2(-22, -6), Vector2(-46, -18), foam_col, 2.5)
		draw_line(Vector2(-22, 6), Vector2(-46, 18), foam_col, 2.5)

	# Outer Wooden Hull
	var hull_pts := PackedVector2Array([
		Vector2(-22, -12),
		Vector2(8, -13),
		Vector2(26, 0),
		Vector2(8, 13),
		Vector2(-22, 12)
	])
	draw_colored_polygon(hull_pts, Color("#451a03"))
	draw_polyline(hull_pts + PackedVector2Array([hull_pts[0]]), Color("#d97706"), 2.0)

	# Inner Deck Planking
	var deck_pts := PackedVector2Array([
		Vector2(-18, -9),
		Vector2(6, -9),
		Vector2(20, 0),
		Vector2(6, 9),
		Vector2(-18, 9)
	])
	draw_colored_polygon(deck_pts, Color("#78350f"))

	# Wheelhouse Cabin
	draw_rect(Rect2(-10, -6, 12, 12), Color("#1e293b"), true)
	draw_rect(Rect2(-10, -6, 12, 12), Color("#94a3b8"), false, 1.5)

	# Bow Brass Lantern
	draw_circle(Vector2(20, 0), 4.0, Color("#fef08a"))

static func _create_radial_light_texture(size: int) -> GradientTexture2D:
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.45, 0.80, 1.0])
	grad.colors = PackedColorArray([
		Color(1.0, 1.0, 1.0, 1.0),
		Color(0.95, 0.85, 0.65, 0.65),
		Color(0.5, 0.4, 0.25, 0.18),
		Color(0.0, 0.0, 0.0, 0.0)
	])
	var tex := GradientTexture2D.new()
	tex.width = size
	tex.height = size
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.gradient = grad
	return tex
