import React, { StrictMode, Suspense, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Canvas,
  extend,
  ThreeElement,
  useFrame,
  useLoader,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
} from "three";
import DepthPeelMaterialMixin from "./DepthPeelMaterialMixin";
import { ShaderMaterial } from "three";
import holographicVertexShader from "./shaders/holographic/vertex.glsl";
import holographicFragmentShader from "./shaders/holographic/fragment.glsl";
import { Uniform } from "three";
import { useControls } from "leva";

const DepthPeelMaterial = DepthPeelMaterialMixin(ShaderMaterial);

extend({ DepthPeelMaterial });

// Add types to ThreeElements elements so primitives pick up on it
declare module "@react-three/fiber" {
  interface ThreeElements {
    depthPeelMaterial: ThreeElement<typeof DepthPeelMaterial>;
  }
}

interface IConfig {
  depthPeeling: boolean;
  backColor: Color;
  raColor: Color;
  laColor: Color;
  cylColor: Color;
}

const RaGeometry = () => {
  const geomRA = useLoader(PLYLoader, "./heart.ply");
  return <primitive object={geomRA} dispose={null} />;
};

const LaGeometry = () => {
  const geomLA = useLoader(PLYLoader, "./la.ply");
  return <primitive object={geomLA} dispose={null} />;
};

interface HeartProps {
  config: IConfig;
}

const SAMPLES = 0;
const DEPTH_BUFFER = true;
const COLOR_SPACE = SRGBColorSpace;

const renderTarget = new WebGLRenderTarget(1, 1, {
  colorSpace: COLOR_SPACE,
  depthBuffer: DEPTH_BUFFER,
  samples: SAMPLES,
});
// const compositeTarget = new WebGLRenderTarget(1, 1, {
//   colorSpace: COLOR_SPACE,
//   depthBuffer: DEPTH_BUFFER,
//   samples: SAMPLES,
// });

const quadCamera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

const Heart: React.FC<HeartProps> = ({ config }) => {
  const mainSceneRef = useRef<Scene>(null);
  const quadSceneRef = useRef<Scene>(null);
  const quadMatRef = useRef<MeshBasicMaterial>(null);
  const transparentGrpRef = useRef<Group>(null);

  useFrame(({ gl, camera, size }) => {
    if (config.depthPeeling) {
    } else {
      transparentGrpRef.current!.traverse((obj) => {
        if (!(obj instanceof Mesh)) return;
        const material = obj.material;
        if (material) {
          material.enableDepthPeeling = false;
          material.opaqueDepth = null;
          material.nearDepth = null;
          material.blending = NormalBlending;
          material.depthWrite = true;
          material.opacity = 1.0;
          material.uniforms.uOpacity.value = 1.0;
          material.side = DoubleSide;
          material.forceSinglePass = false;
        }
      });

      // gl.setClearColor(config.backColor);
      // gl.render(mainSceneRef.current!, camera);

      renderTarget.setSize(size.width, size.height);

      gl.setRenderTarget(renderTarget);
      gl.setClearColor(config.backColor);
      gl.render(mainSceneRef.current!, camera);
      gl.setRenderTarget(null);

      quadMatRef.current!.map = renderTarget.texture;
      quadMatRef.current!.needsUpdate = true;
      gl.render(quadSceneRef.current!, quadCamera);
    }
  }, 1);

  const uniformsRa = useMemo(() => {
    return {
      uTime: new Uniform(0),
      uColor: new Uniform("#000000"),
      uOpacity: new Uniform(1.0),
    };
  }, []);

  const uniformsLa = useMemo(() => {
    return {
      uTime: new Uniform(0),
      uColor: new Uniform("#000000"),
      uOpacity: new Uniform(1.0),
    };
  }, []);

  return (
    <>
      <scene ref={quadSceneRef}>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={quadMatRef}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </scene>
      <scene ref={mainSceneRef}>
        <group name="opaque">
          <mesh scale={[0.125, 1, 0.125]} position={[0.5, 0, 0.5]}>
            <cylinderGeometry args={[1, 1, 2, 32, 1, false]} />
            <meshMatcapMaterial color={config.cylColor} />
          </mesh>
        </group>
        <group ref={transparentGrpRef}>
          <mesh>
            <RaGeometry />
            <depthPeelMaterial
              vertexShader={holographicVertexShader}
              fragmentShader={holographicFragmentShader}
              uniforms={uniformsRa}
              uniforms-uColor-value={config.raColor}
            />
          </mesh>
          <mesh>
            <LaGeometry />
            <depthPeelMaterial
              vertexShader={holographicVertexShader}
              fragmentShader={holographicFragmentShader}
              uniforms={uniformsLa}
              uniforms-uColor-value={config.laColor}
            />
          </mesh>
        </group>
      </scene>
    </>
  );
};

function App() {
  const leva = useControls({
    depthPeeling: false,
    backColor: "#1d1f2a",
    raColor: "#70c1ff",
    laColor: "#ff0000",
    cylColor: "#90ee90",
  });

  const config: IConfig = {
    depthPeeling: leva.depthPeeling,
    backColor: new Color(leva.backColor),
    laColor: new Color(leva.laColor),
    raColor: new Color(leva.raColor),
    cylColor: new Color(leva.cylColor),
  };

  return (
    <Suspense fallback={<span style={{ color: "white" }}>Loading...</span>}>
      <StrictMode>
        <Canvas>
          <color attach={"background"} args={[leva.backColor]} />
          <OrbitControls enableDamping={false} />
          <Heart config={config} />
          {/* <mesh>
            <boxGeometry />
            <meshMatcapMaterial color={"pink"} />
          </mesh> */}
        </Canvas>
      </StrictMode>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
