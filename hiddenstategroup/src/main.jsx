import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/*
  Service worker registration, with automatic updates.

  The site checks for a new version on load, whenever you return to the tab,
  and once an hour while it is open. When a new worker takes control, the page
  reloads itself once — so an installed app picks up your changes without
  anyone tapping anything.

  The reload is guarded by a flag: without it, the controller handing over on
  a first install would trigger a reload loop.
*/
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // updateViaCache: "none" stops the browser serving a cached copy of the
      // worker file itself, which would hide new versions from us entirely.
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        const check = () => reg.update().catch(() => {});

        // A new worker has installed while an old one is still in charge:
        // tell it to take over now rather than wait for every tab to close.
        reg.addEventListener("updatefound", () => {
          const fresh = reg.installing;
          if (!fresh) return;
          fresh.addEventListener("statechange", () => {
            if (fresh.state === "installed" && navigator.serviceWorker.controller) {
              fresh.postMessage("SKIP_WAITING");
            }
          });
        });

        // Returning to the app is the moment people most expect it to be
        // current, so check then. Plus hourly for anyone leaving it open.
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) check();
        });
        setInterval(check, 60 * 60 * 1000);
        check();
      })
      .catch(() => {
        /* offline support is a bonus; never break the site over it */
      });
  });
}
