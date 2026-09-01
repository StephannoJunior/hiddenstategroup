import { usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import { useSite } from "../lib/site";
import React from "react";
import { Link } from "react-router-dom";
import {
  Nothing,
  Nav, Footer, useGoogleFonts,
  PageHead, IndexBand, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { EVENTS, EVENTS_NOTE } from "../lib/data";

// Shown when an event has no artwork yet — set in type rather than a broken image.
function EventPlate({ e, big = false }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center text-center px-4"
         style={{ background: theme.ink, color: theme.bg, aspectRatio: "1 / 1" }}>
      <span style={{ ...fontUtility, fontSize: big ? "13px" : "10px", letterSpacing: "0.3em" }}>
        {e.name.split(" ")[0].toUpperCase()}
      </span>
      <span className="mt-1" style={{ ...fontUtility, fontSize: big ? "10px" : "8px", letterSpacing: "0.42em", opacity: 0.75 }}>
        {e.name.split(" ").slice(1).join(" ").toUpperCase()}
      </span>
      <span className="block my-3" style={{ width: "42%", borderTop: "1px solid " + theme.bg, opacity: 0.4 }} />
      <span style={{ ...fontDisplay, fontStyle: "italic", fontSize: big ? "22px" : "16px" }}>{e.subtitle}</span>
      <span className="mt-3" style={{ ...fontUtility, fontSize: big ? "10px" : "8.5px", letterSpacing: "0.2em", opacity: 0.8 }}>
        {e.date}
      </span>
    </div>
  );
}

function Card({ e }) {
  const { t } = useLang();
  const past = e.status === "past";
  return (
    <Link to={`/events/${e.id}`} className="block">
      <article className="grid md:grid-cols-[300px_1fr] gap-5 md:gap-8 py-8"
               style={{ borderBottom: "1px solid " + theme.rule }}>
        {e.artwork ? (
          <Img src={e.artwork} alt={`${e.name} — artwork`} className="w-full block"
               style={{ background: theme.raised, filter: past ? "grayscale(55%)" : "none" }} />
        ) : (
          <EventPlate e={e} />
        )}
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1"
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em" }}>
            <span style={{ color: past ? theme.ink2 : theme.brass }}>{past ? "PAST EVENT" : "UPCOMING"}</span>
            <span style={{ color: theme.ink2 }}>{e.date}</span>
            {e.country && <span style={{ color: theme.ink2 }}>{e.country.toUpperCase()}</span>}
          </div>
          <h2 className="mt-2.5 mb-1"
              style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(24px,5vw,38px)", lineHeight: 1.1 }}>
            {e.name}
          </h2>
          {e.subtitle && (
            <p className="m-0" style={{ ...fontDisplay, fontStyle: "italic", fontSize: "19px", color: theme.brass }}>
              {e.subtitle}
            </p>
          )}
          <p className="mt-3 mb-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6, color: theme.ink2 }}>
            {e.description}
          </p>
          <span className="inline-block mt-4 pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                         borderBottom: "1px solid " + theme.brass }}>
            {t("fullDetails")}
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function Events() {
  useGoogleFonts();
  const site = useSite();
  const { t } = useLang();
  usePageMeta({ title: "Events", description: "Nights, festivals and experiences from Hidden State." });
  const upcoming = EVENTS.filter((e) => e.status !== "past");
  const past = EVENTS.filter((e) => e.status === "past");

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
            <IndexBand top items={[
        { label: "UPCOMING", value: String(EVENTS.filter((e) => e.status !== "past").length).padStart(2, "0") },
        { label: "ARCHIVE", value: String(EVENTS.filter((e) => e.status === "past").length).padStart(2, "0") + " PAST" },
        { label: "NEXT", value: (EVENTS.find((e) => e.status !== "past") || {}).date || "TBA" },
      ]} />
      <PageHead flush kicker="NIGHTS &amp; FESTIVALS" title={t("theEvents")} sub={t("eventsSub")} />

      <div className="max-w-[1180px] mx-auto px-[18px] pb-4">
        {upcoming.length === 0 ? (
          <Nothing note="Nights are announced here first, usually a few weeks out. The archive below is everything that has already happened.">
            No dates announced yet.
          </Nothing>
        ) : (
          upcoming.map((e) => <Card key={e.id} e={e} />)
        )}

        {past.length > 0 && (
          <>
            <p className="mt-10 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              {t("pastEvents")}
            </p>
            {past.map((e) => <Card key={e.id} e={e} />)}
          </>
        )}

        <p className="text-center py-10 m-0"
           style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
          {site.eventsNote || EVENTS_NOTE}
        </p>
      </div>

      <Footer />
    </div>
  );
}
