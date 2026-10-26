import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  clearCredentials,
  getApiBaseUrl,
  getBikeCounterHistory,
  getBikeCounterStats,
  hasCredentials,
  loadRuntimeConfig,
  recalculateBikeCounterStats,
  saveCredentials
} from "./api";
import { BikeCounterScreen } from "./screens/BikeCounterScreen";
import { BikeCounterAnalyticsScreen } from "./screens/BikeCounterAnalyticsScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { BikeCounterHistory, BikeCounterStats, BikeHistoryRange } from "./types";

function useBikeStatsPolling(
  enabled: boolean,
  historyEnabled: boolean,
  onAuthenticationInvalid: () => void
): {
  error: string;
  history: BikeCounterHistory | null;
  isHistoryLoading: boolean;
  isStatsRecalculating: boolean;
  recalculateStats: () => Promise<void>;
  reloadHistory: () => Promise<void>;
  replaceStats: (value: BikeCounterStats) => void;
  selectedRange: BikeHistoryRange;
  setSelectedRange: (value: BikeHistoryRange) => void;
  stats: BikeCounterStats;
} {
  const [stats, setStats] = useState<BikeCounterStats>({ totalCount: 0, sessionCount: 0 });
  const [history, setHistory] = useState<BikeCounterHistory | null>(null);
  const [selectedRange, setSelectedRange] = useState<BikeHistoryRange>("month");
  const [statsError, setStatsError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isStatsRecalculating, setIsStatsRecalculating] = useState(false);
  const handleAuthenticationInvalid = useEffectEvent(() => {
    onAuthenticationInvalid();
  });

  function replaceStats(value: BikeCounterStats): void {
    setStats(value);
    setStatsError("");
  }

  async function reloadStats(): Promise<void> {
    if (!enabled) {
      return;
    }

    try {
      replaceStats(await getBikeCounterStats());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatsError(message);
      if (message === "Authentification invalide") {
        handleAuthenticationInvalid();
      }
      throw err;
    }
  }

  async function recalculateStats(): Promise<void> {
    if (!enabled || isStatsRecalculating) {
      return;
    }

    setIsStatsRecalculating(true);

    try {
      replaceStats(await recalculateBikeCounterStats());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setStatsError(message);
      if (message === "Authentification invalide") {
        handleAuthenticationInvalid();
      }
      throw err;
    } finally {
      setIsStatsRecalculating(false);
    }
  }

  const reloadHistory = useCallback(async (): Promise<void> => {
    if (!historyEnabled || !enabled) {
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);

    try {
      const next = await getBikeCounterHistory(selectedRange);
      setHistory(next);
      setHistoryError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setHistoryError(message);
      if (message === "Authentification invalide") {
        handleAuthenticationInvalid();
      }
      throw err;
    } finally {
      setIsHistoryLoading(false);
    }
  }, [enabled, historyEnabled, selectedRange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reloadStats().catch(() => undefined);
    const interval = window.setInterval(() => {
      void reloadStats().catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!historyEnabled) {
      setIsHistoryLoading(false);
      return;
    }

    if (!enabled) {
      return;
    }

    void reloadHistory().catch(() => undefined);
    const interval = window.setInterval(() => {
      void reloadHistory().catch(() => undefined);
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, historyEnabled, reloadHistory]);

  return {
    error: [statsError, historyEnabled ? historyError : ""].filter(Boolean).join(" • "),
    history,
    isHistoryLoading,
    isStatsRecalculating,
    recalculateStats,
    reloadHistory,
    replaceStats,
    selectedRange,
    setSelectedRange,
    stats
  };
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(hasCredentials());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [configReady, setConfigReady] = useState(false);

  function resetAuthenticationState(): void {
    setIsAuthenticated(false);
    setPassword("");
  }

  const bikeHistoryEnabled = configReady && isAuthenticated && location.pathname === "/bike/analyse";
  const bikePolling = useBikeStatsPolling(configReady && isAuthenticated, bikeHistoryEnabled, resetAuthenticationState);

  useEffect(() => {
    async function init(): Promise<void> {
      await loadRuntimeConfig();
      setLoginError("");
      setConfigReady(true);
    }

    void init();
  }, []);

  async function handleLogin(): Promise<void> {
    try {
      saveCredentials(username, password);
      const stats = await getBikeCounterStats();
      bikePolling.replaceStats(stats);
      setIsAuthenticated(true);
      setLoginError("");
      navigate("/bike", { replace: true });
    } catch (error) {
      clearCredentials();
      resetAuthenticationState();
      setLoginError(error instanceof Error ? error.message : "Authentification invalide");
    }
  }

  function handleLogout(): void {
    clearCredentials();
    resetAuthenticationState();
    setLoginError("");
    navigate("/connexion", { replace: true });
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="/connexion"
          element={
            <LoginScreen
              apiConfigured={Boolean(getApiBaseUrl())}
              configReady={configReady}
              error={loginError}
              onPasswordChange={setPassword}
              onSubmit={handleLogin}
              onUsernameChange={setUsername}
              password={password}
              username={username}
            />
          }
        />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }

  if (!configReady) {
    return (
      <Box sx={{ minHeight: "100vh", px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5">Chargement de la configuration...</Typography>
            <Typography color="text.secondary">
              Recuperation de la configuration API avant ouverture du compteur.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const isBikeAnalyticsPage = location.pathname === "/bike/analyse";
  const bikeToggleTarget = isBikeAnalyticsPage ? "/bike" : "/bike/analyse";
  const bikeToggleLabel = isBikeAnalyticsPage ? "Retour aux stats" : "Voir l'analyse";
  const currentScreenLabel = isBikeAnalyticsPage ? "Analyse detaillee" : "Statistiques";

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
              <AppsRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Dervenn Bike
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.2 }}>
                Compteur velo
              </Typography>
            </Box>
          </Stack>
          <Chip label={currentScreenLabel} sx={{ display: { xs: "none", sm: "inline-flex" } }} />
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate(bikeToggleTarget)}
            sx={{ flexShrink: 0 }}
          >
            {bikeToggleLabel}
          </Button>
          <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ flexShrink: 0 }}>
            Se deconnecter
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
          <Route
            path="/bike"
            element={
              <BikeCounterScreen
                error={bikePolling.error}
                isRecalculating={bikePolling.isStatsRecalculating}
                onRecalculate={bikePolling.recalculateStats}
                stats={bikePolling.stats}
              />
            }
          />
          <Route
            path="/bike/analyse"
            element={
              <BikeCounterAnalyticsScreen
                error={bikePolling.error}
                history={bikePolling.history}
                isHistoryLoading={bikePolling.isHistoryLoading}
                onAuthenticationInvalid={resetAuthenticationState}
                onEventsChanged={async (stats) => {
                  bikePolling.replaceStats(stats);
                  await bikePolling.reloadHistory();
                }}
                onRangeChange={bikePolling.setSelectedRange}
                selectedRange={bikePolling.selectedRange}
              />
            }
          />
          <Route path="*" element={<Navigate to="/bike" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
