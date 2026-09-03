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

export class Spring {
  constructor(value, { stiffness = 240, damping = 27, mass = 1 } = {}) {
    this.v = value; this.target = value; this.vel = 0;
    this.k = stiffness; this.c = damping; this.m = mass;
  }
  to(target) { this.target = target; }
  set(value) { this.v = this.target = value; this.vel = 0; }
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
    */
    const steps = Math.min(5, Math.max(1, Math.ceil(dt / 0.008)));
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

  Returns a controller with `to`, `set` and `stop`.
*/
export function driveSprings(springs, write, isStill) {
  let raf = null, last = 0;

  const frame = (now) => {
    const dt = Math.min(0.032, (now - (last || now)) / 1000);
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
    kick,
    stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; },
  };
}

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
*/
const FINISHES = {
  /*
    CLEARER THAN BEFORE, ON PURPOSE.

    The first version squeezed the backdrop hard — contrast(.55) — which made
    everything behind it grey and safe and, frankly, a bit muddy. The squeeze
    is what keeps text legible, so it cannot go entirely; but it was doing far
    more work than it needed to, and it was killing the colour that makes
    glass look like glass rather than like tracing paper.

    So the squeeze is lighter and the SATURATION is much higher. More of what
    is behind survives, and it survives in colour. Legibility is bought back
    by the rim instead: a brighter, wider lip and a bounce along the bottom
    edge, which is where a real curved surface catches light thrown up off
    whatever it is sitting on.
  */
  LENS: {
    tint: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05) 55%, rgba(255,255,255,.12))",
    backdrop: "blur(26px) saturate(235%) contrast(.82) brightness(1.06)",
    lip: "linear-gradient(146deg, rgba(255,250,240,1) 0%, rgba(255,255,255,.46) 22%, " +
         "rgba(255,255,255,.10) 44%, rgba(140,175,225,.26) 62%, " +
         "rgba(232,244,255,.82) 88%, rgba(255,255,255,.95) 100%)",
    spec: "radial-gradient(130% 110% at 50% -10%, rgba(255,255,255,.62), rgba(255,255,255,.10) 52%, rgba(255,255,255,0) 76%)",
    specH: "52%",
    bounce: "rgba(255,255,255,.55)",
  },
  CLEAR: {
    tint: "rgba(255,255,255,.06)",
    backdrop: "blur(30px) saturate(260%) contrast(.92) brightness(1.10)",
    lip: "linear-gradient(146deg, rgba(255,252,246,1) 0%, rgba(255,255,255,.55) 20%, " +
         "rgba(255,255,255,.12) 42%, rgba(150,180,225,.30) 60%, " +
         "rgba(238,247,255,.9) 86%, rgba(255,255,255,1) 100%)",
    spec: "radial-gradient(130% 110% at 50% -10%, rgba(255,255,255,.72), rgba(255,255,255,.12) 50%, rgba(255,255,255,0) 76%)",
    specH: "56%",
    bounce: "rgba(255,255,255,.72)",
  },
  INK: {
    /*
      DARK ENOUGH TO BE A DECISION.

      At a .20–.38 tint over warm stock this came out olive — the page dimmed
      rather than a dark bar laid over it, which is the difference between
      glass and a smudge. Over cream, a light touch does not read as INK at
      all; it reads as somebody turned the brightness down on a stripe.

      So the tint is heavy and the backdrop is genuinely darkened. It is still
      translucent — bright things behind it still show through, which is the
      whole point — but the bar is now unmistakably its own object rather than
      a discoloured piece of the page.
    */
    tint: "linear-gradient(180deg, rgba(26,23,18,.60), rgba(10,9,7,.76))",
    backdrop: "blur(30px) saturate(165%) contrast(.92) brightness(.60)",
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
  The base style for the pane itself.

  NOTE what is deliberately absent: no border, and no `transform`. A border
  competes with the lip; a transform on an element that also clips and has a
  radius is the Safari combination that has thrown this bar's tabs off the
  side of the screen once already.
*/
export function glassStyle(finish = "INK", ink = "#14120E") {
  const f = FINISHES[finish] || FINISHES.LENS;
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
export function lipStyle(finish = "INK") {
  const f = FINISHES[finish] || FINISHES.LENS;
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

export function specStyle(finish = "INK", drift = 0) {
  const f = FINISHES[finish] || FINISHES.LENS;
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
export function lozengeStyle(finish = "INK") {
  const dark = finish === "INK";
  return {
    background: dark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.52)",
    boxShadow: [
      `inset 0 0 0 .5px rgba(255,255,255,${dark ? ".40" : ".92"})`,
      `inset 0 1px 0 rgba(255,255,255,${dark ? ".48" : "1"})`,
      `inset 0 -6px 12px -10px rgba(20,18,14,${dark ? ".7" : ".25"})`,
      `0 1px 4px rgba(20,18,14,${dark ? ".30" : ".14"})`,
    ].join(", "),
  };
}
