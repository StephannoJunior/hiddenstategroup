import { usePageMeta } from "../lib/seo";
import React from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";

/*
  Sending every unknown URL to the homepage looks like the site is broken —
  people think they clicked wrong. A proper page tells them what happened and
  offers a way on. It also stops search engines indexing junk URLs as copies
  of the homepage.
*/
export default function NotFound() {
  useGoogleFonts();
  usePageMeta({ title: "Page not found", description: "That page doesn't exist." });

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <section className="max-w-[900px] mx-auto px-[18px] pt-[104px] pb-20 text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          Stop Press
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />

        <h2 className="mt-8 mb-3" style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,6vw,44px)" }}>
          This page went to print without us.
        </h2>
        <p className="m-0 mx-auto" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.6, color: theme.ink2, maxWidth: "460px" }}>
          The address you followed doesn't exist — it may have moved, or the link
          may have been mistyped.
        </p>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-9">
          {[["/", "HOME"], ["/news", "NEWS"], ["/artists", "ARTISTS"], ["/events", "EVENTS"]].map(([to, label]) => (
            <Link key={to} to={to} className="pb-0.5"
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                           borderBottom: "1px solid " + theme.brass }}>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
