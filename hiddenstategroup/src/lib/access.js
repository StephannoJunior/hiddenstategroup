/*
  Access — who can open the door tools.

  ── READ THIS BEFORE RELYING ON IT ────────────────────────────────────────
  This is a lock on a glass door. The passcodes are checked in the browser,
  which means the check itself ships to every visitor. Someone who opens
  developer tools can read what is here or step past the check entirely.

  What it genuinely does:
    • keeps guests and passers-by out of the scanner
    • stops the door tools turning up in Google
    • separates what staff see from what you see

  What it does not do:
    • withstand anyone technical who wants in

  The codes are stored as hashes rather than plain text, so a glance at the
  source does not hand them over — but hashing does not make a client-side
  check secure, and I would rather say so than let it look stronger than it
  is. When the passes move to a server, this same gate calls the server
  instead and becomes a real lock.
*/

export const ROLES = {
  STAFF: {
    id: "STAFF",
    label: "Door staff",
    // Scan and admit. Nothing else — a phone on the door gets lost or
    // borrowed, and it should not be able to wipe the night's record.
    can: { scan: true, seeList: false, seeReasons: false, reset: false },
  },
  OWNER: {
    id: "OWNER",
    label: "Hidden State",
    // Everything: the full list, why people were turned away, and reset.
    can: { scan: true, seeList: true, seeReasons: true, reset: true },
  },
};

/*
  SHA-256 of each passcode. To change one, run this in any browser console:

    crypto.subtle.digest("SHA-256", new TextEncoder().encode("your-code"))
      .then(b => console.log([...new Uint8Array(b)]
        .map(x => x.toString(16).padStart(2,"0")).join("")))

  Trial codes are  door-2026  and  hidden-2026 — change both before a real night.
*/
const HASHES = {
  STAFF: "d147933f8d45b3be460a081c27083efa4208cd75cf53d3f60e88ba2f24fc8d4f",
  OWNER: "3ed54c6113cc525bbeb11e57b6f9efda9600d8dff3133c142910faab5a540037",
};

const SESSION_KEY = "hs-door-role";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/*
  Check a typed code against both roles.

  Every candidate is compared even after a match, so the time taken does not
  reveal which role was hit. That matters less here than it would on a server,
  but it costs nothing to do properly.
*/
export async function roleForCode(code) {
  const digest = await sha256((code || "").trim());
  let found = null;
  for (const [role, hash] of Object.entries(HASHES)) {
    if (digest === hash) found = role;
  }
  return found ? ROLES[found] : null;
}

/*
  The signed-in role lives in sessionStorage, not localStorage: it clears when
  the tab closes. A door phone left on a table should not still be signed in
  the next morning.
*/
export function currentRole() {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id && ROLES[id] ? ROLES[id] : null;
  } catch {
    return null;
  }
}

export function signIn(role) {
  try {
    sessionStorage.setItem(SESSION_KEY, role.id);
  } catch {
    /* private browsing blocks this; the role still holds for this render */
  }
}

export function signOut() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing useful to do */
  }
}
