import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  getInvitationGuests,
  getPlanningEditions,
  inviteGuestToEdition,
  uninviteGuestFromEdition,
  updateInvitationGuestStatus
} from "../api";
import {
  InvitationAttendanceStatus,
  InvitationContactStatus,
  InvitationGuest,
  InvitationMembershipFilter,
  PlanningEditionSummary
} from "../types";

interface InvitationGuestsScreenProps {
  onAuthenticationInvalid: () => void;
}

type FilterValue<T extends string> = T | "";
type InvitationView = "users" | "edition";
type SelectChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

const CONTACT_STATUS_OPTIONS: { label: string; value: InvitationContactStatus }[] = [
  { label: "Non contacte", value: "non_contacte" },
  { label: "Premier contact", value: "premier_contact" },
  { label: "Contacte", value: "contacte" }
];

const ATTENDANCE_STATUS_OPTIONS: { label: string; value: InvitationAttendanceStatus }[] = [
  { label: "Pas repondu", value: "pas_repondu" },
  { label: "Pas encore sur", value: "pas_encore_sur" },
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" }
];
const MEMBERSHIP_FILTER_OPTIONS: { label: string; value: InvitationMembershipFilter }[] = [
  { label: "Tous", value: "all" },
  { label: "Non invites", value: "not_invited" },
  { label: "Deja invites", value: "invited" }
];
const INVITATION_PAGE_LIMIT = 100;

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getInstagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}`;
}

function getProfilePictureSource(profilePictureBase64?: string): string | undefined {
  if (!profilePictureBase64) {
    return undefined;
  }

  return profilePictureBase64.startsWith("data:")
    ? profilePictureBase64
    : `data:image/jpeg;base64,${profilePictureBase64}`;
}

function getContactStatusLabel(value: InvitationContactStatus): string {
  return CONTACT_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getAttendanceStatusLabel(value: InvitationAttendanceStatus): string {
  return ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function InvitationGuestsScreen({ onAuthenticationInvalid }: InvitationGuestsScreenProps) {
  const [view, setView] = useState<InvitationView>("users");
  const [editions, setEditions] = useState<PlanningEditionSummary[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [membershipFilter, setMembershipFilter] = useState<InvitationMembershipFilter>("all");
  const [contactStatus, setContactStatus] = useState<FilterValue<InvitationContactStatus>>("");
  const [attendanceStatus, setAttendanceStatus] = useState<FilterValue<InvitationAttendanceStatus>>("");
  const [guests, setGuests] = useState<InvitationGuest[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [processingUsername, setProcessingUsername] = useState("");
  const [isLoadingEditions, setIsLoadingEditions] = useState(false);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function reloadEditions(): Promise<void> {
      setIsLoadingEditions(true);

      try {
        const nextEditions = await getPlanningEditions(true);

        if (!isMounted) {
          return;
        }

        setEditions(nextEditions);
        setSelectedEditionId((current) => current || (nextEditions[0]?.editionId ?? ""));
        setError("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";

        if (isMounted) {
          setError(message);
        }

        if (message === "Authentification invalide") {
          onAuthenticationInvalid();
        }
      } finally {
        if (isMounted) {
          setIsLoadingEditions(false);
        }
      }
    }

    void reloadEditions();

    return () => {
      isMounted = false;
    };
  }, [onAuthenticationInvalid]);

  async function loadGuestsPage(append: boolean): Promise<void> {
    if (view === "edition" && !selectedEditionId) {
      setGuests([]);
      setNextToken(undefined);
      return;
    }

    if (append && !nextToken) {
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingGuests(true);
      setNextToken(undefined);
    }

    try {
      const response = await getInvitationGuests({
        editionId: selectedEditionId || undefined,
        invitationFilter: view === "users" ? membershipFilter : undefined,
        invitedOnly: view === "edition",
        contactStatus: view === "edition" ? contactStatus || undefined : undefined,
        attendanceStatus: view === "edition" ? attendanceStatus || undefined : undefined,
        limit: INVITATION_PAGE_LIMIT,
        nextToken: append ? nextToken : undefined
      });

      setGuests((current) => append ? [...current, ...response.guests] : response.guests);
      setNextToken(response.nextToken);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);

      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoadingGuests(false);
      }
    }
  }

  useEffect(() => {
    void loadGuestsPage(false);
  }, [view, selectedEditionId, membershipFilter, contactStatus, attendanceStatus]);

  async function handleInvite(username: string): Promise<void> {
    if (!selectedEditionId || processingUsername) {
      return;
    }

    setProcessingUsername(username);

    try {
      await inviteGuestToEdition(username, selectedEditionId);
      setGuests((current) =>
        current
          .map((guest) =>
            guest.username === username
              ? {
                ...guest,
                editionId: selectedEditionId,
                isInvited: true,
                contactStatus: "non_contacte" as InvitationContactStatus,
                attendanceStatus: "pas_repondu" as InvitationAttendanceStatus
              }
              : guest
          )
          .filter((guest) => membershipFilter !== "not_invited" || guest.username !== username)
      );
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setProcessingUsername("");
    }
  }

  async function handleUninvite(username: string): Promise<void> {
    if (!selectedEditionId || processingUsername) {
      return;
    }

    setProcessingUsername(username);

    try {
      await uninviteGuestFromEdition(username, selectedEditionId);
      setGuests((current) => current.filter((guest) => guest.username !== username));
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setProcessingUsername("");
    }
  }

  async function handleStatusChange(
    guest: InvitationGuest,
    nextContactStatus: InvitationContactStatus,
    nextAttendanceStatus: InvitationAttendanceStatus
  ): Promise<void> {
    if (!selectedEditionId || processingUsername) {
      return;
    }

    setProcessingUsername(guest.username);

    try {
      await updateInvitationGuestStatus(guest.username, selectedEditionId, nextContactStatus, nextAttendanceStatus);
      setGuests((current) =>
        current.map((candidate) =>
          candidate.username === guest.username
            ? { ...candidate, contactStatus: nextContactStatus, attendanceStatus: nextAttendanceStatus }
            : candidate
        )
      );
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setProcessingUsername("");
    }
  }

  const isLoading = isLoadingEditions || isLoadingGuests;
  const selectedEditionTitle = editions.find((edition) => edition.editionId === selectedEditionId)?.title ?? "edition";

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }} justifyContent="space-between">
        <Box>
          <Typography variant="h3">{view === "users" ? "Utilisateurs" : "Invitations"}</Typography>
          <Typography color="text.secondary">
            {view === "users"
              ? `${guests.length} utilisateur${guests.length > 1 ? "s" : ""} affiche${guests.length > 1 ? "s" : ""}.`
              : `${guests.length} invitation${guests.length > 1 ? "s" : ""} affiche${guests.length > 1 ? "es" : "e"} pour ${selectedEditionTitle}.`}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ minWidth: { lg: view === "edition" ? 920 : 820 } }}>
          <Button
            onClick={() => setView("users")}
            variant={view === "users" ? "contained" : "outlined"}
          >
            Tous les utilisateurs
          </Button>
          <Button
            onClick={() => setView("edition")}
            variant={view === "edition" ? "contained" : "outlined"}
          >
            Invitations edition
          </Button>
          <TextField
            label="Edition"
            onChange={(event: SelectChangeEvent) => setSelectedEditionId(event.target.value)}
            select
            SelectProps={{ native: true }}
            size="small"
            value={selectedEditionId}
            sx={{ minWidth: { sm: 220 }, flex: 1 }}
          >
            <option value="">Choisir une edition</option>
            {editions.map((edition) => (
              <option key={edition.editionId} value={edition.editionId}>
                {edition.title}
              </option>
            ))}
          </TextField>
          {view === "edition" ? (
            <>
              <TextField
                label="Contact"
                onChange={(event: SelectChangeEvent) => setContactStatus(event.target.value as FilterValue<InvitationContactStatus>)}
                select
                SelectProps={{ native: true }}
                size="small"
                value={contactStatus}
                sx={{ minWidth: { sm: 180 }, flex: 1 }}
              >
                <option value="">Tous</option>
                {CONTACT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>
              <TextField
                label="Presence"
                onChange={(event: SelectChangeEvent) => setAttendanceStatus(event.target.value as FilterValue<InvitationAttendanceStatus>)}
                select
                SelectProps={{ native: true }}
                size="small"
                value={attendanceStatus}
                sx={{ minWidth: { sm: 190 }, flex: 1 }}
              >
                <option value="">Tous</option>
                {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>
            </>
          ) : (
            <TextField
              label="Invitation"
              onChange={(event: SelectChangeEvent) => setMembershipFilter(event.target.value as InvitationMembershipFilter)}
              select
              SelectProps={{ native: true }}
              size="small"
              value={membershipFilter}
              sx={{ minWidth: { sm: 170 }, flex: 1 }}
            >
              {MEMBERSHIP_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </TextField>
          )}
          <Button
            disabled={isLoading || (view === "edition" && !selectedEditionId)}
            onClick={() => {
              void loadGuestsPage(false);
            }}
            startIcon={isLoadingGuests ? <CircularProgress color="inherit" size={18} /> : <RefreshRoundedIcon />}
            variant="outlined"
            sx={{ minHeight: 40 }}
          >
            Actualiser
          </Button>
        </Stack>
      </Stack>

      {isLoading && guests.length === 0 ? (
        <Card>
          <CardContent sx={{ minHeight: 220, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </CardContent>
        </Card>
      ) : view === "edition" && !selectedEditionId ? (
        <Card>
          <CardContent sx={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <AccountCircleRoundedIcon color="primary" sx={{ fontSize: 52 }} />
              <Typography variant="h5">Selectionner une edition</Typography>
              <Typography color="text.secondary">Les invitations sont rattachees a une edition planning.</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : guests.length === 0 ? (
        <Card>
          <CardContent sx={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <AccountCircleRoundedIcon color="primary" sx={{ fontSize: 52 }} />
              <Typography variant="h5">Aucun resultat</Typography>
              <Typography color="text.secondary">Modifier les filtres ou charger une autre edition.</Typography>
              {nextToken ? (
                <Button
                  disabled={isLoadingMore}
                  onClick={() => {
                    void loadGuestsPage(true);
                  }}
                  startIcon={isLoadingMore ? <CircularProgress color="inherit" size={18} /> : undefined}
                  variant="outlined"
                >
                  Continuer la recherche
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" },
              gap: 2
            }}
          >
            {guests.map((guest) => {
              const isProcessing = processingUsername === guest.username;

              return (
                <Card
                  key={guest.username}
                  onClick={view === "users" && !guest.isInvited ? () => void handleInvite(guest.username) : undefined}
                  sx={{ cursor: view === "users" && selectedEditionId && !guest.isInvited ? "pointer" : "default" }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          alt={guest.fullName}
                          src={getProfilePictureSource(guest.profilePictureBase64)}
                          sx={{ width: 58, height: 58, bgcolor: "primary.dark", color: "common.white", flexShrink: 0 }}
                        >
                          {getInitials(guest.fullName)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
                            {guest.fullName}
                          </Typography>
                          <Typography color="text.secondary" noWrap>
                            @{guest.username}
                          </Typography>
                        </Box>
                        <Button
                          aria-label={`Ouvrir ${guest.fullName}`}
                          href={getInstagramProfileUrl(guest.username)}
                          rel="noreferrer"
                          target="_blank"
                          onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
                          sx={{ minWidth: 42, width: 42, height: 42, p: 0, flexShrink: 0 }}
                          variant="outlined"
                        >
                          <LaunchRoundedIcon fontSize="small" />
                        </Button>
                      </Stack>

                      {view === "users" ? (
                        <Stack spacing={1}>
                          {guest.isInvited ? (
                            <Chip label={`Deja invite a ${selectedEditionTitle}`} color="secondary" variant="outlined" />
                          ) : null}
                          <Button
                            disabled={!selectedEditionId || isProcessing || guest.isInvited}
                            onClick={(event: MouseEvent<HTMLButtonElement>) => {
                              event.stopPropagation();
                              void handleInvite(guest.username);
                            }}
                            variant="contained"
                          >
                            {guest.isInvited
                              ? "Deja invite"
                              : isProcessing
                                ? "Invitation..."
                                : `Inviter a ${selectedEditionTitle}`}
                          </Button>
                        </Stack>
                      ) : (
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={getContactStatusLabel(guest.contactStatus)} color="primary" variant="outlined" />
                            <Chip label={getAttendanceStatusLabel(guest.attendanceStatus)} color="secondary" variant="outlined" />
                          </Stack>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <TextField
                              label="Contact"
                              onChange={(event: SelectChangeEvent) => {
                                void handleStatusChange(
                                  guest,
                                  event.target.value as InvitationContactStatus,
                                  guest.attendanceStatus
                                );
                              }}
                              select
                              SelectProps={{ native: true }}
                              size="small"
                              value={guest.contactStatus}
                              sx={{ flex: 1 }}
                            >
                              {CONTACT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </TextField>
                            <TextField
                              label="Presence"
                              onChange={(event: SelectChangeEvent) => {
                                void handleStatusChange(
                                  guest,
                                  guest.contactStatus,
                                  event.target.value as InvitationAttendanceStatus
                                );
                              }}
                              select
                              SelectProps={{ native: true }}
                              size="small"
                              value={guest.attendanceStatus}
                              sx={{ flex: 1 }}
                            >
                              {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </TextField>
                          </Stack>
                          <Button
                            color="error"
                            disabled={isProcessing}
                            onClick={() => {
                              void handleUninvite(guest.username);
                            }}
                            variant="outlined"
                          >
                            {isProcessing ? "Suppression..." : "Desinviter"}
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
          {nextToken ? (
            <Stack direction="row" justifyContent="center">
              <Button
                disabled={isLoadingMore}
                onClick={() => {
                  void loadGuestsPage(true);
                }}
                startIcon={isLoadingMore ? <CircularProgress color="inherit" size={18} /> : undefined}
                variant="outlined"
              >
                Charger plus
              </Button>
            </Stack>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}
