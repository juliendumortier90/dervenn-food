import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import type { ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useState } from "react";
import { addCommande, deleteCommande } from "../api";
import { Commande } from "../types";

interface CommandeScreenProps {
  commandes: Commande[];
  onCommandeUpdated: (commande: Commande) => void;
  onCommandeDeleted: (commandeNumber: number) => void;
  error: string;
}

type BaseChoice = "CREME_FRAICHE" | "TOMATE";

const statusMeta = {
  A_FAIRE: {
    label: "A faire",
    color: "#f7a728"
  },
  EN_COURS: {
    label: "En cours",
    color: "#8a5cff"
  },
  PRETE: {
    label: "Prete",
    color: "#14b885"
  },
  DELIVREE: {
    label: "Delivree",
    color: "#34a2ff"
  }
} as const;

function normalizeCommandeNumber(value: string): number {
  return Number(value.trim());
}

function getCommandeMeta(commande: Commande) {
  return {
    accent: statusMeta[commande.status].color,
    statusLabel: statusMeta[commande.status].label,
    baseLabel: commande.baseType === "TOMATE" ? "Tomate" : "Creme"
  };
}

export function CommandeScreen({
  commandes,
  onCommandeUpdated,
  onCommandeDeleted,
  error
}: CommandeScreenProps) {
  const [commandeNumber, setCommandeNumber] = useState("");
  const [comment, setComment] = useState("");
  const [pendingDeleteNumber, setPendingDeleteNumber] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pendingBaseType, setPendingBaseType] = useState<BaseChoice | null>(null);
  const [confirmOutOfSequenceOpen, setConfirmOutOfSequenceOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [duplicateErrorOpen, setDuplicateErrorOpen] = useState(false);
  const [deleteStartedErrorOpen, setDeleteStartedErrorOpen] = useState(false);
  const pendingCount = commandes.filter((commande) => commande.status !== "DELIVREE").length;
  const parsedCommandeNumber = normalizeCommandeNumber(commandeNumber);
  const hasValidCommandeNumber = Number.isInteger(parsedCommandeNumber) && parsedCommandeNumber >= 1;
  const recentCommandes = commandes.slice(-15).reverse();
  const recentCommandesTitle =
    recentCommandes.length < 15 ? `${recentCommandes.length} dernieres commandes` : "15 dernieres commandes";
  const lastCommandeNumber =
    commandes.length === 0 ? 0 : Math.max(...commandes.map((commande) => commande.commandeNumber));
  const expectedCommandeNumber = lastCommandeNumber + 1;

  function resetCreateForm(): void {
    setCommandeNumber("");
    setComment("");
    setPendingBaseType(null);
    setConfirmOutOfSequenceOpen(false);
  }

  function openCreateConfirmation(baseType: BaseChoice): void {
    if (!Number.isInteger(parsedCommandeNumber) || parsedCommandeNumber < 1) {
      setFeedback("Le numero de commande doit etre un entier positif.");
      return;
    }

    setFeedback("");
    setPendingBaseType(baseType);
  }

  async function createCommandeWithConfirmation(): Promise<void> {
    if (!pendingBaseType) {
      return;
    }

    setIsSubmitting(true);
    try {
      const commande = await addCommande(parsedCommandeNumber, pendingBaseType, comment);
      onCommandeUpdated(commande);
      setFeedback(`Commande #${commande.commandeNumber} creee`);
      resetCreateForm();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Erreur inconnue";
      if (message.includes("already exists")) {
        setPendingBaseType(null);
        setConfirmOutOfSequenceOpen(false);
        setDuplicateErrorOpen(true);
      } else {
        setFeedback(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmedAdd(): Promise<void> {
    if (parsedCommandeNumber !== expectedCommandeNumber) {
      setConfirmOutOfSequenceOpen(true);
      return;
    }

    await createCommandeWithConfirmation();
  }

  function openDeleteConfirmation(commandeNumberToDelete: number): void {
    setPendingDeleteNumber(commandeNumberToDelete);
    setDeleteConfirmationInput("");
    setConfirmDeleteOpen(true);
  }

  async function handleConfirmedDelete(): Promise<void> {
    if (pendingDeleteNumber == null) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCommande(pendingDeleteNumber);
      onCommandeDeleted(pendingDeleteNumber);
      setFeedback(`Commande #${pendingDeleteNumber} supprimee`);
      setPendingDeleteNumber(null);
      setDeleteConfirmationInput("");
      setConfirmDeleteOpen(false);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Erreur inconnue";
      if (message.includes("cannot be deleted")) {
        setConfirmDeleteOpen(false);
        setDeleteStartedErrorOpen(true);
      } else if (message.includes("not found")) {
        setFeedback("Cette commande est introuvable.");
      } else {
        setFeedback(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              height: "100%",
              minHeight: 312,
              overflow: "hidden",
              position: "relative",
              background:
                "radial-gradient(circle at 75% 35%, rgba(255,147,42,0.2), transparent 22%), linear-gradient(180deg, rgba(42,19,20,0.98) 0%, rgba(20,14,29,0.98) 100%)"
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: "24% -8% auto auto",
                width: 220,
                height: 220,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,149,56,0.82), rgba(154,61,12,0.45) 62%, rgba(0,0,0,0) 68%)",
                opacity: 0.6
              }}
            />
            <CardContent sx={{ height: "100%", p: 3.5, position: "relative" }}>
              <Stack justifyContent="space-between" sx={{ height: "100%" }}>
                <Box>
                  <Typography
                    variant="h1"
                    sx={{ color: "primary.light", fontSize: { xs: "4.2rem", md: "5rem" }, lineHeight: 1 }}
                  >
                    {pendingCount}
                  </Typography>
                  <Typography variant="h5" sx={{ maxWidth: 220 }}>
                    pizzas encore dans le circuit
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#ff8a4d" }}>
                  <LocalFireDepartmentRoundedIcon fontSize="small" />
                  <Typography sx={{ fontWeight: 700 }}>Chaud devant !</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={3}>
                <Box sx={{ pl: 2, borderLeft: "4px solid", borderColor: "primary.main" }}>
                  <Typography variant="h4">Nouvelle commande</Typography>
                  <Typography color="text.secondary">
                    Le numero est saisi au bar puis envoye en cuisine apres confirmation.
                  </Typography>
                </Box>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {feedback ? <Alert severity="info">{feedback}</Alert> : null}
                <TextField
                  label="Numero de commande"
                  placeholder="Ex: 42"
                  value={commandeNumber}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setCommandeNumber(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Commentaire"
                  placeholder="Ex: sans champignon"
                  value={comment}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setComment(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    size="large"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting || !hasValidCommandeNumber}
                    onClick={() => openCreateConfirmation("CREME_FRAICHE")}
                  >
                    Ajouter creme fraiche
                  </Button>
                  <Button
                    size="large"
                    variant="contained"
                    color="secondary"
                    disabled={isSubmitting || !hasValidCommandeNumber}
                    onClick={() => openCreateConfirmation("TOMATE")}
                  >
                    Ajouter tomate
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={12}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack spacing={2}>
                <Typography variant="h5">{recentCommandesTitle}</Typography>
                <Stack spacing={1.5}>
                  {recentCommandes.map((commande) => {
                    const meta = getCommandeMeta(commande);

                    return (
                      <Box
                        key={commande.commandeNumber}
                        sx={{
                          p: 2,
                          borderRadius: 4,
                          border: "1px solid rgba(158, 176, 214, 0.12)",
                          background: "rgba(12, 19, 35, 0.7)"
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "flex-start", md: "center" }}
                          justifyContent="space-between"
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 4,
                                alignSelf: "stretch",
                                borderRadius: 999,
                                backgroundColor: meta.accent
                              }}
                            />
                            <Stack spacing={0.5}>
                              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="h6" sx={{ color: meta.accent }}>
                                  #{commande.commandeNumber}
                                </Typography>
                                <Typography>{meta.baseLabel}</Typography>
                                <Typography color="text.secondary">{meta.statusLabel}</Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                                <ScheduleRoundedIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">
                                  {new Date(commande.updatedAt).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </Typography>
                              </Stack>
                            </Stack>
                          </Stack>
                          {commande.status === "A_FAIRE" ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={isSubmitting}
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={() => openDeleteConfirmation(commande.commandeNumber)}
                            >
                              Supprimer
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>
                    );
                  })}
                  {commandes.length === 0 ? (
                    <Typography color="text.secondary">Aucune commande pour le moment.</Typography>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={pendingBaseType !== null} onClose={() => (isSubmitting ? undefined : setPendingBaseType(null))}>
        <DialogTitle>Confirmer la creation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
            <Typography>Voulez vous creer la commande numero</Typography>
            <Typography variant="h4" sx={{ color: "primary.main", fontWeight: 800 }}>
              {Number.isInteger(parsedCommandeNumber) ? parsedCommandeNumber : "?"}
            </Typography>
            <Typography>Base {pendingBaseType === "TOMATE" ? "tomate" : "creme fraiche"}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingBaseType(null)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => void handleConfirmedAdd()} disabled={isSubmitting}>
            Creer la commande
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOutOfSequenceOpen}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setConfirmOutOfSequenceOpen(false);
        }}
      >
        <DialogTitle>Confirmation supplementaire</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 360 }}>
            <Typography color="error" sx={{ fontWeight: 800 }}>
              Le numero de commande n&apos;est pas juste apres le dernier numero enregistre.
            </Typography>
            <Typography>Dernier numero enregistre: {lastCommandeNumber || "aucun"}</Typography>
            <Typography>Numero attendu: {expectedCommandeNumber}</Typography>
            <Typography variant="h4" sx={{ color: "primary.main", fontWeight: 800 }}>
              {parsedCommandeNumber}
            </Typography>
            <Typography>Voulez vous vraiment creer ce numero de commande ?</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOutOfSequenceOpen(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void createCommandeWithConfirmation()}
            disabled={isSubmitting}
          >
            Creer quand meme
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateErrorOpen} onClose={() => setDuplicateErrorOpen(false)}>
        <DialogTitle>Commande non enregistree</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
            <Typography color="error" sx={{ fontWeight: 800 }}>
              La commande n&apos;a pas ete enregistree car ce numero existe deja.
            </Typography>
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {parsedCommandeNumber}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setDuplicateErrorOpen(false)}>
            Annuler
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setConfirmDeleteOpen(false);
          setPendingDeleteNumber(null);
        }}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
            <Typography>Pour supprimer la commande, retape son numero ci-dessous.</Typography>
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {pendingDeleteNumber ?? "?"}
            </Typography>
            <TextField
              label="Numero de ticket"
              value={deleteConfirmationInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDeleteConfirmationInput(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmDeleteOpen(false);
              setPendingDeleteNumber(null);
            }}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleConfirmedDelete()}
            disabled={isSubmitting || deleteConfirmationInput.trim() !== String(pendingDeleteNumber ?? "")}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteStartedErrorOpen}
        onClose={() => {
          setDeleteStartedErrorOpen(false);
          setPendingDeleteNumber(null);
        }}
      >
        <DialogTitle>Suppression impossible</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
            <Typography color="error" sx={{ fontWeight: 800 }}>
              La commande est deja demarre, voir directement avec la cuisine.
            </Typography>
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {pendingDeleteNumber ?? "?"}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setDeleteStartedErrorOpen(false);
              setPendingDeleteNumber(null);
            }}
          >
            Annuler
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
