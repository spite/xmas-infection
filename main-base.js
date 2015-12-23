'use strict'

var container = document.getElementById( 'container' );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .1, 1000 );
camera.position.set( -1, 15, -10 );

var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( 1 );//window.devicePixelRatio );
container.appendChild( renderer.domElement );
renderer.setClearColor( 0xca5c60 );

var controls = new THREE.OrbitControls( camera, renderer.domElement );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

scene.fog = new THREE.FogExp2( 0xca5c60, .002 );

var shadowMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 0 });
var boxMaterial = new THREE.MeshPhongMaterial( { color: 0xeab3b5, specular: 0xffffff, shininess: 20 });
boxMaterial = new THREE.ShaderMaterial( {
	uniforms:{
		envMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/panorama.jpg' ) },
		blurEnvMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/blur.jpg' ) }
	},
	vertexShader: document.getElementById( 'material-vs' ).textContent,
	fragmentShader: document.getElementById( 'material-fs' ).textContent
} );
boxMaterial.uniforms.blurEnvMap.value.wrapS = boxMaterial.uniforms.blurEnvMap.value.wrapT = THREE.RepeatWrapping;
var boxGeometry;
var TAU = 2 * Math.PI;
var boxes = [];

var ambient = new THREE.AmbientLight( 0x9c474a );
scene.add( ambient );

var light = new THREE.SpotLight( 0xffffff, 1, 200, Math.PI / 2, 0 );
light.position.set( 0, 120, 80 );
light.target.position.set( 0, 0, 0 );
light.castShadow = true;
light.shadowCameraFov = 40;
light.shadowCameraNear = 80;
light.shadowCameraFar = 200;
light.shadowMapWidth = light.shadowMapHeight = 2048;

scene.add( light );

//scene.add( new THREE.CameraHelper( light.shadow.camera ) );

var centerGeometry;

var light2 = new THREE.SpotLight( 0xffffff, 1, 200, Math.PI / 2, 0 );
light2.position.set( 20, 120, 90 );
light2.target.position.set( 0, 0, 0 );
light2.castShadow = true;
light2.shadowCameraFov = 40;
light2.shadowCameraNear = 80;
light2.shadowCameraFar = 200;
light2.shadowMapWidth = light.shadowMapHeight = 2048;

scene.add( light2 );

//scene.add( new THREE.CameraHelper( light2.shadow.camera ) );

var centerGeometry;

var crystalGeometry, dotsGeometry, frameGeometry, innerLightGeometry;
var crystalMesh, dotsMesh, frameMesh, innerLightMesh;

function loadModel( file ) {

	return new Promise( function( resolve, reject ) {
		var loader = new THREE.OBJLoader();
		loader.load( file, function( res ) {
			resolve( res );
		} );
	} );

}

function initGeometries() {

	crystalMesh = new THREE.Mesh( crystalGeometry, boxMaterial );
	/*crystalMesh.material.opacity = .5;
	crystalMesh.material.transparent = true;
	crystalMesh.material.side = THREE.FrontSide;
	crystalMesh.material.shininess = 100;
	crystalMesh.material.color.setHex( 0x52f1ff );*/

	var innerCrystalMesh = new THREE.Mesh( crystalGeometry, boxMaterial );
	/*innerCrystalMesh.material.opacity = .5;
	innerCrystalMesh.material.transparent = true;
	innerCrystalMesh.material.side = THREE.BackSide;
	innerCrystalMesh.material.shininess = 100;*/

	dotsMesh = new THREE.Mesh( dotsGeometry, boxMaterial );
	//dotsMesh.material.color.setHex( 0x881b15 );

	frameMesh = new THREE.Mesh( frameGeometry, boxMaterial );
	//frameMesh.material.color.setHex( 0xc6ba9c );

	innerLightMesh = new THREE.Mesh( innerLightGeometry, boxMaterial );

	var meshes = [ crystalMesh, innerCrystalMesh, frameMesh, dotsMesh, innerLightMesh ];
	//meshes.forEach( function( m ) { m.castShadow = true; m.receiveShadow = true } );
	meshes.forEach( function( m ) { m.scale.set( 10, 10, 10 ); scene.add( m ) } );

	//innerCrystalMesh.scale.set( 9.8, 9.8, 9.8 );

	/*var g = new THREE.IcosahedronGeometry( 10, 1 );
	var n = 0;

	var center = new THREE.Mesh( centerGeometry, boxMaterial );
	center.scale.set( 100, 100, 100 );
	scene.add( center );

	g.vertices.forEach( function( v ) {
		var base = new THREE.Group();
		base.position.copy( v );
		var dir = v.clone().normalize();
		dir.add( v );
		base.lookAt( dir );
		scene.add( base );
		generateArm( base, n );
		n++;
	} );*/
	
}

function generateArm( base, n ){

	var r = -20;
	var y = 0;
	var s2 = 0;

	for( var j = 0; j < 10; j++ ) {
		var m = new THREE.Mesh( boxGeometry, boxMaterial );
		m.position.set( Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ) );
		m.rotation.set( Maf.randomInRange( 0, TAU ), Maf.randomInRange( 0, TAU ), Maf.randomInRange( 0, TAU ) );
		var s = Maf.randomInRange( .1, 1.5 );
		y += s2;
		s2 = Maf.randomInRange( s, 1.5 );
		y += s2;
		m.scale.set( s, s, s2 );
		base.add( m );
		var p = new THREE.Vector3();
		p.z = y;
		m.position.z += y;
		m.castShadow = true;
		m.receiveShadow = true;
		boxes.push( {
			num: j,
			arm: n,
			mesh: m,
			originalPosition: m.position.clone(),
			destinationPosition: p,
			originalRotation: m.rotation.clone(),
			destinationRotation: new THREE.Vector3( 0, 0, Maf.randomInRange( 0 , TAU ) ),
			mass: s * s * s2
		} );

	}

}

window.addEventListener( 'load', function() {

	var models = [ 'assets/cristal.obj', 'assets/dots.obj', 'assets/frame.obj', 'assets/inner_light.obj' ];

	var p1 = loadModel( 'assets/cristal.obj' ).then( function( res ) { crystalGeometry = res.children[ 0 ].geometry } );
	var p2 = loadModel( 'assets/dots.obj' ).then( function( res ) { dotsGeometry = res.children[ 0 ].geometry } );
	var p3 = loadModel( 'assets/frame.obj' ).then( function( res ) { frameGeometry = res.children[ 0 ].geometry } );
	var p4 = loadModel( 'assets/inner_light.obj' ).then( function( res ) { innerLightGeometry = res.children[ 0 ].geometry } );

	Promise.all( [ p1, p2, p3, p4 ] ).then( function() {
		initGeometries();
		onWindowResize();
		render();
	});
	
} );

function onWindowResize() {

	var w = container.clientWidth;
	var h = container.clientHeight;

	camera.aspect = w / h;
	camera.updateProjectionMatrix();

	renderer.setSize( w, h );

}

window.addEventListener( 'resize', onWindowResize );

var tmpVector = new THREE.Vector3();
var ZEROV3 = new THREE.Vector3( 0, 0, 0 );
var TAUV3 = new THREE.Vector3( TAU, TAU, TAU );

function render() {

	var t = performance.now();
	requestAnimationFrame( render );
	controls.update();

	boxes.forEach( function( b ) {
		var alpha = .5 + .5 * Math.sin( .001 * t + .001 * ( b.arm * 500 + b.num ) );
		alpha = Maf.parabola( Maf.clamp( alpha, 0, .5 ), 2 );
		tmpVector.copy( b.originalPosition );
		tmpVector.lerp( b.destinationPosition, alpha );
		b.mesh.position.copy( tmpVector );
		tmpVector.copy( b.originalRotation );
		tmpVector.lerp( b.destinationRotation, alpha );
		tmpVector.z += .0005 * t / b.mass ;
		tmpVector.x = Maf.mod( tmpVector.x, TAU );
		tmpVector.y = Maf.mod( tmpVector.y, TAU );
		tmpVector.z = Maf.mod( tmpVector.z, TAU );
		b.mesh.rotation.set( tmpVector.x, tmpVector.y, tmpVector.z );
	} );

	renderer.render( scene, camera );

}
