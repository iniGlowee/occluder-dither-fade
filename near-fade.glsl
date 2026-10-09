// occluder-dither-fade — engine-agnostic fragment snippet.
//
// Drop this into any LIT fragment shader where you have:
//   * the fragment's VIEW-SPACE position (distance to the camera), and
//   * gl_FragCoord (screen-space pixel coords).
// It dithers the fragment out as it nears the camera, keeping the draw OPAQUE
// (no blending, no sorting). `GONE`/`FULL` are metres (or your world units).
//
// `vViewPosition` here is the camera-space position of the fragment (three.js name);
// use whatever your pipeline calls it. length() is the distance to the lens.

const mat4 AE_BAYER = mat4(
     0.0, 12.0,  3.0, 15.0,
     8.0,  4.0, 11.0,  7.0,
     2.0, 14.0,  1.0, 13.0,
    10.0,  6.0,  9.0,  5.0) / 16.0;

void nearFadeDiscard(vec3 viewPos, float gone, float full) {
    float f = smoothstep(gone, full, length(viewPos)); // 0 at the lens -> 1 far away
    if (f < 0.999) {
        ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
        if (f <= AE_BAYER[q.x][q.y]) discard;          // screen-door: keep it opaque
    }
}

// call near the top of your fragment main(), e.g.:
//   nearFadeDiscard(vViewPosition, 1.2, 3.2);
