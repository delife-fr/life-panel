/* LIFE PANEL v5 · noyau/outils.js
   Petits outils communs : texte, dates à l'heure locale, montants. Repris de la v4.9 (section B), sans changement de sens. */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* --- Texte --- */
export const txt = v => (v === null || v === undefined) ? '' : String(v);
export const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
/* Sans accents ni majuscules : pour comparer et chercher */
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const unique = arr => [...new Set(arr)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const majuscule = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
export const pluriel = (n, mot, pl) => n + ' ' + (n > 1 ? (pl || mot + 's') : mot);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
/* « Revolut », « revolut » et « Revolut  » sont le même nom */
export const propreNom = s => txt(s).trim().replace(/\s+/g, ' ');
export const cleNom = s => { const p = propreNom(s); return p ? norm(p) || p.toLowerCase() : ''; };   /* un nom fait d'un seul accent garde une clé */
export const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* --- Dates : « AAAA-MM-JJ » à l'heure locale --- */
export const pad = n => String(n).padStart(2, '0');
export const maintenant = () => new Date().toISOString();
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const aujourdhui = () => iso(new Date());
export const decaleJour = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d); };
export const moisCourant = () => aujourdhui().slice(0, 7);
/* « 2026-09-22 » est lu comme une date locale (JavaScript le lirait en UTC) */
export function versDate(s){
  if(!s) return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){ const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); }
  const d = new Date(s); return isNaN(d) ? null : d;
}
export const jourDe = s => { const d = versDate(s); return d ? iso(d) : ''; };
/* Date qui existe vraiment : « 31/02/2026 » ou « 2026-13-01 » sont refusées ('') */
const dateReelle = (a, m, j) => { const d = new Date(Date.UTC(a, m - 1, j)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j; };
export const dateISO = v => { const s = txt(v).trim(), m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const r = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  return r && dateReelle(Number(r.slice(0, 4)), Number(r.slice(5, 7)), Number(r.slice(8, 10))) ? r : ''; };
export const heureValide = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(txt(v)) ? txt(v) : '';

/* Formateurs créés une fois puis réutilisés */
export const FORMATS = {
  court:new Intl.DateTimeFormat('fr-FR', {day:'numeric', month:'short'}),
  long:new Intl.DateTimeFormat('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}),
  jourMois:new Intl.DateTimeFormat('fr-FR', {weekday:'long', day:'numeric', month:'long'}),
  heure:new Intl.DateTimeFormat('fr-FR', {hour:'2-digit', minute:'2-digit'}),
  mois:new Intl.DateTimeFormat('fr-FR', {month:'long', year:'numeric'}),
  euros:new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:0, maximumFractionDigits:0}),
  centimes:new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2}),
  nombre:new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1})
};
export const dateCourte = s => { const d = versDate(s); return d ? FORMATS.court.format(d) : '—'; };
export const dateLongue = s => { const d = versDate(s); return d ? majuscule(FORMATS.long.format(d)) : '—'; };
export const jourEtMois = s => { const d = versDate(s); return d ? majuscule(FORMATS.jourMois.format(d)) : '—'; };
export const nomMois = m => { const [a, mm] = m.split('-').map(Number); return majuscule(FORMATS.mois.format(new Date(a, mm - 1, 1))); };
/* écart en jours : > 0 dans le passé */
export function ecartJours(s){
  const d = versDate(s); if(!d) return null;
  const a = new Date(); a.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((a - d) / 86400000);
}

/* --- Montants --- */
export const arrondi2 = n => Math.round((Number(n) || 0) * 100) / 100;
export function eur(n){ const x = arrondi2(n); return (Number.isInteger(x) ? FORMATS.euros : FORMATS.centimes).format(x); }

/* --- Taille d'un texte (Ko, Mo) --- */
export const tailleLisible = n => !n ? '—' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : FORMATS.nombre.format(n / 1048576) + ' Mo';
