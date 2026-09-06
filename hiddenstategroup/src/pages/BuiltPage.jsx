import { usePageMeta } from "../lib/seo";
import React from "react";
import { useParams } from "react-router-dom";
import { Nav, Footer, useGoogleFonts, PageHead, theme, fontText } from "../components/Shared";
import Blocks from "../components/Blocks";
import { usePages } from "../lib/pages";
import NotFound from "./NotFound";

/*
  A page somebody built in the console, at its own address.

  ── WHY THIS RENDERS NOTHING OF ITS OWN ───────────────────────────────────

  Everything below the head comes from <Blocks>, which is the same component
  the builder previews through. If this file drew even one thing differently —
  a margin, a measure, a rule — then the builder would be showing something
  the site does not do, and the person arranging the page would be arranging
  the wrong thing. The way to keep a preview honest is to give it nothing to
  be honest about.

  ── AND WHY A MISSING PAGE IS A 404 AND NOT A MESSAGE ─────────────────────

  This route matches ANY unclaimed address, so it is also what answers a typo.
  A friendly "this page is empty" on every mistyped URL would be worse than
  useless: it would tell a search engine that ten thousand nonsense addresses
  are real pages. An unknown slug is not found, and says so.
*/
export default function BuiltPage() {
  useGoogleFonts();
  const { slug } = useParams();
  const pages = usePages();
  const page = pages.find((p) => String(p.slug) === String(slug));

  usePageMeta({
    title: page ? page.title : "Not found",
    description: page ? (page.seo_description || page.sub || "") : "",
  });

  // While the list is still in flight there is nothing to say yet — showing
  // "not found" for the half-second before the answer arrives is how a real
  // page comes to look broken on a slow connection.
  if (!pages.length) {
    return <div data-page style={{ background: theme.bg, minHeight: "100vh" }}><Nav /></div>;
  }
  if (!page) return <NotFound />;

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <span id="main" tabIndex={-1} />

      <PageHead flush kicker={page.kicker || ""} title={page.title} sub={page.sub || ""} />

      <section className="max-w-[1180px] mx-auto px-[18px] pb-20">
        <Blocks blocks={page.blocks} />
        {!(page.blocks || []).length && (
          <p className="m-0 py-10 text-center" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            Nothing has been put on this page yet.
          </p>
        )}
      </section>

      <Footer />
    </div>
  );
}
