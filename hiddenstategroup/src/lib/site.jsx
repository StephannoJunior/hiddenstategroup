import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";
import { theme } from "./theme";

/*
  Site settings, fetched once and shared.

  These are the values you change in the console that the public site reads —
  the banner, the countdown, the notes under the lists. Fetching once at the
  top and sharing means changing one setting does not mean twelve pages each
  asking the server separately.

  Every value has a fallback, so the site renders correctly before the fetch
  lands and continues working if the request fails entirely. A settings
  service being unreachable should never mean a blank page.
*/

const FALLBACK = {
  announcement: "",
  announcementLink: "",
  showCountdown: true,
  countdownTarget: "2026-12-13T00:00:00+02:00",
  countdownLabel: "COUNTING DOWN TO 13.12.2026",
  rosterNote: "More DJs and producers will join.",
  eventsNote: "More events to come.",
  contactEmail: "info@hiddenstategroup.com",
  bookingEmail: "booking@hiddenstategroup.com",
  guestListLinkVisible: true,
  guestListOpen: true,
  barTabWidth: 64,
  barLabelSize: 7.5,
  barShowLabels: true,
  siteClosed: false,
  siteClosedMessage: "Back shortly.",

  paperTone: "BOARD",
  accentTone: "OXBLOOD",
  grainStrength: "NORMAL",
  photoHalftone: true,
  photoDuotone: true,
  heroImage: "club",
  heroHeightVw: 46,
  showContactSheet: true,
  storyHeadline: "",
  closingLine: "",
  footerNote: "",
};

/*
  ── APPLYING THE LOOK ──────────────────────────────────────────────────────

  Every page reads its colours from the `theme` object, imported by reference
  and spread into inline styles. Inline styles beat any stylesheet, so a CSS
  variable could not reach them — the only way a console setting can repaint
  the site is to change what `theme` itself holds and then re-render.

  So that is what happens: the object's own keys are rewritten in place, and
  the provider bumps its state, which re-renders everything below it. Nothing
  is memoised in this tree, so everything picks up the new values on the way
  down.

  The grain is different — it lives in a stylesheet — so it is handed over as
  a custom property instead.
*/
const PAPERS = { BOARD: "#EDE4D0", IVORY: "#F3EBD9", BONE: "#E6DFD2" };
const ACCENTS = { OXBLOOD: "#6E2118", BRASS: "#8A6A28", INK: "#14120E" };
const GRAIN = { NONE: 0, LIGHT: 0.03, NORMAL: 0.062, HEAVY: 0.1 };

function grainUrl(opacity) {
  if (!opacity) return "none";
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='${opacity}'/%3E%3C/svg%3E")`;
}

function applyLook(s) {
  theme.bg = PAPERS[s.paperTone] || PAPERS.BOARD;
  theme.brass = ACCENTS[s.accentTone] || ACCENTS.OXBLOOD;
  try {
    const root = document.documentElement;
    root.style.setProperty("--hs-grain", grainUrl(GRAIN[s.grainStrength] ?? GRAIN.NORMAL));
    /*
      The stylesheet cannot see the theme object, so the tokens it needs are
      published as custom properties. Every rule that reads one also carries a
      literal fallback, so the site is still correct in the instant before
      this runs — and would be correct even if it never did.
    */
    root.style.setProperty("--hs-paper", theme.bg);
    root.style.setProperty("--hs-ink", theme.ink);
    root.style.setProperty("--hs-ink2", theme.ink2);
    root.style.setProperty("--hs-rule", theme.rule);
    root.style.setProperty("--hs-sunk", theme.sunk);
    root.style.setProperty("--hs-accent", theme.brass);
    document.body.style.background = theme.bg;
  } catch {
    /* nothing to do before the document exists */
  }
}

const SiteContext = createContext(FALLBACK);

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);

  /*
    Fetched at boot, and again whenever the console saves.

    Without the second half, saving a setting changed the server and nothing
    else: the banner, the countdown and the bar kept their old values in the
    tab that had just been used to change them, which reads as the save having
    silently failed.
  */
  useEffect(() => {
    let alive = true;

    const load = () => {
      api.fetchSiteSettings().then((s) => {
        if (!alive || !s) return;
        const merged = { ...FALLBACK, ...s };
        applyLook(merged);
        setSettings(merged);
      });
    };

    // The defaults have to be on the page before the first paint too, or the
    // site flashes the built-in palette for as long as the fetch takes.
    applyLook(FALLBACK);

    load();
    window.addEventListener(api.SETTINGS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(api.SETTINGS_EVENT, load);
    };
  }, []);

  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
