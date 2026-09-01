import { usePageMeta, useEventSchema } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  DetailHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { EVENTS } from "../lib/data";
import Gallery from "../components/Gallery";
import Countdown from "../components/Countdown";
import { SOCIAL } from "../lib/social";

export default function EventDetail() {
  useGoogleFonts();
  const { t } = useLang();
  const { id } = useParams();
  const e = EVENTS.find((x) => String(x.id) === id || x.slug === id);
  usePageMeta({
    title: e ? `${e.name}${e.subtitle ? " — " + e.subtitle : ""}` : "Event",
    description: e ? e.description : "Hidden State events.",
    image: e ? e.artwork : null,
    type: "article",
  });
  useEventSchema(e);

  if (!e) {
    return (
      <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
        <section className="max-w-[1180px] mx-auto px-[18px] pt-[140px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(28px,6vw,44px)" }}>
            We couldn't find that event.
          </h1>
          <Link to="/events" className="inline-flex items-center gap-2 mt-6 pb-1"
                style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.brass,
                         borderBottom: "1px solid " + theme.brass }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK TO EVENTS
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  const past = e.status === "past";
  const place = [e.venue, e.city, e.country].filter(Boolean).join(" · ");

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <DetailHead
        items={[
          { label: "STATUS", value: past ? "PAST EVENT" : "UPCOMING" },
          { label: "DATE", value: (e.date || "TBA").toUpperCase() },
          ...(place ? [{ label: "WHERE", value: place.toUpperCase() }] : []),
        ]}
        image={e.artwork}
        meta={past ? "FROM THE ARCHIVE" : "UPCOMING"}
        title={e.name}
        sub={e.subtitle}
        backTo="/events" backLabel="ALL EVENTS" />

      <article className="max-w-[900px] mx-auto px-[18px] pt-8 pb-16">
        {!e.artwork && (
          <div className="flex flex-col items-center justify-center text-center px-5 py-16"
               style={{ background: theme.ink, color: theme.bg }}>
            <span style={{ ...fontUtility, fontSize: "15px", letterSpacing: "0.32em" }}>
              {e.name.split(" ")[0].toUpperCase()}
            </span>
            <span className="mt-1.5" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.44em", opacity: 0.75 }}>
              {e.name.split(" ").slice(1).join(" ").toUpperCase()}
            </span>
            <span className="block my-4" style={{ width: "120px", borderTop: "1px solid " + theme.bg, opacity: 0.4 }} />
            <span style={{ ...fontDisplay, fontStyle: "italic", fontSize: "24px" }}>{e.subtitle}</span>
            <span className="mt-4" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", opacity: 0.8 }}>
              {e.date}
            </span>
          </div>
        )}

        <div className="md:columns-2 md:gap-x-9 mt-6"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          <p className="mt-0 mb-3.5 hs-drop">{e.description}</p>
        </div>

        {e.facts && e.facts.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 mt-8 py-4"
               style={{ borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
            {e.facts.map((f) => (
              <span key={f} style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink }}>{f}</span>
            ))}
          </div>
        )}

        {e.lineup && e.lineup.length > 0 && (
          <div className="mt-8">
            <p className="text-center m-0 mb-3"
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.26em", color: theme.brass }}>
              {e.lineupLabel || "\u2014 HIDDEN STATE ON THE BILL \u2014"}
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5">
              {e.lineup.map((n) => (
                <span key={n} style={{ ...fontDisplay, fontSize: "22px", color: theme.ink }}>{n}</span>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-9">
          {e.tickets ? (
            <a href={e.tickets} target="_blank" rel="noopener noreferrer" className="inline-block px-10 py-3.5"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
              {t("getTickets")}
            </a>
          ) : !past ? (
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: theme.ink2 }}>
              {t("ticketsSoon")}
            </p>
          ) : null}
          {e.instagram && SOCIAL[e.instagram] && (
            <p className="mt-4 mb-0">
              <Instagram account={SOCIAL[e.instagram]} size="10.5px" />
            </p>
          )}
          {e.article && (
            <p className="mt-4 mb-0">
              <Link to={`/news/${e.article}`} className="pb-0.5"
                    style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: theme.ink2,
                             borderBottom: "1px solid " + theme.rule }}>
                {t("readFullStory")}
              </Link>
            </p>
          )}
          {e.website && (
            <p className="mt-4 mb-0">
              <a href={e.website} target="_blank" rel="noopener noreferrer" className="pb-0.5"
                 style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: theme.ink2,
                          borderBottom: "1px solid " + theme.rule }}>
                FESTIVAL WEBSITE
              </a>
            </p>
          )}
        </div>

        {!past && e.countdownTo && (
          <div className="mt-9">
            <Countdown target={e.countdownTo} label={t("countdownTo")} compact />
          </div>
        )}

        {e.tagline && (
          <p className="text-center mt-7 m-0"
             style={{ ...fontDisplay, fontStyle: "italic", fontSize: "21px", color: theme.ink }}>
            {e.tagline}
          </p>
        )}

        {e.gallery && e.gallery.length > 0 && (
          <Gallery photos={e.gallery} prefix={e.slug || "hidden-state"} />
        )}

        {e.photosLink && (
          <p className="text-center mt-6 m-0">
            <a href={e.photosLink} target="_blank" rel="noopener noreferrer"
               className="inline-block px-9 py-3.5"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                        background: theme.ink, color: theme.bg }}>
              {e.photosLinkLabel || "ALL PHOTOS"}
            </a>
          </p>
        )}

      </article>

      <Footer />
    </div>
  );
}
