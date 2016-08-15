function initBokeh(context) {
	var width = context.width;
	var height = context.height;
	var renderer = context.renderer;
	var scene = context.scene;
	var camera = context.camera;

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
	composer.addPass(new THREE.RenderPass(scene, camera));

	// depth of field
	var dof = new THREE.ShaderPass(THREE.DoFShader);

	dof.uniforms['tDepth'].value = depthTarget;
	dof.uniforms['size'].value.set(width, height);
	dof.uniforms['textel'].value.set(1.0 / width, 1.0 / height);

	//make sure that these two values are the same for your camera, otherwise distances will be wrong.
	dof.uniforms['znear'].value = camera.near; //camera clipping start
	dof.uniforms['zfar'].value = camera.far; //camera clipping end

	dof.uniforms['focalDepth'].value = 5; //focal distance value in meters, but you may use autofocus option below
	dof.uniforms['focalLength'].value = camera.focalLength; //focal length in mm
	dof.uniforms['fstop'].value = 8.0; //f-stop value
	dof.uniforms['showFocus'].value = false; //show debug focus point and focal range (orange = focal point, blue = focal range)

	dof.uniforms['manualdof'].value = false; //manual dof calculation
	dof.uniforms['ndofstart'].value = 1.0; //near dof blur start
	dof.uniforms['ndofdist'].value = 2.0; //near dof blur falloff distance	
	dof.uniforms['fdofstart'].value = 2.0; //far dof blur start
	dof.uniforms['fdofdist'].value = 3.0; //far dof blur falloff distance	

	dof.uniforms['CoC'].value = 0.03; //circle of confusion size in mm (35mm film = 0.03mm)	

	dof.uniforms['vignetting'].value = true; //use optical lens vignetting?
	dof.uniforms['vignout'].value = 1.3; //vignetting outer border
	dof.uniforms['vignin'].value = 0.1; //vignetting inner border
	dof.uniforms['vignfade'].value = 22.0; //f-stops till vignete fades	

	dof.uniforms['autofocus'].value = false; //use autofocus in shader? disable if you use external focalDepth value
	dof.uniforms['focus'].value.set(0.5, 0.5); // autofocus point on screen (0.0,0.0 - left lower corner, 1.0,1.0 - upper right) 
	dof.uniforms['maxblur'].value = 2.0; //clamp value of max blur (0.0 = no blur,1.0 default)	

	dof.uniforms['threshold'].value = 0.5; //highlight threshold;
	dof.uniforms['gain'].value = 2.0; //highlight gain;

	dof.uniforms['bias'].value = 0.5; //bokeh edge bias		
	dof.uniforms['fringe'].value = 3.7; //bokeh chromatic aberration/fringing

	dof.uniforms['noise'].value = true; //use noise instead of pattern for sample dithering
	dof.uniforms['namount'].value = 0.0001; //dither amount

	dof.uniforms['depthblur'].value = false; //blur the depth buffer?
	dof.uniforms['dbsize'].value = 1.25; //depthblursize

	composer.addPass(dof);
	dof.renderToScreen = true;
}

function renderBokeh(context) {
	context.composer.render();
}