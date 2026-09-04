import { usePageMeta, useAlbumSchema } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  PageHead, IndexBand, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { ALBUMS, watchUrl } from "../lib/records";
import { SOCIAL } from "../lib/social";

function Album({ a }) {
  const { t } = useLang();
  return (
    <section className="max-w-[1180px] mx-auto px-[18px] pb-6">
      <div className="grid md:grid-cols-[360px_1fr] gap-6 md:gap-10 items-start py-8">
        <Img src={a.cover} alt={a.title} className="w-full block" style={{ background: theme.raised }} />
        <div>
          <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            {a.kind}{a.catalog ? ` · ${a.catalog}` : ""}{a.releaseDate ? ` · ${a.releaseDate}` : ""}
          </p>
          <h2 className="mt-2 mb-1" style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(30px,7vw,52px)", lineHeight: 1.06 }}>
            {a.title}
          </h2>
          <p className="m-0" style={{ ...fontDisplay, fontStyle: "italic", fontSize: "21px", color: theme.brass }}>
            {a.artist}
          </p>
          {a.tagline && (
            <p className="mt-2 mb-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink2 }}>
              {a.tagline.toUpperCase()}
            </p>
          )}
          {a.note && (
            <p className="mt-4 mb-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6, color: theme.ink2 }}>
              {a.note}
            </p>
          )}
          {a.playlist && (
            <a href={a.playlist} target="_blank" rel="noopener noreferrer"
               className="inline-block mt-5 px-8 py-3.5"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
              {a.kind === "SINGLE" ? t("listen") : t("playAlbum")}
            </a>
          )}

          <ReleaseLinks slug={a.slug} releaseDate={a.releaseDate} />
        </div>
      </div>

      <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        {t("tracklist")}
      </p>
      <div style={{ borderTop: "1px solid " + theme.ink }}>
        {a.tracks.map((t) => (
          <a key={t.n} href={watchUrl(t.youtube)} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-4 py-3.5"
             style={{ borderBottom: "1px solid " + theme.rule }}>
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color: theme.ink2, width: "22px" }}>
              {String(t.n).padStart(2, "0")}
            </span>
            <Img src={t.cover} alt={`${t.title} — cover`} className="block"
                 style={{ width: "56px", height: "56px", objectFit: "cover", background: theme.raised }} />
            <span className="flex-1" style={{ ...fontDisplay, fontSize: "21px", color: theme.ink }}>
              {t.title}
            </span>
            <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: theme.brass, whiteSpace: "nowrap" }}>
              LISTEN →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/*
  ── L03 · WHERE A RECORD LIVES ──────────────────────────────────────────────

  Every platform a release is on, so a bio link can point at one page instead
  of at whichever service we happen to prefer this month.

  RELEASE DAY HAPPENS BY ITSELF. Rows marked `presave` show before the release
  date and disappear after it; ordinary rows do the opposite. The switch is the
  date already on the record, so nobody has to be awake at midnight to change a
  page, and nobody has to remember a week later that they never did.

  THE COMPARISON IS DONE IN LOCAL TIME, deliberately. A release is "out" when
  it is the release date where the reader is, which is what every streaming
  service does and what everybody expects. Comparing in UTC would show a
  listener in Bucharest a pre-save button for two hours after their friends had
  already heard it.

  Loaded per record rather than with the page. There is nothing to show for
  most releases, and a failed request leaves the section absent rather than
  broken — this is an addition to a page that already works.
*/
function ReleaseLinks({ slug, releaseDate }) {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api.listReleaseLinks(slug)
      .then((res) => { if (alive && res.ok) setLinks(res.links || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  if (!links.length) return null;

  const out = (() => {
    if (!releaseDate) return true;                 // no date on file: treat as out
    const when = new Date(releaseDate);
    if (Number.isNaN(when.getTime())) return true; // "Spring 2026" is not a date
    // Midnight local on the release date.
    return Date.now() >= new Date(
      when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  })();

  const shown = links.filter((l) => (out ? !l.presave : !!l.presave));
  if (!shown.length) return null;

  return (
    <div className="mt-6">
      <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
        {out ? "LISTEN EVERYWHERE" : "SAVE IT FOR RELEASE DAY"}
      </p>
      <div className="flex flex-wrap gap-2">
        {shown.map((l) => (
          <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
             className="inline-block px-5 py-3"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em",
                      color: theme.ink, border: `1px solid ${theme.ink}`,
                      textDecoration: "none" }}>
            {l.label.toUpperCase()} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Records() {
  useGoogleFonts();
  const { t } = useLang();
  useAlbumSchema(ALBUMS[0]);  // richest release gets the markup
  usePageMeta({ title: "Records", description: "Releases on Hidden State Records." });
  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
            <IndexBand top items={[
        { label: "CATALOGUE", value: ALBUMS[0] ? ALBUMS[0].catalog + " \u2014" : "\u2014" },
        { label: "RELEASES", value: String(ALBUMS.length).padStart(2, "0") },
        { label: "TRACKS", value: String(ALBUMS.reduce((n, a) => n + a.tracks.length, 0)).padStart(2, "0") },
        { label: "GENRE", value: "AFRO HOUSE / TECH" },
      ]} />
      <PageHead flush kicker="THE LABEL" title={t("theRecords")} sub={t("recordsSub")} />

      {ALBUMS.map((a) => <Album key={a.slug} a={a} />)}

      <p className="text-center pb-16 pt-4 m-0 max-w-[1180px] mx-auto px-[18px]"
         style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
        More releases coming.
      </p>

      <Footer />
    </div>
  );
}
