export type InvitationContactStatus = "non_contacte" | "premier_contact" | "contacte";
export type InvitationAttendanceStatus = "pas_repondu" | "pas_encore_sur" | "present" | "absent";

export interface InvitationGuest {
  username: string;
  fullName: string;
  profilePictureBase64?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvitationStatus {
  invitationId: string;
  username: string;
  editionId: string;
  contactStatus: InvitationContactStatus;
  attendanceStatus: InvitationAttendanceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvitationGuestWithStatus extends InvitationGuest {
  editionId?: string;
  contactStatus: InvitationContactStatus;
  attendanceStatus: InvitationAttendanceStatus;
  isInvited?: boolean;
  statusUpdatedAt?: string;
}

export interface PaginatedInvitationGuests {
  guests: InvitationGuestWithStatus[];
  nextToken?: string;
}
