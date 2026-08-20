import React from "react";

/*
  ErrorBoundary — stops one broken component taking the whole site down.

  Without this, a single thrown error anywhere in the tree leaves the visitor
  looking at a blank white page: no header, no message, no way back. That is
  the worst possible failure, because it gives them nothing to act on.

  With it, the failure is contained and the person still gets a page that
  explains itself and offers a way on.

  This has to be a class component — React only supports componentDidCatch on
  classes, with no hook equivalent.
*/

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Left as console output on purpose. Sending errors to a third party
    // would mean routing visitor data off-site, which is not worth doing
    // without a decision about it first.
    console.error("Caught by boundary:", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        style={{
          background: "#F3EBD9",
          color: "#16130E",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'EB Garamond', Georgia, serif",
        }}
      >
        <div style={{ maxWidth: "460px", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "9.5px",
              letterSpacing: "0.2em",
              color: "#8A6A28",
              margin: 0,
            }}
          >
            STOP PRESS
          </p>
          <div style={{ borderTop: "2px solid #16130E", marginTop: "10px" }} />
          <div style={{ borderTop: "1px solid #16130E", marginTop: "3px" }} />

          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(26px,6vw,40px)",
              lineHeight: 1.15,
              margin: "26px 0 12px",
            }}
          >
            Something went wrong on this page.
          </h1>
          <p style={{ fontSize: "17px", lineHeight: 1.6, color: "#463F35", margin: 0 }}>
            The rest of the site is fine. Reloading usually clears it.
          </p>

          <div style={{ marginTop: "28px", display: "flex", gap: "22px", justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "10px",
                letterSpacing: "0.2em",
                background: "#16130E",
                color: "#F3EBD9",
                border: 0,
                padding: "13px 30px",
                cursor: "pointer",
              }}
            >
              RELOAD
            </button>
            <a
              href="/"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "#16130E",
                borderBottom: "1px solid #8A6A28",
                alignSelf: "center",
                textDecoration: "none",
              }}
            >
              HOME
            </a>
          </div>
        </div>
      </div>
    );
  }
}
