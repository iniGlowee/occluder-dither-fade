# occluder-dither-fade

**Hide geometry between the camera and your subject with a per-fragment Bayer
screen-door `discard` — opaque, no transparency sorting.** The cheapest *correct* way
to stop a wall occluding the player in third-person.

three.js drop-in (`near-fade.js`) + an engine-agnostic GLSL snippet (`near-fade.glsl`).

---

## The problem

In third-person the camera backs into walls; inside a building, near walls block the
character. The obvious fix — fade the occluder with **alpha** — drags you into
transparency sorting, order-dependent artifacts, and disabled depth writes. One wall
is manageable; a scene full of them is not.

## The fix

Dither the occluder out **per fragment** using a screen-space 4×4 **Bayer** matrix and
`discard`. Fragments nearer than `gone` are fully removed, fragments past `full` are
fully solid, and in between a stable ordered-dither pattern drops a fraction of pixels.
The pipeline stays **fully opaque** — depth writes on, no sorting, no second pass — and
the screen-door reads as a clean fade in motion (it's the look you've seen in a lot of
stylised games).

```glsl
float f = smoothstep(GONE, FULL, length(viewPos));   // 0 at the lens -> 1 far
if (f < 0.999) {
  ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
  if (f <= AE_BAYER[q.x][q.y]) discard;              // keep it opaque
}
```

It's distance-to-camera, so it's **per-camera for free** — the same material fades
correctly for the play camera and an editor orbit alike.

## three.js usage

```js
import { createNearFade, fadingTwin } from './near-fade.js';

// A) simplest — every lit material dithers out near the lens:
material.onBeforeCompile = createNearFade();          // defaults: gone 1.2m, full 3.2m
material.customProgramCacheKey = () => 'nearfade';    // dedupe the shader program

// B) fade only the occluder you choose — keep a twin and swap per mesh
//    (e.g. the one wall a camera->player ray hits this frame):
const fade = fadingTwin(wall.material, { gone: 1.0, full: 3.0 });
wall.material = occluding ? fade : wall.material;
```

`createNearFade({ gone, full })` bakes the distances into the shader. Unlit materials
(`MeshBasicMaterial`) have no `vViewPosition` varying and are skipped automatically.

For any other engine, `near-fade.glsl` has the raw fragment chunk and a
`nearFadeDiscard(viewPos, gone, full)` helper — call it near the top of your fragment
`main()`.

## Tuning / when to use

- **`gone` / `full`** are the fade band in world units. Tune to your camera boom: set
  `full` to just short of where the subject sits (so the subject itself never dithers)
  and `gone` to ~1 m. Keep your minimum zoom distance past `full`.
- **Use it** for third-person occlusion, "roofs/near-walls vanish when you're inside,"
  and anywhere you'd otherwise reach for alpha just to see past something.
- **Non-goals:** it's a per-fragment `discard`, so it only helps where you'd otherwise
  pay for transparency — don't blanket it onto every material. It's an opaque dither,
  not smooth alpha; if you specifically want a soft alpha fade, that's a different
  (and more expensive) tool. Skinned characters are usually left out (they're the
  thing the fade exists to keep visible).

## Provenance

Extracted from the AE1 ("Angel's Egg") engine, where it both gives the stylised
near-camera look and solves third-person occlusion without any transparency cost.

## License

MIT — see [LICENSE](LICENSE).
