# Publier kifaitpipi sur Cloudflare Pages

Objectif : **https://kifaitpipi.rue.lasegue.fr**. Application entièrement statique : aucune fonction Cloudflare, aucun serveur Node en production, aucun secret et aucune base de données. Les rues, bâtiments, parcelles et polices sont embarqués. Le chargement ponctuel des sources depuis Méthodologie est facultatif.

## Option 1 — Import direct, sans sources ni npm sur votre Mac

Téléchargez `kifaitpipi-cloudflare.zip`, qui contient la version compilée à la racine. Dans Cloudflare, allez dans **Workers & Pages**, créez une application **Pages** avec l’option d’import direct des fichiers et nommez le projet `kifaitpipi`. Importez l’archive ZIP, ou décompressez-la et importez le contenu. L’import doit placer `index.html`, `assets/`, `data/`, `_headers` et `_redirects` à la racine du site (pas dans un sous-dossier `dist/`).

Cloudflare affichera l’adresse `*.pages.dev` réellement attribuée à votre projet. Testez cette adresse avant d’associer votre domaine. Un projet créé par import direct ne peut pas ensuite être converti en projet d’intégration Git ; choisissez l’option 2 dès maintenant si vous préférez des déploiements automatiques.

## Option 2 — Déploiement automatique depuis GitHub

Ajoutez les fichiers du projet au dépôt `apeyroux/kifaitpipi`, y compris `public/data/chatillon.json` et `public/data/parcels.json`. Connectez le dépôt à **Cloudflare Pages**.

| Réglage | Valeur |
| --- | --- |
| Branche de production | `main` |
| Répertoire racine | Racine du dépôt |
| Framework | Vite, ou aucun preset |
| Commande de build | `npm run build:pages` |
| Dossier de sortie | `dist` |
| Version Node | `24`, variable de build `NODE_VERSION` si nécessaire |

Cloudflare installe les dépendances à partir de `package-lock.json`. Les commandes de récupération de données ne sont pas nécessaires durant le build : les jeux déjà vérifiés sont présents dans `public/data/`. Ils peuvent être actualisés localement puis inclus dans un nouveau déploiement.

## Associer le domaine

1. Dans le projet Pages, ouvrez **Custom domains / Domaines personnalisés** et ajoutez `kifaitpipi.rue.lasegue.fr`.
2. Si la zone DNS `lasegue.fr` est gérée par Cloudflare, laissez l’assistant créer le CNAME approprié. Sinon, créez chez votre fournisseur DNS un **CNAME** nommé `kifaitpipi.rue` (dans la zone `lasegue.fr`) pointant vers l’adresse `*.pages.dev` affichée par Cloudflare. Si vous gérez une zone distincte `rue.lasegue.fr`, le nom est simplement `kifaitpipi`.
3. Attendez que Cloudflare confirme la validation du domaine et le certificat HTTPS, puis testez `https://kifaitpipi.rue.lasegue.fr`.

Ajoutez toujours le domaine dans Pages avant de créer manuellement son CNAME. N’utilisez pas les IP privées du serveur cloud : elles ne servent pas à la publication.

## Publication par script

Le projet existant peut être mis à jour sans importer de ZIP dans le navigateur :

```sh
npx wrangler@4.146.0 login --scopes account:read user:read pages:write
npm run deploy:cloudflare
```

La connexion est nécessaire une seule fois. Le script reconstruit l’application, vérifie les limites Pages et publie `dist/` sur la branche de production `main` du projet `kifaitpipi`. Pour une exécution automatisée, fournissez `CLOUDFLARE_API_TOKEN` avec le droit Cloudflare Pages Edit ; ne stockez pas le jeton dans le dépôt. `CLOUDFLARE_ACCOUNT_ID` permet de remplacer le compte et `WRANGLER_CLI` de fournir le chemin d’une installation existante de Wrangler.

## Reconstruire l’archive localement

Dans le dossier du projet, avec Node 24 :

```sh
npm ci
npm test
npm run build:pages
```

Importez ensuite le contenu de `dist/`. Les limites Cloudflare Pages (25 MiB par fichier, 20 000 fichiers) sont vérifiées par le script ; le plus gros fichier de données reste inférieur à 25 MiB. Le fichier `_redirects` fournit le repli vers `index.html`, et `_headers` gère le cache des assets et des données.

## Vérification après publication

- Le titre est « kifaitpipi — Les promenades de Châtillon ».
- Le statut indique le cadastre réel, les quatre couches sont accessibles et la ville s’affiche.
- Cliquez dans une parcelle, vérifiez sa référence et le graphique horaire.
- Lancez la lecture : l’heure et les flux évoluent ; mettez en pause et changez l’heure.
- Testez sur mobile, puis consultez les sources dans Méthodologie.

Le projet Cloudflare Pages `kifaitpipi` a été créé et déployé le 2 octobre 2026 par import direct de `dist/` (23 fichiers). Adresse de production : https://kifaitpipi.pages.dev. Le domaine `kifaitpipi.rue.lasegue.fr` est associé au projet ; le CNAME `kifaitpipi.rue` vers `kifaitpipi.pages.dev` a été créé dans la zone `lasegue.fr`. Cloudflare confirme le domaine Actif et SSL activé ; la réponse HTTPS de l’adresse finale a été vérifiée. La version publiée inclut le rayon de 5 m, les halos pastel et les défécations simulées.
