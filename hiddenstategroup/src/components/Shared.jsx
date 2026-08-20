import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Search } from "lucide-react";
import { MARK_SJ, MARK_SEAL, MARK_NOPROBLEM } from "../lib/marks";
import { ARTISTS } from "../lib/data";
import { SOCIAL } from "../lib/social";
import { LiveDateline, LanguageSwitch } from "./Dateline";
import { FORM_ENDPOINT, CONTACT_EMAIL, BOOKING_EMAIL } from "../lib/config";

/*
  HIDDEN STATE — Design tokens (dark editorial + vintage press hybrid)
  Color:
    --bg:      #0A0A09  (warm near-black, not pure black)
    --bg-2:    #131211  (raised surface)
    --fg:      #F4F1EA  (off-white, warm — "newsprint on black")
    --fg-dim:  #8C887E  (muted warm grey for meta text)
    --line:    #2A2823  (hairline borders)
    --accent:  #B98A2E  (muted brass/gold — used only for tiny marks: live dot,
                          underline on hover, category rule. Never large fills.)
  Type:
    Masthead — 'UnifrakturCook' (blackletter, used ONLY for the wordmark and
                                  the press-strip: "the paper's nameplate")
    Display  — 'Fraunces' (serif, optical, high-fashion editorial headlines)
    Utility  — 'Space Grotesk' (tracked-out caps for nav/labels/meta)
    Body     — 'Inter' (article copy, readable at small sizes)

  This file holds every component reused across all pages: the press-strip
  nav, footer, wordmark, stamps, grain texture and scroll-reveal wrapper.
  Every page imports from here instead of redefining its own copy.
*/

export const fontDisplay = { fontFamily: "'Fraunces', serif" };
// Broadsheet on paper — the demo-8 look, which is the approved main theme.
// Warm ivory stock, ink text, hairline rules, blackletter only for mastheads.
export const theme = {
  bg: "#F3EBD9",     // stock
  ink: "#16130E",    // headline / body
  ink2: "#463F35",   // captions, meta
  rule: "#C4B593",   // hairlines
  brass: "#8A6A28",  // accents, italics
  raised: "#16130E", // image wells
};
export const fontText = { fontFamily: "'EB Garamond', Georgia, serif" };
export const fontUtility = { fontFamily: "'Space Grotesk', sans-serif" };
export const fontBody = { fontFamily: "'Inter', sans-serif" };
export const fontMasthead = { fontFamily: "'UnifrakturCook', serif" };

export function useGoogleFonts() {
  useEffect(() => {
    const id = "hs-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Space+Grotesk:wght@400;500;600&family=Inter:wght@400;500&family=UnifrakturCook:wght@700&display=swap";
    document.head.appendChild(link);
  }, []);
}

export function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function GrainOverlay() {
  // NOTE: this used mixBlendMode:"overlay" on a fixed full-screen layer.
  // On iOS that blends against black and darkens the whole page — it was the
  // cause of the "everything looks dark" bug. Never reintroduce a blend mode here.
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{
        opacity: 0.035,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

export function DoubleRule({ className = "" }) {
  return (
    <div className={className}>
      <div style={{ borderTop: "2px solid #2A2823" }} />
      <div style={{ borderTop: "1px solid #2A2823", marginTop: "3px" }} />
    </div>
  );
}

export function Wordmark({ size = "h-9", dark = false }) {
  // The official line logo. `dark` picks the ink version for paper backgrounds.
  return (
    <img loading="lazy" decoding="async"
      src={dark ? "/wordmark-black.png" : "/wordmark.png"}
      alt="Hidden State"
      className={`${size} w-auto block`}
    />
  );
}

export function StampTag({ children, tone = "accent" }) {
  const color = tone === "accent" ? "#B98A2E" : "#F4F1EA";
  return (
    <span
      className="inline-flex items-center px-2 py-[3px] border"
      style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color, borderColor: color === "#B98A2E" ? "#4A3B1C" : "#2A2823" }}
    >
      {children}
    </span>
  );
}

export function MarkClipping({ src, alt, w = 92 }) {
  return (
    <div
      className="shrink-0 p-2"
      style={{ background: "#E9DCC3", border: "1px solid #2A2823" }}
    >
      <img loading="lazy" decoding="async" src={src} alt={alt} style={{ width: w, display: "block" }} />
    </div>
  );
}

export function PressStrip() {
  // Marks only — the blackletter wordmark that used to sit in the middle is gone.
  return (
    <div className="hidden md:flex items-center justify-center gap-5 py-1.5" style={{ borderBottom: "1px solid #C4B593" }}>
      <MarkClipping src={MARK_SJ} alt="SJ" w={34} />
      <MarkClipping src={MARK_SEAL} alt="Hidden State" w={60} />
      <MarkClipping src={MARK_NOPROBLEM} alt="No Problem" w={52} />
    </div>
  );
}

export const NAV_ITEMS = [
  { label: "NEWS", href: "/news", desc: "Music & Culture" },
  { label: "RECORDS", href: "/records", desc: "Releases & Label" },
  { label: "AGENCY", href: "/agency", desc: "Booking & Representation" },
  { label: "ARTISTS", href: "/artists", desc: "Artist Roster" },
  { label: "EVENTS", href: "/events", desc: "Events & Experiences" },
  { label: "MIXES", href: "/mixes", desc: "Sessions & Radio" },
  { label: "ABOUT", href: "/about", desc: "The Ecosystem" },
];

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; }, [mobileOpen]);

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40"
        style={{ background: theme.bg, borderBottom: `1px solid ${theme.ink}` }}
      >
        <div className="max-w-[1180px] mx-auto px-[18px] h-[76px] flex items-center justify-center relative">
          <Link to="/"><Wordmark size="h-[38px]" dark /></Link>
          <button
            className="lg:hidden absolute right-[64px] top-1/2 -mt-[7px] w-[22px] h-[14px]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} color={theme.ink} strokeWidth={1.5} /> : <Menu size={20} color={theme.ink} strokeWidth={1.5} />}
          </button>
          <span className="absolute left-[18px] hidden md:inline">
            <LiveDateline />
          </span>
          <span className="absolute right-[18px] lg:hidden">
            <LanguageSwitch compact />
          </span>
          <nav className="hidden lg:flex items-center gap-7 absolute right-[18px]">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="text-[10.5px] pb-0.5"
                style={{
                  ...fontUtility, letterSpacing: "0.16em",
                  color: isActive(item.href) ? theme.brass : theme.ink2,
                  borderBottom: `2px solid ${isActive(item.href) ? theme.brass : "transparent"}`,
                }}
              >
                {item.label}
              </Link>
            ))}
            <LanguageSwitch />
          </nav>
        </div>
      </header>

      <div
        className="fixed inset-0 z-30 lg:hidden transition-opacity duration-200"
        style={{ background: theme.bg, opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "auto" : "none" }}
      >
        <div className="h-full flex flex-col justify-center px-8">
          {NAV_ITEMS.map((item, i) => (
            <Link key={item.label} to={item.href} onClick={() => setMobileOpen(false)}
              className="py-4 flex items-baseline justify-between" style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontDisplay, fontSize: "30px", color: theme.ink }}>{item.label}</span>
              <span style={{ ...fontUtility, fontSize: "10px", color: theme.brass, letterSpacing: "0.1em" }}>0{i + 1}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function Footer() {
  return (
    <footer style={{ background: theme.bg, borderTop: `2px solid ${theme.ink}` }}>
      <div className="max-w-[1180px] mx-auto px-[18px] pt-10 pb-16">
        <div className="flex flex-col items-center text-center gap-4">
          <Wordmark size="h-8" dark />
          <p style={{ ...fontUtility, color: theme.ink2, fontSize: "9.5px", letterSpacing: "0.2em" }}>
            RECORDS · AGENCY · BOOKING · EVENTS · ARTISTS
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Instagram account={SOCIAL.official} />
            <Instagram account={SOCIAL.group} />
          </div>
          <LiveDateline />
          <p style={{ ...fontUtility, color: theme.ink2, fontSize: "9.5px", letterSpacing: "0.2em" }}>
            © 2026 HIDDEN STATE — ALL RIGHTS RESERVED
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---- Shared booking-request form (used by the Agency and Artists pages) ----

export const EVENT_TYPES = ["Club Night", "Festival", "Private Event", "Corporate", "Other"];
export const ATTENDANCE = ["Under 200", "200\u2013500", "500\u20132,000", "2,000\u201310,000", "10,000+"];
export const BUDGETS = ["Under \u20ac2,000", "\u20ac2,000\u20135,000", "\u20ac5,000\u201315,000", "\u20ac15,000\u201350,000", "\u20ac50,000+"];

const initialForm = {
  fullName: "", company: "", email: "", phone: "",
  eventName: "", eventDate: "", eventLocation: "", country: "",
  artist: "", eventType: "", attendance: "", budget: "", message: "",
};

export function Field({ label, children }) {
  return (
    <label className="block">
      <span style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.1em", color: theme.ink2 }}>{label.toUpperCase()}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputStyle = {
  ...fontText, width: "100%", background: "transparent", border: "1px solid " + theme.rule,
  color: theme.ink, padding: "10px 12px", fontSize: "14px", outline: "none",
};

export function BookingDrawer({ open, onClose, artist }) {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...initialForm, artist: artist ? artist.name : "" }));
      setSubmitted(false);
      setError("");
    }
  }, [open, artist]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // No endpoint configured yet — tell the truth rather than fake a success.
    if (!FORM_ENDPOINT) {
      setError(`This form isn't connected yet. Please email ${BOOKING_EMAIL} directly.`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...form,
          _subject: `Booking request — ${form.artist || "Hidden State"}`,
          _deliverTo: BOOKING_EMAIL,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError(`Something went wrong sending that. Please email ${BOOKING_EMAIL} instead.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: open ? "auto" : "none" }}>
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(10,10,9,0.7)", opacity: open ? 1 : 0 }}
      />
      <div
        className="absolute top-0 right-0 h-full w-full md:w-[520px] overflow-y-auto transition-transform duration-[400ms]"
        style={{ background: theme.bg, borderLeft: "1px solid " + theme.ink, transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.ink }}>
          <div>
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.brass }}>BOOK AN ARTIST</span>
            <h2 className="mt-1 text-[22px]" style={{ ...fontDisplay, fontStyle: "italic", fontWeight: 500, color: theme.ink }}>
              {artist ? artist.name : "Hidden State Agency"}
            </h2>
            <a href={`mailto:${BOOKING_EMAIL}`} className="mt-1 inline-block"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em", color: theme.ink2 }}>
              {BOOKING_EMAIL}
            </a>
          </div>
          <button onClick={onClose} style={{ color: theme.ink }}><X size={22} strokeWidth={1.5} /></button>
        </div>

        {submitted ? (
          <div className="p-8 md:p-10">
            <StampTag>REQUEST SENT</StampTag>
            <h3 className="mt-5 text-[26px]" style={{ ...fontDisplay, fontWeight: 500, color: theme.ink }}>
              Thank you.
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed max-w-sm" style={{ ...fontText, color: theme.ink2 }}>
              Your booking request has been received. The Hidden State Agency team will be in touch within 48 hours to discuss availability and next steps.
            </p>
            <button
              onClick={onClose}
              className="mt-8 text-[12px] tracking-[0.16em] px-6 py-3 border"
              style={{ ...fontUtility, color: theme.ink, borderColor: theme.ink }}
            >
              CLOSE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name"><input required style={inputStyle} value={form.fullName} onChange={update("fullName")} /></Field>
              <Field label="Company / Organization"><input style={inputStyle} value={form.company} onChange={update("company")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email"><input required type="email" style={inputStyle} value={form.email} onChange={update("email")} /></Field>
              <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={update("phone")} /></Field>
            </div>
            <Field label="Event Name"><input style={inputStyle} value={form.eventName} onChange={update("eventName")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Date"><input type="date" style={inputStyle} value={form.eventDate} onChange={update("eventDate")} /></Field>
              <Field label="Country"><input style={inputStyle} value={form.country} onChange={update("country")} /></Field>
            </div>
            <Field label="Event Location"><input style={inputStyle} value={form.eventLocation} onChange={update("eventLocation")} /></Field>
            <Field label="Artist">
              <select required style={inputStyle} value={form.artist} onChange={update("artist")}>
                <option value="" disabled>Select artist</option>
                {ARTISTS.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Type">
                <select style={inputStyle} value={form.eventType} onChange={update("eventType")}>
                  <option value="">Select</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Expected Attendance">
                <select style={inputStyle} value={form.attendance} onChange={update("attendance")}>
                  <option value="">Select</option>
                  {ATTENDANCE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Budget Range">
              <select style={inputStyle} value={form.budget} onChange={update("budget")}>
                <option value="">Select</option>
                {BUDGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Message">
              <textarea rows={4} style={{ ...inputStyle, resize: "none" }} value={form.message} onChange={update("message")} />
            </Field>
            {error && (
              <p className="text-[12.5px] leading-relaxed px-3 py-2.5 border" style={{ ...fontBody, color: "#E8B4B4", borderColor: "#5A2A2A", background: "#1A1010" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full mt-2 text-[12px] tracking-[0.16em] py-4"
              style={{ ...fontUtility, color: theme.bg, background: theme.ink, opacity: sending ? 0.6 : 1, cursor: sending ? "wait" : "pointer" }}
            >
              {sending ? "SENDING…" : "SEND BOOKING REQUEST"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Shared news-grid pieces (used by the Home and News pages) ----

export const CATEGORIES = ["ALL", "MUSIC", "ARTISTS", "RELEASES", "EVENTS", "INTERVIEWS", "INDUSTRY", "EXCLUSIVE"];

export const spanClasses = {
  lg: "md:col-span-4 md:row-span-2",
  md: "md:col-span-3 md:row-span-1",
  wide: "md:col-span-6 md:row-span-1",
};

export function ArticleCard({ article }) {
  return (
    <Link
      to={`/news/article-${article.id}`}
      className="group relative flex flex-col overflow-hidden h-full"
    >
      <div className={`relative overflow-hidden ${article.span === "wide" ? "aspect-[21/9]" : article.span === "lg" ? "aspect-[4/5] md:aspect-auto md:h-full md:min-h-[420px]" : "aspect-[4/3]"}`}>
        <img loading="lazy" decoding="async"
          src={article.image}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(10,10,9,0) 50%, rgba(10,10,9,0.85) 100%)" }}
        />
        <div className="absolute left-0 right-0 bottom-0 p-5 md:p-6">
          <div className="mb-3">
            <StampTag>{article.category}</StampTag>
          </div>
          <h3
            className={`${article.span === "lg" ? "text-[26px] md:text-[32px]" : "text-[20px] md:text-[22px]"} leading-[1.1] mb-2`}
            style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}
          >
            {article.headline}
          </h3>
          <p
            className={`${article.span === "lg" ? "block" : "hidden md:block"} text-[13px] leading-relaxed mb-3 max-w-md`}
            style={{ ...fontBody, color: "#C7C3B8" }}
          >
            {article.excerpt}
          </p>
          <div className="flex items-center gap-3" style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.08em", color: "#8C887E" }}>
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CategoryBar({ active, setActive }) {
  return (
    <div className="border-b sticky top-16 md:top-[112px] z-30" style={{ borderColor: "#2A2823", background: "#0A0A09" }}>
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="flex items-center gap-6 md:gap-8 overflow-x-auto no-scrollbar py-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className="shrink-0 text-[12px] tracking-[0.14em] pb-1 border-b transition-colors"
              style={{
                ...fontUtility,
                color: active === cat ? "#F4F1EA" : "#8C887E",
                borderColor: active === cat ? "#B98A2E" : "transparent",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Instagram ----
// Renders "@handle" and links to the account. Pass an entry from SOCIAL.
export function Instagram({ account, size = "10px", color = null }) {
  if (!account) return null;
  return (
    <a
      href={account.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block pb-0.5"
      style={{
        ...fontUtility,
        fontSize: size,
        letterSpacing: "0.14em",
        color: color || theme.ink,
        borderBottom: "1px solid " + theme.brass,
      }}
    >
      {account.handle}
    </a>
  );
}
