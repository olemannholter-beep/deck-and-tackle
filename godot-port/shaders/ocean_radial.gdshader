shader_type canvas_item;

// World-space coordinates passed from script or calculated from UV * world_size
uniform vec2 world_size = vec2(8000.0, 8000.0);
uniform vec2 harbor_origin = vec2(4000.0, 4000.0);
uniform float time_sec = 0.0;

// Zone water colors matching AtmosphereManager.ts
uniform vec4 zone1_color : source_color = vec4(0.102, 0.227, 0.188, 1.0); // #1a3a30 Shallows
uniform vec4 zone2_color : source_color = vec4(0.059, 0.165, 0.180, 1.0); // #0f2a2e Foggy Banks
uniform vec4 zone3_color : source_color = vec4(0.027, 0.067, 0.110, 1.0); // #07111c Sunken Reefs
uniform vec4 zone4_color : source_color = vec4(0.008, 0.016, 0.039, 1.0); // #02040a Eldritch Trench
uniform vec4 eldritch_vein_color : source_color = vec4(0.0, 0.90, 1.0, 1.0);

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

void fragment() {
	vec2 world_pos = UV * world_size;
	float dist = distance(world_pos, harbor_origin);

	// Smoothly interpolate across the 4 concentric radial zones
	vec3 water_col = zone1_color.rgb;
	if (dist < 1200.0) {
		float t = smoothstep(700.0, 1200.0, dist);
		water_col = mix(zone1_color.rgb, zone2_color.rgb, t);
	} else if (dist < 2500.0) {
		float t = smoothstep(1200.0, 2500.0, dist);
		water_col = mix(zone2_color.rgb, zone3_color.rgb, t);
	} else {
		float t = smoothstep(2500.0, 3900.0, dist);
		water_col = mix(zone3_color.rgb, zone4_color.rgb, t);
	}

	// Layered procedural ocean swells & caustics
	vec2 wave_uv1 = world_pos * 0.008 + vec2(time_sec * 0.18, time_sec * 0.11);
	vec2 wave_uv2 = world_pos * 0.019 - vec2(time_sec * 0.14, -time_sec * 0.21);
	float n1 = noise(wave_uv1);
	float n2 = noise(wave_uv2);
	float wave_crest = smoothstep(0.62, 0.88, (n1 + n2) * 0.5);

	water_col += vec3(0.05, 0.11, 0.12) * wave_crest;

	// Zone 4 Eldritch Bioluminescent Cyan Veins
	if (dist > 2800.0) {
		float eldritch_t = smoothstep(2800.0, 4200.0, dist);
		float vein = smoothstep(0.76, 0.84, noise(world_pos * 0.012 + vec2(sin(time_sec * 0.5), cos(time_sec * 0.4))));
		water_col = mix(water_col, eldritch_vein_color.rgb, vein * eldritch_t * 0.35);
	}

	// Subtle Bathymetric 250px Cartography Grid Lines
	vec2 grid_dist = abs(fract(world_pos / 250.0 - 0.5) - 0.5) * 250.0;
	float grid_line = 1.0 - smoothstep(0.0, 1.8, min(grid_dist.x, grid_dist.y));
	water_col = mix(water_col, vec3(0.35, 0.75, 0.85), grid_line * 0.045);

	// Zone Ring Boundary Markers (1200px, 2500px, 3800px)
	float ring1 = 1.0 - smoothstep(0.0, 6.0, abs(dist - 1200.0));
	float ring2 = 1.0 - smoothstep(0.0, 6.0, abs(dist - 2500.0));
	float ring3 = 1.0 - smoothstep(0.0, 6.0, abs(dist - 3800.0));
	water_col += vec3(0.2, 0.6, 0.5) * (ring1 + ring2 + ring3) * 0.12;

	COLOR = vec4(water_col, 1.0);
}
