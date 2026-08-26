import { usePageMeta } from "../lib/seo";
import React, { useEffect, useRef, useState } from "react";
import { Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontText, fontMasthead, theme } from "../components/Shared";
import DoorGate from "../components/DoorGate";
import { verifyPayload, findPass, partyOf, partyIsUpcoming,
         readUsed, markUsed, markRefused, clearUsed, upcomingParties } from "../lib/passes";

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
  const [used, setUsed] = useState({});
  const [error, setError] = useState("");

  useEffect(() => { setUsed(readUsed()); }, []);

  const handle = async (payload) => {
    const check = await verifyPayload(payload);

    if (!check.ok) {
      if (check.pass) markRefused(check.pass.code, check.pass.name, check.reason);
      setResult({ tone: TONE[check.reason] || TONE.NOT_A_PASS, name: check.pass?.name || null });
      return;
    }
    const already = readUsed()[check.pass.code];
    if (already) {
      markRefused(check.pass.code, check.pass.name, "USED");
      setResult({
        tone: TONE.USED,
        name: check.pass.name,
        note: `Admitted ${new Date(already.at).toLocaleTimeString()}`,
      });
      return;
    }
    setUsed(markUsed(check.pass.code, check.pass.name));
    setResult({ tone: TONE.VALID, name: check.pass.name, note: check.pass.type });
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
          // Pause briefly so one pass is not read twenty times in a second.
          setTimeout(() => requestAnimationFrame(step), 1800);
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const admitted = Object.keys(used).length;

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
          <span>{upcomingParties()[0] ? upcomingParties()[0].name : "NO PARTY SET"}</span>
          <span>{admitted} ADMITTED</span>
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
              onClick={() => {
                const p = findPass(manual.trim());
                if (!p) { setResult({ tone: TONE.UNKNOWN }); return; }
                const party = partyOf(p);
                if (!partyIsUpcoming(party)) {
                  setResult({ tone: TONE.PARTY_OVER, name: p.name,
                              note: party ? party.name : "unlinked" });
                  return;
                }
                const already = readUsed()[p.code];
                if (already) {
                  setResult({ tone: TONE.USED, name: p.name, note: `Admitted ${new Date(already.at).toLocaleTimeString()}` });
                } else {
                  setUsed(markUsed(p.code, p.name));
                  setResult({ tone: TONE.VALID, name: p.name, note: p.type + " · checked by code" });
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

        {role.can.seeList && admitted > 0 && (
          <div className="mt-7 pt-5" style={{ borderTop: "1px solid " + theme.rule }}>
            <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              ADMITTED TONIGHT
            </p>
            {Object.entries(used).map(([code, info]) => (
              <div key={code} className="flex justify-between py-2"
                   style={{ borderBottom: "1px solid " + theme.rule }}>
                <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{info.name}</span>
                <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2 }}>
                  {new Date(info.at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            <button
              onClick={() => { if (window.confirm("Clear the admitted list for a fresh night?")) { clearUsed(); setUsed({}); } }}
              className="mt-4 pb-0.5"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em",
                       color: theme.ink2, borderBottom: "1px solid " + theme.rule }}
            >
              RESET FOR A NEW NIGHT
            </button>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

export default function Scan() {
  return <DoorGate>{(role) => <ScanScreen role={role} />}</DoorGate>;
}
