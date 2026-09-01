import React, { createContext, useContext, useEffect, useState } from "react";

/*
  Language — interface only.

  A deliberate limit: this translates the CHROME of the site (navigation,
  headings, buttons, labels), not the articles or artist biographies. Those are
  written pieces, and machine-translating them would turn careful copy into
  something that reads badly in every language. If you want an article in
  Romanian, write it in Romanian and add it as its own entry.

  Adding a language: add it to LANGS, then copy the `en` block in STRINGS and
  translate the right-hand side. Any key you leave out falls back to English,
  so a partial translation never breaks the page.
*/

export const LANGS = [
  { code: "en", label: "EN", name: "English" },
  { code: "ro", label: "RO", name: "Română" },
  { code: "es", label: "ES", name: "Español" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "fr", label: "FR", name: "Français" },
];

export const STRINGS = {
  en: {
    write: "WRITE", settings: "SETTINGS",
    scanner: "SCANNER", doorList: "DOOR",
    myPass: "MY PASS", team: "TEAM", site: "SITE", signIn: "SIGN IN", signOut: "SIGN OUT",
    days: "DAYS", hours: "HOURS", minutes: "MINUTES", seconds: "SECONDS", theNightIsHere: "The night is here.", countdownTo: "COUNTING DOWN TO",
    listen: "LISTEN",
    share: "SHARE", linkCopied: "LINK COPIED", backToTop: "BACK TO TOP", minRead: "MIN READ", previous: "PREVIOUS", next: "NEXT",
    news: "NEWS", records: "RECORDS", agency: "AGENCY", artists: "ARTISTS",
    events: "EVENTS", mixes: "MIXES", about: "ABOUT", contact: "CONTACT", home: "HOME",
    theRoster: "The Roster", theAgency: "The Agency", theRecords: "The Records",
    theEvents: "The Events", sessionsRadio: "Sessions & Radio", dailyNews: "Daily News",
    breakingNews: "Breaking News",
    rosterSub: "ARTISTS REPRESENTED BY HIDDEN STATE",
    agencySub: "BOOKING & REPRESENTATION",
    recordsSub: "RELEASED ON HIDDEN STATE RECORDS",
    eventsSub: "NIGHTS, FESTIVALS & EXPERIENCES",
    mixesSub: "RECORDED SETS FROM THE HIDDEN STATE ROSTER",
    readFullStory: "READ THE FULL STORY", readFullProfile: "READ THE FULL PROFILE",
    fullDetails: "FULL DETAILS", listenToSets: "LISTEN TO THE SETS",
    book: "BOOK", getTickets: "GET TICKETS", playAlbum: "PLAY THE ALBUM",
    tracklist: "TRACKLIST", lineUp: "LINE-UP", upcoming: "UPCOMING", pastEvent: "PAST EVENT",
    pastEvents: "PAST EVENTS", fromTheNight: "FROM THE NIGHT", downloadAll: "DOWNLOAD ALL",
    save: "SAVE", close: "CLOSE", printedIssue: "THE PRINTED ISSUE", printedIssues: "THE PRINTED ISSUES",
    moreToCome: "More to come.", nothingFiled: "NOTHING FILED YET",
    ticketsSoon: "TICKET LINK COMING SOON", allIssues: "ALL ISSUES", allEvents: "ALL EVENTS",
    allSessions: "ALL SESSIONS", theStory: "THE STORY", whatWeOffer: "WHAT WE OFFER",
    theDivisions: "THE DIVISIONS", direct: "DIRECT", social: "SOCIAL",
    saveHint: "Press and hold any picture to save it to your phone, or use the download button on each one. You can also take the whole set at once.",
  },
  ro: {
    write: "SCRIE", settings: "SETĂRI",
    scanner: "SCANER", doorList: "UȘĂ",
    myPass: "BILETUL MEU", team: "ECHIPĂ", site: "SITE", signIn: "INTRĂ", signOut: "IEȘI",
    days: "ZILE", hours: "ORE", minutes: "MINUTE", seconds: "SECUNDE", theNightIsHere: "A sosit noaptea.", countdownTo: "NUMĂRĂTOARE INVERSĂ",
    listen: "ASCULTĂ",
    share: "DISTRIBUIE", linkCopied: "LINK COPIAT", backToTop: "SUS", minRead: "MIN CITIRE", previous: "ANTERIOR", next: "URMĂTOR",
    news: "ȘTIRI", records: "MUZICĂ", agency: "AGENȚIE", artists: "ARTIȘTI",
    events: "EVENIMENTE", mixes: "MIXURI", about: "DESPRE", contact: "CONTACT", home: "ACASĂ",
    theRoster: "Artiștii", theAgency: "Agenția", theRecords: "Discografia",
    theEvents: "Evenimente", sessionsRadio: "Sesiuni & Radio", dailyNews: "Daily News",
    breakingNews: "Breaking News",
    rosterSub: "ARTIȘTI REPREZENTAȚI DE HIDDEN STATE",
    agencySub: "BOOKING & REPREZENTARE",
    recordsSub: "LANSAT PE HIDDEN STATE RECORDS",
    eventsSub: "NOPȚI, FESTIVALURI & EXPERIENȚE",
    mixesSub: "SETURI ÎNREGISTRATE DE ARTIȘTII HIDDEN STATE",
    readFullStory: "CITEȘTE ARTICOLUL", readFullProfile: "VEZI PROFILUL",
    fullDetails: "DETALII", listenToSets: "ASCULTĂ SETURILE",
    book: "REZERVĂ", getTickets: "BILETE", playAlbum: "ASCULTĂ ALBUMUL",
    tracklist: "LISTA PIESELOR", lineUp: "LINE-UP", upcoming: "URMEAZĂ", pastEvent: "EVENIMENT TRECUT",
    pastEvents: "EVENIMENTE TRECUTE", fromTheNight: "DIN NOAPTEA ACEEA", downloadAll: "DESCARCĂ TOT",
    save: "SALVEAZĂ", close: "ÎNCHIDE", printedIssue: "EDIȚIA TIPĂRITĂ", printedIssues: "EDIȚIILE TIPĂRITE",
    moreToCome: "Urmează mai multe.", nothingFiled: "NIMIC ÎNCĂ",
    ticketsSoon: "LINK BILETE ÎN CURÂND", allIssues: "TOATE EDIȚIILE", allEvents: "TOATE EVENIMENTELE",
    allSessions: "TOATE SESIUNILE", theStory: "POVESTEA", whatWeOffer: "CE OFERIM",
    theDivisions: "DIVIZIILE", direct: "DIRECT", social: "SOCIAL",
    saveHint: "Ține apăsat pe orice fotografie ca să o salvezi pe telefon, sau folosește butonul de descărcare de pe fiecare. Poți lua și tot setul deodată.",
  },
  es: {
    write: "ESCRIBIR", settings: "AJUSTES",
    scanner: "ESCÁNER", doorList: "PUERTA",
    myPass: "MI PASE", team: "EQUIPO", site: "SITIO", signIn: "ENTRAR", signOut: "SALIR",
    days: "DÍAS", hours: "HORAS", minutes: "MINUTOS", seconds: "SEGUNDOS", theNightIsHere: "La noche ha llegado.", countdownTo: "CUENTA ATRÁS HASTA",
    listen: "ESCUCHAR",
    share: "COMPARTIR", linkCopied: "ENLACE COPIADO", backToTop: "ARRIBA", minRead: "MIN DE LECTURA", previous: "ANTERIOR", next: "SIGUIENTE",
    news: "NOTICIAS", records: "DISCOS", agency: "AGENCIA", artists: "ARTISTAS",
    events: "EVENTOS", mixes: "MIXES", about: "SOBRE", contact: "CONTACTO", home: "INICIO",
    theRoster: "Los Artistas", theAgency: "La Agencia", theRecords: "Los Discos",
    theEvents: "Los Eventos", sessionsRadio: "Sesiones & Radio", dailyNews: "Daily News",
    breakingNews: "Breaking News",
    rosterSub: "ARTISTAS REPRESENTADOS POR HIDDEN STATE",
    agencySub: "BOOKING & REPRESENTACIÓN",
    recordsSub: "PUBLICADO EN HIDDEN STATE RECORDS",
    eventsSub: "NOCHES, FESTIVALES & EXPERIENCIAS",
    mixesSub: "SESIONES GRABADAS DE LOS ARTISTAS",
    readFullStory: "LEER LA NOTICIA", readFullProfile: "VER EL PERFIL",
    fullDetails: "DETALLES", listenToSets: "ESCUCHAR LAS SESIONES",
    book: "RESERVAR", getTickets: "ENTRADAS", playAlbum: "ESCUCHAR EL ÁLBUM",
    tracklist: "LISTA DE TEMAS", lineUp: "LINE-UP", upcoming: "PRÓXIMO", pastEvent: "EVENTO PASADO",
    pastEvents: "EVENTOS PASADOS", fromTheNight: "DE LA NOCHE", downloadAll: "DESCARGAR TODO",
    save: "GUARDAR", close: "CERRAR", printedIssue: "LA EDICIÓN IMPRESA", printedIssues: "LAS EDICIONES IMPRESAS",
    moreToCome: "Pronto habrá más.", nothingFiled: "AÚN NADA",
    ticketsSoon: "ENTRADAS PRÓXIMAMENTE", allIssues: "TODAS LAS EDICIONES", allEvents: "TODOS LOS EVENTOS",
    allSessions: "TODAS LAS SESIONES", theStory: "LA HISTORIA", whatWeOffer: "QUÉ OFRECEMOS",
    theDivisions: "LAS DIVISIONES", direct: "DIRECTO", social: "SOCIAL",
    saveHint: "Mantén pulsada cualquier foto para guardarla en tu teléfono, o usa el botón de descarga de cada una. También puedes llevarte el set completo.",
  },
  de: {
    write: "SCHREIBEN", settings: "EINSTELLUNGEN",
    scanner: "SCANNER", doorList: "TÜR",
    myPass: "MEIN PASS", team: "TEAM", site: "SEITE", signIn: "ANMELDEN", signOut: "ABMELDEN",
    days: "TAGE", hours: "STUNDEN", minutes: "MINUTEN", seconds: "SEKUNDEN", theNightIsHere: "Die Nacht ist da.", countdownTo: "COUNTDOWN BIS",
    listen: "ANHÖREN",
    share: "TEILEN", linkCopied: "LINK KOPIERT", backToTop: "NACH OBEN", minRead: "MIN LESEZEIT", previous: "ZURÜCK", next: "WEITER",
    news: "NEWS", records: "RECORDS", agency: "AGENTUR", artists: "ARTISTS",
    events: "EVENTS", mixes: "MIXES", about: "ÜBER UNS", contact: "KONTAKT", home: "START",
    theRoster: "Das Roster", theAgency: "Die Agentur", theRecords: "Die Releases",
    theEvents: "Die Events", sessionsRadio: "Sessions & Radio", dailyNews: "Daily News",
    breakingNews: "Breaking News",
    rosterSub: "KÜNSTLER VERTRETEN VON HIDDEN STATE",
    agencySub: "BOOKING & VERTRETUNG",
    recordsSub: "ERSCHIENEN AUF HIDDEN STATE RECORDS",
    eventsSub: "NÄCHTE, FESTIVALS & EXPERIENCES",
    mixesSub: "AUFGENOMMENE SETS DES ROSTERS",
    readFullStory: "ARTIKEL LESEN", readFullProfile: "PROFIL ANSEHEN",
    fullDetails: "DETAILS", listenToSets: "SETS HÖREN",
    book: "BUCHEN", getTickets: "TICKETS", playAlbum: "ALBUM HÖREN",
    tracklist: "TRACKLIST", lineUp: "LINE-UP", upcoming: "KOMMEND", pastEvent: "VERGANGENES EVENT",
    pastEvents: "VERGANGENE EVENTS", fromTheNight: "AUS DER NACHT", downloadAll: "ALLE LADEN",
    save: "SPEICHERN", close: "SCHLIESSEN", printedIssue: "DIE GEDRUCKTE AUSGABE", printedIssues: "DIE GEDRUCKTEN AUSGABEN",
    moreToCome: "Mehr folgt.", nothingFiled: "NOCH NICHTS",
    ticketsSoon: "TICKETS DEMNÄCHST", allIssues: "ALLE AUSGABEN", allEvents: "ALLE EVENTS",
    allSessions: "ALLE SESSIONS", theStory: "DIE GESCHICHTE", whatWeOffer: "WAS WIR BIETEN",
    theDivisions: "DIE BEREICHE", direct: "DIREKT", social: "SOCIAL",
    saveHint: "Halte ein Foto gedrückt, um es zu speichern, oder nutze den Download-Button. Du kannst auch alle auf einmal laden.",
  },
  fr: {
    write: "ÉCRIRE", settings: "RÉGLAGES",
    scanner: "SCANNER", doorList: "PORTE",
    myPass: "MON PASS", team: "ÉQUIPE", site: "SITE", signIn: "CONNEXION", signOut: "DÉCONNEXION",
    days: "JOURS", hours: "HEURES", minutes: "MINUTES", seconds: "SECONDES", theNightIsHere: "La nuit est arrivée.", countdownTo: "COMPTE À REBOURS",
    listen: "ÉCOUTER",
    share: "PARTAGER", linkCopied: "LIEN COPIÉ", backToTop: "HAUT DE PAGE", minRead: "MIN DE LECTURE", previous: "PRÉCÉDENT", next: "SUIVANT",
    news: "ACTUS", records: "DISQUES", agency: "AGENCE", artists: "ARTISTES",
    events: "ÉVÉNEMENTS", mixes: "MIXES", about: "À PROPOS", contact: "CONTACT", home: "ACCUEIL",
    theRoster: "Les Artistes", theAgency: "L'Agence", theRecords: "Les Disques",
    theEvents: "Les Événements", sessionsRadio: "Sessions & Radio", dailyNews: "Daily News",
    breakingNews: "Breaking News",
    rosterSub: "ARTISTES REPRÉSENTÉS PAR HIDDEN STATE",
    agencySub: "BOOKING & REPRÉSENTATION",
    recordsSub: "PARU SUR HIDDEN STATE RECORDS",
    eventsSub: "SOIRÉES, FESTIVALS & EXPÉRIENCES",
    mixesSub: "SETS ENREGISTRÉS DES ARTISTES",
    readFullStory: "LIRE L'ARTICLE", readFullProfile: "VOIR LE PROFIL",
    fullDetails: "DÉTAILS", listenToSets: "ÉCOUTER LES SETS",
    book: "RÉSERVER", getTickets: "BILLETS", playAlbum: "ÉCOUTER L'ALBUM",
    tracklist: "TRACKLIST", lineUp: "LINE-UP", upcoming: "À VENIR", pastEvent: "ÉVÉNEMENT PASSÉ",
    pastEvents: "ÉVÉNEMENTS PASSÉS", fromTheNight: "DE LA SOIRÉE", downloadAll: "TOUT TÉLÉCHARGER",
    save: "ENREGISTRER", close: "FERMER", printedIssue: "L'ÉDITION IMPRIMÉE", printedIssues: "LES ÉDITIONS IMPRIMÉES",
    moreToCome: "À suivre.", nothingFiled: "RIEN POUR L'INSTANT",
    ticketsSoon: "BILLETS BIENTÔT", allIssues: "TOUTES LES ÉDITIONS", allEvents: "TOUS LES ÉVÉNEMENTS",
    allSessions: "TOUTES LES SESSIONS", theStory: "L'HISTOIRE", whatWeOffer: "CE QUE NOUS PROPOSONS",
    theDivisions: "LES DIVISIONS", direct: "DIRECT", social: "SOCIAL",
    saveHint: "Appuie longuement sur une photo pour l'enregistrer, ou utilise le bouton de téléchargement. Tu peux aussi tout prendre d'un coup.",
  },
};

const LangContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

// Pick a starting language from the browser, but only if we actually have it.
function detect() {
  try {
    const saved = localStorage.getItem("hs-lang");
    if (saved && STRINGS[saved]) return saved;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (STRINGS[nav]) return nav;
  } catch {
    /* private browsing can block localStorage — English is a fine fallback */
  }
  return "en";
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detect);

  const setLang = (code) => {
    setLangState(code);
    try { localStorage.setItem("hs-lang", code); } catch { /* not fatal */ }
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Missing keys fall back to English rather than showing the raw key.
  const t = (key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
