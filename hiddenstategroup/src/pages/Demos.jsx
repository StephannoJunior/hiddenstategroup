import { usePageMeta } from "../lib/seo";
import { useSite } from "../lib/site";
import React, { useState } from "react";
import { Nav, Footer, useGoogleFonts, Field, inputStyle,
         IndexBand, PageHead, fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
import { CONTACT_EMAIL } from "../lib/config";
import * as api from "../lib/api";

/*
  ── L01 · DEMOS ─────────────────────────────────────────────────────────────

  A LINK, NOT A FILE, and the page says so out loud rather than quietly
  refusing uploads. Accepting audio would mean storing strangers' work,
  deciding how long to keep it and answering for it — for a queue that is
  read once and mostly answered no. Everyone sends a link anyway.

  FOUR FIELDS. Name, address, link, and the option to say something. Every
  further field is one more reason to abandon the form and one more thing to
  protect, and none of them would change the answer: the answer comes from
  listening to the link.

  WHAT THE PAGE PROMISES is deliberately narrow — we listen to everything and
  answer what we can. Promising a reply to everyone is a promise that gets
  broken by the fortieth demo, and a broken promise is worse than a modest
  one.
*/

export default function Demos() {
  useGoogleFonts();
  const site = useSite();
  usePageMeta({
    title: "Demos",
    description: "Send Hidden State a demo. One link, and we listen to everything.",
  });

  const [form, setForm] = useState({ artist: "", email: "", url: "", title: "", note: "", socials: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const open = site.demosOpen !== false;
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    /*
      Checked here as well as on the server, because being told "that does not
      look like a link" the instant you leave the field is help, and being
      told it after a round trip is a rejection.
    */
    if (!/^https?:\/\//i.test(form.url.trim())) {
      setError("The link needs to start with http:// or https:// — paste the whole address.");
      return;
    }

    setSending(true);
    const res = await api.submitDemo({ ...form, url: form.url.trim() });
    setSending(false);
    if (res.ok) setSent(true);
    else setError(res.error || `Something went wrong. You can email ${CONTACT_EMAIL} instead.`);
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "WE TAKE", value: "LINKS" },
        { label: "WE ANSWER", value: open ? "WHAT WE CAN" : "NOTHING JUST NOW" },
        { label: "SEND", value: "ONE" },
      ]} />
      <PageHead flush kicker="DEMOS" title="Send us one thing"
                sub="A LINK — NOT A FOLDER, NOT AN ATTACHMENT" />

      <section className="max-w-[560px] mx-auto px-[18px] pb-16">

        {!open ? (
          <div className="mt-8 p-8 text-center" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              CLOSED
            </p>
            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink }}>
              {site.demosClosedMessage ||
                "We are not listening to demos at the moment. Try again in a few weeks."}
            </p>
          </div>
        ) : sent ? (
          <div className="mt-8 p-8 text-center" style={{ border: `1px solid ${theme.ink}` }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              IT ARRIVED
            </p>
            <h2 className="mt-3 mb-2" style={{ ...fontDisplay, fontWeight: 400, fontSize: "28px", color: theme.ink }}>
              We'll listen.
            </h2>
            <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
              It goes into a queue that gets played properly rather than
              skimmed. Please don't send it again — a second copy goes to the
              back of the same queue.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">

            <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink }}>
              {site.demosNote ||
                "One link — SoundCloud, Drive, wherever it lives. We listen to everything and answer what we can."}
            </p>

            <Field label="What you're called">
              <input required maxLength={80} style={inputStyle}
                     value={form.artist} onChange={update("artist")} />
            </Field>

            <Field label="Email">
              <input required type="email" maxLength={160} style={inputStyle}
                     value={form.email} onChange={update("email")} />
            </Field>

            <Field label="The link">
              <input required type="url" inputMode="url" style={inputStyle}
                     placeholder="https://soundcloud.com/…"
                     value={form.url} onChange={update("url")} />
              <span className="block mt-1.5"
                    style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
                Private links are fine — just make sure it plays without a
                password. A link we can't open is a demo we can't hear.
              </span>
            </Field>

            <Field label="Track or release name">
              <input maxLength={120} style={inputStyle} value={form.title} onChange={update("title")} />
            </Field>

            <Field label="Where else you are">
              <input maxLength={200} style={inputStyle}
                     placeholder="Instagram, Bandcamp — whichever is the real one"
                     value={form.socials} onChange={update("socials")} />
            </Field>

            <Field label="Anything worth knowing">
              <textarea rows={3} maxLength={600} value={form.note} onChange={update("note")}
                        placeholder="Where it was made, who played on it, what it's for."
                        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              <span className="block text-right mt-1"
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                {600 - form.note.length} LEFT
              </span>
            </Field>

            {error && (
              <p className="m-0 px-3 py-2.5"
                 style={{ ...fontText, fontSize: "15px", color: theme.bad, border: `1px solid ${theme.badLine}` }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={sending} className="px-9 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             background: theme.ink, color: theme.bg, opacity: sending ? 0.6 : 1 }}>
              {sending ? "SENDING…" : "SEND IT"}
            </button>

            <p className="m-0 pt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.55, color: theme.ink2 }}>
              Your address is used to answer you and nothing else. It isn't
              added to any list, and you can ask us to delete it by emailing
              {" "}{CONTACT_EMAIL}.
            </p>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
