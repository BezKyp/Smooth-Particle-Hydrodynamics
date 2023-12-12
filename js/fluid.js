import * as THREE from './three.module.js'
import Engine from './engine.js';

window.addEventListener('load', init, false);

let engine = Engine;
let scene, camera, renderer;
let material, material1, bigMaterial, circle, circle1, meshes;
let bigCircle;
let left, right, bottom, top, zoomX, zoomY;
let initialOrientation;
let windowMovementInterval = -1;
let paused = false;
let fluidParams = {
  NumParticles: 1500,
  ParticleMass: 1.0,
  GasConstant: 100.0,
  RestDensity: 1.5,
  Viscosity: 4,
  GravityX: 0,
  GravityY: -20,
  Color: '#1d1b82',
  SetDefaults: function() { /* dummy */ }
}


function init() {
  createScene();
  attachToDocument();
  setNumParticles(fluidParams['NumParticles']);
  doLoop();
}

function defaultOrientation() {
  this.angle = 0;
}

function reinit() {
  initialOrientation = (screen.orientation || defaultOrientation).angle;
  computeWindowArea();
  engine.init(screen.width, screen.height, left, right, bottom, top);
  setNumParticles(fluidParams['NumParticles']);
  doLoop();
}

function createScene() {
  initialOrientation = (screen.orientation || defaultOrientation).angle;
  computeWindowArea();
  engine.init(screen.width, screen.height, left, right, bottom, top);

  let width = right - left;
  let height = top - bottom;
  let nearPlane = 0;
  let farPlane = 1;
  camera = new THREE.OrthographicCamera(left, right, top, bottom, nearPlane, farPlane);
  camera.position.z = 1

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(width * zoomX, height * zoomY);

  material = new THREE.MeshBasicMaterial({ color: 0x1d1b82 });
  material1 = new THREE.MeshBasicMaterial({ color: 0x014159 });
  bigMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  circle = new THREE.CircleBufferGeometry(8, 8);
  circle1 = new THREE.CircleBufferGeometry(12, 12);

  scene = new THREE.Scene();
  renderer.render(scene, camera);
}

function attachToDocument() {
  document.body.appendChild(renderer.domElement);

  window.addEventListener('mouseout', handleMouseOut, false);
  window.addEventListener('visibilitychange', handleVisibilityChange, false);
  renderer.domElement.addEventListener('mousemove', handleMouseMove, false);
  renderer.domElement.addEventListener('touchmove', handleTouchMove, false);
  renderer.domElement.addEventListener('touchend', handleTouchEnd, false);
  renderer.domElement.addEventListener('touchcancel', handleTouchEnd, false);
}

function handleVisibilityChange(e) {
  if (paused && !document.hidden) {
    engine.unpause();
  }
  paused = document.hidden;
}

function handleMouseOut(e) {
  // if the mouse leaves the window, watch for window movement on screen and adjust the simulation domain appropriately
  if (windowMovementInterval == -1 && e.toElement == null && e.relatedTarget == null) { // really outside the window
    windowMovementInterval = setInterval(function() {
      let prevL = left;
      let prevR = right;
      let prevB = bottom;
      let prevT = top;
      computeWindowArea();
    }, 10);
  }
}

function computeWindowArea() {
  // the width and height pad/bars estimate can be calculated less than zero on mobile due to zooming
  let widthPadEstimate = Math.max(window.outerWidth - window.innerWidth, 0);
  left = window.screenX + widthPadEstimate / 2;
  right = window.screenX + window.outerWidth - widthPadEstimate / 2;
  // note positive screen y is measured top-down, positive fluid sim y is measured bottom-up
  // assume address bar, toolbars, favs, menus, are all at the top
  let topBarsHeightEstimate = Math.max(window.outerHeight - window.innerHeight, 0);
  bottom = screen.height - window.screenY - window.outerHeight;
  top = screen.height - window.screenY - topBarsHeightEstimate;

  // on mobile, innerWidth/Height can be larger than outerWidth/Height, requiring some renderer zooming
  zoomX = window.innerWidth > window.outerWidth ? window.innerWidth / window.outerWidth : 1;
  zoomY = window.innerHeight > window.outerHeight ? window.innerHeight / window.outerHeight : 1;
  let isProbablyMobileDevice = window.innerWidth > window.outerWidth || window.innerHeight > window.outerHeight;
  if (isProbablyMobileDevice) {
    // also on mobile, just use the entire screen due to keyboards and url input boxes taking up lots'a'space
    left = 50;
    right = screen.width;
    bottom = 50;
    top = screen.height;
  }
}

function handleMouseMove(e) {
  if (windowMovementInterval != -1) {
    clearInterval(windowMovementInterval);
    windowMovementInterval = -1;
  }

  engine.forceVelocity(e.clientX + left, e.clientY/*+bottom*/, e.movementX, e.movementY);

  bigCircle.position.set(e.clientX + left, top - e.clientY, 0);

}

let lastX = undefined;
let lastY = undefined;

function handleTouchMove(e) {
  if (windowMovementInterval != -1) {
    clearInterval(windowMovementInterval);
    windowMovementInterval = -1;
  }
  if (e.touches.length > 0) {
    let touch = e.changedTouches[0];
    let tx = touch.clientX / zoomX;
    let ty = touch.clientY / zoomY;
    if (lastX != undefined && lastY != undefined) {
      let dx = tx - lastX;
      let dy = ty - lastY;
      engine.forceVelocity(tx + left, ty/*+bottom*/, dx, dy);
    }
    lastX = tx;
    lastY = ty;
  }
  // TODO incorporate window.devicePixelRatio?
}

function handleTouchEnd(e) {
  lastX = undefined;
  lastY = undefined;
}

function setNumParticles(n) {
  let i0 = 0;
  if (meshes == undefined) {
    meshes = new Array(n + 1);
  }
  else {
    if (n < meshes.length) {
      for (var i = n; i < meshes.length; i++) {
        scene.remove(meshes[i]);
      }
      meshes.length = n;
    }
    i0 = meshes.length;
  }

  engine.setNumParticles(n);

  for (var i = i0; i < n; i++) {
    if (i % 2 == 0) {
      var m = new THREE.Mesh(circle, material);
      meshes[i] = m;
      scene.add(m);
    }
    else {
      var m1 = new THREE.Mesh(circle, material1);
      meshes[i] = m1;
      scene.add(m1);
    }

  }
  
  bigCircle = new THREE.Mesh(circle1, bigMaterial);
  meshes[n] = bigCircle;
  scene.add(bigCircle);

}

function doLoop() {
  //engine.calcS(square.position.x, square.position.y);
  engine.doPhysics();
  for (var i = 0; i < meshes.length; i++) {
    //engine.calcS(square.position.x, square.position.y);
    engine.getParticlePosition(i, meshes[i].position)
  }
  renderer.render(scene, camera);
  requestAnimationFrame(doLoop);
}
