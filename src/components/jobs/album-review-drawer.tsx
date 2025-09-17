import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import {
  Check,
  Edit3,
  RefreshCw,
  XCircle,
  Calendar,
  Music,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Disc,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeAlbumTitle } from "@/../convex/utils/helpers";

type Props = {
  open: boolean;
  albumId?: Id<"album">;
  workflowId?: string;
  status?: string;
  onClose: () => void;
};

type TrackEditState = {
  [trackId: Id<"track">]: Record<string, any>;
};

type VariantEditState = {
  [variantId: Id<"lyric_variant">]: Record<string, any>;
};

type TrackPatch = Record<string, any>;

export default function AlbumReviewDrawer({
  open,
  albumId,
  workflowId,
  status,
  onClose,
}: Props) {
  const convex = useConvex();

  const { data: details } = useQuery({
    ...convexQuery(
      api.db.getAlbumDetails,
      albumId ? { albumId: albumId as Id<"album"> } : "skip"
    ),
    enabled: !!albumId,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache data to make subsequent opens instant
    gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache longer
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  }) as {
    data:
      | {
          album: Doc<"album">;
          primaryArtist?: Doc<"artist"> | null;
          tracks: Array<{
            track: Doc<"track">;
            lyric_variants: Array<Doc<"lyric_variant">>;
          }>;
        }
      | undefined;
  };

  const [tracksState, setTracksState] = useState<TrackEditState>({});
  const [variantsState, setVariantsState] = useState<VariantEditState>({});
  const [savingTracks, setSavingTracks] = useState<Record<string, boolean>>({});
  const [retrying, setRetrying] = useState<Record<Id<"track">, boolean>>({});
  const [liveVariantLyrics, setLiveVariantLyrics] = useState<
    Record<Id<"lyric_variant">, string>
  >({});
  const [retryResult, setRetryResult] = useState<
    Record<Id<"track">, "success" | "failed">
  >({});
  const [customQueryDialog, setCustomQueryDialog] = useState<{
    open: boolean;
    trackId?: Id<"track">;
    title: string;
    artist: string;
  }>({
    open: false,
    title: "",
    artist: "",
  });
  const [deletingVariants, setDeletingVariants] = useState<
    Record<Id<"lyric_variant">, boolean>
  >({});
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    variantId?: Id<"lyric_variant">;
    source?: string;
  }>({
    open: false,
  });

  useEffect(() => {
    if (!details) {
      setTracksState({});
      setVariantsState({});
      setSavingTracks({});
      setRetrying({});
      setLiveVariantLyrics({});
      setRetryResult({});
      setCustomQueryDialog({ open: false, title: "", artist: "" });
      setDeletingVariants({});
      setDeleteConfirmDialog({ open: false });
      return;
    }
    const initTracks: TrackEditState = {};
    const initVariants: VariantEditState = {};
    details.tracks.forEach((t) => {
      initTracks[t.track._id] = {};
      (t.lyric_variants ?? []).forEach((v) => {
        initVariants[v._id] = {};
      });
    });
    setTracksState(initTracks);
    setVariantsState(initVariants);
    setLiveVariantLyrics({});
    setRetryResult({});
  }, [details, open]);

  const trackNeedsAttention = (t: {
    track: Doc<"track">;
    lyric_variants: Array<Doc<"lyric_variant">>;
  }) => {
    const s = t.track.lyrics_fetched_status as string | undefined;
    if (s === "failed") return true;
    if (!t.lyric_variants || t.lyric_variants.length === 0) return true;
    return false;
  };

  const handleTrackChange = (
    trackId: Id<"track">,
    fieldOrPatch: string | TrackPatch,
    value?: any
  ): void => {
    setTracksState((prev) => {
      const prevTrack = prev[trackId] ?? {};

      const patch: TrackPatch =
        typeof fieldOrPatch === "string"
          ? { [fieldOrPatch]: value }
          : fieldOrPatch;

      return {
        ...prev,
        [trackId]: {
          ...prevTrack,
          ...patch,
        },
      };
    });
  };

  const handleVariantChange = (
    variantId: Id<"lyric_variant">,
    field: string,
    value: any
  ): void => {
    setVariantsState((prev) => ({
      ...prev,
      [variantId]: { ...(prev[variantId] ?? {}), [field]: value },
    }));
  };

  const hasKeys = (obj: Record<string, any> | undefined) =>
    !!obj && Object.keys(obj).length > 0;

  const saveTrack = async (trackId: Id<"track">) => {
    const trackPatch = tracksState[trackId] ?? {};

    // Collect variant patches for this track (only if they have edits)
    const entry = details?.tracks.find((x) => x.track._id === trackId);
    const trackVariants = entry?.lyric_variants ?? [];
    const variantEdits = trackVariants
      .map((v) => ({ v, patch: variantsState[v._id] ?? {} }))
      .filter(({ patch }) => hasKeys(patch));

    if (!hasKeys(trackPatch) && variantEdits.length === 0) return;

    setSavingTracks((s) => ({ ...s, [trackId]: true }));

    try {
      // 1) Save track fields if present
      if (hasKeys(trackPatch)) {
        await convex.mutation(api.db.updateTrackDetails, {
          trackId,
          patch: trackPatch,
        });
        setTracksState((prev) => ({ ...prev, [trackId]: {} }));
      }

      if (variantEdits.length > 0) {
        await Promise.all(
          variantEdits.map(async ({ v, patch }) => {
            try {
              const updated = await convex.mutation(api.db.updateLyricVariant, {
                lyricVariantId: v._id,
                patch,
              });
              setVariantsState((prev) => ({ ...prev, [v._id]: {} }));

              const newLyrics =
                updated?.lyrics ??
                (typeof patch.lyrics === "string" ? patch.lyrics : undefined);

              if (typeof newLyrics === "string") {
                setLiveVariantLyrics((prev) => ({
                  ...prev,
                  [v._id]: newLyrics,
                }));
              }
            } catch (e) {
              console.error("Failed to save lyric variant", v._id, e);
            }
          })
        );
      }
    } catch (e) {
      console.error("Failed to save track/variants", e);
    } finally {
      setSavingTracks((s) => ({ ...s, [trackId]: false }));
    }
  };

  const openCustomQueryDialog = (trackId: Id<"track">) => {
    const trackEntry = details?.tracks.find((t) => t.track._id === trackId);
    const track = trackEntry?.track;
    if (!track) return;

    const primaryArtist = details?.primaryArtist;
    setCustomQueryDialog({
      open: true,
      trackId,
      title: track.title ?? "",
      artist: primaryArtist?.name ?? "",
    });
  };

  const handleCustomRetry = async () => {
    const { trackId, title, artist } = customQueryDialog;
    if (!trackId || !title.trim() || !artist.trim()) return;

    setCustomQueryDialog({ open: false, title: "", artist: "" });
    await retryLyricsWithCustomQuery(trackId, title.trim(), artist.trim());
  };

  const openDeleteConfirmDialog = (
    variantId: Id<"lyric_variant">,
    source?: string
  ) => {
    setDeleteConfirmDialog({
      open: true,
      variantId,
      source,
    });
  };

  const handleDeleteVariant = async () => {
    const { variantId } = deleteConfirmDialog;
    if (!variantId) return;

    setDeleteConfirmDialog({ open: false });
    setDeletingVariants((prev) => ({ ...prev, [variantId]: true }));

    try {
      await convex.mutation(api.db.deleteLyricVariant, {
        lyricVariantId: variantId,
      });

      // Remove from local state
      setLiveVariantLyrics((prev) => {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      });

      setVariantsState((prev) => {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      });
    } catch (e) {
      console.error("Failed to delete lyric variant", e);
    } finally {
      setDeletingVariants((prev) => ({ ...prev, [variantId]: false }));
    }
  };

  const retryLyricsWithCustomQuery = async (
    trackId: Id<"track">,
    customTitle: string,
    customArtist: string
  ) => {
    setRetrying((r) => ({ ...r, [trackId]: true }));
    setRetryResult((r) => {
      const copy = { ...r };
      delete copy[trackId];
      return copy;
    });

    try {
      try {
        await convex.action(api.lyric.fetchLyricsWithCustomQuery, {
          trackId,
          customTitle,
          customArtist,
          forceOverwrite: true,
        });
      } catch (e) {
        console.error("Trigger custom lyric fetch failed", e);
      }

      if (!albumId) {
        setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
        return;
      }

      const maxAttempts = 10;
      const delayMs = 1000;
      let foundAny = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((res) => setTimeout(res, delayMs));
        try {
          const refreshed = await convex.query(api.db.getAlbumDetails, {
            albumId,
          });
          if (!refreshed || !refreshed.tracks) continue;

          const found = refreshed.tracks.find(
            (tr: any) => tr.track._id === trackId
          );
          if (!found) continue;

          const variants = found.lyric_variants ?? [];
          const updates: Record<Id<"lyric_variant">, string> = {};

          for (const v of variants) {
            if (v.lyrics) {
              updates[v._id] = v.lyrics;
              foundAny = true;

              try {
                const localPatch = variantsState[v._id] ?? {};
                const hasLocalUnsavedEdits = Object.keys(localPatch).length > 0;
                if (!hasLocalUnsavedEdits) {
                  await convex.mutation(api.db.updateLyricVariant, {
                    lyricVariantId: v._id,
                    patch: { lyrics: v.lyrics },
                  });
                }
              } catch (e) {
                console.error("Failed to force-write provider lyrics to DB", e);
              }
            }
          }

          if (foundAny) {
            setLiveVariantLyrics((prev) => ({ ...prev, ...updates }));
            setRetryResult((r) => ({ ...r, [trackId]: "success" }));
            break;
          }
        } catch (e) {
          console.error("Polling album details failed", e);
        }
      }

      if (!foundAny) {
        setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
      }
    } catch (e) {
      console.error("Retry fetch failed", e);
      setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
    } finally {
      setRetrying((r) => ({ ...r, [trackId]: false }));
    }
  };

  const retryLyrics = async (trackId: Id<"track">) => {
    setRetrying((r) => ({ ...r, [trackId]: true }));
    setRetryResult((r) => {
      const copy = { ...r };
      delete copy[trackId];
      return copy;
    });

    try {
      try {
        await convex.action(api.lyric.fetchLyrics, {
          trackId,
          forceOverwrite: true,
        });
      } catch (e) {
        console.error("Trigger lyric fetch failed", e);
      }

      if (!albumId) {
        setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
        return;
      }

      const maxAttempts = 10;
      const delayMs = 1000;
      let foundAny = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((res) => setTimeout(res, delayMs));
        try {
          const refreshed = await convex.query(api.db.getAlbumDetails, {
            albumId,
          });
          if (!refreshed || !refreshed.tracks) continue;

          const found = refreshed.tracks.find(
            (tr: any) => tr.track._id === trackId
          );
          if (!found) continue;

          const variants = found.lyric_variants ?? [];
          const updates: Record<Id<"lyric_variant">, string> = {};

          for (const v of variants) {
            if (v.lyrics) {
              updates[v._id] = v.lyrics;
              foundAny = true;

              try {
                const localPatch = variantsState[v._id] ?? {};
                const hasLocalUnsavedEdits = Object.keys(localPatch).length > 0;
                if (!hasLocalUnsavedEdits) {
                  await convex.mutation(api.db.updateLyricVariant, {
                    lyricVariantId: v._id,
                    patch: { lyrics: v.lyrics },
                  });
                }
              } catch (e) {
                console.error("Failed to force-write provider lyrics to DB", e);
              }
            }
          }

          if (foundAny) {
            setLiveVariantLyrics((prev) => ({ ...prev, ...updates }));
            setRetryResult((r) => ({ ...r, [trackId]: "success" }));
            break;
          }
        } catch (e) {
          console.error("Polling album details failed", e);
        }
      }

      if (!foundAny) {
        setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
      }
    } catch (e) {
      console.error("Retry fetch failed", e);
      setRetryResult((r) => ({ ...r, [trackId]: "failed" }));
    } finally {
      setRetrying((r) => ({ ...r, [trackId]: false }));
    }
  };

  const handleApprove = async () => {
    if (!albumId) return;
    try {
      await convex.mutation(api.db.approveAlbum, {
        albumId,
        workflowId,
      });
      // rely on JobQueue polling to pick up changes
    } catch (e) {
      console.error("Approve failed", e);
    } finally {
      onClose();
    }
  };

  const handleReject = async () => {
    if (!albumId) return;
    const reason = window.prompt("Reason for rejection (optional):", "");
    try {
      await convex.mutation(api.db.rejectAlbum, {
        albumId,
        workflowId,
        reason: reason || undefined,
      });
      // rely on JobQueue polling to pick up changes
    } catch (e) {
      console.error("Reject failed", e);
    } finally {
      onClose();
    }
  };

  const tracks = details?.tracks ?? [];

  // small derived helper to format ms -> mm:ss
  const formatDuration = (ms?: number): string => {
    if (!ms || ms <= 0) return "";
    const totalSeconds = Math.round(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-4xl p-0"
        style={{ backgroundColor: "var(--background)" }}
      >
        <VisuallyHidden asChild>
          <SheetTitle>{details?.album?.title ?? "Album Review"}</SheetTitle>
        </VisuallyHidden>

        <ScrollArea className="h-full">
          {!details ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">
                  Loading album details...
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 text-foreground">
              {/* Header */}
              <SheetHeader className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={
                        details?.album?.images?.[0] ||
                        `/placeholder.svg?height=300&width=300&query=album cover for ${encodeURIComponent(
                          details?.album?.title ?? "album"
                        )}`
                      }
                      alt={details?.album?.title ?? "Album cover"}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="flex-1 space-y-3">
                    <SheetTitle className="text-2xl font-bold text-balance leading-tight">
                      {details?.album?.title ?? "Album Review"}
                    </SheetTitle>
                    <p className="text-lg text-muted-foreground">
                      {details?.primaryArtist?.name ?? "Unknown Artist"}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Released: {details?.album?.release_date ?? "Unknown"}
                        </span>
                      </div>
                      {details?.tracks && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Music className="h-4 w-4" />
                            <span>{details.tracks.length} tracks</span>
                          </div>
                        </>
                      )}
                      {workflowId && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Disc className="h-4 w-4" />
                            <span>Workflow: {workflowId.slice(0, 8)}...</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Actions */}
                <div className="space-y-4">
                  {/* Current Status */}
                  <div
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border",
                      status === "pending_review"
                        ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                        : status === "approved"
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : status === "rejected"
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        : "bg-secondary dark:bg-secondary/20 border-border"
                    )}
                  >
                    {status === "pending_review" && (
                      <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    )}
                    {status === "approved" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    {(status === "rejected" || status === "failed") && (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className="text-sm font-medium">
                      Status: {status?.replace(/_/g, " ") ?? "Unknown"}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={
                        status === "queued" ||
                        status === "in_progress" ||
                        status === "rejected" ||
                        status === "canceled" ||
                        status === "failed"
                      }
                      className="h-10"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>

                    <Button
                      variant="default"
                      onClick={handleApprove}
                      disabled={
                        status === "queued" ||
                        status === "in_progress" ||
                        status === "approved" ||
                        status === "canceled" ||
                        status === "failed"
                      }
                      className="h-10 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="h-10 ml-auto"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <Separator />

              {/* Tracks Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Tracks ({tracks.length})
                  </h3>
                </div>

                {tracks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tracks found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tracks.map((entry, index) => {
                      const t = entry.track;
                      const variants = entry.lyric_variants ?? [];
                      const needsAttention = trackNeedsAttention(entry);
                      const trackPatch = tracksState[t._id] ?? {};
                      const saving = !!savingTracks[t._id];

                      return (
                        <Card key={t._id} className="overflow-hidden">
                          <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-sm text-muted-foreground w-6 text-right">
                                  {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <input
                                    className="w-full bg-transparent border-b pb-1 focus:outline-none focus:border-primary text-base font-medium"
                                    value={
                                      trackPatch.title !== undefined
                                        ? trackPatch.title
                                        : t.title ?? ""
                                    }
                                    onChange={(e) => {
                                      const title = e.target.value;
                                      const { base_title } =
                                        normalizeAlbumTitle(title);
                                      const title_normalized = base_title;

                                      handleTrackChange(t._id, {
                                        title,
                                        title_normalized: title_normalized,
                                      });
                                    }}
                                    placeholder="Track title"
                                  />
                                  <div className="flex items-center gap-2 mt-1">
                                    {t.primary_artist_id && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Primary Artist
                                      </Badge>
                                    )}
                                    {(() => {
                                      const ls = t.lyrics_fetched_status as
                                        | string
                                        | undefined;
                                      if (ls === "failed") {
                                        return (
                                          <Badge
                                            variant="destructive"
                                            className="text-xs"
                                          >
                                            Lyrics failed
                                          </Badge>
                                        );
                                      }
                                      if (ls === "fetching") {
                                        return (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            Fetching lyrics
                                          </Badge>
                                        );
                                      }
                                      if (ls === "fetched") {
                                        return (
                                          <Badge
                                            variant="default"
                                            className="text-xs"
                                          >
                                            Lyrics fetched
                                          </Badge>
                                        );
                                      }
                                      return needsAttention ? (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          No Lyrics
                                        </Badge>
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => retryLyrics(t._id)}
                                  disabled={!!retrying[t._id]}
                                >
                                  {retrying[t._id] ? (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                      Retrying...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Retry Lyrics
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openCustomQueryDialog(t._id)}
                                  disabled={!!retrying[t._id]}
                                >
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Custom Query
                                </Button>

                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => saveTrack(t._id)}
                                  disabled={saving}
                                >
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  {saving ? "Saving..." : "Save"}
                                </Button>
                              </div>
                            </div>

                            {/* Track metadata */}
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <input
                                  type="number"
                                  className="w-25 bg-transparent border rounded px-1 py-1 text-sm"
                                  value={
                                    trackPatch.duration_ms !== undefined
                                      ? String(trackPatch.duration_ms)
                                      : String(t.duration_ms ?? "")
                                  }
                                  onChange={(e) =>
                                    handleTrackChange(
                                      t._id,
                                      "duration_ms",
                                      Number(e.target.value)
                                    )
                                  }
                                  placeholder="ms"
                                />
                                <span className="text-muted-foreground">
                                  ({formatDuration(t.duration_ms)})
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={
                                    trackPatch.explicit_flag !== undefined
                                      ? !!trackPatch.explicit_flag
                                      : !!t.explicit_flag
                                  }
                                  onCheckedChange={(v) =>
                                    handleTrackChange(
                                      t._id,
                                      "explicit_flag",
                                      !!v
                                    )
                                  }
                                  aria-label="Explicit"
                                />
                                <span className="text-sm">Explicit</span>
                              </div>

                              {t.isrc && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  ISRC: {t.isrc}
                                </div>
                              )}

                              {/* Retry result badges */}
                              {retryResult[t._id] === "success" && (
                                <Badge variant="default" className="text-xs">
                                  Fetch success
                                </Badge>
                              )}
                              {retryResult[t._id] === "failed" && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Fetch failed
                                </Badge>
                              )}
                            </div>
                          </CardHeader>

                          {/* Lyrics Section with Tabs */}
                          {variants.length > 0 && (
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-muted-foreground">
                                  Lyrics ({variants.length} variant
                                  {variants.length !== 1 ? "s" : ""})
                                </h4>

                                {variants.length === 1 ? (
                                  // Single variant - no tabs
                                  <div
                                    key={variants[0]._id}
                                    className="space-y-2"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-4">
                                          <span>
                                            Source:{" "}
                                            {variants[0].source ?? "unknown"}
                                          </span>
                                          <span>
                                            Crawled:{" "}
                                            {variants[0].last_crawled_at
                                              ? new Date(
                                                  variants[0].last_crawled_at
                                                ).toLocaleDateString()
                                              : "unknown"}
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            openDeleteConfirmDialog(
                                              variants[0]._id,
                                              variants[0].source
                                            )
                                          }
                                          disabled={
                                            !!deletingVariants[variants[0]._id]
                                          }
                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                          {deletingVariants[variants[0]._id] ? (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </div>
                                      {variants[0].url && (
                                        <div className="text-xs text-muted-foreground/50">
                                          <span className="font-medium">
                                            URL:
                                          </span>{" "}
                                          <a
                                            href={variants[0].url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                                          >
                                            {variants[0].url}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    <textarea
                                      className="w-full bg-muted/30 border rounded-lg p-3 min-h-[120px] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                      value={
                                        typeof (
                                          variantsState[variants[0]._id] ?? {}
                                        ).lyrics !== "undefined"
                                          ? (
                                              variantsState[variants[0]._id] ??
                                              {}
                                            ).lyrics
                                          : liveVariantLyrics[
                                              variants[0]._id
                                            ] ??
                                            variants[0].lyrics ??
                                            ""
                                      }
                                      onChange={(e) =>
                                        handleVariantChange(
                                          variants[0]._id,
                                          "lyrics",
                                          e.target.value
                                        )
                                      }
                                      placeholder="No lyrics available"
                                    />
                                  </div>
                                ) : (
                                  // Multiple variants - use tabs
                                  <Tabs
                                    defaultValue={variants[0]._id}
                                    className="w-full"
                                  >
                                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
                                      {variants.map((variant) => (
                                        <TabsTrigger
                                          key={variant._id}
                                          value={variant._id}
                                          className="text-xs"
                                        >
                                          {variant.source ?? "Unknown"}
                                        </TabsTrigger>
                                      ))}
                                    </TabsList>

                                    {variants.map((variant) => (
                                      <TabsContent
                                        key={variant._id}
                                        value={variant._id}
                                        className="space-y-2 mt-4"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                              <span>
                                                Source:{" "}
                                                {variant.source ?? "unknown"}
                                              </span>
                                              <span>
                                                Crawled:{" "}
                                                {variant.last_crawled_at
                                                  ? new Date(
                                                      variant.last_crawled_at
                                                    ).toLocaleDateString()
                                                  : "unknown"}
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                openDeleteConfirmDialog(
                                                  variant._id,
                                                  variant.source
                                                )
                                              }
                                              disabled={
                                                !!deletingVariants[variant._id]
                                              }
                                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                              {deletingVariants[variant._id] ? (
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </div>
                                          {variant.url && (
                                            <div className="text-xs text-muted-foreground/70">
                                              <span className="font-medium">
                                                URL:
                                              </span>{" "}
                                              <a
                                                href={variant.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                                              >
                                                {variant.url}
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                        <textarea
                                          className="w-full bg-muted/30 border rounded-lg p-3 min-h-[120px] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                          value={
                                            typeof (
                                              variantsState[variant._id] ?? {}
                                            ).lyrics !== "undefined"
                                              ? (
                                                  variantsState[variant._id] ??
                                                  {}
                                                ).lyrics
                                              : liveVariantLyrics[
                                                  variant._id
                                                ] ??
                                                variant.lyrics ??
                                                ""
                                          }
                                          onChange={(e) =>
                                            handleVariantChange(
                                              variant._id,
                                              "lyrics",
                                              e.target.value
                                            )
                                          }
                                          placeholder="No lyrics available"
                                        />
                                      </TabsContent>
                                    ))}
                                  </Tabs>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Metadata Section */}
              {details?.album?.metadata && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Album Metadata</h3>
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64">
                        {JSON.stringify(details.album.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>

      {/* Custom Query Dialog */}
      <Dialog
        open={customQueryDialog.open}
        onOpenChange={(open) =>
          setCustomQueryDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Lyrics Search Query</DialogTitle>
            <DialogDescription>
              Modify the title and artist to improve lyrics search results.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-right">Title</div>
              <Input
                value={customQueryDialog.title}
                onChange={(e) =>
                  setCustomQueryDialog((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="Enter track title"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-right">Artist</div>
              <Input
                value={customQueryDialog.artist}
                onChange={(e) =>
                  setCustomQueryDialog((prev) => ({
                    ...prev,
                    artist: e.target.value,
                  }))
                }
                placeholder="Enter artist name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCustomQueryDialog({ open: false, title: "", artist: "" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomRetry}
              disabled={
                !customQueryDialog.title.trim() ||
                !customQueryDialog.artist.trim()
              }
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry with Custom Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) =>
          setDeleteConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Lyric Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lyric variant from{" "}
              <span className="font-medium">
                {deleteConfirmDialog.source ?? "unknown source"}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVariant}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
