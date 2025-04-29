// DepthPeelMaterialMixin.d.ts
import * as THREE from "three";

/**
 * Mixes depth-peeling uniforms & logic into any THREE.Material subclass.
 */
declare function DepthPeelMaterialMixin<
  T extends new (...args: never[]) => THREE.Material
>(
  baseMaterial: T
): new (...args: ConstructorParameters<T>) => InstanceType<T> & {
  nearDepth: number | null;
  opaqueDepth: number | null;
  enableDepthPeeling: boolean;
  resolution: THREE.Vector2;
};

export default DepthPeelMaterialMixin;
