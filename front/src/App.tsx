import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
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
  getPlanningEditions,
  getSelectedService,
  hasCredentials,
  loadRuntimeConfig,
  recalculateBikeCounterStats,
  saveCredentials,
  saveSelectedService
} from "./api";
import { BikeCounterScreen } from "./screens/BikeCounterScreen";
import { BikeCounterAnalyticsScreen } from "./screens/BikeCounterAnalyticsScreen";
import { InvitationGuestsScreen } from "./screens/InvitationGuestsScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { PlanningScreen } from "./screens/PlanningScreen";
import { ServiceSelectionScreen } from "./screens/ServiceSelectionScreen";
import { getServiceMeta, getServicePath } from "./services";
import { AppService, BikeCounterHistory, BikeCounterStats, BikeHistoryRange } from "./types";

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
  const storedSelectedService = getSelectedService();
  const initialSelectedService = hasCredentials() ? storedSelectedService : null;
  const [isAuthenticated, setIsAuthenticated] = useState(hasCredentials() && Boolean(initialSelectedService));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedService, setSelectedService] = useState<AppService | null>(initialSelectedService);
  const [loginError, setLoginError] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const [activeService, setActiveService] = useState<AppService | null>(initialSelectedService);
  const [isPlanningDetailView, setIsPlanningDetailView] = useState(false);

  function resetAuthenticationState(nextSelectedService: AppService | null = selectedService): void {
    setIsAuthenticated(false);
    setActiveService(null);
    setIsPlanningDetailView(false);
    setSelectedService(nextSelectedService);
    setPassword("");
  }

  const bikeHistoryEnabled =
    configReady && isAuthenticated && activeService === "bike-counter" && location.pathname === "/bike/analyse";
  const bikePolling = useBikeStatsPolling(
    configReady && isAuthenticated && activeService === "bike-counter",
    bikeHistoryEnabled,
    resetAuthenticationState
  );
  useEffect(() => {
    async function init(): Promise<void> {
      await loadRuntimeConfig();
      setLoginError("");
      setConfigReady(true);
    }

    void init();
  }, []);

  async function handleLogin(): Promise<void> {
    if (!selectedService) {
      navigate("/", { replace: true });
      return;
    }

    try {
      saveCredentials(username, password);
      saveSelectedService(selectedService);

      if (selectedService === "planning-public" || selectedService === "planning-admin") {
        await getPlanningEditions(selectedService === "planning-admin");
      } else if (selectedService === "invitation-guests") {
        await getPlanningEditions(true);
      } else {
        const stats = await getBikeCounterStats();
        bikePolling.replaceStats(stats);
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
    resetAuthenticationState(null);
    setLoginError("");
    navigate("/", { replace: true });
  }

  function handleServiceSelection(service: AppService): void {
    setSelectedService(service);
    setLoginError("");
    setPassword("");
    navigate("/connexion");
  }

  function handleBackToServices(): void {
    setSelectedService(null);
    setLoginError("");
    setPassword("");
    navigate("/", { replace: true });
  }

  if (!isAuthenticated || !activeService) {
    return (
      <Routes>
        <Route
          path="/"
          element={
            <ServiceSelectionScreen
              onSelectService={handleServiceSelection}
              selectedService={selectedService}
            />
          }
        />
        <Route
          path="/connexion"
          element={
            selectedService ? (
              <LoginScreen
                apiConfigured={Boolean(getApiBaseUrl())}
                configReady={configReady}
                error={loginError}
                onBack={handleBackToServices}
                onPasswordChange={setPassword}
                onSubmit={handleLogin}
                onUsernameChange={setUsername}
                password={password}
                selectedService={selectedService}
                username={username}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={selectedService ? "/connexion" : "/"} replace />} />
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
              Recuperation de la configuration API avant ouverture du service.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const serviceMeta = getServiceMeta(activeService);
  const lockedPath = getServicePath(activeService);
  const isBikeService = activeService === "bike-counter";
  const isBikeAnalyticsPage = location.pathname === "/bike/analyse";
  const bikeToggleTarget = isBikeAnalyticsPage ? "/bike" : "/bike/analyse";
  const bikeToggleLabel = isBikeAnalyticsPage ? "Retour aux stats" : "Voir l'analyse";
  const hideTopBar =
    activeService === "planning-public" && isPlanningDetailView;
  const currentScreenLabel = isBikeService
    ? (isBikeAnalyticsPage ? "Analyse detaillee" : "Statistiques")
    : serviceMeta.screenLabel;

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {hideTopBar ? null : (
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
                  {serviceMeta.applicationName}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.2 }}>
                  Interface de service
                </Typography>
              </Box>
            </Stack>
            <Chip label={currentScreenLabel} sx={{ display: { xs: "none", sm: "inline-flex" } }} />
            {isBikeService ? (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => navigate(bikeToggleTarget)}
                sx={{ flexShrink: 0 }}
              >
                {bikeToggleLabel}
              </Button>
            ) : null}
            <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ flexShrink: 0 }}>
              Changer de service
            </Button>
          </Toolbar>
        </AppBar>
      )}

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
            path="/bike"
            element={
              activeService === "bike-counter" ? (
                <BikeCounterScreen
                  error={bikePolling.error}
                  isRecalculating={bikePolling.isStatsRecalculating}
                  onRecalculate={bikePolling.recalculateStats}
                  stats={bikePolling.stats}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/bike/analyse"
            element={
              activeService === "bike-counter" ? (
                <BikeCounterAnalyticsScreen
                  error={bikePolling.error}
                  history={bikePolling.history}
                  isHistoryLoading={bikePolling.isHistoryLoading}
                  onAuthenticationInvalid={() => resetAuthenticationState(null)}
                  onEventsChanged={async (stats) => {
                    bikePolling.replaceStats(stats);
                    await bikePolling.reloadHistory();
                  }}
                  onRangeChange={bikePolling.setSelectedRange}
                  selectedRange={bikePolling.selectedRange}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/planning"
            element={
              activeService === "planning-public" ? (
                <PlanningScreen
                  adminMode={false}
                  onAuthenticationInvalid={() => resetAuthenticationState(null)}
                  onDetailViewChange={setIsPlanningDetailView}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/planning-admin"
            element={
              activeService === "planning-admin" ? (
                <PlanningScreen adminMode={true} onAuthenticationInvalid={() => resetAuthenticationState(null)} />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route
            path="/invites"
            element={
              activeService === "invitation-guests" ? (
                <InvitationGuestsScreen
                  onAuthenticationInvalid={() => resetAuthenticationState(null)}
                />
              ) : (
                <Navigate to={lockedPath} replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={lockedPath} replace />} />
        </Routes>
      </Container>

      {hideTopBar ? (
        <Box
          component="button"
          type="button"
          aria-label="Changer de service"
          title="Changer de service"
          onClick={handleLogout}
          sx={{
            position: "fixed",
            right: { xs: 16, md: 24 },
            bottom: { xs: 16, md: 24 },
            zIndex: 1200,
            width: 58,
            height: 58,
            display: "grid",
            placeItems: "center",
            border: "none",
            borderRadius: "50%",
            color: "common.white",
            cursor: "pointer",
            boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
            backdropFilter: "blur(12px)",
            background: "linear-gradient(180deg, rgba(244,138,31,0.96), rgba(224,118,18,0.96))",
            "&:hover": {
              background: "linear-gradient(180deg, rgba(250,147,41,1), rgba(232,124,21,1))"
            }
          }}
        >
          <SwapHorizRoundedIcon />
        </Box>
      ) : null}
    </Box>
  );
}
