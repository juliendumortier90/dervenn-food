import type { ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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

interface BarScreenProps {
  commandes: Commande[];
  onCommandeUpdated: (commande: Commande) => void;
  onCommandeDeleted: (commandeNumber: number) => void;
  error: string;
}

type BaseChoice = "CREME_FRAICHE" | "TOMATE";

function normalizeCommandeNumber(value: string): number {
  return Number(value.trim());
}

export function BarScreen({
  commandes,
  onCommandeUpdated,
  onCommandeDeleted,
  error
}: BarScreenProps) {
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
          <Card sx={{ height: "100%", bgcolor: "#9c2f00", color: "white" }}>
            <CardContent>
              <Typography variant="h2">{pendingCount}</Typography>
              <Typography variant="h6">pizzas encore dans le circuit</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Box>
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
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    size="large"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    onClick={() => openCreateConfirmation("CREME_FRAICHE")}
                  >
                    Ajouter creme fraiche
                  </Button>
                  <Button
                    size="large"
                    variant="contained"
                    color="secondary"
                    disabled={isSubmitting}
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
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5">{recentCommandesTitle}</Typography>
                <Stack spacing={1.5}>
                  {recentCommandes.map((commande) => (
                    <Stack
                      key={commande.commandeNumber}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider"
                      }}
                    >
                      <Chip
                        label={`#${commande.commandeNumber} ${commande.baseType === "TOMATE" ? "Tomate" : "Creme"} ${commande.status}`}
                        color={commande.status === "PRETE" ? "success" : "default"}
                        variant="outlined"
                      />
                      {commande.status === "A_FAIRE" ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={isSubmitting}
                          onClick={() => openDeleteConfirmation(commande.commandeNumber)}
                        >
                          Supprimer
                        </Button>
                      ) : null}
                    </Stack>
                  ))}
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
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {Number.isInteger(parsedCommandeNumber) ? parsedCommandeNumber : "?"}
            </Typography>
            <Typography>
              Base {pendingBaseType === "TOMATE" ? "tomate" : "creme fraiche"}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingBaseType(null)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmedAdd()}
            disabled={isSubmitting}
          >
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
              Le numero de commande n'est pas juste apres le dernier numero enregistre.
            </Typography>
            <Typography>
              Dernier numero enregistre: {lastCommandeNumber || "aucun"}
            </Typography>
            <Typography>
              Numero attendu: {expectedCommandeNumber}
            </Typography>
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {parsedCommandeNumber}
            </Typography>
            <Typography>
              Voulez vous vraiment creer ce numero de commande ?
            </Typography>
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
              La commande n'a pas ete enregistree car ce numero existe deja.
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
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDeleteConfirmationInput(event.target.value)
              }
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
            disabled={
              isSubmitting ||
              deleteConfirmationInput.trim() !== String(pendingDeleteNumber ?? "")
            }
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
