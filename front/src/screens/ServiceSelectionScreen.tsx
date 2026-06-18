import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import { Box, Card, Stack, Typography } from "@mui/material";
import { getServiceMeta, serviceOrder } from "../services";
import { AppService } from "../types";

interface ServiceSelectionScreenProps {
  onSelectService: (service: AppService) => void;
  selectedService: AppService | null;
}

export function ServiceSelectionScreen({ onSelectService, selectedService }: ServiceSelectionScreenProps) {
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
          maxWidth: 980,
          p: { xs: 2, md: 2.75 }
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 46,
                  height: 46,
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
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: "0.2em", color: "primary.main" }}>
                  Etape 1/2
                </Typography>
                <Typography variant="h3">Choisir le service</Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
              Choisir d&apos;abord l&apos;interface a ouvrir. La page de connexion s&apos;affichera ensuite pour le
              service selectionne.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" },
              gap: 2
            }}
          >
            {serviceOrder.map((service) => {
              const serviceMeta = getServiceMeta(service);
              const isSelected = selectedService === service;

              return (
                <Box
                  key={service}
                  component="button"
                  type="button"
                  onClick={() => onSelectService(service)}
                  sx={{
                    width: "100%",
                    minHeight: 220,
                    p: 2.5,
                    textAlign: "left",
                    color: "text.primary",
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: isSelected ? "primary.main" : "rgba(126, 148, 190, 0.16)",
                    background: isSelected
                      ? "linear-gradient(145deg, rgba(244,138,31,0.2), rgba(11,18,33,0.94))"
                      : "linear-gradient(180deg, rgba(13,20,37,0.92) 0%, rgba(10,16,29,0.94) 100%)",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: isSelected ? "0 20px 40px rgba(223, 91, 0, 0.16)" : "none",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      borderColor: "rgba(244,138,31,0.48)"
                    }
                  }}
                >
                  <Stack spacing={2.5} sx={{ height: "100%" }}>
                    <Stack spacing={1}>
                      <Typography variant="overline" sx={{ color: "primary.main", letterSpacing: "0.18em" }}>
                        {serviceMeta.applicationName}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {serviceMeta.title}
                      </Typography>
                      <Typography color="text.secondary">{serviceMeta.description}</Typography>
                    </Stack>
                    <Typography sx={{ mt: "auto", color: isSelected ? "common.white" : "primary.light" }}>
                      Acceder a la connexion
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
