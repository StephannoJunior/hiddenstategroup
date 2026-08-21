import React, { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    // Already decoded before React got here? Then show it immediately.
    if (ref.current && ref.current.complete) setLoaded(true);
  }, [src]);

  const isTransparent =
    transparent || (src || "").endsWith(".png") || (src || "").endsWith(".svg");

  const placeholder = isTransparent
    ? "transparent"
    : style["background"] || style["backgroundColor"] || "#E8DEC7";

  const small = src && src.endsWith(".webp") ? src.replace(".webp", "-sm.webp") : null;

  return (
    <img
      ref={ref}
      src={src}
      srcSet={small ? `${small} 700w, ${src} 1400w` : undefined}
      sizes={small ? sizes : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchpriority={eager ? "high" : undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      data-transparent={isTransparent ? "" : undefined}
      className={className}
      style={{
        ...style,
        backgroundColor: placeholder,
        opacity: loaded ? 1 : 0,
        transition: "opacity 420ms ease",
      }}
      {...rest}
    />
  );
}
