import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  createBikeCounterEvents,
  deleteBikeCounterEvents,
  getBikeCounterEvents
} from "../api";
import {
  BikeCounterEntry,
  BikeCounterHistory,
  BikeCounterHistoryBucket,
  BikeCounterStats,
  BikeHistoryRange
} from "../types";

interface BikeCounterAnalyticsScreenProps {
  error: string;
  history: BikeCounterHistory | null;
  isHistoryLoading: boolean;
  onAuthenticationInvalid: () => void;
  onEventsChanged: (stats: BikeCounterStats) => Promise<void>;
  onRangeChange: (range: BikeHistoryRange) => void;
  selectedRange: BikeHistoryRange;
}

const RANGE_OPTIONS: Array<{ value: BikeHistoryRange; label: string }> = [
  { value: "10years", label: "10 ans" },
  { value: "5years", label: "5 ans" },
  { value: "2years", label: "2 ans" },
  { value: "year", label: "1 an" },
  { value: "6months", label: "6 mois" },
  { value: "month", label: "1 mois" }
];

const numberFormatter = new Intl.NumberFormat("fr-FR");
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "medium"
});
const chartColors = {
  background: "#070d1c",
  line: "#ffad4d",
  point: "#34d7a4",
  text: "#98a5c3"
};

function toLocalDateTimeInputValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoDateTime(localValue: string): string | null {
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatBucketLabel(bucket: BikeCounterHistoryBucket, range: BikeHistoryRange): string {
  const start = new Date(bucket.startAt);

  if (range === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short"
    }).format(start);
  }

  if (range === "5years" || range === "10years") {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric"
    }).format(start);
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric"
  }).format(start);
}

function formatActivityDayLabel(bucket: BikeCounterHistoryBucket): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(bucket.startAt));
}

function getRangeLabel(range: BikeHistoryRange): string {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range;
}

function getSparseTickIndexes(length: number): number[] {
  if (length <= 1) {
    return [0];
  }

  const indexes = new Set<number>([0, length - 1, Math.floor((length - 1) / 2)]);
  const step = Math.max(1, Math.floor((length - 1) / 4));

  for (let index = step; index < length - 1; index += step) {
    indexes.add(index);
  }

  return Array.from(indexes).sort((left, right) => left - right);
}

function BikeHistoryChart({
  history,
  isLoading
}: {
  history: BikeCounterHistory | null;
  isLoading: boolean;
}) {
  if (!history || history.buckets.length === 0) {
    return (
      <Box
        sx={{
          minHeight: 320,
          display: "grid",
          placeItems: "center",
          color: "text.secondary",
          borderRadius: 4,
          border: "1px dashed rgba(152, 165, 195, 0.18)",
          background: "linear-gradient(180deg, rgba(10,16,29,0.64), rgba(10,16,29,0.26))"
        }}
      >
        <Typography>{isLoading ? "Chargement du graphique..." : "Aucune donnee sur cette periode."}</Typography>
      </Box>
    );
  }

  const width = 960;
  const height = 320;
  const paddingTop = 24;
  const paddingRight = 24;
  const paddingBottom = 44;
  const paddingLeft = 56;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...history.buckets.map((bucket) => bucket.count));
  const stepX = history.buckets.length > 1 ? plotWidth / (history.buckets.length - 1) : 0;
  const bottomY = paddingTop + plotHeight;
  const points = history.buckets.map((bucket, index) => ({
    count: bucket.count,
    label: formatBucketLabel(bucket, history.range),
    x: paddingLeft + index * stepX,
    y: bottomY - (bucket.count / maxValue) * plotHeight
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length > 0
    ? `M ${points[0].x} ${bottomY} ${points.map((point) => `L ${point.x} ${point.y}`).join(" ")} L ${
        points[points.length - 1].x
      } ${bottomY} Z`
    : "";
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue];
  const xTickIndexes = getSparseTickIndexes(points.length);

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        sx={{ width: "100%", height: { xs: 280, md: 320 }, display: "block" }}
      >
        <defs>
          <linearGradient id="bike-area-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={chartColors.line} stopOpacity="0.42" />
            <stop offset="100%" stopColor={chartColors.point} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {yTicks.map((tickValue) => {
          const y = bottomY - (tickValue / maxValue) * plotHeight;
          return (
            <g key={tickValue}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(152, 165, 195, 0.14)"
                strokeDasharray="4 8"
              />
              <text
                x={paddingLeft - 12}
                y={y + 4}
                fill={chartColors.text}
                fontSize="12"
                textAnchor="end"
              >
                {numberFormatter.format(tickValue)}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill="url(#bike-area-gradient)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={chartColors.line}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((point) => (
          <circle
            key={`${point.label}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r="4.5"
            fill={chartColors.background}
            stroke={chartColors.point}
            strokeWidth="2.5"
          />
        ))}

        {xTickIndexes.map((index) => (
          <text
            key={index}
            x={points[index]?.x ?? paddingLeft}
            y={height - 14}
            fill={chartColors.text}
            fontSize="12"
            textAnchor="middle"
          >
            {points[index]?.label ?? ""}
          </text>
        ))}
      </Box>

      {isLoading ? (
        <Chip
          label="Mise a jour..."
          size="small"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(16,168,123,0.16)",
            border: "1px solid rgba(16,168,123,0.28)"
          }}
        />
      ) : null}
    </Box>
  );
}

export function BikeCounterAnalyticsScreen({
  error,
  history,
  isHistoryLoading,
  onAuthenticationInvalid,
  onEventsChanged,
  onRangeChange,
  selectedRange
}: BikeCounterAnalyticsScreenProps) {
  const now = useMemo(() => new Date(), []);
  const [events, setEvents] = useState<BikeCounterEntry[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set());
  const [eventsFrom, setEventsFrom] = useState(() => toLocalDateTimeInputValue(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
  const [eventsTo, setEventsTo] = useState(() => toLocalDateTimeInputValue(now));
  const [createAt, setCreateAt] = useState(() => toLocalDateTimeInputValue(now));
  const [createCount, setCreateCount] = useState("1");
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isMutatingEvents, setIsMutatingEvents] = useState(false);
  const tableRows = history
    ? [...(history.activityDays?.filter((bucket) => bucket.count > 0) ?? history.buckets.filter((bucket) => bucket.count > 0))]
        .reverse()
    : [];
  const allVisibleEventIds = events.map((event) => event.id);
  const selectedEventsCount = allVisibleEventIds.filter((id) => selectedEventIds.has(id)).length;
  const allVisibleEventsSelected = allVisibleEventIds.length > 0 && selectedEventsCount === allVisibleEventIds.length;

  async function loadEvents(): Promise<void> {
    const from = toIsoDateTime(eventsFrom);
    const to = toIsoDateTime(eventsTo);

    if (!from || !to) {
      setAdminError("La periode de recherche est invalide.");
      return;
    }

    if (Date.parse(from) > Date.parse(to)) {
      setAdminError("La date de debut doit etre avant la date de fin.");
      return;
    }

    setIsEventsLoading(true);
    setAdminError("");

    try {
      const nextEvents = await getBikeCounterEvents(from, to, 300);
      setEvents(nextEvents);
      setSelectedEventIds(new Set());
      setAdminMessage(`${numberFormatter.format(nextEvents.length)} evenement(s) charge(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setAdminError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setIsEventsLoading(false);
    }
  }

  async function handleCreateEvents(): Promise<void> {
    const count = Number(createCount);
    const createdAt = toIsoDateTime(createAt);

    if (!Number.isInteger(count) || count < 1 || count > 1000 || !createdAt) {
      setAdminError("Indique un nombre entre 1 et 1000 et une date valide.");
      return;
    }

    setIsMutatingEvents(true);
    setAdminError("");

    try {
      const stats = await createBikeCounterEvents(count, createdAt);
      await onEventsChanged(stats);
      await loadEvents();
      setAdminMessage(`${numberFormatter.format(count)} evenement(s) cree(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setAdminError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setIsMutatingEvents(false);
    }
  }

  async function handleDeleteSelectedEvents(): Promise<void> {
    const ids = Array.from(selectedEventIds);

    if (ids.length === 0) {
      setAdminError("Selectionne au moins un evenement a supprimer.");
      return;
    }

    setIsMutatingEvents(true);
    setAdminError("");

    try {
      const stats = await deleteBikeCounterEvents(ids);
      await onEventsChanged(stats);
      await loadEvents();
      setAdminMessage(`${numberFormatter.format(ids.length)} evenement(s) supprime(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setAdminError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setIsMutatingEvents(false);
    }
  }

  function toggleEventSelection(eventId: string): void {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  function toggleAllVisibleEvents(): void {
    setSelectedEventIds((current) => {
      if (allVisibleEventsSelected) {
        return new Set();
      }

      const next = new Set(current);
      for (const eventId of allVisibleEventIds) {
        next.add(eventId);
      }
      return next;
    });
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  return (
    <Stack spacing={3.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card sx={{ overflow: "hidden", position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            inset: "auto -60px -120px auto",
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,168,123,0.2), rgba(22,168,123,0))"
          }}
        />
        <CardContent sx={{ p: { xs: 3, md: 4 }, position: "relative" }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h5">Analyse detaillee des passages</Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Visualisation temporelle des detections pour reperer les rythmes et les pics.
                </Typography>
              </Box>
              <Chip
                icon={<TimelineRoundedIcon />}
                label={`Periode : ${getRangeLabel(selectedRange)}`}
                sx={{
                  borderRadius: 999,
                  background: "rgba(16,168,123,0.12)",
                  border: "1px solid rgba(16,168,123,0.26)"
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {RANGE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  clickable
                  color={selectedRange === option.value ? "primary" : "default"}
                  label={option.label}
                  onClick={() => onRangeChange(option.value)}
                  sx={{
                    px: 0.5,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor:
                      selectedRange === option.value ? "rgba(244,138,31,0.34)" : "rgba(158, 176, 214, 0.14)",
                    background:
                      selectedRange === option.value
                        ? "linear-gradient(180deg, rgba(244,138,31,0.22), rgba(244,138,31,0.12))"
                        : "rgba(255,255,255,0.02)"
                  }}
                />
              ))}
            </Stack>

            <BikeHistoryChart history={history} isLoading={isHistoryLoading} />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Stack spacing={0}>
            <Box sx={{ px: { xs: 3, md: 4 }, pt: { xs: 3, md: 4 }, pb: 2 }}>
              <Typography variant="h5">Tableau des passages</Typography>
              <Typography sx={{ color: "text.secondary" }}>
                Detail par jour avec activite sur {getRangeLabel(selectedRange).toLowerCase()}.
              </Typography>
            </Box>
            <Divider />
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Jour</TableCell>
                    <TableCell align="right">Passages</TableCell>
                    <TableCell align="right">Part de la periode</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((bucket) => {
                    const share = history?.totalCount ? Math.round((bucket.count / history.totalCount) * 100) : 0;
                    return (
                      <TableRow key={`${bucket.startAt}-${bucket.endAt}`} hover>
                        <TableCell>{formatActivityDayLabel(bucket)}</TableCell>
                        <TableCell align="right">{numberFormatter.format(bucket.count)}</TableCell>
                        <TableCell align="right">{share}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                        {isHistoryLoading ? "Chargement des donnees..." : "Aucune donnee exploitable sur cette periode."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5">Administration des evenements</Typography>
              <Typography sx={{ color: "text.secondary" }}>
                Creation manuelle et suppression selective des detections brutes.
              </Typography>
            </Box>

            {adminError ? <Alert severity="error">{adminError}</Alert> : null}
            {adminMessage && !adminError ? <Alert severity="success">{adminMessage}</Alert> : null}

            <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ xs: "stretch", lg: "flex-end" }}>
              <TextField
                label="Date et heure"
                type="datetime-local"
                value={createAt}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setCreateAt(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: { lg: 240 } }}
              />
              <TextField
                label="Nombre"
                type="number"
                value={createCount}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setCreateCount(event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 1000 } }}
                sx={{ width: { xs: "100%", lg: 140 } }}
              />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={handleCreateEvents}
                disabled={isMutatingEvents}
                sx={{ minHeight: 56 }}
              >
                Creer
              </Button>
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ xs: "stretch", lg: "flex-end" }}>
              <TextField
                label="Du"
                type="datetime-local"
                value={eventsFrom}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEventsFrom(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: { lg: 240 } }}
              />
              <TextField
                label="Au"
                type="datetime-local"
                value={eventsTo}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEventsTo(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: { lg: 240 } }}
              />
              <Button
                variant="outlined"
                startIcon={isEventsLoading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
                onClick={loadEvents}
                disabled={isEventsLoading || isMutatingEvents}
                sx={{ minHeight: 56 }}
              >
                Charger
              </Button>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteRoundedIcon />}
                onClick={handleDeleteSelectedEvents}
                disabled={selectedEventsCount === 0 || isMutatingEvents}
                sx={{ minHeight: 56, ml: { lg: "auto" } }}
              >
                Supprimer ({numberFormatter.format(selectedEventsCount)})
              </Button>
            </Stack>

            <TableContainer sx={{ maxHeight: 420, border: "1px solid rgba(158, 176, 214, 0.14)", borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allVisibleEventsSelected}
                        indeterminate={selectedEventsCount > 0 && !allVisibleEventsSelected}
                        onChange={toggleAllVisibleEvents}
                      />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((bikeEvent) => (
                    <TableRow key={bikeEvent.id} hover selected={selectedEventIds.has(bikeEvent.id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedEventIds.has(bikeEvent.id)}
                          onChange={() => toggleEventSelection(bikeEvent.id)}
                        />
                      </TableCell>
                      <TableCell>{dateTimeFormatter.format(new Date(bikeEvent.createdAt))}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{bikeEvent.id}</TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ py: 5, textAlign: "center", color: "text.secondary" }}>
                        {isEventsLoading ? "Chargement des evenements..." : "Aucun evenement sur cette periode."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
