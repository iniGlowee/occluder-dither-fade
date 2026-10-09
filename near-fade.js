/**
 * occluder-dither-fade — hide geometry between the camera and your subject with a
 * per-fragment Bayer screen-door `discard`, keeping the whole pipeline OPAQUE (depth
 * writes on, no transparency sorting, no separate blended pass). It reads as a clean
 * fade in motion, and it's the cheapest *correct* way to stop a wall occluding the
 * player in third-person — no alpha, no order-dependent artifacts.
 *
 * three.js usage — attach the injector as a material's `onBeforeCompile`:
 *
 *   import { createNearFade, fadingTwin } from './near-fade.js';
 *
 *   // simplest: every lit material near the camera dithers out
 *   material.onBeforeCompile = createNearFade();            // defaults 1.2m..3.2m
 *   material.customProgramCacheKey = () => 'nearfade';      // dedupe the program
 *
 *   // or keep a fading TWIN and swap per mesh (fade only the occluder you want):
 *   const fade = fadingTwin(material, { gone: 1.0, full: 3.0 });
 *   mesh.material = occluding ? fade : material;
 *
 * Engine-agnostic version: `near-fade.glsl` has the raw fragment chunk.
 * MIT.
 */

/**
 * Build an `onBeforeCompile` that dithers a LIT material out as it nears the camera.
 * `gone`: fully discarded closer than this (metres). `full`: fully solid past this.
 * Unlit materials (MeshBasicMaterial) have no `vViewPosition` varying and are skipped.
 */
export function createNearFade({ gone = 1.2, full = 3.2 } = {}) {
  const g = Number(gone).toFixed(3);
  const f = Number(full).toFixed(3);
  return function injectNearFade(shader) {
    const lit = this && (this.isMeshStandardMaterial || this.isMeshPhysicalMaterial ||
      this.isMeshPhongMaterial || this.isMeshToonMaterial || this.isMeshLambertMaterial);
    if (!lit) return;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      {
        float aeFade = smoothstep(${g}, ${f}, length(vViewPosition));
        if (aeFade < 0.999) {
          const mat4 AE_BAYER = mat4(
             0.0, 12.0,  3.0, 15.0,
             8.0,  4.0, 11.0,  7.0,
             2.0, 14.0,  1.0, 13.0,
            10.0,  6.0,  9.0,  5.0) / 16.0;
          ivec2 aeQ = ivec2(mod(gl_FragCoord.xy, 4.0));
          if (aeFade <= AE_BAYER[aeQ.x][aeQ.y]) discard;
        }
      }`,
    );
  };
}

/** Default injector (1.2m..3.2m). Attach directly as `onBeforeCompile`. */
export const injectNearFade = createNearFade();

/**
 * A fading twin of a material (shared per source material so programs stay
 * deduplicated). Swap `mesh.material` between the base and the twin to fade only the
 * occluder you choose — e.g. the one wall a camera→player ray hits.
 */
const twins = new WeakMap();
export function fadingTwin(material, opts) {
  let fm = twins.get(material);
  if (!fm) {
    fm = material.clone();
    fm.onBeforeCompile = createNearFade(opts);
    twins.set(material, fm);
  }
  return fm;
}
