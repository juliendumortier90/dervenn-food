# Fonctionnement de `counter.ino`

## Role
Le programme `counter.ino` detecte les passages de velos, notifie immediatement l'afficheur `digit` en UDP local, puis envoie le cumul des detections au serveur toutes les 10 secondes.

## Materiel et broches
- Carte cible: `Arduino UNO R4 WiFi`
- Capteur analogique: `SENSOR_PIN=A0`
- Seuil de detection: `DETECTION_THRESHOLD=114`
- Anti-rebond temporel: `MIN_DELAY_BETWEEN_BIKES=800ms`

## WiFi
- SSID: `AndroidAP`
- Mot de passe: `totototo`

## Reseau local
- Port UDP ecoute local counter: `4211`
- Port UDP cible digit: `4210`
- Message envoye a chaque detection: `BIKE:1`

## Serveur
- Endpoint batch: `POST https://n4l6c21u76.execute-api.eu-west-3.amazonaws.com/prod/bike/counter`
- Header `Authorization: Basic Zm9vZDpwZXBkZXV4`
- Body: un entier brut correspondant au nombre de detections a ajouter

## Boucle principale
- Maintient la connexion WiFi.
- Incremente `pendingBikeCount` a chaque detection.
- Envoie immediatement un paquet UDP au `digit`.
- Flush `pendingBikeCount` toutes les 10 secondes vers le backend.
