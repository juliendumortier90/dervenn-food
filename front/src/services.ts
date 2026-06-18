import { AppService } from "./types";

interface ServiceMeta {
  applicationName: string;
  description: string;
  screenLabel: string;
  title: string;
}

export const serviceOrder: AppService[] = [
  "planning-public",
  "planning-admin",
  "bike-counter"
];

const serviceMetaByKey: Record<AppService, ServiceMeta> = {
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
  if (service === "planning-public") {
    return "/planning";
  }

  if (service === "planning-admin") {
    return "/planning-admin";
  }

  return "/bike";
}
