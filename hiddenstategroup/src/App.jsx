import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import GlassBar from "./components/GlassBar";
import ErrorBoundary from "./components/ErrorBoundary";
import Mark from "./components/Mark";
import { LangProvider } from "./lib/lang";
import { SiteProvider, useSite } from "./lib/site";
import { countView } from "./lib/api";
import { Reveals, Folio } from "./components/Press";
import { theme } from "./lib/theme";

/*
  Pages are loaded on demand rather than all at once.

  Before this, someone opening the Contact page still downloaded the news
  index, the roster, the record sleeves and the gallery code before seeing
  anything. Each page now arrives as its own small file when it is actually
  needed, so the first view is considerably lighter.
*/
const Home = lazy(() => import("./pages/Home"));
const Records = lazy(() => import("./pages/Records"));
const Agency = lazy(() => import("./pages/Agency"));
const Artists = lazy(() => import("./pages/Artists"));
const ArtistProfile = lazy(() => import("./pages/ArtistProfile"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const News = lazy(() => import("./pages/News"));
const NewsArticle = lazy(() => import("./pages/NewsArticle"));
const Mixes = lazy(() => import("./pages/Mixes"));
const MixArtist = lazy(() => import("./pages/MixArtist"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const SongPool = lazy(() => import("./pages/SongPool"));
const Demos = lazy(() => import("./pages/Demos"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Wall = lazy(() => import("./pages/Wall"));
const Kit = lazy(() => import("./pages/Kit"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Passes — kept out of the main navigation deliberately. A guest reaches
// their pass by link, and door staff reach the scanner by a bookmark.
const Pass = lazy(() => import("./pages/Pass"));
const MyPass = lazy(() => import("./pages/MyPass"));
const Scan = lazy(() => import("./pages/Scan"));
const Guestlist = lazy(() => import("./pages/Guestlist"));
const PassList = lazy(() => import("./pages/PassList"));
const Admin = lazy(() => import("./pages/Admin"));
const Console = lazy(() => import("./pages/Console"));
const TeamLogin = lazy(() => import("./pages/TeamLogin"));

// Scrolls to the top of the page on every route change — matches the
// window.scrollTo({ top: 0 }) behaviour the original pages used when
// switching between internal views.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/*
  Counts one view per page arrived at.

  The door tools and the console are left out on purpose: those are your own
  traffic, and mixing staff into the numbers is how a readership figure stops
  meaning anything. A guest's own pass is left out for the same reason it is
  kept out of the navigation — it is private, not editorial.
*/
const UNCOUNTED = ["/console", "/scan", "/doorlist", "/admin", "/guestlist", "/admins-staff-boss", "/mypass"];

function CountViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (UNCOUNTED.some((p) => pathname.startsWith(p))) return;
    countView(pathname);
  }, [pathname]);
  return null;
}

/*
  ── ARRIVING BEFORE YOU ASK ──────────────────────────────────────────────

  Pages are loaded on demand, which makes the first view light and every
  later one wait — tap a tab and the phone fetches a file before anything
  can be drawn. On a good connection that is a blink; at a venue it is a
  second of nothing, and a second of nothing reads as a broken tap.

  So the moment a finger lands on a link, or a cursor rests on one, the page
  behind it starts loading. The download overlaps the time between touching
  and lifting — 80 to 150 milliseconds that were previously spent doing
  nothing — and by the time the route actually changes the file is usually
  already there.

  IT COSTS ALMOST NOTHING WHEN IT IS WRONG. A guess that is not followed is
  one small file in the cache that would probably have been wanted later
  anyway. Each route is fetched at most once; `seen` makes a second touch on
  the same link free.

  pointerdown rather than click on purpose: click fires after the finger
  lifts, by which time the navigation is already happening and there is
  nothing left to overlap.
*/
const PREFETCH = {
  "/": () => import("./pages/Home"),
  "/records": () => import("./pages/Records"),
  "/agency": () => import("./pages/Agency"),
  "/artists": () => import("./pages/Artists"),
  "/events": () => import("./pages/Events"),
  "/news": () => import("./pages/News"),
  "/mixes": () => import("./pages/Mixes"),
  "/about": () => import("./pages/About"),
  "/contact": () => import("./pages/Contact"),
  "/pool": () => import("./pages/SongPool"),
  "/mypass": () => import("./pages/MyPass"),
  "/console": () => import("./pages/Console"),
  "/scan": () => import("./pages/Scan"),
  "/doorlist": () => import("./pages/PassList"),
  "/guestlist": () => import("./pages/Guestlist"),
};

function Prefetcher() {
  useEffect(() => {
    const seen = new Set();

    const warm = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return;

      // Detail routes share a chunk with their index, so the first segment is
      // enough — /news/anything is answered by the /news entry.
      const path = href.split("?")[0];
      const key = PREFETCH[path] ? path : "/" + (path.split("/")[1] || "");
      const load = PREFETCH[key];
      if (!load || seen.has(key)) return;
      seen.add(key);
      load().catch(() => seen.delete(key));   // offline: let it try again later
    };

    document.addEventListener("pointerdown", warm, { passive: true, capture: true });
    document.addEventListener("pointerover", warm, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", warm, { capture: true });
      document.removeEventListener("pointerover", warm, { capture: true });
    };
  }, []);
  return null;
}

// Shown for the moment a page file is in flight. Deliberately just the paper
// colour: a spinner that flashes for 80ms is more distracting than nothing.
/*
  The holding page.

  Deliberately does NOT cover the door tools or a guest's own pass: taking the
  public site down mid-night must never strand someone at the door or leave a
  guest unable to show their ticket.
*/
function ClosedGate({ children }) {
  const site = useSite();
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const stillWorks = ["/pass/", "/mypass", "/scan", "/doorlist", "/console", "/admin", "/admins-staff-boss"]
    .some((p) => path.startsWith(p));

  if (!site.siteClosed || stillWorks) return children;

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: "100vh",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'EB Garamond', Georgia, serif", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        {/* Outlines, so the holding page is sharp on every screen and needs
            no image request on the one page most likely to be reached when
            something is already wrong. */}
        <Mark height={44} color={theme.ink} style={{ margin: "0 auto 26px" }} />
        <div style={{ borderTop: `2px solid ${theme.ink}` }} />
        <div style={{ borderTop: `1px solid ${theme.ink}`, marginTop: "3px" }} />
        <p style={{ fontSize: "20px", lineHeight: 1.5, marginTop: "26px" }}>
          {site.siteClosedMessage}
        </p>
      </div>
    </div>
  );
}

function PageFallback() {
  return <div style={{ background: theme.bg, minHeight: "100vh" }} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <SiteProvider>
          <ClosedGate>
        <BrowserRouter>
          <ScrollToTop />
          <CountViews />
          <Prefetcher />
          <Reveals />
          <Folio />
          <GlassBar />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />

              <Route path="/records" element={<Records />} />

              <Route path="/agency" element={<Agency />} />

              <Route path="/artists" element={<Artists />} />
              <Route path="/artists/:id" element={<ArtistProfile />} />

              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />

              <Route path="/news" element={<News />} />
              <Route path="/news/:slug" element={<NewsArticle />} />

              <Route path="/mixes" element={<Mixes />} />
              <Route path="/mixes/:slug" element={<MixArtist />} />

              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/pool" element={<SongPool />} />
              <Route path="/demos" element={<Demos />} />
              <Route path="/bookings" element={<Bookings />} />

              {/*
                Two pages reached only by a link nobody can guess — a headcount
                on a screen in the corner of a room, and an artist's press kit
                sent to a promoter. Neither has a way in from the site, and
                neither is in the sitemap: the token in the address is the
                whole of the authorisation, so a page that advertises its own
                existence is a page inviting people to try tokens.
              */}
              <Route path="/wall/:token" element={<Wall />} />
              <Route path="/kit/:token" element={<Kit />} />

              <Route path="/pass/:code" element={<Pass />} />
              <Route path="/mypass" element={<MyPass />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/guestlist" element={<Guestlist />} />
              <Route path="/doorlist" element={<PassList />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/console" element={<Console />} />
              <Route path="/admins-staff-boss" element={<TeamLogin />} />

              {/* Unknown URLs get a real page, not a silent redirect to home. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
          </ClosedGate>
        </SiteProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}
