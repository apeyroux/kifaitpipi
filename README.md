![kikifaitpipi — Comprendre les promenades, explorer les hypothèses](docs/readme-banner.svg)

<p align="center">
  <a href="https://kikifaitpipi.rue.lasegue.fr"><strong>Explorer la simulation ↗</strong></a>
  · <a href="#la-démarche-scientifique">Méthode</a>
  · <a href="#sources-et-références">Sources</a>
  · <a href="#lancer-le-projet">Installation</a>
</p>

# kikifaitpipi

**Une simulation statistique des promenades et des déjections canines à Châtillon, dans les Hauts-de-Seine.**

Comment les logements, les rues et les horaires de sortie pourraient-ils répartir les promenades dans une ville ? kikifaitpipi transforme des données ouvertes et des hypothèses explicites en parcours animés, en statistiques de passage et en cartes de chaleur exploratoires.

> [!IMPORTANT]
> Les rues et les parcelles sont réelles ; les chiens, les trajets et les événements sont simulés. Le projet n’a pas été calibré par des observations locales : il permet d’explorer des scénarios, pas d’identifier des personnes, des responsables ou des nuisances avérées.

## Explorer une journée

| Fonction | Ce que l’on peut explorer |
| --- | --- |
| **Promenades lumineuses** | Suivre un parcours sur les rues, jusqu’au retour au point de départ. |
| **Parcelle d’observation** | Cliquer dans une parcelle cadastrale, surlignée en orange fluo, et estimer les passages sur toute sa surface et ses abords (marge de 0 à 100 m, 5 m par défaut). |
| **Lecture temporelle** | Avancer, revenir en arrière, accélérer et consulter le bilan à 24:00. |
| **Cumul depuis minuit** | Conserver les portions de trajets déjà parcourues. |
| **Chaleur théorique** | Visualiser le cumul des mictions/marquages, des défécations ou des deux. |
| **Scénarios réglables** | Modifier la population canine hypothétique, les sorties, les durées et les fréquences d’événements. |
| **Cadastre et export CSV** | Exporter la référence cadastrale, la marge de calcul, les résultats, les paramètres et la graine. |

Les mictions/marquages sont représentés en jaune pastel et les défécations en marron pastel. Les halos restent lisibles à vitesse rapide ; leur persistance à l’écran ne modifie pas les événements comptés.

La lecture démarre automatiquement après le chargement des données et le calcul du premier scénario. Le bouton pause reste disponible. Un lien GitHub discret dans le pied des réglages donne accès au code et à cette documentation.

## La démarche scientifique

Le projet suit une démarche de **modélisation exploratoire** : préciser la question, documenter les données disponibles, rendre les hypothèses modifiables, vérifier les calculs et expliciter ce qu’il reste à confronter au terrain.

```mermaid
flowchart LR
    A["Données ouvertes<br/>INSEE · OSM · cadastre"] --> C["Population canine<br/>hypothétique"]
    B["Hypothèses explicites<br/>possession · sorties · comportements"] --> C
    C --> D["Tirage reproductible<br/>chiens · horaires · parcours"]
    A --> D
    D --> E["Événements simulés<br/>mictions · défécations"]
    E --> F["Indicateurs<br/>passages · cumul · chaleur"]
```

### 1. Distinguer les données et les hypothèses

Les statistiques communales décrivent les habitants et les ménages. Elles ne recensent pas les chiens. Le taux de possession issu de la FACCO concerne une autre population et est utilisé comme proxy : son transfert à Châtillon est un choix de modèle.

| Entrée | Valeur initiale | Provenance et portée |
| --- | --- | --- |
| Habitants | 36 705 | [INSEE, RP2023](https://www.insee.fr/fr/statistiques/1405599?geo=COM-92020), géographie au 01/01/2026. |
| Ménages | 17 646 | Même source ; base utilisée pour calculer la population canine. |
| Taux de possession appliqué aux ménages | 22 % | [FACCO–ODOXA 2025–2026](https://www.facco.fr/chiffres-cles/les-chiffres-de-la-population-animale-2/) : possesseurs dans l’agglomération parisienne ; **proxy, sans mesure communale**. |
| Chiens par foyer équipé | 1 | Hypothèse simplificatrice, réglable. |
| Sorties par chien | 2/jour | Hypothèse de scénario. |
| Durée visée d’une sortie | 25 min | Hypothèse ; la durée obtenue dépend du parcours et des pauses. |
| Vitesse de marche | 50–80 m/min | Tirage uniforme, fixe par chien ; sans calibration locale. |
| Pics horaires en semaine | 7h30, 12h30, 18h30 | Profil supposé, décalé le week-end. |
| Mictions/marquages | 0,2/min | Repère observationnel de [Westgarth et al. (2010)](https://doi.org/10.1016/j.applanim.2010.03.007), transféré au scénario. |
| Défécations en promenade | Moyenne de 2/chien/jour | Hypothèse éclairée par des essais alimentaires ; aucune norme clinique n’est déduite. |

Les valeurs documentaires sont conservées dans [public/data/sources.json](public/data/sources.json). Les données géographiques embarquées ont été récupérées le 2 octobre 2026 ; elles ne sont pas actualisées automatiquement.

### 2. Construire une population synthétique

La population canine du scénario est calculée ainsi :

```text
N = arrondi(ménages × taux de possession × chiens par foyer équipé)
N initial = arrondi(17 646 × 0,22 × 1) = 3 882 chiens hypothétiques
```

Le moteur simule au plus **900 chiens**, chacun portant un poids `N / taille de l’échantillon`. Les passages et événements sont additionnés avec ce poids. Il s’agit d’un échantillon synthétique, pas d’un échantillon de chiens recensés sur le terrain.

Les résultats affichés sont arrondis. Un seul parcours échantillonné peut représenter plusieurs promenades : un petit nombre de parcours dans une zone réduite rend l’estimation particulièrement sensible au tirage.

Les points de départ sont tirés selon une masse résidentielle approximative : **surface des bâtiments OSM × nombre d’étages**. Les étages manquants sont imputés ; certains bâtiments peu renseignés sont assimilés à du résidentiel. Cette pondération ne fournit pas une population mesurée à l’adresse et ne remplace pas les données INSEE à l’échelle IRIS.

### 3. Générer des promenades cohérentes avec le réseau

Le moteur conserve la plus grande composante piétonne connectée du réseau OSM. Il écarte les accès privés ou interdits renseignés, les voies `dog=no`, les voies rapides et les segments qui touchent ou traversent les contours des cimetières. Une information manquante dans OSM reste une incertitude sur l’accès réel.

Les distances utilisent une projection plane locale approximative autour de Châtillon. Les composants isolés et les déplacements hors du réseau communal retenu ne sont pas représentés ; les trajets réels qui sortent de la commune peuvent donc manquer.

Chaque promenade a une intention : **sortie de quartier**, **circuit habituel** ou **promenade vers un espace vert cartographié**. Chaque chien construit au fil des sorties un répertoire limité à deux à quatre circuits de référence, réutilisés selon l’intention et le temps disponible ; un petit réseau peut offrir moins de circuits distincts. Le planificateur choisit des destinations atteignables, favorise la continuité d’une rue et limite les changements de direction, les traversées et les répétitions inutiles. Il réserve une distance de retour au domicile dans le budget de marche ; les boucles sont préférées quand le réseau le permet, et un aller-retour reste naturel lorsqu’il convient mieux.

Les destinations vertes sont choisies selon leur proximité sur le réseau et le détour nécessaire, dans le budget de marche. Une sortie de quartier ou un circuit habituel peut également inclure un espace vert proche. L’intention verte peut être tirée entre 6h et 23h, avec une affinité stable propre au chien ; elle est plus probable le week-end et lorsqu’un aller-retour vers un espace vert tient dans le budget. Les segments verts reçoivent un coût de préférence multiplié par 0,9, avec un plancher de 0,8 ; la part verte intervient aussi dans la comparaison des parcours. Ces coefficients orientent le choix sans changer les distances physiques et restent des hypothèses.

Une destination verte ne garantit pas un accès autorisé pour les chiens. Dans [l’extrait OSM embarqué](public/data/chatillon.json), les **10 destinations vertes ont toutes un accès non renseigné** (`accessKnown=false`). Les interdictions connues sont exclues, et les destinations s’appuient sur un réseau piéton cartographié ; l’absence d’interdiction ne constitue pas une confirmation sur le terrain.

Cette distinction s’inspire des sorties fonctionnelles et récréatives décrites dans les entretiens de [Westgarth et al. (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7954209/). [Kurose et Koike (2020)](https://doi.org/10.18960/hozen.2002) relient les parcours habituels dessinés par les propriétaires à une préférence pour les espaces verts ouverts. Ces études motivent les choix de conception ; elles ne calibrent ni les trois intentions, ni leur fréquence, ni les deux à quatre circuits à Châtillon. Les pénalités de virage, de traversée et de répétition demeurent des hypothèses.

La chronologie respecte la relation :

```text
durée obtenue = somme des distances de segment / leurs allures + durée des pauses
```

Une vitesse de base de 50–80 m/min est attribuée à chaque chien. L’allure varie doucement par rue, avec un ralentissement avant les virages et les traversées. Des pauses de flairage de 5–25 secondes sont distinctes des mictions et des défécations ; elles allongent la sortie sans ajouter d’événement aux compteurs ou à la chaleur. Leur taux de 0,12–0,24 arrêt par minute de marche et leur préférence modeste pour les segments verts connus sont des choix de scénario. Les observations de [Westgarth et al. (2010)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7132425/) documentent le flairage en promenade, sans fournir une calibration de ces paramètres locaux. L’animation suit les segments à un temps continu ; elle reste figée lorsque la lecture est en pause.

Aux passages piétons renseignés dans OSM, une attente aléatoire peut interrompre la marche : probabilité de 55 % et pause de 2–12 secondes sans feu renseigné ; 70 % et 5–45 secondes avec feu renseigné. Ces réglages sont des hypothèses ; le modèle ne connaît ni l’état réel du feu ni le trafic. Un anneau bleu discret signale cette attente. Ces pauses allongent la balade sans ajouter de déjection aux compteurs ou à la chaleur.

Les horaires sont tirés dans un profil à trois pics. Les sorties d’un même chien sont ensuite espacées d’au moins 30 minutes, y compris autour de minuit. Cette contrainte organise le scénario ; elle ne constitue pas une recommandation vétérinaire.

### 4. Simuler les événements avec des repères documentés

**Mictions et marquages.** Westgarth et al. (2010) étudient notamment 286 observations de promenades et rapportent un taux moyen de 0,2 miction/min au tableau 3. Les observations sont courtes, de 10 à 600 secondes : appliquer ce repère à des sorties entières suppose une extrapolation. Le modèle utilise des arrivées de Poisson, un facteur individuel uniforme entre 0,5 et 1,5 et une exposition tenant compte du temps attendu des pauses. La dispersion, la localisation le long des rues et les pauses de 15–45 secondes sont des hypothèses. [Source : article et tableau 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC7132425/).

Le compteur regroupe marquage social et miction sans les distinguer. Un événement ne donne pas un volume d’urine. Les entrées OSM, souvent incomplètes, ne déterminent pas la fréquence ni la localisation des événements : aucune préférence mesurée pour une porte n’est supposée.

**Pourquoi les carrefours ?** [Cafazzo, Natoli et Valsecchi (2012)](https://doi.org/10.1111/j.1439-0310.2012.02088.x) observent une meute de chiens libres près de Rome. Le marquage des mâles avec patte levée se concentre aux carrefours en frontière de territoire, contrairement aux éliminations ordinaires. L’hypothèse est qu’un signal olfactif placé à ces endroits peut être rencontré par d’autres chiens ; la cause n’est pas démontrée. L’étude ne mesure ni une préférence pour les angles à 90°, ni pour les coins de murs. Les parcours font déjà converger les passages vers les jonctions : une concentration visuelle peut donc aussi venir du trafic simulé.

Le modèle conserve le nombre global d’urinations tiré par Poisson et les durées des pauses. Il répartit les localisations selon un mélange : 50 % uniforme le long de la promenade, 50 % selon une composante pondérée de poids 2 jusqu’à 8 m avant ou après une vraie jonction. Celle-ci doit avoir au moins trois branches physiques distinctes, séparées de 25° ; virages simples, subdivisions, segments dupliqués et projections résidentielles ne créent pas de carrefour. L’attraction ne s’applique pas aux segments de traversée piétonne. La distribution est normalisée et les défécations conservent leur règle. Les proportions, distances et poids sont des hypothèses de conception ; le transfert aux chiens de compagnie n’est pas calibré à Châtillon et le modèle ne connaît ni leur sexe ni leur territoire.

**Contre-marquage et persistance.** [Lisberg et Snowdon (2011)](https://doi.org/10.1016/j.anbehav.2011.01.006) documentent le dépôt d’urine sur ou à côté de marques d’autres chiens. Une odeur détectable ne déclenche pas nécessairement un nouveau marquage. Cette réaction entre chiens et la décroissance des odeurs ne sont pas simulées ici : la chaleur reste un cumul d’événements théoriques, sans mesurer la détectabilité ni l’attirance d’une marque.

**Combien de temps une marque attire-t-elle ?** Les références consultées n’établissent aucun seuil validé pour le chien de compagnie en extérieur. [Bidder et al. (2020)](https://www.nature.com/articles/s41598-019-57198-w) soulignent que la dégradation par les précipitations, les UV et les bactéries a rarement été mesurée. Dans l’expérience de [Bekoff (2001)](https://www.wellbeingintlstudiesrepository.org/acwp_ena/46/), un seul chien, sur la neige, garde un intérêt à peu près constant pour l’urine d’autres chiens lors de retours jusqu’à cinq minutes ; cela ne fournit pas de délai à long terme applicable aux rues de Châtillon.

**Défécations.** Un nombre quotidien est tiré selon une loi de Poisson de moyenne 2, puis réparti entre les sorties proportionnellement à leur temps de marche. Des sorties plus nombreuses ou plus longues ne multiplient donc pas la moyenne quotidienne. Les pauses de 30–90 secondes et la distribution de Poisson sont des choix de scénario.

Les essais de [Tanprasertsuk et al. (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8279163/) et de [Cabrita et al. (2023)](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2023.1245790/full) montrent une variabilité selon l’alimentation dans de petites cohortes. Ils éclairent un ordre de grandeur, sans mesurer la part des défécations sur la voie publique à Châtillon. Le ramassage et les éliminations dans les jardins privés ne sont pas modélisés.

### 5. Définir précisément les résultats

| Résultat | Définition | Interprétation |
| --- | --- | --- |
| Promenades par jour | Somme pondérée des promenades qui intersectent la parcelle et sa marge d’observation, chacune comptée une fois. | Une promenade peut revenir plusieurs fois sans être recomptée dans le total journalier. |
| Promenades par heure | Somme pondérée des promenades présentes dans cette zone pendant cette heure, chacune comptée une fois par heure. | Une promenade à cheval sur deux heures apparaît dans les deux ; la somme horaire peut dépasser le total journalier. |
| Événements par jour | Somme pondérée des mictions et défécations situées dans cette zone ; flairage et attentes aux traversées sont exclus. | Un nombre d’événements simulés, sans estimation de volume ou de saleté restante. |
| Carte de chaleur | Cumul jusqu’à l’heure choisie, sur une grille de 10 m, lissé par un noyau normalisé de rayon 30 m. | Le lissage répartit le poids sans augmenter le nombre total d’événements. |

Le panneau d’observation décrit **la journée entière**, tandis que la chaleur s’arrête au curseur. À 24:00, le cumul est complet. Les parcours franchissant minuit sont découpés ; revenir en arrière ou changer la vitesse ne crée pas de double comptage.

L’échelle des couleurs est fixée au maximum de la journée pour le scénario et le type d’événement sélectionnés. Elle permet de lire l’évolution au cours d’une journée ; elle est recalculée lorsque le scénario change. Deux cartes de scénarios différents ne se comparent donc pas quantitativement par leur seule couleur.

### 6. Vérifier le calcul, puis confronter le modèle au terrain

Les tests automatisés vérifient la reproductibilité, la connectivité des trajets, le retour au départ, la chronologie des allures et pauses, l’espacement des sorties, les frontières horaires et minuit, l’exclusion du cimetière, les événements, la conservation des poids dans la chaleur et l’export CSV.

**Ces tests établissent une cohérence du logiciel, pas une validation empirique de ses prévisions.** L’interface affiche une seule réalisation Monte Carlo, sans moyenne de plusieurs tirages ni intervalle de confiance. L’incertitude combine le hasard du tirage, les paramètres supposés et l’incomplétude des données.

Pour transformer cette exploration en étude locale, il faudrait :

1. Recueillir des comptages anonymisés selon un protocole couvrant plusieurs lieux, heures et jours.
2. Calibrer les horaires, les durées, la population canine et les comportements sur ces observations.
3. Évaluer la sensibilité aux paramètres et à la couverture géographique, avec plusieurs graines et tailles d’échantillon.
4. Tester les résultats sur des lieux ou des jours réservés à la validation et publier les erreurs et l’incertitude.

> [!NOTE]
> L’observation porte sur le contour cadastral complet, ses parties disjointes et ses abords. La marge de 5 m par défaut tient compte des rues voisines ; choisir « Parcelle seule » la réduit à 0 m. Les trous et les espaces entre parties restent exclus, sauf à distance de la marge. Un clic hors parcelle ne sélectionne pas automatiquement une voisine. Cette sélection géométrique ne garantit pas une exactitude réelle de 5 m. Aucun passage simulé dans la zone ne prouve une absence réelle de passages. Le mode démonstration conserve des points sur son fond schématique.

## Reproduire un scénario

Conserver **la version du moteur, les fichiers géographiques, tous les paramètres et la graine** permet de reproduire le tirage. Le bouton « Nouveau tirage » change la graine ; il ne change pas les hypothèses.

L’export CSV de la parcelle contient sa référence cadastrale, la marge en mètres, les paramètres, la graine, les totaux et les résultats horaires. Les coordonnées sont celles du centre géométrique de sa partie principale, à titre de repère : elles ne définissent pas la zone de calcul. En mode démonstration, le CSV décrit le point et son rayon. Pour archiver une expérience, conserver ce CSV avec le commit Git et les données utilisées : le CSV seul ne fige pas la géographie ni le moteur.

## Sources et références

| Source | Usage dans le projet |
| --- | --- |
| [INSEE — Châtillon, RP2023](https://www.insee.fr/fr/statistiques/1405599?geo=COM-92020) | Habitants et ménages. |
| [FACCO–ODOXA — baromètre 2025–2026](https://www.facco.fr/chiffres-cles/les-chiffres-de-la-population-animale-2/) | Proxy de possession canine en agglomération parisienne. |
| [API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif/communes) | Contour communal et population fournis par l’API lors de la récupération. |
| [OpenStreetMap](https://www.openstreetmap.org/#map=15/48.802/2.289) | Rues, bâtiments, parcs, restrictions d’accès et cimetières. Données sous [ODbL](https://www.openstreetmap.org/copyright). |
| [DGFiP / IGN — Parcellaire Express (PCI)](https://geoservices.ign.fr/parcellaire-express-pci) | 3 855 parcelles embarquées, filtre communal `92020`, pagination et doublons contrôlés. [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). |
| [Westgarth et al., 2021 — Functional and recreational dog walking practices in the UK](https://pmc.ncbi.nlm.nih.gov/articles/PMC7954209/) | Intentions des sorties ; étude qualitative, sans fréquences locales transférées. |
| [Kurose et Koike, 2020 — Detecting behavioural preferences of dog walkers in urban green spaces](https://doi.org/10.18960/hozen.2002) | Attractivité des espaces verts pour certains parcours ; aucun coefficient directement transféré. |
| [Westgarth et al., 2010 — Dog behaviour on walks and the effect of use of the leash](https://doi.org/10.1016/j.applanim.2010.03.007) | Repère observationnel pour les mictions et le flairage ; transfert exploratoire. |
| [Cafazzo, Natoli et Valsecchi, 2012 — marquage chez des chiens libres](https://doi.org/10.1111/j.1439-0310.2012.02088.x) · [texte fourni par l’autrice](https://www.researchgate.net/publication/263689219_Scent-Marking_Behaviour_in_a_Pack_of_Free-Ranging_Domestic_Dogs) | Motivation qualitative du placement près des carrefours ; aucun multiplicateur empirique transféré. |
| [Lisberg et Snowdon, 2011 — contre-marquage chez le chien domestique](https://doi.org/10.1016/j.anbehav.2011.01.006) | Repère pour le surmarquage et le marquage adjacent ; mécanisme entre chiens et décroissance des odeurs non simulés. |
| [Tanprasertsuk et al., 2021 — essai de digestibilité alimentaire](https://doi.org/10.1093/tas/txab071) | Variabilité de la fréquence quotidienne de défécation selon le régime. |
| [Cabrita et al., 2023 — supplémentation en microalgues](https://doi.org/10.3389/fvets.2023.1245790) | Autre repère alimentaire, issu de petits essais sur des Beagles. |
| [Merck Veterinary Manual — comportement social canin](https://www.merckvetmanual.com/behavior/behavior-of-dogs/social-behavior-of-dogs) · [UC Davis — marquage urinaire](https://healthtopics.vetmed.ucdavis.edu/health-topics/canine/urine-marking-dogs) | Contexte comportemental ; aucun volume ou diagnostic n’est inféré. |

La méthodologie dans l’application et le fichier des sources recensent aussi les études complémentaires sur la promenade, le milieu bâti et la variabilité du marquage. Les cohortes étrangères ou de refuge ne constituent pas une calibration locale.

## Lancer le projet

**Node.js 22.12+ ; Node 24 conseillé.**

```sh
git clone https://github.com/apeyroux/kikifaitpipi.git
cd kikifaitpipi
npm ci
npm run dev
```

Ouvrir `http://localhost:5173`. Les données et les polices sont embarquées ; le fond est dessiné localement, sans fournisseur de tuiles ni clé API. Le moteur s’exécute dans le navigateur, avec un Web Worker. L’application ne collecte pas de traces GPS et ne requiert aucun compte.

| Commande | Usage |
| --- | --- |
| `npm test` | Exécuter les tests du moteur, des données et des exports. |
| `npm run build:pages` | Compiler dans `dist/` et vérifier les limites Cloudflare Pages. |
| `npm run preview` | Servir localement la version compilée. |
| `npm run build:standalone` | Régénérer la page autonome avec données et polices embarquées. |
| `npm run data:fetch` | Actualiser le réseau OSM et le contour communal. |
| `npm run data:cadastre` | Actualiser les parcelles depuis le service WFS IGN. |
| `npm run deploy:cloudflare` | Compiler, vérifier et publier via Wrangler sur le projet configuré. |

### Aperçu sans npm

Ouvrir [kikifaitpipi-autonome.html](kikifaitpipi-autonome.html) dans un navigateur compatible avec `file://`. Cette page est un **instantané** : elle doit être régénérée après une modification. Si le navigateur bloque le fichier local, lancer `python3 scripts/preview.py` ; sur macOS, [Tester-la-page.command](Tester-la-page.command) fournit ce raccourci si Python 3 est installé. L’aperçu écoute uniquement sur `127.0.0.1`.

### Actualiser et publier

Les récupérations de données nécessitent Internet (`geo.api.gouv.fr`, les serveurs Overpass et `data.geopf.fr`). Elles valident les réponses avant de remplacer les fichiers locaux. Avec Node 24, `NODE_USE_ENV_PROXY=1` peut être nécessaire dans un environnement utilisant un proxy. Le chargement depuis « Méthodologie » reste facultatif et ne persiste pas après rechargement.

En l’absence de données géographiques utilisables, un mode de démonstration signale explicitement son fond schématique. Le cadastre affiche des limites et des références, sans propriétaires ni occupants.

Pour publier sur Cloudflare Pages, se connecter une première fois à Wrangler, puis lancer le script :

```sh
npx wrangler@4.146.0 login --scopes account:read user:read pages:write
npm run deploy:cloudflare
```

Un contributeur qui héberge sa propre copie doit adapter le compte et le nom du projet dans le script. La connexion ou le jeton Wrangler reste sur le poste de publication, hors du dépôt.

## Repères dans le code

| Fichier | Rôle |
| --- | --- |
| [src/geography.js](src/geography.js) | Projection locale, import OSM, réseau accessible et cadastre. |
| [src/simulation.js](src/simulation.js) | Graine, population synthétique, horaires, parcours, événements et statistiques. |
| [src/observation.js](src/observation.js) | Sélection cadastrale, contours complets et marge de calcul. |
| [src/daily.js](src/daily.js) | Découpage journalier, cumuls et lissage de la chaleur. |
| [src/export.js](src/export.js) | Export des scénarios et résultats en CSV. |
| [src/components/MapCanvas.jsx](src/components/MapCanvas.jsx) | Rendu de la carte et interactions. |
| [tests/](tests/) | Invariants et vérifications de calcul. |

Les contributions les plus utiles documentent une source, améliorent un paramètre mesurable ou ajoutent un test lié à une propriété du modèle. Toute évolution doit conserver la distinction entre données publiques, hypothèses et événements simulés.
