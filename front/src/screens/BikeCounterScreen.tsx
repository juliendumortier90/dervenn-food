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
            background: "linear-gradient(145deg, #114b4a 0%, #1f7a63 100%)",
            color: "white",
            boxShadow: "0 30px 80px rgba(17, 75, 74, 0.24)"
          }}
        >
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
            <Stack spacing={2} alignItems="center">
              <Typography
                variant="overline"
                sx={{ letterSpacing: "0.24em", opacity: 0.82 }}
              >
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
