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
  { user: "admin1", role: "OWNER", name: "Admin 1", hash: "0063809b713b9fe9273e42dc2cb8a5e2378365ee88202517eade6367f86398d7" },
  { user: "admin2", role: "OWNER", name: "Admin 2", hash: "a9f2b9bd1da6e0f630fa15d90af16c931c51a10e1019aaa483ef25410bcd1669" },
  { user: "admin3", role: "OWNER", name: "Admin 3", hash: "db3c7bba95a37bd7c35dd564b40855b1321de83d54875d0a4eca343f7278dc23" },
  { user: "admin4", role: "OWNER", name: "Admin 4", hash: "d45c13068f98e1ec25304b124d5808813b55a8e4d71e9a4a9b39dee74e6f7925" },
  { user: "admin5", role: "OWNER", name: "Admin 5", hash: "8e37f13ecfedca0c15a0e242611541d8d4b1eccf4896332649b6b697e4a3686f" },
  { user: "staff1", role: "STAFF", name: "Staff 1", hash: "41efe25f023ce0ce436b04ca03b0c2bb26527e48a81cdfafca56677b9e88e084" },
  { user: "staff2", role: "STAFF", name: "Staff 2", hash: "629715ccaff3d08bd18ca8d7b3af01fafa00df8575f85cab279fda85fdf81754" },
  { user: "staff3", role: "STAFF", name: "Staff 3", hash: "5526045073a2765c5b6c53a1614cda5c65993bdea256d78f100068b2292c85d7" },
  { user: "staff4", role: "STAFF", name: "Staff 4", hash: "a557f7d5c8d8adb599abacffb5a06a3d0fbb5d8d569dbcce5a675974091737a2" },
  { user: "staff5", role: "STAFF", name: "Staff 5", hash: "64c7715189d386c09585a0bf86b06d00e0ce3d71183cea0474e7609e99127f30" },
  { user: "staff6", role: "STAFF", name: "Staff 6", hash: "e1f1b9324f2e5895c052c4e8b3ca0054c037daa2aa12c185e9c0545a63caec2f" },
  { user: "staff7", role: "STAFF", name: "Staff 7", hash: "ed242894a3d7a7e33e647c095f383a202b4c8e71729e6f5c8eedcbc8368ac5a4" },
  { user: "staff8", role: "STAFF", name: "Staff 8", hash: "b63403b76e755a4ed06ff7c3585d542e36798b0acf5273679d1b10b47e216ab1" },
  { user: "staff9", role: "STAFF", name: "Staff 9", hash: "dcdd77990f4fe054bee29347a2be710245429b0bbed1fca09d8a05692e7605cf" },
  { user: "staff10", role: "STAFF", name: "Staff 10", hash: "ca532fa9b4eaef50aba2bcc9585036a86a62102c4bcfea7bae4f5a19f8f74451" }
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
