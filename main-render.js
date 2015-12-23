'use strict'

WAGNER.vertexShadersPath = 'Wagner/vertex-shaders';
WAGNER.fragmentShadersPath = 'Wagner/fragment-shaders';
WAGNER.assetsPath = 'Wagner/assets/';

var container = document.getElementById( 'container' );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, .1, 100 );
camera.position.set( -1, 15, -10 );

var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
container.appendChild( renderer.domElement );
renderer.setClearColor( 0xca5c60 );

var composer = new WAGNER.Composer( renderer, { useRGBA: true } );
var mixPass = new WAGNER.GenericPass( 'mix-shadow-fs.glsl', function() {} );
mixPass.params.amount = 0;
mixPass.params.tInput2 = null;
mixPass.run = function( c ) {
    this.shader.uniforms.amount.value = this.params.amount;
    this.shader.uniforms.tInput2.value = this.params.tInput2;
    c.pass( this.shader );
}
var shadowTexture;
var depthTexture;
var DOFPass = new WAGNER.DOFPass();
var fxaaPass = new WAGNER.FXAAPass();
var noisePass = new WAGNER.NoisePass();
var bloomPass = new WAGNER.MultiPassBloomPass();
bloomPass.params.blurAmount = 1;

DOFPass.params.aperture = .01
DOFPass.params.focalDistance = .9

var controls = new THREE.OrbitControls( camera, renderer.domElement );
var boxGeometry;
var boxMaterial = new THREE.MeshNormalMaterial();
var boxes = [];

var depthMaterial = new THREE.MeshBasicMaterial();

var sL = new ShaderLoader()
sL.add( 'depth-vs', 'Wagner/vertex-shaders/packed-depth-vs.glsl' );
sL.add( 'depth-fs', 'Wagner/fragment-shaders/packed-depth-fs.glsl' );
sL.load();
sL.onLoaded( function() {
	depthMaterial = new THREE.ShaderMaterial( {
		uniforms: {
			mNear: { type: 'f', value: camera.near },
			mFar: { type: 'f', value: camera.far }
		},
		vertexShader: this.get( 'depth-vs' ),
		fragmentShader: this.get( 'depth-fs' ),
		shading: THREE.SmoothShading
	} );
} );

boxMaterial = new THREE.ShaderMaterial( {

    uniforms: {
        matCapMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/matcap.png' ) },
        textureMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/diffuse.jpg' ) },
        normalMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/normal2.jpg' ) },
        specularMap: { type: 't', value: THREE.ImageUtils.loadTexture( 'assets/specular.jpg' ) },
        opacity: { type: 'f', value: 1 }
    },
    vertexShader: document.getElementById( 'vertexshader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentshader' ).textContent

} );

boxMaterial.uniforms.matCapMap.value.wrapS   = boxMaterial.uniforms.matCapMap.value.wrapT = THREE.ClampToEdgeWrapping;
boxMaterial.uniforms.textureMap.value.wrapS  = boxMaterial.uniforms.textureMap.value.wrapT = THREE.RepeatWrapping;
boxMaterial.uniforms.normalMap.value.wrapS   = boxMaterial.uniforms.normalMap.value.wrapT = THREE.RepeatWrapping;
boxMaterial.uniforms.specularMap.value.wrapS = boxMaterial.uniforms.specularMap.value.wrapT = THREE.RepeatWrapping;

var light = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI / 2, 1 );
light.position.set( 0, 30, 20 );
light.target.position.set( 0, 0, 0 );
light.castShadow = true;
light.shadowCameraNear = 20;
light.shadowCameraFar = 50;
light.shadowMapWidth = light.shadowMapHeight = 2048;

scene.add( light );

//scene.add( new THREE.CameraHelper( light.shadow.camera ) );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

var shadowMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 0 });

function loadBox( c ) {

	var loader = new THREE.OBJLoader();
	loader.load( 'assets/softbox.obj', function( res ) {
		boxGeometry = res.children[ 0 ].geometry;
		c();
	} );

}

function initGeometries() {

	var r = 10;

	for( var j = 0; j < 100; j++ ) {
		var box = new THREE.Mesh( boxGeometry, boxMaterial );
		box.position.set( Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ), Maf.randomInRange( -r, r ) );
		box.rotation.set( Maf.randomInRange( 0, 2 * Math.PI ), Maf.randomInRange( 0, 2 * Math.PI ), Maf.randomInRange( 0, 2 * Math.PI ) );
		box.castShadow = true;
		box.receiveShadow = true;
		scene.add( box );
		boxes.push( box );
	}

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
	composer.setSize( w, h );

	shadowTexture = WAGNER.Pass.prototype.getOfflineTexture( composer.width, composer.height, false );
	depthTexture = WAGNER.Pass.prototype.getOfflineTexture( composer.width, composer.height, false );

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

	composer.reset();

	scene.overrideMaterial = depthMaterial;
	composer.render( scene, camera, false, depthTexture );
	scene.overrideMaterial = null;

	boxes.forEach( function( box ) { 
		box.material = shadowMaterial;
	} );
	composer.render( scene, camera, false, shadowTexture );

	boxes.forEach( function( box ) { 
		box.material = boxMaterial;
	} );
	composer.render( scene, camera );
	
	mixPass.params.tInput2 = shadowTexture;
	composer.pass( mixPass );

	DOFPass.params.tBias = depthTexture;
	composer.pass( DOFPass );

	//composer.pass( bloomPass );

	//composer.setSource( shadowTexture );
	composer.pass( fxaaPass );

	noisePass.params.time = .01 * t;
	noisePass.params.speed = 2;
	//composer.pass( noisePass );

	composer.toScreen();

}
