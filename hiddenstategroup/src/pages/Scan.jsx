import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Nav, Footer, useGoogleFonts, IndexBand, PageHead,
         fontDisplay, fontUtility, fontText, theme } from "../components/Shared";
import DoorGate from "../components/DoorGate";
import * as api from "../lib/api";
import * as door from "../lib/door";

/*
  Door scanner. Opened on one phone at the entrance.

  Deliberate decisions, because a door is a hostile place for software:

    • The result panel is huge and colour-coded. Door staff read it in bad
      light, at arm's length, with a queue behind. Small grey text fails.
    • There is a manual entry box. Cameras fail, screens crack, phones die at
      2%. Being able to type the code on the pass is the difference between a
      slow queue and a stopped one.
    • Nothing here needs the internet after the page has loaded. Basements
      kill signal, and a scanner that phones home is a scanner that fails.
*/

const TONE = {
  VALID:     { bg: theme.good, fg: theme.bg, label: "VALID" },
  USED:      { bg: theme.bad, fg: theme.bg, label: "ALREADY USED" },
  EXPIRED:   { bg: theme.warn, fg: theme.bg, label: "CODE EXPIRED" },
  UNKNOWN:   { bg: theme.bad, fg: theme.bg, label: "NOT ON THE LIST" },
  NOT_A_PASS:{ bg: theme.ink2, fg: theme.bg, label: "NOT A PASS" },
  PARTY_OVER:{ bg: theme.ink2, fg: theme.bg, label: "PASS FOR ANOTHER NIGHT" },
  NO_PARTY:  { bg: theme.ink2, fg: theme.bg, label: "PASS NOT LINKED TO A NIGHT" },
  WRONG_CODE:{ bg: theme.bad, fg: theme.bg, label: "WRONG CODE" },
  NOT_VALID: { bg: theme.bad, fg: theme.bg, label: "NOT A VALID CODE" },
};

function ScanScreen({ role }) {
  useGoogleFonts();
  usePageMeta({ title: "Door scanner", description: "Hidden State entry scanner." });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState("");
  const [admitted, setAdmitted] = useState(0);
  const [offline, setOffline] = useState(false);
  const [roster, setRoster] = useState(null);
  const [queued, setQueued] = useState(0);
  const [armed, setArmed] = useState(() => door.armedState(null));
  const [arming, setArming] = useState(false);
  const [look, setLook] = useState("");
  const [found, setFound] = useState([]);
  const [looking, setLooking] = useState(false);

  /*
    The camera reads the same QR many times a second. Without this, one pass
    held up for three seconds becomes twenty scans — and the second one
    reports ALREADY USED, which looks to staff like a refusal.

    So the same code is ignored entirely for a few seconds after it is read.
  */
  const lastScan = useRef({ code: null, at: 0 });
  const COOLDOWN_MS = 4000;

  /*
    Pull the guest list down when the door opens, and again whenever signal
    returns. Anything admitted while offline is sent up at the same moment,
    so the record catches up without anyone having to remember to do it.
  */
  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const parties = await api.listParties();
      if (!alive || !parties.ok || !parties.parties?.length) { setOffline(true); return; }
      const partyId = parties.parties[0].id;

      const res = await api.fetchRoster(partyId);
      if (!alive) return;
      if (res.ok) {
        door.saveRoster(res);
        setRoster(res);
        setArmed(door.armedState(partyId));
        setOffline(false);
        setAdmitted(door.localAdmittedCount());

        /*
          SEND WHAT IS WAITING, IN BATCHES, AND REMOVE ONLY WHAT LANDED.

          Two hundred at a time: the server takes five hundred per request, so
          a busy night that queued more than that used to have the remainder
          silently dropped when the door emptied its whole queue on the first
          successful reply. Now each batch removes exactly the codes the
          server says it dealt with, and anything unacknowledged is still
          there for the next attempt.

          The loop stops the moment a batch fails rather than pressing on:
          if the signal has gone again, the next one will fail too, and
          hammering a dead connection at the door helps nobody.
        */
        let waiting = door.getQueue();
        let conflicts = 0;
        let lost = 0;

        while (waiting.length) {
          const batch = waiting.slice(0, 200);
          const sync = await api.syncAdmissions(batch);
          if (!alive) return;
          if (!sync.ok) break;

          conflicts += sync.conflicts?.length || 0;
          lost += sync.rejected?.length || 0;

          const before = waiting.length;
          waiting = door.dequeue([
            ...(sync.handled || []),
            ...(sync.rejected || []).filter(Boolean),
          ]);
          // Nothing acknowledged means retrying would loop forever.
          if (waiting.length >= before) break;
        }

        setQueued(waiting.length);
        if (conflicts) setError(`${conflicts} of those were already admitted elsewhere.`);
        else if (lost) setError(`${lost} queued scan${lost === 1 ? "" : "s"} could not be read and ${lost === 1 ? "was" : "were"} dropped.`);
      } else {
        setOffline(true);
      }
    };

    // Use whatever was downloaded last time until the fresh copy lands.
    const cached = door.getRoster();
    if (cached) { setRoster(cached); setAdmitted(door.localAdmittedCount()); }
    setQueued(door.getQueue().length);

    refresh();
    window.addEventListener("online", refresh);
    const id = setInterval(refresh, 60000);
    return () => { alive = false; window.removeEventListener("online", refresh); clearInterval(id); };
  }, []);
  const [error, setError] = useState("");




  /*
    ── D01 · ARM THE DOOR ────────────────────────────────────────────────

    The guest list already downloads when this page opens. What was missing
    is that nothing SAID so — a phone with no list looked exactly like a
    phone with one, and the difference only showed when somebody was standing
    in front of you.

    Now the state is on screen, and there is a button to do it deliberately
    before you leave, on wifi, rather than discovering the problem in a
    basement.
  */
  const armNow = useCallback(async () => {
    setArming(true);
    const parties = await api.listParties();
    if (!parties.ok || !parties.parties?.length) {
      setArming(false);
      setArmed(door.armedState(null));
      setError("Couldn't reach the guest list. Try again while you have signal.");
      return;
    }
    const partyId = parties.parties[0].id;
    const res = await api.fetchRoster(partyId);
    setArming(false);
    if (!res.ok) {
      setError("Couldn't download the list. Try again while you have signal.");
      return;
    }
    door.saveRoster(res);
    setRoster(res);
    setArmed(door.armedState(partyId));
    setOffline(false);
    setError("");
  }, []);

  /*
    ── D02 · KEEP THE PHONE AWAKE ────────────────────────────────────────

    A phone locks after thirty seconds. At a door that means unlocking
    between guests, one-handed, in the dark, with a queue watching.

    The lock is released when the page is left, and re-taken if the phone was
    locked and reopened — a wake lock does not survive that on its own, and a
    scanner that quietly stops staying awake halfway through a night is worse
    than one that never did.
  */
  useEffect(() => {
    if (!("wakeLock" in navigator)) return undefined;
    let lock = null;
    let alive = true;

    const take = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener?.("release", () => { lock = null; });
      } catch {
        /* refused, or the battery is too low — the door still works */
      }
    };
    const onVisible = () => {
      if (!alive) return;
      if (document.visibilityState === "visible" && !lock) take();
    };

    take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      try { lock?.release(); } catch { /* already gone */ }
    };
  }, []);


  /*
    ── D03 · FIND A GUEST BY NAME ────────────────────────────────────────

    A code written on a physical ticket gets smudged, soaked, or the ticket is
    left on a kitchen table. Until now the door could answer a code and
    nothing else, so a real guest with a real pass had no way through except
    an argument at the front of a queue.

    Only while there is signal: this searches the server rather than the
    downloaded list, because a name is a judgement call and the person making
    it should be looking at the current truth, not a copy from three hours
    ago. Offline, the scanner still does what it always did.
  */
  const search = useCallback(async (q) => {
    setLook(q);
    if (q.trim().length < 2) { setFound([]); return; }
    setLooking(true);
    const res = await api.searchPasses(q.trim(), roster?.party?.id || "");
    setLooking(false);
    if (res.ok) setFound(res.passes || []);
  }, [roster]);

  const admitByHand = async (pass) => {
    const why = window.prompt(
      `Admit ${pass.name} by hand?\n\nSay why — it goes on the record.`,
      "ticket unreadable"
    );
    if (why === null) return;
    const res = await api.admitByHand(pass.code, why);
    if (!res.ok) {
      setError(res.reason === "USED"
        ? `${pass.name} has already been admitted.`
        : (res.error || "That did not go through."));
      return;
    }
    setAdmitted((n) => n + 1);
    setResult({ tone: TONE.VALID, name: res.name, note: "ADMITTED BY HAND" });
    setFound([]);
    setLook("");
    if (navigator.vibrate) navigator.vibrate(40);
  };

  /*
    Everything is decided by the server: whether the code is live, whether the
    pass was already admitted, whether the night is over. The door phone only
    reports what it read and shows the answer.

    That is what makes two phones on one door possible — they share one record
    rather than each keeping their own.
  */
  const handle = async (payload) => {
    const code = door.codeOf(payload);
    const since = Date.now() - lastScan.current.at;
    if (lastScan.current.code === code && since < COOLDOWN_MS) return;
    lastScan.current = { code, at: Date.now() };

    let res = await api.scan(payload);

    /*
      No connection: check against the downloaded copy instead of refusing.
      The result says OFFLINE so nobody mistakes a weaker check for a full
      one — offline the rotating number cannot be verified.
    */
    if (res.error && /connection/i.test(res.error)) {
      setOffline(true);
      const local = door.checkOffline(payload);
      if (local.ok) {
        const partyId = roster?.party?.id;
        // One reading of the code, shared with the online path — see codeOf.
        door.queueAdmission(door.codeOf(payload), partyId);
        setQueued(door.getQueue().length);
        setAdmitted((n) => n + 1);
        setResult({ tone: TONE.VALID, name: local.name,
                    note: `${local.kind}${local.tier ? " · " + local.tier : ""} · OFFLINE`,
                    checkId: !!local.idRequired });
        if (navigator.vibrate) navigator.vibrate(40);
        return;
      }
      setResult({ tone: TONE[local.reason] || TONE.NOT_A_PASS, name: local.name || null,
                  note: local.reason === "NO_ROSTER" ? "No list downloaded" : "OFFLINE" });
      return;
    }

    setOffline(false);

    if (res.signedOut) {
      setResult({ tone: TONE.NOT_A_PASS, name: null, note: "Signed out — sign in again" });
      return;
    }
    if (!res.ok) {
      setResult({
        tone: TONE[res.reason] || TONE.NOT_A_PASS,
        name: res.name || null,
        note: res.at ? `Admitted ${new Date(res.at).toLocaleTimeString()}` : res.note || null,
      });
      return;
    }

    setAdmitted((n) => n + 1);
    setResult({
      tone: TONE.VALID,
      name: res.name,
      note: res.ticketRef ? `${res.tier || res.kind} · ${res.ticketRef}` : res.kind,
      checkId: !!res.idRequired,
    });
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },   // rear camera
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      loop();
    } catch {
      setError("Couldn't open the camera. Use the code box below instead.");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const loop = async () => {
    let jsQR;
    try {
      jsQR = (await import("jsqr")).default;
    } catch {
      setError("Scanner library unavailable. Use the code box below.");
      return;
    }

    const step = () => {
      if (!streamRef.current) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const found = jsQR(img.data, img.width, img.height);
        if (found?.data) {
          handle(found.data);
          // Keep looking, but the cooldown above stops the same pass being
          // reported twice.
          setTimeout(() => requestAnimationFrame(step), 700);
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };



  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      {/*
        The door's own status IS the metadata of this page — whether it can
        reach the server, what is waiting to sync, how full the room is. It
        belongs in the band, where every other page of the system puts its
        facts, rather than in a hairline row under a centred title.
      */}
      <IndexBand top items={[
        { label: "DOOR", value: armed.armed ? "ARMED" : "NOT ARMED" },
        { label: "LINK", value: offline ? "OFFLINE" : "ONLINE" },
        ...(queued > 0 ? [{ label: "TO SYNC", value: String(queued) }] : []),
        { label: "ADMITTED", value: roster?.party?.capacity
            ? `${admitted} / ${roster.party.capacity}` : String(admitted) },
      ]} />
      <PageHead flush kicker="SCAN AND ADMIT" title="The Door" />

      <section className="max-w-[520px] mx-auto px-[18px] pb-16">

        {/*
          THE STATE OF THE DOOR, SAID PLAINLY.

          Loud when it is wrong and quiet when it is right — the opposite of
          how status displays usually behave. A green tick nobody reads is
          worth nothing; a red panel that says WHAT IS WRONG and offers the
          one button that fixes it is worth the whole feature.
        */}
        {!armed.armed ? (
          <div className="mt-5 px-4 py-4" style={{ background: theme.bad, color: theme.bg }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.22em" }}>
              NOT ARMED — {armed.why}
            </p>
            <p className="m-0 mt-2" style={{ ...fontText, fontSize: "16.5px", lineHeight: 1.5 }}>
              {armed.why === "NO LIST"
                ? "There is no guest list on this phone. Without signal at the door, nothing can be checked."
                : armed.why === "WRONG NIGHT"
                ? "The list on this phone is for a different night. It would answer confidently and wrongly."
                : "The list on this phone is out of date. Passes issued since are not on it."}
            </p>
            <button onClick={armNow} disabled={arming} className="mt-3 px-4 py-3"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                             background: theme.bg, color: theme.ink, border: 0,
                             cursor: "pointer", opacity: arming ? 0.6 : 1 }}>
              {arming ? "DOWNLOADING…" : "ARM THE DOOR NOW"}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.good }}>
              ARMED · {armed.count} PASSES · {armed.age < 1
                ? "JUST NOW"
                : `${Math.round(armed.age)}H AGO`}
            </span>
            <button onClick={armNow} disabled={arming}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                             background: "transparent", color: theme.ink2,
                             border: `1px solid ${theme.rule}`, padding: "7px 10px",
                             cursor: "pointer", opacity: arming ? 0.6 : 1 }}>
              {arming ? "…" : "REFRESH"}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-5 px-5 py-7 text-center" style={{ background: result.tone.bg }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "13px", letterSpacing: "0.24em", color: result.tone.fg }}>
              {result.tone.label}
            </p>
            {result.name && (
              <p className="m-0 mt-2" style={{ ...fontDisplay, fontSize: "30px", color: result.tone.fg }}>
                {result.name}
              </p>
            )}
            {result.admits > 1 && (
              <p className="m-0 mt-3 py-2.5"
                 style={{ ...fontDisplay, fontSize: "22px", color: result.tone.fg,
                          border: `1px solid rgba(243,235,217,0.55)` }}>
                ADMITS {result.admits}
              </p>
            )}
            {result.checkId && (
              <p className="m-0 mt-3 py-2"
                 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.2em",
                          color: result.tone.fg, border: "1px solid rgba(243,235,217,0.5)" }}>
                CHECK ID — NAME MUST MATCH
              </p>
            )}
            {result.note && (
              <p className="m-0 mt-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: result.tone.fg, opacity: 0.85 }}>
                {result.note}
              </p>
            )}
          </div>
        )}

        <div className="mt-5" style={{ border: "1px solid " + theme.ink, background: theme.ink }}>
          <video ref={videoRef} playsInline muted
                 style={{ width: "100%", display: running ? "block" : "none", aspectRatio: "1 / 1", objectFit: "cover" }} />
          {!running && (
            <div className="py-16 text-center"
                 style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink2 }}>
              CAMERA OFF
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="flex gap-3 mt-4">
          <button onClick={running ? stop : start} className="flex-1 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                           background: theme.ink, color: theme.bg }}>
            {running ? "STOP" : "START CAMERA"}
          </button>
          <button onClick={() => setResult(null)} className="px-6 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                           color: theme.ink, border: "1px solid " + theme.ink }}>
            CLEAR
          </button>
        </div>

        {error && (
          <p className="mt-3 mb-0 px-3 py-2.5"
             style={{ ...fontText, fontSize: "15px", color: theme.bad, border: `1px solid ${theme.badLine}` }}>
            {error}
          </p>
        )}

        {/* Always available, never hidden behind a menu. */}
        <div className="mt-7 pt-5" style={{ borderTop: "1px solid " + theme.rule }}>
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            OR TYPE THE PASS CODE
          </p>
          <div className="flex gap-3">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="HS-0000"
              style={{ flex: 1, background: "transparent", border: "1px solid " + theme.rule,
                       color: theme.ink, padding: "12px", fontSize: "17px", letterSpacing: "0.1em" }}
            />
            <button
              onClick={async () => {
                const typed = manual.trim();
                if (!typed) return;
                // A typed entry may be either the pass code or the number on
                // screen; the server works out which.
                const res = await api.scanByCode(typed);
                if (res.ok) {
                  setAdmitted((n) => n + 1);
                  setResult({ tone: TONE.VALID, name: res.name, note: `${res.kind} · checked by code`, checkId: !!res.idRequired });
                } else {
                  setResult({ tone: TONE[res.reason] || TONE.UNKNOWN, name: res.name || null });
                }
                setManual("");
              }}
              className="px-6"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                       background: theme.ink, color: theme.bg }}
            >
              CHECK
            </button>
          </div>
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", color: theme.ink2 }}>
            Typing the code skips the rotating check, so use it only when the
            camera will not read a screen.
          </p>
        </div>

        {/*
          ── D03 · BY NAME, WHEN THERE IS NO CODE AT ALL ────────────────────

          Only offered while there is signal. A name is a judgement, and the
          person making it should be looking at the current list rather than a
          copy downloaded three hours ago.
        */}
        {!offline && (
          <div className="mt-7 pt-6" style={{ borderTop: `1px solid ${theme.rule}` }}>
            <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px",
               letterSpacing: "0.2em", color: theme.brass }}>
              NO CODE? FIND THEM BY NAME
            </p>
            <input
              value={look}
              onChange={(e) => search(e.target.value)}
              placeholder="Start typing a name"
              autoCapitalize="words" autoCorrect="off"
              style={{ width: "100%", background: "transparent",
                       border: `1px solid ${theme.rule}`, color: theme.ink,
                       padding: "12px", fontSize: "17px" }}
            />

            {looking && (
              <p className="m-0 mt-2" style={{ ...fontUtility, fontSize: "9px",
                 letterSpacing: "0.16em", color: theme.ink2 }}>LOOKING…</p>
            )}

            {found.map((p) => (
              <div key={p.code} className="flex items-center gap-3 py-3"
                   style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {p.name}
                  </span>
                  <span className="block" style={{ ...fontUtility, fontSize: "8.5px",
                        letterSpacing: "0.14em", color: theme.ink2 }}>
                    {p.code} · {p.kind}{p.tier ? " · " + p.tier : ""}
                    {p.admits > 1 ? ` · ADMITS ${p.admits}` : ""}
                  </span>
                </span>
                {p.status === "REVOKED" ? (
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                                 color: theme.bad }}>CANCELLED</span>
                ) : p.admitted_at ? (
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                                 color: theme.ink2 }}>ALREADY IN</span>
                ) : (
                  <button onClick={() => admitByHand(p)}
                          style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                                   background: theme.ink, color: theme.bg, border: 0,
                                   padding: "10px 13px", cursor: "pointer" }}>
                    ADMIT
                  </button>
                )}
              </div>
            ))}

            {look.trim().length >= 2 && !looking && found.length === 0 && (
              <p className="m-0 mt-3" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
                Nobody by that name on tonight's list.
              </p>
            )}

            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "14px", color: theme.ink2 }}>
              Admitting by hand asks you for a reason, and the reason goes on
              the record beside your name.
            </p>
          </div>
        )}

        {role.can.seeList && (
          <p className="m-0 mt-7 pt-5" style={{ ...fontText, fontSize: "15px", color: theme.ink2,
                                                borderTop: `1px solid ${theme.rule}` }}>
            The full list of who came in is on the door list, which every phone
            shares.
          </p>
        )}

      </section>

      <Footer />
    </div>
  );
}

export default function Scan() {
  return <DoorGate>{(role) => <ScanScreen role={role} />}</DoorGate>;
}
