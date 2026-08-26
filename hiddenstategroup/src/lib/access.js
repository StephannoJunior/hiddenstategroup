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
  ACCOUNTS. Each person signs in with their own username and password, so you
  can see who is on the door and remove one person without changing everyone
  else's login.

  Passwords are stored as salted hashes. The salt means two people choosing
  the same password do not produce the same stored value.

  To add or change someone, run this in any browser console and paste the
  result in below:

    const salt = "hidden-state-door-v1";
    const user = "newname", pass = "their-password";
    crypto.subtle.digest("SHA-256", new TextEncoder()
      .encode(`${salt}:${user.toLowerCase()}:${pass}`))
      .then(b => console.log([...new Uint8Array(b)]
        .map(x => x.toString(16).padStart(2,"0")).join("")));

  The trial passwords are NOT written here on purpose. Anything in this file
  ships to every visitor's browser, so listing them in a comment would hand
  them over to anyone who opens the source — and undo the whole point of
  storing hashes rather than plain text.
*/
const SALT = "hidden-state-door-v1";

const ACCOUNTS = [
  { user: "stephanno", role: "OWNER", name: "Stephanno Jr.", hash: "b64e2a670d592d811893d3f30de7490ffde81de039cc4f1360d0f1a4efe6425f" },
  { user: "manager", role: "OWNER", name: "Management", hash: "2f733ad873e480697cebc1e936c9b3ec03c52b8d334f013e49b0cbd21b6501c1" },
  { user: "door", role: "STAFF", name: "Door staff", hash: "d8979a54888af958d253508c7d71df8cb07f3631872a70c93ec6a1f5696bdcc0" },
  { user: "door2", role: "STAFF", name: "Door staff 2", hash: "8fa8ddbd3fd0f9ee0f740be434eea70538bf10c428c6692c4b02d39f9566dfe5" }
];

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
export async function signInWith(username, password) {
  const digest = await sha256(`${SALT}:${(username || "").trim().toLowerCase()}:${password || ""}`);

  // Every account is compared even after a match, so how long this takes
  // never hints at which usernames exist.
  let found = null;
  for (const acc of ACCOUNTS) {
    if (acc.hash === digest && acc.user === (username || "").trim().toLowerCase()) found = acc;
  }
  if (!found) return null;
  return { ...ROLES[found.role], user: found.user, displayName: found.name };
}

/*
  The signed-in role lives in sessionStorage, not localStorage: it clears when
  the tab closes. A door phone left on a table should not still be signed in
  the next morning.
*/
export function currentRole() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const base = ROLES[saved.id];
    return base ? { ...base, user: saved.user, displayName: saved.displayName } : null;
  } catch {
    return null;
  }
}

export function signIn(role) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: role.id, user: role.user, displayName: role.displayName })
    );
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
