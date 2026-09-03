import { theme } from "../lib/theme";
import React, { useEffect, useRef, useState } from "react";
import SETS from "../content/imagesets.json";
import { useSite } from "../lib/site";

/*
  Img — one image component so every picture behaves the same.

    srcset      Two widths exist on disk (full and -sm). The browser picks,
                so a phone downloads the 700px file, not the 1400px one.
    fade-in     Photos fade up from the paper tone rather than snapping in.
    transparent Logos never get a placeholder backing behind them.

  THE CACHED-IMAGE TRAP. An earlier version faded in using `opacity: loaded`,
  where `loaded` was set only by the onLoad event. When an image was already
  in the browser cache it finished loading BEFORE React attached that handler,
  so onLoad never fired and the picture stayed at opacity 0 — invisible, with
  no error anywhere. That is why the logo vanished.

  The fix is to also check `img.complete` on mount, which is true for anything
  already cached. Belt and braces: the ref check catches the cached case, the
  onLoad handler catches the normal one.
*/

export default function Img({
  src,
  alt = "",
  className = "",
  style = {},
  eager = false,
  transparent = false,
  sizes = "(min-width: 768px) 900px, 100vw",
  ...rest
}) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const site = useSite();
  // Off, a photograph simply appears — no develop, no fade, nothing to wait
  // for. The attribute is dropped entirely rather than set to a still state,
  // so there is no transition left to run.
  const develops = site.motionDevelop !== false;

  useEffect(() => {
    // Already decoded before React got here? Then show it immediately.
    if (ref.current && ref.current.complete) setLoaded(true);
  }, [src]);

  const isTransparent =
    transparent || (src || "").endsWith(".png") || (src || "").endsWith(".svg");

  const placeholder = isTransparent
    ? "transparent"
    : style["background"] || style["backgroundColor"] || theme.sunk;

  /*
    WHICH WIDTHS EXIST.

    `imagesets.json` is written by scripts/images.mjs and lists, per picture,
    the widths that were actually produced. Reading it rather than guessing is
    what makes the AVIF markup safe: an image the script has not been run over
    has no entry, gets the old two-file behaviour, and cannot end up pointing
    at a file that was never made.

    The old `-sm` pair had a second problem beyond being hand-made. The
    browser was told "700w" and "1400w" but never how wide the picture would
    be ON THE PAGE, so it had to assume the full viewport and generally chose
    the larger file anyway. The `sizes` attribute is what turns a srcset from
    a suggestion into a decision.
  */
  const set = SETS[src];
  const widths = set?.w || [];
  const srcsetFor = (ext) => widths.map((w) => `${set.base}-${w}.${ext} ${w}w`).join(", ");

  const small = !set && src && src.endsWith(".webp") ? src.replace(".webp", "-sm.webp") : null;

  const img = (
    <img
      ref={ref}
      src={src}
      srcSet={set ? srcsetFor("webp") : small ? `${small} 700w, ${src} 1400w` : undefined}
      sizes={set || small ? sizes : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchpriority={eager ? "high" : undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      data-transparent={isTransparent ? "" : undefined}
      /*
        DEVELOPING, not fading.

        A photograph used to fade up from the paper tone, which is a website's
        idea of a picture arriving. This is a print's: it comes up flat and
        overexposed and resolves into full tone, the way a sheet does in a
        tray. The two states are in the stylesheet so the timing lives with
        the rest of the site's motion rather than in this file.

        Logos are exempt. A wordmark that sepia-tones itself on the way in
        looks like a rendering fault, not a flourish.
      */
      data-develop={isTransparent || !develops ? undefined : (loaded ? "dry" : "wet")}
      className={className}
      style={{
        ...style,
        backgroundColor: placeholder,
        ...(isTransparent
          ? { opacity: loaded ? 1 : 0, transition: "opacity 420ms ease" }
          : null),
      }}
      {...rest}
    />
  );

  /*
    AVIF first, WebP second, and the browser takes the first it understands.
    No detection, no JavaScript, no flash of the wrong one — <picture> is one
    of the few things in a browser that does exactly what it says.

    A logo is never wrapped: transparent artwork gains nothing from AVIF here
    and the extra element only complicates the layout around it.
  */
  if (!set || isTransparent) return img;

  return (
    <picture>
      <source type="image/avif" srcSet={srcsetFor("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcsetFor("webp")} sizes={sizes} />
      {img}
    </picture>
  );
}
