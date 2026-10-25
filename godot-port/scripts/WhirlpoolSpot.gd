extends Node2D
class_name WhirlpoolSpot
## Dynamic Ephemeral Whirlpool Spot
## Lifecycle State Machine: SPAWNING (2.5s) -> ACTIVE (25-60s) -> DESPAWNING (3.0s)

enum State { SPAWNING, ACTIVE, DESPAWNING, EXPIRED }

@export var custom_whirlpool_sprite: Texture2D

var state: State = State.SPAWNING
var state_timer: float = 0.0
var active_duration: float = 40.0
var spawn_duration: float = 2.5
var despawn_duration: float = 3.0
var zone_id: int = 1
var interaction_radius: float = 75.0
var is_player_in_range: bool = false

var shader_rect: ColorRect
var shader_mat: ShaderMaterial
var glow_light: PointLight2D

func _ready() -> void:
	zone_id = GameState.get_zone_id(global_position)
	active_duration = randf_range(30.0, 55.0)

	# GPU Vortex Shader Quad
	shader_rect = ColorRect.new()
	shader_rect.size = Vector2(96, 96)
	shader_rect.position = Vector2(-48, -48)
	shader_mat = ShaderMaterial.new()
	shader_mat.shader = load("res://shaders/whirlpool.gdshader")
	shader_mat.set_shader_parameter("glow_color", GameState.get_zone_color(zone_id))
	shader_rect.material = shader_mat
	add_child(shader_rect)

	# Subtle Bioluminescent PointLight2D
	glow_light = PointLight2D.new()
	glow_light.color = GameState.get_zone_color(zone_id)
	glow_light.energy = 0.75
	glow_light.texture = PlayerBoat._create_radial_light_texture(128)
	glow_light.texture_scale = 1.2
	add_child(glow_light)

func update_spot(delta: float, boat_pos: Vector2) -> void:
	var dist := global_position.distance_to(boat_pos)
	is_player_in_range = (dist <= interaction_radius) and (state == State.ACTIVE)

	state_timer += delta
	var alpha: float = 1.0

	match state:
		State.SPAWNING:
			alpha = clampf(state_timer / spawn_duration, 0.0, 1.0)
			scale = Vector2.ONE * lerpf(0.35, 1.0, alpha)
			if state_timer >= spawn_duration:
				state = State.ACTIVE
				state_timer = 0.0
		State.ACTIVE:
			alpha = 1.0
			scale = Vector2.ONE
			# Edge Case: Do NOT advance despawn timer while player is in interaction range!
			if is_player_in_range:
				state_timer = maxf(0.0, state_timer - delta)
			elif state_timer >= active_duration:
				trigger_despawn()
		State.DESPAWNING:
			alpha = clampf(1.0 - (state_timer / despawn_duration), 0.0, 1.0)
			scale = Vector2.ONE * lerpf(0.25, 1.0, alpha)
			if state_timer >= despawn_duration:
				state = State.EXPIRED

	if shader_mat:
		shader_mat.set_shader_parameter("time_sec", Time.get_ticks_msec() / 1000.0)
		shader_mat.set_shader_parameter("lifecycle_alpha", alpha)
	if glow_light:
		glow_light.energy = 0.75 * alpha

	queue_redraw()

func trigger_despawn() -> void:
	if state == State.DESPAWNING or state == State.EXPIRED:
		return
	state = State.DESPAWNING
	state_timer = 0.0

func _draw() -> void:
	if is_player_in_range and state == State.ACTIVE:
		draw_arc(Vector2.ZERO, 52.0, 0.0, TAU, 32, Color("#fde047"), 2.0)
		draw_string(
			ThemeDB.fallback_font,
			Vector2(-68, -56),
			"[E] CAST LINE (ZONE %d)" % zone_id,
			HORIZONTAL_ALIGNMENT_CENTER,
			136,
			12,
			Color("#fef08a")
		)
