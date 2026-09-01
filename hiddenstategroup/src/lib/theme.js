/*
  The design tokens live here, on their own, and not inside Shared.jsx.

  WHY THEIR OWN FILE. The console can repaint the site (see applyLook in
  site.jsx), which means the settings provider has to reach the theme object.
  With the tokens inside Shared.jsx that made a circle — Shared imports
  useSite from site.jsx, site.jsx imports theme from Shared — and a circular
  import is the kind of thing that works in development and then hands you an
  undefined at the top of a production bundle. A leaf module with no imports
  of its own cannot take part in a cycle.

  Shared.jsx re-exports everything here, so every page's existing
  `import { theme } from "../components/Shared"` keeps working untouched.
*/
/*
  SLEEVE & INDEX — the design system, 1 Sep 2026.

  The site alternates between two registers and never blends them inside one
  beat. That alternation is the rhythm; it is the whole idea.

    SLEEVE  warm stock, Bodoni cut large, photography full-bleed and duotoned
            into the ink. Where the site sells.
    INDEX   ink bands and hairline grids, Space Mono, numbers worn on the
            outside. Where the site states facts.

  ONE ACCENT. Oxblood, and only oxblood — ink that has soaked into paper.
  Two accents on warm stock go muddy, so black and mono carry the signalling
  that a second colour would otherwise do.

  The token NAMES are unchanged from the broadsheet theme on purpose: every
  page already reads `theme.brass` and `fontDisplay`, so changing the values
  moves the whole site at once and no page has to be touched to get the new
  palette. `brass` is oxblood now. The name is a fossil; renaming it across
  thirteen pages would be churn for nothing.
*/
/*
  The palette. One edition — warm stock, black ink, a single accent.

  A night edition was built here on 1 Sep and taken out again the same day at
  the user's request: it worked, but the control that switched it did not, and
  a half-right way to change how the whole site looks is worse than no way at
  all. What survives from it are the semantic tokens below the first six —
  `sunk`, `onInk` and the four state colours. Those were worth having on their
  own: they replaced seventy-nine colours that had been typed by hand into
  sixteen different files, several of them left over from a theme retired
  weeks earlier.
*/
export const theme = {
  bg: "#EDE4D0",     // stock — dirtier than ivory, closer to board
  ink: "#14120E",    // headline / body / the index bands
  ink2: "#4A443A",   // captions, meta, second-rank body
  rule: "#C9BCA0",   // hairlines
  brass: "#6E2118",  // OXBLOOD. The only accent.
  raised: "#14120E", // image wells

  sunk: "#E5DAC2",   // a surface pressed INTO the paper: notes, wells, cards
  onInk: "#E4D9C2",  // type sitting on an ink ground
  good: "#1E4620",
  warn: "#7A5A2E",
  bad: "#7A2E2E",
  badLine: "#C08A8A",
};

/*
  Type. Three faces, three jobs, no overlap.

    display   Bodoni Moda — high contrast, the sleeve voice. Set LARGE or not
              at all; at small sizes its thin strokes disappear.
    text      EB Garamond — the reading voice, unchanged.
    utility   Space Mono — the index voice. Every number, label and piece of
              metadata on the site.

  Blackletter is gone. It was doing a newspaper's job on a site that is not a
  newspaper, and it never sat with the line logo.
*/
export const fontDisplay = { fontFamily: "'Bodoni Moda', Georgia, serif" };
export const fontText = { fontFamily: "'EB Garamond', Georgia, serif" };
export const fontUtility = { fontFamily: "'Space Mono', ui-monospace, monospace" };
export const fontBody = { fontFamily: "'EB Garamond', Georgia, serif" };
// Page titles across the site read this. Pointing it at Bodoni retires the
// blackletter everywhere in one move.
export const fontMasthead = { fontFamily: "'Bodoni Moda', Georgia, serif", fontWeight: 900, letterSpacing: "-0.02em" };

