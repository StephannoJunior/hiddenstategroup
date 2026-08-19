import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Records from "./pages/Records";
import ReleaseDetail from "./pages/ReleaseDetail";
import Agency from "./pages/Agency";
import Artists from "./pages/Artists";
import ArtistProfile from "./pages/ArtistProfile";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import News from "./pages/News";
import NewsArticle from "./pages/NewsArticle";
import Mixes from "./pages/Mixes";
import About from "./pages/About";
import Contact from "./pages/Contact";

// Scrolls to the top of the page on every route change — matches the
// window.scrollTo({ top: 0 }) behavior the original pages used when
// switching between internal views.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/records" element={<Records />} />
        <Route path="/records/:id" element={<ReleaseDetail />} />

        <Route path="/agency" element={<Agency />} />

        <Route path="/artists" element={<Artists />} />
        <Route path="/artists/:id" element={<ArtistProfile />} />

        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />

        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<NewsArticle />} />

        <Route path="/mixes" element={<Mixes />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* Unmatched URLs fall back to the homepage rather than a blank screen. */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
