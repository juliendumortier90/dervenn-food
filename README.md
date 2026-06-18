# Dervenn

Application simple pour plusieurs services Dervenn:

- `Dervenn Planning / Planning benevoles`: consultation du planning benevoles en lecture seule
- `Dervenn Planning / Planning benevoles admin`: creation des editions, benevoles, categories et affectations
- `Dervenn Bike / Counter`: consultation des statistiques du compteur velo

## Structure

- `front`: webapp React + Material UI
- `back`: lambdas TypeScript, authorizer et services DynamoDB
- `iac`: infrastructure AWS CDK

## Demarrage local

Prerequis a installer sur la machine:

- Git
- Node.js 20+
- npm 10+
- AWS CDK (`npm install -g aws-cdk`)

Installation:

```bash
npm install
```

Build complet:

```bash
npm run build
```

Lancer le front en local:

```bash
npm run dev -w front
```

Fichier d'exemple front:

```bash
copy front\\.env.example front\\.env
```

## Collection Bruno

Une collection Bruno est disponible dans `bruno/`.

1. Copier `bruno/.env.example` vers `bruno/.env`
2. Renseigner `DERVENN_API_URL`, `DERVENN_BASIC_AUTH_USERNAME`, `DERVENN_PUBLIC_BASIC_AUTH_PASSWORD` et `DERVENN_ADMIN_BASIC_AUTH_PASSWORD`
3. Ouvrir le dossier `bruno/` dans Bruno
4. Selectionner l'environnement `dervennenv`

Variables utiles:

- `bike_count`: nombre de passages a ajouter dans les requetes bike

Routes utiles:

- `GET /planning/editions`: liste les editions planning disponibles en lecture seule
- `GET /planning/editions/{editionId}`: retourne une edition planning avec benevoles, categories et affectations peuplees
- `POST /planning/admin/editions`: cree une edition et ses categories par defaut
- `POST /planning/admin/editions/{editionId}`: cree ou met a jour les entites planning selon l'action demandee
- `POST /bike/counter`: ajoute un passage dans la table `dervenn-bike`
- `GET /bike/stats`: retourne le nombre total de passages en base
- `POST /bike/stats`: recalcule le total depuis les evenements bike

## Authentification

Le meme authorizer est reutilise pour tous les services:

- identifiant commun: `DERVENN_BASIC_AUTH_USERNAME`
- mot de passe public: `DERVENN_PUBLIC_BASIC_AUTH_PASSWORD`
- mot de passe admin: `DERVENN_ADMIN_BASIC_AUTH_PASSWORD`

```bash
DERVENN_BASIC_AUTH_USERNAME=dervenn \
DERVENN_PUBLIC_BASIC_AUTH_PASSWORD=xxx \
DERVENN_ADMIN_BASIC_AUTH_PASSWORD=yyy \
npm run deploy
```

Variable optionnelle:

- `DERVENN_ALLOWED_ORIGIN`

## Deploiement

1. Builder le back et le front
2. Bootstrap CDK si besoin
3. Deployer le stack

```bash
npm run build
cd iac
npx cdk bootstrap
npx cdk deploy
```

Equivalent depuis la racine apres bootstrap:

```bash
npm run deploy
```

Le stack publie aussi un fichier `runtime-config.json` dans le bucket du front, ce qui permet au front deploye de connaitre automatiquement l'URL de l'API.

## Notes de fonctionnement

- Le front ouvre d'abord une page de choix du service, puis un ecran de connexion contextuel
- L'API bike passe par une lambda dediee et le planning par une lambda `planning`
- Les tables DynamoDB bike s'appellent `dervenn-bike-events` et `dervenn-bike-stats`
- La table DynamoDB planning s'appelle `dervenn-planning`
- L'API est protegee par un authorizer Lambda qui valide l'en-tete `Authorization` selon le service appele
- Le front est servi par S3 + CloudFront


https://d22tdkynjt4wr9.cloudfront.net/
