import { usePageMeta } from "../lib/seo";
import React, { useEffect, useRef, useState } from "react";
import { Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontText, fontMasthead, theme } from "../components/Shared";
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
  VALID:     { bg: "#1E4620", fg: "#F3EBD9", label: "VALID" },
  USED:      { bg: "#7A2E2E", fg: "#F3EBD9", label: "ALREADY USED" },
  EXPIRED:   { bg: "#7A5A2E", fg: "#F3EBD9", label: "CODE EXPIRED" },
  UNKNOWN:   { bg: "#7A2E2E", fg: "#F3EBD9", label: "NOT ON THE LIST" },
  NOT_A_PASS:{ bg: "#463F35", fg: "#F3EBD9", label: "NOT A PASS" },
  PARTY_OVER:{ bg: "#463F35", fg: "#F3EBD9", label: "PASS FOR ANOTHER NIGHT" },
  NO_PARTY:  { bg: "#463F35", fg: "#F3EBD9", label: "PASS NOT LINKED TO A NIGHT" },
  WRONG_CODE:{ bg: "#7A2E2E", fg: "#F3EBD9", label: "WRONG CODE" },
  NOT_VALID: { bg: "#7A2E2E", fg: "#F3EBD9", label: "NOT A VALID CODE" },
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
        setOffline(false);
        setAdmitted(door.localAdmittedCount());

        const pending = door.getQueue();
        if (pending.length) {
          const sync = await api.syncAdmissions(pending);
          if (sync.ok) {
            door.clearQueue();
            setQueued(0);
            if (sync.conflicts?.length) {
              setError(`${sync.conflicts.length} of those were already admitted elsewhere.`);
            }
          }
        }
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
    Everything is decided by the server: whether the code is live, whether the
    pass was already admitted, whether the night is over. The door phone only
    reports what it read and shows the answer.

    That is what makes two phones on one door possible — they share one record
    rather than each keeping their own.
  */
  const handle = async (payload) => {
    const code = String(payload || "").split("|")[1] || String(payload || "");
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
        door.queueAdmission(local.name && payload.split("|")[1] ? payload.split("|")[1] : payload, partyId);
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

      <section className="max-w-[520px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
          Door
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{offline ? "OFFLINE" : "ONLINE"}{queued > 0 ? ` · ${queued} TO SYNC` : ""}</span>
          <span style={{
            // Amber near the limit, red at it — a full room should be seen
            // coming, not discovered.
            color: roster?.party?.capacity
              ? (admitted >= roster.party.capacity ? "#7A2E2E"
                : admitted >= roster.party.capacity * ((roster.capacityWarnAt ?? 90) / 100) ? "#7A5A2E"
                : theme.ink2)
              : theme.ink2,
          }}>
            {admitted} IN{roster?.party?.capacity ? ` / ${roster.party.capacity}` : ""}
          </span>
        </div>

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
                 style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: "#8C887E" }}>
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
             style={{ ...fontText, fontSize: "15px", color: "#7A2E2E", border: "1px solid #C08A8A" }}>
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
