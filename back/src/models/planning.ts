export interface PlanningEditionSummary {
  editionId: string;
  title: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningBenevole {
  benevoleId: string;
  pseudo: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningCategorie {
  categorieId: string;
  title: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningAffectation {
  affectationId: string;
  benevoleId: string;
  categorieId: string;
  comment?: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningAffectationView extends PlanningAffectation {
  benevole: PlanningBenevole;
  categorie: PlanningCategorie;
}

export interface PlanningEdition extends PlanningEditionSummary {
  benevoles: PlanningBenevole[];
  categories: PlanningCategorie[];
  affectations: PlanningAffectationView[];
}

export interface CreatePlanningEditionInput {
  title: string;
  startAt: string;
  endAt: string;
}

export interface UpdatePlanningEditionInput {
  editionId: string;
  title: string;
  startAt: string;
  endAt: string;
}

export interface CreatePlanningBenevoleInput {
  editionId: string;
  pseudo: string;
  phone: string;
}

export interface UpdatePlanningBenevoleInput extends CreatePlanningBenevoleInput {
  benevoleId: string;
}

export interface CreatePlanningCategorieInput {
  editionId: string;
  title: string;
  color: string;
}

export interface UpdatePlanningCategorieInput extends CreatePlanningCategorieInput {
  categorieId: string;
}

export interface CreatePlanningAffectationInput {
  editionId: string;
  benevoleId: string;
  categorieId: string;
  comment?: string;
  startAt: string;
  endAt: string;
}

export interface DeletePlanningAffectationInput {
  editionId: string;
  affectationId: string;
}

export interface PlanningCategorieSeed {
  title: string;
  color: string;
}

export const DEFAULT_PLANNING_CATEGORIES: PlanningCategorieSeed[] = [
  { title: "Rangement du site", color: "#f48a1f" },
  { title: "Rangement scene concert", color: "#14b885" },
  { title: "Rangement son concert", color: "#2f7cf6" },
  { title: "Vaisselle", color: "#9c5cff" },
  { title: "Bar", color: "#f0526d" },
  { title: "Cuisine", color: "#f2c94c" }
];
