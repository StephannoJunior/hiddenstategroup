import { usePageMeta, useArtistSchema } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts, BookingDrawer, Instagram,
  DetailHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { ARTISTS, useArtists } from "../lib/data";
import { SOCIAL } from "../lib/social";
import { MIX_ARTISTS } from "../lib/mixes";

export default function ArtistProfile() {
  useGoogleFonts();
  const { t } = useLang();
  const artists = useArtists();
  const { id } = useParams();
  const [drawer, setDrawer] = useState(false);
  const a = artists.find((x) => String(x.id) === id);
  useArtistSchema(a);
  usePageMeta({ title: a ? (a.alias ? `${a.name} — ${a.alias}` : a.name) : "Artist", description: a ? a.bio.slice(0, 155) : "Hidden State roster.", image: a ? a.photo : null, type: "profile" });

  if (!a) {
    return (
      <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
        <section className="max-w-[1180px] mx-auto px-[18px] pt-[140px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(28px,6vw,44px)" }}>
            We couldn't find that artist.
          </h1>
          <Link to="/artists" className="inline-flex items-center gap-2 mt-6 pb-1"
                style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.brass,
                         borderBottom: "1px solid " + theme.brass }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK TO THE ROSTER
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <DetailHead
        items={[
          { label: "DISCIPLINE", value: (a.type || "ARTIST").toUpperCase() },
          { label: "SOUND", value: a.genres[0].toUpperCase() },
          ...(a.location ? [{ label: "BASED", value: a.location.toUpperCase() }] : []),
        ]}
        image={a.photo}
        meta={a.genres.join(" · ").toUpperCase()}
        title={a.name}
        sub={a.alias}
        backTo="/artists" backLabel="THE ROSTER" />

      <article className="max-w-[900px] mx-auto px-[18px] pt-8 pb-16">

        <div className="md:columns-2 md:gap-x-9 mt-6"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          <p className="mt-0 mb-3.5 hs-drop">{a.bio}</p>
        </div>

        {a.poster && (
          <figure className="m-0 mt-8">
            <Img src={a.poster} alt={a.name} className="w-full block"
                 style={{ background: theme.raised, border: "1px solid " + theme.rule }} />
            <figcaption className="pt-1.5 mt-1.5"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2,
                       borderTop: "1px solid " + theme.rule }}>
              {t("printedIssue")}
            </figcaption>
          </figure>
        )}

        {a.upcoming && a.upcoming.length > 0 && (
          <div className="mt-8 pt-5" style={{ borderTop: "1px solid " + theme.ink }}>
            <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              UPCOMING
            </p>
            {a.upcoming.map((e, i) => (
              <div key={i} className="flex justify-between items-baseline gap-4 py-2.5"
                   style={{ borderTop: i ? "1px solid " + theme.rule : undefined }}>
                <span>
                  <span className="block" style={{ ...fontDisplay, fontSize: "19px", color: theme.ink }}>{e.name}</span>
                  <span className="block" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                    {e.venue}
                  </span>
                </span>
                <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color: theme.ink2, whiteSpace: "nowrap" }}>
                  {e.date}
                </span>
              </div>
            ))}
          </div>
        )}

        {MIX_ARTISTS.some((m) => m.artistId === a.id) && (
          <p className="text-center mt-8 m-0">
            <Link to={`/mixes/${MIX_ARTISTS.find((m) => m.artistId === a.id).slug}`} className="pb-0.5"
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                           borderBottom: "1px solid " + theme.brass }}>
              SESSIONS &amp; RADIO
            </Link>
          </p>
        )}

        <div className="text-center mt-9">
          <button onClick={() => setDrawer(true)} className="inline-block px-10 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
            BOOK {a.name.toUpperCase()}
          </button>
        </div>

        {a.instagram && SOCIAL[a.instagram] && (
          <p className="text-center mt-6 m-0">
            <Instagram account={SOCIAL[a.instagram]} size="11px" />
          </p>
        )}
      </article>

      <Footer />
      <BookingDrawer open={drawer} onClose={() => setDrawer(false)} artist={a} />
    </div>
  );
}
