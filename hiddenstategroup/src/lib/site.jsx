import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

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
  siteClosed: false,
  siteClosedMessage: "Back shortly.",
};

const SiteContext = createContext(FALLBACK);

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    api.fetchSiteSettings().then((s) => {
      if (alive && s) setSettings({ ...FALLBACK, ...s });
    });
    return () => { alive = false; };
  }, []);

  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
