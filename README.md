# Dervenn Food

Application simple de gestion des pizzas pour festival:

- ecran bar pour encaisser et creer une commande numerotee automatiquement
- ecran cuisine pour suivre la file d'attente et faire avancer les statuts
- ecran affichage pour montrer les numeros prets a etre livres

## Structure

- `front`: webapp React + Material UI
- `back`: lambda metier TypeScript, authorizer et services DynamoDB
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
2. Renseigner `FESTIVAL_API_URL`, `FESTIVAL_BASIC_AUTH_USERNAME` et `FESTIVAL_BASIC_AUTH_PASSWORD`
3. Ouvrir le dossier `bruno/` dans Bruno
4. Selectionner l'environnement `local`

Variables utiles:

- `FESTIVAL_BASE_TYPE`: `TOMATE` ou `CREME_FRAICHE`
- `FESTIVAL_STATUS`: `A_FAIRE`, `EN_COURS`, `PRETE`, `DELIVREE`
- `FESTIVAL_COMMANDE_NUMBER`: numero de commande cible pour les requetes POST

Requete Arduino utile:

- `GET /commandes/pretes`: retourne au maximum 2 commandes avec le statut `PRETE`, triees par `readyAt` croissant puis par `commandeNumber` croissant

## Variables d'infrastructure

Le stack CDK attend ces variables d'environnement:

```bash
FESTIVAL_BASIC_AUTH_USERNAME "food" FESTIVAL_BASIC_AUTH_PASSWORD "xxx" npm run deploy
```


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
- Le front demande l'identifiant et le mot de passe Basic Auth a l'ouverture
- L'API metier passe par une seule lambda qui route en interne selon la methode HTTP et `action`
- L'endpoint `GET /commandes/pretes` est prevu pour un afficheur Arduino WiFi qui veut recuperer les 2 prochaines pizzas pretes
- L'API est protegee par un authorizer Lambda qui valide l'en-tete `Authorization`
- Le front est servi par S3 + CloudFront


https://d22tdkynjt4wr9.cloudfront.net/
