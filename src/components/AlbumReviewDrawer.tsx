import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConvex, useQuery } from "convex/react";
import { Check, Edit3, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

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

export default function AlbumReviewDrawer({
  open,
  albumId,
  workflowId,
  status,
  onClose,
}: Props) {
  const convex = useConvex();

  const details = useQuery(
    api.db.getAlbumDetails,
    albumId ? { albumId: albumId as Id<"album"> } : "skip"
  ) as
    | {
        album: Doc<"album">;
        primaryArtist?: Doc<"artist"> | null;
        tracks: Array<{
          track: Doc<"track">;
          lyric_variants: Array<Doc<"lyric_variant">>;
        }>;
      }
    | undefined;

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

  useEffect(() => {
    if (!details) {
      setTracksState({});
      setVariantsState({});
      setSavingTracks({});
      setRetrying({});
      setLiveVariantLyrics({});
      setRetryResult({});
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
    field: string,
    value: any
  ): void => {
    setTracksState((prev) => ({
      ...prev,
      [trackId]: { ...(prev[trackId] ?? {}), [field]: value },
    }));
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
      // Done saving this track
      setSavingTracks((s) => ({ ...s, [trackId]: false }));
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

          const found = refreshed.tracks.find((tr) => tr.track._id === trackId);
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      aria-hidden={open ? "false" : "true"}
      role="dialog"
    >
      {/* overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* drawer panel */}
      <aside className="ml-auto w-full max-w-3xl bg-background text-foreground shadow-xl relative z-50 h-full max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-xl font-semibold">
              {details?.album?.title ?? "Album"}
            </h3>
            <div className="text-sm text-muted-foreground">
              {details?.primaryArtist?.name ?? "-"} —{" "}
              {details?.album?.release_date ?? "-"}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                onClose();
              }}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Album metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-1">
              {details?.album?.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={details.album.images?.[0]}
                  alt={details.album.title ?? "Album cover"}
                  className="w-48 h-48 object-cover rounded"
                />
              ) : (
                <div className="w-48 h-48 bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">
                  No cover
                </div>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <div>
                <div className="text-sm text-muted-foreground">Album</div>
                <div className="text-lg font-medium">
                  {details?.album?.title}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Artist</div>
                <div className="text-base">{details?.primaryArtist?.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Metadata</div>
                <pre className="text-xs rounded bg-muted/10 p-2 overflow-auto max-h-28">
                  {JSON.stringify(details?.album?.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Tracks list */}
          <div>
            <h4 className="text-lg font-semibold mb-2">Tracks</h4>
            <div className="space-y-4">
              {tracks.length === 0 && (
                <div className="text-muted-foreground">No tracks found</div>
              )}

              {tracks.map((entry) => {
                const t = entry.track;
                const variants = entry.lyric_variants ?? [];
                const needsAttention = trackNeedsAttention(entry);
                const trackPatch = tracksState[t._id] ?? {};
                const saving = !!savingTracks[t._id];

                return (
                  <div key={t._id} className="border rounded p-3 bg-surface/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-sm text-muted-foreground">
                            {t.track_number ?? "-"}
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              className="w-full bg-transparent border-b pb-1 focus:outline-none"
                              value={
                                trackPatch.title !== undefined
                                  ? trackPatch.title
                                  : t.title ?? ""
                              }
                              onChange={(e) =>
                                handleTrackChange(
                                  t._id,
                                  "title",
                                  e.target.value
                                )
                              }
                              placeholder="Track title"
                            />
                            <div className="text-xs text-muted-foreground mt-1">
                              {t.primary_artist_id
                                ? "Primary artist track"
                                : ""}
                            </div>
                          </div>

                          {(() => {
                            const ls =
                              (t.lyrics_fetched_status as string | undefined) ??
                              undefined;
                            if (ls === "failed") {
                              return (
                                <Badge variant={"destructive" as any}>
                                  Lyrics failed
                                </Badge>
                              );
                            }
                            if (ls === "fetching") {
                              return (
                                <Badge variant={"secondary" as any}>
                                  Fetching lyrics
                                </Badge>
                              );
                            }
                            if (ls === "fetched") {
                              return (
                                <Badge variant={"default" as any}>
                                  Lyrics fetched
                                </Badge>
                              );
                            }
                            // fallback: if there is no status but the track otherwise needs attention, show attention badge
                            return needsAttention ? (
                              <Badge variant={"destructive" as any}>
                                No Lyrics
                              </Badge>
                            ) : null;
                          })()}
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-muted-foreground">
                              Duration
                            </div>
                            <input
                              type="number"
                              className="w-28 bg-transparent border rounded px-2 py-1 text-sm"
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
                            <div className="text-xs text-muted-foreground ml-2">
                              {formatDuration(t.duration_ms)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={
                                  trackPatch.explicit_flag !== undefined
                                    ? !!trackPatch.explicit_flag
                                    : !!t.explicit_flag
                                }
                                onCheckedChange={(v) =>
                                  handleTrackChange(t._id, "explicit_flag", !!v)
                                }
                                aria-label="Explicit"
                              />
                              <span className="text-sm">Explicit</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-muted-foreground">
                          {t.isrc ?? ""}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
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

                            {/* show small badge for the result of the last retry attempt */}
                            {retryResult[t._id] === "success" && (
                              <Badge variant={"default"}>Fetch success</Badge>
                            )}
                            {retryResult[t._id] === "failed" && (
                              <Badge variant={"destructive"}>
                                Fetch failed
                              </Badge>
                            )}

                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => saveTrack(t._id)}
                              disabled={!!savingTracks[t._id]}
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              {savingTracks[t._id] ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lyric variants */}
                    <div className="mt-3 space-y-2">
                      <div className="text-sm text-muted-foreground mb-1">
                        Lyric Variants
                      </div>

                      {variants.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          No lyric variants
                        </div>
                      )}

                      {variants.map((v) => {
                        const varPatch = variantsState[v._id] ?? {};
                        return (
                          <div
                            key={v._id}
                            className="border rounded p-2 bg-background/50"
                          >
                            <div className="text-xs text-muted-foreground mb-1">
                              Source: {v.source ?? "unknown"} • Crawled:{" "}
                              {v.last_crawled_at
                                ? new Date(v.last_crawled_at).toLocaleString()
                                : "unknown"}
                            </div>
                            <textarea
                              className="w-full bg-transparent border rounded p-2 min-h-[80px] text-sm"
                              value={
                                typeof varPatch.lyrics !== "undefined"
                                  ? varPatch.lyrics
                                  : liveVariantLyrics[v._id] ?? v.lyrics ?? ""
                              }
                              onChange={(e) =>
                                handleVariantChange(
                                  v._id,
                                  "lyrics",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
