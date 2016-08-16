var pixelate = {};
window.pixelate = pixelate;

pixelate.defaultConf = {
	pixel: [4, 4],
	interval: [5, 5],
};

function initPixelate(context, conf) {
	var width = context.width;
	var height = context.height;
	conf = conf || pixelate.defaultConf;

	var uniforms = THREE.UniformsUtils.clone(THREE.PixelateShader.uniforms);

	THREE.Vector2.prototype.set.apply(uniforms['pixel'].value, conf.pixel);
	THREE.Vector2.prototype.set.apply(uniforms['interval'].value, conf.interval);

	uniforms['size'].value.set(width, height);
	uniforms['texel'].value.set(1 / width, 1 / height);
	context.addResizeListener(function setPixelateUniforms(context) {
		uniforms['size'].value.set(context.width, context.height);
		uniforms['texel'].value.set(1 / context.width, 1 / context.height);
	});

	var material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: THREE.PixelateShader.vertexShader,
		fragmentShader: THREE.PixelateShader.fragmentShader,
	});

	var scene = new THREE.Scene();
	var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	var geometry = new THREE.PlaneGeometry(2, 2);
	var mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	pixelate.pixelate = {
		uniforms: uniforms,
		scene: scene,
		camera: camera,
	};
}

function renderPixelate(context) {
	pixelate.pixelate.uniforms['tDiffuse'].value = context.renderBuffer.texture;
	pixelate.pixelate.uniforms['clipCenter'].value = context.clipCenter;

	context.renderer.render(pixelate.pixelate.scene, pixelate.pixelate.camera);
}