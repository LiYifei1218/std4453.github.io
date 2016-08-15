THREE.DoFShader = {
	uniforms: {
		"tDiffuse": {type: "t",	value: null},
		"tDepth": {type: "t", value: null},

		"size": {type: "v2", value: new THREE.Vector2(512, 512)},
		"textel": {type: "v2", value: new THREE.Vector2(1 / 512, 1 / 512)},

		"focalDepth": {type: "f", value: 200.0},
		"focalLength": {type: "f", value: 28.0},
		"fstop": {type: "f", value: 2.8},

		"znear": {type: "f", value: 1.0},
		"zfar": {type: "f",	value: 1000.0},

		"CoC": {type: "f", value: 0.03},
		"maxblur": {type: "f", value: 1.0},
		"bias": {type: "f", value: 0.5},
		"fringe": {type: "f", value: 3.7},
	},

	vertexShader: [
		"varying vec2 vUv;",
		
		"void main() {",
			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
		"}"
	].join("\n"),

	fragmentShader: [
		"precision mediump float;",
		"#define PI 3.14159265",
		"varying vec2 vUv;",

		"uniform sampler2D tDiffuse;",
		"uniform sampler2D tDepth;",

		"uniform vec2 size;", // texture width and height
		"uniform vec2 texel;", // textel size

		"uniform float focalDepth;", //focal distance value in meters, but you may use autofocus option below
		"uniform float focalLength;", //focal length in mm
		"uniform float fstop;", //f-stop value

		"uniform float znear;", //camera clipping start
		"uniform float zfar;", //camera clipping end

		"uniform float CoC;", //circle of confusion size in mm (35mm film = 0.03mm)
		"uniform float maxblur;", //clamp value of max blur (0.0 = no blur,1.0 default)
		"uniform float bias;", //bokeh edge bias
		"uniform float fringe;", //bokeh chromatic aberration/fringing

		// samples and rings need to be constants. no dynamic loop counters in OpenGL ES
		// Can shader be broken into 2 pass? ... 
		"int samples = 5;", //samples on the first ring

		// RGBA depth
		"float unpackDepth(const in vec4 rgba_depth) {",
			"const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);",
			"float depth = dot(rgba_depth, bit_shift);",
			"return depth;",
		"}",

		"vec3 color(vec2 coords, float blur) {", //processing the sample
			"vec3 col = vec3(0.0);",
			"col.r = texture2D(tDiffuse, coords + vec2(0.0, 1.0) * texel * fringe * blur).r;",
			"col.g = texture2D(tDiffuse, coords + vec2(-0.866, -0.5) * texel * fringe * blur).g;",
			"col.b = texture2D(tDiffuse, coords + vec2(0.866, -0.5) * texel * fringe * blur).b;",
			"return col;",
		"}",

		"void main() {",
			//scene depth calculation
			"float depth = unpackDepth(texture2D(tDepth,vUv));",
			"depth = -zfar * znear / (depth * (zfar - znear) - zfar);",
			//focal plane calculation",
			"float fDepth = focalDepth;",

			//dof blur factor calculation
			"float f = focalLength;", //focal length in mm
			"float d = fDepth * 1000.0;", //focal plane in mm
			"float o = depth * 1000.0;", //depth in mm
			"float a = (o * f) / (o - f);",
			"float b = (d * f) / (d - f);",
			"float c = (d - f) / (d * fstop * CoC);",
			"float blur = abs(a - b) * c;",
			"if (o < 100.0)",
				"blur = 0.0;",
			"blur = clamp(blur, 0.0, 1.0);",
			// getting blur x and y step factor
			"float w = (1.0 / size.x) * blur * maxblur;",
			"float h = (1.0 / size.y) * blur * maxblur;",

			// calculation of final color
			"vec3 col = texture2D(tDiffuse, vUv).rgb;",
			"const ivec4 jMax = ivec4(0, 3, 6, 9);",
			"if (blur >= 0.05) {",
				"for (int i = 1; i <= 3; i += 1) {",
				"float ringsamples = float(i * samples);",
				"if (i == 1)",
					"for (int j = 0; j < 3; j += 1) {",
						"float step = PI * 2.0 / ringsamples;",
						"float pw = (cos(float(j) * step) * float(i));",
						"float ph = (sin(float(j) * step) * float(i));",
						"col += color(vUv + vec2(pw * w, ph * h), blur);",
					"}",
				"else if (i == 2)",
					"for (int j = 0; j < 6; j += 1) {",
						"float step = PI * 2.0 / ringsamples;",
						"float pw = (cos(float(j) * step) * float(i));",
						"float ph = (sin(float(j) * step) * float(i));",
						"col += color(vUv + vec2(pw * w, ph * h), blur);",
					"}",
				"else if (i == 3)",
					"for (int j = 0; j < 9; j += 1) {",
						"float step = PI * 2.0 / ringsamples;",
						"float pw = (cos(float(j) * step) * float(i));",
						"float ph = (sin(float(j) * step) * float(i));",
						"col += color(vUv + vec2(pw * w, ph * h), blur);",
					"}",
				"}",
				"col /= 18.0;", //divide by sample count
			"}",

			"gl_FragColor = vec4(col, 1.0);",
		"}",
	].join("\n")
};
