var defaultConf = {
	'focalDepth': 5,
	'fstop': 8.0,
	'maxblur': 2.0,
	'CoC': 0.03,
	'threshold': 0.5,
	'gain': 0.2,
	'bias': 0.5,
};

function initBokeh(context, conf) {
	var width = context.width;
	var height = context.height;
	var renderer = context.renderer;
	conf = conf || defaultConf;

	// depth
	var depthShader = THREE.ShaderLib["depthRGBA"];
	var depthUniforms = THREE.UniformsUtils.clone(depthShader.uniforms);

	var depthMaterial = new THREE.ShaderMaterial({
		fragmentShader: depthShader.fragmentShader,
		vertexShader: depthShader.vertexShader,
		uniforms: depthUniforms
	});
	context.depthMaterial = depthMaterial;
	depthMaterial.blending = THREE.NoBlending;

	var depthTarget = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat
	});
	context.depthTarget = depthTarget;

	// postprocessing
	var composer = new THREE.EffectComposer(renderer);
	context.composer = composer;
	composer.addPass(new THREE.RenderPass(context.scene, context.camera));

	// depth of field
	var dof = new THREE.ShaderPass(THREE.DoFShader);

	// binding
	dof.uniforms['tDepth'].value = depthTarget;

	dof.uniforms['size'].value.set(width, height);
	dof.uniforms['textel'].value.set(1.0 / width, 1.0 / height);

	// camera, copied, as a matter of fact
	dof.uniforms['znear'].value = context.camera.near; //camera clipping start
	dof.uniforms['zfar'].value = context.camera.far; //camera clipping end
	dof.uniforms['focalLength'].value = context.camera.focalLength; //focal length in mm

	// these things matter, get them from conf
	dof.uniforms['focalDepth'].value = conf.focalDepth;
	dof.uniforms['fstop'].value = conf.fstop;
	dof.uniforms['maxblur'].value = conf.maxblur;
	dof.uniforms['CoC'].value = conf.CoC; //circle of confusion size in mm (35mm film = 0.03mm)	
	dof.uniforms['threshold'].value = conf.threshold; //highlight threshold;
	dof.uniforms['gain'].value = conf.gain; //highlight gain;
	dof.uniforms['bias'].value = conf.bias; //bokeh edge bias		

	// looks technical, doesn't change anything, though
	dof.uniforms['fringe'].value = 3.7; //bokeh chromatic aberration/fringing

	composer.addPass(dof);
	dof.renderToScreen = true;
}

function renderBokeh(context) {
	context.composer.render();
}