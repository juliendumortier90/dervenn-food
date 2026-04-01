import PedalBikeRoundedIcon from "@mui/icons-material/PedalBikeRounded";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";

interface BikeCounterScreenProps {
  totalCount: number;
  error: string;
}

export function BikeCounterScreen({ totalCount, error }: BikeCounterScreenProps) {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 132px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 640 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Card
          sx={{
            overflow: "hidden",
            position: "relative"
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: "auto -40px -60px auto",
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(22,168,123,0.28), rgba(22,168,123,0))"
            }}
          />
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: "center", position: "relative" }}>
            <Stack spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "18px",
                  display: "grid",
                  placeItems: "center",
                  color: "secondary.light",
                  background: "rgba(22,168,123,0.12)",
                  border: "1px solid rgba(22,168,123,0.2)"
                }}
              >
                <PedalBikeRoundedIcon />
              </Box>
              <Typography variant="overline" sx={{ letterSpacing: "0.24em", opacity: 0.82 }}>
                Dervenn Bike
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: "4rem", md: "5.5rem" }, lineHeight: 1 }}>
                {totalCount}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                passages enregistres
              </Typography>
              <Typography sx={{ opacity: 0.82 }}>
                Statistique globale issue du compteur velo.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
