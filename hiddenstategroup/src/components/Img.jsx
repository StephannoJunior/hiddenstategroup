import React, { useState } from "react";

/*
  Img — one image component so every picture on the site behaves the same.

  What it handles:

    srcset      Two widths of each photo exist on disk (full and -sm). The
                browser picks based on the device, so a phone downloads the
                700px file instead of the 1400px one. This is the single
                biggest saving on mobile data.

    fade-in     Photos arrive by fading up from the paper colour rather than
                snapping in over a grey box. Small thing; makes scrolling feel
                considerably calmer.

    dimensions  width and height are passed through so the browser reserves
                the right space before the file arrives, which stops the page
                jumping as images load.
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
  const [loaded, setLoaded] = useState(false);
  // Logos are transparent PNGs. A placeholder tone behind one shows up as a
  // visible rectangle, so only photographs get the paper-coloured backing
  // while they decode. `transparent` also opts any image out by hand.
  const isTransparent = transparent || (src || "").endsWith(".png") || (src || "").endsWith(".svg");
  const placeholder = isTransparent
    ? "transparent"
    : style["background"] || style["backgroundColor"] || "#E8DEC7";

  // The small variant sits beside the original with a -sm suffix. If it was
  // never generated (small images, logos) we simply don't offer a srcset.
  const small = src && src.endsWith(".webp") ? src.replace(".webp", "-sm.webp") : null;

  return (
    <img
      src={src}
      srcSet={small ? `${small} 700w, ${src} 1400w` : undefined}
      sizes={small ? sizes : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchpriority={eager ? "high" : undefined}
      onLoad={() => setLoaded(true)}
      data-transparent={isTransparent ? "" : undefined}
      className={className}
      style={{
        // caller styles first, so ours win where they must
        ...style,
        // a shorthand `background` from the caller would otherwise clobber the
        // placeholder tone, so resolve it here rather than let order decide
        backgroundColor: placeholder,
        opacity: loaded ? 1 : 0,
        transition: "opacity 420ms ease",
      }}
      {...rest}
    />
  );
}
