import { Alert, Box, Card, CardContent, Grid, Typography } from "@mui/material";
import { Commande } from "../types";

interface DisplayScreenProps {
  commandes: Commande[];
  error: string;
}

export function DisplayScreen({ commandes, error }: DisplayScreenProps) {
  const ready = commandes.filter((commande) => commande.status === "PRETE");

  return (
    <Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Typography variant="h2" gutterBottom>
        Commandes disponibles
      </Typography>
      <Grid container spacing={3}>
        {ready.map((commande) => (
          <Grid key={commande.commandeNumber} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ bgcolor: "#1c6e5b", color: "white" }}>
              <CardContent>
                <Typography variant="h1">#{commande.commandeNumber}</Typography>
                <Typography variant="h5">
                  {commande.baseType === "TOMATE" ? "Base tomate" : "Base creme fraiche"}
                </Typography>
                {commande.comment ? <Typography variant="h6">{commande.comment}</Typography> : null}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {ready.length === 0 ? (
        <Typography variant="h4" sx={{ mt: 4 }}>
          Aucune pizza prete pour le moment
        </Typography>
      ) : null}
    </Box>
  );
}
