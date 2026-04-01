import type { ReactNode } from "react";
import PedalBikeRoundedIcon from "@mui/icons-material/PedalBikeRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { BikeCounterStats } from "../types";

interface BikeCounterScreenProps {
  error: string;
  stats: BikeCounterStats;
}

function CounterCard({
  color,
  helper,
  icon,
  title,
  value
}: {
  color: "primary" | "secondary";
  helper: string;
  icon: ReactNode;
  title: string;
  value: number;
}) {
  return (
    <Card
      sx={{
        overflow: "hidden",
        position: "relative",
        minHeight: 340
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: "auto -40px -60px auto",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            color === "primary"
              ? "radial-gradient(circle, rgba(244,138,31,0.24), rgba(244,138,31,0))"
              : "radial-gradient(circle, rgba(22,168,123,0.28), rgba(22,168,123,0))"
        }}
      />
      <CardContent sx={{ p: { xs: 4, md: 5 }, textAlign: "center", position: "relative", height: "100%" }}>
        <Stack spacing={2.5} alignItems="center" justifyContent="center" sx={{ minHeight: "100%" }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "18px",
              display: "grid",
              placeItems: "center",
              color: `${color}.light`,
              background:
                color === "primary" ? "rgba(244,138,31,0.12)" : "rgba(22,168,123,0.12)",
              border:
                color === "primary"
                  ? "1px solid rgba(244,138,31,0.2)"
                  : "1px solid rgba(22,168,123,0.2)"
            }}
          >
            {icon}
          </Box>
          <Typography variant="overline" sx={{ letterSpacing: "0.24em", opacity: 0.82 }}>
            Dervenn Bike
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: "4rem", md: "5rem" }, lineHeight: 1 }}>
            {new Intl.NumberFormat("fr-FR").format(value)}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography sx={{ maxWidth: 360, opacity: 0.82 }}>{helper}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function BikeCounterScreen({ error, stats }: BikeCounterScreenProps) {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 132px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 1080 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 3
          }}
        >
          <CounterCard
            color="primary"
            helper="Statistique globale issue du compteur velo."
            icon={<PedalBikeRoundedIcon />}
            title="passages enregistres"
            value={stats.totalCount}
          />
          <CounterCard
            color="secondary"
            helper="Compteur de session courant, reinitialisable depuis l'afficheur."
            icon={<RestartAltRoundedIcon />}
            title="passages de session"
            value={stats.sessionCount}
          />
        </Box>
      </Stack>
    </Box>
  );
}
