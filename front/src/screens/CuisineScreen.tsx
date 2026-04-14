import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
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

function getForwardButtonSx(status: Exclude<CommandeStatus, "DELIVREE">) {
  if (status === "A_FAIRE") {
    return {
      background: "linear-gradient(135deg, #f5a623 0%, #c97809 100%)",
      boxShadow: "0 12px 24px rgba(201, 120, 9, 0.24)"
    };
  }

  if (status === "EN_COURS") {
    return {
      background: "linear-gradient(135deg, #8a5cff 0%, #5d36d6 100%)",
      boxShadow: "0 12px 24px rgba(93, 54, 214, 0.24)"
    };
  }

  return {
    background: "linear-gradient(135deg, #14b885 0%, #0d8c68 100%)",
    boxShadow: "0 12px 24px rgba(13, 140, 104, 0.24)"
  };
}

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
      cursor: "default",
      bgcolor: "rgba(247, 167, 40, 0.14)",
      color: "#f7a728",
      border: "1px solid rgba(247, 167, 40, 0.24)",
      "& .MuiChip-icon": {
        color: "inherit"
      }
    };
  }

  if (status === "EN_COURS") {
    return {
      fontWeight: 800,
      cursor: "default",
      bgcolor: "rgba(138, 92, 255, 0.14)",
      color: "#9f7cff",
      border: "1px solid rgba(138, 92, 255, 0.24)",
      "& .MuiChip-icon": {
        color: "inherit"
      }
    };
  }

  if (status === "PRETE") {
    return {
      fontWeight: 800,
      cursor: "default",
      bgcolor: "rgba(20, 184, 133, 0.14)",
      color: "#14b885",
      border: "1px solid rgba(20, 184, 133, 0.24)",
      "& .MuiChip-icon": {
        color: "inherit"
      }
    };
  }

  return {
    fontWeight: 800,
    cursor: "default",
    bgcolor: "rgba(52, 162, 255, 0.14)",
    color: "#34a2ff",
    border: "1px solid rgba(52, 162, 255, 0.24)",
    "& .MuiChip-icon": {
      color: "inherit"
    }
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
    () => [...delivered].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0],
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
      const updatedCommande = await updateCommandeStatus(rollbackIntent.commandeNumber, rollbackIntent.targetStatus);
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
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
          gap: 3,
          alignItems: "start"
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4">File de preparation</Typography>
            <Chip
              label={`${toCook.length} en attente`}
              sx={{ fontWeight: 700, bgcolor: "rgba(247, 167, 40, 0.14)", color: "#f7a728" }}
            />
            <Chip
              label={`${delivered.length} delivrees`}
              sx={{ fontWeight: 700, bgcolor: "rgba(52, 162, 255, 0.14)", color: "#34a2ff" }}
            />
            <Button
              variant="outlined"
              size="small"
              disabled={actionsDisabled || !lastDeliveredCommande}
              startIcon={<AutorenewRoundedIcon />}
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
                <Grid key={commande.commandeNumber} size={12}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            #{commande.commandeNumber}
                          </Typography>
                          <Chip
                            icon={<FlagRoundedIcon fontSize="small" />}
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
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                          <ScheduleRoundedIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2">
                            Cree le{" "}
                            {new Date(commande.createdAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </Typography>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={actionsDisabled}
                            sx={getForwardButtonSx(commande.status)}
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
            position: { xs: "static", md: "sticky" },
            top: 96,
            alignSelf: "start",
            background: "linear-gradient(180deg, rgba(18,31,47,0.98) 0%, rgba(10,18,32,0.98) 100%)"
          }}
        >
          <CardContent sx={{ p: 3 }}>
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
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid rgba(158, 176, 214, 0.12)",
                      bgcolor: "rgba(7, 12, 24, 0.88)"
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="h4">#{commande.commandeNumber}</Typography>
                        <Chip
                          icon={<FlagRoundedIcon fontSize="small" />}
                          label={statusLabel[commande.status]}
                          size="small"
                          sx={getStatusChipSx(commande.status)}
                        />
                      </Stack>
                      <Typography variant="body1">
                        {commande.baseType === "TOMATE" ? "Tomate" : "Creme fraiche"}
                      </Typography>
                      {commande.comment ? (
                        <Typography variant="body2" color="text.secondary">
                          {commande.comment}
                        </Typography>
                      ) : null}
                      {preparationDuration ? (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "secondary.main" }}>
                          Temps jusqu&apos;a a delivrer: {preparationDuration}
                        </Typography>
                      ) : null}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={actionsDisabled}
                          sx={getForwardButtonSx("PRETE")}
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
              {ready.length === 0 ? <Typography color="text.secondary">Aucune pizza prete.</Typography> : null}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => setRollbackConfirmationInput(event.target.value)}
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
            disabled={isSubmitting || rollbackConfirmationInput.trim() !== String(rollbackIntent?.commandeNumber ?? "")}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
