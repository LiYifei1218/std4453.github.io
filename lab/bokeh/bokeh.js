var bokeh = {};
window.bokeh = bokeh;

bokeh.defaultConf = {
	'focalDepth': 5,
	'fstop': 8.0,
	'maxblur': 2.0,
	'CoC': 0.03,
	'bias': 0.5,
};

function initBokeh(context, conf) {
	var width = context.width;
	var height = context.height;
	conf = conf || bokeh.defaultConf;

	var depthShader = THREE.ShaderLib["depthRGBA"];
	var depthUniforms = THREE.UniformsUtils.clone(depthShader.uniforms);
	var depthMaterial = new THREE.ShaderMaterial({
		fragmentShader: depthShader.fragmentShader,
		vertexShader: depthShader.vertexShader,
		uniforms: depthUniforms,
		blending: THREE.NoBlending,
	});
	bokeh.depthMaterial = depthMaterial;
	var depthTarget = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
	});
	bokeh.depthTarget = depthTarget;

	var uniforms = THREE.UniformsUtils.clone(THREE.DoFShader.uniforms);

	uniforms['tDiffuse'].value = context.renderBuffer;
	uniforms['tDepth'].value = depthTarget;

	uniforms['size'].value.set(width, height);
	uniforms['textel'].value.set(1.0 / width, 1.0 / height);

	uniforms['znear'].value = context.camera.near;
	uniforms['zfar'].value = context.camera.far;
	uniforms['focalLength'].value = context.camera.focalLength;

	uniforms['focalDepth'].value = conf.focalDepth;
	uniforms['fstop'].value = conf.fstop;
	uniforms['maxblur'].value = conf.maxblur;
	uniforms['CoC'].value = conf.CoC;
	uniforms['bias'].value = conf.bias;

	var material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: THREE.DoFShader.vertexShader,
		fragmentShader: THREE.DoFShader.fragmentShader,
	});

	var scene = new THREE.Scene();
	var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	var geometry = new THREE.PlaneGeometry(2, 2);
	var mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	bokeh.dof = {
		uniforms: uniforms,
		scene: scene,
		camera: camera,
	};
}

function renderBokeh(context) {
	context.scene.overrideMaterial = bokeh.depthMaterial;
	context.renderer.render(context.scene, context.camera, bokeh.depthTarget);
	context.scene.overrideMaterial = null;

	context.renderer.render(bokeh.dof.scene, bokeh.dof.camera);
}