import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageMeta } from "../lib/seo";
import { useGoogleFonts, fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
import * as api from "../lib/api";

/*
  ── THE PRESS KIT, AS A PROMOTER OPENS IT · K08–K20 ─────────────────────────

  One link, no login, revocable. Everything they are going to ask you for over
  the next fortnight, on one page, so that the answer to "can you send me the
  photos / the rider / the bio" is a link you already sent.

  NOT INDEXED, NOT LINKED, and the token in the address is the whole of the
  authorisation. There is no way to this page from the site and it is kept out
  of the sitemap.

  BUILT TO BE READ ON A LAPTOP AND THEN PRINTED. A promoter forwards a rider
  to a production manager who prints it, and a page that prints as five sheets
  of navigation is a page that gets retyped into an email instead.
*/

export default function Kit() {
  const { token } = useParams();
  useGoogleFonts();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [word, setWord] = useState("");
  const [asked, setAsked] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [shot, setShot] = useState(null);

  usePageMeta({ title: "Press kit", description: "", noIndex: true });

  const open = (given) => {
    api.readKitByLink(token, given).then((res) => {
      if (res.ok) { setData(res); setAsked(false); setError(""); return; }
      if (res.needsWord) { setAsked(true); setWrong(!!res.wrong); return; }
      setError(res.error || "This link is not working.");
    });
  };

  useEffect(() => { open(""); /* eslint-disable-next-line */ }, [token]);

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? "" : c)), 1800);
    } catch { /* the text is on screen and can be selected */ }
  };

  /* ── a word on the door · K20 ───────────────────────────────────────── */
  if (asked) {
    return (
      <Shell>
        <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          PRESS KIT
        </p>
        <h1 className="mt-3" style={{ ...fontDisplay, fontWeight: 400, fontSize: "30px", color: theme.ink }}>
          There is a word on this one.
        </h1>
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
          Whoever sent you the link will have sent the word with it.
        </p>
        <form className="mt-5" onSubmit={(e) => { e.preventDefault(); open(word); }}>
          <input autoFocus value={word} onChange={(e) => setWord(e.target.value)}
                 style={{ width: "100%", padding: "12px 14px", fontSize: "17px",
                          fontFamily: "inherit", color: theme.ink, background: "#fff",
                          border: `1px solid ${wrong ? theme.bad : theme.ink}` }} />
          {wrong && (
            <p className="m-0 mt-2" style={{ ...fontText, fontSize: "15px", color: theme.bad }}>
              That is not the word. Try it again, or ask for it.
            </p>
          )}
          <button type="submit" className="mt-4"
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                           padding: "12px 24px", background: theme.ink, color: theme.bg,
                           border: 0, cursor: "pointer" }}>
            OPEN IT
          </button>
        </form>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          PRESS KIT
        </p>
        <h1 className="mt-3" style={{ ...fontDisplay, fontWeight: 400, fontSize: "30px", color: theme.ink }}>
          {error}
        </h1>
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
          Links expire and are sometimes withdrawn. Ask whoever sent it to you
          for a new one.
        </p>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell center>
        <p style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink2 }}>READING…</p>
      </Shell>
    );
  }

  const { artist, kit, extra = {}, offers = {} } = data;
  const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
  const genres = parse(artist.genres);
  const photos = (kit && kit.photos) || [];
  const hero = photos[0];
  const rest = photos.slice(1);

  const Rule = () => <div style={{ borderTop: `1px solid ${theme.rule}`, margin: "36px 0 22px" }} />;
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

  const Copy = ({ what, text }) => (
    <button className="no-print" onClick={() => copy(what, text)}
            style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em", cursor: "pointer",
                     background: "transparent", border: `1px solid ${theme.rule}`,
                     padding: "4px 8px", color: theme.ink2 }}>
      {copied === what ? "COPIED" : "COPY"}
    </button>
  );

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: "100vh" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          a[href]:after { content: " (" attr(href) ")"; font-size: 9px; }
          section { break-inside: avoid; }
        }
        /*
          K19 · the mark sits over what is SHOWN and never over what is
          downloaded — it is drawn by the page, not baked into the file. A
          promoter who takes the photograph gets a clean one; a screenshot is
          obviously a screenshot.
        */
        .wm { position: relative; }
        .wm:after {
          content: attr(data-mark);
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: .2em;
          color: rgba(255,255,255,.34); text-shadow: 0 1px 3px rgba(0,0,0,.5);
          transform: rotate(-24deg); pointer-events: none;
        }
      `}</style>

      <div className="max-w-[820px] mx-auto px-[20px] py-[46px]">
        <p className="m-0" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.24em", color: theme.brass }}>
          HIDDEN STATE · PRESS KIT
        </p>
        <div style={{ borderTop: `2px solid ${theme.ink}`, marginTop: "10px" }} />
        <div style={{ borderTop: `1px solid ${theme.ink}`, marginTop: "3px" }} />

        <h1 className="m-0" style={{ ...fontDisplay, fontWeight: 400, fontSize: "clamp(38px,9vw,66px)",
            lineHeight: 1.02, letterSpacing: "-0.02em", marginTop: "22px" }}>
          {artist.name}
        </h1>
        {artist.alias && (
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "19px", fontStyle: "italic", color: theme.ink2 }}>
            {artist.alias}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {[artist.type, artist.country, artist.location, ...genres].filter(Boolean).map((t, i) => (
            <span key={i} style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                  padding: "5px 9px", border: `1px solid ${theme.rule}`, color: theme.ink2 }}>
              {String(t).toUpperCase()}
            </span>
          ))}
        </div>

        {/* ── K15, K16 · take it all ────────────────────────────────── */}
        {(offers.zip || offers.onesheet) && (
          <div className="flex flex-wrap gap-2 mt-6 no-print">
            {offers.zip && (
              <a href={api.kitZipUrl(token)}
                 style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em",
                          padding: "13px 20px", background: theme.ink, color: theme.bg,
                          textDecoration: "none" }}>
                EVERYTHING AS A ZIP ↓
              </a>
            )}
            {offers.onesheet && (
              <a href={api.kitSheetUrl(token)} target="_blank" rel="noreferrer"
                 style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em",
                          padding: "13px 20px", color: theme.ink,
                          border: `1px solid ${theme.ink}`, textDecoration: "none" }}>
                ONE-SHEET, TO PRINT ↗
              </a>
            )}
          </div>
        )}

        {/* ── K08 · the primary shot leads ──────────────────────────── */}
        {hero && (
          <figure className="m-0 mt-7 no-print">
            <div className="wm" data-mark={offers.watermark ? offers.watermarkText : undefined}>
              <a href={hero.url} target="_blank" rel="noreferrer">
                <img src={hero.web || hero.url} alt={artist.name} loading="eager"
                     style={{ width: "100%", display: "block", border: `1px solid ${theme.rule}` }} />
              </a>
            </div>
            <figcaption className="mt-1.5" style={{ ...fontUtility, fontSize: "8px",
                        letterSpacing: "0.14em", color: theme.ink2 }}>
              {(hero.credit ? "© " + hero.credit : "NO CREDIT GIVEN").toUpperCase()}
              {hero.caption ? ` · ${hero.caption}` : ""} · CLICK FOR FULL SIZE
            </figcaption>
          </figure>
        )}

        {/* ── the words ─────────────────────────────────────────────── */}
        {(kit?.bioShort || kit?.bioLong || artist.bio) && (
          <section>
            <Rule />
            <Head>BIOGRAPHY</Head>
            {kit?.bioShort && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                    SHORT — FOR A FLYER
                  </p>
                  <Copy what="short" text={kit.bioShort} />
                </div>
                <p className="m-0 mt-2" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.6 }}>
                  {kit.bioShort}
                </p>
              </div>
            )}
            {(kit?.bioLong || artist.bio) && (
              <div className="mt-7">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                    LONG — FOR A PROGRAMME
                  </p>
                  <Copy what="long" text={kit.bioLong || artist.bio} />
                </div>
                <p className="m-0 mt-2" style={{ ...fontText, fontSize: "17px", lineHeight: 1.65,
                   color: theme.ink2, whiteSpace: "pre-wrap" }}>
                  {kit.bioLong || artist.bio}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── K12 · something to listen to ──────────────────────────── */}
        {(extra.listen || []).length > 0 && (
          <section className="no-print">
            <Rule />
            <Head count={extra.listen.length}>LISTEN</Head>
            <div className="mt-4 grid gap-3">
              {extra.listen.map((l, i) => (
                <Player key={i} url={l.url} label={l.label} />
              ))}
            </div>
          </section>
        )}

        {/* ── K13 · the showreel ────────────────────────────────────── */}
        {extra.video && (
          <section className="no-print">
            <Rule />
            <Head>WATCH</Head>
            <div className="mt-4"><Player url={extra.video} tall /></div>
          </section>
        )}

        {/* ── the rest of the photographs ───────────────────────────── */}
        {rest.length > 0 && (
          <section className="no-print">
            <Rule />
            <Head count={photos.length}>PHOTOGRAPHS</Head>
            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
              Click any of them for the full size. The credit under each one
              must travel with it — that is a condition of use, not a courtesy.
            </p>
            <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
              {rest.map((ph, i) => (
                <figure key={i} className="m-0">
                  <div className="wm" data-mark={offers.watermark ? offers.watermarkText : undefined}>
                    <a href={ph.url} target="_blank" rel="noreferrer">
                      <img src={ph.web || ph.url} alt={ph.caption || artist.name} loading="lazy"
                           style={{ width: "100%", display: "block", border: `1px solid ${theme.rule}` }} />
                    </a>
                  </div>
                  <figcaption className="mt-1.5" style={{ ...fontUtility, fontSize: "8px",
                              letterSpacing: "0.14em", color: theme.ink2 }}>
                    {(ph.credit ? "© " + ph.credit : "NO CREDIT GIVEN").toUpperCase()}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ── K11 · what people have said ───────────────────────────── */}
        {(extra.quotes || []).length > 0 && (
          <section>
            <Rule />
            <Head count={extra.quotes.length}>WHAT PEOPLE HAVE SAID</Head>
            <div className="mt-4">
              {extra.quotes.map((q, i) => (
                <blockquote key={i} className="m-0 py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
                  <p className="m-0" style={{ ...fontDisplay, fontSize: "21px", lineHeight: 1.4,
                     fontStyle: "italic", color: theme.ink }}>
                    “{q.text}”
                  </p>
                  {(q.who || q.where) && (
                    <cite className="block mt-2" style={{ ...fontUtility, fontSize: "8.5px",
                          letterSpacing: "0.16em", color: theme.brass, fontStyle: "normal" }}>
                      {[q.who, q.where].filter(Boolean).join(" · ").toUpperCase()}
                    </cite>
                  )}
                </blockquote>
              ))}
            </div>
          </section>
        )}

        {/* ── K10 · where they have played ──────────────────────────── */}
        {(extra.dates || []).length > 0 && (
          <section>
            <Rule />
            <Head count={extra.dates.length}>SELECTED DATES</Head>
            <div className="mt-3" style={{ borderTop: `1px solid ${theme.rule}` }}>
              {extra.dates.map((d, i) => (
                <div key={i} className="flex items-baseline gap-4 py-2.5"
                     style={{ borderBottom: `1px solid ${theme.rule}` }}>
                  <span className="flex-1" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {d.venue}
                  </span>
                  <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2 }}>
                    {[d.city, d.year].filter(Boolean).join(" · ").toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── K03 · logos ───────────────────────────────────────────── */}
        {(kit?.logos || []).length > 0 && (
          <section className="no-print">
            <Rule />
            <Head count={kit.logos.length}>LOGOS</Head>
            <div className="flex flex-wrap gap-3 mt-4">
              {kit.logos.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer"
                   style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                            padding: "10px 14px", border: `1px solid ${theme.ink}`,
                            color: theme.ink, textDecoration: "none" }}>
                  {(l.label || l.name || "LOGO").toUpperCase()} ↓
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── K04 · the rider ───────────────────────────────────────── */}
        {(kit?.rider || extra.riderFile) && (
          <section>
            <Rule />
            <Head>TECHNICAL RIDER</Head>
            {extra.riderFile && (
              <a className="inline-block mt-3 no-print"
                 href={api.kitFileUrl(token, extra.riderFile.key)} target="_blank" rel="noreferrer"
                 style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                          padding: "10px 14px", background: theme.ink, color: theme.bg,
                          textDecoration: "none" }}>
                THE RIDER AS A PDF ↓
              </a>
            )}
            {kit?.rider && (
              <pre className="m-0 mt-4" style={{ ...fontUtility, fontSize: "12.5px", lineHeight: 1.75,
                   color: theme.ink, whiteSpace: "pre-wrap", wordBreak: "break-word",
                   background: theme.sunk, border: `1px solid ${theme.rule}`, padding: "16px 18px" }}>
                {kit.rider}
              </pre>
            )}
          </section>
        )}

        {/* ── K09 · the stage plot ──────────────────────────────────── */}
        {extra.stagePlot && (
          <section>
            <Rule />
            <Head>STAGE PLOT</Head>
            <a className="inline-block mt-3" href={api.kitFileUrl(token, extra.stagePlot.key)}
               target="_blank" rel="noreferrer"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                        padding: "10px 14px", border: `1px solid ${theme.ink}`,
                        color: theme.ink, textDecoration: "none" }}>
              {(extra.stagePlot.name || "STAGE PLOT").toUpperCase()} ↓
            </a>
          </section>
        )}

        {kit?.hospitality && (
          <section>
            <Rule />
            <Head>HOSPITALITY</Head>
            <pre className="m-0 mt-4" style={{ ...fontUtility, fontSize: "12.5px", lineHeight: 1.75,
                 color: theme.ink, whiteSpace: "pre-wrap", wordBreak: "break-word",
                 background: theme.sunk, border: `1px solid ${theme.rule}`, padding: "16px 18px" }}>
              {kit.hospitality}
            </pre>
          </section>
        )}

        {(kit?.links || []).length > 0 && (
          <section>
            <Rule />
            <Head count={kit.links.length}>FOLLOW</Head>
            <div className="mt-3" style={{ borderTop: `1px solid ${theme.rule}` }}>
              {kit.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer"
                   className="flex items-baseline justify-between gap-4 py-3"
                   style={{ borderBottom: `1px solid ${theme.rule}`, textDecoration: "none", color: theme.ink }}>
                  <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em" }}>
                    {(l.label || "LINK").toUpperCase()}
                  </span>
                  <span className="truncate" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
                    {String(l.url).replace(/^https?:\/\//, "")}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── K14 · who to write to ─────────────────────────────────── */}
        {(kit?.contact || extra.territories) && (
          <section>
            <Rule />
            <Head>BOOKINGS AND PRESS</Head>
            {kit?.contact && (
              <p className="m-0 mt-3" style={{ ...fontText, fontSize: "18px", lineHeight: 1.6 }}>
                {kit.contact}
              </p>
            )}
            {extra.territories && (
              <p className="m-0 mt-2" style={{ ...fontUtility, fontSize: "9px",
                 letterSpacing: "0.16em", color: theme.brass }}>
                {String(extra.territories).toUpperCase()}
              </p>
            )}
          </section>
        )}

        <div style={{ borderTop: `2px solid ${theme.ink}`, marginTop: "44px", paddingTop: "12px" }}>
          <p className="m-0" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.ink2 }}>
            {(offers.footer || "Private link — please do not publish it.").toUpperCase()}
            {kit && kit.updatedAt ? ` · UPDATED ${new Date(kit.updatedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell({ children, center }) {
  return (
    <div style={{ background: theme.bg, minHeight: "100vh", display: "grid",
                  placeItems: center ? "center" : "start center", padding: "60px 24px" }}>
      <div style={{ maxWidth: "460px", width: "100%", textAlign: center ? "center" : "left" }}>
        {children}
      </div>
    </div>
  );
}

/*
  ── K12 AND K13 · SOMETHING TO LISTEN TO, AND SOMETHING TO WATCH ────────────

  Embedded rather than linked, so a promoter deciding whether to book someone
  can hear them without leaving the page they are deciding on.

  The address is turned into the service's own embed address here, and ONLY
  for the four services we recognise. Anything else becomes a plain link
  rather than an iframe — putting an arbitrary address from a form into a
  frame on a page is how a press kit ends up hosting somebody else's login
  form.
*/
function Player({ url, label, tall }) {
  const src = embedFor(url);
  if (!src) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
         style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                  padding: "12px 16px", border: `1px solid ${theme.ink}`,
                  color: theme.ink, textDecoration: "none", display: "inline-block" }}>
        {(label || "LISTEN").toUpperCase()} ↗
      </a>
    );
  }
  return (
    <div>
      {label && (
        <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "8.5px",
           letterSpacing: "0.16em", color: theme.brass }}>
          {label.toUpperCase()}
        </p>
      )}
      <iframe
        src={src}
        title={label || "Player"}
        loading="lazy"
        allow="encrypted-media; clipboard-write; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ width: "100%", height: tall ? "min(52vw, 420px)" : "160px",
                 border: `1px solid ${theme.rule}`, display: "block", background: theme.sunk }}
      />
    </div>
  );
}

function embedFor(raw) {
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
