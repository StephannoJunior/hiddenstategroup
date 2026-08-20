import { usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import React, { useState } from "react";
import {
  Nav, Footer, useGoogleFonts, Field, inputStyle, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { FORM_ENDPOINT, CONTACT_EMAIL } from "../lib/config";
import { EMAILS } from "../lib/contacts";
import { SOCIAL } from "../lib/social";

const REASONS = ["General Inquiry", "Booking", "Press", "Demo Submission", "Partnership", "Other"];
const initialForm = { name: "", email: "", reason: "General Inquiry", message: "" };

export default function Contact() {
  useGoogleFonts();
  const { t } = useLang();
  usePageMeta({ title: "Contact", description: "Get in touch with Hidden State — booking, press, demos and management." });
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!FORM_ENDPOINT) {
      setError(`This form isn't connected yet. Please email ${CONTACT_EMAIL} directly.`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...form, _subject: `Website enquiry — ${form.reason}` }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError(`Something went wrong sending that. Please email ${CONTACT_EMAIL} instead.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[1180px] mx-auto px-[18px] pt-[104px] text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          Contact
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <p className="mt-3 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
          GET IN TOUCH
        </p>
      </section>

      <section className="max-w-[1180px] mx-auto px-[18px] pt-9 pb-16 grid md:grid-cols-[1fr_320px] gap-10">
        <div>
          <p className="m-0 mb-5" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
            Booking a specific artist? Use the BOOK button on their profile — it routes straight to
            the agency. Everything else, start here.
          </p>

          {submitted ? (
            <div className="p-8" style={{ border: "1px solid " + theme.ink }}>
              <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
                MESSAGE SENT
              </p>
              <h3 className="mt-3 mb-2" style={{ ...fontDisplay, fontWeight: 400, fontSize: "26px", color: theme.ink }}>
                Thank you.
              </h3>
              <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
                Your message has been received. We'll be in touch soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name"><input required style={inputStyle} value={form.name} onChange={update("name")} /></Field>
                <Field label="Email"><input required type="email" style={inputStyle} value={form.email} onChange={update("email")} /></Field>
              </div>
              <Field label="Reason">
                <select style={inputStyle} value={form.reason} onChange={update("reason")}>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Message">
                <textarea required rows={6} style={{ ...inputStyle, resize: "none" }} value={form.message} onChange={update("message")} />
              </Field>
              {error && (
                <p className="m-0 px-3 py-2.5" style={{ ...fontText, fontSize: "15px", color: "#7A2E2E", border: "1px solid #C08A8A" }}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={sending} className="px-9 py-3.5"
                      style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                               background: theme.ink, color: theme.bg, opacity: sending ? 0.6 : 1 }}>
                {sending ? "SENDING…" : "SEND MESSAGE"}
              </button>
            </form>
          )}
        </div>

        <aside>
          <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            {t("direct")}
          </p>
          <div style={{ borderTop: "1px solid " + theme.ink }}>
            {Object.values(EMAILS).map((e) => (
              <a key={e.address} href={`mailto:${e.address}`} className="block py-3"
                 style={{ borderBottom: "1px solid " + theme.rule }}>
                <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.ink2 }}>
                  {e.label.toUpperCase()}
                </span>
                <span className="block mt-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{e.address}</span>
              </a>
            ))}
          </div>
          <p className="m-0 mt-7 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            {t("social")}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Instagram account={SOCIAL.official} />
            <Instagram account={SOCIAL.group} />
            <Instagram account={SOCIAL.agency} />
            <Instagram account={SOCIAL.records} />
            <Instagram account={SOCIAL.news} />
          </div>
        </aside>
      </section>

      <Footer />
    </div>
  );
}
