import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageMeta } from "../lib/seo";
import { useGoogleFonts, fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
import * as api from "../lib/api";

/*
  ── L02 · THE PRESS KIT ─────────────────────────────────────────────────────

  One link per artist, sent to a promoter. Everything they are going to ask
  for over the next fortnight, on one page, at full resolution: the biography
  in two lengths, photographs with their credits, the logo files, the
  technical rider.

  WHY A LINK AND NOT A PUBLIC PAGE. A rider is not public information — it
  says what an artist needs backstage — and press photographs have credits
  that must travel with them. A link can be revoked; a public page cannot.

  NOT INDEXED, NOT LINKED. There is no way to this page from the site, it is
  kept out of the sitemap, and it tells search engines to leave. The token in
  the address is the whole of the authorisation.

  BUILT TO BE READ ON A LAPTOP IN AN OFFICE, then printed. The print styles
  are not decoration: a promoter forwards a rider to a production manager who
  prints it, and a page that prints as five sheets of navigation is a page
  that gets retyped into an email instead.
*/

export default function Kit() {
  const { token } = useParams();
  useGoogleFonts();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  // Deliberately not indexed. This page has no business in a search result.
  usePageMeta({ title: "Press kit", description: "", noIndex: true });

  useEffect(() => {
    api.readKitByLink(token).then((res) => {
      if (res.ok) setData(res);
      else setError(res.error || "This link is not working.");
    });
  }, [token]);

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? "" : c)), 1800);
    } catch {
      /* Clipboard refused — the text is on screen and can be selected. */
    }
  };

  if (error) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            PRESS KIT
          </p>
          <h1 className="mt-3" style={{ ...fontDisplay, fontWeight: 400, fontSize: "30px", color: theme.ink }}>
            {error}
          </h1>
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
            Links expire and are sometimes withdrawn. Ask whoever sent it to
            you for a new one.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink2 }}>READING…</p>
      </div>
    );
  }

  const { artist, kit } = data;
  const genres = (() => { try { return JSON.parse(artist.genres || "[]"); } catch { return []; } })();

  const Rule = () => (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: "34px 0 22px" }} />
  );
  const Head = ({ children, count }) => (
    <div className="flex items-baseline gap-3" style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "6px" }}>
      <h2 className="m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>
        {children}
      </h2>
      {count != null && (
        <span className="flex-1 text-right" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
          {String(count).padStart(2, "0")}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: "100vh" }}>
      <style>{`
        /*
          PRINTING. A rider gets forwarded to a production manager and printed,
          and what they need on paper is the words — not the photographs, not
          the buttons, and not a dark ground that empties a toner cartridge.
        */
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          a[href]:after { content: " (" attr(href) ")"; font-size: 9px; }
          section { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-[760px] mx-auto px-[20px] py-[46px]">

        <p className="m-0" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.24em", color: theme.brass }}>
          HIDDEN STATE · PRESS KIT
        </p>
        <div style={{ borderTop: `2px solid ${theme.ink}`, marginTop: "10px" }} />
        <div style={{ borderTop: `1px solid ${theme.ink}`, marginTop: "3px" }} />

        <h1 className="m-0" style={{
          ...fontDisplay, fontWeight: 400, fontSize: "clamp(38px,9vw,66px)",
          lineHeight: 1.02, letterSpacing: "-0.02em", marginTop: "22px",
        }}>
          {artist.name}
        </h1>
        {artist.alias && (
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "19px", fontStyle: "italic", color: theme.ink2 }}>
            {artist.alias}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {[artist.type, artist.country, artist.location, ...genres].filter(Boolean).map((t, i) => (
            <span key={i} style={{
              ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
              padding: "5px 9px", border: `1px solid ${theme.rule}`, color: theme.ink2,
            }}>
              {String(t).toUpperCase()}
            </span>
          ))}
        </div>

        {!kit && (
          <p className="mt-8" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6, color: theme.ink2 }}>
            {artist.bio || artist.descr || "Nothing has been written here yet."}
          </p>
        )}

        {kit && (
          <>
            {/* ── the two biographies ─────────────────────────────────── */}
            {(kit.bioShort || kit.bioLong || artist.bio) && (
              <section>
                <Rule />
                <Head>BIOGRAPHY</Head>
                {kit.bioShort && (
                  <div className="mt-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                        SHORT — FOR A FLYER
                      </p>
                      <button className="no-print" onClick={() => copy("short", kit.bioShort)}
                              style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                                       cursor: "pointer", background: "transparent",
                                       border: `1px solid ${theme.rule}`, padding: "4px 8px", color: theme.ink2 }}>
                        {copied === "short" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                    <p className="m-0 mt-2" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.6 }}>
                      {kit.bioShort}
                    </p>
                  </div>
                )}
                {(kit.bioLong || artist.bio) && (
                  <div className="mt-7">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                        LONG — FOR A PROGRAMME
                      </p>
                      <button className="no-print" onClick={() => copy("long", kit.bioLong || artist.bio)}
                              style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                                       cursor: "pointer", background: "transparent",
                                       border: `1px solid ${theme.rule}`, padding: "4px 8px", color: theme.ink2 }}>
                        {copied === "long" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                    <p className="m-0 mt-2" style={{ ...fontText, fontSize: "17px", lineHeight: 1.65, color: theme.ink2, whiteSpace: "pre-wrap" }}>
                      {kit.bioLong || artist.bio}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ── photographs ─────────────────────────────────────────── */}
            {kit.photos.length > 0 && (
              <section className="no-print">
                <Rule />
                <Head count={kit.photos.length}>PHOTOGRAPHS</Head>
                <p className="m-0 mt-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
                  Right-click to save at full size. The credit under each one
                  must travel with it — it is a condition of use, not a
                  courtesy.
                </p>
                <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
                  {kit.photos.map((ph, i) => (
                    <figure key={i} className="m-0">
                      <a href={ph.url} target="_blank" rel="noreferrer">
                        <img src={ph.url} alt={ph.label || artist.name} loading="lazy"
                             style={{ width: "100%", display: "block", border: `1px solid ${theme.rule}` }} />
                      </a>
                      <figcaption className="mt-1.5" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em", color: theme.ink2 }}>
                        {(ph.credit ? "© " + ph.credit : ph.label || "NO CREDIT GIVEN").toUpperCase()}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {/* ── logos ───────────────────────────────────────────────── */}
            {kit.logos.length > 0 && (
              <section className="no-print">
                <Rule />
                <Head count={kit.logos.length}>LOGOS</Head>
                <div className="flex flex-wrap gap-3 mt-4">
                  {kit.logos.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer"
                       style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                                padding: "10px 14px", border: `1px solid ${theme.ink}`,
                                color: theme.ink, textDecoration: "none" }}>
                      {(l.label || "LOGO").toUpperCase()} ↓
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── the rider ───────────────────────────────────────────── */}
            {kit.rider && (
              <section>
                <Rule />
                <Head>TECHNICAL RIDER</Head>
                <pre className="m-0 mt-4" style={{
                  ...fontUtility, fontSize: "12.5px", lineHeight: 1.75, color: theme.ink,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: theme.sunk, border: `1px solid ${theme.rule}`, padding: "16px 18px",
                }}>
                  {kit.rider}
                </pre>
              </section>
            )}

            {kit.hospitality && (
              <section>
                <Rule />
                <Head>HOSPITALITY</Head>
                <pre className="m-0 mt-4" style={{
                  ...fontUtility, fontSize: "12.5px", lineHeight: 1.75, color: theme.ink,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: theme.sunk, border: `1px solid ${theme.rule}`, padding: "16px 18px",
                }}>
                  {kit.hospitality}
                </pre>
              </section>
            )}

            {/* ── listening ───────────────────────────────────────────── */}
            {kit.links.length > 0 && (
              <section>
                <Rule />
                <Head count={kit.links.length}>LISTEN AND FOLLOW</Head>
                <div className="mt-3" style={{ borderTop: `1px solid ${theme.rule}` }}>
                  {kit.links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer"
                       className="flex items-baseline justify-between gap-4 py-3"
                       style={{ borderBottom: `1px solid ${theme.rule}`, textDecoration: "none", color: theme.ink }}>
                      <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em" }}>
                        {(l.label || "LINK").toUpperCase()}
                      </span>
                      <span className="truncate" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
                        {l.url.replace(/^https?:\/\//, "")}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {kit.contact && (
              <section>
                <Rule />
                <Head>BOOKINGS AND PRESS</Head>
                <p className="m-0 mt-3" style={{ ...fontText, fontSize: "18px", lineHeight: 1.6 }}>
                  {kit.contact}
                </p>
              </section>
            )}
          </>
        )}

        <div style={{ borderTop: `2px solid ${theme.ink}`, marginTop: "44px", paddingTop: "12px" }}>
          <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.ink2 }}>
            PRIVATE LINK — PLEASE DO NOT PUBLISH IT
            {kit && kit.updatedAt ? ` · UPDATED ${new Date(kit.updatedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
