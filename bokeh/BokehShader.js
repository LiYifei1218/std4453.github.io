THREE.BokehShader = {
	uniforms: {
		"tDepth": {type: "t", value: null},
		"tColor": {type: "t", value: null},
		"tShape": {type: "t", value: null},

		"fTarget": {type: "f", value: 0.5},
		"maxBlur": {type: "f", value: 3.0},
		"expo": {type: "f", value: 1.0},

		"width": {type: "f", value: 0},
		"height": {type: "f", value: 0},
	},

	vertexShader: [
		"uniform int width;",
		"uniform int height;",

		"uniform sampler2D tDepth;",
		"uniform sampler2D tColor;",

		"uniform float fTarget;",
		"uniform float maxBlur;",

		"attribute vec2 center;",
		"attribute vec2 offset;",

		"varying vec2 vUv;",
		"varying vec3 color;",

		"vec2 normalizeCenter(vec2 center, int width, int height) {",
		"return vec2(center.x / float(width), center.y / float(height));",
		"}",

		"float radius(vec2 center) {",
		"float depth = texture2D(tDepth, center).r;",
		"float delta = abs(depth - fTarget);",
		// "float r = clamp(delta * 10.0, 0.0, 1.0);",
		"float r = delta * 2.0;",
		"r = r * r * r;",
		// "return r * maxBlur;",
		"return 2.0;",
		"}",

		"void main() {",
		"vUv = uv;",
		"vec2 normCenter = normalizeCenter(center, width, height);",
		"float r = radius(normCenter);",
		"vec2 pos = center + vec2(offset.x * r, offset.y * r);",
		"gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0, 1.0);",
		"color = texture2D(tColor, normCenter).rgb;",
		"}",
	].join('\n'),

	fragmentShader: [
		"precision mediump float;",

		"uniform sampler2D tShape;",

		"varying vec2 vUv;",
		"varying vec3 color;",

		"void main() {",
		// "vec4 shapeTexel = texture2D(tShape, vUv);",
		// "float luminance = shapeTexel.r;",
		// "float luminance = 1.0;",
		// "float alpha = shapeTexel.a;",
		// "float alpha = sqrt((vUv.x - 0.5) * (vUv.x - 0.5) + (vUv.y - 0.5) + (vUv.y - 0.5));",
		// "gl_FragColor = vec4(color.rgb * luminance, alpha);",
		// "gl_FragColor = vec4(0.0);",
		"gl_FragColor = vec4(color.rgb, 1.0);",
		"}",
	].join('\n'),
}