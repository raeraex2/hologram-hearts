import * as THREE from "three";

function DepthPeelMaterialMixin(baseMaterial) {
  return class extends baseMaterial {
    get nearDepth() {
      return this._uniforms.nearDepth.value;
    }

    set nearDepth(v) {
      this._uniforms.nearDepth.value = v;
      this.needsUpdate = true;
    }

    get opaqueDepth() {
      return this._uniforms.opaqueDepth.value;
    }

    set opaqueDepth(v) {
      this._uniforms.opaqueDepth.value = v;
    }

    get enableDepthPeeling() {
      return this._enableDepthPeeling;
    }

    set enableDepthPeeling(v) {
      if (this._enableDepthPeeling !== v) {
        this._enableDepthPeeling = v;
        this.needsUpdate = true;
      }
    }

    get resolution() {
      return this._uniforms.resolution.value;
    }

    constructor(...args) {
      super(...args);

      this._enableDepthPeeling = false;

      this._uniforms = {
        nearDepth: { value: null },
        opaqueDepth: { value: null },
        resolution: { value: new THREE.Vector2() },
      };
    }

    customProgramCacheKey() {
      return `${Number(this.enableDepthPeeling)}|${Number(!this.nearDepth)}`;
    }

    onBeforeCompile(shader) {
      shader.uniforms = {
        ...shader.uniforms,
        ...this._uniforms,
      };

      shader.fragmentShader = /* glsl */ `
                    #define DEPTH_PEELING ${Number(this.enableDepthPeeling)}
                    #define FIRST_PASS ${Number(!this.nearDepth)}
                    
                    #if DEPTH_PEELING
                    
                    uniform sampler2D nearDepth;
                    uniform sampler2D opaqueDepth;
                    uniform vec2 resolution;

                    #endif

                    ${shader.fragmentShader}
                `.replace(
        "void main() {",
        /* glsl */ `
                
                    void main() {

                        #if DEPTH_PEELING

                        vec2 screenUV = gl_FragCoord.xy / resolution;

                        if ( texture2D( opaqueDepth, screenUV ).r < gl_FragCoord.z ) {

                            discard;

                        }

                        #if ! FIRST_PASS

                        if ( texture2D( nearDepth, screenUV ).r >= gl_FragCoord.z - 1e-6 ) {

                            discard;

                        }
                        
                        #endif

                        #endif

                `
      );
    }
  };
}

export default DepthPeelMaterialMixin;
