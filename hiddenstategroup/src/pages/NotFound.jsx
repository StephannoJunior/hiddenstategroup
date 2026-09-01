import { usePageMeta } from "../lib/seo";
import React from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  PageHead, fontDisplay, fontUtility, fontText, theme,
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
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
      <PageHead kicker="STOP PRESS" title="404" sub="THIS PAGE WENT TO PRINT WITHOUT US" />

      <section className="max-w-[900px] mx-auto px-[18px] pb-20 text-center">

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
