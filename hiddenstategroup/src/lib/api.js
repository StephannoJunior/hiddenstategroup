/*
  api — the single place the site talks to the server.

  Everything that used to happen in the browser now happens behind this: the
  guest list, the door record, the login check. The browser holds only a
  session token, which the server can revoke at any moment.
*/

const TOKEN_KEY = "hs-session-token";
const GUEST_KEY = "hs-guest-pass";

/*
  WHO IS SIGNED IN CAN CHANGE WITHOUT THE ADDRESS CHANGING.

  The login form sits on the page it protects, so signing in never navigates
  anywhere — the same URL simply starts showing the console. Anything drawn
  differently for a signed-in person (the glass bar's team tabs) therefore has
  no reason to redraw, and keeps showing what it drew before until the next
  tap or a reload. That was the bug: sign in as boss, and the extra tabs only
  turned up after touching another tab.

  So the token is announced. Every change of session — signing in, signing
  out, a session expiring mid-request, a guest opening or losing their pass —
  fires one event, and whoever cares listens for it.
*/
export const AUTH_EVENT = "hs-auth-change";

export function announceAuthChange() {
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    /* no window while building; nothing is listening then anyway */
  }
}

export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  const before = getToken();
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing blocks this; the session lasts this page only */
  }
  // Only when it genuinely changed. A failed request clearing an already
  // empty token should not send everyone off to re-check the server.
  if ((before || null) !== (token || null)) announceAuthChange();
};

/*
  A guest's own pass code. Not a login — see MyPass — but the bar shows a
  different tab for someone holding one, so it changes the same way and is
  announced through the same event.
*/
export const getGuestPass = () => {
  try {
    return localStorage.getItem(GUEST_KEY);
  } catch {
    return null;
  }
};

export const setGuestPass = (code) => {
  const before = getGuestPass();
  try {
    if (code) localStorage.setItem(GUEST_KEY, code);
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    /* private browsing blocks this; the pass still works this visit */
  }
  if ((before || null) !== (code || null)) announceAuthChange();
};

/*
  One request helper, so every call handles failure the same way.

  A network error and a server error are deliberately not distinguished in
  what the caller sees — at a door, "it didn't work" is the only actionable
  fact, and a wall of technical detail helps nobody at 2am.
*/
async function call(path, options = {}) {
  const { method = "GET", body = null, auth = true } = options;
  const headers = { "content-type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: "No connection. Check the signal and try again." };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "The server sent something unexpected." };
  }

  // A dead session should send someone back to the login rather than leaving
  // them poking at buttons that silently do nothing.
  if (res.status === 401 && auth) {
    setToken(null);
    return { ok: false, error: data.error || "Your session has ended. Sign in again.", signedOut: true };
  }

  return data;
}

// ── who is signed in ────────────────────────────────────────────────────────
export const login = (username, password) =>
  call("/login", { method: "POST", body: { username, password }, auth: false });

export const logout = () => call("/logout", { method: "POST" });

// Who the stored token belongs to. Called on load so a refresh does not throw
// someone back to the login form mid-shift.
export const me = () => call("/me");

// ── a guest's own pass ──────────────────────────────────────────────────────
// "I lost my link." Public, and deliberately gives the same answer whether
// the address is on the list or not.
export const resendPass = (email) =>
  call("/resend", { method: "POST", body: { email }, auth: false });

export const fetchPass = (code) =>
  call(`/pass/${encodeURIComponent(code)}`, { auth: false });

// ── the door ────────────────────────────────────────────────────────────────
/*
  DIRECTION IS SENT, NEVER INFERRED — N03.

  The server could work out that somebody already inside must be leaving, and
  that would be wrong: a camera reading the same pass twice would become an
  accidental exit, and the next real scan would then let a stranger in on a
  code that should have been spent. So the scanner says which way the person
  is going, and the default is in.
*/
export const scan = (payload, direction = "IN") =>
  call("/scan", { method: "POST", body: { payload, direction } });
export const scanByCode = (code, direction = "IN") =>
  call("/scan", { method: "POST", body: { code, direction } });

// The door's own copy of the guest list, for working without signal.
export const fetchRoster = (party) => call(`/roster?party=${encodeURIComponent(party)}`);

// Admissions made while offline, sent up once signal returns.
export const syncAdmissions = (entries) => call("/sync", { method: "POST", body: { entries } });

// ── the door's own tools ────────────────────────────────────────────────────
export const searchPasses = (q, party) =>
  call(`/passes/search?q=${encodeURIComponent(q)}&party=${encodeURIComponent(party || "")}`);
export const admitByHand = (code, reason) =>
  call("/passes/admit", { method: "POST", body: { code, reason } });
export const reissuePass = (code) =>
  call("/passes/reissue", { method: "POST", body: { code } });
export const activity = (limit = 120) => call(`/activity?limit=${limit}`);

// ── passes ──────────────────────────────────────────────────────────────────
export const listPasses = (party) => call(`/passes?party=${encodeURIComponent(party)}`);
export const issuePass = (pass) => call("/passes", { method: "POST", body: pass });
export const issueBulk = (party, names, kind, tier) =>
  call("/passes/bulk", { method: "POST", body: { party, names, kind, tier } });

// Warn before issuing a second pass to someone already on the list.
export const checkDuplicate = (party, name, email) =>
  call("/passes/check", { method: "POST", body: { party, name, email } });

export const fetchStats = (party) => call(`/stats?party=${encodeURIComponent(party)}`);

export const revokePass = (code, reason) =>
  call(`/passes/${encodeURIComponent(code)}`, { method: "PATCH", body: { status: "REVOKED", reason } });
// Edit an issued pass. Only the fields passed are changed; the code itself
// can never be — it may already be printed on a ticket in someone's hand.
export const editPass = (code, changes) =>
  call(`/passes/${encodeURIComponent(code)}`, { method: "PATCH", body: changes });

export const restorePass = (code) =>
  call(`/passes/${encodeURIComponent(code)}`, { method: "PATCH", body: { status: "ACTIVE" } });

// ── events ──────────────────────────────────────────────────────────────────
export const listParties = () => call("/parties");
export const createParty = (party) => call("/parties", { method: "POST", body: party });
export const updateParty = (id, changes) =>
  call(`/parties/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
export const archiveParty = (id) =>
  call(`/parties/${encodeURIComponent(id)}`, { method: "DELETE" });

// ── team ────────────────────────────────────────────────────────────────────
export const listTeam = () => call("/team");

// Anything the boss can change without a deploy.
// Destructive work. Each needs its confirmation phrase typed back.
export const maintenance = (action, extra = {}) =>
  call("/maintenance", { method: "POST", body: { action, ...extra } });

/*
  Photographs.

  Uploading does not go through `call` because that sends JSON — a file needs
  multipart form data, and the browser must set its own content-type header
  with the boundary in it.
*/
export async function uploadImage(file, folder = "posts") {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);

  // Built as a Headers object so the type is unambiguous; the browser
  // still sets content-type itself, which multipart requires.
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  try {
    const res = await fetch("/api/upload", { method: "POST", headers, body });
    return await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check the signal." };
  }
}

export const listMedia = () => call("/media");
export const deleteMedia = (key) =>
  call(`/media/${encodeURIComponent(key)}`, { method: "DELETE" });

/*
  Artists, records and mixes. One set of calls for all three — they differ
  only in their fields, and the server handles that.
*/
export const listContent = (kind) => call(`/content/${kind}`, { auth: false });
export const createContent = (kind, item) => call(`/content/${kind}`, { method: "POST", body: item });
export const editContent = (kind, id, changes) =>
  call(`/content/${kind}/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
export const deleteContent = (kind, id) =>
  call(`/content/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });

/*
  Posts.

  Reading is public — the news pages use it. Writing needs a login, and the
  server decides that, not this file.
*/
export const listPosts = () => call("/posts", { auth: false });
export const createPost = (post) => call("/posts", { method: "POST", body: post });
export const editPost = (slug, changes) =>
  call(`/posts/${encodeURIComponent(slug)}`, { method: "PATCH", body: changes });
export const deletePost = (slug) =>
  call(`/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });

// The public site's own settings. No login needed — only the handful of
// values every visitor sees anyway.
export async function fetchSiteSettings() {
  const res = await call("/site", { auth: false });
  return res.ok ? res.settings : null;
}

export const fetchSettings = () => call("/settings");

/*
  The same problem the login had, in a different place.

  The public site reads its settings once, when it boots. Saving from the
  console changed them on the server but nothing on screen — the banner, the
  countdown, the bar's own width and labels — while the settings screen
  cheerfully said "changes apply straight away". Now a successful save says so
  out loud and SiteProvider fetches again.
*/
export const SETTINGS_EVENT = "hs-settings-change";

export async function saveSettings(settings) {
  const res = await call("/settings", { method: "PATCH", body: { settings } });
  if (res.ok) {
    try {
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      /* no window while building */
    }
  }
  return res;
}

// Edit an account: name, contact, role, what it can do, or a new password.
export const editMember = (username, changes) =>
  call(`/team/${encodeURIComponent(username)}`, { method: "PATCH", body: changes });
export const createMember = (member) => call("/team", { method: "POST", body: member });
export const setMemberActive = (username, active) =>
  call(`/team/${encodeURIComponent(username)}`, { method: "PATCH", body: { active } });
export const deleteMember = (username) =>
  call(`/team/${encodeURIComponent(username)}`, { method: "DELETE" });

/*
  ── THE SONG POOL ──────────────────────────────────────────────────────────
  Reading a pool and adding to one are both public: a request box nobody can
  see the results of is a suggestion box, and people stop using those. Only
  moderating needs a login, and the server decides that, not this file.
*/
/*
  READERSHIP. A day, a path, a number — no cookie, no identifier, nothing that
  could be joined back to a person, which is why there is no banner to click.

  sendBeacon is used where it exists because it survives the page being closed;
  a normal request from a tab that is going away is often cancelled, which is
  exactly what makes naive page counters undercount the pages people leave on.
*/
export function countView(path) {
  const payload = JSON.stringify({ path });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/hit", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch (e) { /* fall through */ }
  call("/hit", { method: "POST", body: { path }, auth: false }).catch(() => {});
}

export const readership = (days = 30) => call(`/views?days=${days}`);

// ── backups ─────────────────────────────────────────────────────────────────
export const listBackups = () => call("/backups");
export const makeBackup = () => call("/backups", { method: "POST" });
// Not a plain link: the file is behind the session, so the token has to travel
// with the request and the download is built from what comes back.
export async function downloadBackup(name) {
  const res = await fetch(`/api/backups/${encodeURIComponent(name)}`, {
    headers: { authorization: `Bearer ${getToken() || ""}` },
  });
  if (!res.ok) return { ok: false, error: "That backup could not be fetched." };
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick — revoking immediately can cancel the save in
  // Safari before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true };
}

export const publicParties = () => call("/public-parties", { auth: false });

// What is this link? Used while typing a session in, so the name and the icon
// fill themselves in rather than being copied by hand from another tab.
export const resolveLink = (url) => call(`/resolve?url=${encodeURIComponent(url)}`);

/*
  WHO IS VOTING — a made-up name, kept in this browser.

  Not a login and not a person: a random string whose only job is to stop the
  same phone voting twice. It identifies nobody, travels nowhere else, and is
  cleared with the browser's data like anything else. A poll that demanded an
  account would lose more votes than it protected.
*/
const VOTER_KEY = "hs-voter";
export function voterId() {
  try {
    let v = localStorage.getItem(VOTER_KEY);
    if (!v) {
      v = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now().toString(36));
      localStorage.setItem(VOTER_KEY, v);
    }
    return v;
  } catch {
    // Private browsing: the vote still counts for this visit, and the server
    // will simply see a new voter next time.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

export const voteSong = (id) =>
  call("/songs/vote", { method: "POST", body: { id, voter: voterId() }, auth: false });

export const listSongs = (pool, party) =>
  // sent WITH auth when a token exists, because the team's view of a pool
  // includes what has been hidden from everyone else
  call(`/songs?pool=${encodeURIComponent(pool)}&party=${encodeURIComponent(party || "")}&voter=${encodeURIComponent(voterId())}`);

export const addSong = (entry) => call("/songs", { method: "POST", body: entry, auth: false });
export const editSong = (id, status) =>
  call(`/songs/${id}`, { method: "PATCH", body: { status } });
export const deleteSong = (id) => call(`/songs/${id}`, { method: "DELETE" });

// ── guest list requests ─────────────────────────────────────────────────────
export const submitRequest = (req) =>
  call("/requests", { method: "POST", body: req, auth: false });
export const listRequests = () => call("/requests");

// Approving creates the pass and emails it in one step, so a guest can never
// be approved but left without a pass.
export const decideRequest = (id, decision, party) =>
  call(`/requests/${id}`, { method: "PATCH", body: { decision, party } });

// Public: the next event, for pages a guest sees. Returns null rather than
// throwing when nothing is scheduled, so the form still works.
export async function nextParty() {
  const res = await call("/next-party", { auth: false });
  return res.ok ? res.party : null;
}

/*
  ── FAULT REPORTING ─────────────────────────────────────────────────────────

  When the site breaks in someone else's browser, nobody tells us. They close
  the tab. The only honest way to find out is for the browser to say so.

  WHAT IS SENT, and nothing else: the message, the file and line it came from,
  a trimmed stack, and the path of the page. The server adds a coarse browser
  family (iOS Safari / Chrome / …) and drops the rest of the user-agent, which
  is a fingerprint. No address, no identifier, no session, no referrer — this
  is our own building, not an analytics product, and a fault report is not a
  reason to start collecting visitors.
*/

// Sent, this page load. Two guards, both against noise rather than malice:
// the same fault repeating in a render loop would otherwise send hundreds of
// identical requests, and a page that is thoroughly broken should not spend
// what is left of its life reporting it.
const seenFaults = new Set();
let faultsSent = 0;
const FAULT_CAP = 6;

export function reportOops(message, where, stack) {
  const msg = String(message || "").slice(0, 300).trim();
  if (!msg) return;

  /*
    "Script error." is what a browser gives for a failure inside a script it
    loaded from another origin — nearly always a browser extension or an
    injected script, never our code. It carries no message, no file and no
    line, so it can never be acted on. Reporting it fills the list with rows
    that mean "something, somewhere".
  */
  if (msg === "Script error." || msg === "Script error") return;

  const key = msg + "|" + (where || "");
  if (seenFaults.has(key) || faultsSent >= FAULT_CAP) return;
  seenFaults.add(key);
  faultsSent += 1;

  // Deliberately not awaited and never allowed to throw. A failure to report
  // a fault must not itself become a fault.
  call("/oops", {
    method: "POST",
    auth: false,
    body: {
      message: msg,
      where: String(where || "").slice(0, 200),
      stack: String(stack || "").slice(0, 900),
      path: (typeof location !== "undefined" ? location.pathname : ""),
    },
  }).catch(() => {});
}

/*
  Two listeners, because there are two ways for something to go wrong and
  each fires only its own:

    error              — a thrown exception that reached the top
    unhandledrejection — a promise that failed with nobody catching it, which
                         is how a broken fetch usually surfaces

  React's error boundary catches a third kind — a component that throws while
  rendering — and reports through the same function.
*/
export function watchForFaults() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (e) => {
    // A failed <img> or <script> also fires "error", with no message on it.
    // Those are worth knowing about but are not exceptions; the filename is
    // the whole story, so it goes in as one.
    if (!e.message && e.target && e.target.src) {
      reportOops("Failed to load: " + String(e.target.src).slice(0, 160), "resource", "");
      return;
    }
    reportOops(
      e.message,
      e.filename ? `${String(e.filename).split("/").pop()}:${e.lineno}` : "",
      e.error && e.error.stack ? e.error.stack : ""
    );
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    reportOops(
      r && r.message ? r.message : String(r),
      "promise",
      r && r.stack ? r.stack : ""
    );
  });
}

// The console's reading of the above. Both need manageTeam.
export const listOops = () => call("/oops");
export const clearOops = () => call("/oops", { method: "DELETE" });

/*
  ══════════════════════════════════════════════════════════════════════════
  THE SECOND EIGHTEEN
  ══════════════════════════════════════════════════════════════════════════
*/

// ── N04 · a note on a name ──────────────────────────────────────────────────
// An empty note deletes it, so there is one call rather than a set and a clear.
export const setDoorNote = (code, note, tone) =>
  call(`/passes/${encodeURIComponent(code)}/note`, { method: "PUT", body: { note, tone } });

// ── share links · N01, L02, G09 ─────────────────────────────────────────────
export const makeShareLink = (kind, ref, label, expires) =>
  call("/share", { method: "POST", body: { kind, ref, label, expires } });
export const listShareLinks = (kind) =>
  call(`/share${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`);
export const revokeShareLink = (token) =>
  call(`/share/${encodeURIComponent(token)}`, { method: "DELETE" });

// ── N01 · the number on the wall ────────────────────────────────────────────
// No auth by design: the whole point is a screen propped up in a corner that
// nobody has to sign into.
export const readWall = (token) =>
  call(`/wall/${encodeURIComponent(token)}`, { auth: false });

// ── G06 · the running order ─────────────────────────────────────────────────
export const listSetTimes = (party) =>
  call(`/settimes?party=${encodeURIComponent(party || "")}`, { auth: false });
export const saveSetTimes = (party, sets) =>
  call("/settimes", { method: "PUT", body: { party, sets } });

// ── G07 · add to calendar ───────────────────────────────────────────────────
// Not a fetch — a plain address the browser downloads. Returned as a string so
// a link can point straight at it and the phone's calendar handles the rest.
export const calendarLink = (party) => `/api/ics/${encodeURIComponent(party)}.ics`;

// ── N05 · the waiting list ──────────────────────────────────────────────────
export const readWaitlist = (party) =>
  call(`/waitlist?party=${encodeURIComponent(party || "")}`);
export const offerPlace = (party, id, anyway) =>
  call("/waitlist/offer", { method: "POST", body: { party, id, anyway } });

// ── G08 · the morning after ─────────────────────────────────────────────────
// dryRun answers "how many would this reach" without sending anything, which
// is the question anyone sensible asks before pressing send.
export const sendAfter = (party, subject, body, opts = {}) =>
  call("/afters", { method: "POST", body: { party, subject, body, ...opts } });
export const listAfters = () => call("/afters");

// ── L01 · demos ─────────────────────────────────────────────────────────────
export const submitDemo = (demo) => call("/demos", { method: "POST", body: demo, auth: false });
export const listDemos = (status) =>
  call(`/demos${status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : ""}`);
export const judgeDemo = (id, status, verdict, reply) =>
  call(`/demos/${id}`, { method: "PATCH", body: { status, verdict, reply } });

// ── L04 · bookings ──────────────────────────────────────────────────────────
export const submitBooking = (b) => call("/bookings", { method: "POST", body: b, auth: false });
export const listBookings = () => call("/bookings");
export const decideBooking = (id, status, note) =>
  call(`/bookings/${id}`, { method: "PATCH", body: { status, note } });

// ── L02 · the press kit ─────────────────────────────────────────────────────
export const readKitByLink = (token) =>
  call(`/epk/link/${encodeURIComponent(token)}`, { auth: false });
export const readKit = (artistId) => call(`/epk/artist/${artistId}`);
export const saveKit = (artistId, kit) =>
  call(`/epk/artist/${artistId}`, { method: "PUT", body: kit });

// ── L03 · where a record lives ──────────────────────────────────────────────
export const listReleaseLinks = (record) =>
  call(`/links?record=${encodeURIComponent(record)}`, { auth: false });
export const saveReleaseLinks = (record, links) =>
  call("/links", { method: "PUT", body: { record, links } });
