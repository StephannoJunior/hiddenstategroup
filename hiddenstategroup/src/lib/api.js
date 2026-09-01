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
export const scan = (payload) => call("/scan", { method: "POST", body: { payload } });
export const scanByCode = (code) => call("/scan", { method: "POST", body: { code } });

// The door's own copy of the guest list, for working without signal.
export const fetchRoster = (party) => call(`/roster?party=${encodeURIComponent(party)}`);

// Admissions made while offline, sent up once signal returns.
export const syncAdmissions = (entries) => call("/sync", { method: "POST", body: { entries } });

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

export const listSongs = (pool, party) =>
  // sent WITH auth when a token exists, because the team's view of a pool
  // includes what has been hidden from everyone else
  call(`/songs?pool=${encodeURIComponent(pool)}&party=${encodeURIComponent(party || "")}`);

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
