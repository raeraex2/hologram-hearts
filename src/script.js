import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import holographicVertexShader from "./shaders/holographic/vertex.glsl";
import holographicFragmentShader from "./shaders/holographic/fragment.glsl";
import DepthPeelMaterialMixin from "./depthPeelMaterialMixin";

const layers = [];

const SAMPLES = 0;
const DEPTH_BUFFER = true;
const COLOR_SPACE = THREE.SRGBColorSpace;
const params = {
  useDepthPeeling: false,
  layers: 5,
  opacity: 1.0,
  doubleSided: true,
};
const clearColor = new THREE.Color();

/**
 * Base
 */
// Debug
const gui = new GUI();
gui.add(params, "useDepthPeeling");
gui.add(params, "doubleSided");
gui.add(params, "opacity", 0, 1);
gui.add(params, "layers", 1, 10, 1);

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const plyLoader = new PLYLoader();

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  25,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 10);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;

/**
 * Renderer
 */
const rendererParameters = {};
rendererParameters.clearColor = "#1d1f2a";

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setClearColor(rendererParameters.clearColor);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// set up textures
const depthTextureA = new THREE.DepthTexture(1, 1, THREE.FloatType);
const depthTextureB = new THREE.DepthTexture(1, 1, THREE.FloatType);
const opaqueDepthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);

const transparentGroup = new THREE.Group();
const opaqueGroup = new THREE.Group();
scene.add(transparentGroup, opaqueGroup);

const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
  colorSpace: COLOR_SPACE,
  depthBuffer: DEPTH_BUFFER,
  samples: SAMPLES,
});
const compositeTarget = new THREE.WebGLRenderTarget(1, 1, {
  colorSpace: COLOR_SPACE,
  depthBuffer: DEPTH_BUFFER,
  samples: SAMPLES,
});

gui.addColor(rendererParameters, "clearColor").onChange(() => {
  renderer.setClearColor(rendererParameters.clearColor);
});

/**
 * Material
 */
const materialParameters = {};
materialParameters.colorRA = "#70c1ff";
materialParameters.colorLA = "#ff0000";
materialParameters.colorCyl = "#90ee90";

gui.addColor(materialParameters, "colorRA").onChange(() => {
  materialRA.uniforms.uColor.value.set(materialParameters.colorRA);
});
gui.addColor(materialParameters, "colorLA").onChange(() => {
  materialLA.uniforms.uColor.value.set(materialParameters.colorLA);
});
gui.addColor(materialParameters, "colorCyl").onChange(() => {
  materialCyl.color.set(materialParameters.colorCyl);
});

const DepthPeelMaterial = DepthPeelMaterialMixin(THREE.ShaderMaterial);

const materialRA = new DepthPeelMaterial({
  vertexShader: holographicVertexShader,
  fragmentShader: holographicFragmentShader,
  uniforms: {
    uTime: new THREE.Uniform(0),
    uColor: new THREE.Uniform(new THREE.Color(materialParameters.colorRA)),
    uOpacity: new THREE.Uniform(1.0),
  },
});
const materialLA = new DepthPeelMaterial({
  vertexShader: holographicVertexShader,
  fragmentShader: holographicFragmentShader,
  uniforms: {
    uTime: new THREE.Uniform(0),
    uColor: new THREE.Uniform(new THREE.Color(materialParameters.colorLA)),
    uOpacity: new THREE.Uniform(1.0),
  },
});
const materialCyl = new THREE.MeshMatcapMaterial({
  color: new THREE.Color(materialParameters.colorCyl),
});

// Add objects
{
  // Create a cylinder geometry
  const geometryCyl = new THREE.CylinderGeometry(1, 1, 2, 32, 1, false);

  const cylinder = new THREE.Mesh(geometryCyl, materialCyl);
  cylinder.scale.set(0.125, 1, 0.125);
  cylinder.position.set(0.5, 0, 0.5);
  opaqueGroup.add(cylinder);
}

plyLoader.load("./heart.ply", (ply) => {
  const mesh = new THREE.Mesh(ply, materialRA);
  transparentGroup.add(mesh);
});
plyLoader.load("./la.ply", (ply) => {
  const mesh = new THREE.Mesh(ply, materialLA);
  transparentGroup.add(mesh);
});

const quadScene = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

// create a two-triangle quad covering the screen
const quadGeo = new THREE.PlaneGeometry(1, 1);
const quadMat = new THREE.MeshBasicMaterial({
  depthTest: false,
  depthWrite: false,
});
const quadMesh = new THREE.Mesh(quadGeo, quadMat);
quadScene.add(quadMesh);

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  // Update material
  materialRA.uniforms.uTime.value = elapsedTime;

  // Update controls
  controls.update();

  // Render
  if (params.useDepthPeeling) {
    depthPeelRender();
  } else {
    render();
  }

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

window.addEventListener("resize", onWindowResize);
onWindowResize();

tick();

function render() {
  transparentGroup.traverse(({ material }) => {
    // Essentially disable transparency as it is not good anyway
    if (material) {
      material.enableDepthPeeling = false;
      material.opaqueDepth = null;
      material.nearDepth = null;
      material.blending = THREE.NormalBlending;
      material.depthWrite = true;
      material.opacity = 1.0;
      material.uniforms.uOpacity.value = 1.0;
      material.side = params.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
      material.forceSinglePass = false;
    }
  });

  opaqueGroup.visible = true;
  transparentGroup.visible = true;

  // // Indirect
  // renderer.setRenderTarget(renderTarget);
  // renderer.render(scene, camera);
  // renderer.setRenderTarget(null);

  // quadMat.map = renderTarget.texture;
  // quadMat.needsUpdate = true;
  // renderer.render(quadScene, quadCamera);

  // Direct
  renderer.render(scene, camera);
}

function depthPeelRender() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio;
  while (layers.length < params.layers) {
    layers.push(
      new THREE.WebGLRenderTarget(w * dpr, h * dpr, {
        colorSpace: COLOR_SPACE,
        depthBuffer: DEPTH_BUFFER,
        samples: SAMPLES,
      })
    );
  }

  while (layers.length > params.layers) {
    layers.pop().dispose();
  }

  opaqueGroup.visible = true;
  transparentGroup.visible = false;
  renderTarget.depthTexture = opaqueDepthTexture;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  // render opaque layer
  quadMat.map = renderTarget.texture;
  quadMat.blending = THREE.NoBlending;
  quadMat.transparent = false;
  quadMat.depthTest = false;
  quadMat.depthWrite = false;
  renderer.render(quadScene, quadCamera);
  renderTarget.depthTexture = null;

  const clearAlpha = renderer.getClearAlpha();
  renderer.getClearColor(clearColor);

  // perform depth peeling
  opaqueGroup.visible = false;
  transparentGroup.visible = true;
  const depthTextures = [depthTextureA, depthTextureB];
  for (let i = 0; i < params.layers; i++) {
    const writeDepthTexture = depthTextures[(i + 1) % 2];
    const nearDepthTexture = depthTextures[i % 2];

    // update the materials, skipping the near check
    transparentGroup.traverse(({ material }) => {
      if (material) {
        material.enableDepthPeeling = true;
        material.opaqueDepth = opaqueDepthTexture;
        material.nearDepth = i === 0 ? null : nearDepthTexture;
        material.blending = THREE.CustomBlending;
        material.blendDst = THREE.ZeroFactor;
        material.blendSrc = THREE.OneFactor;
        material.depthWrite = true;
        material.opacity = params.opacity;
        material.uniforms.uOpacity.value = params.opacity;
        material.side = params.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
        material.forceSinglePass = true;

        renderer.getDrawingBufferSize(material.resolution);
      }
    });

    // perform rendering
    let currTarget = i === 0 ? compositeTarget : renderTarget;
    currTarget = layers[i];
    currTarget.depthTexture = writeDepthTexture;

    renderer.setRenderTarget(currTarget);
    renderer.setClearColor(0, 0);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  renderer.setClearColor(clearColor, clearAlpha);

  // render transparent layers
  renderer.autoClear = false;
  quadMat.blending = THREE.NormalBlending;
  quadMat.transparent = true;
  quadMat.depthTest = false;
  quadMat.depthWrite = false;
  for (let i = params.layers - 1; i >= 0; i--) {
    layers[i].depthTexture = null;
    quadMat.map = layers[i].texture;
    quadMat.needsUpdate = true;
    renderer.render(quadScene, quadCamera);
  }
  renderer.autoClear = true;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio;
  renderer.setSize(w, h);
  renderer.setPixelRatio(dpr);

  compositeTarget.setSize(dpr * w, dpr * h);
  renderTarget.setSize(dpr * w, dpr * h);

  layers.forEach((rt) => rt.dispose());
  layers.length = 0;

  depthTextureA.image.width = dpr * w;
  depthTextureA.image.height = dpr * h;
  depthTextureA.dispose();

  depthTextureB.image.width = dpr * w;
  depthTextureB.image.height = dpr * h;
  depthTextureB.dispose();

  opaqueDepthTexture.image.width = dpr * w;
  opaqueDepthTexture.image.height = dpr * h;
  opaqueDepthTexture.dispose();
}
