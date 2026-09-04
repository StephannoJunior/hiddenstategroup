import { usePageMeta } from "../lib/seo";
import { useSite } from "../lib/site";
import { useLang } from "../lib/lang";
import React, { useEffect, useState } from "react";
import { Nav, Footer, useGoogleFonts, Field, inputStyle,
         IndexBand, PageHead, fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
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
  const site = useSite();
  const { t } = useLang();
  usePageMeta({
    title: "Guest list",
    description: "Request a place on the Hidden State guest list.",
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "", people: 1, age: false });
  const [sent, setSent] = useState(false);
  const [thanks, setThanks] = useState("");

  /*
    ── N05 · WHERE THEY LANDED ─────────────────────────────────────────────
    A place, or a position in a queue. The difference is worth showing: a
    number is something to wait for, and "the list is full" is a door closing.
  */
  const [waiting, setWaiting] = useState(null);

  /*
    ── G09 · WHO SENT THEM ─────────────────────────────────────────────────

    A pass code in the address, put there by the guest who forwarded the link.
    Read once on mount and never shown — the person filling this in has no
    reason to see somebody else's pass code, and being asked "who invited
    you?" is a question people answer wrongly or not at all.

    The server checks it against a live pass, so a made-up value in the
    address stores nothing.
  */
  const [from] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("from") || null; }
    catch { return null; }
  });
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
    const res = await api.submitRequest({ ...form, party: partyId, from });
    setSending(false);
    if (res.ok) {
      // The server returns the line set in the console, so changing it there
      // changes what a guest reads here.
      if (res.message) setThanks(res.message);
      if (res.waiting) setWaiting(res.position || 0);
      setSent(true);
    } else {
      setError(res.error || `Something went wrong. Please email ${CONTACT_EMAIL} instead.`);
    }
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "THE NIGHT", value: partyName ? partyName.toUpperCase() : "TBA" },
        { label: "MOST PER REQUEST", value: String(Math.max(1, Number(site.maxPeoplePerRequest) || 6)) },
        { label: "REPLY BY", value: "EMAIL" },
      ]} />
      <PageHead flush kicker={t("theGuestList")} title={t("askForAPass")}
                sub="ONE REQUEST, ONE ANSWER — BY EMAIL" />

      <section className="max-w-[560px] mx-auto px-[18px] pb-16">

        {sent ? (
          <div className="mt-8 p-8 text-center" style={{ border: "1px solid " + theme.ink }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              {waiting ? t("onTheWaitingList") : t("requestReceived")}
            </p>

            {waiting ? (
              <>
                {/*
                  The number, large, because it is the entire content of this
                  screen. Being told you are ninth is information; being told
                  the list is full is a shrug.
                */}
                <p className="m-0 mt-3" style={{ ...fontDisplay, fontWeight: 300, fontSize: "62px",
                                                 lineHeight: 1, color: theme.ink,
                                                 fontVariantNumeric: "tabular-nums lining-nums" }}>
                  {waiting}
                </p>
                <p className="m-0 mt-1" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.ink2 }}>
                  {t("inTheQueue")}
                </p>
                <p className="m-0 mt-4" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
                  {thanks || "The list is full for this one. If a place comes free you will get your pass by email, in the order people asked."}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 mb-2" style={{ ...fontDisplay, fontWeight: 400, fontSize: "28px", color: theme.ink }}>
                  {t("thankYou")}
                </h2>
                <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
                  {thanks || "We'll be in touch. If you're on the list, your pass arrives by email before the night — keep an eye on your junk folder too."}
                </p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label={t("fullName")}>
              <input required style={inputStyle} value={form.name} onChange={update("name")} />
            </Field>
            <Field label={t("email")}>
              <input required type="email" style={inputStyle} value={form.email} onChange={update("email")} />
            </Field>
            <Field label={t("phone")}>
              <input required type="tel" style={inputStyle} value={form.phone} onChange={update("phone")} />
            </Field>

            <Field label={t("howManyOfYou")}>
              <select style={inputStyle} value={form.people}
                      onChange={(e) => setForm((f) => ({ ...f, people: Number(e.target.value) }))}>
                {/*
                  The largest group is a setting, and the server refuses
                  anything above it. Hardcoding six here meant the form could
                  offer a number the server would then reject — the two have
                  to come from the same place.
                */}
                {Array.from({ length: Math.max(1, Number(site.maxPeoplePerRequest) || 6) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? t("justMe") : `${n} ${t("peopleWord")}`}</option>
                ))}
              </select>
            </Field>

            <Field label={t("anythingToKnow")}>
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
                {150 - form.note.length} {t("charsLeft")}
              </span>
            </Field>

            <label className="flex items-start gap-3 pt-1" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={form.age} onChange={update("age")} style={{ marginTop: "3px" }} />
              <span style={{ ...fontText, fontSize: "16px", lineHeight: 1.5, color: theme.ink }}>
                {t("iConfirmAge")} {minimumAge} {t("orOver")}
              </span>
            </label>

            {error && (
              <p className="m-0 px-3 py-2.5"
                 style={{ ...fontText, fontSize: "15px", color: theme.bad, border: `1px solid ${theme.badLine}` }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={sending} className="px-9 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             background: theme.ink, color: theme.bg, opacity: sending ? 0.6 : 1 }}>
              {sending ? t("sending") : t("askForAPass").toUpperCase()}
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
