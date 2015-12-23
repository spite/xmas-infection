'use strict'

var container = document.getElementById( 'container' );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .1, 100 );
camera.position.set( -1, 15, -10 );

var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
container.appendChild( renderer.domElement );
renderer.setClearColor( 0xca5c60 );

var controls = new THREE.OrbitControls( camera, renderer.domElement );
var boxGeometry;
var boxMaterial = new THREE.MeshNormalMaterial();
var boxes = [];
var positions = [];
var lights = [];

boxMaterial = new THREE.ShaderMaterial( {

    uniforms: {
    	positions: { type: '3fv', value: positions }
    },
    vertexShader: document.getElementById( 'vertexshader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentshader' ).textContent

} );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

function loadBox( c ) {

	var loader = new THREE.OBJLoader();
	loader.load( 'assets/softbox.obj', function( res ) {
		boxGeometry = new THREE.BufferGeometry().fromGeometry( res.children[ 0 ].geometry );
		c();
	} );

}

function initGeometries() {

	var r = 30;
	var n = 800;
	var g = new THREE.BufferGeometry();

	for( var j = 0; j < n; j++ ) {
		g.merge( boxGeometry );
		//var box = new THREE.Mesh( boxGeometry, boxMaterial );
		//box.position.set( Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ) );
		/*box.rotation.set( Maf.randomInRange( 0, 2 * Math.PI ), Maf.randomInRange( 0, 2 * Math.PI ), Maf.randomInRange( 0, 2 * Math.PI ) );
		scene.add( box );
		boxes.push( box );
		lights.push( Math.random() )*/
		//positions.push( position.clone() );
	}

	var boxes = new THREE.Mesh( g, boxMaterial );
	scene.add( boxes );

}

window.addEventListener( 'load', function() {

	loadBox( function() {

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

function render() {

	var t = performance.now();
	requestAnimationFrame( render );
	controls.update();

	boxes.forEach( function( box ) { 
		box.rotation.z += .01;
	} );

	renderer.render( scene, camera );

}
