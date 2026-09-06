import { useEffect, useState } from "react";
import * as api from "./api";
import { usePreview, applyDraft } from "./preview";

/*
  ── PAGES BUILT IN THE CONSOLE ──────────────────────────────────────────────

  Read the same way the roster and the catalogue are read, through one hook,
  which is what gets them previews for nothing: applyDraft is the same
  function, so an unpublished page opened with ?preview=<token> behaves
  exactly like an unpublished artist.

  The empty array is the honest fallback. There is no bundled copy of these to
  fall back to — a site that has never had a built page should render as a
  site that has never had one, not as a flash of something stale.
*/
export function usePages() {
  const [pages, setPages] = useState([]);
  const draft = usePreview();

  useEffect(() => {
    let alive = true;
    api.listContent("pages").then((res) => {
      if (alive && res.ok) setPages(res.items || []);
    });
    return () => { alive = false; };
  }, []);

  return applyDraft(pages, "pages", draft, "slug");
}

/*
  Blocks dropped into a named place on a page that already exists.

  `where` is the place — "home:top", "about:bottom". One request for the whole
  table rather than one per slot: there are a handful of them, they are tiny,
  and a page with three slots would otherwise make three round trips to learn
  that two of them are empty.
*/
export function useSlot(where) {
  const [all, setAll] = useState([]);
  const draft = usePreview();

  useEffect(() => {
    let alive = true;
    api.listContent("slots").then((res) => {
      if (alive && res.ok) setAll(res.items || []);
    });
    return () => { alive = false; };
  }, []);

  const merged = applyDraft(all, "slots", draft, "id");
  const found = merged.find((s) => s.id === where);
  return found && Array.isArray(found.blocks) ? found.blocks : [];
}

/*
  THE PLACES BLOCKS MAY GO on the pages that were built by hand.

  A short, named list rather than "anywhere", for the same reason the block
  kit has no HTML block: the existing pages are the part of this site that is
  actually designed, and an arbitrary insertion point is a way to interrupt a
  composition halfway through. These are the two seams where something extra
  genuinely belongs — under the opening, and before the footer.
*/
export const SLOTS = [
  { id: "home:top", page: "Home", label: "Under the opening" },
  { id: "home:bottom", page: "Home", label: "Before the footer" },
  { id: "about:bottom", page: "About", label: "Before the footer" },
  { id: "agency:bottom", page: "Agency", label: "Before the footer" },
  { id: "events:top", page: "Events", label: "Above the list" },
  { id: "records:bottom", page: "Records", label: "Before the footer" },
];
