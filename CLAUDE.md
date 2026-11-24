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

**La bêta en ligne** (décision du 23/11) : https://panel.alexishocini.fr/beta/ — une copie des fichiers de `beta` dans le
dossier `beta/` de la branche `main` (index.html, app.js, noyau/, modules/, icons/ ; rien d'autre de `main` n'est touché).
On la republie après chaque push sur `beta` (commit « Bêta v5 dans /beta (commit …) »). La v4.9 reste à la racine.
La synchro GitHub n'y lit et n'écrit que `donnees-v5.json` (copie de `donnees.json` créée à la première connexion) ;
elle reprend la clé GitHub de la v4.9 (même adresse, lue dans sa base « lifepanel », jamais écrite).

Aperçu sans synchro : **toujours l'adresse figée sur un commit**,
`https://raw.githack.com/delife-fr/life-panel/<commit complet>/index.html`, à donner après chaque push. L'adresse de branche
(`…/beta/index.html`) sert des fichiers de versions différentes (cache de raw.githack) : les imports échouent, la page reste
sur « Chargement… ».

## Les sections (décidées au tour 1)

| Section | Dossier | Couleur | Téléphone | Sous-menu |
| --- | --- | --- | --- | --- |
| Aujourd'hui | `aujourdhui` | bleu | onglet | — |
| Idées (l'Inbox de la v4.9, avec À trier) | `idees` | jaune | Plus (+ icône en haut) | — (on range ou on supprime, pas d'archives) |
| Calendrier | `calendrier` | violet | onglet | 2 semaines · Mois · Agenda |
| Tâches | `taches` | vert | onglet | — (toutes les tâches ; les listes en puces qui filtrent) |
| Dossiers (les « projets » des données) | `dossiers` | orange | Plus | Ouverts · Fermés ; dans un dossier : ‹ Dossiers · Tâches · Rendez-vous · Notes · Documents · Dépenses · Contacts · Journal |
| Finance | `finance` | herbe | onglet | Mois · Année · Mouvements · Comptes · Catégories |
| Carnet | `carnet` | rose | Plus | Notes · Journal · Documents |
| Contacts | `contacts` | prune | Plus | — (filtres de la v4.8 en boutons au-dessus du tableau) |
| Réglages (icône en haut à droite) | `reglages` | gris | Plus (+ icône en haut) | Données · Corbeille |

- **PC (à partir de 1 100 px)** : les sections en haut, le sous-menu de la section ouverte juste en dessous ; la barre prend
  la couleur de la section. À droite : Chercher (Ctrl K), Noter, Tags (T), Aide « ? », l'icône jour/nuit, Réglages
  (sous 1 600 px, Chercher et Noter en icônes).
- **Téléphone et tablette** : le titre de la section en haut, le sous-menu qui défile, 4 onglets en bas + « Plus », le bouton +.
- **Thème** : nuit par défaut ou jour, seulement par l'icône en haut à droite (pas de thème automatique, rien dans Réglages).

## Autres décisions du tour 1 (à appliquer dans les lots)

- Tout ce qui existe en v4.9 est gardé, sauf : priorités, Focus 25 min, tout budget (dossiers, comptes, catégories : les
  champs restent dans les données, jamais affichés), lien vers le Wiki (plus tard).
- **Dossier = super tag** : un élément est dans un seul dossier (champ `projet`, gardé tel quel pour la compatibilité).
  Tout élément peut y aller (entrées du journal comprises), sauf les idées. Couleur au choix.
- **Chemin des dossiers** (23/11, 2e retour) : Perso, Aviation, Maison, Santé… ne sont **pas des dossiers**, seulement un
  chemin (champ `chemin`, ex. ['Perso', 'Maison'] ; attention, le champ `dossier` des projets est le chemin Drive de la
  v3.13, et `parent` n'est plus utilisé). Les vrais dossiers sont au bout du chemin, l'utilisateur choisit leur chemin
  (fiche « Chemin » : une liste déroulante de l'arbre ; ou glisser le dossier sur un chemin de l'arbre). Page Dossiers :
  l'arbre des chemins à gauche (où créer, où ranger ; « Nouveau chemin… »), le tableau des dossiers de ce chemin. L'arbre de
  départ est la hiérarchie du document de la refonte, sans les dossiers du bout (CHEMINS_DEPART, calculs.js) ; dès qu'on
  ajoute un chemin il est recopié dans les données (`DB.chemins`). Dans un dossier, le sous-menu compte chaque type. Un dossier ouvert : le sous-menu passe aux types, chacun le même tableau que dans
  sa section. Un dossier dont on n'a plus besoin est **fermé** (drapeau `archive`) et reste visible dans « Fermés ».
- **Idées** = l'Inbox : ni tags, ni dossier, ni archives ; une idée ne va nulle part, elle devient une tâche, une note,
  une dépense… ou elle est supprimée.
- **Tags** : la fenêtre Tags s'ouvre en haut à droite (étiquette) ou par la touche T, pas dans Réglages. Supprimer un tag
  le retire des éléments, les éléments restent.
- **Toutes les colonnes partout** : `noyau/colonnes.js` donne les colonnes de chaque type, les mêmes dans la section et dans
  la page d'un dossier (étapes, lien, montant, attributs…). Le dossier d'un élément = **un petit carré de couleur et son
  nom**, partout (pas de pastille autour) ; dans une fiche, le dossier se choisit dans une liste déroulante avec ces carrés,
  les dossiers par ordre alphabétique, **sans leur chemin** (il prenait trop de place). Les compteurs du sous-menu d'un
  dossier sont dans une petite pastille ronde.
- **Cases à cocher carrées** (comme le prototype). **Aide « ? »** en haut à droite (modules/aide) : raccourcis et gestes,
  à tenir à jour quand un geste arrive. **Tags d'une fiche** : après une virgule, les tags existants sont proposés.
- **Calendrier** : « Afficher » (une colonne à droite sur PC, une rangée au-dessus sur téléphone) : Rendez-vous, Tâches,
  Dépenses, retenu sur cet appareil ; les dépenses (comptes pointés) sont cachées au départ, une ligne par jour avec le
  total, un clic montre le jour. Pas d'anniversaires ni d'échéances de documents (décision du tour 1).
- **Rendez-vous** : « Heure de » (là où je suis, Paris, Athènes : FUSEAUX dans calculs.js) et Personnes, comme la v4.9 ;
  partout l'heure d'ici (heureIci, texteHeures), l'heure du fuseau entre parenthèses.
- **Repris de la v4.9 (23/11)** : import d'un relevé bancaire CSV (Finance › Mouvements, modules/finance/releve.js),
  import vCard (Contacts, modules/contacts/vcard.js), finances en CSV et retour à la copie de secours (Réglages › Données),
  « Renouvelé » et « Créer une tâche » dans la fiche d'un document, « Répéter » dans celle d'une dépense
  (`boutons` d'un type dans TYPES_ELEMENT). Choisir un fichier, en télécharger un : noyau/fichiers.js.
- **Synchro GitHub** (lot 1, noyau/synchro.js) : celle de la v4.9 (lecture à l'ouverture, au retour, toutes les 30 s ;
  écriture 2,5 s après une modification ; fusion à trois ; une fiche ouverte retarde ce qui vient d'ailleurs). Une icône
  nuage dans la barre du haut quand elle est active (clic = synchroniser). Jamais sur raw.githack (adresse partagée),
  jamais pendant les exemples (`reglages.demo`), jamais un envoi de données vides. Réglages › Données : se connecter
  (avec la clé de la v4.9 en un clic), changer la clé, arrêter.
  Pendant la bêta, rappels et notifications viennent toujours de la v4.9 (le robot lit donnees.json) ; ceux de la v5,
  le service worker (hors ligne, installation) et les raccourcis Android `?action=` se font à la bascule.
- **Corbeille** gardée (Réglages › Corbeille, 30 jours, « Vider la corbeille » en haut) ; seules les archives sont parties.
- **Aujourd'hui** : une tuile Finance (dépensé ce mois-ci, comptes pointés, anneau par catégorie), comme la v4.9.
- **Couleurs** des catégories et des dossiers : 14 teintes (les 9 de la v4.9 + cyan, brun, olive, indigo, gris) et 13
  rayées (TEINTES, COULEURS_CAT dans donnees.js).
- **Finance** : le tableau des mouvements, « Par catégorie » et « Mois par mois » se plient (flèche) ; Comptes : colonne
  « Pointé : oui / non » (la case de la v4.9 qui laisse un compte, ex. l'épargne, hors des totaux) ; la couleur d'une
  catégorie se choisit sur des pastilles. Les calculs et l'anneau sont dans noyau/finance.js (Finance et Aujourd'hui).
- **Plus tard, dans une autre session** (ne rien faire avant) : un sous-menu « Google Drive » dans Documents ; ce jour-là,
  déplacer tous les documents à la racine du Drive, l'utilisateur les renomme et les range ensuite selon ses chemins.
- **Plus d'archives** (23/11) : pas de page Archives. Une tâche faite reste visible, barrée, en bas du tableau ; notes,
  documents et contacts archivés en v4.9 sont affichés comme les autres (le drapeau reste dans les données).
- **Contacts** (23/11) : plus d'« À lui dire », « À répondre », « Idées de cadeaux », « Nouvelles », « Dernier échange »,
  « À relancer » ni « Je lui ai parlé aujourd'hui » à l'écran (gardés dans les données) ; la fiche montre les lignes du
  journal qui citent le contact (@Nom).
- **La puce d'un dossier** est un lien vers le dossier, partout.
- **Exemples** : Réglages › Données › « Charger des exemples » (modules/reglages/exemples.js) remplace les données de la
  bêta par des données fictives ; à enrichir quand une fonction arrive.
- **Tags sur tout élément** sauf les idées ; la fenêtre Tags de la v4.7 pour les gérer (en haut à droite).
- **Capture rapide dans chaque section** : une ligne, Entrée, c'est créé, les détails après. Le bouton + garde la phrase
  devinée de la v4.9 (« essence 45 » → une dépense).
- **Journal** (Carnet) : une ou deux phrases datées ; « @ » ouvre la liste des contacts pendant la frappe, « # » les tags,
  partout où l'on écrit une entrée (Carnet, page d'un dossier, fiche : noyau/mentions.js, `champAjout(…, {mentions:true})`).
  Pas de champ « Personnes » dans la fiche (24/11) : les personnes d'une entrée sont celles citées avec « @ » dans le texte.
- **Attributs libres** sur tout élément : un nom et une valeur inventés, dans la fiche ; un attribut utilisé apparaît aussi
  comme colonne du tableau.
- **Des tableaux partout** (tâches, dépenses, notes, journal, documents, contacts, dossiers, agenda, tags, corbeille,
  recherche) : un seul composant de tableau dans le noyau, avec sa recherche (même syntaxe que la grande barre : `#tag`…),
  ses colonnes triables, un affichage par paquets de 50 ; sur téléphone, une carte par ligne (tant pis si c'est chargé).
  **Pas de bouton « Colonnes »** (décision du 23/11) : une colonne s'affiche si au moins une ligne a quelque chose à y
  montrer (`garder:true` pour l'afficher quand même, ex. la Date des tâches).
- **Ne rien ajouter qui n'a pas été demandé** (23/11) : pas de raccourcis « Aujourd'hui, Demain, Samedi », pas de bande
  de dépôt, pas de texte d'aide en plus. La date d'une tâche se donne dans sa fiche ou en la glissant sur le Calendrier.
- **Tâches au plus simple** : un tableau, une colonne Date (un tiret sans date), aucun regroupement par jour, ni statut,
  ni notation, **sans sous-menu** : toutes les tâches, celles des listes comprises (colonne Liste triable) ; une tâche
  faite reste barrée en bas. Les listes en puces au-dessus : un clic filtre (`#/taches?liste=ID`, l'adresse de la v4.9),
  « Nouvelle liste… » en une ligne ; chaque puce reçoit les tâches glissées. Étapes dans la fiche (« 1/3 » dans le tableau).
- **Sélection sur PC** (composant tableau, `selection`) : Ctrl + clic, Maj + clic, Échap ; une barre flottante en bas
  propose les actions ; glisser une ligne choisie emporte toute la sélection.
- **Fiches au centre** : une grande tuile au milieu de l'écran, le site en arrière-plan (comme la modale de la v4.9) ;
  pas de panneau à droite. Sur téléphone, plein écran depuis le bas.
- **Glisser-déposer partout où c'est naturel** (moteur du prototype, souris et doigt), toujours doublé d'un bouton.
- **Documents et Drive** : « Mon Drive » dans le sous-menu de Documents, même tableau, « Suivre l'échéance » (à faire :
  il faut la connexion à Drive). En attendant, un lien `drive:PERSO/…` ouvre la recherche de Google Drive sur ce nom.
- **Journal** : nouvelle liste `journal` dans les données ({date, texte, contacts, tags, projet}) ; la seule différence avec
  la lecture de la v4.9 (vérifié par compare.js).
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
  donnees.js          FORMES, normaliser, DB, modifie(), remplacer(), ajouter(), retirer() (corbeille), entretien
  calculs.js          calculs partagés : tâches du jour, dates d'un événement, anniversaires, documents, catégories, dossiers
  stockage.js         IndexedDB + copie localStorage, délais maximum, copie de secours, autres onglets
  adresses.js         #/nom/arg?params, anciennes adresses traduites (ALIAS)
  modules.js          le registre des sections (format d'un module décrit en tête du fichier)
  interface.js        coquille, rendre(), sous-menu, couleur de section, fiche au centre (ouvrirFiche), confirmer(), toast(),
                      champAjout() (ligne « ajouter vite »), thème, clics, clavier
  tableau.js          le tableau commun (recherche, tri, colonnes vides cachées, attributs en colonnes, paquets de 50,
                      sélection Ctrl + clic, cartes sur téléphone)
  affichage.js        dossier (carré de couleur + nom), tags, lien de document (Drive compris), téléphone, e-mail
  finance.js          comptes pointés, dépenses d'une période, l'anneau par catégorie (Finance et Aujourd'hui)
  fichiers.js         choisir un fichier sur l'appareil (texte décodé), en télécharger un, cellule CSV
  synchro.js          la synchro GitHub de la v4.9 (donnees-v5.json pendant la bêta), l'icône nuage
  colonnes.js         les colonnes de chaque type d'élément et le texte où chercher, communs à tous les tableaux
  glisser.js          le glisser-déposer (souris et doigt) : glisserType(type, {depot}), [data-glisser], [data-depot]
  fiches.js           la fiche de chaque type d'élément (TYPES_ELEMENT), avec dossier, tags et attributs libres
  capture.js          « Noter » en une phrase (bouton +, touche C), et le rangement d'une idée
  mentions.js         « @ » (contacts) et « # » (tags) proposés pendant la frappe d'une entrée du journal
  preferences.js      réglages de CET appareil (thème…), jamais synchronisés
  icones.js           ico('agenda', 18)
  theme-avant.js      pose le thème avant le premier affichage (script bloquant, seul script classique)
  styles/             jetons.css (couleurs, thèmes, polices), base.css, coquille.css, composants.css (pièces communes)
  polices/            Inter, Barlow Condensed (licence SIL OFL)
modules/
  liste.js            les sections actives
  <section>/          module.js (+ <section>.css si styles:true) ; recherche/ (Ctrl K, résultats), tags/ (la fenêtre Tags) et
                      aide/ (« ? ») ne sont pas des sections ; reglages/exemples.js = les données fictives,
                      finance/releve.js = l'import d'un relevé, contacts/vcard.js = l'import vCard
sw.js, manifest.webmanifest   ceux de la v4.9, pas encore branchés : refaits au lot 1
```

Les modules ne s'importent **jamais** entre eux : ils passent par le noyau. Une page est une fonction qui renvoie du HTML
(texte) ; `apres` branche ce qui doit l'être ; les clics passent par `data-action` et le registre.

## Règles

- **Économiser** (demande de l'utilisateur) : reprendre le code de la v4.9 (`git show origin/main:index.html`) et du
  prototype plutôt que réécrire ; tests et captures d'écran seulement là où ça change.

- **Données : rien n'est perdu.** `FORMES` garde les champs inconnus (`{...x, champs vérifiés}`), `normaliser` garde les
  clés inconnues et reste idempotent. Toute nouvelle donnée passe par `FORMES` (lecture comme création).
  Vérifié : la v5 lit le vrai `donnees.json` exactement comme la v4.9.
- **VERSION** des données : 23 pendant la bêta, 24 à la bascule (la v4.9 refuse alors de synchroniser un fichier plus récent).
- **Bêta isolée** : `noyau/stockage.js` (`NOMS`) range les données sous d'autres noms que la v4.9 ; rien n'est envoyé à
  GitHub sans la synchro (Réglages), et pendant la bêta seulement dans `donnees-v5.json`. À la bascule, `NOMS` reprend les noms de la v4.9 (base `lifepanel`, magasin `poignees`, copie `lifepanel`).
- **Jamais d'écriture avant la lecture** : tant que `etat.donnees !== 'pretes'`, `ecrire()` ne fait rien.
- **Sécurité** : aucun script en ligne ni `onclick=` (la CSP n'autorise que les fichiers du site) ; toute donnée affichée
  passe par `esc()` ; un lien venu des données passe par `normaliserLien()`.
- **Couleurs** : seulement les jetons de `noyau/styles/jetons.css`, jamais une couleur en dur dans un module ;
  `var(--section)` = la couleur de la section ouverte.
- **Langue** : noms, commentaires et textes en français. Les commentaires disent pourquoi, pas ce que fait la ligne.
- **Calme** : peu de texte à l'écran, pas de chiffres techniques, ce qu'il y a à faire aujourd'hui d'abord.
- **Tri des tableaux** : `localeCompare` avec `numeric:true` ; une clé date + heure garde un espace entre les deux
  (« 2026-11-23 10:00 »), sinon « 23 » et « 10 » se collent en un seul nombre.

## Compatibilité à garder

- Adresses de la v4.9 et du prototype : `noyau/adresses.js` (ALIAS). Le robot des rappels ouvre `#/aujourdhui`, `#/taches`,
  `#/donnees`, `#/evenement/ID` ; elles doivent continuer de mener à la bonne page.
- Raccourcis Android du manifeste : `?action=inbox` et `?action=depense` (à traiter au lot 1 ou 2).
- Le robot (`life-panel-donnees/notifications/rappels.js`) lit `donnees.json` : toute nouvelle forme d'événement ou de tâche
  qui doit déclencher un rappel doit y être ajoutée aussi.
