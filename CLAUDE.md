# LIFE PANEL v5 — règles du projet

Appli personnelle (tâches, agenda, finance, notes, documents, contacts), en français, sans bibliothèque ni outil d'assemblage.
Servie par GitHub Pages. Les données vivent dans le dépôt privé `delife-fr/life-panel-donnees` (`donnees.json`).

## Branches

- `main` : la **v4.9**, en service. Un seul `index.html`. On n'y touche pas pendant la refonte (sauf correctif demandé).
- `beta` : la **v5**, la refonte. Un dossier par rubrique. Bascule sur `main` au lot 8.
- Référence v4.9 pour reprendre du code : `git show origin/main:index.html` (sections A à Q : données, utilitaires, calculs,
  pages, routeur, fenêtres, actions, focus, palette, recherche, fichiers, Drive, synchro GitHub, notifications).
- Le suivi de la refonte (décisions, lots, retours) est dans le document Claude Docs « Refonte LIFE PANEL » :
  https://claude.ai/artifact/6RU7D8ZMBrSZAmAgBwtZyG — on le relit avant de commencer un lot.

## Lancer en local

Les modules JavaScript ne se chargent pas depuis un fichier ouvert par double-clic : il faut un petit serveur.

```bash
python3 -m http.server 8765
```

puis http://127.0.0.1:8765/

## Architecture

```
index.html            la coquille : conteneurs vides, règle de sécurité (CSP), feuilles de style du noyau, app.js
app.js                le démarrage : actions et clavier, rubriques, coquille, lecture des données, premier affichage
noyau/
  outils.js           texte, dates à l'heure locale, montants (repris de la v4.9)
  donnees.js          FORMES, normaliser, DB, modifie(), remplacer(), ajouter(), corbeille, entretien
  stockage.js         IndexedDB + copie localStorage, délais maximum, copie de secours, autres onglets
  adresses.js         #/nom/arg?params, anciennes adresses traduites (ALIAS)
  modules.js          le registre des rubriques (format d'un module décrit en tête du fichier)
  interface.js        coquille, rendre(), feuille, confirmer(), toast(), thème, clics [data-action], clavier
  preferences.js      réglages de CET appareil (thème…), jamais synchronisés
  icones.js           ico('agenda', 18)
  theme-avant.js      pose le thème avant le premier affichage (script bloquant, seul script classique)
  styles/             jetons.css (couleurs, thèmes, polices), base.css, coquille.css
  polices/            Inter, Barlow Condensed (licence SIL OFL)
modules/
  liste.js            les rubriques actives
  <rubrique>/         module.js (+ <rubrique>.css si styles:true)
sw.js, manifest.webmanifest   ceux de la v4.9, pas encore branchés : refaits au lot 1
```

Les modules ne s'importent **jamais** entre eux : ils passent par le noyau. Une page est une fonction qui renvoie du HTML
(texte) ; `apres` branche ce qui doit l'être ; les clics passent par `data-action` et le registre.

## Règles

- **Données : rien n'est perdu.** `FORMES` garde les champs inconnus (`{...x, champs vérifiés}`), `normaliser` garde les
  clés inconnues et reste idempotent. Toute nouvelle donnée passe par `FORMES` (lecture comme création).
  Vérifié : la v5 lit le vrai `donnees.json` exactement comme la v4.9.
- **VERSION** des données : 23 pendant la bêta, 24 à la bascule (la v4.9 refuse alors de synchroniser un fichier plus récent).
- **Bêta isolée** : `noyau/stockage.js` (`NOMS`) range les données sous d'autres noms que la v4.9 ; rien n'est envoyé à
  GitHub avant le lot 1. À la bascule, `NOMS` reprend les noms de la v4.9 (base `lifepanel`, magasin `poignees`, copie `lifepanel`).
- **Jamais d'écriture avant la lecture** : tant que `etat.donnees !== 'pretes'`, `ecrire()` ne fait rien.
- **Sécurité** : aucun script en ligne ni `onclick=` (la CSP n'autorise que les fichiers du site) ; toute donnée affichée
  passe par `esc()` ; un lien venu des données passe par `normaliserLien()`.
- **Couleurs** : seulement les jetons de `noyau/styles/jetons.css`, jamais une couleur en dur dans un module.
- **Langue** : noms, commentaires et textes en français. Les commentaires disent pourquoi, pas ce que fait la ligne.
- **Calme** : peu de texte à l'écran, pas de chiffres techniques, ce qu'il y a à faire aujourd'hui d'abord.

## Compatibilité à garder

- Adresses de la v4.9 et du prototype : `noyau/adresses.js` (ALIAS). Le robot des rappels ouvre `#/aujourdhui`, `#/taches`,
  `#/donnees`, `#/evenement/ID` ; elles doivent continuer de mener à la bonne page.
- Raccourcis Android du manifeste : `?action=inbox` et `?action=depense` (à traiter au lot 1 ou 2).
- Le robot (`life-panel-donnees/notifications/rappels.js`) lit `donnees.json` : toute nouvelle forme d'événement ou de tâche
  qui doit déclencher un rappel doit y être ajoutée aussi.
