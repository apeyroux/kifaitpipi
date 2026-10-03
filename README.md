# kifaitpipi

Simulation exploratoire des promenades canines à Châtillon (Hauts-de-Seine, commune 92020). React + Vite, carte Canvas et moteur reproductible à graine fixe. Aucun compte, aucune clé API, aucun suivi de personnes.

## Démarrer

### Tester sans installation

Ouvrez **`kifaitpipi-autonome.html`** par double-clic dans votre navigateur. Ce fichier contient l’application, les polices, la géographie et le cadastre : aucune installation de Node.js ou npm et aucun serveur ne sont nécessaires. Il fonctionne aussi hors connexion. Le bouton de récupération de nouvelles données nécessite Internet.

Dans le navigateur intégré de Codex, les adresses `file://` sont bloquées. Sur Mac, double-cliquez sur **`Tester-la-page.command`** pour ouvrir un aperçu HTTP local sans npm, avec Python 3 déjà disponible sur ce Mac. Gardez le terminal ouvert pendant le test ; `Ctrl+C` arrête l’aperçu. Le serveur écoute uniquement sur votre Mac et sert uniquement la page autonome.

Cette version est un instantané : après une modification du code ou des données, un développeur peut la régénérer avec `npm run build:standalone`.

### Développer

Node.js 22.12+ (Node 24 conseillé).

```sh
npm ci
npm run dev
```

Le serveur écoute sur le port 5173. Dans le navigateur intégré au cloud, ouvrez l’adresse réseau indiquée par Vite. Sur votre Mac, téléchargez d’abord l’archive du projet, décompressez-la et ouvrez le terminal dans le dossier `kifaitpipi` avant d’exécuter ces commandes. `npm run build` produit `dist/`, `npm run preview` sert cette version. `npm test` vérifie le moteur et l’import OSM.

## Récupérer les données sur votre Mac

Les sources démographiques ont été vérifiées le 2 octobre 2026 : INSEE, RP2023 (36 705 habitants, 17 646 ménages), et FACCO–ODOXA 2025–2026 (22 % de possesseurs de chiens dans l’agglomération parisienne). La carte charge les données locales récupérées ; en leur absence, elle propose un **fond schématique non géographique** signalé. Les horaires restent des hypothèses ; le taux d’urination est un transfert exploratoire d’une étude de promenades, sans calibration locale.

Depuis ce dépôt sur votre Mac, après `npm ci` :

```sh
npm run data:fetch
npm run data:cadastre
npm run dev
```

La commande récupère la population et le contour auprès de l’API Découpage administratif, puis les rues, bâtiments, parcs et entrées via Overpass/OpenStreetMap. Elle valide le réseau et écrit atomiquement `public/data/chatillon.json`. Rechargez ensuite le site : il utilise ces données locales sans appels externes. Ne remplace pas une précédente récupération réussie en cas d’erreur. Les données OSM sont sous ODbL et doivent conserver leur attribution.

Le bouton **Méthodologie → Charger la géographie et la population réelles** réalise la même récupération depuis le navigateur. En cas de refus CORS ou réseau, utilisez la commande ci-dessus. Ce mode navigateur ne persiste pas les données entre rechargements.

Destinations nécessaires : `geo.api.gouv.fr`, `overpass-api.de` et, en secours, `overpass.kumi.systems`. Pour vérifier les statistiques : `www.insee.fr`, `www.facco.fr`. Les polices sont embarquées localement.

## Utiliser

- Cliquez sur la carte (ou « Placer un point ») pour estimer les passages dans un rayon de 5 à 100 m.
- Faites glisser la carte et utilisez les boutons de zoom/recentrage.
- Lancez la lecture, changez l’heure, la vitesse ou le type de journée.
- Ajustez les foyers équipés, les sorties et les durées. Les résultats sont recalculés avec la même graine.
- Dans Méthodologie : ménages du scénario, chiens par foyer équipé, taux d’urination, moyenne quotidienne de défécations en promenade, nouveau tirage et export CSV du point avec paramètres et graine.
- Les trajets parcourus restent lumineux jusqu’à la fin de la promenade, puis s’effacent en 30 secondes simulées. Une urination simulée affiche un point jaune fluo pendant une pause illustrative de 15–45 secondes. À vitesse rapide, le halo reste visible 1,8 seconde à l’écran puis s’efface, sans modifier les événements comptés.

## Données et limites

| Paramètre | Valeur initiale | Statut |
| --- | --- | --- |
| Population | 36 705 | INSEE RP2023, géographie au 01/01/2026 |
| Ménages | 17 646 | INSEE RP2023 ; utilisé directement par le modèle |
| Foyers avec chien (proxy) | 22 % | FACCO–ODOXA 2025–2026 : possesseurs dans l’agglomération parisienne ; transfert aux ménages de Châtillon comme hypothèse |
| Chiens par foyer équipé | 1 | Hypothèse simplificatrice |
| Sorties | 3 / jour | Hypothèse |
| Durée visée | 25 minutes, variable | Hypothèse ; durée obtenue calculée par distance, vitesse et pauses |
| Vitesse de marche | 50–80 m/min, fixe par chien | Tirage uniforme de scénario, sans calibration locale |
| Intervalle entre sorties | Au moins 30 minutes, même autour de minuit | Contrainte de simulation, sans recommandation vétérinaire |
| Horaires semaine | Pics 7h30, 12h30, 18h30 | Hypothèse comportementale |
| Urinations simulées | 0,2 / minute, avec temps attendu des pauses pris en compte | Repère Westgarth et al. (2010), transféré comme hypothèse |
| Défécations en promenade | Moyenne de 2 / chien / jour | Budget quotidien de scénario, éclairé par de petits essais alimentaires ; pas une norme médicale |

Sources à consulter : [INSEE, Châtillon](https://www.insee.fr/fr/statistiques/1405599?geo=COM-92020), [FACCO–ODOXA 2025–2026](https://www.facco.fr/chiffres-cles/les-chiffres-de-la-population-animale-2/), [API publique](https://geo.api.gouv.fr/communes/92020), [OpenStreetMap](https://www.openstreetmap.org/#map=15/48.802/2.289).

Les départs en mode réel sont pondérés par la surface et les étages des bâtiments résidentiels OSM. Bâtiments `yes` traités comme résidentiels sauf usage commercial explicite ; nombre d’étages imputé si absent. La couverture OSM peut être incomplète ; cette méthode ne remplace pas la population IRIS et ne produit pas de densité d’habitants vérifiée. Le mode démonstration utilise une densité illustrative. Les extraits et métadonnées de sources sont conservés dans `public/data/sources.json`.

Les chemins suivent la plus grande composante piétonne connectée. L’aller évite les nœuds déjà visités et les impasses ; le retour privilégie d’autres rues, avec une pénalité sur les segments déjà empruntés. Une boucle est favorisée quand le réseau le permet. Les impasses et accès sans alternative peuvent imposer de repasser sur certains segments ; un retour par les rues est toujours assuré. Les voies privées, interdites aux piétons, autoroutes et voies rapides sont exclues quand elles sont renseignées. Les petits composants isolés sont écartés. Chaque chien conserve une vitesse tirée uniformément entre 50 et 80 m/min. Jusqu’à six boucles candidates sont comparées à la durée visée ; la durée obtenue vaut distance / vitesse + pauses. La durée et la distance moyennes obtenues sont affichées dans la méthodologie. Un intervalle minimal de 30 minutes évite les chevauchements des sorties d’un même chien, y compris à minuit. Vitesses, intervalle, horaires et choix de boucle sont des hypothèses, sans calibration terrain ni préférence mesurée pour les parcs.

Une urination simulée n’est **pas** une observation ni une prédiction sur une porte. Les entrées OSM sont associées au nœud piéton le plus proche (à moins de 35 m) si elles existent ; sinon des proxies de façade sont créés. Au plus 900 chiens sont échantillonnés et les promenades sont pondérées pour représenter la population hypothétique. Les événements urinaires sont distribués sur le parcours, indépendamment de ces entrées. Un passage signifie une promenade ayant intersecté le disque : elle compte une fois par jour et une fois dans chaque heure intersectée. Les sommes horaires peuvent dépasser le total journalier. Les valeurs correspondent à un tirage Monte Carlo, pas à une moyenne de plusieurs tirages ni à un intervalle de confiance. Un rayon de 5 m précise la sélection géométrique dans ce modèle ; il ne garantit pas une exactitude réelle de 5 m face à la couverture OSM et à l’échantillonnage. L’export CSV comprend les paramètres et la graine ; la reproduction suppose aussi les mêmes données géographiques et la même version du moteur.

Le fond cartographique est rendu localement et ne dépend d’aucun fournisseur de tuiles. Les jeux récupérés ne sont pas mis à jour automatiquement. Pour une étude réelle, vérifier les millésimes INSEE/FACCO, utiliser les ménages et données IRIS, documenter la couverture OSM et calibrer les horaires/arrêts par des observations anonymisées.

La FACCO décrit des possesseurs interrogés, pas un taux de ménages équipés propre à Châtillon. Transférer 22 % aux 17 646 ménages donne 3 882 chiens avec un chien par foyer équipé : c’est une hypothèse de population canine, pas une mesure locale. Les ménages peuvent être ajustés sans modifier la population officielle affichée.

## Fond cadastral

La couche **Parcelles cadastrales** contient 3 855 parcelles de Châtillon récupérées le 2 octobre 2026 via le service WFS IGN, couche `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle`. Filtre communal `code_insee=92020`, pagination complète, contrôle du nombre total et des identifiants dupliqués. Source DGFiP / IGN, Parcellaire Express (PCI), Licence Ouverte 2.0. Les données sont conservées dans `public/data/parcels.json` et disponibles sans service de tuiles.

Le bouton de couche contrôle uniquement l’affichage des limites cadastrales. Les sections et numéros ne sont pas superposés à la carte ; cliquer à l’intérieur d’une parcelle affiche sa référence dans le panneau d’analyse. Le cadastre ne contient pas l’emplacement fiable des portes ni le nombre d’occupants : la pondération résidentielle utilise toujours OSM, et les portes OSM sont incomplètes (81 entrées récupérées).

Actualiser avec `npm run data:cadastre`. Cette commande nécessite `data.geopf.fr`. Dans le cloud, si Node n’utilise pas le proxy réseau fourni, lancer `NODE_USE_ENV_PROXY=1 npm run data:cadastre` (Node 24). Même option pour `npm run data:fetch`. Les téléchargements conservent la validation TLS.

## Tests effectués

Tests du moteur : reproductibilité, parcours sur rues connectées, retour au domicile, pauses, persistance/effacement du trajet, déduplication et frontières horaires, profils temporels, import OSM. Vérifications Chromium sur ordinateur et mobile : point, lecture/pause, heure, week-end, zoom, couches, référence cadastrale, réglages, export CSV et fermeture du panneau. Les horaires et la probabilité d’urination ne sont pas des mesures terrain.

## Cloudflare Pages

Consultez [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md). `npm run build:pages` produit et valide le site statique dans `dist/`. Le domaine prévu est `kifaitpipi.rue.lasegue.fr`. Aucune clé ou fonction serveur n’est requise.

## Urinations : sources et limites

[Westgarth et al. (2010), tableau 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC7132425/) rapporte une moyenne de 0,2 urination/min dans 286 observations de promenades, de durées courtes et variables. Le modèle transfère ce taux à la durée des sorties : ce choix n’est ni une norme vétérinaire ni une calibration de Châtillon. Il ne distingue pas vidange vésicale et marquage social. [Merck Veterinary Manual](https://www.merckvetmanual.com/behavior/behavior-of-dogs/social-behavior-of-dogs) décrit le rôle du marquage dans la communication canine.

Les événements suivent un tirage de Poisson le long des rues, indépendamment des entrées OSM ; l’exposition tient compte du temps attendu des pauses. Le facteur individuel uniforme 0,5–1,5, les pauses illustratives de 15–45 secondes et la distribution spatiale restent des hypothèses. Le compteur affiche des urinations simulées, pas une mesure locale ni un volume d’urine. Le plafond arbitraire de cinq arrêts est supprimé.

Les voies `dog=no` et les segments qui touchent ou traversent les contours OSM `landuse=cemetery` / `amenity=grave_yard` sont exclus. Le contour du cimetière communal (way 27819672) a été ajouté aux données embarquées depuis l’API OpenStreetMap le 2 octobre 2026.

## Défécations et couleurs

Les urinations apparaissent en jaune pastel fluo, avec un halo doux ; les défécations en marron pastel. Chaque couche peut être activée séparément, et les deux compteurs sont distincts dans le panneau d’analyse. Les marqueurs restent lisibles à vitesse rapide sans modifier le nombre d’événements.

La moyenne initiale est de **2 défécations en promenade par chien et par jour**. Un tirage de Poisson quotidien est réparti entre les sorties selon leur durée réelle de marche ; multiplier les sorties ou les allonger ne multiplie plus cette moyenne. Le réglage 0–4/jour décrit des scénarios, pas des limites médicales. Il n’impose aucun plafond individuel : zéro ou plusieurs événements sont possibles. Les éliminations dans les jardins privés ne sont pas modélisées.

Deux petits essais alimentaires éclairent l’ordre de grandeur : [Tanprasertsuk et al. (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8279163/) rapporte 1,2 ± 0,2 contre 1,7 ± 0,5 défécations/jour selon le régime, dans deux groupes de 12 chiens ; [Cabrita et al. (2023)](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2023.1245790/full) rapporte notamment 2,3–2,5/jour dans des essais sur six Beagles adultes. Ces cohortes ne constituent ni une norme clinique universelle ni une calibration des événements sur la voie publique. La moyenne de 2 et sa dispersion de Poisson restent des choix de scénario.

Le taux de 0,04/min de [Westgarth et al. (2010), tableau 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC7132425/) reste une référence historique issue de courts relevés ; il n’est plus extrapolé linéairement à une journée entière. Les pauses de 30 à 90 secondes sont illustratives. Le ramassage n’est pas modélisé : les points marron représentent des événements, sans quantifier les selles abandonnées.

## Évolution sur une journée

Dans **Évolution de la journée**, sélectionner **Cumul depuis minuit** pour conserver les portions de parcours déjà effectuées. Elles s’estompent avec l’âge mais persistent jusqu’à minuit. Le curseur peut avancer ou reculer sans double comptage ; **24:00** affiche la journée complète. À la reprise d’une nouvelle journée, le cumul est recalculé depuis zéro. Les portions de promenade traversant minuit sont découpées.

**Carte de chaleur**, activée par défaut, propose mictions/marquages, défécations ou toutes les déjections. Elle cumule les événements pondérés jusqu’à l’heure affichée sur une grille de 10 m, avec un noyau normalisé de rayon 30 m. L’échelle reste fixée au maximum du bilan journalier pour le scénario et le type sélectionnés, sans renormalisation au fil des heures. Changer le scénario ou le type recalcule l’échelle : les couleurs ne permettent pas une comparaison quantitative absolue entre scénarios. Le lissage ne donne pas une précision de localisation de 5 m ; le rayon d’observation reste un contrôle indépendant. Les marqueurs ponctuels et la chaleur sont des couches indépendantes.

L’urbanisme agit par la masse résidentielle OSM (surface × étages), les départs et le réseau de rues. Aucun coefficient de marquage par arbre, façade, parc ou revêtement n’est présenté comme validé. Les zones chaudes indiquent une concentration théorique d’événements, pas des volumes, une contamination, une gravité sanitaire ou des excréments abandonnés. Pluie, nettoyage et ramassage ne sont pas modélisés.

### Repères complémentaires sur la miction canine

Vérification du tableau 3 de Westgarth et al. (2010) : observations de 10–600 secondes (moyenne 180 s, médiane 136 s), taux d’urination moyen 0,2/min, médiane 0, plage 0–2,5/min. Moyennes des groupes en laisse 0,1/min et sans laisse 0,3/min ; ces comparaisons ne démontrent pas un effet causal. L’extrapolation à 25 minutes reste un choix de scénario.

[McGuire et al. (2020)](https://pubmed.ncbi.nlm.nih.gov/32272557/) : 100 chiens de refuge, promenades de 20 minutes, effets du chien et de l’accompagnateur sur le marquage. [McGuire et al. (2023)](https://pubmed.ncbi.nlm.nih.gov/38067000/) : deux études (113 et 81 chiens) examinant aussi maturité et familiarité. Ces résultats étayent la variabilité contextuelle sans fournir une calibration pour Châtillon. [UC Davis, médecine vétérinaire](https://healthtopics.vetmed.ucdavis.edu/health-topics/canine/urine-marking-dogs) décrit le marquage comme comportement social : fréquence d’événements et volume/vidange vésicale sont des mesures différentes.

### Durée des sorties en milieu urbain

Les 25 minutes par défaut restent une hypothèse réglable. Le [Dog Aging Project (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9517596/) rapporte une moyenne déclarée de 54,3 minutes et une médiane de 40 minutes pour les sorties en laisse, chez des volontaires américains, sans être exclusivement urbain. [Christian et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5034524/) rapporte 5–6 promenades et 93–109 minutes par semaine dans quatre villes ; ces statistiques hebdomadaires ne donnent pas directement une moyenne individuelle par sortie. [Koohsari et al. (2020)](https://pubmed.ncbi.nlm.nih.gov/31753577/) étudie l’environnement bâti de zones denses japonaises (1 058 participants), sans fournir une durée ou un coefficient de miction transposable à Châtillon. Trois sorties quotidiennes, les pics horaires et la dispersion des durées ne sont pas calibrés par ces études.
