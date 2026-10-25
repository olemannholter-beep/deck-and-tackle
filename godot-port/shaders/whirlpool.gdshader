shader_type canvas_item;

uniform float time_sec = 0.0;
uniform float lifecycle_alpha : hint_range(0.0, 1.0) = 1.0;
uniform vec4 glow_color : source_color = vec4(0.22, 0.85, 0.78, 1.0);

void fragment() {
	vec2 uv = (UV - vec2(0.5)) * 2.0;
	float r = length(uv);
	if (r > 1.0) {
		COLOR = vec4(0.0);
	} else {
		float angle = atan(uv.y, uv.x);
		float spiral = sin(angle * 4.0 + r * 14.0 - time_sec * 5.5);
		float ring = sin(r * 18.0 - time_sec * 4.0);
		float foam = smoothstep(0.2, 0.9, spiral * 0.6 + ring * 0.4);
		float edge_fade = smoothstep(1.0, 0.25, r);
		float core_dark = smoothstep(0.0, 0.28, r);

		vec3 col = mix(vec3(0.01, 0.03, 0.06), glow_color.rgb, foam * core_dark);
		float alpha = (0.35 + foam * 0.55) * edge_fade * lifecycle_alpha;
		COLOR = vec4(col, alpha);
	}
}
