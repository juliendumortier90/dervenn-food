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
import { useMemo, useState } from "react";
import { updateCommandeStatus } from "../api";
import { Commande, CommandeStatus } from "../types";

interface CuisineScreenProps {
  commandes: Commande[];
  onCommandeUpdated: (commande: Commande) => void;
  error: string;
}

interface StatusAction {
  label: string;
}

interface RollbackIntent {
  commandeNumber: number;
  targetStatus: CommandeStatus;
  title: string;
  message: string;
}

const statusLabel: Record<CommandeStatus, string> = {
  A_FAIRE: "A faire",
  EN_COURS: "En cours",
  PRETE: "A delivrer",
  DELIVREE: "Delivree"
};

const forwardActionByStatus: Record<Exclude<CommandeStatus, "DELIVREE">, StatusAction> = {
  A_FAIRE: { label: "Passer en cours" },
  EN_COURS: { label: "Passer a delivrer" },
  PRETE: { label: "Delivrer" }
};

function previousStatus(status: CommandeStatus): CommandeStatus | null {
  if (status === "EN_COURS") {
    return "A_FAIRE";
  }
  if (status === "PRETE") {
    return "EN_COURS";
  }
  if (status === "DELIVREE") {
    return "PRETE";
  }
  return null;
}

function isForwardActionableStatus(status: CommandeStatus): status is Exclude<CommandeStatus, "DELIVREE"> {
  return status === "A_FAIRE" || status === "EN_COURS" || status === "PRETE";
}

function isQueueStatus(status: CommandeStatus): status is "A_FAIRE" | "EN_COURS" {
  return status === "A_FAIRE" || status === "EN_COURS";
}

function formatPreparationDuration(commande: Commande): string | null {
  if (!commande.readyAt) {
    return null;
  }

  const createdAt = Date.parse(commande.createdAt);
  const readyAt = Date.parse(commande.readyAt);

  if (Number.isNaN(createdAt) || Number.isNaN(readyAt) || readyAt < createdAt) {
    return null;
  }

  const diffMinutes = Math.floor((readyAt - createdAt) / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  }

  return `${diffMinutes} min`;
}

function getStatusChipSx(status: CommandeStatus) {
  if (status === "A_FAIRE") {
    return {
      fontWeight: 800,
      bgcolor: "#eef2f6",
      color: "#44505c",
      border: "1px solid #cfd7df",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)"
    };
  }

  if (status === "EN_COURS") {
    return {
      fontWeight: 800,
      bgcolor: "#ffe2bd",
      color: "#8a4b00",
      border: "1px solid #f0b46a",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)"
    };
  }

  if (status === "PRETE") {
    return {
      fontWeight: 800,
      bgcolor: "#d9f5ea",
      color: "#145244",
      border: "1px solid #82d1ba",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)"
    };
  }

  return {
    fontWeight: 800,
    bgcolor: "#ede8ff",
    color: "#4b3699",
    border: "1px solid #bcaae8",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)"
  };
}

export function CuisineScreen({ commandes, onCommandeUpdated, error }: CuisineScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rollbackIntent, setRollbackIntent] = useState<RollbackIntent | null>(null);
  const [rollbackConfirmationInput, setRollbackConfirmationInput] = useState("");
  const toCook = commandes.filter((commande) => commande.status === "A_FAIRE" || commande.status === "EN_COURS");
  const ready = commandes.filter((commande) => commande.status === "PRETE");
  const delivered = commandes.filter((commande) => commande.status === "DELIVREE");
  const actionsDisabled = Boolean(error) || isSubmitting;
  const lastDeliveredCommande = useMemo(
    () =>
      [...delivered].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      )[0],
    [delivered]
  );

  async function handleAdvance(commande: Commande): Promise<void> {
    if (!isForwardActionableStatus(commande.status)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedCommande = await updateCommandeStatus(
        commande.commandeNumber,
        commande.status === "A_FAIRE"
          ? "EN_COURS"
          : commande.status === "EN_COURS"
            ? "PRETE"
            : "DELIVREE"
      );
      onCommandeUpdated(updatedCommande);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openRollbackConfirmation(commande: Commande): void {
    const targetStatus = previousStatus(commande.status);
    if (!targetStatus) {
      return;
    }

    setRollbackConfirmationInput("");
    setRollbackIntent({
      commandeNumber: commande.commandeNumber,
      targetStatus,
      title:
        commande.status === "DELIVREE"
          ? "Retour ticket delivre"
          : "Confirmer le retour au statut precedent",
      message:
        commande.status === "DELIVREE"
          ? "Voulez vous remettre a delivrer ce ticket ?"
          : `Voulez vous remettre ce ticket en ${statusLabel[targetStatus].toLowerCase()} ?`
    });
  }

  async function handleConfirmedRollback(): Promise<void> {
    if (!rollbackIntent) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedCommande = await updateCommandeStatus(
        rollbackIntent.commandeNumber,
        rollbackIntent.targetStatus
      );
      onCommandeUpdated(updatedCommande);
      setRollbackIntent(null);
      setRollbackConfirmationInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, 0.9fr)",
          gap: 3,
          alignItems: "start"
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4">File de preparation</Typography>
            <Chip
              label={`${toCook.length} en attente`}
              sx={{ fontWeight: 700, bgcolor: "#d8f3eb", color: "#145244" }}
            />
            <Chip
              label={`${delivered.length} delivrees`}
              sx={{ fontWeight: 700, bgcolor: "#ece7ff", color: "#4b3699" }}
            />
            <Button
              variant="outlined"
              size="small"
              disabled={actionsDisabled || !lastDeliveredCommande}
              onClick={() => {
                if (lastDeliveredCommande) {
                  openRollbackConfirmation(lastDeliveredCommande);
                }
              }}
            >
              Retour derniere delivree
            </Button>
          </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Grid container spacing={2}>
          {toCook.map((commande) => {
            if (!isQueueStatus(commande.status)) {
              return null;
            }

            const forwardAction = forwardActionByStatus[commande.status];
            const rollbackTarget = previousStatus(commande.status);

              return (
                <Grid key={commande.commandeNumber} size={{ xs: 6 }}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            #{commande.commandeNumber}
                          </Typography>
                          <Chip
                            label={statusLabel[commande.status]}
                            size="small"
                            sx={getStatusChipSx(commande.status)}
                          />
                        </Stack>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {commande.baseType === "TOMATE" ? "Base tomate" : "Base creme fraiche"}
                        </Typography>
                        {commande.comment ? (
                          <Typography variant="body2" color="text.secondary">
                            {commande.comment}
                          </Typography>
                        ) : null}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            disabled={actionsDisabled}
                            onClick={() => void handleAdvance(commande)}
                          >
                            {forwardAction.label}
                          </Button>
                          {rollbackTarget ? (
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={actionsDisabled}
                              onClick={() => openRollbackConfirmation(commande)}
                            >
                              Retour statut precedent
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
            {toCook.length === 0 ? (
              <Grid size={12}>
                <Typography color="text.secondary">Aucune pizza a preparer.</Typography>
              </Grid>
            ) : null}
          </Grid>
        </Stack>

        <Card
          sx={{
            position: "sticky",
            top: 96,
            bgcolor: "#fff4d6"
          }}
        >
          <CardContent>
            <Typography variant="h4" gutterBottom>
              Pizzas pretes
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              Appeler les clients pour les numeros.
            </Typography>
            <Stack spacing={2} sx={{ mt: 3 }}>
              {ready.map((commande) => {
                const preparationDuration = formatPreparationDuration(commande);

                return (
                  <Box
                    key={commande.commandeNumber}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: "white",
                      boxShadow: 1
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="h4">#{commande.commandeNumber}</Typography>
                        <Chip
                          label={statusLabel[commande.status]}
                          size="small"
                          sx={getStatusChipSx(commande.status)}
                        />
                      </Stack>
                      <Typography variant="body1">
                        {commande.baseType === "TOMATE" ? "Tomate" : "Creme fraiche"}
                      </Typography>
                      {commande.comment ? <Typography variant="body2">{commande.comment}</Typography> : null}
                      {preparationDuration ? (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#145244" }}>
                          Temps jusqu'a a delivrer: {preparationDuration}
                        </Typography>
                      ) : null}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          disabled={actionsDisabled}
                          onClick={() => void handleAdvance(commande)}
                        >
                          {forwardActionByStatus.PRETE.label}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={actionsDisabled}
                          onClick={() => openRollbackConfirmation(commande)}
                        >
                          Remettre en cours
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
              {ready.length === 0 ? <Typography>Aucune pizza prete.</Typography> : null}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={rollbackIntent !== null}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setRollbackIntent(null);
          setRollbackConfirmationInput("");
        }}
      >
        <DialogTitle>{rollbackIntent?.title ?? "Confirmation"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
            <Typography>{rollbackIntent?.message}</Typography>
            <Typography variant="h4" sx={{ color: "error.main", fontWeight: 800 }}>
              {rollbackIntent?.commandeNumber ?? "?"}
            </Typography>
            <TextField
              label="Numero de ticket"
              value={rollbackConfirmationInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setRollbackConfirmationInput(event.target.value)
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRollbackIntent(null);
              setRollbackConfirmationInput("");
            }}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmedRollback()}
            disabled={
              isSubmitting ||
              rollbackConfirmationInput.trim() !== String(rollbackIntent?.commandeNumber ?? "")
            }
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
