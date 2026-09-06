import React from "react";
import { Link } from "react-router-dom";
import { fontDisplay, fontUtility, fontText, theme } from "./Shared";

/*
  ══ THE BLOCK KIT ═══════════════════════════════════════════════════════════

  What a page built in the console is made of, and the only thing that draws
  one. The live page, the preview and the builder all render THROUGH here — so
  what you arrange is what goes out, and none of the three can quietly stop
  agreeing with the other two.

  ── WHY BLOCKS AND NOT A CANVAS ────────────────────────────────────────────

  A canvas puts things at coordinates. A website is read at 375 pixels wide and
  at 2560, so coordinates chosen at one of those are wrong at the other, and a
  drag-anywhere builder either produces pages that break on a phone or needs a
  constraint system nobody wants to operate at two in the morning.

  Blocks stack. Each one knows how to be narrow and how to be wide, so a page
  laid out once works everywhere, and — the part that matters more — a page
  built in a hurry still looks like this site. The kit is the design system
  with handles on it: Bodoni for display, Garamond for reading, Space Mono for
  anything tracked, one accent, hairline rules, the paper stock. You cannot
  choose a typeface here and you cannot choose a colour, and that is the
  feature. A system with no edges is not a system.

  ── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────

  THERE IS NO HTML BLOCK. It is the first thing every builder like this grows
  and it is the thing that ends them: raw markup from a form is a script tag
  away from running on hiddenstategroup.com with the site's own privileges,
  and "only the team can reach it" is one borrowed laptop away from being
  false. Text is text and is rendered as paragraphs.

  EMBEDS ARE ALLOWLISTED BY HOSTNAME, not by pattern-matching a URL — the same
  four hosts the press kit allows, resolved the same way. An iframe pointing
  anywhere is the same hole as an HTML block wearing a hat.
*/

/*
  The four hosts a player may come from. Anything else is rendered as a plain
  link, which is a perfectly good outcome and a much better one than an iframe
  to somewhere nobody vetted.
*/
export function embedFor(raw) {
  const url = String(raw || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }

  if (host === "open.spotify.com") {
    return url.replace("open.spotify.com/", "open.spotify.com/embed/").split("?")[0];
  }
  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    return "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) +
           "&color=%236E2118&hide_related=true&show_comments=false&show_teaser=false";
  }
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
    let id = "";
    try {
      const u = new URL(url);
      id = host === "youtu.be" ? u.pathname.slice(1) : (u.searchParams.get("v") || "");
    } catch { return null; }
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = (url.match(/(\d{6,})/) || [])[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

/*
  THE KIT, as data rather than as a switch statement.

  The builder reads this to know what it can offer, what each block's fields
  are called and what an empty one looks like. Adding a block means adding it
  here and giving it a renderer below — two places, next to each other, rather
  than seven scattered through a form.
*/
export const BLOCKS = {
  heading: {
    label: "HEADING", blank: { text: "", size: "LARGE" },
    fields: [
      { k: "text", label: "The words" },
      { k: "size", label: "Size", options: ["LARGE", "MEDIUM", "SMALL"] },
    ],
  },
  text: {
    label: "TEXT", blank: { body: "" },
    fields: [{ k: "body", label: "The words", long: true,
               help: "A blank line starts a new paragraph." }],
  },
  photo: {
    label: "PHOTOGRAPH", blank: { src: "", caption: "", credit: "", width: "COLUMN" },
    fields: [
      { k: "src", label: "Image", image: true },
      { k: "caption", label: "Caption" },
      { k: "credit", label: "Credit" },
      { k: "width", label: "Width", options: ["COLUMN", "WIDE", "FULL"] },
    ],
  },
  quote: {
    label: "QUOTE", blank: { text: "", who: "" },
    fields: [
      { k: "text", label: "The quote", long: true },
      { k: "who", label: "Who said it" },
    ],
  },
  pair: {
    label: "TWO COLUMNS", blank: { leftTitle: "", leftBody: "", rightTitle: "", rightBody: "" },
    fields: [
      { k: "leftTitle", label: "Left heading" },
      { k: "leftBody", label: "Left words", long: true },
      { k: "rightTitle", label: "Right heading" },
      { k: "rightBody", label: "Right words", long: true },
    ],
  },
  index: {
    label: "AN INDEX", blank: { items: [] },
    fields: [{ k: "items", label: "Rows", pairs: true,
               help: "A term and a detail on each row — set times, credits, a specification." }],
  },
  gallery: {
    label: "GALLERY", blank: { images: [] },
    fields: [{ k: "images", label: "Images", images: true }],
  },
  embed: {
    label: "A PLAYER", blank: { url: "", label: "" },
    fields: [
      { k: "url", label: "Link", help: "Spotify, SoundCloud, YouTube or Vimeo. Anything else becomes a link." },
      { k: "label", label: "Label above it" },
    ],
  },
  buttons: {
    label: "BUTTONS", blank: { items: [] },
    fields: [{ k: "items", label: "Buttons", pairs: true, termLabel: "Label", detailLabel: "Link" }],
  },
  rule: {
    label: "A RULE", blank: { style: "DOUBLE" },
    fields: [{ k: "style", label: "Style", options: ["DOUBLE", "SINGLE"] }],
  },
  space: {
    label: "SPACE", blank: { size: "MEDIUM" },
    fields: [{ k: "size", label: "How much", options: ["SMALL", "MEDIUM", "LARGE"] }],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

/* Paragraphs from a blank-line-separated string. Text, never markup. */
const paragraphs = (body) =>
  String(body || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

const WIDTHS = { COLUMN: "760px", WIDE: "1080px", FULL: "100%" };

function One({ block }) {
  const b = block || {};
  switch (b.type) {
    case "heading": {
      const size = b.size === "SMALL" ? "clamp(20px,3.4vw,26px)"
                 : b.size === "MEDIUM" ? "clamp(26px,4.6vw,38px)"
                 : "clamp(32px,6vw,54px)";
      return (
        <h2 className="m-0" style={{ ...fontDisplay, fontWeight: 400, fontSize: size,
              lineHeight: 1.04, letterSpacing: "-0.02em", color: theme.ink,
              textWrap: "balance", marginTop: "12px" }}>
          {b.text}
        </h2>
      );
    }

    case "text":
      return (
        <div>
          {paragraphs(b.body).map((p, i) => (
            <p key={i} className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6,
                  color: theme.ink2, marginTop: i ? "1em" : 0 }}>
              {p}
            </p>
          ))}
        </div>
      );

    case "photo":
      return (
        <figure className="m-0">
          {b.src
            ? <img src={b.src} alt={b.caption || ""} loading="lazy"
                   style={{ width: "100%", display: "block", border: `1px solid ${theme.rule}` }} />
            : <div style={{ width: "100%", aspectRatio: "3 / 2", background: theme.sunk,
                            border: `1px dashed ${theme.rule}` }} aria-hidden="true" />}
          {(b.caption || b.credit) && (
            <figcaption className="mt-2 flex flex-wrap items-baseline" style={{ gap: "10px" }}>
              {b.caption && (
                <span style={{ ...fontText, fontSize: "14.5px", color: theme.ink2 }}>{b.caption}</span>
              )}
              {b.credit && (
                <span style={{ ...fontUtility, fontSize: "7.5px", letterSpacing: "0.14em",
                               color: theme.ink2 }}>© {b.credit.toUpperCase()}</span>
              )}
            </figcaption>
          )}
        </figure>
      );

    case "quote":
      return (
        <blockquote className="m-0" style={{ borderLeft: `2px solid ${theme.brass}`,
              paddingLeft: "20px" }}>
          <p className="m-0" style={{ ...fontDisplay, fontWeight: 400,
                fontSize: "clamp(20px,3.2vw,28px)", lineHeight: 1.28, color: theme.ink,
                fontStyle: "italic" }}>
            {b.text}
          </p>
          {b.who && (
            <p className="m-0 mt-2.5" style={{ ...fontUtility, fontSize: "8px",
                  letterSpacing: "0.2em", color: theme.brass }}>
              {String(b.who).toUpperCase()}
            </p>
          )}
        </blockquote>
      );

    case "pair":
      return (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "28px" }}>
          {[["leftTitle", "leftBody"], ["rightTitle", "rightBody"]].map(([t, y]) => (
            <div key={t}>
              {b[t] && (
                <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "8.5px",
                      letterSpacing: "0.2em", color: theme.brass,
                      borderBottom: `1px solid ${theme.rule}`, paddingBottom: "6px" }}>
                  {String(b[t]).toUpperCase()}
                </p>
              )}
              {paragraphs(b[y]).map((p, i) => (
                <p key={i} className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55,
                      color: theme.ink2, marginTop: i ? "1em" : 0 }}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      );

    case "index":
      return (
        <div>
          {(b.items || []).map((row, i) => (
            <div key={i} className="flex items-baseline gap-4 py-2.5"
                 style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                    color: theme.ink, minWidth: "34%" }}>
                {String(row.term || "").toUpperCase()}
              </span>
              <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
                {row.detail}
              </span>
            </div>
          ))}
        </div>
      );

    case "gallery":
      return (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "10px" }}>
          {(b.images || []).map((im, i) => (
            <figure key={i} className="m-0">
              <img src={im.src} alt={im.caption || ""} loading="lazy"
                   style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block",
                            border: `1px solid ${theme.rule}` }} />
              {im.caption && (
                <figcaption className="mt-1" style={{ ...fontUtility, fontSize: "7px",
                      letterSpacing: "0.14em", color: theme.ink2 }}>
                  {String(im.caption).toUpperCase()}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      );

    case "embed": {
      const src = embedFor(b.url);
      if (!src) {
        return b.url ? (
          <a href={b.url} target="_blank" rel="noreferrer noopener"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                      padding: "12px 16px", border: `1px solid ${theme.ink}`,
                      color: theme.ink, textDecoration: "none", display: "inline-block" }}>
            {(b.label || "LISTEN").toUpperCase()} ↗
          </a>
        ) : null;
      }
      return (
        <div>
          {b.label && (
            <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "8.5px",
                  letterSpacing: "0.16em", color: theme.brass }}>
              {String(b.label).toUpperCase()}
            </p>
          )}
          <iframe src={src} title={b.label || "Player"} loading="lazy"
                  allow="encrypted-media; clipboard-write; picture-in-picture"
                  style={{ width: "100%", height: "352px", border: `1px solid ${theme.rule}` }} />
        </div>
      );
    }

    case "buttons":
      return (
        <div className="flex flex-wrap" style={{ gap: "8px" }}>
          {(b.items || []).map((it, i) => {
            const href = String(it.detail || "");
            const inside = href.startsWith("/");
            const style = { ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                            padding: "12px 18px", border: `1px solid ${theme.ink}`,
                            color: theme.ink, textDecoration: "none", display: "inline-block" };
            // An internal link must not reload the whole application.
            return inside
              ? <Link key={i} to={href} style={style}>{String(it.term || "").toUpperCase()}</Link>
              : <a key={i} href={href} target="_blank" rel="noreferrer noopener" style={style}>
                  {String(it.term || "").toUpperCase()} ↗
                </a>;
          })}
        </div>
      );

    case "rule":
      return b.style === "SINGLE"
        ? <div style={{ borderTop: `1px solid ${theme.rule}` }} />
        : <div>
            <div style={{ borderTop: `2px solid ${theme.ink}` }} />
            <div style={{ borderTop: `1px solid ${theme.ink}`, marginTop: "2px" }} />
          </div>;

    case "space":
      return <div style={{ height: b.size === "SMALL" ? "16px" : b.size === "LARGE" ? "72px" : "40px" }} />;

    default:
      return null;
  }
}

/*
  A whole page's worth.

  Each block gets its own measure: reading text is held near 65 characters
  however wide the screen is, while a full-bleed photograph is allowed the
  whole width. Letting the container decide one width for everything is what
  makes a built page read as a document rather than as a page.
*/
export default function Blocks({ blocks, gap = "26px" }) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return null;
  return (
    <div className="flex flex-col" style={{ gap }}>
      {list.map((b, i) => {
        const width = b?.type === "photo" || b?.type === "gallery"
          ? WIDTHS[b.width] || WIDTHS.COLUMN
          : b?.type === "pair" ? WIDTHS.WIDE
          : WIDTHS.COLUMN;
        return (
          <div key={i} className="w-full mx-auto" style={{ maxWidth: width }}>
            <One block={b} />
          </div>
        );
      })}
    </div>
  );
}
