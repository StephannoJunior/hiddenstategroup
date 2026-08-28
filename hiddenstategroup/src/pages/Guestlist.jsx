import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { Nav, Footer, useGoogleFonts, Field, inputStyle,
         fontDisplay, fontUtility, fontText, fontMasthead, theme } from "../components/Shared";
import { CONTACT_EMAIL } from "../lib/config";
import * as api from "../lib/api";


/*
  Guest list signup.

  Only three fields are collected, plus an age confirmation. Every extra field
  is one more thing to protect and one more thing exposed if anything goes
  wrong, so nothing is asked for out of habit.

  The age box records what someone claims. It does not verify anything — only
  ID at the door does that, which is why the page says so plainly rather than
  implying the tick is a check.
*/

export default function Guestlist() {
  useGoogleFonts();
  usePageMeta({
    title: "Guest list",
    description: "Request a place on the Hidden State guest list.",
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "", people: 1, age: false });
  const [sent, setSent] = useState(false);
  const [thanks, setThanks] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // The event and its age limit come from the server, so changing them in the
  // console changes this page too.
  const [minimumAge, setMinimumAge] = useState(16);
  const [partyId, setPartyId] = useState(null);
  const [partyName, setPartyName] = useState("");
  useEffect(() => {
    api.nextParty().then((p) => {
      if (!p) return;
      setMinimumAge(p.minimum_age ?? 16);
      setPartyId(p.id);
      setPartyName(`${p.name}${p.date_label ? " — " + p.date_label : ""}`);
    });
  }, []);

  const update = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === "age" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.age) {
      setError(`You must confirm you are ${minimumAge} or over.`);
      return;
    }
    setSending(true);
    const res = await api.submitRequest({ ...form, party: partyId });
    setSending(false);
    if (res.ok) {
      // The server returns the line set in the console, so changing it there
      // changes what a guest reads here.
      if (res.message) setThanks(res.message);
      setSent(true);
    } else {
      setError(res.error || `Something went wrong. Please email ${CONTACT_EMAIL} instead.`);
    }
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[560px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(26px,7vw,44px)" }}>
          Ask for a Pass
        </h1>
        {partyName && (
          <p className="text-center m-0 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            {partyName.toUpperCase()}
          </p>
        )}
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />

        {sent ? (
          <div className="mt-8 p-8 text-center" style={{ border: "1px solid " + theme.ink }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              REQUEST RECEIVED
            </p>
            <h2 className="mt-3 mb-2" style={{ ...fontDisplay, fontWeight: 400, fontSize: "28px", color: theme.ink }}>
              Thank you.
            </h2>
            <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
              {thanks || "We'll be in touch. If you're on the list, your pass arrives by email before the night — keep an eye on your junk folder too."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="Full name">
              <input required style={inputStyle} value={form.name} onChange={update("name")} />
            </Field>
            <Field label="Email">
              <input required type="email" style={inputStyle} value={form.email} onChange={update("email")} />
            </Field>
            <Field label="Phone">
              <input required type="tel" style={inputStyle} value={form.phone} onChange={update("phone")} />
            </Field>

            <Field label="How many of you">
              <select style={inputStyle} value={form.people}
                      onChange={(e) => setForm((f) => ({ ...f, people: Number(e.target.value) }))}>
                {[1,2,3,4,5,6].map((n) => (
                  <option key={n} value={n}>{n === 1 ? "Just me" : `${n} people`}</option>
                ))}
              </select>
            </Field>

            <Field label="Anything we should know">
              <textarea
                rows={3}
                maxLength={150}
                value={form.note}
                onChange={update("note")}
                placeholder="Birthday, plus-one, press, working the night — anything useful."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
              <span className="block text-right mt-1"
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                {150 - form.note.length} LEFT
              </span>
            </Field>

            <label className="flex items-start gap-3 pt-1" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={form.age} onChange={update("age")} style={{ marginTop: "3px" }} />
              <span style={{ ...fontText, fontSize: "16px", lineHeight: 1.5, color: theme.ink }}>
                I confirm I am {minimumAge} or over. ID may be requested at the door.
              </span>
            </label>

            {error && (
              <p className="m-0 px-3 py-2.5"
                 style={{ ...fontText, fontSize: "15px", color: "#7A2E2E", border: "1px solid #C08A8A" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={sending} className="px-9 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             background: theme.ink, color: theme.bg, opacity: sending ? 0.6 : 1 }}>
              {sending ? "SENDING…" : "ASK FOR A PASS"}
            </button>

            <p className="m-0 pt-2" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.55, color: theme.ink }}>
              We'll look at every request. If you're on the list, your pass
              arrives by email before the night.
            </p>

            <p className="m-0" style={{ ...fontText, fontSize: "14px", lineHeight: 1.55, color: theme.ink2 }}>
              We use your details only to issue and check your pass. We don't
              share them, and you can ask us to delete them at any time by
              emailing {CONTACT_EMAIL}.
            </p>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
