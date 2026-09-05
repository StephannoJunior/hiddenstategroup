/*
  LIQUID — the glass material, and the spring that moves it.

  Kept out of GlassBar.jsx because both halves are worth having on their own:
  the material is just CSS and can dress anything, and the spring is a general
  animator. Neither imports anything, so neither can take part in a circular
  import — the same reason the design tokens live in their own file.

  ── WHY A SPRING AND NOT A TRANSITION ────────────────────────────────────

  A CSS transition has a duration, and a duration cannot be interrupted
  gracefully. Tap the bar twice quickly and the second transition restarts
  from a standstill: the motion stops dead and begins again, which is exactly
  the "sticky" feeling that no amount of easing-curve tuning ever fixed here.

  A spring has no duration. It has a position and a VELOCITY, and when the
  target changes mid-flight it keeps the velocity it already had and bends
  toward the new one. That continuity is the whole reason native interfaces
  feel like objects rather than slideshows.

  ── WHY THE MATERIAL LOOKS LIKE GLASS AND NOT LIKE GLASSMORPHISM ─────────

  Three things, in order of how much they matter:

  1. THE BACKDROP IS RE-MAPPED, NOT TINTED. contrast() below 1 pulls whatever
     is behind toward a middle tone before any colour is added. That is what
     keeps the labels readable over a white page AND a black photograph
     without the bar ever changing colour. Nearly every glassmorphism recipe
     skips this and reaches for a heavier tint instead, which is why they all
     look like frosted plastic.

  2. A LIP, NOT AN OUTLINE. Glass is thick, and thickness shows as a band of
     bent light around the rim — brighter where light enters, dimmer where it
     leaves, with a faint warm/cool split because real glass separates light
     at its edges. A 1px white border reads as a sticker; this reads as an
     edge you could run a fingernail along.

  3. A SPECULAR THAT MOVES. Light does not sit still on a curved surface while
     the world slides past it. The streak drifts with scroll and with a drag.
*/

/* ── the spring ─────────────────────────────────────────────────────────── */

/*
  SPRINGS ARE SPECIFIED BY FEEL, NOT BY STIFFNESS.

  Stiffness and damping are the numbers the integrator wants, and they are
  the wrong numbers for a person to choose. Change stiffness alone and the
  motion gets faster AND bouncier at the same time, because the damping
  RATIO — the thing your eye actually reads — is a function of both. Every
  round of tuning this bar has had was somebody moving one number and
  accidentally moving two properties.

  So springs are written the way iOS writes them, as:

    response  how long the motion takes, in seconds. The period of the
              undamped spring: halve it and everything happens twice as fast
              with exactly the same character.
    ratio     the damping ratio. 1 arrives dead on its mark and stops.
              Below 1 overshoots and settles back; .8 is one small, barely
              perceptible overshoot, which reads as weight. Below about .6
              it reads as a bounce, which reads as a bug.

  This is why the bar was slow. It was running at response .39 and ratio .65:
  four tenths of a second to travel, with enough overshoot to be seen going
  past and coming back. That combination is not "smooth and heavy", it is
  late and wobbly, and no amount of moving stiffness up would have fixed it
  without making the wobble worse at the same time.
*/
export function springFor(response, ratio = 0.82, mass = 1) {
  const w = (2 * Math.PI) / Math.max(0.05, response);
  return { stiffness: w * w * mass, damping: 2 * ratio * w * mass, mass };
}

export class Spring {
  constructor(value, { stiffness = 240, damping = 27, mass = 1 } = {}) {
    this.v = value; this.target = value; this.vel = 0;
    this.k = stiffness; this.c = damping; this.m = mass;
  }
  to(target) { this.target = target; }
  set(value) { this.v = this.target = value; this.vel = 0; }
  // Retune in place, without losing where the spring is or how fast it is
  // going. The settings tab changes these while the bar is on screen.
  tune({ stiffness, damping, mass }) {
    if (stiffness) this.k = stiffness;
    if (damping) this.c = damping;
    if (mass) this.m = mass;
  }
  get done() {
    return Math.abs(this.v - this.target) < 0.08 && Math.abs(this.vel) < 0.08;
  }
  step(dt, instant) {
    if (instant) { this.v = this.target; this.vel = 0; return this.v; }
    /*
      Sub-stepped. A single large step after a dropped frame — or after the
      tab has been in the background — makes an explicit integrator overshoot
      wildly, and the bar would appear to fly apart on the frame the phone
      wakes up.

      The step size has to fall as the springs get stiffer, or the same
      integrator that was stable at stiffness 240 goes unstable at 900. The
      bound is the natural period: eight or so steps per oscillation is
      plenty for explicit Euler, and it costs nothing because dt is small.
    */
    const safe = Math.min(0.008, (2 * Math.PI) / Math.sqrt(this.k / this.m) / 8);
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / safe)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = -this.k * (this.v - this.target) - this.c * this.vel;
      this.vel += (f / this.m) * h;
      this.v += this.vel * h;
    }
    return this.v;
  }
}

/*
  Drive a set of springs from one rAF loop and hand the values to a writer.

  The writer sets styles DIRECTLY on a node. Nothing here goes through React
  state: a spring settling over 400ms would otherwise cause about twenty-five
  re-renders of a component that computes tab lists, permissions and layout
  on every pass.

  Returns a controller with `to`, `set`, `tune`, `kick` and `stop`.
*/
export function driveSprings(springs, write, isStill) {
  let raf = null, last = 0;

  const frame = (now) => {
    /*
      A FIRST FRAME THAT MOVES.

      This used to compute dt from `last || now`, which is zero on the frame
      after a kick — one whole frame of every single movement spent standing
      still. At sixty frames a second that is sixteen milliseconds of dead
      time at the start of every gesture, which is precisely the window in
      which a touch either feels connected to the screen or does not. A
      nominal frame is assumed instead.
    */
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    const still = typeof isStill === "function" ? isStill() : !!isStill;
    const out = {};
    let settled = true;
    for (const key in springs) {
      out[key] = springs[key].step(dt, still);
      if (!springs[key].done) settled = false;
    }
    write(out);
    if (settled) { raf = null; last = 0; return; }
    raf = requestAnimationFrame(frame);
  };

  const kick = () => { if (raf === null) { last = 0; raf = requestAnimationFrame(frame); } };

  return {
    to(targets) {
      for (const key in targets) springs[key]?.to(targets[key]);
      kick();
    },
    set(values) {
      for (const key in values) springs[key]?.set(values[key]);
      const out = {};
      for (const key in springs) out[key] = springs[key].v;
      write(out);
    },
    // Change the character of the motion without interrupting it.
    tune(map) {
      for (const key in map) springs[key]?.tune(map[key]);
    },
    kick,
    stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; },
  };
}

/*
  ── HOW FAST EVERYTHING MOVES, IN ONE TABLE ────────────────────────────────

  [ response, damping ratio ] for each sprung property. Response is how long
  the motion takes in seconds; the ratio is how much overshoot it carries,
  where 1 arrives dead and stops.

  WHAT WAS WRONG. Every one of these was previously written as a stiffness
  and a damping number, and at stiffness 235 / damping 20 the bar was running
  at a response of .39 seconds with a damping ratio of .65 — four tenths of a
  second to travel, overshooting far enough to be seen going past the mark
  and coming back. Read as "slow" and "glitchy" respectively, which is
  exactly what it was told. It was never a curve that needed adjusting; it
  was two numbers that could not be moved independently.

  The order below is deliberate and is what makes the bar read as one object:
  the SELECTION is the fastest thing on screen, because it is the thing a
  finger is pointing at; the pane's WIDTH is slower, because it is bigger;
  and the RADIUS is slower still and the loosest, so the corners arrive a
  fraction after the edges — which is what a heavy liquid actually does.
*/
export const CURVE = {
  w:  [0.34, 0.80],   // the pane's width
  h:  [0.30, 0.92],   // its height — tight, an overshoot here just looks wrong
  m:  [0.34, 0.80],   // the centring margin, locked to the width
  r:  [0.38, 0.76],   // the corners, arriving last
  s:  [0.17, 0.74],   // the press squash — quick, or it is not a press
  lx: [0.28, 0.84],   // the selection's position
  lw: [0.30, 0.90],   // and its width
};

export const springSet = (speed) => {
  const out = {};
  for (const key in CURVE) out[key] = springFor(CURVE[key][0] / speed, CURVE[key][1]);
  return out;
};

/* ── the material ───────────────────────────────────────────────────────── */

/*
  Three finishes. They differ only in how much of the backdrop they keep and
  which way they lean; the lip and the specular are common to all, because
  those are what make it glass rather than a panel.

    LENS   almost no colour of its own — it works by squeezing the backdrop
           toward a middle tone, so it barely changes crossing from a white
           page to a black photograph. The safest over mixed content.
    CLEAR  as little tint and as much blur as a browser will give. The most
           literally transparent, and the least forgiving over busy content.
    INK    leans dark. Belongs over photography; heavy over warm stock.

  ── WHY THESE ARE NUMBERS NOW AND NOT STRINGS ──────────────────────────────

  They used to be finished CSS strings, and that is how the bar ended up too
  dark to see through. INK was darkening the page TWICE: brightness(.60) on
  the backdrop, and then a near-black tint at .60 to .76 opacity laid over
  the result. Those compound. Multiply them out and about fourteen per cent
  of whatever is behind the bar was reaching the eye — which is not dark
  glass, it is a black bar with a rumour of a page behind it, and no amount
  of adjusting either number alone would have found it, because the number
  that was wrong was the PRODUCT of the two.

  So the tint alpha and the brightness now come from ONE control, and they
  move together on a curve that keeps the product sane at every setting. Dial
  it to the top and you get what was shipping; the default sits where about
  four tenths of the page still comes through, which is the difference
  between dark glass and a lid.
*/
const FINISHES = {
  LENS: {
    dark: false,
    // [r,g,b] of the tint, and the alpha range the control sweeps.
    rgb: [255, 255, 255], aLow: 0.03, aHigh: 0.30, aFall: 0.04,
    // brightness at darkness 0 and at darkness 100
    brightLow: 1.10, brightHigh: 0.96,
    blur: 22, sat: 235, contrast: 0.82, darkness: 22,
    lip: "linear-gradient(146deg, rgba(255,250,240,1) 0%, rgba(255,255,255,.46) 22%, " +
         "rgba(255,255,255,.10) 44%, rgba(140,175,225,.26) 62%, " +
         "rgba(232,244,255,.82) 88%, rgba(255,255,255,.95) 100%)",
    spec: "radial-gradient(130% 110% at 50% -10%, rgba(255,255,255,.62), rgba(255,255,255,.10) 52%, rgba(255,255,255,0) 76%)",
    specH: "52%",
    bounce: "rgba(255,255,255,.55)",
  },
  CLEAR: {
    dark: false,
    rgb: [255, 255, 255], aLow: 0.01, aHigh: 0.22, aFall: 0.02,
    brightLow: 1.14, brightHigh: 1.00,
    blur: 26, sat: 260, contrast: 0.92, darkness: 14,
    lip: "linear-gradient(146deg, rgba(255,252,246,1) 0%, rgba(255,255,255,.55) 20%, " +
         "rgba(255,255,255,.12) 42%, rgba(150,180,225,.30) 60%, " +
         "rgba(238,247,255,.9) 86%, rgba(255,255,255,1) 100%)",
    spec: "radial-gradient(130% 110% at 50% -10%, rgba(255,255,255,.72), rgba(255,255,255,.12) 50%, rgba(255,255,255,0) 76%)",
    specH: "56%",
    bounce: "rgba(255,255,255,.72)",
  },
  INK: {
    dark: true,
    /*
      The tint runs from a tenth to two thirds, and the bottom of the pane
      carries a little more than the top — glass is thicker where it curves
      away from you, and that gradient is most of what stops a dark bar
      reading as a rectangle of paint.
    */
    rgb: [20, 17, 13], aLow: 0.10, aHigh: 0.66, aFall: 0.14,
    /*
      Brightness barely moves. It is here to keep bright things behind the
      bar from blowing out through the tint, NOT to do the darkening — that
      is the tint's job, and the whole bug was these two doing it at once.
    */
    brightLow: 1.00, brightHigh: 0.70,
    blur: 22, sat: 175, contrast: 0.90, darkness: 62,
    lip: "linear-gradient(146deg, rgba(255,244,230,.95) 0%, rgba(255,255,255,.26) 22%, " +
         "rgba(255,255,255,.05) 46%, rgba(150,185,240,.22) 64%, " +
         "rgba(214,234,255,.55) 88%, rgba(255,255,255,.72) 100%)",
    spec: "radial-gradient(130% 110% at 50% -10%, rgba(255,255,255,.42), rgba(255,255,255,.06) 50%, rgba(255,255,255,0) 76%)",
    specH: "48%",
    bounce: "rgba(255,255,255,.26)",
  },
};

export const FINISH_NAMES = Object.keys(FINISHES);

/*
  Resolve a finish plus whatever the console has overridden into one set of
  concrete values. Everything below goes through this, so the specimen in the
  settings tab and the real bar cannot possibly disagree.

  `tune` is { darkness, blur, saturation } — any of them undefined or null
  means "whatever the finish says".
*/
export function resolveFinish(name = "INK", tune = {}) {
  const f = FINISHES[name] || FINISHES.LENS;
  const num = (v, fallback) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));

  const d = Math.max(0, Math.min(100, num(tune.darkness, f.darkness))) / 100;
  const blur = Math.max(0, Math.min(60, num(tune.blur, f.blur)));
  const sat = Math.max(100, Math.min(320, num(tune.saturation, f.sat)));

  const aTop = f.aLow + (f.aHigh - f.aLow) * d;
  const aBot = Math.min(0.94, aTop + f.aFall * (0.35 + d));
  const bright = f.brightLow + (f.brightHigh - f.brightLow) * d;
  const [r, g, b] = f.rgb;

  return {
    ...f,
    dark: f.dark,
    darkness: Math.round(d * 100),
    blurPx: blur,
    saturation: sat,
    tint: `linear-gradient(180deg, rgba(${r},${g},${b},${aTop.toFixed(3)}), rgba(${r},${g},${b},${aBot.toFixed(3)}))`,
    backdrop: `blur(${blur}px) saturate(${sat}%) contrast(${f.contrast}) brightness(${bright.toFixed(3)})`,
    /*
      HOW MUCH OF THE PAGE ACTUALLY GETS THROUGH, as a percentage. Not used
      to draw anything — it is printed next to the slider, because "62" means
      nothing to a person and "38% of the page shows through" means exactly
      the thing they are trying to judge.
    */
    seeThrough: Math.min(100, Math.round(bright * (1 - (aTop + aBot) / 2) * 100)),
  };
}

/*
  The base style for the pane itself.

  NOTE what is deliberately absent: no border, and no `transform`. A border
  competes with the lip; a transform on an element that also clips and has a
  radius is the Safari combination that has thrown this bar's tabs off the
  side of the screen once already.
*/
export function glassStyle(finish = "INK", ink = "#14120E", tune = {}) {
  const f = resolveFinish(finish, tune);
  const shade = (a) => `rgba(${parseInt(ink.slice(1, 3), 16)},${parseInt(ink.slice(3, 5), 16)},${parseInt(ink.slice(5, 7), 16)},${a})`;
  return {
    background: f.tint,
    backdropFilter: f.backdrop,
    WebkitBackdropFilter: f.backdrop,
    boxShadow: [
      /*
        THE BOUNCE. A hairline of light along the INSIDE of the bottom edge —
        light thrown back up off whatever the glass is resting on. It is the
        cheapest possible detail and it does more for the illusion of a curved
        underside than any amount of blur: without it the bottom of the pane
        just stops, and a piece of glass never just stops.
      */
      `inset 0 -1px 0 ${f.bounce}`,
      `inset 0 -12px 20px -18px ${f.bounce}`,
      // the underside still has weight
      `inset 0 -18px 32px -26px ${shade(0.42)}`,
      // ambient: large, soft and low — never a hard drop shadow
      `0 2px 5px ${shade(0.07)}`,
      `0 14px 32px -12px ${shade(0.20)}`,
      `0 34px 60px -26px ${shade(0.28)}`,
    ].join(", "),
  };
}

/* The lip is a masked ring, so it follows any border-radius it is given. */
export function lipStyle(finish = "INK", tune = {}) {
  const f = resolveFinish(finish, tune);
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    /*
      Wider than a hairline. The lip is doing more work now that the pane
      itself is clearer — it is what separates the bar from the page when
      there is barely any tint left to do it.
    */
    padding: "1.6px",
    background: f.lip,
    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    maskComposite: "exclude",
  };
}

export function specStyle(finish = "INK", drift = 0, tune = {}) {
  const f = resolveFinish(finish, tune);
  return {
    position: "absolute",
    left: "6%",
    right: "6%",
    top: 0,
    height: f.specH,
    borderRadius: "inherit",
    background: f.spec,
    pointerEvents: "none",
    transform: `translate3d(${drift}px,0,0)`,
  };
}

/*
  The selection, as a lens rather than a hole.

  A solid block cut out of the glass was what made the old bar read as a
  website: the selected tab became a different material instead of a thicker
  piece of the same one.
*/
export function lozengeStyle(finish = "INK", tune = {}) {
  const f = resolveFinish(finish, tune);
  const dark = f.dark;
  /*
    The lens has to stay legible against its own pane, and the pane is now
    adjustable. On a nearly clear INK the old fixed .16 white vanished; it
    leans on the darkness so the selection keeps roughly the same contrast
    with the glass around it whatever the glass is set to.
  */
  const lift = dark ? 0.10 + 0.16 * (f.darkness / 100) : 0.52;
  return {
    background: `rgba(255,255,255,${lift.toFixed(3)})`,
    boxShadow: [
      `inset 0 0 0 .5px rgba(255,255,255,${dark ? ".40" : ".92"})`,
      `inset 0 1px 0 rgba(255,255,255,${dark ? ".48" : "1"})`,
      `inset 0 -6px 12px -10px rgba(20,18,14,${dark ? ".7" : ".25"})`,
      `0 1px 4px rgba(20,18,14,${dark ? ".30" : ".14"})`,
    ].join(", "),
  };
}
