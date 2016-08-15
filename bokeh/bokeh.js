var bokeh = {};
window.bokeh = bokeh;

function initBokeh(context) {
	var width = context.width;
	var height = context.height;

	bokeh.depthMaterial = new THREE.MeshDepthMaterial();
	var depthTarget = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
	});
	bokeh.depthTarget = depthTarget;

	bokeh.colorTarget = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
	});

	var shader = THREE.BokehShader;
	var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
	var material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		depthTest: false,
		blending: THREE.NormalBlending,
		transparent: true,
	});
	var scene = new THREE.Scene();
	var camera = new THREE.OrthographicCamera(0, width, height, 0, -3, 3);
	var offsets = [
		-1, -1,  1, -1,  1, 1,
		1, 1,  -1, 1,  -1, -1,
	];
	var geometry = new THREE.BufferGeometry();
	var aVertices = [];
	var aUvs = [];
	var aCenters = [];
	var aOffsets = [];
	for (var x = 0; x < width; x+=5)
		for (var y = 0; y < height; y+=5) {
			for (var i = 0; i < offsets.length; i+=2) {
				aVertices.push(x + offsets[i], y + offsets[i + 1], 1);
				aUvs.push((offsets[i] + 1) / 2, (offsets[i + 1] + 1) / 2);
				aCenters.push(x, y);
				aOffsets.push(offsets[i], offsets[i + 1]);
			}
		}
	geometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(aVertices), 3));
	geometry.addAttribute("uv", new THREE.BufferAttribute(new Float32Array(aUvs), 2));
	geometry.addAttribute("center", new THREE.BufferAttribute(new Float32Array(aCenters), 2));
	geometry.addAttribute("offset", new THREE.BufferAttribute(new Float32Array(aOffsets), 2));
	var mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	var shapeTexture = new THREE.TextureLoader().load("shape.png");
	shapeTexture.minFilter = THREE.LinearFilter;
	shapeTexture.magFilter = THREE.LinearFilter;
	uniforms["tShape"].value = shapeTexture;

	uniforms["fTarget"].value = 0.01;
	uniforms["maxBlur"].value = 6.0;
	uniforms["expo"].value = 1.0;
	uniforms["width"].value = width;
	uniforms["height"].value = height;

	bokeh.bokehPass = {
		shader: shader,
		uniforms: uniforms,
		material: material,
		scene: scene,
		camera: camera,
	};
}

function renderBokeh(context) {
	var scene = context.scene;
	var camera = context.camera;

	context.scene.overrideMaterial = bokeh.depthMaterial;
	context.renderer.render(context.scene, context.camera, bokeh.depthTarget);
	context.scene.overrideMaterial = null;

	context.renderer.render(context.scene, context.camera, bokeh.colorTarget);

	bokeh.bokehPass.uniforms["tDepth"].value = bokeh.depthTarget.texture;
	bokeh.bokehPass.uniforms["tColor"].value = bokeh.colorTarget.texture;
	context.renderer.render(bokeh.bokehPass.scene, bokeh.bokehPass.camera);
}