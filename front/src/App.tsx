import type { ChangeEvent } from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  clearCredentials,
  getScreenMode,
  getApiBaseUrl,
  getCommandes,
  hasCredentials,
  loadRuntimeConfig,
  saveCredentials,
  saveScreenMode,
  type ScreenMode
} from "./api";
import { BarScreen } from "./screens/BarScreen";
import { CuisineScreen } from "./screens/CuisineScreen";
import { Commande } from "./types";

function usePolling(
  enabled: boolean,
  shouldResetOnAuthenticationInvalid: boolean,
  onAuthenticationInvalid: () => void
): {
  commandes: Commande[];
  error: string;
  reload: () => Promise<void>;
  replaceCommandes: (commandes: Commande[]) => void;
  upsertCommande: (commande: Commande) => void;
  removeCommande: (commandeNumber: number) => void;
} {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [error, setError] = useState("");

  function replaceCommandes(next: Commande[]): void {
    setCommandes(next);
    setError("");
  }

  function upsertCommande(commande: Commande): void {
    setCommandes((current) => {
      const next = current.filter((item) => item.commandeNumber !== commande.commandeNumber);
      next.push(commande);
      next.sort((left, right) => left.commandeNumber - right.commandeNumber);
      return next;
    });
    setError("");
  }

  function removeCommande(commandeNumber: number): void {
    setCommandes((current) => current.filter((item) => item.commandeNumber !== commandeNumber));
    setError("");
  }

  async function reload(): Promise<void> {
    if (!enabled) {
      return;
    }

    try {
      const next = await getCommandes();
      replaceCommandes(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide" && shouldResetOnAuthenticationInvalid) {
        onAuthenticationInvalid();
      }
      throw err;
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reload().catch(() => undefined);
    const interval = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [enabled]);

  return { commandes, error, reload, replaceCommandes, upsertCommande, removeCommande };
}

export function App() {
  const navigate = useNavigate();
  const initialScreenMode = getScreenMode();
  const [isAuthenticated, setIsAuthenticated] = useState(hasCredentials() && Boolean(initialScreenMode));
  const [loginOpen, setLoginOpen] = useState(!(hasCredentials() && Boolean(initialScreenMode)));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMode, setSelectedMode] = useState<ScreenMode>("bar");
  const [loginError, setLoginError] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode | null>(initialScreenMode);

  function resetAuthenticationState(): void {
    setIsAuthenticated(false);
    setScreenMode(null);
    setLoginOpen(true);
    setPassword("");
  }

  const polling = usePolling(isAuthenticated, screenMode !== "cuisine", resetAuthenticationState);

  useEffect(() => {
    async function init(): Promise<void> {
      await loadRuntimeConfig();
      if (!getApiBaseUrl()) {
        setLoginError(
          "URL API non configuree. En local, renseigner front/.env avec VITE_API_BASE_URL=https://...execute-api.../prod"
        );
      }
      setConfigReady(true);
    }

    void init();
  }, []);

  async function handleLogin(): Promise<void> {
    try {
      saveCredentials(username, password);
      saveScreenMode(selectedMode);
      setIsAuthenticated(true);
      polling.replaceCommandes(await getCommandes());
      setScreenMode(selectedMode);
      setLoginOpen(false);
      setLoginError("");
      navigate(selectedMode === "bar" ? "/bar" : "/cuisine", { replace: true });
    } catch (error) {
      clearCredentials();
      resetAuthenticationState();
      setLoginError(error instanceof Error ? error.message : "Authentification invalide");
    }
  }

  function handleLogout(): void {
    clearCredentials();
    resetAuthenticationState();
  }

  const lockedPath = screenMode === "cuisine" ? "/cuisine" : "/bar";

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f7f2ea 0%, #efe4d4 100%)" }}>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ gap: 2, backdropFilter: "blur(8px)" }}>
          <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 800 }}>
            Dervenn Food
          </Typography>
          {screenMode ? (
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {screenMode === "bar" ? "Mode bar" : "Mode cuisine"}
            </Typography>
          ) : null}
          <Button variant="outlined" color="inherit" onClick={handleLogout}>
            Changer identifiants
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Routes>
          <Route path="/" element={<Navigate to={lockedPath} replace />} />
          <Route
            path="/bar"
            element={
              screenMode === "bar" ? (
                <BarScreen
                  commandes={polling.commandes}
                  onCommandeUpdated={polling.upsertCommande}
                  onCommandeDeleted={polling.removeCommande}
                  error={polling.error}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/cuisine"
            element={
              screenMode === "cuisine" ? (
                <CuisineScreen
                  commandes={polling.commandes}
                  onCommandeUpdated={polling.upsertCommande}
                  error={polling.error}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={lockedPath} replace />} />
        </Routes>
      </Container>

      <Dialog open={loginOpen}>
        <DialogTitle>Connexion API</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
            <TextField
              label="Identifiant"
              value={username}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setUsername(event.target.value)}
              autoFocus
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            />
            <FormControl>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Ecran a ouvrir apres connexion
              </Typography>
              <RadioGroup
                value={selectedMode}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSelectedMode(event.target.value as ScreenMode)
                }
              >
                <FormControlLabel value="bar" control={<Radio />} label="Bar" />
                <FormControlLabel value="cuisine" control={<Radio />} label="Cuisine" />
              </RadioGroup>
            </FormControl>
            {loginError ? (
              <Typography color="error" variant="body2">
                {loginError}
              </Typography>
            ) : null}
            {!getApiBaseUrl() ? (
              <Typography variant="body2" color="text.secondary">
                En deploiement AWS, cette URL est fournie automatiquement par runtime-config.json.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => void handleLogin()}
            disabled={!configReady || !getApiBaseUrl()}
          >
            Se connecter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
