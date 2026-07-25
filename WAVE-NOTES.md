# Wave notes — everything learned building the beach

Hard-won context for anyone (human or agent) working on `beach.html` or
`breaking-waves.html`. Read this before changing wave code.

## The target
Real beach footage of **spilling breakers** on a sandy shore: swells roll in as
long dark ridges, rear up, break at their own point along the crest, white water
tumbles down the face, spray is thrown, and the whitewater bore runs up the sand
and drains back. Gentle sandy beaches spill — they rarely barrel.

## Coastal science that actually changed the look
- **Depth-limited waves.** A wave can never be taller than the water is deep;
  `H/d` tops out near 0.78. That limit *is* why waves break. Enforcing it also
  fixes troughs digging below the seabed and exposing sand between waves.
- **Shoaling.** Approaching shore, waves slow, shorten and grow (Green's law).
  They surge upward just before breaking — that's the "gaining momentum" look.
- **Breaking is an EVENT on each wave's own clock**, not a place on the map:
  approach → face steepens → crest overtakes base → collapse (fast, ~0.5s) →
  burst → rolling bore. A static "break zone" reads as bobbing, never crashing.
- **Breaks unzip along the crest.** A wave breaks at one point first and the
  collapse travels sideways. Whole-crest simultaneous breaking looks fake.
- **After breaking a wave stops being a wave.** It becomes a bore: a wall of
  whitewater translating shoreward, faster than the swell, decaying as it goes.
  Its front IS the waterline, so run-up and backwash emerge for free.
- **Swash must be locked to wave arrival** — each bore drives one fast uprush and
  one slow drain. A free-running swash cycle looks like one object sliding.
- **The surf zone is never clean.** The previous wave's foam is still there when
  the next arrives.

## Rendering lessons (user-verified preferences)
- **Water is dark, desaturated slate-teal.** A breaking wave's FACE stays dark —
  you look into water, not at a lit surface. Bright cyan everywhere reads fake.
- **Foam is translucent grey-white with multi-scale grain**, not paint. Dark
  water shows through thin sheets. Near shore it is tan-stained by suspended sand.
- **Foam must be made of pieces** — Worley/cellular clumps and rafts with water
  between them, not a continuous sheet. But **never punch grey holes** through
  it; put the bubble texture in the COLOR (white-on-white), not the coverage.
- **Concentrate white at the leading edge** of an overlapping wave layer (the
  steep shoreward-facing step), thinning behind it.
- **Foam needs MEMORY.** Simulate it as a field: inject where water collides with
  itself (Jacobian fold / bore front / swash edge), then advect shoreward,
  diffuse, and decay. Foam painted from instantaneous geometry always looks fake.
- Falling/thrown water tears into **vertical strands**, not horizontal bands.
- Light: a bottom-edge warm source plus a faint top edge worked far better than a
  point "bulb". Pure black or pure white backgrounds beat coloured gradients.

## Rejected approaches (do not repeat)
- **Pasting a curl object on top of a heightfield sea.** Two renderers, two
  shading models — it reads as a slab sitting on the water. If a curl is added it
  must be smooth-min merged into the same field, or built as one unified system.
- **A discrete wave-object train** replacing the continuous field: more literal,
  but looked regular, banded and mechanical. The user preferred the continuous
  version.
- Perfectly circular/spherical shapes, and identical repeating crests.

## Technical landmines (each cost hours)
1. **A heightfield cannot overhang.** Water above air above water is impossible
   in `y = f(x,z)`. A plunging lip needs separate geometry (parametric sheet, per
   Thürey/Müller-Fischer) or a full 3D field. No tuning will ever produce it.
2. **GLSL cannot see JS constants.** They must be injected into the shader source.
3. **Float textures + LINEAR filtering sample as ZERO** in WebGL2 without
   `OES_texture_float_linear`. Use NEAREST for simulation state. Silent killer.
4. **Projection depth sign.** With forward mapped to +w, use
   `A=(far+near)/(far-near)`, `B=-2fn/(far-near)`. The negated form maps vertices
   to z_ndc ≈ -1.0005 and clips EVERY triangle while the code looks right.
5. **Never put backticks in GLSL comments** — they terminate the JS template
   literal holding the shader.
6. **Scale and framing beat physics.** Correct waves are invisible if the domain
   is huge, the camera is far, and the sea is viewed edge-on. Keep the surf zone
   large in frame; sand should be a strip, not half the screen.
7. **Central differencing breeds checkerboard spikes.** Blend toward the
   neighbourhood mean (small viscosity) to kill grid-scale modes.
8. Guard the solver: clamp h and velocity, and repair NaN — one bad cell
   otherwise poisons the field (and NaN renders WHITE on SwiftShader).

## Verification discipline (the biggest lesson)
- **Never trust reasoning over inspection.** Hours were lost to a console filter
  that was hiding `ERROR: 0:` shader compile lines. Always grep stderr for them.
- Headless Chrome on this machine: `--headless=new --no-sandbox
  --enable-unsafe-swiftshader --virtual-time-budget=N --screenshot=out.png`.
  Without `--no-sandbox` it aborts in the sandbox host.
- **Software rendering barely advances time**, so screenshots verify composition
  but NOT motion. To judge motion, shoot several time budgets and compare, or
  drive a real browser via DevTools.
- If you cannot see images, judge screenshots **numerically**: classify pixels
  (sand / sea / foam), require thresholds, and require frames at different times
  to DIFFER. Identical frames mean nothing is moving.
- Reading back the simulation texture (`readPixels` on the FBO) is the fastest
  way to confirm the physics is alive: depth profile, velocities, breaking age.
