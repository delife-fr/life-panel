/* LIFE PANEL v5 · modules/reglages/exemples.js — des données fictives pour visiter la bêta (Réglages › Données).
   Tout est inventé ; les dates sont prises autour d'aujourd'hui pour que chaque page ait quelque chose à montrer. */
import {decaleJour, aujourdhui} from '../../noyau/outils.js';

export function exemples(){
  const d = n => decaleJour(n), t = n => d(n) + 'T10:00:00.000Z', id = (p, i) => 'ex-' + p + i;
  /* Perso, Logement, Aviation… ne sont que des chemins (ceux de l'arbre de départ) : les dossiers sont au bout */
  const projets = [
    {id:'ex-travaux', nom:'Travaux cuisine', chemin:['Perso', 'Logement'], couleur:'orange', resume:'Devis, artisans, achats.'},
    {id:'ex-factures', nom:'Factures maison', chemin:['Perso', 'Logement'], couleur:'jaune', resume:'Énergie, eau, assurance.'},
    {id:'ex-sante', nom:'Remboursements 2026', chemin:['Perso', 'Santé'], couleur:'rose', resume:'Feuilles de soins et mutuelle.'},
    {id:'ex-atpl', nom:'Formation ATPL', chemin:['Aviation', 'Formations'], couleur:'violet', resume:'Théorie et examens.'},
    {id:'ex-licence', nom:'Licence et certificat médical', chemin:['Aviation', 'Licences'], couleur:'bleu', resume:'Renouvellements.'},
    {id:'ex-voyage', nom:'Voyage au Portugal', chemin:['Perso', 'Voyages'], couleur:'vert', resume:'Vacances de printemps.'},
    {id:'ex-demenagement', nom:'Déménagement 2025', chemin:['Perso'], couleur:'bleu', archive:true, resume:'Fini : dossier fermé.'}
  ].map(p => ({...p, modif:t(-3)}));
  const listes = [{id:'ex-courses', nom:'Courses', modif:t(-1)}];
  const taches = [
    ['Appeler le plombier', d(0), '10:00', 'ex-travaux', ['travaux']], ['Payer la taxe foncière', d(-2), '', 'ex-factures', ['admin']],
    ['Réviser la météo (QCM)', d(1), '18:00', 'ex-atpl', ['examen']], ['Renouveler le certificat médical', d(6), '', 'ex-licence', []],
    ['Réserver l’hôtel à Porto', d(3), '', 'ex-voyage', []], ['Trier les papiers', '', '', 'ex-factures', ['admin']],
    ['Acheter des ampoules', '', '', null, []], ['Envoyer la feuille de soins', d(-5), '', 'ex-sante', ['admin']]
  ].map(([nom, date, heure, projet, tags], i) => ({id:id('t', i), nom, date, heure, projet, tags, fait:i === 7, faitLe:i === 7 ? t(-1) : '', modif:t(-1),
    etapes:i === 4 ? [{t:'Comparer 3 hôtels', ok:true}, {t:'Payer l’acompte', ok:false}] : []}));
  ['Lait', 'Pain', 'Œufs', 'Café'].forEach((nom, i) => taches.push({id:id('c', i), nom, liste:'ex-courses', fait:i === 3, faitLe:i === 3 ? t(0) : '', modif:t(0)}));
  const evenements = [
    ['Dentiste', d(2), '14:30', '15:00', 'Cabinet Dr Martin, 12 rue des Lilas', 'ex-sante', null], ['Cours théorique ATPL', d(1), '09:00', '12:00', 'Aéroclub', 'ex-atpl', {freq:'semaine'}],
    ['Dîner chez Claire', d(5), '20:00', '', 'Lyon', null, null], ['Examen blanc', d(9), '08:30', '11:30', '', 'ex-atpl', null],
    ['Vol pour Porto', d(24), '07:15', '', 'Aéroport', 'ex-voyage', null], ['Loyer', d(-20), '', '', '', 'ex-factures', {freq:'mois'}]
  ].map(([titre, date, heure, fin, lieu, projet, recurrence], i) => ({id:id('e', i), titre, date, heure, fin, lieu, projet, recurrence:recurrence || {freq:''}, cree:t(-10), modif:t(-10)}));
  const contacts = [
    ['Claire Dubois', '06 12 34 56 78', 'claire.dubois@exemple.fr', d(5).replace(/^\d{4}/, '1990'), ''], ['Paul Martin', '06 98 76 54 32', '', d(40).replace(/^\d{4}/, '1985'), d(-120)],
    ['Sophie Laurent', '07 11 22 33 44', 'sophie@exemple.fr', '', d(-3)], ['Marc Petit (plombier)', '06 55 44 33 22', '', '', ''],
    ['Julie Moreau', '06 77 88 99 00', 'julie.moreau@exemple.fr', d(150).replace(/^\d{4}/, '1993'), d(-40)], ['Instructeur Thomas', '06 10 20 30 40', '', '', d(-6)]
  ].map(([nom, telephone, email, anniversaire, derniereConversation], i) => ({id:id('p', i), nom, telephone, email, anniversaire, derniereConversation,
    projet:i === 3 ? 'ex-travaux' : i === 5 ? 'ex-atpl' : null, modif:t(-2)}));
  const journal = [
    [d(-1), 'Déjeuner avec @Claire Dubois, elle part au Canada en mars.', ['ex-p0'], ['famille'], null], [d(-3), 'Appel de @Sophie Laurent pour le voyage : elle nous rejoint à Porto.', ['ex-p2'], [], 'ex-voyage'],
    [d(-6), 'Vol de navigation avec @Instructeur Thomas, très bon atterrissage.', ['ex-p5'], ['vol'], 'ex-licence'], [d(-12), 'Anniversaire de mariage : restaurant au bord du lac.', [], ['famille'], null],
    [d(-20), '@Paul Martin a changé de travail.', ['ex-p1'], [], null]
  ].map(([date, texte, cs, tags, projet], i) => ({id:id('j', i), date, texte, contacts:cs, tags, projet, cree:t(-i), modif:t(-i)}));
  const notes = [
    ['Codes et accès', 'Portail : 4521\nWi-Fi invité : soleil2026', ['maison'], null], ['Idées de voyage', '- Porto et la vallée du Douro\n- Lisbonne en tram\n- Sintra', ['vacances'], 'ex-voyage'],
    ['Check-list avant vol', '1. Météo\n2. NOTAM\n3. Carburant\n4. Masse et centrage', ['vol'], 'ex-licence'], ['Recette de la tarte aux pommes', 'Pâte brisée, 5 pommes, 50 g de sucre, 40 min à 180 °C.', ['cuisine'], null]
  ].map(([titre, contenu, tags, projet], i) => ({id:id('n', i), titre, contenu, tags, projet, cree:t(-i * 4), modif:t(-i * 4)}));
  const documents = [
    ['Passeport', 'drive:PERSO/Identité/Passeport.pdf', d(20), 60, 'ex-factures'], ['Assurance habitation', 'https://www.exemple.fr/assurance', d(95), 30, 'ex-factures'],
    ['Certificat médical classe 1', 'drive:PRO/Aviation/Certificat medical.pdf', d(6), 30, 'ex-licence'], ['Billets d’avion Porto', '', '', 30, 'ex-voyage']
  ].map(([titre, url, echeance, preavis, projet], i) => ({id:id('d', i), titre, url, echeance, preavis, projet, ajoute:t(-30), modif:t(-30)}));
  const comptes = [{nom:'Compte courant', stats:true}, {nom:'Cash', stats:true}, {nom:'Épargne', stats:false}];
  const depenses = [['Courses Carrefour', 'Courses alimentaires', 62.4], ['Essence', 'Transports et véhicule', 55], ['Restaurant', 'Restaurants et sorties', 38.5], ['Pharmacie', 'Santé', 12.9],
    ['Netflix', 'Abonnements et télécoms', 13.49], ['Boulangerie', 'Courses alimentaires', 6.2], ['Cinéma', 'Loisirs et culture', 22], ['Électricité', 'Énergie et eau', 74.3],
    ['Coiffeur', 'Hygiène et beauté', 25], ['Livres ATPL', 'Frais professionnels', 89]];
  const mouvements = [];
  for(let i = 0; i < 48; i++){ const [libelle, categorie, montant] = depenses[i % depenses.length];
    mouvements.push({id:id('m', i), type:'depense', libelle, categorie, montant:Math.round(montant * (0.8 + (i % 5) * 0.1) * 100) / 100, date:d(-Math.floor(i * 1.9)),
      compte:i % 7 === 3 ? 'Cash' : 'Compte courant', projet:libelle === 'Livres ATPL' ? 'ex-atpl' : libelle === 'Électricité' ? 'ex-factures' : null, cree:t(-i), modif:t(-i)}); }
  mouvements.push({id:'ex-m-v', type:'depense', libelle:'Virement vers l’épargne', categorie:'Divers', montant:300, date:d(-8), compte:'Compte courant', cree:t(-8)});
  [0, 30, 60].forEach((n, i) => mouvements.push({id:id('r', i), type:'revenu', libelle:'Salaire', montant:2450, date:d(-n - 2), compte:'Compte courant', cree:t(-n)}));
  const inbox = [['Offrir un livre à Claire', -1], ['Regarder les horaires du musée à Porto', -2], ['essence 45 samedi dernier', 0]]
    .map(([text, n], i) => ({id:id('i', i), text, created:t(n), status:'open', modif:t(n)}));
  return {version:23, prenom:'', projets, listes, taches, evenements, contacts, journal, notes, documents, mouvements, comptes, inbox,
    tags:['admin', 'famille'], reglages:{demo:true, maj:null, sansCompteStats:true}, exemple:aujourdhui()};
}
