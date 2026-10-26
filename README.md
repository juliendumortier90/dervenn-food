# Dervenn Counter

Application du compteur velo Dervenn (`Dervenn Bike / Counter`): consultation des statistiques et de
l'analyse detaillee des passages enregistres par le compteur Arduino.

## Structure

- `front`: webapp React + Material UI (connexion, statistiques, analyse detaillee)
- `back`: lambdas TypeScript (compteur bike, authorizer basic auth) et service DynamoDB
- `iac`: infrastructure AWS CDK
- `dervenn-counter-arduino`: code et documentation du compteur Arduino
- `bruno`: collection Bruno pour tester l'API
- `scripts`: utilitaires (ex: `create_bike_events.py` pour injecter des passages)

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
cp front/.env.example front/.env
npm run dev -w front
```

## Collection Bruno

Une collection Bruno est disponible dans `bruno/`.

1. Copier `bruno/.env.example` vers `bruno/.env`
2. Renseigner `DERVENN_API_URL`, `DERVENN_BASIC_AUTH_USERNAME` et `DERVENN_BASIC_AUTH_PASSWORD`
3. Ouvrir le dossier `bruno/` dans Bruno
4. Selectionner l'environnement `dervennenv`

Variables utiles:

- `bike_count`: nombre de passages a ajouter dans les requetes bike

Routes:

- `POST /bike/counter`: ajoute des passages (utilise par le compteur Arduino)
- `GET /bike/stats`: retourne le nombre total de passages et le compteur de session
- `POST /bike/stats`: recalcule le total depuis les evenements bike
- `GET /bike/history?range=...`: historique agrege des passages
- `GET /bike/events?from=...&to=...&limit=...`: liste des passages sur une periode
- `POST /bike/events`: cree (`create`) ou supprime (`delete`) des passages
- `POST /bike/resetsession`: remet a zero le compteur de session

## Authentification

Toutes les routes `/bike/*` sont protegees par un authorizer Lambda basic auth:

- identifiant: `DERVENN_BASIC_AUTH_USERNAME`
- mot de passe: `DERVENN_BASIC_AUTH_PASSWORD`

Variables optionnelles:

- `DERVENN_ALLOWED_ORIGIN` (defaut: `https://counter.dervenn-trail.org`)
- `DERVENN_FRONT_DOMAIN` et `DERVENN_FRONT_CERTIFICATE_ARN`

## Deploiement

```bash
npm run build
cd iac
npx cdk bootstrap   # si besoin
DERVENN_BASIC_AUTH_USERNAME=food \
DERVENN_BASIC_AUTH_PASSWORD=xxx \
npx cdk deploy
```

Equivalent depuis la racine apres bootstrap:

```bash
DERVENN_BASIC_AUTH_USERNAME=food DERVENN_BASIC_AUTH_PASSWORD=xxx npm run deploy
```

Le stack publie aussi un fichier `runtime-config.json` dans le bucket du front, ce qui permet au front deploye de
connaitre automatiquement l'URL de l'API.

## Notes de fonctionnement

- Le front ouvre directement l'ecran de connexion du compteur, puis les statistiques (`/bike`) et l'analyse (`/bike/analyse`)
- L'API bike passe par une lambda dediee
- Les tables DynamoDB s'appellent `dervenn-bike-events` et `dervenn-bike-stats`
- Le front est servi par S3 + CloudFront: https://counter.dervenn-trail.org
