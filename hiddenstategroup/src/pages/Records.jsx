import { usePageMeta, useAlbumSchema } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React from "react";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
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

export default function Records() {
  useGoogleFonts();
  const { t } = useLang();
  useAlbumSchema(ALBUMS[0]);  // richest release gets the markup
  usePageMeta({ title: "Records", description: "Releases on Hidden State Records." });
  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <section className="max-w-[1180px] mx-auto px-[18px] pt-[104px] text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          {t("theRecords")}
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <p className="mt-3 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
          {t("recordsSub")}
        </p>
        <p className="mt-2.5 mb-0">
          <Instagram account={SOCIAL.records} size="10.5px" />
        </p>
      </section>

      {ALBUMS.map((a) => <Album key={a.slug} a={a} />)}

      <p className="text-center pb-16 pt-4 m-0 max-w-[1180px] mx-auto px-[18px]"
         style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
        More releases coming.
      </p>

      <Footer />
    </div>
  );
}
