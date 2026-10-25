extends Node
## Autoload Singleton (GameState)
## Tracks radial zone math, player vessel hull HP, gold sovereigns, and fish species catalog.

const WORLD_WIDTH: float = 8000.0
const WORLD_HEIGHT: float = 8000.0
const HARBOR_ORIGIN: Vector2 = Vector2(4000.0, 4000.0)
const HARBOR_DOCK_POS: Vector2 = Vector2(4000.0, 4070.0)

# Radial Zone Boundaries (matching AtmosphereManager.ts)
const ZONE_1_MAX_DIST: float = 1200.0
const ZONE_2_MAX_DIST: float = 2500.0
const ZONE_3_MAX_DIST: float = 3800.0

var hull_hp: int = 60
var max_hull_hp: int = 60
var gold: int = 65
var catch_count: int = 0
var last_event_message: String = "Cast off from Safe Harbor. Use WASD / Arrows to sail."

const ZONE_SPECIES: Dictionary = {
	1: ["Brine Perch (12g)", "harbor Flounder (16g)", "Spotted Mackerel (18g)"],
	2: ["Fogbank Cod (28g)", "Kelp Sculpin (34g)", "Mutated Rockfish (42g)"],
	3: ["Sunken Angler (58g)", "Benthic Fangtooth (68g)", "Corrupted Gar (75g)"],
	4: ["Pale Void Eel (110g)", "Tentacled Aberration (145g)", "Spawn of Dagon (220g)"]
}

func get_distance_from_harbor(world_pos: Vector2) -> float:
	return world_pos.distance_to(HARBOR_ORIGIN)

func get_metric_distance(world_pos: Vector2) -> int:
	return int(round(get_distance_from_harbor(world_pos) / 10.0))

func get_zone_id(world_pos: Vector2) -> int:
	var dist := get_distance_from_harbor(world_pos)
	if dist < ZONE_1_MAX_DIST:
		return 1
	elif dist < ZONE_2_MAX_DIST:
		return 2
	elif dist < ZONE_3_MAX_DIST:
		return 3
	return 4

func get_zone_name(zone_id: int) -> String:
	match zone_id:
		1: return "ZONE 1: THE SHALLOWS (SAFE)"
		2: return "ZONE 2: THE FOGGY BANKS (MEDIUM)"
		3: return "ZONE 3: THE SUNKEN REEFS (HARD)"
		4: return "ZONE 4: THE ELDRITCH TRENCH (EXTREME)"
		_: return "UNKNOWN WATERS"

func get_zone_color(zone_id: int) -> Color:
	match zone_id:
		1: return Color("#34d399")
		2: return Color("#38bdf8")
		3: return Color("#f59e0b")
		4: return Color("#f43f5e")
		_: return Color.WHITE

func get_compass_bearing(world_pos: Vector2) -> String:
	var delta := HARBOR_ORIGIN - world_pos
	if delta.length() < 25.0:
		return "AT HARBOR"
	var deg := rad_to_deg(atan2(delta.x, -delta.y))
	if deg < 0.0:
		deg += 360.0
	var dirs := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	var idx := int(round(deg / 45.0)) % 8
	return "%s (%d°)" % [dirs[idx], int(round(deg))]
