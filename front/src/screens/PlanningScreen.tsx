import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import Groups2RoundedIcon from "@mui/icons-material/Groups2Rounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useState, type ChangeEvent, type ReactElement } from "react";
import {
  createPlanningAffectation,
  createPlanningBenevole,
  createPlanningCategorie,
  createPlanningEdition,
  deletePlanningAffectation,
  getPlanningEdition,
  getPlanningEditions,
  updatePlanningBenevole,
  updatePlanningCategorie,
  updatePlanningEdition
} from "../api";
import {
  PlanningAffectation,
  PlanningBenevole,
  PlanningCategorie,
  PlanningEdition,
  PlanningEditionSummary
} from "../types";

interface PlanningScreenProps {
  adminMode: boolean;
  onAuthenticationInvalid: () => void;
}

interface EditionFormState {
  title: string;
  startAt: string;
  endAt: string;
}

interface BenevoleFormState {
  benevoleId?: string;
  pseudo: string;
  phone: string;
}

interface CategorieFormState {
  categorieId?: string;
  title: string;
  color: string;
}

interface AffectationFormState {
  benevoleId: string;
  categorieId: string;
  startAt: string;
  endAt: string;
  comment: string;
}

type SidebarMode = "benevoles" | "categories";
type InputChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
interface TimelineMarker {
  label: string;
  leftPercent: number;
  isHourBoundary: boolean;
}

interface TimelineRowItem {
  affectation: PlanningAffectation;
  laneIndex: number;
}

interface TimelineRow {
  categorie: PlanningCategorie;
  items: TimelineRowItem[];
  laneCount: number;
}

interface TimelineBand {
  label: string;
  leftPercent: number;
  widthPercent: number;
}

interface TimelineHourBand {
  leftPercent: number;
  widthPercent: number;
  isAlternate: boolean;
}

const CATEGORY_COLOR_PRESETS = ["#F48A1F", "#14B885", "#2F7CF6", "#9C5CFF", "#F0526D", "#F2C94C", "#22A6B3", "#9B7E46"];
const HALF_HOUR_MS = 30 * 60 * 1000;
const ZOOM_WINDOW_MS = 24 * 60 * 60 * 1000;
const ZOOM_STEP_MS = 12 * 60 * 60 * 1000;
const TIMELINE_BLUE = "#1a2743";
const CATEGORY_SEPARATOR = "rgba(244,138,31,0.55)";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function fromDateInputValue(value: string): string {
  return new Date(`${value}T00:00`).toISOString();
}

function formatDateTimeLabel(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  const hours = pad(date.getHours());
  const minutes = date.getMinutes();

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${pad(minutes)}`;
}

function formatZoomWindowLabel(startAt: string, endAt: string): string {
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  return `${startDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  })} · ${formatTimeLabel(startAt)} - ${formatTimeLabel(endAt)}` +
    (startDate.toDateString() !== endDate.toDateString()
      ? ` · ${endDate.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}`
      : "");
}

function formatDayHeaderLabel(startAt: string, endAt: string): string {
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const sameDay = startDate.toDateString() === endDate.toDateString();

  if (sameDay) {
    return startDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    });
  }

  return `${startDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  })} - ${endDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  })}`;
}

function formatDuration(startAt: string, endAt: string): string {
  const durationMinutes = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes.toString().padStart(2, "0")}`;
}

function formatDecimalHours(totalHours: number): string {
  const rounded = Math.round(totalHours * 10) / 10;
  return `${rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

function createDefaultEditionRange(): EditionFormState {
  const now = new Date();
  const start = new Date(now);
  const dayOffset = (3 - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + dayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  end.setHours(23, 30, 0, 0);

  return {
    title: `Edition ${start.getFullYear()}`,
    startAt: toDateTimeLocalValue(start.toISOString()),
    endAt: toDateTimeLocalValue(end.toISOString())
  };
}

function createEditionFormState(edition?: PlanningEditionSummary | PlanningEdition): EditionFormState {
  if (!edition) {
    return createDefaultEditionRange();
  }

  return {
    title: edition.title,
    startAt: toDateTimeLocalValue(edition.startAt),
    endAt: toDateTimeLocalValue(edition.endAt)
  };
}

function createBenevoleFormState(benevole?: PlanningBenevole): BenevoleFormState {
  return {
    benevoleId: benevole?.benevoleId,
    pseudo: benevole?.pseudo ?? "",
    phone: benevole?.phone ?? ""
  };
}

function createCategorieFormState(categorie?: PlanningCategorie): CategorieFormState {
  return {
    categorieId: categorie?.categorieId,
    title: categorie?.title ?? "",
    color: categorie?.color ?? CATEGORY_COLOR_PRESETS[0]
  };
}

function createAffectationFormState(
  edition: PlanningEdition,
  prefill: Partial<Pick<AffectationFormState, "benevoleId" | "categorieId" | "startAt" | "endAt">> = {}
): AffectationFormState {
  const startAt = prefill.startAt ?? toDateTimeLocalValue(edition.startAt);
  const defaultEndDate = new Date(fromDateTimeLocalValue(startAt));
  defaultEndDate.setHours(defaultEndDate.getHours() + 2);

  return {
    benevoleId: prefill.benevoleId ?? edition.benevoles[0]?.benevoleId ?? "",
    categorieId: prefill.categorieId ?? edition.categories[0]?.categorieId ?? "",
    startAt,
    endAt: prefill.endAt ?? toDateTimeLocalValue(defaultEndDate.toISOString()),
    comment: ""
  };
}

function createZoomWindowEnd(startAt: string, maxEndAt: string): string {
  const next = new Date(Date.parse(startAt) + ZOOM_WINDOW_MS);
  const maxEnd = Date.parse(maxEndAt);
  return new Date(Math.min(next.getTime(), maxEnd)).toISOString();
}

function clampZoomWindowStart(startAt: string, minStartAt: string, maxEndAt: string): string {
  const requested = Date.parse(startAt);
  const min = Date.parse(minStartAt);
  const latestStart = Math.max(min, Date.parse(maxEndAt) - ZOOM_WINDOW_MS);
  return new Date(Math.min(Math.max(requested, min), latestStart)).toISOString();
}

function shiftZoomWindowStart(currentStartAt: string, deltaMs: number, minStartAt: string, maxEndAt: string): string {
  return clampZoomWindowStart(new Date(Date.parse(currentStartAt) + deltaMs).toISOString(), minStartAt, maxEndAt);
}

function intersectsWindow(affectation: PlanningAffectation, viewStartAt: number, viewEndAt: number): boolean {
  return Date.parse(affectation.endAt) > viewStartAt && Date.parse(affectation.startAt) < viewEndAt;
}

function getBenevoleHours(edition: PlanningEdition, benevoleId: string): number {
  return edition.affectations
    .filter((affectation) => affectation.benevoleId === benevoleId)
    .reduce((total, affectation) => total + (Date.parse(affectation.endAt) - Date.parse(affectation.startAt)) / 3600000, 0);
}

function getCategorieCount(edition: PlanningEdition, categorieId: string): number {
  return edition.affectations.filter((affectation) => affectation.categorieId === categorieId).length;
}

function buildTimelineMarkers(viewStartAt: number, viewEndAt: number): TimelineMarker[] {
  const markers: TimelineMarker[] = [];
  const duration = viewEndAt - viewStartAt;
  const stepCount = Math.max(1, Math.round(duration / HALF_HOUR_MS));

  for (let index = 0; index <= stepCount; index += 1) {
    const timestamp = viewStartAt + index * HALF_HOUR_MS;
    const date = new Date(timestamp);
    const isHourBoundary = date.getMinutes() === 0;
    const label = isHourBoundary && date.getHours() % 2 === 0 ? `${pad(date.getHours())}h` : "";

    markers.push({
      leftPercent: (index / stepCount) * 100,
      label,
      isHourBoundary
    });
  }

  return markers;
}

function buildTimelineHourBands(viewStartAt: number, viewEndAt: number): TimelineHourBand[] {
  const bands: TimelineHourBand[] = [];
  const totalDuration = viewEndAt - viewStartAt;
  let cursor = new Date(viewStartAt);

  while (cursor.getTime() < viewEndAt) {
    const bandStart = cursor.getTime();
    const nextBoundary = new Date(cursor);
    nextBoundary.setMinutes(0, 0, 0);
    nextBoundary.setHours(nextBoundary.getHours() + 1);
    const bandEnd = Math.min(nextBoundary.getTime(), viewEndAt);

    bands.push({
      leftPercent: ((bandStart - viewStartAt) / totalDuration) * 100,
      widthPercent: ((bandEnd - bandStart) / totalDuration) * 100,
      isAlternate: new Date(bandStart).getHours() % 2 === 0
    });

    cursor = new Date(bandEnd);
  }

  return bands;
}

function buildTimelineBands(viewStartAt: number, viewEndAt: number): TimelineBand[] {
  const bands: TimelineBand[] = [];
  const totalDuration = viewEndAt - viewStartAt;
  let cursor = new Date(viewStartAt);

  while (cursor.getTime() < viewEndAt) {
    const bandStart = cursor.getTime();
    const nextBoundary = new Date(cursor);
    nextBoundary.setHours(24, 0, 0, 0);
    const bandEnd = Math.min(nextBoundary.getTime(), viewEndAt);
    const leftPercent = ((bandStart - viewStartAt) / totalDuration) * 100;
    const widthPercent = ((bandEnd - bandStart) / totalDuration) * 100;

    bands.push({
      label: formatDayHeaderLabel(new Date(bandStart).toISOString(), new Date(bandEnd).toISOString()),
      leftPercent,
      widthPercent
    });

    cursor = new Date(bandEnd);
  }

  return bands;
}

function buildEditionOverviewBands(startAt: string, endAt: string): TimelineBand[] {
  return buildTimelineBands(Date.parse(startAt), Date.parse(endAt));
}

function getBlockMetrics(startAt: string, endAt: string, viewStartAt: number, viewEndAt: number) {
  const clippedStart = Math.max(Date.parse(startAt), viewStartAt);
  const clippedEnd = Math.min(Date.parse(endAt), viewEndAt);
  const duration = viewEndAt - viewStartAt;
  const leftPercent = ((clippedStart - viewStartAt) / duration) * 100;
  const widthPercent = Math.max(((clippedEnd - clippedStart) / duration) * 100, 2.6);
  return { leftPercent, widthPercent };
}

function getFilterMatch(
  affectation: PlanningAffectation,
  sidebarMode: SidebarMode,
  focusedBenevoleId: string | null,
  focusedCategorieId: string | null
): boolean {
  if (sidebarMode === "benevoles" && focusedBenevoleId) {
    return affectation.benevoleId === focusedBenevoleId;
  }

  if (sidebarMode === "categories" && focusedCategorieId) {
    return affectation.categorieId === focusedCategorieId;
  }

  return true;
}

function buildTimelineRows(categories: PlanningCategorie[], affectations: PlanningAffectation[]): TimelineRow[] {
  return categories.map((categorie) => {
    const categoryAffectations = affectations
      .filter((affectation) => affectation.categorieId === categorie.categorieId)
      .sort((left, right) => {
        const startComparison = left.startAt.localeCompare(right.startAt);

        if (startComparison !== 0) {
          return startComparison;
        }

        return left.endAt.localeCompare(right.endAt);
      });

    const laneEndTimes: number[] = [];
    const items = categoryAffectations.map((affectation) => {
      const startAt = Date.parse(affectation.startAt);
      const endAt = Date.parse(affectation.endAt);
      let laneIndex = laneEndTimes.findIndex((laneEndTime) => startAt >= laneEndTime);

      if (laneIndex < 0) {
        laneIndex = laneEndTimes.length;
        laneEndTimes.push(endAt);
      } else {
        laneEndTimes[laneIndex] = endAt;
      }

      return {
        affectation,
        laneIndex
      };
    });

    return {
      categorie,
      items,
      laneCount: Math.max(1, laneEndTimes.length)
    };
  });
}

export function PlanningScreen({ adminMode, onAuthenticationInvalid }: PlanningScreenProps) {
  const [editions, setEditions] = useState<PlanningEditionSummary[]>([]);
  const [activeEditionId, setActiveEditionId] = useState<string | null>(null);
  const [activeEdition, setActiveEdition] = useState<PlanningEdition | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingEdition, setIsLoadingEdition] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("benevoles");
  const [focusedBenevoleId, setFocusedBenevoleId] = useState<string | null>(null);
  const [focusedCategorieId, setFocusedCategorieId] = useState<string | null>(null);
  const [viewStart, setViewStart] = useState("");
  const [editionDialogOpen, setEditionDialogOpen] = useState(false);
  const [editionForm, setEditionForm] = useState<EditionFormState>(createDefaultEditionRange());
  const [benevoleDialogOpen, setBenevoleDialogOpen] = useState(false);
  const [benevoleForm, setBenevoleForm] = useState<BenevoleFormState>(createBenevoleFormState());
  const [categorieDialogOpen, setCategorieDialogOpen] = useState(false);
  const [categorieForm, setCategorieForm] = useState<CategorieFormState>(createCategorieFormState());
  const [affectationDialogOpen, setAffectationDialogOpen] = useState(false);
  const [affectationForm, setAffectationForm] = useState<AffectationFormState>({
    benevoleId: "",
    categorieId: "",
    startAt: "",
    endAt: "",
    comment: ""
  });
  const [selectedAffectation, setSelectedAffectation] = useState<PlanningAffectation | null>(null);
  const hasPopupOpen =
    editionDialogOpen ||
    benevoleDialogOpen ||
    categorieDialogOpen ||
    affectationDialogOpen ||
    Boolean(selectedAffectation);

  useEffect(() => {
    async function loadEditions(): Promise<void> {
      setIsLoadingList(true);

      try {
        const nextEditions = await getPlanningEditions(adminMode);
        setEditions(nextEditions);
        setError("");
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Erreur inconnue";
        setError(message);
        if (message === "Authentification invalide") {
          onAuthenticationInvalid();
        }
      } finally {
        setIsLoadingList(false);
      }
    }

    void loadEditions();
  }, [adminMode, onAuthenticationInvalid]);

  useEffect(() => {
    if (!activeEditionId) {
      setActiveEdition(null);
      return;
    }

    const currentEditionId = activeEditionId;

    async function loadEdition(): Promise<void> {
      setIsLoadingEdition(true);

      try {
        const nextEdition = await getPlanningEdition(currentEditionId, adminMode);
        setActiveEdition(nextEdition);
        setViewStart(clampZoomWindowStart(nextEdition.startAt, nextEdition.startAt, nextEdition.endAt));
        setFocusedBenevoleId(null);
        setFocusedCategorieId(null);
        setSidebarMode("benevoles");
        setError("");
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Erreur inconnue";
        setError(message);
        if (message === "Authentification invalide") {
          onAuthenticationInvalid();
        }
      } finally {
        setIsLoadingEdition(false);
      }
    }

    void loadEdition();
  }, [activeEditionId, adminMode, onAuthenticationInvalid]);

  async function refreshEditions(): Promise<void> {
    const nextEditions = await getPlanningEditions(adminMode);
    setEditions(nextEditions);
  }

  async function refreshActiveEdition(): Promise<void> {
    if (!activeEditionId) {
      return;
    }

    const nextEdition = await getPlanningEdition(activeEditionId, adminMode);
    setActiveEdition(nextEdition);
  }

  async function runMutation(task: () => Promise<void>, successMessage: string): Promise<void> {
    setIsSaving(true);

    try {
      await task();
      setFeedback(successMessage);
      setError("");
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      setError(message);
      if (message === "Authentification invalide") {
        onAuthenticationInvalid();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateEditionDialog(): void {
    setError("");
    setEditionForm(createDefaultEditionRange());
    setEditionDialogOpen(true);
  }

  function openEditEditionDialog(): void {
    if (!activeEdition) {
      return;
    }

    setError("");
    setEditionForm(createEditionFormState(activeEdition));
    setEditionDialogOpen(true);
  }

  function openCreateBenevoleDialog(benevole?: PlanningBenevole): void {
    setError("");
    setBenevoleForm(createBenevoleFormState(benevole));
    setBenevoleDialogOpen(true);
  }

  function openCreateCategorieDialog(categorie?: PlanningCategorie): void {
    setError("");
    setCategorieForm(createCategorieFormState(categorie));
    setCategorieDialogOpen(true);
  }

  function openCreateAffectationDialog(
    prefill: Partial<Pick<AffectationFormState, "benevoleId" | "categorieId">> = {}
  ): void {
    if (!activeEdition) {
      return;
    }

    setError("");
    const defaultStart = viewStart ? toDateTimeLocalValue(viewStart) : toDateTimeLocalValue(activeEdition.startAt);

    setAffectationForm(
      createAffectationFormState(activeEdition, {
        ...prefill,
        startAt: defaultStart
      })
    );
    setAffectationDialogOpen(true);
  }

  function closeEditionDialog(): void {
    setEditionDialogOpen(false);
    setError("");
  }

  function closeBenevoleDialog(): void {
    setBenevoleDialogOpen(false);
    setError("");
  }

  function closeCategorieDialog(): void {
    setCategorieDialogOpen(false);
    setError("");
  }

  function closeAffectationDialog(): void {
    setAffectationDialogOpen(false);
    setError("");
  }

  function closeSelectedAffectationDialog(): void {
    setSelectedAffectation(null);
    setError("");
  }

  function isEditionFormValid(): boolean {
    return Boolean(editionForm.title.trim()) && Boolean(editionForm.startAt) && Boolean(editionForm.endAt);
  }

  function isBenevoleFormValid(): boolean {
    return Boolean(benevoleForm.pseudo.trim()) && Boolean(benevoleForm.phone.trim());
  }

  function isCategorieFormValid(): boolean {
    return Boolean(categorieForm.title.trim()) && /^#[0-9a-fA-F]{6}$/.test(categorieForm.color);
  }

  function isAffectationFormValid(): boolean {
    return (
      Boolean(affectationForm.benevoleId) &&
      Boolean(affectationForm.categorieId) &&
      Boolean(affectationForm.startAt) &&
      Boolean(affectationForm.endAt) &&
      Date.parse(fromDateTimeLocalValue(affectationForm.endAt)) > Date.parse(fromDateTimeLocalValue(affectationForm.startAt))
    );
  }

  const parsedViewStart = viewStart ? Date.parse(viewStart) : Number.NaN;
  const parsedViewEnd = activeEdition && viewStart ? Date.parse(createZoomWindowEnd(viewStart, activeEdition.endAt)) : Number.NaN;
  const hasValidWindow = Number.isFinite(parsedViewStart) && Number.isFinite(parsedViewEnd) && parsedViewEnd > parsedViewStart;
  const timelineMarkers = hasValidWindow ? buildTimelineMarkers(parsedViewStart, parsedViewEnd) : [];
  const timelineBands = hasValidWindow ? buildTimelineBands(parsedViewStart, parsedViewEnd) : [];
  const timelineHourBands = hasValidWindow ? buildTimelineHourBands(parsedViewStart, parsedViewEnd) : [];
  const visibleAffectations =
    activeEdition && hasValidWindow
      ? activeEdition.affectations.filter((affectation) => intersectsWindow(affectation, parsedViewStart, parsedViewEnd))
      : [];
  const timelineRows = activeEdition ? buildTimelineRows(activeEdition.categories, visibleAffectations) : [];
  const overviewBands = activeEdition ? buildEditionOverviewBands(activeEdition.startAt, activeEdition.endAt) : [];

  async function handleEditionSubmit(): Promise<void> {
    if (!isEditionFormValid()) {
      setError("Titre et dates obligatoires.");
      return;
    }

    await runMutation(async () => {
      if (activeEdition && activeEditionId) {
        await updatePlanningEdition(
          activeEditionId,
          editionForm.title.trim(),
          fromDateTimeLocalValue(editionForm.startAt),
          fromDateTimeLocalValue(editionForm.endAt)
        );
        await refreshEditions();
        await refreshActiveEdition();
      } else {
        const createdEdition = await createPlanningEdition(
          editionForm.title.trim(),
          fromDateTimeLocalValue(editionForm.startAt),
          fromDateTimeLocalValue(editionForm.endAt)
        );
        await refreshEditions();
        setActiveEditionId(createdEdition.editionId);
      }

      setEditionDialogOpen(false);
    }, activeEdition ? "Edition mise a jour" : "Nouvelle edition creee");
  }

  async function handleBenevoleSubmit(): Promise<void> {
    if (!activeEditionId || !isBenevoleFormValid()) {
      setError("Pseudo et telephone obligatoires.");
      return;
    }

    await runMutation(async () => {
      if (benevoleForm.benevoleId) {
        await updatePlanningBenevole(
          activeEditionId,
          benevoleForm.benevoleId,
          benevoleForm.pseudo.trim(),
          benevoleForm.phone.trim()
        );
      } else {
        await createPlanningBenevole(activeEditionId, benevoleForm.pseudo.trim(), benevoleForm.phone.trim());
      }

      await refreshActiveEdition();
      setBenevoleDialogOpen(false);
    }, benevoleForm.benevoleId ? "Benevole mis a jour" : "Benevole ajoute");
  }

  async function handleCategorieSubmit(): Promise<void> {
    if (!activeEditionId || !isCategorieFormValid()) {
      setError("Titre et couleur obligatoires.");
      return;
    }

    await runMutation(async () => {
      if (categorieForm.categorieId) {
        await updatePlanningCategorie(
          activeEditionId,
          categorieForm.categorieId,
          categorieForm.title.trim(),
          categorieForm.color.toUpperCase()
        );
      } else {
        await createPlanningCategorie(activeEditionId, categorieForm.title.trim(), categorieForm.color.toUpperCase());
      }

      await refreshActiveEdition();
      setCategorieDialogOpen(false);
    }, categorieForm.categorieId ? "Categorie mise a jour" : "Categorie ajoutee");
  }

  async function handleAffectationSubmit(): Promise<void> {
    if (!activeEditionId || !isAffectationFormValid()) {
      setError("Affectation incomplete ou plage horaire invalide.");
      return;
    }

    await runMutation(async () => {
      await createPlanningAffectation(
        activeEditionId,
        affectationForm.benevoleId,
        affectationForm.categorieId,
        fromDateTimeLocalValue(affectationForm.startAt),
        fromDateTimeLocalValue(affectationForm.endAt),
        affectationForm.comment.trim() || undefined
      );

      await refreshActiveEdition();
      setAffectationDialogOpen(false);
    }, "Affectation ajoutee");
  }

  async function handleDeleteAffectation(): Promise<void> {
    if (!activeEditionId || !selectedAffectation) {
      return;
    }

    await runMutation(async () => {
      await deletePlanningAffectation(activeEditionId, selectedAffectation.affectationId);
      await refreshActiveEdition();
      setSelectedAffectation(null);
    }, "Affectation supprimee");
  }

  function renderEditionList(): ReactElement {
    return (
      <Stack spacing={3}>
        <Card
          sx={{
            overflow: "hidden",
            background:
              "radial-gradient(circle at 18% 22%, rgba(244,138,31,0.16), transparent 20%), linear-gradient(180deg, rgba(13,20,37,0.96) 0%, rgba(10,16,29,0.98) 100%)"
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: "0.18em", color: "primary.main" }}>
                  Planning benevoles
                </Typography>
                <Typography variant="h4">
                  {adminMode ? "Espace d'administration des editions" : "Consultation des editions"}
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 1 }}>
                  Chaque edition regroupe ses benevoles, categories et affectations. L'interface reprend la timeline
                  continue sur toute la periode, avec zoom libre et lecture par benevole ou categorie.
                </Typography>
              </Box>
              {adminMode ? (
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateEditionDialog}>
                  Nouvelle edition
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {error && !hasPopupOpen ? <Alert severity="error">{error}</Alert> : null}
        {feedback ? <Alert severity="success">{feedback}</Alert> : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2.5
          }}
        >
          {editions.map((edition) => (
            <Card key={edition.editionId} sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2.5} sx={{ height: "100%" }}>
                  <Box>
                    <Typography variant="overline" sx={{ letterSpacing: "0.16em", color: "primary.main" }}>
                      Edition
                    </Typography>
                    <Typography variant="h5">{edition.title}</Typography>
                  </Box>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                      <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />
                      <Typography>
                        {formatDateTimeLabel(edition.startAt)} - {formatDateTimeLabel(edition.endAt)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                      <ScheduleRoundedIcon sx={{ fontSize: 18 }} />
                      <Typography>Creee le {formatDateLabel(edition.createdAt)}</Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ mt: "auto" }}>
                    <Button
                      fullWidth
                      variant={adminMode ? "contained" : "outlined"}
                      startIcon={adminMode ? <EditRoundedIcon /> : <VisibilityRoundedIcon />}
                      onClick={() => setActiveEditionId(edition.editionId)}
                    >
                      {adminMode ? "Ouvrir l'edition" : "Voir le planning"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>

        {!isLoadingList && editions.length === 0 ? (
          <Alert severity="info">
            {adminMode
              ? "Aucune edition pour le moment. Creer la premiere pour commencer."
              : "Aucune edition n'est encore disponible en consultation."}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  function renderSidebar(): ReactElement | null {
    if (!activeEdition) {
      return null;
    }

    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant={sidebarMode === "benevoles" ? "contained" : "outlined"}
                onClick={() => {
                  setSidebarMode("benevoles");
                  setFocusedCategorieId(null);
                }}
              >
                Benevoles
              </Button>
              <Button
                fullWidth
                variant={sidebarMode === "categories" ? "contained" : "outlined"}
                color={sidebarMode === "categories" ? "secondary" : "inherit"}
                onClick={() => {
                  setSidebarMode("categories");
                  setFocusedBenevoleId(null);
                }}
              >
                Categories
              </Button>
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ borderBottom: "1px solid rgba(158, 176, 214, 0.12)", pb: 1.5 }}
            >
              <Typography variant="h6">{sidebarMode === "benevoles" ? "Equipe" : "Taches"}</Typography>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={() => {
                  setFocusedBenevoleId(null);
                  setFocusedCategorieId(null);
                }}
              >
                Tout voir
              </Button>
            </Stack>

            <Stack spacing={1.2}>
              {sidebarMode === "benevoles"
                ? activeEdition.benevoles.map((benevole) => {
                    const isFocused = focusedBenevoleId === benevole.benevoleId;
                    const totalHours = getBenevoleHours(activeEdition, benevole.benevoleId);

                    return (
                      <Box
                        key={benevole.benevoleId}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: isFocused ? "primary.main" : "rgba(126, 148, 190, 0.16)",
                          background: isFocused
                            ? "linear-gradient(135deg, rgba(244,138,31,0.18), rgba(14,21,39,0.96))"
                            : "rgba(12,19,35,0.68)"
                        }}
                      >
                        <Stack spacing={1.2}>
                          <Box
                            sx={{ cursor: "pointer" }}
                            onClick={() => {
                              setFocusedBenevoleId(isFocused ? null : benevole.benevoleId);
                              setFocusedCategorieId(null);
                            }}
                          >
                            <Typography variant="h6">{benevole.pseudo}</Typography>
                            <Typography color="text.secondary">{benevole.phone}</Typography>
                            <Typography sx={{ mt: 0.75, color: "primary.light", fontWeight: 700 }}>
                              {formatDecimalHours(totalHours)}
                            </Typography>
                          </Box>
                          {adminMode ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PlaylistAddRoundedIcon />}
                                onClick={() => openCreateAffectationDialog({ benevoleId: benevole.benevoleId })}
                              >
                                Affecter
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                startIcon={<EditRoundedIcon />}
                                onClick={() => openCreateBenevoleDialog(benevole)}
                              >
                                Modifier
                              </Button>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Box>
                    );
                  })
                : activeEdition.categories.map((categorie) => {
                    const isFocused = focusedCategorieId === categorie.categorieId;
                    const affectationCount = getCategorieCount(activeEdition, categorie.categorieId);

                    return (
                      <Box
                        key={categorie.categorieId}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: isFocused ? categorie.color : "rgba(126, 148, 190, 0.16)",
                          background: isFocused
                            ? "linear-gradient(135deg, rgba(244,138,31,0.08), rgba(14,21,39,0.96))"
                            : "rgba(12,19,35,0.68)"
                        }}
                      >
                        <Stack spacing={1.2}>
                          <Box
                            sx={{ cursor: "pointer" }}
                            onClick={() => {
                              setFocusedCategorieId(isFocused ? null : categorie.categorieId);
                              setFocusedBenevoleId(null);
                            }}
                          >
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Box
                                sx={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  backgroundColor: categorie.color,
                                  boxShadow: `0 0 0 4px ${categorie.color}22`
                                }}
                              />
                              <Typography variant="h6">{categorie.title}</Typography>
                            </Stack>
                            <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
                              {affectationCount} affectation{affectationCount > 1 ? "s" : ""}
                            </Typography>
                          </Box>
                          {adminMode ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PlaylistAddRoundedIcon />}
                                onClick={() => openCreateAffectationDialog({ categorieId: categorie.categorieId })}
                              >
                                Affecter
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                startIcon={<EditRoundedIcon />}
                                onClick={() => openCreateCategorieDialog(categorie)}
                              >
                                Modifier
                              </Button>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Box>
                    );
                  })}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderTimeline(): ReactElement | null {
    if (!activeEdition) {
      return null;
    }

    const zoomStartAt = viewStart || activeEdition.startAt;
    const zoomEndAt = createZoomWindowEnd(zoomStartAt, activeEdition.endAt);
    const canShiftBackward = Date.parse(zoomStartAt) > Date.parse(activeEdition.startAt);
    const canShiftForward = Date.parse(zoomEndAt) < Date.parse(activeEdition.endAt);
    const zoomSelectionValue = toDateInputValue(zoomStartAt);
    const currentZoomLeftPercent =
      ((Date.parse(zoomStartAt) - Date.parse(activeEdition.startAt)) /
        Math.max(Date.parse(activeEdition.endAt) - Date.parse(activeEdition.startAt), 1)) *
      100;
    const currentZoomWidthPercent =
      ((Date.parse(zoomEndAt) - Date.parse(zoomStartAt)) /
        Math.max(Date.parse(activeEdition.endAt) - Date.parse(activeEdition.startAt), 1)) *
      100;

    return (
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="text"
                  color="inherit"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => setActiveEditionId(null)}
                  sx={{ px: 0, minWidth: "auto" }}
                >
                  Editions
                </Button>
                <Typography variant="h5">{activeEdition.title}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {adminMode ? (
                  <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreateAffectationDialog()}>
                    Nouvelle affectation
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            {!hasValidWindow ? <Alert severity="warning">Fenetre de visualisation invalide.</Alert> : null}

            <Card
              sx={{
                backgroundColor: TIMELINE_BLUE,
                border: "1px solid rgba(158, 176, 214, 0.12)"
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 700 }}>Vue d'ensemble de l'edition</Typography>
                    <Typography color="text.secondary">
                      {formatDateTimeLabel(activeEdition.startAt)} - {formatDateTimeLabel(activeEdition.endAt)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      position: "relative",
                      height: 74,
                      borderRadius: 2.5,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.03)"
                    }}
                  >
                    {overviewBands.map((band, index) => (
                      <Box
                        key={`${band.label}-${index}`}
                        onClick={() =>
                          setViewStart(
                            clampZoomWindowStart(
                              new Date(
                                Date.parse(activeEdition.startAt) +
                                  ((Date.parse(activeEdition.endAt) - Date.parse(activeEdition.startAt)) * band.leftPercent) / 100
                              ).toISOString(),
                              activeEdition.startAt,
                              activeEdition.endAt
                            )
                          )
                        }
                        sx={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${band.leftPercent}%`,
                      width: `${band.widthPercent}%`,
                      px: 1,
                      py: 1,
                      borderRight: "1px solid rgba(158, 176, 214, 0.14)",
                      backgroundColor: TIMELINE_BLUE,
                      cursor: "pointer"
                    }}
                  >
                        <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                          {band.label}
                        </Typography>
                      </Box>
                    ))}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        bottom: 8,
                        left: `${currentZoomLeftPercent}%`,
                        width: `${currentZoomWidthPercent}%`,
                        borderRadius: 2,
                        border: "2px solid rgba(244,138,31,0.9)",
                        background: "rgba(244,138,31,0.12)",
                        boxShadow: "0 10px 24px rgba(244,138,31,0.14)",
                        pointerEvents: "none"
                      }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Box
              sx={{
                borderRadius: 3,
                border: "1px solid rgba(158, 176, 214, 0.12)",
                backgroundColor: TIMELINE_BLUE
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "150px minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
                  borderBottom: "1px solid rgba(158, 176, 214, 0.12)",
                  backgroundColor: TIMELINE_BLUE
                }}
              >
                <Box sx={{ p: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, color: "common.white" }}>Categorie</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {visibleAffectations.length} affectation{visibleAffectations.length > 1 ? "s" : ""}
                  </Typography>
                </Box>
                <Box sx={{ position: "relative", height: 72, px: 1.25, py: 0.75 }}>
                  {timelineHourBands.map((band, index) => (
                    <Box
                      key={`header-hour-band-${index}`}
                      sx={{
                        position: "absolute",
                        top: 34,
                        bottom: 0,
                        left: `${band.leftPercent}%`,
                        width: `${band.widthPercent}%`,
                        backgroundColor: band.isAlternate ? "rgba(255,255,255,0.03)" : "rgba(9,14,26,0.08)"
                      }}
                    />
                  ))}
                  {timelineBands.map((band, index) => (
                    <Box
                      key={`${band.label}-${index}`}
                      sx={{
                        position: "absolute",
                        top: 0,
                        height: 34,
                        left: `${band.leftPercent}%`,
                        width: `${band.widthPercent}%`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderLeft: index === 0 ? "none" : "1px solid rgba(158, 176, 214, 0.1)",
                        backgroundColor: TIMELINE_BLUE
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "common.white", letterSpacing: "0.02em", textTransform: "capitalize" }}
                      >
                        {band.label}
                      </Typography>
                    </Box>
                  ))}
                  {timelineMarkers.map((marker, index) =>
                    marker.label ? (
                      <Typography
                        key={`label-${index}`}
                        variant="caption"
                        sx={{
                          position: "absolute",
                          bottom: 6,
                          left: `min(${marker.leftPercent}%, calc(100% - 44px))`,
                          color: "primary.main",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          transform: marker.leftPercent === 0 ? "none" : "translateX(-50%)"
                        }}
                      >
                        {marker.label}
                      </Typography>
                    ) : null
                  )}
                </Box>
              </Box>

              {timelineRows.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography color="text.secondary">Aucune categorie disponible pour cette edition.</Typography>
                </Box>
              ) : timelineRows.map((row) => {
                const laneHeight = 72;
                const blockHeight = 60;
                const rowPadding = 6;
                const rowHeight = row.laneCount * laneHeight + rowPadding * 2;

                return (
                  <Box
                    key={row.categorie.categorieId}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "150px minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
                      minHeight: rowHeight,
                      borderBottom: `1px solid ${CATEGORY_SEPARATOR}`,
                      backgroundColor: TIMELINE_BLUE
                      }}
                    >
                      <Stack
                        spacing={0.35}
                        sx={{
                        p: 1.5,
                        borderRight: "1px solid rgba(158, 176, 214, 0.08)",
                        justifyContent: "center"
                        }}
                      >
                        <Stack direction="row" spacing={1.1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: row.categorie.color
                          }}
                        />
                        <Typography sx={{ fontWeight: 700, color: "common.white" }}>{row.categorie.title}</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {row.items.length} visible{row.items.length > 1 ? "s" : ""}
                      </Typography>
                    </Stack>
                    <Box sx={{ position: "relative", minHeight: rowHeight, px: 1.25, py: `${rowPadding}px`, backgroundColor: TIMELINE_BLUE }}>
                      {timelineHourBands.map((band, index) => (
                        <Box
                          key={`row-hour-band-${row.categorie.categorieId}-${index}`}
                          sx={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${band.leftPercent}%`,
                            width: `${band.widthPercent}%`,
                            backgroundColor: band.isAlternate ? "rgba(255,255,255,0.03)" : "rgba(9,14,26,0.08)"
                          }}
                        />
                      ))}

                      {row.items.length === 0 ? (
                        <Typography sx={{ position: "absolute", top: 18, left: 18, color: "text.secondary" }}>
                          Aucun creneau sur cette plage
                        </Typography>
                      ) : (
                        row.items.map((item) => {
                          const affectation = item.affectation;
                          const isMatch = getFilterMatch(
                            affectation,
                            sidebarMode,
                            focusedBenevoleId,
                            focusedCategorieId
                          );
                          const metrics = getBlockMetrics(
                            affectation.startAt,
                            affectation.endAt,
                            parsedViewStart,
                            parsedViewEnd
                          );

                          return (
                            <Box
                              key={affectation.affectationId}
                              onClick={() => setSelectedAffectation(affectation)}
                              sx={{
                                position: "absolute",
                                top: rowPadding + item.laneIndex * laneHeight,
                                left: `${metrics.leftPercent}%`,
                                width: `${metrics.widthPercent}%`,
                                height: blockHeight,
                                px: 1.25,
                                py: 0.75,
                                borderRadius: 2.5,
                                border: `1px solid ${affectation.categorie.color}`,
                                backgroundColor: "#10192b",
                                color: "common.white",
                                cursor: "pointer",
                                overflow: "hidden",
                                opacity: isMatch ? 1 : 0.22,
                                boxShadow: "none"
                              }}
                            >
                              <Stack spacing={0.1}>
                                <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                  {affectation.benevole.pseudo}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "primary.main", lineHeight: 1.2, fontWeight: 700 }}>
                                  {formatTimeLabel(affectation.startAt)} - {formatTimeLabel(affectation.endAt)}
                                </Typography>
                                {affectation.comment ? (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      lineHeight: 1.15,
                                      color: "text.secondary",
                                      display: "-webkit-box",
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden"
                                    }}
                                  >
                                    {affectation.comment}
                                  </Typography>
                                ) : null}
                              </Stack>
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderDetail(): ReactElement | null {
    if (!activeEdition) {
      return null;
    }

    return (
      <Stack spacing={3}>
        {error && !hasPopupOpen ? <Alert severity="error">{error}</Alert> : null}
        {feedback ? <Alert severity="success">{feedback}</Alert> : null}

        {adminMode ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" color="inherit" startIcon={<EditRoundedIcon />} onClick={openEditEditionDialog}>
              Configurer
            </Button>
            <Button variant="outlined" color="inherit" startIcon={<Groups2RoundedIcon />} onClick={() => openCreateBenevoleDialog()}>
              Benevole
            </Button>
            <Button variant="outlined" color="inherit" startIcon={<PaletteRoundedIcon />} onClick={() => openCreateCategorieDialog()}>
              Categorie
            </Button>
          </Stack>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 340px" },
            gap: 3,
            alignItems: "start"
          }}
        >
          {renderTimeline()}
          {renderSidebar()}
        </Box>
      </Stack>
    );
  }

  return (
    <>
      {activeEditionId && (isLoadingEdition || !activeEdition) ? (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5">Chargement du planning...</Typography>
            <Typography color="text.secondary">Lecture de l'edition et construction de la timeline.</Typography>
          </CardContent>
        </Card>
      ) : null}
      {!activeEditionId && isLoadingList ? (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5">Chargement des editions...</Typography>
            <Typography color="text.secondary">Recuperation des projets de planning disponibles.</Typography>
          </CardContent>
        </Card>
      ) : null}
      {activeEditionId ? renderDetail() : renderEditionList()}

      <Dialog open={editionDialogOpen} onClose={closeEditionDialog} fullWidth maxWidth="sm">
        <DialogTitle>{activeEditionId && activeEdition ? "Configurer l'edition" : "Nouvelle edition"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editionDialogOpen && error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Titre"
              value={editionForm.title}
              onChange={(event: InputChangeEvent) =>
                setEditionForm((current) => ({ ...current, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Debut"
              type="datetime-local"
              value={editionForm.startAt}
              onChange={(event: InputChangeEvent) =>
                setEditionForm((current) => ({ ...current, startAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1800 }}
              fullWidth
            />
            <TextField
              label="Fin"
              type="datetime-local"
              value={editionForm.endAt}
              onChange={(event: InputChangeEvent) =>
                setEditionForm((current) => ({ ...current, endAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1800 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeEditionDialog}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => void handleEditionSubmit()} disabled={isSaving || !isEditionFormValid()}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={benevoleDialogOpen} onClose={closeBenevoleDialog} fullWidth maxWidth="sm">
        <DialogTitle>{benevoleForm.benevoleId ? "Modifier le benevole" : "Nouveau benevole"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {benevoleDialogOpen && error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Pseudo"
              value={benevoleForm.pseudo}
              onChange={(event: InputChangeEvent) =>
                setBenevoleForm((current) => ({ ...current, pseudo: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Telephone"
              value={benevoleForm.phone}
              onChange={(event: InputChangeEvent) =>
                setBenevoleForm((current) => ({ ...current, phone: event.target.value }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeBenevoleDialog}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => void handleBenevoleSubmit()} disabled={isSaving || !isBenevoleFormValid()}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categorieDialogOpen} onClose={closeCategorieDialog} fullWidth maxWidth="sm">
        <DialogTitle>{categorieForm.categorieId ? "Modifier la categorie" : "Nouvelle categorie"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {categorieDialogOpen && error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Titre"
              value={categorieForm.title}
              onChange={(event: InputChangeEvent) =>
                setCategorieForm((current) => ({ ...current, title: event.target.value }))
              }
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
              <TextField
                label="Couleur"
                value={categorieForm.color}
                onChange={(event: InputChangeEvent) =>
                  setCategorieForm((current) => ({ ...current, color: event.target.value }))
                }
                fullWidth
              />
              <Box
                component="input"
                type="color"
                value={categorieForm.color}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCategorieForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))
                }
                sx={{
                  width: 64,
                  height: 48,
                  p: 0,
                  border: "none",
                  background: "transparent"
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {CATEGORY_COLOR_PRESETS.map((color) => (
                <Box
                  key={color}
                  component="button"
                  type="button"
                  onClick={() => setCategorieForm((current) => ({ ...current, color }))}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: categorieForm.color === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.16)",
                    backgroundColor: color,
                    cursor: "pointer"
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeCategorieDialog}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => void handleCategorieSubmit()} disabled={isSaving || !isCategorieFormValid()}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={affectationDialogOpen} onClose={closeAffectationDialog} fullWidth maxWidth="sm">
        <DialogTitle>Nouvelle affectation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {affectationDialogOpen && error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              select
              label="Benevole"
              value={affectationForm.benevoleId}
              onChange={(event: InputChangeEvent) =>
                setAffectationForm((current) => ({ ...current, benevoleId: event.target.value }))
              }
              SelectProps={{ native: true }}
              fullWidth
            >
              {(activeEdition?.benevoles ?? []).map((benevole) => (
                <option key={benevole.benevoleId} value={benevole.benevoleId}>
                  {benevole.pseudo}
                </option>
              ))}
            </TextField>
            <TextField
              select
              label="Categorie"
              value={affectationForm.categorieId}
              onChange={(event: InputChangeEvent) =>
                setAffectationForm((current) => ({ ...current, categorieId: event.target.value }))
              }
              SelectProps={{ native: true }}
              fullWidth
            >
              {(activeEdition?.categories ?? []).map((categorie) => (
                <option key={categorie.categorieId} value={categorie.categorieId}>
                  {categorie.title}
                </option>
              ))}
            </TextField>
            <TextField
              label="Debut"
              type="datetime-local"
              value={affectationForm.startAt}
              onChange={(event: InputChangeEvent) =>
                setAffectationForm((current) => ({ ...current, startAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1800 }}
              fullWidth
            />
            <TextField
              label="Fin"
              type="datetime-local"
              value={affectationForm.endAt}
              onChange={(event: InputChangeEvent) =>
                setAffectationForm((current) => ({ ...current, endAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1800 }}
              fullWidth
            />
            <TextField
              label="Commentaire"
              value={affectationForm.comment}
              onChange={(event: InputChangeEvent) =>
                setAffectationForm((current) => ({ ...current, comment: event.target.value }))
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeAffectationDialog}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAffectationSubmit()}
            disabled={isSaving || !isAffectationFormValid()}
          >
            Affecter
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedAffectation)} onClose={closeSelectedAffectationDialog} fullWidth maxWidth="xs">
        <DialogTitle>Detail de l'affectation</DialogTitle>
        <DialogContent>
          {selectedAffectation ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {selectedAffectation && error ? <Alert severity="error">{error}</Alert> : null}
              <Typography variant="h6">{selectedAffectation.benevole.pseudo}</Typography>
              <Typography color="text.secondary">{selectedAffectation.benevole.phone}</Typography>
              <Typography sx={{ color: selectedAffectation.categorie.color, fontWeight: 700 }}>
                {selectedAffectation.categorie.title}
              </Typography>
              <Typography>
                {formatDateTimeLabel(selectedAffectation.startAt)} - {formatDateTimeLabel(selectedAffectation.endAt)}
              </Typography>
              <Typography color="text.secondary">{formatDuration(selectedAffectation.startAt, selectedAffectation.endAt)}</Typography>
              {selectedAffectation.comment ? <Typography>{selectedAffectation.comment}</Typography> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeSelectedAffectationDialog}>
            Fermer
          </Button>
          {adminMode ? (
            <Button
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => void handleDeleteAffectation()}
              disabled={isSaving}
            >
              Supprimer
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
}
