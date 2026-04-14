# Fonctionnement de `digit-10-merged.ino`

## Role
Le programme `digit-10-merged.ino` affiche en temps reel les compteurs velo via UDP local, puis resynchronise les statistiques depuis le backend toutes les 5 minutes.

## Materiel et broches
- Carte cible: `Arduino UNO R4 WiFi`
- Afficheur LED: `DATA_PIN=10`
- Bouton reset session: `PIN_REMOTE_RESET_BUTTON=8`, actif a l'etat bas

## WiFi
- SSID: `AndroidAP`
- Mot de passe: `totototo`

## Reseau local
- Port UDP ecoute digit: `4210`
- Message attendu depuis `counter`: `BIKE:1`

## Serveur
- Sync stats: `GET https://n4l6c21u76.execute-api.eu-west-3.amazonaws.com/prod/bike/stats`
- Reset session: `POST https://n4l6c21u76.execute-api.eu-west-3.amazonaws.com/prod/bike/resetsession`
- Header `Authorization: Basic Zm9vZDpwZXBkZXV4`

## Boucle principale
- Maintient la connexion WiFi.
- Ecoute les paquets UDP et incremente immediatement `totalCount` et `sessionCount`.
- Fait une resynchronisation distante toutes les 5 minutes.
- Si le bouton de la broche 8 est maintenu, les chiffres allumes clignotent en vert puis en rouge a partir de 10 secondes.
- Si le bouton est relache apres 10 secondes, le `POST /bike/resetsession` est appele.
