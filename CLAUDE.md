# LIFE PANEL v5 — règles du projet

Appli personnelle (tâches, calendrier, finance, notes, documents, contacts), en français, sans bibliothèque ni outil
d'assemblage. Servie par GitHub Pages. Les données vivent dans le dépôt privé `delife-fr/life-panel-donnees` (`donnees.json`).

## Branches

- `main` : la **v5**, en service depuis la bascule du 24/11 (https://panel.alexishocini.fr/) ; GitHub Pages publie tout
  ce qui arrive sur `main`. L'ancienne **v4.9** est gardée dans le dossier `v49/` (…/v49/), sans synchro : ses données
  sont à part (base « lifepanel-v49 ») et elle refuse d'écrire un donnees.json de VERSION 24.
- On travaille sur une branche (`beta`, ou la branche `claude/…` d'une session), puis on la fusionne dans `main` pour
  publier. Toujours partir de `main` à jour : des changements y arrivent parfois directement (le 24-25/11, ceux faits
  avec Grok : case Drive, nouvel arbre des chemins).
- Référence v4.9 pour reprendre du code : **`v49/index.html`** (sections A à Q : données, utilitaires, calculs, pages,
  routeur, fenêtres, actions, focus, palette, recherche, fichiers, Drive, synchro GitHub, notifications).
  Attention : depuis la bascule, `index.html` à la racine de `main` est la coquille de la v5.
- Le suivi de la refonte (décisions, lots, retours) est dans le document Claude Docs « Refonte LIFE PANEL » :
  https://claude.ai/artifact/6RU7D8ZMBrSZAmAgBwtZyG — on le relit (commentaires compris) avant de commencer un lot.

## Lancer en local

Les modules JavaScript ne se chargent pas depuis un fichier ouvert par double-clic : il faut un petit serveur.

```bash
python3 -m http.server 8765
```

puis http://127.0.0.1:8765/

**En ligne** : https://panel.alexishocini.fr/ (la v5, branche `main`). La synchro lit et écrit **un seul fichier de
données**, `donnees.json` (le `donnees-v5.json` de la bêta a été supprimé à la bascule).

Aperçu sans synchro : **toujours l'adresse figée sur un commit**,
`https://raw.githack.com/delife-fr/life-panel/<commit complet>/index.html`, à donner après chaque push. L'adresse d'une
branche (`…/main/index.html`) sert des fichiers de versions différentes (cache de raw.githack) : les imports échouent, la
page reste sur « Chargement… ».

## Les sections (décidées au tour 1)

| Section | Dossier | Couleur | Téléphone | Sous-menu |
| --- | --- | --- | --- | --- |
| Aujourd'hui | `aujourdhui` | bleu | onglet | — |
| Idées (l'Inbox de la v4.9) | `idees` | jaune | Plus (+ icône en haut) | — (on range ou on supprime, pas d'archives) |
| Calendrier | `calendrier` | violet | onglet | 2 semaines · Mois · Agenda |
| Tâches | `taches` | vert | onglet | — (toutes les tâches ; les listes en puces qui filtrent) |
| Dossiers (les « projets » des données) | `dossiers` | orange | Plus | Ouverts · Fermés ; dans un dossier : ‹ Dossiers · Tâches · Rendez-vous · Notes · Documents · Dépenses · Contacts · Journal |
| Finance | `finance` | herbe | onglet | Mois · Année · Mouvements · À catégoriser · Comptes · Catégories |
| Carnet | `carnet` | rose | Plus | Notes · Journal · Documents |
| Contacts | `contacts` | prune | Plus | — (filtres de la v4.8 en boutons au-dessus du tableau) |
| Réglages (icône en haut à droite) | `reglages` | gris | Plus (+ icône en haut) | Données · Corbeille |

- **PC (à partir de 1 100 px)** : les sections en haut, le sous-menu de la section ouverte juste en dessous ; la barre prend
  la couleur de la section. À droite : Chercher (Ctrl K), Noter, Tags (T), Aide « ? », l'icône jour/nuit, Réglages
  (sous 1 600 px, Chercher et Noter en icônes).
- **Téléphone et tablette** : le titre de la section en haut, le sous-menu qui défile, 4 onglets en bas + « Plus », le bouton +.
  Les icônes du haut sont serrées (36 px) et le nuage de la synchro n'y paraît qu'en cas d'erreur ou hors ligne : le titre
  doit tenir en entier jusqu'à 360 px de large.
- **Thème** : nuit par défaut ou jour, seulement par l'icône en haut à droite (pas de thème automatique, rien dans Réglages).

## Autres décisions (tour 1 et retours suivants, datés)

- Tout ce qui existe en v4.9 est gardé, sauf : priorités, Focus 25 min, tout budget (dossiers, comptes, catégories : les
  champs restent dans les données, jamais affichés), lien vers le Wiki (plus tard).
- **Dossier = super tag** : un élément est dans un seul dossier (champ `projet`, gardé tel quel pour la compatibilité).
  Tout élément peut y aller (entrées du journal comprises), sauf les idées. Couleur au choix.
- **Chemin des dossiers** (23/11, 2e retour) : Perso, Aviation, Maison, Santé… ne sont **pas des dossiers**, seulement un
  chemin (champ `chemin`, ex. ['Perso', 'Maison'] ; attention, le champ `dossier` des projets est le chemin Drive de la
  v3.13, et `parent` n'est plus utilisé). Les vrais dossiers sont au bout du chemin, l'utilisateur choisit leur chemin
  (fiche « Chemin » : une liste déroulante de l'arbre ; ou glisser le dossier sur un chemin de l'arbre). Page Dossiers :
  l'arbre des chemins à gauche (où créer, où ranger ; « Nouveau chemin… »), le tableau des dossiers de ce chemin. L'arbre de
  départ est la hiérarchie du 25/11 (voir « Hiérarchie des dossiers »), où **chaque nom est un chemin** (CHEMINS_DEPART,
  calculs.js) ; dès qu'on touche à l'arbre, il est recopié dans les données (`DB.chemins`). Un dossier ouvert : le
  sous-menu passe aux types (chacun compté), chacun le même tableau que dans sa section. Un dossier dont on n'a plus
  besoin est **fermé** (drapeau `archive`) et reste visible dans « Fermés ».
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
- **Calendrier** : « Afficher » (24/11 : des cases sur une ligne, juste à droite de ‹ période › ; dans Agenda, juste à
  droite de la recherche ; sur téléphone, la ligne passe dessous) : Rendez-vous, Tâches, Dépenses, retenu sur cet appareil ; les dépenses (comptes pointés) sont cachées au départ, une ligne par jour avec le
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
  jamais pendant les exemples (`reglages.demo`), jamais un envoi de données vides. Réglages › Données : se connecter,
  changer la clé, arrêter. La clé de la v4.9 est reprise telle quelle (mêmes noms de stockage) ; une clé gardée par
  l'ancienne bêta (base « lifepanel-v5-beta ») est proposée en un clic (cleV49, nom historique). Une erreur 5xx de GitHub
  (panne de son côté, ex. le 25/11) : message « panne passagère », la synchro réessaie toute seule toutes les 30 s ; rien
  n'est perdu, les modifications restent dans le navigateur.
- **Rappels et notifications** (24/11, noyau/notifications.js) : le moteur ne change pas (robot du dépôt privé, lancé
  toutes les 30 min par cron-job.org, push du navigateur : rien à laisser ouvert ; précision ± 30 min, suffisante).
  Réglages › Données › Notifications : activer sur cet appareil, mode (tout, résumé, rien), essayer, désactiver. Un
  appareil est reconnu par son **abonnement push**, porté par le service worker de la racine du site (celui de la v5 a
  remplacé celui de la v4.9 sans changer l'inscription) : jamais de doublon. La clé (cle-publique.txt) existe déjà : pas
  de « Préparer les notifications » en v5.
- **Service worker v5** (sw.js) : le réseau d'abord (revalidé), la copie sans réseau ; cache « lp5-site » (la v4.9
  efface les « lifepanel-… ») ; push et clic sur une notification comme la v4.9. **Manifeste** : raccourcis « Nouvelle
  idée » (`?action=inbox` → Noter, Idée) et « Nouvelle dépense » (`?action=depense`), « Partager → LIFE PANEL » (Noter).
- **Corbeille** gardée (Réglages › Corbeille, 30 jours, « Vider la corbeille » juste à droite de la recherche, option
  `outilsCote` du tableau) ; seules les archives sont parties.
- **Aujourd'hui** : une tuile Finance (dépensé ce mois-ci, comptes pointés, anneau par catégorie), comme la v4.9.
  PC (24/11) : trois colonnes, Aujourd'hui | Finance | À ranger et À venir ; téléphone : les uns sous les autres.
- **Notes** : la fiche (grande) montre la note mise en forme par la liseuse Markdown de la v4.9 (noyau/markdown.js) :
  « Lire » / « Écrire », cases « - [ ] » cochables, [[Titre]] ouvre la note ou le contact (crée la note qui manque).
- **Largeur** (24/11) : les pages prennent toute la largeur de l'écran (plus de max-width en px) ; seules les lignes
  « ajouter vite » gardent 640 px.
- **Arbre des chemins** : les traits ├ └ │ de la hiérarchie (Dossiers). L'utilisateur le range lui-même (24/11) : glisser
  un chemin sur un autre (il passe dessous, avec ses sous-chemins et ses dossiers ; sur « Tous les dossiers » : racine),
  croix à droite du nom pour le supprimer (ses dossiers remontent dans le parent), « Annuler » dans le message
  (supprimerChemin, deplacerChemin dans calculs.js).
- **Dossiers sur téléphone** : l'arbre des chemins se replie (flèche « Chemins »), replié au départ, retenu sur l'appareil.
- **Hiérarchie des dossiers** (changée le 25/11, à la demande) : tous ses noms sont des chemins, les dossiers se créent au
  bout. Racine : À trier, Archives, Aviation, Perso. Aviation : Licences (EASA, FAA), Médical, Formations, Carnet de vol,
  Employeurs (UMS), Candidatures, Documentation. Perso : Administratif (Identité, État civil, Diplômes, Juridique,
  Protection sociale : Sécurité sociale, Chômage), Finances (Banques, Placements, Crédits, Impôts, Assurances, Retraite),
  Logements, Abonnements, Transports, Santé, Numérique (Appareils, Logiciels et licences), Loisirs (JDR, Jeux, Livres),
  Voyages. L'arbre du 24/11 déjà copié dans les données est repris une fois (`DB.arbre = 2`, adopterArbre dans calculs.js,
  appelé après chaque remplacer()) : les branches qui n'existent plus disparaissent, un chemin ajouté à la main reste, et
  le chemin d'un dossier déjà créé n'est pas déplacé. Fait sur les vraies données le 25/11. Pour changer encore la
  hiérarchie de départ : nouveau CHEMINS_DEPART, l'actuel gardé pour le reconnaître, et `arbre: 3`.
- **Couleurs** des catégories et des dossiers : 14 teintes (les 9 de la v4.9 + cyan, brun, olive, indigo, gris) et 13
  rayées (TEINTES, COULEURS_CAT dans donnees.js).
- **Finance** : le tableau des mouvements, « Par catégorie » et « Mois par mois » se plient (flèche) ; Comptes : colonne
  « Pointé : oui / non » (la case de la v4.9 qui laisse un compte, ex. l'épargne, hors des totaux) ; la couleur d'une
  catégorie se choisit sur des pastilles. Les calculs et l'anneau sont dans noyau/finance.js (Finance et Aujourd'hui).
- **À catégoriser** (Finance, 25/11 ; avant, en bas de Idées) : les dépenses sans catégorie, leur nombre dans une pastille
  du sous-menu. Le bouton bleu met la catégorie proposée (categorieProposee : l'habitude du même libellé, puis les
  mots-clés ; l'utilisateur y tient), « Autre… » en choisit une autre, « Accepter les propositions » pour toutes.
  **Pas de glisser-déposer sur des catégories** (la rangée de catégories prenait trop de place). Aujourd'hui › À ranger
  mène aux idées et à cette page.
- **Google Drive** (24/11, noyau/drive.js) : connexion au compte Google (OAuth « token », projet Google Cloud « LIFE PANEL »
  en statut Test, client ID dans drive.js, accès d'une heure gardé dans ce navigateur, « Reconnecter » ensuite ; en statut
  Test, Google redemande l'accord 7 jours après l'avoir donné). Se connecter recharge la page (aller-retour chez Google). Pas de
  sous-menu à part : **Carnet › Documents** montre aussi tous les fichiers du Drive (source « Drive », hors dossiers et
  corbeille, seulement les siens) ; « Pas encore rangés » = fichiers Drive sans dossier. Ranger un fichier (dossier dans sa
  fiche, ou Ctrl + clic puis « Dossier… ») crée un document lié (`driveId`) ; un nom changé dans la fiche change dans
  Drive, un nom changé dans Drive revient ici. L'utilisateur range ses fichiers lui-même (ou avec Claude, autre session).
  **Afficher** (24/11) : une case « Drive », comme celles du calendrier, retenue sur cet appareil (`documents.afficher`) :
  décochée, les fichiers Drive disparaissent du tableau (les fiches créées ici restent). Colonne **Type** (triable) : PDF,
  JPG, Docs… d'après le type Drive ; un tiret pour une fiche créée dans LIFE PANEL. Le type n'est pas enregistré.
- **Plus d'archives** (23/11) : pas de page Archives. Une tâche faite reste visible, barrée, en bas du tableau ; notes,
  documents et contacts archivés en v4.9 sont affichés comme les autres (le drapeau reste dans les données).
- **Contacts** (23/11) : plus d'« À lui dire », « À répondre », « Idées de cadeaux », « Nouvelles », « Dernier échange »,
  « À relancer » ni « Je lui ai parlé aujourd'hui » à l'écran (gardés dans les données) ; la fiche montre les lignes du
  journal qui citent le contact (@Nom).
- **La puce d'un dossier** est un lien vers le dossier, partout.
- **Exemples** : Réglages › Données › « Charger des exemples » (modules/reglages/exemples.js) remplace les données de ce
  navigateur par des données fictives (synchro coupée tant qu'elles sont là, « Annuler » dans le message) ; à enrichir
  quand une fonction arrive.
- **Tags sur tout élément** sauf les idées ; la fenêtre Tags de la v4.7 pour les gérer (en haut à droite).
- **Capture rapide dans chaque section** : une ligne, Entrée, c'est créé, les détails après. Le bouton + (« Noter ») :
  **« Idée » choisi par défaut** (24/11), Entrée et c'est dans Idées ; « Auto » (l'ancien « Deviner ») garde la phrase
  devinée de la v4.9 (« essence 45 » → une dépense), les autres puces forcent le type.
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
- **Tâches au plus simple** (24/11 : les tâches faites dans un second tableau « Faites », qui se replie, retenu sur l'appareil ; pareil dans la page d'un dossier depuis le 26/11 ; un seul champ de recherche pour les deux tableaux, option `rechercheDe` du tableau ; « Faites » replié s'ouvre tout seul pendant une recherche qui y trouve quelque chose, et se replie champ vidé, sans changer le choix gardé) : un tableau, une colonne Date (un tiret sans date), aucun regroupement par jour, ni statut,
  ni notation, **sans sous-menu** : toutes les tâches, celles des listes comprises (colonne Liste triable) ; une tâche
  faite reste barrée en bas. Les listes en puces au-dessus : un clic filtre (`#/taches?liste=ID`, l'adresse de la v4.9),
  « Nouvelle liste… » en une ligne ; chaque puce reçoit les tâches glissées. Étapes dans la fiche (« 1/3 » dans le tableau).
- **Sélection sur PC** (composant tableau, `selection`) : Ctrl + clic, Maj + clic, Échap ; une barre flottante en bas
  propose les actions ; glisser une ligne choisie emporte toute la sélection.
- **Fiches au centre** : une grande tuile au milieu de l'écran, le site en arrière-plan (comme la modale de la v4.9) ;
  pas de panneau à droite. Sur téléphone, plein écran depuis le bas.
- **Glisser-déposer partout où c'est naturel** (moteur du prototype, souris et doigt), toujours doublé d'un bouton.
- **Documents et Drive** : voir « Google Drive » ; un ancien lien `drive:PERSO/…` (v4.9) ouvre la recherche de Google Drive.
- **Journal** : nouvelle liste `journal` dans les données ({date, texte, contacts, tags, projet}) ; la seule différence avec
  la lecture de la v4.9 (vérifié avant la bascule).
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
  synchro.js          la synchro GitHub de la v4.9 (donnees.json), l'icône nuage
  notifications.js    les rappels sur cet appareil : abonnement push, mode (tout, résumé, rien), essai, désinscription
  drive.js            Google Drive : connexion au compte Google, liste des fichiers, renommer, type (PDF, Docs…)
  colonnes.js         les colonnes de chaque type d'élément et le texte où chercher, communs à tous les tableaux
  glisser.js          le glisser-déposer (souris et doigt) : glisserType(type, {depot}), [data-glisser], [data-depot]
  fiches.js           la fiche de chaque type d'élément (TYPES_ELEMENT), avec dossier, tags et attributs libres
  capture.js          « Noter » en une phrase (bouton +, touche C), et le rangement d'une idée
  mentions.js         « @ » (contacts) et « # » (tags) proposés pendant la frappe d'une entrée du journal
  markdown.js         la liseuse Markdown de la v4.9 (md, basculerCaseMd), [[liens]] entre notes
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
sw.js, manifest.webmanifest   hors ligne, installation, notifications, raccourcis Android (lot 1)
icons/                les icônes de l'appli et des raccourcis Android
v49/                  l'ancienne v4.9 (index.html, sw.js, manifeste), sans synchro ; la référence pour reprendre du code
CNAME                 panel.alexishocini.fr (GitHub Pages)
```

Les modules ne s'importent **jamais** entre eux : ils passent par le noyau. Une page est une fonction qui renvoie du HTML
(texte) ; `apres` branche ce qui doit l'être ; les clics passent par `data-action` et le registre.

## Règles

- **Économiser** (demande de l'utilisateur) : reprendre le code de la v4.9 (`v49/index.html`) et du prototype plutôt que
  réécrire ; tests et captures d'écran seulement là où ça change.

- **Données : rien n'est perdu.** `FORMES` garde les champs inconnus (`{...x, champs vérifiés}`), `normaliser` garde les
  clés inconnues et reste idempotent. Toute nouvelle donnée passe par `FORMES` (lecture comme création).
  Vérifié : la v5 lit le vrai `donnees.json` exactement comme la v4.9.
- **VERSION** des données : 24 depuis la bascule (la v4.9 refuse de synchroniser un fichier plus récent qu'elle).
- **Stockage** : `noyau/stockage.js` (`NOMS`) utilise les noms de la v4.9 (base `lifepanel`, magasin `poignees`, copie
  `lifepanel`, mêmes clés et formats) : à la bascule, chaque appareil a gardé ses données, sa clé GitHub et sa base de synchro.
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
- Raccourcis Android du manifeste : `?action=inbox` et `?action=depense` (app.js, ouvertureDepuisAndroid).
- Le robot (`life-panel-donnees/notifications/rappels.js`) lit `donnees.json` : toute nouvelle forme d'événement ou de tâche
  qui doit déclencher un rappel doit y être ajoutée aussi.
- La **compétence Claude « life-panel »** (SKILL.md + ajout.py, gardée sur le compte Claude de l'utilisateur, dans aucun
  dépôt ; mise à jour pour la v5 le 26/11) écrit aussi `donnees.json` : ce que l'utilisateur dicte sur son téléphone
  (journal avec @, dépenses, tâches, rendez-vous, notes, documents, contacts, idées, dossiers), avec les formes de
  `FORMES`. Elle refuse d'écrire une VERSION plus récente que la sienne (`VERSION_MAX = 24`) : une nouvelle VERSION ou
  une nouvelle forme d'élément → lui faire suivre (nouveau zip, que l'utilisateur recharge dans l'appli Claude).
