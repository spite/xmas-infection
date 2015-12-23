'use strict'

var container = document.getElementById( 'container' );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .1, 1000 );
camera.position.set( -1, 15, -10 );

var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
container.appendChild( renderer.domElement );
renderer.setClearColor( 0xca5c60 );

var controls = new THREE.OrbitControls( camera, renderer.domElement );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

scene.fog = new THREE.FogExp2( 0xca5c60, .002 );

var shadowMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 0 });
var boxMaterial = new THREE.MeshPhongMaterial( { color: 0xeab3b5, specular: 0xffffff, shininess: 20 });
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

scene.add( new THREE.CameraHelper( light.shadow.camera ) );
var centerGeometry;

function loadBox( c ) {

	var loader = new THREE.OBJLoader();
	loader.load( 'assets/softbox.obj', function( res ) {
		boxGeometry = res.children[ 0 ].geometry;
		c();
	} );

}

function loadCenter( c ) {

	var loader = new THREE.OBJLoader();
	loader.load( 'assets/icosahedron.obj', function( res ) {
		centerGeometry = res.children[ 0 ].geometry;
		c();
	} );

}

function initGeometries() {

	var g = new THREE.IcosahedronGeometry( 10, 1 );
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
	} );
	
}

function generateArm( base, n ){

	var r = -20;
	var y = 0;
	var s2 = 0;

	for( var j = 0; j < 52; j++ ) {
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

	loadBox( function() {

		loadCenter( function() {

			initGeometries();
			onWindowResize();
			render();
	
		});

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
