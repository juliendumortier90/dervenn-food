import { AppService } from "./types";

interface ServiceMeta {
  applicationName: string;
  description: string;
  screenLabel: string;
  title: string;
}

export const serviceOrder: AppService[] = [
  "food-commande",
  "food-cuisine",
  "planning-public",
  "planning-admin",
  "bike-counter"
];

const serviceMetaByKey: Record<AppService, ServiceMeta> = {
  "food-commande": {
    applicationName: "Dervenn Food",
    description: "Creer et suivre les tickets depuis le poste de prise de commande.",
    screenLabel: "Commande",
    title: "Commande"
  },
  "food-cuisine": {
    applicationName: "Dervenn Food",
    description: "Piloter la file de preparation et faire avancer les statuts.",
    screenLabel: "Cuisine",
    title: "Cuisine"
  },
  "planning-public": {
    applicationName: "Dervenn Planning",
    description: "Consulter le planning benevoles sur toute la periode de l'evenement.",
    screenLabel: "Planning",
    title: "Planning benevoles"
  },
  "planning-admin": {
    applicationName: "Dervenn Planning",
    description: "Construire et modifier les affectations benevoles avec les popups d'administration.",
    screenLabel: "Planning admin",
    title: "Planning benevoles admin"
  },
  "bike-counter": {
    applicationName: "Dervenn Bike",
    description: "Consulter les statistiques du compteur velo securisees par un mot de passe dedie.",
    screenLabel: "Statistiques",
    title: "Counter"
  }
};

export function getServiceMeta(service: AppService): ServiceMeta {
  return serviceMetaByKey[service];
}

export function getServicePath(service: AppService): string {
  if (service === "food-commande") {
    return "/commande";
  }

  if (service === "food-cuisine") {
    return "/cuisine";
  }

  if (service === "planning-public") {
    return "/planning";
  }

  if (service === "planning-admin") {
    return "/planning-admin";
  }

  return "/bike";
}
