import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import GlassBar from "./components/GlassBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { LangProvider } from "./lib/lang";

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
function PageFallback() {
  return <div style={{ background: "#F3EBD9", minHeight: "100vh" }} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
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

              {/* Unknown URLs get a real page, not a silent redirect to home. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LangProvider>
    </ErrorBoundary>
  );
}
