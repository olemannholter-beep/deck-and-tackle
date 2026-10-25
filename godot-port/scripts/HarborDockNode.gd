extends Node2D
class_name HarborDockNode
## Central Safe Harbor Origin (4000, 4000) with Warm Beacon PointLight2D

@export var custom_dock_sprite: Texture2D

var beacon_light: PointLight2D

func _ready() -> void:
	beacon_light = PointLight2D.new()
	beacon_light.color = Color(1.0, 0.78, 0.35, 1.0)
	beacon_light.energy = 1.45
	beacon_light.texture = PlayerBoat._create_radial_light_texture(256)
	beacon_light.texture_scale = 2.8
	add_child(beacon_light)

func _draw() -> void:
	if custom_dock_sprite != null:
		draw_texture(custom_dock_sprite, -custom_dock_sprite.get_size() * 0.5)
		return

	# Safe Harbor Sanctuary Circle
	draw_arc(Vector2.ZERO, 125.0, 0.0, TAU, 48, Color(0.98, 0.85, 0.35, 0.35), 2.0)

	# Wooden Pier Planking
	draw_rect(Rect2(-55, -26, 110, 52), Color("#3f230f"), true)
	draw_rect(Rect2(-55, -26, 110, 52), Color("#b45309"), false, 2.0)
	for x in range(-45, 50, 12):
		draw_line(Vector2(x, -25), Vector2(x, 25), Color("#1c1008"), 1.5)

	# Corner Pilings & Brass Beacon
	for p in [Vector2(-52, -24), Vector2(52, -24), Vector2(-52, 24), Vector2(52, 24)]:
		draw_circle(p, 6.0, Color("#78350f"))
	draw_circle(Vector2(0, -14), 7.0, Color("#fef08a"))
	draw_string(ThemeDB.fallback_font, Vector2(-65, -36), "⚓ SAFE HARBOR (ORIGIN)", HORIZONTAL_ALIGNMENT_CENTER, 130, 12, Color("#fde047"))
