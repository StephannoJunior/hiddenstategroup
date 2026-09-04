import { usePageMeta } from "../lib/seo";
import { useSite } from "../lib/site";
import { useLang } from "../lib/lang";
import React, { useState } from "react";
import { Nav, Footer, useGoogleFonts, Field, inputStyle,
         IndexBand, PageHead, fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
import { CONTACT_EMAIL } from "../lib/config";
import { useArtists } from "../lib/data";
import * as api from "../lib/api";

/*
  ── L04 · BOOKINGS ──────────────────────────────────────────────────────────

  A booking enquiry currently arrives as free text — "hi, are you free in
  March" — and then takes three emails to become answerable. This form asks
  those three emails' worth of questions once, up front, while the promoter
  is already thinking about them.

  EVERY FIELD IS TEXT, including capacity and budget, and that is deliberate.
  "800–1000" is an honest answer to how big the room is and a number input
  cannot hold it; "depends on the night" is an honest answer about budget and
  a currency field cannot hold that either. Forcing structure onto an answer
  that does not have any produces a form people abandon or lie to.

  ONLY TWO FIELDS ARE REQUIRED. A promoter who can only tell you their name
  and a rough month should still be able to reach you — the alternative is
  that they close the tab and write to somebody else.
*/

const ROOM_HINTS = ["Under 200", "200–500", "500–1000", "1000–3000", "3000+"];

export default function Bookings() {
  useGoogleFonts();
  const site = useSite();
  const { t } = useLang();
  usePageMeta({
    title: "Bookings",
    description: "Book a Hidden State artist — dates, rooms and availability.",
  });

  /*
    The artist list is the roster the rest of the site draws from, not a list
    typed into this page: an artist who joins or leaves changes here without
    anybody remembering to come and edit a form, and an enquiry can only name
    somebody we actually represent.

    If the roster has not loaded — offline, or a first visit with a cold cache
    — the select becomes a plain text field rather than an empty dropdown. An
    empty dropdown is a dead end; a text box is merely less helpful.
  */
  const roster = (useArtists() || []).filter((a) => a && a.published !== 0);

  const [form, setForm] = useState({
    promoter: "", company: "", email: "", phone: "", artist: "",
    date: "", city: "", country: "", venue: "", capacity: "", budget: "", note: "",
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const open = site.bookingsOpen !== false;

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const res = await api.submitBooking(form);
    setSending(false);
    if (res.ok) setSent(true);
    else setError(res.error || `Something went wrong. You can email ${CONTACT_EMAIL} instead.`);
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "ROSTER", value: roster.length ? String(roster.length).padStart(2, "0") : "—" },
        { label: "TERRITORY", value: "WORLDWIDE" },
        { label: "REPLY", value: open ? "BY EMAIL" : "CLOSED" },
      ]} />
      <PageHead flush kicker={t("bookings")} title={t("bookAnArtist")}
                sub="ASK ONCE — ANSWERED IN ONE REPLY" />

      <section className="max-w-[620px] mx-auto px-[18px] pb-16">

        {!open ? (
          <div className="mt-8 p-8 text-center" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              {t("closedForNow")}
            </p>
            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink }}>
              We are not taking enquiries through the site at the moment.
              Write to {CONTACT_EMAIL}.
            </p>
          </div>
        ) : sent ? (
          <div className="mt-8 p-8 text-center" style={{ border: `1px solid ${theme.ink}` }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              ENQUIRY RECEIVED
            </p>
            <h2 className="mt-3 mb-2" style={{ ...fontDisplay, fontWeight: 400, fontSize: "28px", color: theme.ink }}>
              Thank you.
            </h2>
            <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
              It reaches us straight away, and you'll get a real answer — a
              yes, a no, or a hold — rather than silence.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">

            <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink }}>
              {site.bookingsNote ||
                "Tell us the date, the room and the budget and we can answer in one reply instead of five."}
            </p>

            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <Field label="Your name">
                <input required maxLength={100} style={inputStyle}
                       value={form.promoter} onChange={update("promoter")} />
              </Field>
              <Field label="Company or promoter">
                <input maxLength={100} style={inputStyle}
                       value={form.company} onChange={update("company")} />
              </Field>
              <Field label="Email">
                <input required type="email" maxLength={160} style={inputStyle}
                       value={form.email} onChange={update("email")} />
              </Field>
              <Field label="Phone or WhatsApp">
                <input maxLength={40} style={inputStyle} value={form.phone} onChange={update("phone")} />
              </Field>
            </div>

            <Field label="Who you'd like">
              {roster.length ? (
                <select style={inputStyle} value={form.artist} onChange={update("artist")}>
                  <option value="">Not sure yet — advise us</option>
                  {roster.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <input maxLength={80} style={inputStyle} value={form.artist} onChange={update("artist")} />
              )}
            </Field>

            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <Field label="When">
                <input maxLength={60} style={inputStyle} placeholder="14 March, or just “spring”"
                       value={form.date} onChange={update("date")} />
              </Field>
              <Field label="Venue">
                <input maxLength={100} style={inputStyle} value={form.venue} onChange={update("venue")} />
              </Field>
              <Field label="City">
                <input maxLength={60} style={inputStyle} value={form.city} onChange={update("city")} />
              </Field>
              <Field label="Country">
                <input maxLength={60} style={inputStyle} value={form.country} onChange={update("country")} />
              </Field>
            </div>

            <Field label="How big the room is">
              <input maxLength={40} style={inputStyle} placeholder="800–1000"
                     value={form.capacity} onChange={update("capacity")} />
              <span className="flex flex-wrap gap-1.5 mt-2">
                {ROOM_HINTS.map((h) => (
                  <button key={h} type="button" onClick={() => setForm((f) => ({ ...f, capacity: h }))}
                          style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                   padding: "5px 9px", cursor: "pointer", color: theme.ink2,
                                   background: "transparent", border: `1px solid ${theme.rule}` }}>
                    {h}
                  </button>
                ))}
              </span>
            </Field>

            <Field label="Budget">
              <input maxLength={60} style={inputStyle} placeholder="A range is fine. So is “tell us yours”."
                     value={form.budget} onChange={update("budget")} />
              <span className="block mt-1.5"
                    style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
                Saying a number here is what turns three emails into one. It is
                not binding and it is not shared.
              </span>
            </Field>

            <Field label="Anything else">
              <textarea rows={4} maxLength={800} value={form.note} onChange={update("note")}
                        placeholder="The night, who else is playing, set length, travel and accommodation."
                        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
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
              {sending ? t("sending") : t("sendTheEnquiry")}
            </button>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
