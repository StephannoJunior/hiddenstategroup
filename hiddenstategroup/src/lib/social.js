// Every Instagram account, in one place.
// Tracking codes (?igsi=…) stripped — the plain handle URL is stable and
// looks cleaner if anyone copies the link.

const ig = (handle) => ({ handle: "@" + handle, url: "https://www.instagram.com/" + handle });

export const SOCIAL = {
  // Hidden State
  group:    ig("hiddenstategroup"),
  official: ig("hiddenstateofficial"),
  agency:   ig("hiddenstateagency"),
  records:  ig("hiddenstaterecords"),
  news:     ig("hiddenstatenews"),

  // Artists
  stephannojr: ig("stephannojuniorofficial"),
  djtengu:     ig("dj.tengu_"),
  djmario:     ig("mario_daniel28"),

  // Partners / events
  astryon: ig("astryonfestival"),
};
