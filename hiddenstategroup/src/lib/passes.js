/*
  Passes — the guest list for a single night.

  ── HOW THE ROTATING CODE WORKS ───────────────────────────────────────────
  The QR does not contain the ticket. It contains a short code worked out from
  three things: the pass id, a shared secret, and the current 30-second window.
  The scanner recomputes the same value and compares.

  A screenshot is therefore worthless within half a minute, which is the whole
  point — someone can forward a picture of their pass to a friend and it will
  not open the door.

  This uses the browser's built-in crypto, so there is no library to load and
  nothing to keep updated.

  ── WHAT THIS TEST BUILD IS AND IS NOT ────────────────────────────────────
  This is a ten-person trial, deliberately built with no server:

    • the ten passes live in this file
    • the SECRET below sits in the page source, so anyone determined could
      read it and mint codes
    • "already used" is remembered on the scanning device only

  That is fine for a trial at one door with one phone. It is NOT fine for 500
  people a week. For that, the passes and the secret move to a Cloudflare
  Worker and the used-list moves to a database, so the secret never reaches a
  browser and any door phone sees the same list.
*/

// Trial secret. Regenerate this for anything real, and keep it on a server.
const SECRET = "hidden-state-trial-2026";

// 30 seconds: long enough that a slow scan still works, short enough that a
// forwarded screenshot is dead on arrival.
const WINDOW_SECONDS = 30;

/*
  PARTIES. A pass belongs to one party and dies with it.

  `doorClosesAt` is the moment a pass stops working — set it a few hours after
  the night starts, not at the start, or anyone arriving late is turned away.

  `rotatingCodes`:
    true  — the number on the guest's screen refreshes every 30 seconds, so a
            forwarded screenshot is useless. Recommended.
    false — one fixed number for the whole night. Simpler to read out over the
            phone, but a screenshot then works for anyone who receives it.
*/
export const PARTIES = [
  {
    id: "dec13",
    name: "13.12.2026",
    date: "13 December 2026",
    venue: "Undisclosed",
    // Doors shut at 6am the following morning, not at midnight — set this to
    // the start of the night and anyone arriving late is refused by their own
    // pass. After this moment every pass for the night stops working.
    doorClosesAt: "2026-12-14T06:00:00+02:00",
    minimumAge: 16,
    // Rotating codes: the number on the guest's screen changes every 30
    // seconds, so a forwarded screenshot is useless at the door.
    rotatingCodes: true,
  },
];

export const findParty = (id) => PARTIES.find((p) => p.id === id) || null;

// A party is only worth issuing passes for while it is still ahead of us.
export const partyIsUpcoming = (party) =>
  !!party && new Date(party.doorClosesAt).getTime() > Date.now();

export const upcomingParties = () => PARTIES.filter(partyIsUpcoming);

/*
  The passes themselves.

  Each is unique: its own code, its own id, its own guest. Add a guest by
  copying a line and changing the code, name and party. Codes should be
  unguessable — avoid HS-0001, HS-0002, or people will simply try the next one.
*/
export const PASSES = [
  // A sold ticket carries its order reference and the buyer's name. The name
  // is the thing that actually prevents resale — a rotating code stops a
  // screenshot being forwarded, but only an ID check stops a ticket being
  // handed to someone else. `idRequired` tells the door to ask.
  { id: "p01", code: "HS-4KQ2", name: "Test Guest 01", type: "TICKET", party: "dec13",
    ticket: { ref: "HS-DEC13-0001", tier: "EARLY", boughtOn: "2026-08-20", idRequired: true } },
  { id: "p02", code: "HS-7MX8", name: "Test Guest 02", type: "TICKET", party: "dec13",
    ticket: { ref: "HS-DEC13-0002", tier: "EARLY", boughtOn: "2026-08-20", idRequired: true } },
  { id: "p03", code: "HS-2WD5", name: "Test Guest 03", type: "TICKET", party: "dec13",
    ticket: { ref: "HS-DEC13-0003", tier: "STANDARD", boughtOn: "2026-08-22", idRequired: true } },
  { id: "p04", code: "HS-9BR3", name: "Test Guest 04", type: "TICKET", party: "dec13",
    ticket: { ref: "HS-DEC13-0004", tier: "STANDARD", boughtOn: "2026-08-22", idRequired: true } },
  { id: "p05", code: "HS-6TN1", name: "Test Guest 05", type: "TICKET", party: "dec13",
    ticket: { ref: "HS-DEC13-0005", tier: "STANDARD", boughtOn: "2026-08-23", idRequired: true } },

  // Guest list and working passes carry no ticket.
  { id: "p06", code: "HS-3JV7", name: "Test Guest 06", type: "PRESS",  party: "dec13", ticket: null },
  { id: "p07", code: "HS-8LZ4", name: "Test Guest 07", type: "PRESS",  party: "dec13", ticket: null },
  { id: "p08", code: "HS-1FQ9", name: "Test Guest 08", type: "ARTIST", party: "dec13", ticket: null },
  { id: "p09", code: "HS-5CY6", name: "Test Guest 09", type: "ARTIST", party: "dec13", ticket: null },
  { id: "p10", code: "HS-0HK2", name: "Test Guest 10", type: "STAFF",  party: "dec13", ticket: null },
];

/*
  DEVICE CLAIM — a deterrent, not a lock.

  The first device to open a pass records that it did. Opening the same pass
  somewhere else is then visible, and the door can be told.

  Be clear about the limit: the record lives on each device, so there is no
  central place holding "this pass belongs to that phone". Someone reselling
  can simply tell the buyer to ignore the warning. It raises the effort and
  makes casual resale awkward; it does not prevent it.

  Real enforcement needs the claim recorded on a server, which is the same
  step as moving the guest list off the page.
*/
const CLAIM_KEY = "hs-pass-claims";

export function claimDevice(code) {
  let claims = {};
  try {
    claims = JSON.parse(localStorage.getItem(CLAIM_KEY) || "{}");
  } catch {
    claims = {};
  }
  if (!claims[code]) {
    claims[code] = { at: new Date().toISOString() };
    try {
      localStorage.setItem(CLAIM_KEY, JSON.stringify(claims));
    } catch {
      /* private browsing blocks this; treat the pass as unclaimed */
    }
    return { firstTime: true, at: claims[code].at };
  }
  return { firstTime: false, at: claims[code].at };
}

// The party a pass belongs to, or null if it points at one that no longer exists.
export const partyOf = (pass) => (pass ? findParty(pass.party) : null);

export const findPass = (code) =>
  PASSES.find((p) => p.code.toUpperCase() === (code || "").toUpperCase()) || null;

const enc = new TextEncoder();

async function hmac(message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig));
}

export const currentWindow = () => Math.floor(Date.now() / 1000 / WINDOW_SECONDS);

export const secondsLeftInWindow = () =>
  WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);

// Six digits, from the pass id and the time window.
export async function rotatingCode(passId, window = currentWindow()) {
  const bytes = await hmac(`${passId}:${window}`);
  const offset = bytes[bytes.length - 1] & 0xf;
  const num =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  return String(num % 1000000).padStart(6, "0");
}

// What the QR actually carries.
export const buildPayload = (pass, rotating) => `HS|${pass.code}|${rotating}`;

/*
  Verify a scanned payload.

  The previous and next windows are accepted as well as the current one. Two
  clocks are never perfectly in step, and refusing a guest because their phone
  is eight seconds out would be a miserable way to fail at a door.
*/
export async function verifyPayload(payload) {
  const parts = String(payload || "").split("|");
  if (parts.length !== 3 || parts[0] !== "HS") return { ok: false, reason: "NOT_A_PASS" };

  const pass = findPass(parts[1]);
  if (!pass) return { ok: false, reason: "UNKNOWN" };

  // A pass for a night that has already finished is refused, so last month's
  // guest list can never walk into this month's party.
  const party = partyOf(pass);
  if (!party) return { ok: false, reason: "NO_PARTY", pass };
  if (!partyIsUpcoming(party)) return { ok: false, reason: "PARTY_OVER", pass, party };

  // A party set to fixed codes accepts the guest's permanent number.
  if (!party.rotatingCodes) {
    return (await fixedCode(pass.id)) === parts[2]
      ? { ok: true, pass, party }
      : { ok: false, reason: "WRONG_CODE", pass, party };
  }

  // The current window plus one either side, for clock drift. Refusing a
  // guest because their phone is eight seconds out would be a miserable way
  // to fail at a door.
  const now = currentWindow();
  for (const w of [now, now - 1, now + 1]) {
    if ((await rotatingCode(pass.id, w)) === parts[2]) return { ok: true, pass, party };
  }

  /*
    It failed — but WHY matters to whoever is on the door, because the two
    causes need opposite responses:

      a stale code  → their screen has gone to sleep. Ask them to refresh.
      a made-up one → refuse entry.

    So look back over the last ten minutes. A match there means the code was
    genuinely theirs and simply went stale. No match means the number never
    came from this pass at all.
  */
  for (let back = 2; back <= 20; back++) {
    if ((await rotatingCode(pass.id, now - back)) === parts[2]) {
      return { ok: false, reason: "EXPIRED", pass, party };
    }
  }
  return { ok: false, reason: "NOT_VALID", pass, party };
}

// A code that never changes, for parties that opt out of rotation. Derived the
// same way, just without the time component.
export async function fixedCode(passId) {
  const bytes = await hmac(`${passId}:fixed`);
  const offset = bytes[bytes.length - 1] & 0xf;
  const num =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  return String(num % 1000000).padStart(6, "0");
}

// What to show a guest, whichever mode their party uses.
export async function codeFor(pass) {
  const party = partyOf(pass);
  return party && !party.rotatingCodes
    ? await fixedCode(pass.id)
    : await rotatingCode(pass.id);
}

/*
  The used-list. On this trial it lives in the scanning device's own storage,
  which means one phone on the door. A second phone would not know what the
  first had already admitted.
*/
const USED_KEY = "hs-used-passes";
const REFUSED_KEY = "hs-refused-passes";

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing can block storage — the scan still shows its result */
  }
};

export const readUsed = () => read(USED_KEY);
export const readRefused = () => read(REFUSED_KEY);

export function markUsed(code, name) {
  const used = readUsed();
  used[code] = { at: new Date().toISOString(), name };
  write(USED_KEY, used);
  return used;
}

/*
  Every refusal is logged as well, so the organiser list can show what
  actually happened at the door rather than only who got in. A run of
  refusals against one code is worth seeing — it usually means a screenshot
  is doing the rounds.
*/
export function markRefused(code, name, reason) {
  const refused = readRefused();
  const entry = refused[code] || { count: 0, tries: [] };
  entry.count += 1;
  entry.name = name || entry.name || null;
  entry.lastReason = reason;
  entry.at = new Date().toISOString();
  entry.tries = [...(entry.tries || []), { at: entry.at, reason }].slice(-10);
  refused[code] = entry;
  write(REFUSED_KEY, refused);
  return refused;
}

export function clearUsed() {
  try {
    localStorage.removeItem(USED_KEY);
    localStorage.removeItem(REFUSED_KEY);
  } catch {
    /* nothing useful to do */
  }
}

/*
  The state of every pass for the night, for the organiser view.
    ADMITTED — scanned and let in
    REFUSED  — turned away, with the reason and how many attempts
    AWAITING — not seen at the door yet
*/
export function passStatuses() {
  const used = readUsed();
  const refused = readRefused();
  return PASSES.map((p) => {
    if (used[p.code]) {
      return { ...p, state: "ADMITTED", at: used[p.code].at, tries: 0 };
    }
    if (refused[p.code]) {
      return {
        ...p,
        state: "REFUSED",
        at: refused[p.code].at,
        reason: refused[p.code].lastReason,
        tries: refused[p.code].count,
      };
    }
    return { ...p, state: "AWAITING", at: null, tries: 0 };
  });
}
