import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/*
  PRESS — the two things a publication does that a website usually does not:
  it lays a page out in front of you, and it tells you in the margin where you
  are. Both live here because both are site-wide and neither belongs to any
  one page.
*/

/*
  ── SECTIONS ARRIVE AS YOU REACH THEM ────────────────────────────────────

  There has been a Reveal component in this codebase for months that no page
  ever used, because using it meant wrapping something on fifteen pages and
  keeping every one of them in step. This does the same job from one place and
  needs no page to change.

  THE ORDER OF OPERATIONS IS THE WHOLE SAFETY ARGUMENT.

    1. check the browser can observe, and that motion is wanted
    2. find the sections
    3. ONLY THEN mark them pending (invisible)
    4. observe

  Marked pending first and then finding no observer, the site would be blank.
  Every early return above happens before a single element is hidden, so the
  worst case is a page with no animation — never a page with no content.

  There is also a dead man's switch: everything is forced visible after two
  and a half seconds no matter what the observer did or did not say.
*/
function revealSections(page) {
  const targets = [
    ...page.querySelectorAll(
      ":scope > section, :scope > article, :scope > figure, :scope > div > section"
    ),
  ].filter((el) => el.offsetHeight > 0);

  if (!targets.length) return () => {};

  // The first thing on the page is never animated. Hiding the masthead and
  // opening photograph for a beat is a flash of nothing where the site should
  // already be — the reveal is for what comes AFTER what you can see.
  const rest = targets.slice(1);
  for (const el of rest) el.setAttribute("data-reveal", "pending");

  let batch = 0;
  let frame = 0;

  const show = (el, stagger) => {
    // Delays are capped and reset per frame so a page of twenty sections does
    // not end with a section waiting a second and a half to appear.
    el.style.setProperty("--hs-reveal-delay", `${Math.min(stagger, 3) * 90}ms`);
    el.setAttribute("data-reveal", "in");
  };

  const obs = new IntersectionObserver(
    (entries) => {
      const arriving = entries.filter((e) => e.isIntersecting);
      if (arriving.length && frame !== batch) { batch = frame; }
      arriving.forEach((entry, i) => {
        show(entry.target, i);
        obs.unobserve(entry.target);
      });
      frame += 1;
    },
    // Slightly inside the bottom edge, so a section has started before it is
    // fully on screen and nothing appears to pop into place under your thumb.
    { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
  );

  for (const el of rest) obs.observe(el);

  const failsafe = setTimeout(() => {
    for (const el of rest) el.setAttribute("data-reveal", "in");
  }, 2500);

  return () => { obs.disconnect(); clearTimeout(failsafe); };
}

export function Reveals() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch { /* older Safari; carry on */ }

    let stop = () => {};
    let tries = 0;

    /*
      Pages are loaded on demand, so at the moment the route changes there is
      usually nothing in the document yet. Look again on the next few frames
      rather than guessing at a delay.
    */
    const find = () => {
      const page = document.querySelector("[data-page]");
      if (page) { stop = revealSections(page); return; }
      if (++tries < 90) requestAnimationFrame(find);
    };
    requestAnimationFrame(find);

    return () => stop();
  }, [pathname]);

  return null;
}

/*
  ── THE RUNNING HEAD ─────────────────────────────────────────────────────

  Section name and folio, set vertically in the left margin, the way a book
  puts them in the running head. Only on screens wide enough to have a margin
  — below that the stylesheet hides it, because printing furniture into a
  phone's reading column is just clutter.

  The folio is not a made-up page number. It is how far down this page you
  are, which is the same question a page number answers on paper.
*/
const SECTIONS = [
  ["/records", "RECORDS"], ["/agency", "AGENCY"], ["/artists", "ROSTER"],
  ["/events", "EVENTS"], ["/news", "DISPATCHES"], ["/mixes", "SESSIONS"],
  ["/about", "ABOUT"], ["/contact", "CONTACT"], ["/pool", "THE POOL"],
];

export function Folio() {
  const { pathname } = useLocation();
  const [pct, setPct] = useState(0);

  const name = pathname === "/" ? "HIDDEN STATE"
    : (SECTIONS.find(([p]) => pathname.startsWith(p))?.[1] || "");

  useEffect(() => {
    let ticking = false;
    const read = () => {
      ticking = false;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setPct(h > 40 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0);
    };
    const onScroll = () => {
      // One read per frame. Reading scrollHeight on every scroll event forces
      // the browser to re-measure the whole document, which is the classic way
      // to make a smooth page stutter.
      if (!ticking) { ticking = true; requestAnimationFrame(read); }
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  if (!name) return null;

  return (
    <span className="hs-folio" aria-hidden="true" data-print="hide">
      {name} · {String(Math.round(pct)).padStart(3, "0")}
    </span>
  );
}
