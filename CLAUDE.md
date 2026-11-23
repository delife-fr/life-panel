# LIFE PANEL v5 — règles du projet

Appli personnelle (tâches, calendrier, finance, notes, documents, contacts), en français, sans bibliothèque ni outil
d'assemblage. Servie par GitHub Pages. Les données vivent dans le dépôt privé `delife-fr/life-panel-donnees` (`donnees.json`).

## Branches

- `main` : la **v4.9**, en service. Un seul `index.html`. On n'y touche pas pendant la refonte (sauf correctif demandé).
- `beta` : la **v5**, la refonte. Un dossier par section. Bascule sur `main` au lot 8.
- Référence v4.9 pour reprendre du code : `git show origin/main:index.html` (sections A à Q : données, utilitaires, calculs,
  pages, routeur, fenêtres, actions, focus, palette, recherche, fichiers, Drive, synchro GitHub, notifications).
- Le suivi de la refonte (décisions, lots, retours) est dans le document Claude Docs « Refonte LIFE PANEL » :
  https://claude.ai/artifact/6RU7D8ZMBrSZAmAgBwtZyG — on le relit (commentaires compris) avant de commencer un lot.

## Lancer en local

Les modules JavaScript ne se chargent pas depuis un fichier ouvert par double-clic : il faut un petit serveur.

```bash
python3 -m http.server 8765
```

puis http://127.0.0.1:8765/

## Les sections (décidées au tour 1)

| Section | Dossier | Couleur | Téléphone | Sous-menu |
| --- | --- | --- | --- | --- |
| Aujourd'hui | `aujourdhui` | bleu | onglet | — |
| Idées (l'Inbox de la v4.9, avec À trier) | `idees` | jaune | Plus (+ icône en haut) | À ranger · Archivées |
| Calendrier | `calendrier` | violet | onglet | Semaine · Mois · Liste |
| Tâches | `taches` | vert | onglet | Par date · Listes |
| Dossiers (les « projets » des données) | `dossiers` | orange | Plus | Tous les dossiers · Sans dossier |
| Finance | `finance` | herbe | onglet | Mois · Année · Mouvements · Comptes · Catégories |
| Carnet | `carnet` | rose | Plus | Notes · Journal · Documents |
| Contacts | `contacts` | prune | Plus | — (filtres de la v4.8 en boutons au-dessus du tableau) |
| Réglages (icône en haut à droite) | `reglages` | gris | Plus (+ icône en haut) | Données · Archives · Corbeille |

- **PC (à partir de 1 100 px)** : les sections en haut, le sous-menu de la section ouverte juste en dessous ; la barre prend
  la couleur de la section. À droite : Chercher (Ctrl K), Noter, l'icône jour/nuit, Réglages.
- **Téléphone et tablette** : le titre de la section en haut, le sous-menu qui défile, 4 onglets en bas + « Plus », le bouton +.
- **Thème** : nuit par défaut ou jour, seulement par l'icône en haut à droite (pas de thème automatique, rien dans Réglages).

## Autres décisions du tour 1 (à appliquer dans les lots)

- Tout ce qui existe en v4.9 est gardé, sauf : priorités, Focus 25 min, tout budget (dossiers, comptes, catégories : les
  champs restent dans les données, jamais affichés), lien vers le Wiki (plus tard).
- **Dossier = super tag** : un élément est dans un seul dossier (champ `projet`, gardé tel quel pour la compatibilité).
  Tout élément peut y aller, idées et entrées du journal comprises. Couleur au choix.
- **Dossiers rangés dans d'autres dossiers** (domaine › dossier › sous-dossier, ex. Perso › Finances › Assurances) :
  champ `parent` (id du dossier qui le contient ; attention, le champ `dossier` des projets est le chemin Drive de la v3.13).
  Affichage par défaut : petites cartes comme en v4.9, toutes à plat, avec le chemin sur la carte ; l'arborescence est
  une option. Un sous-dossier reprend la couleur de son domaine sauf choix contraire. « À trier » = Sans dossier,
  « Archives » = dossiers archivés.
- **Tags sur tout élément**, idées comprises ; la fenêtre Tags de la v4.7 pour les gérer.
- **Capture rapide dans chaque section** : une ligne, Entrée, c'est créé, les détails après. Le bouton + garde la phrase
  devinée de la v4.9 (« essence 45 » → une dépense).
- **Journal** (Carnet) : une ou deux phrases datées ; « @ » ouvre la liste des contacts pendant la frappe, « # » les tags.
- **Attributs libres** sur tout élément : un nom et une valeur inventés, visibles dans la fiche, pas en colonne.
- **Des tableaux partout** (tâches, dépenses, documents, contacts) : un seul composant de tableau dans le noyau, avec sa
  recherche (même syntaxe que la grande barre : `#tag`…), ses colonnes triables et choisies (un attribut libre peut devenir
  une colonne), un affichage par paquets de 50 ; sur téléphone, une carte par ligne. Les notes restent une liste de lignes
  avec leurs tags.
- **Tâches au plus simple** : un tableau, une colonne Date (un tiret sans date), aucun regroupement par jour, ni statut,
  ni notation.
- **Fiches au centre** : une grande tuile au milieu de l'écran, le site en arrière-plan (comme la modale de la v4.9) ;
  pas de panneau à droite. Sur téléphone, plein écran depuis le bas.
- **Glisser-déposer partout où c'est naturel** (moteur du prototype, souris et doigt), toujours doublé d'un bouton.
- **Documents et Drive** : « Mon Drive » dans le sous-menu de Documents, même tableau, « Suivre l'échéance ».
- **Téléphone** : à décider par Claude, l'utilisateur pense d'abord au PC.
- **Recherche** : pour chercher, pas pour créer ; Entrée ouvre la page de résultats de la v4.9, tous types, #tag compris.
- **Finance** : celle de la v4.9, dont le graphique par catégorie et le clic qui retire une catégorie du calcul.
- **Contacts** : le tableau de la v4.8.
- Plus tard (modules à activer) : Objectifs, Rappels à part, Inventaire, routines, filtres enregistrés, factures, soldes,
  imports Todoist/Keep. Retirés : Revue, Santé, Médias, Semaines, engagements.

## Architecture

```
index.html            la coquille : conteneurs vides, règle de sécurité (CSP), feuilles de style du noyau, app.js
app.js                le démarrage : actions et clavier, sections, coquille, lecture des données, premier affichage
noyau/
  outils.js           texte, dates à l'heure locale, montants (repris de la v4.9)
  donnees.js          FORMES, normaliser, DB, modifie(), remplacer(), ajouter(), corbeille, entretien
  stockage.js         IndexedDB + copie localStorage, délais maximum, copie de secours, autres onglets
  adresses.js         #/nom/arg?params, anciennes adresses traduites (ALIAS)
  modules.js          le registre des sections (format d'un module décrit en tête du fichier)
  interface.js        coquille, rendre(), sous-menu, couleur de section, feuille, confirmer(), toast(), thème, clics, clavier
  preferences.js      réglages de CET appareil (thème…), jamais synchronisés
  icones.js           ico('agenda', 18)
  theme-avant.js      pose le thème avant le premier affichage (script bloquant, seul script classique)
  styles/             jetons.css (couleurs, thèmes, polices), base.css, coquille.css
  polices/            Inter, Barlow Condensed (licence SIL OFL)
modules/
  liste.js            les sections actives
  <section>/          module.js (+ <section>.css si styles:true)
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
- **Couleurs** : seulement les jetons de `noyau/styles/jetons.css`, jamais une couleur en dur dans un module ;
  `var(--section)` = la couleur de la section ouverte.
- **Langue** : noms, commentaires et textes en français. Les commentaires disent pourquoi, pas ce que fait la ligne.
- **Calme** : peu de texte à l'écran, pas de chiffres techniques, ce qu'il y a à faire aujourd'hui d'abord.

## Compatibilité à garder

- Adresses de la v4.9 et du prototype : `noyau/adresses.js` (ALIAS). Le robot des rappels ouvre `#/aujourdhui`, `#/taches`,
  `#/donnees`, `#/evenement/ID` ; elles doivent continuer de mener à la bonne page.
- Raccourcis Android du manifeste : `?action=inbox` et `?action=depense` (à traiter au lot 1 ou 2).
- Le robot (`life-panel-donnees/notifications/rappels.js`) lit `donnees.json` : toute nouvelle forme d'événement ou de tâche
  qui doit déclencher un rappel doit y être ajoutée aussi.
