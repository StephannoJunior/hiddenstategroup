// Hidden State — contact addresses.
//
// These are the public addresses shown on the site. Each one needs to actually
// exist and receive mail — see the note at the bottom.

export const EMAILS = {
  general:    { label: "General enquiries",   address: "info@hiddenstategroup.com" },
  booking:    { label: "Booking",             address: "booking@hiddenstategroup.com" },
  management: { label: "Management",          address: "management@hiddenstategroup.com" },
  records:    { label: "Records / demos",     address: "records@hiddenstategroup.com" },
  press:      { label: "Press & news",        address: "news@hiddenstategroup.com" },
  hello:      { label: "Say hello",           address: "hello@hiddenstategroup.com" },
};

// Where each form should land.
export const FORM_TO = {
  booking: EMAILS.booking.address,
  contact: EMAILS.general.address,
};

export const mailto = (address, subject) =>
  `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

