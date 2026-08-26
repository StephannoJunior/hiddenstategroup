/*
  api — the single place the site talks to the server.

  Everything that used to happen in the browser now happens behind this: the
  guest list, the door record, the login check. The browser holds only a
  session token, which the server can revoke at any moment.
*/

const TOKEN_KEY = "hs-session-token";

export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing blocks this; the session lasts this page only */
  }
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
export const fetchPass = (code) =>
  call(`/pass/${encodeURIComponent(code)}`, { auth: false });

// ── the door ────────────────────────────────────────────────────────────────
export const scan = (payload) => call("/scan", { method: "POST", body: { payload } });
export const scanByCode = (code) => call("/scan", { method: "POST", body: { code } });

// ── passes ──────────────────────────────────────────────────────────────────
export const listPasses = (party) => call(`/passes?party=${encodeURIComponent(party)}`);
export const issuePass = (pass) => call("/passes", { method: "POST", body: pass });
export const revokePass = (code, reason) =>
  call(`/passes/${encodeURIComponent(code)}`, { method: "PATCH", body: { status: "REVOKED", reason } });
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
export const createMember = (member) => call("/team", { method: "POST", body: member });
export const setMemberActive = (username, active) =>
  call(`/team/${encodeURIComponent(username)}`, { method: "PATCH", body: { active } });
export const deleteMember = (username) =>
  call(`/team/${encodeURIComponent(username)}`, { method: "DELETE" });

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
