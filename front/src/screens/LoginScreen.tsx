import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LocalPizzaRoundedIcon from "@mui/icons-material/LocalPizzaRounded";
import type { ChangeEvent, FormEvent } from "react";
import { Alert, Box, Button, Card, Chip, Stack, TextField, Typography } from "@mui/material";
import { AppService } from "../types";

interface LoginScreenProps {
  apiConfigured: boolean;
  configReady: boolean;
  error: string;
  onPasswordChange: (value: string) => void;
  onSelectedServiceChange: (service: AppService) => void;
  onSubmit: () => void;
  onUsernameChange: (value: string) => void;
  password: string;
  selectedService: AppService;
  username: string;
}

const serviceLabels: Record<AppService, { title: string; description: string }> = {
  "food-commande": {
    title: "Commande",
    description: "Creer et suivre les tickets depuis le poste de prise de commande."
  },
  "food-cuisine": {
    title: "Cuisine",
    description: "Piloter la file de preparation et faire avancer les statuts."
  },
  "bike-counter": {
    title: "Counter",
    description: "Consulter les statistiques du compteur velo securisees par un mot de passe dedie."
  }
};

export function LoginScreen({
  apiConfigured,
  configReady,
  error,
  onPasswordChange,
  onSelectedServiceChange,
  onSubmit,
  onUsernameChange,
  password,
  selectedService,
  username
}: LoginScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, rgba(244,138,31,0.14), transparent 26%), radial-gradient(circle at bottom right, rgba(14,168,123,0.12), transparent 28%)"
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 980,
          p: { xs: 2, md: 2.5 },
          overflow: "hidden"
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(320px, 0.95fr)" },
            gap: { xs: 2, md: 3 }
          }}
        >
          <Stack
            spacing={2.5}
            sx={{
              p: { xs: 2.25, md: 2.5 },
              borderRadius: 3,
              background:
                "radial-gradient(circle at 20% 20%, rgba(244,138,31,0.16), transparent 30%), linear-gradient(180deg, rgba(18,27,47,0.96) 0%, rgba(12,18,33,0.96) 100%)",
              border: "1px solid rgba(158, 176, 214, 0.12)"
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  color: "primary.main",
                  background: "rgba(244,138,31,0.12)",
                  border: "1px solid rgba(244,138,31,0.2)"
                }}
              >
                <LocalPizzaRoundedIcon />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: "0.2em", color: "primary.main" }}>
                  Acces services
                </Typography>
                <Typography variant="h4">Choisir le service</Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary">
              Selectionner l&apos;interface a ouvrir puis utiliser l&apos;identifiant commun avec le mot de passe
              associe au service choisi.
            </Typography>
            <Stack spacing={1.25}>
              {(Object.entries(serviceLabels) as [AppService, (typeof serviceLabels)[AppService]][]).map(
                ([service, details]) => (
                  <Box
                    key={service}
                    component="button"
                    type="button"
                    onClick={() => onSelectedServiceChange(service)}
                    sx={{
                      width: "100%",
                      textAlign: "left",
                      p: 2.25,
                      color: "text.primary",
                      borderRadius: 2.5,
                      border: "1px solid",
                      borderColor: selectedService === service ? "primary.main" : "rgba(126, 148, 190, 0.16)",
                      background:
                        selectedService === service
                          ? "linear-gradient(135deg, rgba(244,138,31,0.2), rgba(12,20,37,0.94))"
                          : "rgba(11,18,33,0.72)",
                      cursor: "pointer",
                      transition: "border-color 0.2s ease, transform 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        borderColor: "rgba(244,138,31,0.48)"
                      }
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Typography variant="h6" sx={{ color: "common.white", fontWeight: 700 }}>
                        {details.title}
                      </Typography>
                      <Typography color="text.secondary">{details.description}</Typography>
                    </Stack>
                  </Box>
                )
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label="Theme sombre" color="primary" variant="outlined" />
              <Chip label="Acces separe par service" variant="outlined" />
            </Stack>
          </Stack>

          <Stack
            spacing={2.5}
            sx={{
              justifyContent: "center",
              p: { xs: 2.25, md: 2.5 },
              borderRadius: 3,
              background: "linear-gradient(180deg, rgba(14,21,39,0.9) 0%, rgba(10,16,29,0.96) 100%)",
              border: "1px solid rgba(158, 176, 214, 0.12)"
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  color: "primary.main",
                  background: "rgba(244,138,31,0.12)"
                }}
              >
                <LockRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h5">Connexion</Typography>
                <Typography color="text.secondary">Authentification rapide et simple</Typography>
              </Box>
            </Stack>
            <TextField
              label="Identifiant"
              value={username}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onUsernameChange(event.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onPasswordChange(event.target.value)}
              fullWidth
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            {!apiConfigured ? (
              <Alert severity="warning">
                URL API non configuree. En local, renseigner `front/.env` avec `VITE_API_BASE_URL=https://...`.
              </Alert>
            ) : null}
            <Button type="submit" variant="contained" size="large" disabled={!configReady || !apiConfigured}>
              Ouvrir le service
            </Button>
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
