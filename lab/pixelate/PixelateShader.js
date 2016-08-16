THREE.PixelateShader = {
	uniforms: {
		"tDiffuse": {type: "t", value: null},

		"size": {type: "v2", value: new THREE.Vector2(1, 1)},
		"texel": {type: "v2", value: new THREE.Vector2(1, 1)},

		"pixel": {type: "v2", value: new THREE.Vector2(1, 1)},
		"interval": {type: "v2", value: new THREE.Vector2(1, 1)},

		"bg": {type: "v3", value: new THREE.Vector3(0, 0, 0)},

		"clipCenter": {type: "f", value: 0},
		"angleRatio": {type: "f", value: 0},
	},

	vertexShader: [
		"varying vec2 vUv;",

		"void main() {",
			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
		"}",
	].join('\n'),

	fragmentShader: [
		"precision mediump float;",

		"uniform sampler2D tDiffuse;",

		"uniform vec2 size;",
		"uniform vec2 texel;",

		"uniform vec2 pixel;",
		"uniform vec2 interval;",

		"uniform vec3 bg;",

		"varying vec2 vUv;",

		"uniform float clipCenter;",

		"void main() {",
			"if (vUv.x * size.x - clipCenter > (vUv.y - 0.5) * 0.26794919243112270647255365849413 * size.y) discard;",

			"float x = vUv.x * size.x;",
			"float y = vUv.y * size.y;",

			"float px = float(int(x / interval.x)) * interval.x;",
			"float py = float(int(y / interval.y)) * interval.y;",

			"float ox = x - px;",
			"float oy = y - py;",

			"vec3 color = vec3(0.0);",
			"if (ox < pixel.x && oy < pixel.y)",
				"color = texture2D(tDiffuse, vec2(px / size.x, py / size.y)).rgb;",
			"else",
				"color = bg;",

			"gl_FragColor = vec4(color, 1.0);",
		"}",
	].join('\n'),
};