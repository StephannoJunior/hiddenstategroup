import React, { useState } from "react";
import { fontText, fontUtility, theme } from "../../components/Shared";

/*
  ── THE CONSOLE'S FURNITURE ─────────────────────────────────────────────────

  The four or five things every panel is built out of. They live here for the
  same reason worker/lib/core.js exists: a panel in its own file must not
  import Console.jsx, or the two point at each other and the cycle works right
  up until the day the evaluation order shifts.
*/
export function Notice({ message, tone = "bad" }) {
  if (!message) return null;
  const colour = tone === "good" ? theme.good : theme.bad;
  return (
    <p className="m-0 mt-3 px-3 py-2.5"
       style={{ ...fontText, fontSize: "15px", color: colour, border: `1px solid ${colour}55` }}>
      {message}
    </p>
  );
}

export function Section({ title, children, onSave, saving, saved }) {
  /*
    A save button at the FOOT OF EVERY SECTION, not only at the bottom of the
    page. Changing one thing in the first group meant scrolling past forty
    controls to reach a single button, and a long scroll between a decision
    and its confirmation is how people end up unsure whether it saved at all.

    Every button saves the whole settings object, so it does not matter which
    one is pressed — what matters is that one is always within reach.
  */
  return (
    <div className="mt-7" id={sectionId(title)} style={{ scrollMarginTop: "132px" }}>
      <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        {title}
      </p>
      {children}
      {onSave && (
        <div className="flex items-center gap-4 mt-4">
          <button onClick={onSave} disabled={saving}
                  style={{ ...btn, opacity: saving ? 0.6 : 1 }}>
            {saving ? "SAVING…" : "SAVE"}
          </button>
          {saved && (
            <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
              SAVED
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const btn = {
  ...fontUtility, fontSize: "10px", letterSpacing: "0.18em",
  background: theme.ink, color: theme.bg, border: 0, padding: "12px 20px", cursor: "pointer",
};

export const ghost = { ...btn, background: "transparent", color: theme.ink, border: `1px solid ${theme.ink}` };

export const sectionId = (title) =>
  "s-" + String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
