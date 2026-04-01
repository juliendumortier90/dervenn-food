import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { BikeCounterHistory, BikeCounterHistoryBucket, BikeHistoryRange } from "../types";

interface BikeCounterAnalyticsScreenProps {
  error: string;
  history: BikeCounterHistory | null;
  isHistoryLoading: boolean;
  onRangeChange: (range: BikeHistoryRange) => void;
  selectedRange: BikeHistoryRange;
}

const RANGE_OPTIONS: Array<{ value: BikeHistoryRange; label: string }> = [
  { value: "year", label: "1 an" },
  { value: "6months", label: "6 mois" },
  { value: "3months", label: "3 mois" },
  { value: "month", label: "1 mois" },
  { value: "week", label: "7 jours" },
  { value: "day", label: "24 h" }
];

const numberFormatter = new Intl.NumberFormat("fr-FR");
const chartColors = {
  background: "#070d1c",
  line: "#ffad4d",
  point: "#34d7a4",
  text: "#98a5c3"
};

function formatBucketLabel(bucket: BikeCounterHistoryBucket, range: BikeHistoryRange): string {
  const start = new Date(bucket.startAt);

  if (range === "day") {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(start);
  }

  if (range === "week" || range === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short"
    }).format(start);
  }

  if (range === "3months") {
    return `Sem. ${new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short"
    }).format(start)}`;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric"
  }).format(start);
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
  onRangeChange,
  selectedRange
}: BikeCounterAnalyticsScreenProps) {
  const tableRows = history ? [...history.buckets].reverse() : [];

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
                Detail par tranche sur {getRangeLabel(selectedRange).toLowerCase()}.
              </Typography>
            </Box>
            <Divider />
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Periode</TableCell>
                    <TableCell align="right">Passages</TableCell>
                    <TableCell align="right">Part de la periode</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((bucket) => {
                    const share = history?.totalCount ? Math.round((bucket.count / history.totalCount) * 100) : 0;
                    return (
                      <TableRow key={`${bucket.startAt}-${bucket.endAt}`} hover>
                        <TableCell>{history ? formatBucketLabel(bucket, history.range) : "-"}</TableCell>
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
    </Stack>
  );
}
