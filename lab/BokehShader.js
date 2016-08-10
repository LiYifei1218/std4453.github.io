/*
BokehShader.js - Separable Bokeh Shader Demo in WebGL
http://lorneswork.com/

Copyright (c) 2012-2013 Lorne McIntosh

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

// define some globals
var container;
var camera, cubecamera, scene, renderer;
//var controls;

var width = 800;
var height = 600;

var nearPlane = 0.01; //1cm
var farPlane = 300; //300m

var numSamples = 16; //16 samples x 3 passes = 48 actual samples ~= 256 effective samples

var postprocessing = { enabled  : true };

//var clock = new THREE.Clock();


//---------------------------------------------------------------------------
// Cubemap shader (basic cubemap sampling + hack to simulate an HDR image)
//---------------------------------------------------------------------------
var cubemap_vertexShader = [
	"varying vec3 vWorldPosition;",
	"void main() {",
	"	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
	"	vWorldPosition = worldPosition.xyz;",
	"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
	"}"
].join( "\n" );

var cubemap_fragmentShader = [
	"uniform samplerCube tCube;",
	"uniform float tFlip;",
	"varying vec3 vWorldPosition;",
	"void main() {",
	"	gl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );",
	"	gl_FragColor = gl_FragColor * gl_FragColor * gl_FragColor * 64.0;	//arbitrary mapping to simulate an HDR image",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// Depth shader (writes linear depth divided by far clipping plane)
//---------------------------------------------------------------------------
var Depth_vertexShader = [
	"varying vec4 viewSpacePosition;",
	"void main() {",
	"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
	"	viewSpacePosition = modelViewMatrix * vec4( position, 1.0 );",
	"}"
].join( "\n" );

var Depth_fragmentShader = [
	"uniform float farPlane;",
	"varying vec4 viewSpacePosition;",
	"void main()",
	"{",
	"	gl_FragColor = vec4(-viewSpacePosition.z / farPlane); //write the Z-depth",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// A generic vertex shader (used in our post-processing shaders)
//---------------------------------------------------------------------------
var Generic_vertexShader = [
	"varying vec2 vUv;",
	"void main() {",
	"	vUv = vec2( uv.x, uv.y );",
	"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// CoC_fragmentShader
//---------------------------------------------------------------------------
// Computes the Circle of Confusion diameter at every pixel. This is
// then converted into a % of the total image size, by assuming an image
// sensor (or film) 24mm in height (35mm film standard). To avoid artifacts,
// this % is then artificially clamped to MaxCoC. The result should be stored
// in the alpha channel of the color map to be read by subsequent passes.
//---------------------------------------------------------------------------
var CoC_fragmentShader = [
	"varying vec2 vUv;",
	"uniform sampler2D DepthSamp;",
	"uniform float farPlane;",
	"",
	"uniform float S1;				//focus depth (ex. 7 metres)",
	"uniform float f;				//focal length (ex. 0.05 metres (50mm))",
	"uniform float A;				//aperture diameter (ex. 0.036 metres (36mm))",
	"uniform float sensorHeight;	//height of camera's image sensor (ex. 0.024 metres (24mm)) - 35mm \"full-frame\" film format is 36mm x 24mm)",
	"uniform float maxCoC;			//artifical maximum CoC diameter (as percentage of image)",
	"",
	"void main()",
	"{",
	"	//reconstruct scene depth at this pixel",
	"	float S2 = texture2D(DepthSamp, vUv).x * farPlane;",
	"	",
	"	//calculate circle of confusion diameter",
	"	//(from http://en.wikipedia.org/wiki/Circle_of_confusion)",
	"	float c = A * (abs(S2 - S1) / S2) * (f / (S1 - f));",
	"	",
	"	//put CoC into a % of the image sensor height",
	"	float percentOfSensor = c / sensorHeight;",
	"	",
	"	//artificially clamp % between 0 and maxCoC",
	"	float blurFactor = clamp(percentOfSensor, 0.0, maxCoC);",
	"	",
	"	gl_FragColor = vec4(blurFactor);",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// DepthOfFieldFilter
//---------------------------------------------------------------------------
// This blur filter forms the core of the technique. The image is sampled
// at each of the provided sampleOffsets[] and a weighted average (designed to
// reduce bleeding artifacts) is returned. See the paper for more info.
//---------------------------------------------------------------------------
var DepthOfFieldFilterFunction = [
	"vec4 DepthOfFieldFilter()",
	"{",
	"	//these are used to tune the \"pixel-bleeding\" fix",
	"	const float bleedingBias = 0.02;",
	"	const float bleedingMult = 30.0;",
	"	",
	"	//get the center samples for later reference",
	"	vec4 centerPixel = texture2D(ColorSamp, vUv);",
	"	float centerDepth = texture2D(DepthSamp, vUv).x;",
	"	",
	"	//for finding the weighted average",
	"	vec4 color = vec4(0.0);",
	"	float totalWeight = 0.0;",
	"	",
	"	//for each sample",
	"	for(int t = 0; t < sampleCount; t++)",
	"	{",
	"		vec2 offset = sampleOffsets[t];",
	"		",
	"		//calculate the coordinates for this sample",
	"		vec2 sampleCoords = vUv + offset * centerPixel.a;",
	"		",
	"		//do the texture sampling for this sample",
	"		vec4 samplePixel = texture2D(ColorSamp, sampleCoords);",
	"		float sampleDepth = texture2D(DepthSamp, sampleCoords).x;",
	"		",
	"		//---------------------------------------------------------------------------",
	"		//Prevent focused foreground objects from bleeding onto blurry backgrounds",
	"		//but allow focused background objects to bleed onto blurry foregrounds",
	"		//---------------------------------------------------------------------------",
	"		float weight = sampleDepth < centerDepth ? samplePixel.a * bleedingMult : 1.0;",
	"		weight = (centerPixel.a > samplePixel.a + bleedingBias) ? weight : 1.0;",
	"		weight = clamp(weight, 0.0, 1.0);",
	"		//---------------------------------------------------------------------------",
	"		",
	"		//add this sample to the weighted average",
	"		color += samplePixel * weight;",
	"		totalWeight += weight;",
	"	}",
	"	//return the weighted average",
	"	return color / totalWeight;",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// Bokeh_fragmentShader
//---------------------------------------------------------------------------
// A bokeh-producing depth of field pixel shader. This performs one pass of a
// seperable filter and must be used twice (with different offsets) to create
// a cumulative effect. The alpha channel of ColorSamp must hold a CoC
// (i.e. bluriness) map. See the paper for more info.
//---------------------------------------------------------------------------
var Bokeh_fragmentShader = [
	"varying vec2 vUv;",
	"uniform sampler2D DepthSamp;",
	"uniform sampler2D ColorSamp;",
	"",
	"const int sampleCount = "+numSamples+";",
	"uniform vec2 sampleOffsets[sampleCount];",
	"",
	DepthOfFieldFilterFunction,		//include DepthOfFieldFilter()
	"",
	"void main()",
	"{",
	"	gl_FragColor = DepthOfFieldFilter();",
	"}"
].join( "\n" );

//---------------------------------------------------------------------------
// BokehMin_fragmentShader
//---------------------------------------------------------------------------
// A bokeh-producing depth of field pixel shader for use on the final pass
// of the separable technique. It performs the regular DepthOfFieldFilter(), and
// then returns the min() of that result and the supplied ColorSampB to
// complete the desired bokeh shape. max() could also be used. See the
// paper for more info.
//---------------------------------------------------------------------------
var BokehMin_fragmentShader = [
	"varying vec2 vUv;",
	"uniform sampler2D DepthSamp;",
	"uniform sampler2D ColorSamp;",
	"uniform sampler2D ColorSampB;",
	"",
	"const int sampleCount = "+numSamples+";",
	"uniform vec2 sampleOffsets[sampleCount];",
	"",
	DepthOfFieldFilterFunction,		//include DepthOfFieldFilter()
	"",
	"void main()",
	"{",
	"	vec4 colorMapA = DepthOfFieldFilter();",
	"",
	"	//choose the minimum value to complete the shape",
	"	gl_FragColor = min(colorMapA, texture2D(ColorSampB, vUv));",
	"}"
].join( "\n" );


function init()
{
	renderer = new THREE.WebGLRenderer( { antialias: true, alpha: false, precision: 'highp'} ); //TODO: antialiasing doesn't work?
	renderer.setSize( width, height );
	
	renderer.autoClear = true;
	renderer.setClearColor( new THREE.Color( 0xFFFFFF ), 0 );

	renderer.sortObjects = false;
	
	renderer.shadowMapEnabled = true;
	renderer.shadowMapAutoUpdate = true;
	renderer.shadowMapType = THREE.PCFShadowMap;
	
	container = document.getElementById( 'BokehShader' );
	container.appendChild( renderer.domElement );
	
	// Create the main scene
	scene = new THREE.Scene();
	
	// Add the cameras
	camera = new THREE.PerspectiveCamera( 60, width/height, nearPlane, farPlane );
	camera.position.set(-0.85,0.8,-0.1);
	camera.rotation.set(0,-Math.PI/2.0,0);
	scene.add( camera );
	
	// Setup the lights
	var ambientLight = new THREE.AmbientLight( 0x1A110A );
	scene.add( ambientLight );

	var light = new THREE.SpotLight( 0xDAB781, 2, 0, Math.PI/4, 10 );
	light.position.set( 0, 2, 2 );
	light.target.position.set( 0, 0, 0 );
	light.castShadow = true;
	light.shadowCameraNear = 1;
	light.shadowCameraFar = 4;
	light.shadowCameraFov = 45;
	scene.add( light );
	
	// Load the collada scene
	var loader = new THREE.ColladaLoader();
	loader.options.convertUpAxis = true;
	// loader.options.defaultEnvMap = cubecamera.renderTarget;		//use this cubemap for all reflective materials
	// loader.load( '/projects/BokehShader/models/banquet.dae', function ( collada ) {
	loader.load( 'BokehShader/banquet.dae', function ( collada ) {
		var obj = collada.scene;
		obj.traverse( function ( child ) {
			child.castShadow = true;
			child.receiveShadow = true;
		} ); 
		obj.updateMatrix();
		scene.add(obj);
	} );

	
	//initialize our postprocessing stuff
	initPostprocessing();

	
	//setup the tweakable variables, and GUI
	var effectController = {
		focus:			0.35,	//S1
		focalLength:	0.02,	//f
		aperture:		0.036,	//A
		sensorHeight:	0.024,	//sensorHeight
		maxblur:		0.1		//maxCoC
	};

	var matChanger = function( )
	{
		//update the shader uniforms
		postprocessing.CoC_uniforms[ "S1" ].value = effectController.focus;
		postprocessing.CoC_uniforms[ "f" ].value = effectController.focalLength;
		postprocessing.CoC_uniforms[ "A" ].value = effectController.aperture;
		postprocessing.CoC_uniforms[ "sensorHeight" ].value = effectController.sensorHeight;
		postprocessing.CoC_uniforms[ "maxCoC" ].value = effectController.maxblur;
		
		//set FOV based on focalLength
		camera.setLens(effectController.focalLength, effectController.sensorHeight);
		
		//request immediate render
		requestAnimationFrame( render, renderer.domElement );
	};

	var gui = new DAT.GUI({ autoPlace: false });
	container.appendChild(gui.domElement);
	gui.domElement.style.cssFloat = 'none';
	
	gui.add( effectController, "focus", 0.055, 5.0, 0.0002 ).onChange( matChanger );
	gui.add( effectController, "focalLength", 0.018, 0.055, 0.001 ).onChange( matChanger );
	gui.add( effectController, "aperture", 0.001, 0.05, 0.001 ).onChange( matChanger );
	gui.add( effectController, "maxblur", 0.0, 2.0, 0.01 ).onChange( matChanger );
	gui.close();
	
	//initial update
	matChanger();
}

function initPostprocessing() {

	postprocessing.scene = new THREE.Scene();

	postprocessing.camera = new THREE.OrthographicCamera( -width/2, width/2,  height/2, -height/2, -1000, 1000 );
	postprocessing.camera.position.z = 100;

	postprocessing.scene.add( postprocessing.camera );
	
	//cache the sampling offsets for each pass
	postprocessing.hexOffsets = [];
	postprocessing.hexOffsets[0] = makeOffsets(0.0, numSamples);
	postprocessing.hexOffsets[1] = makeOffsets(Math.PI/3.0, numSamples);
	postprocessing.hexOffsets[2] = makeOffsets(-Math.PI/3.0, numSamples);
	
	//depth target
	postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, type: THREE.FloatType, depthBuffer: true, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping } );	//TODO: THREE.AlphaFormat does not work in Chrome (22.0.1229.94m and possibly earlier) anymore. Why? Using RGBFormat as a workaround.
	
	//2 color targets for our seperable bokeh filtering
	postprocessing.rtTextureColor1 = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.FloatType, depthBuffer: true, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping } );

	postprocessing.rtTextureColor2 = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.FloatType, depthBuffer: true, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping } );

	
	//===========================================================================
	// depth material (linear)
	//===========================================================================
	postprocessing.Depth_uniforms = {
		farPlane: { type: "f", value: farPlane }
	};
	
	postprocessing.matDepth = new THREE.ShaderMaterial( {
		uniforms: postprocessing.Depth_uniforms,
		vertexShader: Depth_vertexShader,
		fragmentShader: Depth_fragmentShader,
		blending: THREE.NoBlending
	} );
	

	//===========================================================================
	// CoC material
	//===========================================================================
	postprocessing.CoC_uniforms = {
		DepthSamp: { type: "t", value: postprocessing.rtTextureDepth },
		farPlane: { type: "f", value: farPlane },
		
		S1: { type: "f", value: 0.15 },
		f: { type: "f", value: 0.018 },
		A: { type: "f", value: 0.01 },
		sensorHeight: { type: "f", value: 0.024 },
		maxCoC: { type: "f", value: 0.25 }
	};

	postprocessing.matCoC = new THREE.ShaderMaterial( {
		uniforms: postprocessing.CoC_uniforms,
		vertexShader: Generic_vertexShader,
		fragmentShader: CoC_fragmentShader,
		blending: THREE.NoBlending
	} );
	
	
	//===========================================================================
	// Bokeh filter material
	//===========================================================================
	postprocessing.bokeh_uniforms = {
		DepthSamp: { type: "t", value: postprocessing.rtTextureDepth },
		ColorSamp: { type: "t", value: null },
		sampleOffsets: { type: "v2v", value: null }
	};
	
	postprocessing.matBokeh = new THREE.ShaderMaterial( {
		uniforms: postprocessing.bokeh_uniforms,
		vertexShader: Generic_vertexShader,
		fragmentShader: Bokeh_fragmentShader,
		blending: THREE.NoBlending
	} );
	
	
	//===========================================================================
	// Bokeh filter + min material (final pass)
	//===========================================================================
	postprocessing.bokehMin_uniforms = {
		ColorSamp: { type: "t", value: null },
		ColorSampB: { type: "t", value: null },
		DepthSamp: { type: "t", value: postprocessing.rtTextureDepth },
		sampleOffsets: { type: "v2v", value: null }
	};
	
	postprocessing.matBokehMin = new THREE.ShaderMaterial( {
		uniforms: postprocessing.bokehMin_uniforms,
		vertexShader: Generic_vertexShader,
		fragmentShader: BokehMin_fragmentShader,
		blending: THREE.NoBlending
	} );
	
	
	//create a generic post-processing full-screen quad
	postprocessing.quad = new THREE.Mesh( new THREE.PlaneGeometry( width, height ), postprocessing.matBokeh );
	postprocessing.quad.position.z = - 500;
	postprocessing.scene.add( postprocessing.quad );
}

//---------------------------------------------------------------------------
// makeOffsets
//---------------------------------------------------------------------------
// Creates linear sample offsets given an angle in radians and a desired number
// of samples. This should be done in the application once & stored. The values
// should then be passed to the shader via constant/uniform registers.
//---------------------------------------------------------------------------
function makeOffsets(angle, sampleCount)
{
	var offsets = [];
	
	var aspectRatio = width / height;
	
	var radius = 0.5;
	
	//convert from polar to cartesian
	var pt = new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
	
	//account for aspect ratio (to avoid stretching highlights)
	pt.x /= aspectRatio;
	
	//create the interpolations
	for(var i = 0; i < sampleCount; i++)
	{
		var t = i / (sampleCount - 1.0); //0 to 1
		offsets[i] = pt.clone().lerp(pt.clone().negate(), t);
	}
	
	return offsets;
}

function render()
{
	//controls.update( clock.getDelta() );	
	
	//update the dynamic cubemap
	scene.overrideMaterial = null;
	
	if ( postprocessing.enabled )
	{
		//clear the targets
		renderer.clear();
		renderer.clearTarget(postprocessing.rtTextureDepth);
		renderer.clearTarget(postprocessing.rtTextureColor1);
		renderer.clearTarget(postprocessing.rtTextureColor2);
		
		// Render depth map
		scene.overrideMaterial = postprocessing.matDepth;
		renderer.render( scene, camera, postprocessing.rtTextureDepth );
		
		// Render color map
		scene.overrideMaterial = null;
		renderer.render( scene, camera, postprocessing.rtTextureColor1 );
		
		//If you were going to use FXAA (or similar), you'd want to do it here, before the bokeh shader,
		//before small pixel aliasing issues become larger, more noticable, circles of confusion

		// Render CoC into color map's alpha channel
		renderer.setColorMask(false, false, false, true);	//write alpha channel only
		postprocessing.scene.overrideMaterial = postprocessing.matCoC;
		postprocessing.CoC_uniforms[ "DepthSamp" ].value = postprocessing.rtTextureDepth;
		renderer.render( postprocessing.scene, postprocessing.camera, postprocessing.rtTextureColor1 );
		renderer.setColorMask(true, true, true, true);	//reset mask
		
		// Render filter pass #1
		postprocessing.scene.overrideMaterial = postprocessing.matBokeh;
		postprocessing.bokeh_uniforms[ "ColorSamp" ].value = postprocessing.rtTextureColor1;
		postprocessing.bokeh_uniforms[ "sampleOffsets" ].value = postprocessing.hexOffsets[0];
		renderer.render( postprocessing.scene, postprocessing.camera, postprocessing.rtTextureColor2 );
		
		// Render filter pass #2
		postprocessing.scene.overrideMaterial = postprocessing.matBokeh;
		postprocessing.bokeh_uniforms[ "ColorSamp" ].value = postprocessing.rtTextureColor2;
		postprocessing.bokeh_uniforms[ "sampleOffsets" ].value = postprocessing.hexOffsets[1];
		renderer.render( postprocessing.scene, postprocessing.camera, postprocessing.rtTextureColor1 );
		
		// Render filter pass #3
		postprocessing.scene.overrideMaterial = postprocessing.matBokehMin;
		postprocessing.bokehMin_uniforms[ "ColorSamp" ].value = postprocessing.rtTextureColor2;
		postprocessing.bokehMin_uniforms[ "ColorSampB" ].value = postprocessing.rtTextureColor1;
		postprocessing.bokehMin_uniforms[ "sampleOffsets" ].value = postprocessing.hexOffsets[2];
		renderer.render( postprocessing.scene, postprocessing.camera );
		
		scene.overrideMaterial = null; //reset this, just to be safe
	}
	else
	{
		//regular rendering, no postprocessing
		renderer.clear();
		renderer.render( scene, camera );
	}
}

//initialize and go!
init();
setInterval(function(){requestAnimationFrame( render, renderer.domElement );}, 1000);	//request 1 fps
