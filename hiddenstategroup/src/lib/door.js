/*
  door — the scanner's own copy of the guest list.

  WHY. A club basement kills reception. A scanner that needs the internet is a
  scanner that stops at 11pm with two hundred people outside, and no amount of
  clever verification helps if the door has stopped moving.

  So the door downloads the roster when it opens and keeps working from that
  copy. Admissions made while offline are queued and sent up the moment signal
  returns.

  THE TRADE, STATED PLAINLY. Offline, the rotating number cannot be checked —
  the secret that generates it stays on the server, which is the whole point
  of having moved it there. So offline the door verifies the PASS CODE against
  its copy and nothing more. Someone who copied a friend's code could get in.

  That is a worse check than being online, and a far better outcome than a
  stopped door. The scanner says which mode it is in so nobody is misled.
*/

const ROSTER_KEY = "hs-door-roster";
const QUEUE_KEY = "hs-door-queue";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage full or blocked. The door still works for this session; it just
    // cannot survive a reload.
    return false;
  }
};

export const getRoster = () => read(ROSTER_KEY, null);
export const saveRoster = (roster) => write(ROSTER_KEY, roster);

export const getQueue = () => read(QUEUE_KEY, []);
export const clearQueue = () => write(QUEUE_KEY, []);

/*
  THE CODE INSIDE A SCAN.

  A pass QR carries "HS|CODE|ROTATING", but a typed or printed code arrives on
  its own. One function reads both, and everything that touches a code calls
  it — the scanner used to work this out in two places with two different
  conditions, and one of them was wrong: it fell back to storing the WHOLE
  payload whenever the pass happened to have no name on it. The server then
  looked for a pass whose code was "HS|ABC123|4821", found nothing, and the
  admission was lost without an error anywhere.
*/
export const codeOf = (payload) => {
  const parts = String(payload || "").split("|");
  return (parts.length > 1 ? parts[1] : parts[0]) || "";
};

/*
  Remove only the entries the server confirmed it has finished with, and leave
  everything else queued.

  This is the difference between a queue and a hope. Emptying it on a
  successful response assumed the server took all of it, which it does not
  when there are more than five hundred entries or when one of them is
  malformed.
*/
export function dequeue(codes) {
  const done = new Set((codes || []).filter(Boolean));
  if (!done.size) return getQueue();
  const left = getQueue().filter((e) => !done.has(e.code));
  write(QUEUE_KEY, left);
  return left;
}

export function queueAdmission(code, party) {
  const queue = getQueue();
  // Never queue the same pass twice — a double tap should not become two
  // admissions when it syncs.
  if (queue.some((e) => e.code === code)) return queue;
  queue.push({ code, party, at: new Date().toISOString() });
  write(QUEUE_KEY, queue);
  return queue;
}

/*
  Check a pass against the local copy.

  Returns the same shapes the server does, so the scanner does not need two
  sets of logic for online and offline.
*/
export function checkOffline(payload) {
  const roster = getRoster();
  if (!roster) return { ok: false, reason: "NO_ROSTER" };

  const parts = String(payload || "").split("|");
  const code = (parts.length === 3 ? parts[1] : String(payload || "")).trim().toUpperCase();

  const pass = roster.passes.find((p) => p.code === code);
  if (!pass) return { ok: false, reason: "UNKNOWN" };
  if (pass.status === "REVOKED") return { ok: false, reason: "REVOKED", name: pass.name };

  if (roster.party && new Date(roster.party.doors_close_at).getTime() < Date.now()) {
    return { ok: false, reason: "PARTY_OVER", name: pass.name };
  }

  // Admitted before we went offline, or admitted by this device since.
  const queued = getQueue().some((e) => e.code === code);
  if (pass.admitted_at || queued) {
    return { ok: false, reason: "USED", name: pass.name, at: pass.admitted_at || "just now" };
  }

  return {
    ok: true,
    name: pass.name,
    kind: pass.kind,
    tier: pass.tier,
    ticketRef: pass.ticket_ref,
    idRequired: !!pass.id_required,
    offline: true,
  };
}

// How many the local copy believes are already in, for the capacity count.
export function localAdmittedCount() {
  const roster = getRoster();
  if (!roster) return 0;
  const already = roster.passes.filter((p) => p.admitted_at).length;
  return already + getQueue().length;
}
