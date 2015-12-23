'use strict'

WAGNER.vertexShadersPath = 'Wagner/vertex-shaders';
WAGNER.fragmentShadersPath = 'Wagner/fragment-shaders';
WAGNER.assetsPath = 'Wagner/assets/';

var timeLabel = document.getElementById( 'time' );
var cameraLabel = document.getElementById( 'camera' );
var container = document.getElementById( 'container' );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .01, 100 );
camera.target = new THREE.Vector3();
camera.position.set( 0 ,0, -10 );//-1, 15, -10 );

var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
container.appendChild( renderer.domElement );
renderer.setClearColor( 0 );

var composer = new WAGNER.Composer( renderer, { useRGBA: true } );
var edgesComposer = new WAGNER.Composer( renderer, { useRGBA: true } );
var edgesPass = new WAGNER.SobelEdgeDetectionPass();
var bloomPass = new WAGNER.MultiPassBloomPass();
bloomPass.params.blurAmount = 1;
var DOFPass = new WAGNER.DOFPass();
DOFPass.params.aperture = .01
DOFPass.params.focalDistance = .9
var blendPass = new WAGNER.BlendPass();
blendPass.params.mode = 9
var grayscalePass = new WAGNER.GrayscalePass();

var fxaaPass = new WAGNER.FXAAPass();

var normalBuffer;
var audio;

var controls = new THREE.OrbitControls( camera, renderer.domElement );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

var shadowMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 0 });

var boxMaterial = new THREE.RawShaderMaterial( {
	uniforms: {
		matCapMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/matcap.png' ) },
		posTexture: { type: 't', value: null },
		rotTexture: { type: 't', value: null },
		orbitTexture: { type: 't', value: null },
		offsetTexture: { type: 't', value: null },
		colorTexture: { type: 't', value: null },
		posDimensions: { type: 'v2', value: new THREE.Vector2( 0, 0 ) },
		time: { type: 'f', value: 0 },
		factor: { type: 'f', value: 0 },
		total: { type: 'f', value: 0 },
		drawMode: { type: 'f', value: 0 }, // 0 - color, 1 - normals, 2 - depth
		mNear: { type: 'f', value: camera.near },
		mFar: { type: 'f', value: camera.far }
	},
	vertexShader: document.getElementById( 'object-vs' ).textContent,
	fragmentShader: document.getElementById( 'object-fs' ).textContent
} );

var boxGeometries;
var TAU = 2 * Math.PI;
var boxes = [];

var data = [];

function loadBoxes() {

	return new Promise( function( resolve, reject ) { 

		var boxes = [ 'cube01', 'cube02', 'cube03', 'cube04', 'cube05' ];
		var promises = [];
		var geometries = {};

		boxes.forEach( function( b ) { 

			var p = new Promise( function( resolve, reject ) {

				var loader = new THREE.OBJLoader();
				loader.load( 'assets/' + b + '.obj', function( res ) {
					var geometry = res.children[ 0 ].geometry;
					//geometry = new THREE.BoxGeometry( 1, 1, 1 );
					geometry.computeBoundingBox();
					var src = new THREE.BufferGeometry();
					src.fromGeometry( geometry );
					geometries[ b ] = {
						geometry: geometry,
						bufferGeometry: src
					}
					resolve();
				} );

			} );

			promises.push( p );

		} );

		Promise.all( promises ).then( function() {
			resolve( geometries )
		} );

	} );

}

function loadCenter() {

	return new Promise( function( resolve, reject ) { 

		var boxes = [ 'frame', 'dots', 'icosahedron', 'cristal' ];
		var promises = [];
		var geometries = {};

		boxes.forEach( function( b ) { 

			var p = new Promise( function( resolve, reject ) {

				var loader = new THREE.OBJLoader();
				loader.load( 'assets/' + b + '.obj', function( res ) {
					var geometry = res.children[ 0 ].geometry;
					geometry.computeBoundingBox();
					var src = new THREE.BufferGeometry();
					src.fromGeometry( geometry );
					var mesh = new THREE.Mesh( src, new THREE.MeshNormalMaterial() );
					mesh.rotation.x = Math.PI / 4;
					scene.add( mesh );
					resolve();
				} );

			} );

			promises.push( p );

		} );

		Promise.all( promises ).then( function() {
			resolve( geometries )
		} );

	} );

}

function initGeometries() {

	var v = new THREE.Vector3()

	var r = 1.3;
	var step = 2 * Math.PI / 6;
	var p = 0;
	for( var a = 0; a < 2 * Math.PI - step; a += step ) {
		v.set( r * Math.cos( a ), 0, r * Math.sin( a ) );
		var base = new THREE.Group();
		base.position.copy( v );
		var dir = v.clone().normalize();
		dir.add( v );
		base.lookAt( dir );
		generateArm( base, p === 0 || p === 3 );
		p++;
	}

	var p = 0;
	for( var a = 0; a < 2 * Math.PI - step; a += step ) {
		if( p !== 0 && p !== 3 ) {
			v.set( r * Math.cos( a ), r * Math.sin( a ), 0 );
			var base = new THREE.Group();
			base.position.copy( v );
			var dir = v.clone().normalize();
			dir.add( v );
			base.lookAt( dir );
			base.rotation.z += Math.PI / 2;
			generateArm( base, false );
		}
		p++;
	}

	var g = new THREE.BufferGeometry();
	var positionsLength = 0;
	var normalsLength = 0;
	var idsLength = 0;

	data.sort( function( a ,b ) { 
		return a.tier - b.tier 
	} );

	data.forEach( function( b ) {

		var bg = b.geometry.bufferGeometry;

		positionsLength += bg.attributes.position.array.length;
		normalsLength += bg.attributes.normal.array.length;

	} );

	idsLength = positionsLength / 3;
	var positions = new Float32Array( positionsLength );
	var normals = new Float32Array( normalsLength );

	var ids = new Float32Array( idsLength );

	var positionsPtr = 0;
	var normalsPtr = 0;

	var cubePositions = [];
	var cubeRotations = [];
	var ptr = 0;

	data.forEach( function( b ) {

		var bg = b.geometry.bufferGeometry.clone();

		var m = new THREE.Matrix4();
		m.makeTranslation( b.position.x, b.position.y, b.position.z );
		var r = new THREE.Matrix4();
		var a = new THREE.Euler( b.rotation.x, b.rotation.y, b.rotation.z, 'XYZ' );
		r.makeRotationFromEuler( a );
		m.multiply( r );
		//bg.applyMatrix( m )
		
		positions.set( bg.attributes.position.array, positionsPtr );
		normals.set( bg.attributes.normal.array, positionsPtr );

		var l = bg.attributes.position.array.length;
		for( var j = positionsPtr / 3; j < ( positionsPtr + l ) / 3; j++ ) {
			ids[ j ] = ptr;
		}

		cubePositions.push( b.position.clone() );
		cubeRotations.push( b.rotation.clone() );

		positionsPtr += bg.attributes.position.array.length;
		normalsPtr += bg.attributes.normal.array.length;
		ptr++;

	} );

	g.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	g.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

	g.addAttribute( 'id', new THREE.BufferAttribute( ids, 1 ) );
	g.attributes.id.needsUpdate = true;

	var w = Maf.nextPowerOfTwo( Math.sqrt( data.length ) );
	var h = Maf.nextPowerOfTwo( data.length / w );

	var posData = new Float32Array( w * h * 4 );

	var p = 0;
	cubePositions.forEach( function( v ) { 

		posData[ p     ] = v.x
		posData[ p + 1 ] = v.y
		posData[ p + 2 ] = v.z
		posData[ p + 3 ] = 0
		p += 4;

	} );

	var posTexture = new THREE.DataTexture( posData, w, h, THREE.RGBAFormat, THREE.FloatType );
	posTexture.minFilter = THREE.NearestFilter;
	posTexture.magFilter = THREE.NearestFilter;
	posTexture.needsUpdate = true;

	boxMaterial.uniforms.posTexture.value = posTexture;
	boxMaterial.uniforms.posDimensions.value.set( w, h );
	boxMaterial.uniforms.total.value = data.length;

	var rotData = new Float32Array( w * h * 4 );

	var p = 0;
	cubeRotations.forEach( function( v ) { 

		rotData[ p     ] = v.x
		rotData[ p + 1 ] = v.y
		rotData[ p + 2 ] = v.z
		rotData[ p + 3 ] = 0
		p += 4;

	} );

	var rotTexture = new THREE.DataTexture( rotData, w, h, THREE.RGBAFormat, THREE.FloatType );
	rotTexture.minFilter = THREE.NearestFilter;
	rotTexture.magFilter = THREE.NearestFilter;
	rotTexture.needsUpdate = true;

	boxMaterial.uniforms.rotTexture.value = rotTexture;

	var orbitData = new Float32Array( w * h * 4 );

	var orbitPositions = [];

	var r = 30;
	var a = 0;
	cubePositions.forEach( function( v ) { 
		var v = new THREE.Vector3() 
		v.x = r * Math.cos( a );
		v.y = .5 - Math.random()
		v.z = r * Math.sin( a );
		orbitPositions.push( v );
		a += .05 + Math.random() * .05;
		r += .01;
	} );

	orbitPositions.sort( function() { return Math.random() > .5 } );

	var p = 0;
	cubePositions.forEach( function( v, i ) { 

		var v = orbitPositions[ i ]
		orbitData[ p     ] = v.x
		orbitData[ p + 1 ] = v.y
		orbitData[ p + 2 ] = v.z
		orbitData[ p + 3 ] = 0
		p += 4;

	} );

	var orbitTexture = new THREE.DataTexture( orbitData, w, h, THREE.RGBAFormat, THREE.FloatType );
	orbitTexture.minFilter = THREE.NearestFilter;
	orbitTexture.magFilter = THREE.NearestFilter;
	orbitTexture.needsUpdate = true;

	boxMaterial.uniforms.orbitTexture.value = orbitTexture;

	var offsetData = new Float32Array( w * h * 4 );

	var p = 0;
	cubePositions.forEach( function( v, i ) { 

		var v = new THREE.Vector3( .5 - Math.random() , .5 - Math.random(), .5 - Math.random() );
		v.normalize();
		offsetData[ p     ] = v.x
		offsetData[ p + 1 ] = v.y
		offsetData[ p + 2 ] = v.z
		offsetData[ p + 3 ] = 0
		p += 4;

	} );

	var offsetTexture = new THREE.DataTexture( offsetData, w, h, THREE.RGBAFormat, THREE.FloatType );
	offsetTexture.minFilter = THREE.NearestFilter;
	offsetTexture.magFilter = THREE.NearestFilter;
	offsetTexture.needsUpdate = true;

	boxMaterial.uniforms.offsetTexture.value = offsetTexture;

	var colorData = new Float32Array( w * h * 4 );

	var p = 0;
	cubePositions.forEach( function( v, i ) { 

		var v = new THREE.Vector3( Math.random(), Math.random(), Math.random() );
		colorData[ p     ] = v.x
		colorData[ p + 1 ] = v.y
		colorData[ p + 2 ] = v.z
		colorData[ p + 3 ] = 0
		p += 4;

	} );

	var colorTexture = new THREE.DataTexture( colorData, w, h, THREE.RGBAFormat, THREE.FloatType );
	colorTexture.minFilter = THREE.NearestFilter;
	colorTexture.magFilter = THREE.NearestFilter;
	colorTexture.needsUpdate = true;

	boxMaterial.uniforms.colorTexture.value = colorTexture;

	var m = new THREE.Mesh( g, boxMaterial );
	m.frustumCulled = false;
	scene.add( m );

	var plane = new THREE.Mesh( new THREE.PlaneGeometry( 8, 8 ), new THREE.MeshBasicMaterial( { map: posTexture, side: THREE.DoubleSide } ) );
	//scene.add( plane );

	/*var m2 = new THREE.MeshBasicMaterial( { color: 0xfffffff, wireframe: true, depthTest: false, opacity: .1, transparent: true, blending: THREE.AdditiveBlending })
	data.forEach( function( b ) {
		var m = new THREE.Mesh( b.geometry.geometry, m2 );
		m.position.copy( b.position )
		m.rotation.copy( b.rotation );
		m.castShadow = m.receiveShadow = true;
		scene.add( m );
	} );*/

}

var nodeColors = [ 0x460808, 0x006cdb, 0xcc07a2 ];

function generateArm( base, bothAxis ){

	base.updateMatrixWorld();

	var node     = [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0 ]
	var sequence = [ 4, 3, 2, 1, 2, 4, 3, 4, 4, 4, 4, 4, 3, 4, 3, 4 ]
	var outer    = [ 1, 0, 1, 0, 0, 1, 0, 1 ]
	var size = 1;

	/*sequence     = [ 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 4, 4, 3, 3, 2, 2 ]
	node         = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
	outer        = [];*/

	var rot = new THREE.Matrix4();
	var e = new THREE.Euler( base.rotation.x, base.rotation.y, base.rotation.z )
	rot.makeRotationFromEuler( e );

	var pos = 0;
	var tierPtr = 0;
	sequence.forEach( function( b, i ) {
		
		var boxGeometry = boxGeometries[ 'cube0' + b ].geometry;
		var w = boxGeometry.boundingBox.max.x - boxGeometry.boundingBox.min.x;

		pos += .5 * size * w;
		
		var p = new THREE.Vector3( 0, 0, pos );
		p.applyMatrix4( base.matrixWorld );
		var r = base.rotation.clone();
		if( node[ i ] === 0 ) r.z += Math.random() * 2 * Math.PI
		data.push( {
			geometry: boxGeometries[ 'cube0' + b ],
			position: p,
			rotation: r,
			tier: i,
			color: nodeColors[ 0 ]
		} );

		if( node[ i ] > 0 ) {

			var branchBase = new THREE.Group();
			branchBase.position.copy( p );
			var dir = new THREE.Vector3( 1, 0, 1 );
			dir.applyMatrix4( rot );
			dir.add( p );
			branchBase.lookAt( dir );
			branchBase.rotation.z += Math.PI / 2;
			generateBranch( branchBase, node[ i ], i + 2 );

			var branchBase = new THREE.Group();
			branchBase.position.copy( p );
			var dir = new THREE.Vector3( -1, 0, 1 );
			dir.applyMatrix4( rot );
			dir.add( p );
			branchBase.lookAt( dir );
			branchBase.rotation.z += Math.PI / 2;
			generateBranch( branchBase, node[ i ], i + 2 );

			if( bothAxis ) {

				var branchBase = new THREE.Group();
				branchBase.position.copy( p );
				var dir = new THREE.Vector3( 0, 1, 1 );
				dir.applyMatrix4( rot );
				dir.add( p );
				branchBase.lookAt( dir );
				branchBase.rotation.z += Math.PI / 2;
				generateBranch( branchBase, node[ i ], i + 2 );

				var branchBase = new THREE.Group();
				branchBase.position.copy( p );
				var dir = new THREE.Vector3( 0, -1, 1 );
				dir.applyMatrix4( rot );
				dir.add( p );
				branchBase.lookAt( dir );
				branchBase.rotation.z += Math.PI / 2;
				generateBranch( branchBase, node[ i ], i + 2 );

			}
		}

		pos += .5 * size * w;
		tierPtr++;

	})

	outer.forEach( function( b, i ) {
		var boxGeometry = boxGeometries[ 'cube05' ].geometry;
		var w = boxGeometry.boundingBox.max.x - boxGeometry.boundingBox.min.x;
		pos += .5 * size * w;
		if( b === 1 ) {
			var p = new THREE.Vector3( 0, 0, pos );
			p.applyMatrix4( base.matrixWorld );
			var r = base.rotation.clone();
			r.z += Math.random() * 2 * Math.PI
			data.push( {
				geometry: boxGeometries[ 'cube05' ],
				position: p,
				rotation: r,
				tier: tierPtr + i,
				color: nodeColors[ 0 ]
			} );

		}
		pos += .5 * size * w;
	})
}

function generateBranch( base, n, tier ){

	base.updateMatrixWorld();

	var sequence = [ 2, 4, 3, 4, 4, 4, 4, 4 ];
	if( n === 2 ) sequence = [ 3, 5, 4, 5, 5, 5, 5, 5 ];
	var size = 1;

	var pos = .8;
	if( n === 2 ) pos = .4;
	sequence.forEach( function( b, i ) {
		
		var boxGeometry = boxGeometries[ 'cube0' + b ].geometry;
		var w = boxGeometry.boundingBox.max.x - boxGeometry.boundingBox.min.x;

		pos += .5 * size * w;
		
		var p = new THREE.Vector3( 0, 0, pos );
		p.applyMatrix4( base.matrixWorld );
		var r = base.rotation.clone();
		r.z += Math.random() * 2 * Math.PI
		data.push( {
			geometry: boxGeometries[ 'cube0' + b ],
			position: p,
			rotation: r,
			tier: tier + i
		} );

		pos += .5 * size * w;

	})

}

var startTime;
var storyline;
var mode = 0;

window.addEventListener( 'keydown', function( e ) {

	switch( e.keyCode ) {
		case 69: mode = 1 - mode; break;
	}

} );

window.addEventListener( 'load', function() {

	var geo = new Promise( function( resolve, reject ) { 

		loadBoxes().then( function( g ) {

			boxGeometries = g;

			loadCenter().then( function() {

				initGeometries();
				onWindowResize();
				resolve();
		
			} );

		});

	})

	var story = new Promise( function( resolve, reject ) {

		var oReq = new XMLHttpRequest();
		oReq.onload = function() {
			storyline = STORYLINE.parseStoryline( JSON.parse( this.responseText ) );
			resolve();
		};
		oReq.open( 'get', 'assets/storyboard.json', true);
		oReq.send();

	})

	var a = new Promise( function( resolve, reject ) {
		audio = document.createElement( 'audio' );

		audio.controls = true;
		audio.style.position = 'absolute';
		audio.style.width = '100%';
		audio.style.left = '0';
		audio.style.bottom = '25px';
		document.body.appendChild( audio );

		audio.addEventListener( 'canplay', function() {
			audio.pause();
			resolve();
		} );

		audio.src = 'assets/acidbeat - xmas infection.mp3';
	} );

	Promise.all( [ geo, a, story ] ).then( function() {
		startTime = performance.now();
		audio.play();
		render();
	})
	
} );

function onWindowResize() {

	var w = container.clientWidth;
	var h = container.clientHeight;

	camera.aspect = w / h;
	camera.updateProjectionMatrix();

	renderer.setSize( w, h );
	composer.setSize( w, h );
	edgesComposer.setSize( w,h );

	normalBuffer = WAGNER.Pass.prototype.getOfflineTexture( edgesComposer.width, edgesComposer.height, false );

}

window.addEventListener( 'resize', onWindowResize );

var tmpVector = new THREE.Vector3();
var ZEROV3 = new THREE.Vector3( 0, 0, 0 );
var TAUV3 = new THREE.Vector3( TAU, TAU, TAU );

function render() {

	var t = audio.currentTime;
	var l = 93;
	requestAnimationFrame( render );

	var et = 0;
	if( t > 23 ) et = ( ( t - 23 ) / l );

	time.textContent = t;

	boxMaterial.uniforms.time.value = t;
	boxMaterial.uniforms.factor.value = et;

	if( mode === 1 ) {
		camera.position.set( storyline.get( 'cx', t ), storyline.get( 'cy', t ), storyline.get( 'cz', t ) );
		camera.target.set( storyline.get( 'tx', t ), storyline.get( 'ty', t ), storyline.get( 'tz', t ) );
		camera.lookAt( camera.target );
	} else {
		controls.update();		
	}

	cameraLabel.innerHTML = 'C x:' + camera.position.x + ' y:' + camera.position.y + ' z:' + camera.position.z + '<br/>T x:' + controls.target.x + ' y:' + controls.target.y + ' z:' + controls.target.z;

	renderer.render( scene, camera );

	//scene.rotation.y = -.5 * t;

	/*composer.reset();
	boxMaterial.uniforms.drawMode.value = 1;
	composer.render( scene, camera, null, normalBuffer );
	
	edgesComposer.reset();
	edgesComposer.setSource( normalBuffer );
	edgesComposer.pass( edgesPass );
	edgesComposer.pass( grayscalePass );

	boxMaterial.uniforms.drawMode.value = 0;
	composer.render( scene, camera );
	blendPass.params.tInput2 = edgesComposer.output;
	composer.pass( blendPass );
	composer.pass( fxaaPass );
	composer.pass( bloomPass );

	composer.toScreen();*/

}
