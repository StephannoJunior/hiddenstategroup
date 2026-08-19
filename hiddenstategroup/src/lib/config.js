// ---------------------------------------------------------------------------
// FORM DELIVERY — where booking and contact submissions get emailed.
//
// HOW TO SET THIS UP (about 5 minutes, free):
//   1. Go to https://formspree.io and sign up with the email address you want
//      the enquiries delivered to.
//   2. Create a new form. Call it "Hidden State".
//   3. It gives you an endpoint like:  https://formspree.io/f/mqkrgvpz
//   4. Copy ONLY the last part (mqkrgvpz) and paste it between the quotes below.
//   5. Save, commit to GitHub, and Cloudflare redeploys automatically.
//
// Until this is filled in, the forms show an honest error telling people to
// email instead — they will NOT pretend the message was sent.
// ---------------------------------------------------------------------------

export const FORMSPREE_ID = "";

// Shown to visitors as a fallback if a submission fails for any reason.
export const CONTACT_EMAIL = "hello@hiddenstategroup.com";

export const FORM_ENDPOINT = FORMSPREE_ID
  ? `https://formspree.io/f/${FORMSPREE_ID}`
  : null;
