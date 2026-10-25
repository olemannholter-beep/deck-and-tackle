shader_type canvas_item;

uniform float vignette_intensity : hint_range(0.1, 0.95) = 0.25;
uniform float fog_density : hint_range(0.0, 1.0) = 0.10;
uniform float eldritch_pulse : hint_range(0.0, 1.0) = 0.0;
uniform float time_sec = 0.0;

void fragment() {
	vec2 centered = UV - vec2(0.5);
	float dist = length(centered) * 1.414;

	// Smooth radial vignette
	float inner_radius = mix(0.68, 0.24, vignette_intensity);
	float vig = smoothstep(inner_radius, inner_radius + 0.48, dist);

	// Drifting procedural fog wisps
	float wisp = sin(UV.x * 8.0 + time_sec * 0.4) * cos(UV.y * 6.0 - time_sec * 0.3) * 0.5 + 0.5;
	vec3 fog_col = vec3(0.06, 0.14, 0.15) * wisp * fog_density;

	// Zone 4 Eldritch edge pulse (sickly cyan/violet)
	float pulse_wave = (sin(time_sec * 3.2 + UV.y * 10.0) * 0.5 + 0.5) * eldritch_pulse;
	vec3 edge_tint = mix(vec3(0.0, 0.02, 0.04), vec3(0.04, 0.32, 0.38), pulse_wave * 0.45);

	vec3 final_col = edge_tint + fog_col;
	float final_alpha = clamp(vig * (0.45 + vignette_intensity * 0.55) + fog_density * 0.18, 0.0, 0.96);
	COLOR = vec4(final_col, final_alpha);
}
