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
const ARMED_KEY = "hs-door-armed";

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

/*
  ARMING THE DOOR.

  The guest list is stored with the MOMENT it was stored and the night it was
  stored for. Both matter, and neither was kept before:

    · a list downloaded three days ago is not a list, it is a memory — passes
      have been issued since, and a guest holding a real one would be refused
    · a list for last week's party is worse than nothing, because it answers
      confidently and wrongly

  With those two facts on the phone, the scanner can say ARMED or NOT ARMED
  instead of looking identical either way. That was the whole problem: a door
  phone with no list looks exactly like a door phone with one, right up until
  the queue arrives.
*/
export function saveRoster(roster) {
  write(ROSTER_KEY, roster);
  write(ARMED_KEY, { at: new Date().toISOString(), party: roster?.party?.id || null });
  return roster;
}

export function armedState(partyId, staleHours = 12) {
  const mark = read(ARMED_KEY, null);
  const roster = getRoster();
  if (!roster || !mark) return { armed: false, why: "NO LIST" };
  if (partyId && mark.party && mark.party !== partyId)
    return { armed: false, why: "WRONG NIGHT", at: mark.at };

  const age = (Date.now() - Date.parse(mark.at)) / 3600000;
  if (!Number.isFinite(age)) return { armed: false, why: "NO LIST" };
  if (age > staleHours) return { armed: false, why: "OUT OF DATE", at: mark.at, age };
  return { armed: true, at: mark.at, age, count: (roster.passes || []).length };
}

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

export function queueAdmission(code, party, allowed = 1) {
  const queue = getQueue();

  /*
    ── HOW MANY TIMES ONE CODE MAY QUEUE — N02 ──────────────────────────────

    This used to be "never twice", which was right when a pass meant one
    person and wrong the moment a pass could admit four: the second, third and
    fourth of a group would be let through the door and then silently dropped
    on the next sync, so the record said one person came and three did not.

    So the cap is the pass's own `admits` rather than a flat one. What that
    gives up is the protection against a double tap becoming two admissions —
    which was never really this function's job anyway. The scanner already
    ignores the same code for several seconds after reading it, which is what
    actually stops a camera left pointing at a pass from counting it forty
    times. This is the ceiling; that is the debounce.
  */
  const cap = Math.max(1, Number(allowed) || 1);
  if (queue.filter((e) => e.code === code).length >= cap) return queue;

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

  /*
    ── N02 · COUNTING, NOT A FLAG ───────────────────────────────────────────

    This asked one question — "has this pass been used?" — and refused if the
    answer was yes. On a pass that admits four that is wrong three times out
    of four: the second, third and fourth people are turned away at the door
    by a phone with no signal, and there is nobody to appeal to.

    So the roster now carries the same two numbers the server works from, and
    this counts. `ins - outs` is how many of the party are inside according to
    the last download; anything this device has queued since is added, because
    those people walked past this phone and the server has not heard yet.
  */
  const allowed = Math.max(1, Number(pass.admits) || 1);
  const queuedHere = getQueue().filter((e) => e.code === code).length;
  const inside = Math.max(0, Number(pass.ins || 0) - Number(pass.outs || 0)) + queuedHere;

  if (inside >= allowed) {
    return {
      ok: false, reason: "USED", name: pass.name,
      at: pass.admitted_at || "just now",
      admits: allowed, inHere: inside,
    };
  }

  return {
    ok: true,
    name: pass.name,
    kind: pass.kind,
    tier: pass.tier,
    ticketRef: pass.ticket_ref,
    idRequired: !!pass.id_required,
    admits: allowed,
    inHere: inside + 1,
    /*
      The note travels with the roster, so it is here too. A note that only
      works online is a note that is missing at exactly the moment the
      basement kills the signal — which is when the door is least able to go
      and ask anybody.
    */
    doorNote: pass.door_note ? { note: pass.door_note, tone: pass.door_tone || "INFO" } : null,
    offline: true,
  };
}

// How many the local copy believes are already in, for the capacity count.
export function localAdmittedCount() {
  const roster = getRoster();
  if (!roster) return 0;
  /*
    In PLACES, not passes, and net of exits — a pass that admits four takes
    four of the room, and somebody who has gone home is not in it. Counting
    rows would under-report a full room, which is the dangerous direction.
  */
  const already = roster.passes.reduce(
    (n, p) => n + Math.max(0, Number(p.ins || 0) - Number(p.outs || 0)), 0);
  return already + getQueue().length;
}
