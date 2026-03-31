import type { ChangeEvent, FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography
} from "@mui/material";
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

const serviceLabels: Record<AppService, { eyebrow: string; title: string; description: string }> = {
  "food-commande": {
    eyebrow: "Dervenn Food",
    title: "Commande",
    description: "Creer et suivre les tickets depuis le poste de prise de commande."
  },
  "food-cuisine": {
    eyebrow: "Dervenn Food",
    title: "Cuisine",
    description: "Piloter la file de preparation et faire avancer les statuts."
  },
  "bike-counter": {
    eyebrow: "Dervenn Bike",
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
        px: 3,
        py: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, rgba(28, 110, 91, 0.18), transparent 28%), linear-gradient(180deg, #f6efe4 0%, #efe3d3 100%)"
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 980,
          p: { xs: 3, md: 5 },
          backgroundColor: "rgba(255, 250, 243, 0.94)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 28px 70px rgba(76, 52, 30, 0.14)"
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(320px, 0.85fr)" },
            gap: 4
          }}
        >
          <Stack spacing={2.5}>
            <Typography variant="overline" sx={{ letterSpacing: "0.2em", color: "primary.main" }}>
              Acces services
            </Typography>
            <Typography variant="h3">Choisir le service a ouvrir</Typography>
            <Typography color="text.secondary">
              La connexion est maintenant isolee de l&apos;interface. Selectionner d&apos;abord la destination,
              puis utiliser l&apos;identifiant commun avec le mot de passe associe au service.
            </Typography>
            <Stack spacing={1.5}>
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
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: selectedService === service ? "primary.main" : "rgba(74, 59, 44, 0.14)",
                      background:
                        selectedService === service
                          ? "linear-gradient(145deg, rgba(156, 47, 0, 0.08), rgba(28, 110, 91, 0.1))"
                          : "rgba(255,255,255,0.72)",
                      cursor: "pointer"
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ letterSpacing: "0.16em", color: "text.secondary" }}>
                        {details.eyebrow}
                      </Typography>
                      <Typography variant="h6">{details.title}</Typography>
                      <Typography color="text.secondary">{details.description}</Typography>
                    </Stack>
                  </Box>
                )
              )}
            </Stack>
          </Stack>

          <Stack spacing={2.5} sx={{ justifyContent: "center" }}>
            <Typography variant="h5">Connexion</Typography>
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
