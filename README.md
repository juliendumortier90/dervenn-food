# Dervenn

Application simple pour plusieurs services Dervenn:

- `Dervenn Food / Commande`: creation et suppression des tickets pizza
- `Dervenn Food / Cuisine`: suivi de la file et progression des statuts
- `Dervenn Bike / Counter`: consultation des statistiques du compteur velo

## Structure

- `front`: webapp React + Material UI
- `back`: lambdas TypeScript, authorizer et services DynamoDB
- `iac`: infrastructure AWS CDK

## Statuts

- `A_FAIRE`
- `EN_COURS`
- `PRETE`
- `DELIVREE`

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
2. Renseigner `DERVENN_API_URL`, `DERVENN_BASIC_AUTH_USERNAME`, `DERVENN_FOOD_BASIC_AUTH_PASSWORD` et `DERVENN_BIKE_BASIC_AUTH_PASSWORD`
3. Ouvrir le dossier `bruno/` dans Bruno
4. Selectionner l'environnement `dervennenv`

Variables utiles:

- `DERVENN_BASE_TYPE`: `TOMATE` ou `CREME_FRAICHE`
- `DERVENN_STATUS`: `A_FAIRE`, `EN_COURS`, `PRETE`, `DELIVREE`
- `DERVENN_COMMANDE_NUMBER`: numero de commande cible pour les requetes food

Routes utiles:

- `GET /commandes/pretes`: retourne au maximum 2 commandes `PRETE`, triees par `readyAt` croissant puis `commandeNumber` croissant
- `POST /bike/counter`: ajoute un passage dans la table `dervenn-bike`
- `GET /bike/stats`: retourne le nombre total de passages en base

## Authentification

Le meme authorizer est reutilise pour tous les services:

- identifiant commun: `DERVENN_BASIC_AUTH_USERNAME`
- mot de passe food: `DERVENN_FOOD_BASIC_AUTH_PASSWORD`
- mot de passe bike: `DERVENN_BIKE_BASIC_AUTH_PASSWORD`

```bash
DERVENN_BASIC_AUTH_USERNAME=food \
DERVENN_FOOD_BASIC_AUTH_PASSWORD=xxx \
DERVENN_BIKE_BASIC_AUTH_PASSWORD=yyy \
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

Commande unique depuis la racine apres bootstrap:

```bash
npm run deploy
```

Le stack publie aussi un fichier `runtime-config.json` dans le bucket du front, ce qui permet au front deploye de connaitre automatiquement l'URL de l'API.

## Notes de fonctionnement

- La numerotation des commandes est incrementale et commence a `1`
- Le front ouvre d'abord un formulaire de connexion plein ecran avec selection du service
- `Dervenn Food / Commande` remplace l'ancien libelle `bar`
- L'API food passe par une lambda `commandes`, l'API bike par une lambda dediee
- L'endpoint `GET /commandes/pretes` est prevu pour un afficheur Arduino WiFi qui veut recuperer les 2 prochaines pizzas pretes
- La table DynamoDB bike s'appelle `dervenn-bike`
- L'API est protegee par un authorizer Lambda qui valide l'en-tete `Authorization` selon le service appele
- Le front est servi par S3 + CloudFront


https://d22tdkynjt4wr9.cloudfront.net/
