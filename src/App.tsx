import React, { StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, extend, ThreeElement, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import GUI from "lil-gui";
import { Color, ColorRepresentation } from "three";
import DepthPeelMaterialMixin from "./DepthPeelMaterialMixin";
import { ShaderMaterial } from "three";
import holographicVertexShader from "./shaders/holographic/vertex.glsl";
import holographicFragmentShader from "./shaders/holographic/fragment.glsl";
import { Uniform } from "three";

const DepthPeelMaterial = DepthPeelMaterialMixin(ShaderMaterial);

extend({ DepthPeelMaterial });

// Add types to ThreeElements elements so primitives pick up on it
declare module "@react-three/fiber" {
  interface ThreeElements {
    depthPeelMaterial: ThreeElement<typeof DepthPeelMaterial>;
  }
}

interface IConfig {
  raColor: Color;
  laColor: Color;
  cylColor: Color;
}

interface GuiControlProps {
  config: IConfig;
  setConfig: React.Dispatch<React.SetStateAction<IConfig>>;
}

const GuiControl: React.FC<GuiControlProps> = ({ config, setConfig }) => {
  useEffect(() => {
    const gui = new GUI();

    const raFolder = gui.addFolder("RA");
    raFolder
      .addColor(config, "raColor")
      .onChange((c: ColorRepresentation | undefined) => {
        setConfig((cfg) => ({ ...cfg, raColor: new Color(c) }));
      });

    const laFolder = gui.addFolder("LA");
    laFolder
      .addColor(config, "laColor")
      .onChange((c: ColorRepresentation | undefined) => {
        setConfig((cfg) => ({ ...cfg, laColor: new Color(c) }));
      });

    const cylFolder = gui.addFolder("Cylinder");
    cylFolder
      .addColor(config, "cylColor")
      .onChange((c: ColorRepresentation | undefined) => {
        setConfig((cfg) => ({ ...cfg, cylColor: new Color(c) }));
      });

    return () => {
      gui.destroy();
    };
  }, []);

  return false;
};

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

const Heart: React.FC<HeartProps> = ({ config }) => {
  return (
    <>
      <group name="opaque">
        <mesh scale={[0.125, 1, 0.125]} position={[0.5, 0, 0.5]}>
          <cylinderGeometry args={[1, 1, 2, 32, 1, false]} />
          <meshMatcapMaterial color={config.cylColor} />
        </mesh>
      </group>
      <group name="transparent">
        <mesh>
          <RaGeometry />
          <depthPeelMaterial
            vertexShader={holographicVertexShader}
            fragmentShader={holographicFragmentShader}
            uniforms={{
              uTime: new Uniform(0),
              uColor: new Uniform(config.raColor),
              uOpacity: new Uniform(1.0),
            }}
          />
        </mesh>
        <mesh>
          <LaGeometry />
          <depthPeelMaterial
            vertexShader={holographicVertexShader}
            fragmentShader={holographicFragmentShader}
            uniforms={{
              uTime: new Uniform(0),
              uColor: new Uniform(config.laColor),
              uOpacity: new Uniform(1.0),
            }}
          />
        </mesh>
      </group>
    </>
  );
};

function App() {
  const [config, setConfig] = useState<IConfig>({
    raColor: new Color("lightblue"),
    laColor: new Color("pink"),
    cylColor: new Color("lightgreen"),
  });

  return (
    <Suspense fallback={<span style={{ color: "white" }}>Loading...</span>}>
      <StrictMode>
        <Canvas>
          <OrbitControls enableDamping={false} />
          <Heart config={config} />
          {/* <mesh>
            <boxGeometry />
            <meshMatcapMaterial color={"pink"} />
          </mesh> */}
        </Canvas>
        <GuiControl config={config} setConfig={setConfig} />
      </StrictMode>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
