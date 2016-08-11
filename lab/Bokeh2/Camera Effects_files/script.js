aspectRatio = 0.425531;
devicePixelRatio = window.devicePixelRatio || 1;

preload();
preloader = {
	get: function(name) {
		return this[name];
	}
};

function preload() {
	var img = $("<img />").attr('src', 'Camera Effects_files/checker_board.png')
		.on('load', function() {
			preloader['testPattern'] = this;
			preloadComplete();
		});
}

function preloadComplete() {
	init();
	animate(0);
}

function init() {
	var width = document.body.clientWidth * devicePixelRatio,
		height = (width * aspectRatio) * devicePixelRatio,
		depthShader,
		depthUniforms,
		gui;

	renderer = new THREE.WebGLRenderer({clearColor: 0x888888});
	renderer.setSize(width, height);
	document.getElementsByClassName('viewport')[0].appendChild(renderer.domElement);
	window.onresize = resizeHandler;

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(0, width / height, 0.01, 20);
	camera.focalLength = 45;
	camera.frameSize = 32;
	camera.setLens(camera.focalLength, camera.frameSize);
	camera.position.y = 1;
	camera.position.z = 5;

	controls = new THREE.OrbitControls(camera, renderer.domElement);
	// min pole is the north pole defaults to 0
	controls.minPolarAngle = 0;
	// max pole is the south pole defaults to Math.PI
	controls.maxPolarAngle = Math.PI - 1.37;
	controls.maxDistance = 5;

	initBokeh(width,height);

	setupScene();
}

function setupScene() {
	var ambientLight,
		spotLight,
		pointLight,
		geometry,
		texture,
		material,
		mesh,
		cube,
		i,
		colors,
		_last;

	ambientLight = new THREE.AmbientLight(0x333333);
	scene.add(ambientLight);

	spotLight = new THREE.SpotLight(0xFFFFFF);
	spotLight.position.set(0, 8, 0);

	scene.add(spotLight);

	geometry = new THREE.PlaneGeometry(10, 10, 10);
	texture = new THREE.Texture(preloader.get('testPattern'), null, THREE.RepeatWrapping, THREE.RepeatWrapping);
	texture.repeat.x = 24;
	texture.repeat.y = 24;
	texture.needsUpdate = true;
	material = new THREE.MeshLambertMaterial({
		map: texture
	});

	// build box from planes
	cube = new THREE.Object3D();
	for (i = 0; i < 6; i++) {
		mesh = new THREE.Mesh(geometry, material);
		switch (i) {
			case 0:
				//floor
				mesh.rotation.x = -Math.PI / 2;
				break;
			case 1:
				// ceiling
				mesh.rotation.x = Math.PI / 2;
				mesh.position.y = 3;
				break;
			case 2:
				// back wall
				mesh.position.z = -5;
				break;
			case 3:
				//front wall
				mesh.rotation.x = Math.PI;
				mesh.position.z = 5;
				break;
			case 4:
				// right wall
				mesh.rotation.y = -Math.PI / 2;
				mesh.position.x = 5;
				break;
			case 5:
				// left wall
				mesh.rotation.y = Math.PI / 2;
				mesh.position.x = -5;
				break;
		}
		cube.add(mesh);
	}
	scene.add(cube);

	geometry = new THREE.CylinderGeometry(0.1, 0.1, 1);
	texture = new THREE.Texture(preloader.get('testPattern'), null, THREE.RepeatWrapping, THREE.RepeatWrapping);
	texture.repeat.x = 4;
	texture.repeat.y = 6;
	texture.needsUpdate = true;
	material = new THREE.MeshLambertMaterial({
		map: texture
	});
	colors = [null, 0xffffff, 0xFF0000, 0xff7700, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff];
	for (i = 1; i < 10; i++) {
		mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(5 - i, 0.5, 5 - i);
		scene.add(mesh);
	}

	geometry = new THREE.SphereGeometry(0.1);

	for (i = 1; i < 10; i++) {
		material = new THREE.MeshBasicMaterial({
			color: colors[i]
		});
		mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(5 - i, 1.1, 5 - i);
		if (i === 5) {
			controls.center.copy(mesh.position);
		}
		scene.add(mesh);
		pointLight = new THREE.PointLight(colors[i], 1, 1.5);
		pointLight.position.copy(mesh.position);
		scene.add(pointLight);
	}
}

function update(t) {
	controls.update();
}

function animate(t) {
	update(t);

	scene.overrideMaterial = depthMaterial;
	renderer.render(scene, camera, depthTarget);

	scene.overrideMaterial = null;

	renderBokeh();
	// composer.render();
	//renderer.render(scene, camera);

	window.requestAnimationFrame(animate, renderer.domElement);
}

function resizeHandler() {
	console.log("asda");

	var width = document.body.clientWidth * devicePixelRatio,
		height = (width * aspectRatio) * devicePixelRatio,
		previousDepthTarget;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize(width, height);
	composer.setSize(width, height);

	dof.uniforms['tDepth'].value = depthTarget;
	dof.uniforms['size'].value.set(width, height);
	dof.uniforms['textel'].value.set(1.0 / width, 1.0 / height);
}
