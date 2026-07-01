export type AppService =
  | "planning-public"
  | "planning-admin"
  | "bike-counter"
  | "invitation-guests";

export interface BikeCounterStats {
  totalCount: number;
  sessionCount: number;
}

export interface BikeCounterEntry {
  id: string;
  createdAt: string;
}

export type BikeHistoryRange = "10years" | "5years" | "2years" | "year" | "6months" | "month";
export type BikeHistoryBucketUnit = "year" | "month" | "day";

export interface BikeCounterHistoryBucket {
  startAt: string;
  endAt: string;
  count: number;
}

export interface BikeCounterHistory {
  range: BikeHistoryRange;
  bucketUnit: BikeHistoryBucketUnit;
  from: string;
  to: string;
  totalCount: number;
  peakCount: number;
  buckets: BikeCounterHistoryBucket[];
  activityDays?: BikeCounterHistoryBucket[];
}

export interface InvitationGuest {
  username: string;
  fullName: string;
  profilePictureBase64?: string;
  editionId?: string;
  contactStatus: InvitationContactStatus;
  attendanceStatus: InvitationAttendanceStatus;
  isInvited?: boolean;
  statusUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InvitationContactStatus = "non_contacte" | "premier_contact" | "contacte";
export type InvitationAttendanceStatus = "pas_repondu" | "pas_encore_sur" | "present" | "absent";
export type InvitationMembershipFilter = "all" | "invited" | "not_invited";

export interface InvitationGuestFilters {
  editionId?: string;
  contactStatus?: InvitationContactStatus;
  attendanceStatus?: InvitationAttendanceStatus;
  invitationFilter?: InvitationMembershipFilter;
  invitedOnly?: boolean;
  limit?: number;
  nextToken?: string;
}

export interface PaginatedInvitationGuests {
  guests: InvitationGuest[];
  nextToken?: string;
}

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
  benevole: PlanningBenevole;
  categorie: PlanningCategorie;
}

export interface PlanningEdition extends PlanningEditionSummary {
  benevoles: PlanningBenevole[];
  categories: PlanningCategorie[];
  affectations: PlanningAffectation[];
}
