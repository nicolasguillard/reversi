# Documentation de l'interface — Reversi

Cette documentation décrit l'interface utilisateur de l'application (fichiers `index.html` / `index.js` / `index.css`) et explique le fonctionnement de chaque élément, en particulier les cases à cocher du plateau de jeu.

## 1. Écran de configuration (`#setup`)

C'est l'écran affiché au lancement (sauf si une partie était en cours, voir §5).

| Élément | Rôle |
|---|---|
| **About** | Ouvre la fenêtre modale des règles du jeu. |
| **Light/Dark Mode** | Bascule le thème clair/sombre. Le choix est mémorisé dans `localStorage` (`theme`). |
| **Number of Players** | `0` = le moteur joue les deux couleurs l'une contre l'autre, sans aucune intervention humaine (le champ « Disk Color » est masqué et le plateau ignore les clics). `1` = contre l'ordinateur. `2` = deux joueurs humains sur le même écran. |
| **Disk Color** | Visible seulement en mode 1 joueur. Choix de la couleur du joueur humain (Black/White) ; l'ordinateur joue l'autre couleur. |
| **Or replay a Game Sequence** | Champ texte pour coller une séquence de coups (ex. `D3 C4 E3 F4`) et la rejouer automatiquement au lieu de jouer une partie normale. Le format est deux caractères par coup (colonne A-H + ligne 1-8), séparés par espace/virgule/point-virgule. Le champ se reformate automatiquement quand on le quitte (`blur`). Si une séquence est fournie, le mode passe forcément à 2 joueurs et les boutons de navigation apparaissent à la place du bouton Undo. |
| **Start!** | Valide la séquence (s'il y en a une) puis lance la partie. Si la séquence contient un coup invalide, une modale d'erreur s'affiche avec le numéro du coup fautif et le champ est surligné en rouge. |

## 2. Écran de jeu (`#game`)

### 2.1 Bandeau d'état (`#state`)
- **Score Noir / Blanc** : nombre de jetons de chaque couleur, mis à jour à chaque coup.
- **× Stop** : quitte la partie en cours et revient à l'écran de configuration.
- **Tour actuel** (`#turn`) : indique qui doit jouer (« Black's Turn » / « White's Turn »), ou le résultat final en fin de partie.
- **↺ Undo** : annule le dernier coup. En mode 1 joueur, annule aussi le coup de l'ordinateur pour revenir au tour du joueur humain. Masqué pendant la lecture d'une séquence (remplacé par les boutons de navigation, voir §2.4).

### 2.2 Plateau (`#grid`)
Grille 8×8 avec étiquettes de colonnes (A-H) et de lignes (1-8). Chaque case peut afficher, selon les cases à cocher actives :
- un jeton noir ou blanc,
- un indicateur de coup jouable (losange semi-transparent),
- un indicateur de dernier coup joué,
- un numéro de coup,
- un indice de case (1 à 64),
- un fond spécial pour les jetons qui viennent d'être retournés.

### 2.3 Historique des coups (`#move-history`)
Liste les coups joués, une ligne par tour (coup Noir + coup Blanc). Un coup passé (aucun mouvement possible) est noté **Z0** en jaune. Cliquer sur un coup de l'historique navigue directement vers l'état du plateau à ce moment-là (voir `navigateToMove`). Les coups non encore atteints (si on est revenu en arrière) apparaissent grisés (« future-move »).

### 2.4 Barre de navigation (`#navigation-btns`)
Visible uniquement pendant la lecture d'une séquence de coups. Permet de parcourir l'historique :
- **⏮ First** : retour à l'état initial du plateau.
- **▶ Play / ⏸ Pause** : lance ou met en pause la lecture automatique des coups restants (au rythme choisi dans le menu déroulant de délai, voir ci-dessous).
- **◀◀ Previous / ▶▶ Next** : recule/avance d'un coup.
- **⏭ Last** : va directement au dernier coup joué.
- **Menu déroulant de délai** (`#replayDelay`) : temps entre chaque coup lors de la lecture automatique (200 à 2000 ms, 600 ms par défaut). Un coup n'est programmé qu'un à la fois, donc changer la valeur pendant que ▶ tourne prend effet immédiatement : le coup suivant utilise la nouvelle valeur (l'attente en cours redémarre avec le nouveau délai plutôt que de terminer avec l'ancien).

Ces boutons se désactivent automatiquement en début/fin d'historique ou pendant le tour de l'ordinateur.

## 3. Les cases à cocher (`.show-checkboxes-container`)

Ces six cases à cocher contrôlent uniquement l'**affichage** du plateau ; elles n'influencent jamais les règles du jeu ni l'état de la partie.

### ☑ Show valid moves (`showValidMoves`)
Affiche ou masque les indicateurs (losanges) sur les cases où un coup légal peut être joué.
- Cochée (par défaut) : les cases jouables sont surlignées.
- Décochée : la grille garde la classe `hide-valid-moves`, les indicateurs sont masqués visuellement (mais les coups restent bien sûr toujours jouables — c'est purement cosmétique).

### ☑ Show last move (`showLastMove`)
Affiche ou masque le repère du dernier coup joué (point rouge, ou surlignage du numéro de coup si « Show move numbers » est aussi coché).
- Cochée (par défaut) : le dernier coup joué est mis en évidence sur la case correspondante.
- Décochée : aucun repère de dernier coup n'est affiché.
- Interagit avec « Show move numbers » : si les numéros de coup sont affichés, c'est le numéro lui-même qui est surligné (classe `last-move-number`) plutôt qu'un point séparé.

### ☐ Show move numbers (`showMoveNumbers`)
Affiche sur chaque case jouée le numéro d'ordre du coup (1, 2, 3…) jusqu'au coup courant.
- Décochée par défaut.
- Cochée : chaque case occupée affiche le rang du coup qui l'a posée, ce qui permet de suivre facilement la chronologie de la partie directement sur le plateau.
- Se met à jour automatiquement en cas de retour en arrière/avant dans l'historique (`updateMoveNumbers`), et interagit avec « Show last move » comme décrit ci-dessus.

### ☐ Show square indices (`showSquareIndices`)
Affiche dans un coin de chaque case un indice numérique de 1 à 64 (numérotation par ligne, de gauche à droite puis de haut en bas : A1=1, B1=2 … H1=8, A2=9…).
- Décochée par défaut.
- Utile pour identifier une case par son numéro plutôt que par sa coordonnée (colonne/ligne), par exemple en référence à une notation externe.
- N'a pas d'impact sur les autres indicateurs (dernier coup, numéro de coup) : ils peuvent tous être affichés simultanément.

### ☐ Show mono move indices (`showMonoMoveIndices`)
Change la numérotation utilisée dans **l'historique des coups** (panneau latéral), pas sur le plateau.
- Décochée par défaut : chaque ligne de l'historique est numérotée par tour (1., 2., 3.…, un tour = un coup Noir + un coup Blanc).
- Cochée : chaque ligne est numérotée par le rang du coup Noir de la paire (1., 3., 5., 7.…), ce qui correspond à la numérotation globale des coups plutôt qu'au numéro de tour.

### ☐ Show flipped disks (`showFlippedBackground`)
Met en évidence (fond spécial, classe `flipped`) les jetons qui viennent d'être retournés par le dernier coup joué/affiché.
- Décochée par défaut.
- Cochée : à chaque coup joué, ou lors de la navigation dans l'historique (précédent/suivant/clic sur un coup), les jetons retournés par ce coup précis sont mis en surbrillance, ce qui aide à visualiser l'effet du coup.
- Se recalcule dynamiquement quand on coche/décoche la case en cours de partie : si un coup est actuellement affiché, ses jetons retournés sont immédiatement affichés ou masqués.

## 4. Fenêtres modales

- **About / Rules** (`#rules`) : règles du jeu et lien vers le dépôt GitHub.
- **Victory** (`#victory`) : affichée en fin de partie normale (pas pendant la lecture d'une séquence), propose de rejouer, revenir au menu, ou fermer.
- **Erreur de validation** (`#error-modal`) : affichée si la séquence de coups saisie contient un coup invalide, avec précision du numéro et du coup fautif.

## 5. Sauvegarde automatique

La partie en cours (hors lecture de séquence) est sauvegardée dans `localStorage` (`lastGame`) après chaque coup. Si une partie était en cours au moment de la fermeture, elle est restaurée automatiquement à l'ouverture suivante, directement sur l'écran de jeu.
