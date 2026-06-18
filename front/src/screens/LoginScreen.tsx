import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import type { ChangeEvent, FormEvent } from "react";
import { Alert, Box, Button, Card, Stack, TextField, Typography } from "@mui/material";
import { AppService } from "../types";
import { getServiceMeta } from "../services";

interface LoginScreenProps {
  apiConfigured: boolean;
  configReady: boolean;
  error: string;
  onBack: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onUsernameChange: (value: string) => void;
  password: string;
  selectedService: AppService;
  username: string;
}

export function LoginScreen({
  apiConfigured,
  configReady,
  error,
  onBack,
  onPasswordChange,
  onSubmit,
  onUsernameChange,
  password,
  selectedService,
  username
}: LoginScreenProps) {
  const serviceMeta = getServiceMeta(selectedService);

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
          maxWidth: 560,
          p: { xs: 2, md: 2.75 },
          overflow: "hidden"
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "grid",
            gap: { xs: 2, md: 2.5 }
          }}
        >
          <Stack
            spacing={2}
            sx={{
              p: { xs: 2.25, md: 2.5 },
              borderRadius: 3,
              background:
                "radial-gradient(circle at 20% 20%, rgba(244,138,31,0.16), transparent 30%), linear-gradient(180deg, rgba(18,27,47,0.96) 0%, rgba(12,18,33,0.96) 100%)",
              border: "1px solid rgba(158, 176, 214, 0.12)"
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: "0.2em", color: "primary.main" }}>
                  Etape 2/2
                </Typography>
                <Typography variant="h4">Connexion</Typography>
              </Box>
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                onClick={onBack}
                startIcon={<ArrowBackRoundedIcon />}
                sx={{ flexShrink: 0 }}
              >
                Services
              </Button>
            </Stack>
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
                <AppsRoundedIcon />
              </Box>
              <Stack spacing={0.25}>
                <Typography variant="h6">{serviceMeta.title}</Typography>
                <Typography color="text.secondary">{serviceMeta.description}</Typography>
              </Stack>
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
                <Typography color="text.secondary">Utiliser les identifiants du service choisi</Typography>
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
              Se connecter
            </Button>
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
