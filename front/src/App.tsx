import LocalPizzaRoundedIcon from "@mui/icons-material/LocalPizzaRounded";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  clearCredentials,
  getApiBaseUrl,
  getBikeCounterStats,
  getCommandes,
  getSelectedService,
  hasCredentials,
  loadRuntimeConfig,
  saveCredentials,
  saveSelectedService
} from "./api";
import { BikeCounterScreen } from "./screens/BikeCounterScreen";
import { CommandeScreen } from "./screens/BarScreen";
import { CuisineScreen } from "./screens/CuisineScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { AppService, Commande } from "./types";

function useFoodPolling(
  enabled: boolean,
  onAuthenticationInvalid: () => void
): {
  commandes: Commande[];
  error: string;
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
      if (message === "Authentification invalide") {
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

  return { commandes, error, replaceCommandes, upsertCommande, removeCommande };
}

function useBikeStatsPolling(
  enabled: boolean,
  onAuthenticationInvalid: () => void
): {
  error: string;
  replaceTotalCount: (value: number) => void;
  totalCount: number;
} {
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState("");

  function replaceTotalCount(value: number): void {
    setTotalCount(value);
    setError("");
  }

  async function reload(): Promise<void> {
    if (!enabled) {
      return;
    }

    try {
      const stats = await getBikeCounterStats();
      replaceTotalCount(stats.totalCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide") {
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

  return { error, replaceTotalCount, totalCount };
}

export function App() {
  const navigate = useNavigate();
  const initialSelectedService = getSelectedService();
  const [isAuthenticated, setIsAuthenticated] = useState(hasCredentials() && Boolean(initialSelectedService));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedService, setSelectedService] = useState<AppService>(initialSelectedService ?? "bike-counter");
  const [loginError, setLoginError] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const [activeService, setActiveService] = useState<AppService | null>(initialSelectedService);

  function resetAuthenticationState(): void {
    setIsAuthenticated(false);
    setActiveService(null);
    setPassword("");
  }

  const foodPolling = useFoodPolling(
    isAuthenticated && (activeService === "food-commande" || activeService === "food-cuisine"),
    resetAuthenticationState
  );
  const bikePolling = useBikeStatsPolling(isAuthenticated && activeService === "bike-counter", resetAuthenticationState);

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
      saveSelectedService(selectedService);

      if (selectedService === "bike-counter") {
        const stats = await getBikeCounterStats();
        bikePolling.replaceTotalCount(stats.totalCount);
      } else {
        foodPolling.replaceCommandes(await getCommandes());
      }

      setIsAuthenticated(true);
      setActiveService(selectedService);
      setLoginError("");
      navigate(getServicePath(selectedService), { replace: true });
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

  if (!isAuthenticated || !activeService) {
    return (
      <LoginScreen
        apiConfigured={Boolean(getApiBaseUrl())}
        configReady={configReady}
        error={loginError}
        onPasswordChange={setPassword}
        onSelectedServiceChange={setSelectedService}
        onSubmit={handleLogin}
        onUsernameChange={setUsername}
        password={password}
        selectedService={selectedService}
        username={username}
      />
    );
  }

  const serviceMeta = getServiceMeta(activeService);
  const lockedPath = getServicePath(activeService);

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar
          sx={{
            gap: 2,
            px: { xs: 2, md: 4 },
            py: 2,
            backdropFilter: "blur(18px)"
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                color: "primary.main",
                background: "linear-gradient(180deg, rgba(244,138,31,0.18), rgba(244,138,31,0.08))",
                border: "1px solid rgba(244,138,31,0.24)"
              }}
            >
              <LocalPizzaRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {serviceMeta.applicationName}
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.2 }}>
                Interface de service
              </Typography>
            </Box>
          </Stack>
          <Chip label={serviceMeta.screenLabel} sx={{ display: { xs: "none", sm: "inline-flex" } }} />
          <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ flexShrink: 0 }}>
            Changer de service
          </Button>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 3, md: 4 },
          px: { xs: 2, sm: 3, md: 4 }
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to={lockedPath} replace />} />
          <Route
            path="/commande"
            element={
              activeService === "food-commande" ? (
                <CommandeScreen
                  commandes={foodPolling.commandes}
                  onCommandeUpdated={foodPolling.upsertCommande}
                  onCommandeDeleted={foodPolling.removeCommande}
                  error={foodPolling.error}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/cuisine"
            element={
              activeService === "food-cuisine" ? (
                <CuisineScreen
                  commandes={foodPolling.commandes}
                  onCommandeUpdated={foodPolling.upsertCommande}
                  error={foodPolling.error}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/bike"
            element={
              activeService === "bike-counter" ? (
                <BikeCounterScreen totalCount={bikePolling.totalCount} error={bikePolling.error} />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={lockedPath} replace />} />
        </Routes>
      </Container>
    </Box>
  );
}

function getServicePath(service: AppService): string {
  if (service === "food-commande") {
    return "/commande";
  }

  if (service === "food-cuisine") {
    return "/cuisine";
  }

  return "/bike";
}

function getServiceMeta(service: AppService): { applicationName: string; screenLabel: string } {
  if (service === "food-commande") {
    return {
      applicationName: "Dervenn Food",
      screenLabel: "Commande"
    };
  }

  if (service === "food-cuisine") {
    return {
      applicationName: "Dervenn Food",
      screenLabel: "Cuisine"
    };
  }

  return {
    applicationName: "Dervenn Bike",
    screenLabel: "Statistiques"
  };
}
