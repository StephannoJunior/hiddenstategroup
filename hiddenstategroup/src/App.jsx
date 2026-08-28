import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import GlassBar from "./components/GlassBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { LangProvider } from "./lib/lang";
import { SiteProvider, useSite } from "./lib/site";

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
    <div style={{ background: "#F3EBD9", color: "#16130E", minHeight: "100vh",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'EB Garamond', Georgia, serif", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        <img src="/wordmark-black.png" alt="Hidden State"
             style={{ height: "44px", width: "auto", margin: "0 auto 26px", display: "block" }} />
        <div style={{ borderTop: "2px solid #16130E" }} />
        <div style={{ borderTop: "1px solid #16130E", marginTop: "3px" }} />
        <p style={{ fontSize: "20px", lineHeight: 1.5, marginTop: "26px" }}>
          {site.siteClosedMessage}
        </p>
      </div>
    </div>
  );
}

function PageFallback() {
  return <div style={{ background: "#F3EBD9", minHeight: "100vh" }} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <SiteProvider>
          <ClosedGate>
        <BrowserRouter>
          <ScrollToTop />
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
