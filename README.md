# kifaitpipi

Simulation exploratoire des promenades canines à Châtillon (Hauts-de-Seine, commune 92020). React + Vite, carte Canvas et moteur reproductible à graine fixe. Aucun compte, aucune clé API, aucun suivi de personnes.

## Démarrer

Node.js 22.12+ (Node 24 conseillé).

```sh
npm ci
npm run dev
```

Le serveur écoute sur le port 5173. Dans le navigateur intégré au cloud, ouvrez l’adresse réseau indiquée par Vite. Sur votre Mac, téléchargez d’abord l’archive du projet, décompressez-la et ouvrez le terminal dans le dossier `kifaitpipi` avant d’exécuter ces commandes. `npm run build` produit `dist/`, `npm run preview` sert cette version. `npm test` vérifie le moteur et l’import OSM.

## Récupérer les données sur votre Mac

Les sources démographiques ont été vérifiées le 2 octobre 2026 : INSEE, RP2023 (36 705 habitants, 17 646 ménages), et FACCO–ODOXA 2025–2026 (22 % de possesseurs de chiens dans l’agglomération parisienne). La carte charge les données locales récupérées ; en leur absence, elle propose un **fond schématique non géographique** signalé. Les horaires et arrêts restent des hypothèses.

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

- Cliquez sur la carte (ou « Placer un point ») pour estimer les passages dans un rayon de 15 à 100 m.
- Faites glisser la carte et utilisez les boutons de zoom/recentrage.
- Lancez la lecture, changez l’heure, la vitesse ou le type de journée.
- Ajustez les foyers équipés, les sorties et les durées. Les résultats sont recalculés avec la même graine.
- Dans Méthodologie : ménages du scénario, chiens par foyer équipé, probabilité d’arrêt, nouveau tirage et export CSV du point.
- Les trajets parcourus restent lumineux jusqu’à la fin de la promenade, puis s’effacent en 30 secondes simulées. Une pause à une entrée dure 15–45 secondes et affiche une marque ambre.

## Données et limites

| Paramètre | Valeur initiale | Statut |
| --- | --- | --- |
| Population | 36 705 | INSEE RP2023, géographie au 01/01/2026 |
| Ménages | 17 646 | INSEE RP2023 ; utilisé directement par le modèle |
| Foyers avec chien (proxy) | 22 % | FACCO–ODOXA 2025–2026 : possesseurs dans l’agglomération parisienne ; transfert aux ménages de Châtillon comme hypothèse |
| Chiens par foyer équipé | 1 | Hypothèse simplificatrice |
| Sorties | 3 / jour | Hypothèse |
| Durée | 25 minutes, variable | Hypothèse |
| Horaires semaine | Pics 7h30, 12h30, 18h30 | Hypothèse comportementale |
| Arrêt à une entrée | 18 %, jusqu’à 5 / promenade | Hypothèse sans validation empirique |

Sources à consulter : [INSEE, Châtillon](https://www.insee.fr/fr/statistiques/1405599?geo=COM-92020), [FACCO–ODOXA 2025–2026](https://www.facco.fr/chiffres-cles/les-chiffres-de-la-population-animale-2/), [API publique](https://geo.api.gouv.fr/communes/92020), [OpenStreetMap](https://www.openstreetmap.org/#map=15/48.802/2.289).

Les départs en mode réel sont pondérés par la surface et les étages des bâtiments résidentiels OSM. Bâtiments `yes` traités comme résidentiels sauf usage commercial explicite ; nombre d’étages imputé si absent. La couverture OSM peut être incomplète ; cette méthode ne remplace pas la population IRIS et ne produit pas de densité d’habitants vérifiée. Le mode démonstration utilise une densité illustrative. Les extraits et métadonnées de sources sont conservés dans `public/data/sources.json`.

Les chemins suivent la plus grande composante piétonne connectée ; un retour par les rues est assuré. Les voies privées, interdites aux piétons, autoroutes et voies rapides sont exclues quand elles sont renseignées. Les petits composants isolés sont écartés. Les durées ciblées priment sur la vitesse effective, qui peut donc varier. Il n’y a pas de modèle de préférences vers les parcs ni de calibration terrain.

Un arrêt n’est **pas** une urination observée ni une prédiction sur une porte. Les entrées OSM sont associées au nœud piéton le plus proche (à moins de 35 m) si elles existent ; sinon des proxies de façade sont créés. Au plus 900 chiens sont échantillonnés et les promenades sont pondérées pour représenter la population hypothétique. Un passage signifie une promenade ayant intersecté le disque : elle compte une fois par jour et une fois dans chaque heure intersectée. Les sommes horaires peuvent dépasser le total journalier. Les valeurs correspondent à un tirage Monte Carlo, pas à une moyenne de plusieurs tirages ni à un intervalle de confiance.

Le fond cartographique est rendu localement et ne dépend d’aucun fournisseur de tuiles. Les jeux récupérés ne sont pas mis à jour automatiquement. Pour une étude réelle, vérifier les millésimes INSEE/FACCO, utiliser les ménages et données IRIS, documenter la couverture OSM et calibrer les horaires/arrêts par des observations anonymisées.

La FACCO décrit des possesseurs interrogés, pas un taux de ménages équipés propre à Châtillon. Transférer 22 % aux 17 646 ménages donne 3 882 chiens avec un chien par foyer équipé : c’est une hypothèse de population canine, pas une mesure locale. Les ménages peuvent être ajustés sans modifier la population officielle affichée.

## Fond cadastral

La couche **Parcelles cadastrales** contient 3 855 parcelles de Châtillon récupérées le 2 octobre 2026 via le service WFS IGN, couche `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle`. Filtre communal `code_insee=92020`, pagination complète, contrôle du nombre total et des identifiants dupliqués. Source DGFiP / IGN, Parcellaire Express (PCI), Licence Ouverte 2.0. Les données sont conservées dans `public/data/parcels.json` et disponibles sans service de tuiles.

Le bouton de couche contrôle uniquement l’affichage des limites cadastrales. Au zoom, les sections et numéros apparaissent ; cliquer à l’intérieur d’une parcelle affiche sa référence dans le panneau d’analyse. Le cadastre ne contient pas l’emplacement fiable des portes ni le nombre d’occupants : la pondération résidentielle utilise toujours OSM, et les portes OSM sont incomplètes (81 entrées récupérées).

Actualiser avec `npm run data:cadastre`. Cette commande nécessite `data.geopf.fr`. Dans le cloud, si Node n’utilise pas le proxy réseau fourni, lancer `NODE_USE_ENV_PROXY=1 npm run data:cadastre` (Node 24). Même option pour `npm run data:fetch`. Les téléchargements conservent la validation TLS.

## Tests effectués

Tests du moteur : reproductibilité, parcours sur rues connectées, retour au domicile, pauses, persistance/effacement du trajet, déduplication et frontières horaires, profils temporels, import OSM. Vérifications Chromium sur ordinateur et mobile : point, lecture/pause, heure, week-end, zoom, couches, référence cadastrale, réglages, export CSV et fermeture du panneau. Les horaires et la probabilité d’urination ne sont pas des mesures terrain.

## Cloudflare Pages

Consultez [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md). `npm run build:pages` produit et valide le site statique dans `dist/`. Le domaine prévu est `kifaitpipi.rue.lasegue.fr`. Aucune clé ou fonction serveur n’est requise.
