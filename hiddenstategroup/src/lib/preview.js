import { useEffect, useState } from "react";

/*
  ── THE PREVIEW, IN ONE PLACE ───────────────────────────────────────────────

  A draft is shown on the REAL site by putting ?preview=<token> on any route.
  The token is fetched once, and whatever record it describes is laid over the
  real data on its way to the page.

  WHY IT IS DONE HERE AND NOT IN EACH PAGE. Every page could check for the
  parameter itself, and every page would then be a place the check could be
  forgotten — and the pages you forget are the ones you preview least, which
  are exactly the ones where a preview would have caught something. There is
  one injection point instead: the useContent hook that every page already
  reads through. A page written next year gets preview for nothing, because it
  is not a thing anybody has to remember to add.

  WHY IT IS THE REAL ROUTE AND NOT A REPRODUCTION. The console could render
  the page's components itself and show them beside the form, and that is
  quicker — it is also a SECOND composition of the page, and a second
  composition drifts. Six months of small changes to the real page and the
  preview is quietly showing something the site stopped doing. This shows the
  site. It cannot drift, because it is not a copy.

  WHAT THIS IS NOT: a way in. The token is fetched from a route that returns
  one draft and nothing else — no list, no author, no neighbouring record —
  and the draft dies when the work is published or discarded, taking the link
  with it.
*/

const PARAM = "preview";

/* Read once, at module load. The address does not change under a preview. */
function tokenFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(PARAM);
  } catch {
    return null;
  }
}

export const PREVIEW_TOKEN = tokenFromUrl();
export const isPreviewing = () => !!PREVIEW_TOKEN;

/*
  One request for the whole page, however many components ask for it. Held as
  a promise rather than a value so that components mounting in the same tick
  share the flight instead of each starting their own.
*/
let flight = null;
export function fetchPreview() {
  if (!PREVIEW_TOKEN) return Promise.resolve(null);
  if (!flight) {
    flight = fetch(`/api/preview/${encodeURIComponent(PREVIEW_TOKEN)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.ok ? { kind: j.kind, ref: j.ref, data: j.data || {} } : null))
      .catch(() => null);
  }
  return flight;
}

export function usePreview() {
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (!PREVIEW_TOKEN) return undefined;
    let alive = true;
    fetchPreview().then((d) => { if (alive) setDraft(d); });
    return () => { alive = false; };
  }, []);
  return draft;
}

/*
  Lay a draft over a list.

  Three cases, and the third is the one that is easy to miss: a draft for a
  record that does not exist yet has to be ADDED, or previewing something new
  shows the page you came from with nothing changed — which reads as the
  preview being broken rather than as the record being new.

  A draft also overrides `published`, because the whole reason to preview is to
  see a thing before anybody else can, and an unpublished record filtered out
  of the list is a blank page.
*/
export function applyDraft(items, kind, draft, keyName) {
  if (!draft || draft.kind !== kind || !draft.data) return items;
  const key = draft.data[keyName];
  if (key === undefined || key === null || key === "") return items;

  const merged = { ...draft.data, published: true, isDraft: true };
  const at = items.findIndex((x) => String(x[keyName]) === String(key));
  if (at === -1) return [...items, merged];

  const out = items.slice();
  out[at] = { ...items[at], ...merged };
  return out;
}

/*
  The banner that has to be on any page being previewed.

  NOT decoration. Without it a draft is indistinguishable from the live site,
  and somebody sent a link will reasonably believe the change is already out —
  or worse, screenshot it as though it were. It says what it is, and it says
  the address is the only reason they can see it.
*/
export function previewNotice() {
  return {
    position: "fixed", left: 0, right: 0, top: 0, zIndex: 200,
    padding: "7px 14px", textAlign: "center",
    background: "#6E2118", color: "#EDE4D0",
    fontFamily: "'Space Mono', ui-monospace, monospace",
    fontSize: "9px", letterSpacing: "0.18em",
    pointerEvents: "none",
  };
}
