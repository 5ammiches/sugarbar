"use client";

import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { AudioPlayer } from "@/components/albums/audio-player";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TrackEditState = {
  [trackId: Id<"track">]: Record<string, any>;
};

type VariantEditState = {
  [variantId: Id<"lyric_variant">]: Record<string, any>;
};

interface Entry {
  artist: Doc<"artist"> | null;
  track: Doc<"track">;
  lyric_variants: Array<Doc<"lyric_variant">>;
}

interface YoutubeDialogState {
  open: boolean;
  trackId?: Id<"track">;
  title?: string;
  artist?: string;
  expectedDuration?: number;
}

interface TrackEditorProps {
  entry: Entry;
  index: number;
  open: boolean; // whether the parent drawer is open
  tracksState: TrackEditState;
  variantsState: VariantEditState;
  savingTracks: Record<string, boolean>;
  retrying: Record<Id<"track">, boolean>;
  expandedTracks: Record<string, boolean>;
  setExpandedTracks: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>
  ) => void;
  handleTrackChange: (
    trackId: Id<"track">,
    fieldOrPatch: string | Record<string, any>,
    value?: any
  ) => void;
  handleVariantChange: (
    variantId: Id<"lyric_variant">,
    field: string,
    value: any
  ) => void;
  saveTrack: (trackId: Id<"track">) => Promise<void>;
  retryLyrics: (trackId: Id<"track">) => Promise<void>;
  openCustomQueryDialog: (trackId: Id<"track">) => void;
  setYoutubeDialog: (state: YoutubeDialogState) => void;
  refetch: (options?: any) => Promise<any>;
  onDeleteVariant?: (variantId: Id<"lyric_variant">, source?: string) => void;
  previewTrackIdSet: Set<Id<"track">>;
}

/**
 * Validate preview URL for AudioPlayer
 */
function isValidPreviewUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:", "blob:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Small circular progress component using SVG.
 * percent: 0-100
 */
function ProgressRing({
  percent,
  size = 16,
  stroke = 2,
  className = "",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        stroke="var(--muted-fill, rgba(0,0,0,0.08))"
        fill="transparent"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        fill="transparent"
      />
    </svg>
  );
}

export function TrackEditor({
  entry,
  index,
  open,
  tracksState,
  variantsState,
  savingTracks,
  retrying,
  expandedTracks,
  setExpandedTracks,
  handleTrackChange,
  handleVariantChange,
  saveTrack,
  retryLyrics,
  openCustomQueryDialog,
  setYoutubeDialog,
  refetch,
  onDeleteVariant,
  previewTrackIdSet,
}: TrackEditorProps) {
  const { track, artist, lyric_variants } = entry;
  const trackId = track._id;
  const isExpanded = !!expandedTracks[trackId];
  const hasTrackChanges = Object.keys(tracksState[trackId] || {}).length > 0;
  const hasVariantChanges = lyric_variants.some(
    (v) => Object.keys(variantsState[v._id] || {}).length > 0
  );
  const isSaving = !!savingTracks[trackId];
  const isRetrying = !!retrying[trackId];

  // Fetch preview (uses convex query defined in server)
  const { data: preview } = useQuery({
    ...convexQuery(api.audio.getTrackPreview, { trackId }),
    enabled: !!open && !!trackId && isExpanded,
    staleTime: 60 * 1000,
  }) as { data: { url: string; meta: any } | null };

  const previewUrl = preview?.url;
  const canPlayPreview = isValidPreviewUrl(previewUrl);

  // local dialog progress state (0-100)
  const [dialogProgress, setDialogProgress] = useState<Record<string, number>>(
    {}
  );
  const intervalRefs = useRef<Record<string, number | null>>({});

  useEffect(() => {
    // If preview becomes available for this track, consider youtube search progress complete.
    if (previewUrl) {
      setDialogProgress((prev) => {
        if (!prev[trackId]) return prev;
        return { ...prev, [trackId]: 100 };
      });
      // clear interval and remove progress UI a bit later
      if (intervalRefs.current[`${trackId}-youtube`]) {
        window.clearInterval(
          intervalRefs.current[`${trackId}-youtube`] as number
        );
        intervalRefs.current[`${trackId}-youtube`] = null;
      }
      setTimeout(() => {
        setDialogProgress((prev) => {
          const next = { ...prev };
          delete next[trackId];
          return next;
        });
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, trackId]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalRefs.current).forEach((id) => {
        if (id) window.clearInterval(id);
      });
    };
  }, []);

  const startProgressFor = useCallback((key: string, trackKey: string) => {
    // initialize to small value and increment slowly until 95
    setDialogProgress((prev) => ({ ...prev, [trackKey]: 4 }));
    if (intervalRefs.current[key]) {
      window.clearInterval(intervalRefs.current[key] as number);
    }
    intervalRefs.current[key] = window.setInterval(() => {
      setDialogProgress((prev) => {
        const current = prev[trackKey] ?? 0;
        if (current >= 95) {
          return prev;
        }
        const next = Math.min(95, current + Math.random() * 6 + 2);
        return { ...prev, [trackKey]: Math.round(next) };
      });
    }, 500);
  }, []);

  const finishProgressFor = useCallback((key: string, trackKey: string) => {
    if (intervalRefs.current[key]) {
      window.clearInterval(intervalRefs.current[key] as number);
      intervalRefs.current[key] = null;
    }
    setDialogProgress((prev) => ({ ...prev, [trackKey]: 100 }));
    setTimeout(() => {
      setDialogProgress((prev) => {
        const next = { ...prev };
        delete next[trackKey];
        return next;
      });
    }, 700);
  }, []);

  const toggleTrack = (trackIdToToggle: string) => {
    setExpandedTracks((prev) => ({
      ...prev,
      [trackIdToToggle]: !prev[trackIdToToggle],
    }));
  };

  const openYoutubeForTrack = () => {
    // start local progress UI for this track's youtube dialog
    startProgressFor(`${trackId}-youtube`, trackId);
    setYoutubeDialog({
      open: true,
      trackId,
      title: track.title,
      artist: artist?.name,
      expectedDuration: Math.round(track.duration_ms / 1000),
    });
    // as a safety, if preview doesn't arrive, finish after 20s
    window.setTimeout(() => {
      if (!previewUrl) {
        finishProgressFor(`${trackId}-youtube`, trackId);
      }
    }, 20_000);
  };

  const handleOpenCustomQueryDialog = (tid: Id<"track">) => {
    // Start progress UI for custom dialog
    startProgressFor(`${tid}-custom`, tid);
    try {
      openCustomQueryDialog(tid);
    } catch {
      // ignore errors from parent
    }
    // If the parent never signals completion, complete in 18s
    window.setTimeout(() => {
      finishProgressFor(`${tid}-custom`, tid);
    }, 18_000);
  };

  const handleRetryLyrics = async (tid: Id<"track">) => {
    // If parent manages retrying boolean, we show that. Also show local progress fallback.
    startProgressFor(`${tid}-retry`, tid);
    try {
      await retryLyrics(tid);
    } catch {
      // ignore - parent may surface errors
    } finally {
      finishProgressFor(`${tid}-retry`, tid);
    }
  };

  /**
   * New: Wrap save action with local progress UI and handler.
   * This ensures the save button shows a progress ring while the parent saveTrack is running,
   * and provides a fallback completion if the parent doesn't update state.
   */
  const handleSaveTrack = useCallback(
    async (tid: Id<"track">) => {
      startProgressFor(`${tid}-save`, tid);
      try {
        await saveTrack(tid);
      } catch {
        // parent may throw; don't block UI
      } finally {
        // mark finished (will clear after short timeout)
        finishProgressFor(`${tid}-save`, tid);
      }
    },
    [saveTrack, startProgressFor, finishProgressFor]
  );

  const onDownloadSuccess = async () => {
    try {
      await refetch();
    } catch {
      // ignore
    }
  };

  const progressForTrack = (tid: string) => {
    return dialogProgress[tid] ?? 0;
  };

  return (
    <div key={trackId} className="border rounded-lg p-4">
      <Collapsible open={isExpanded}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger
            onClick={() => toggleTrack(trackId)}
            className="flex items-center gap-2 text-left hover:bg-muted/50 p-2 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <div>
              <div className="font-medium">
                {index + 1}. {track.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {artist?.name} • {Math.round(track.duration_ms / 1000)}s
                {previewTrackIdSet.has(track._id) && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Audio
                  </Badge>
                )}
                {lyric_variants.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Lyrics
                  </Badge>
                )}
                {track.explicit_flag && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    E
                  </Badge>
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <div className="flex gap-2">
            {(hasTrackChanges || hasVariantChanges) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={() => handleSaveTrack(trackId)}
                      disabled={isSaving}
                      size="sm"
                      variant="outline"
                    >
                      {isSaving ? (
                        // when saving, if we have a tracked progress show it, otherwise spinning icon
                        progressForTrack(trackId) > 0 ? (
                          <div className="flex items-center">
                            <ProgressRing
                              percent={progressForTrack(trackId)}
                              size={16}
                              stroke={2}
                              className="text-primary"
                            />
                          </div>
                        ) : (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        )
                      ) : progressForTrack(trackId) > 0 ? (
                        <ProgressRing
                          percent={progressForTrack(trackId)}
                          size={16}
                          stroke={2}
                          className="text-primary"
                        />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {isSaving ? "Saving changes…" : "Save changes"}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={() => handleRetryLyrics(trackId)}
                    disabled={isRetrying}
                    size="sm"
                    variant="outline"
                  >
                    {isRetrying ? (
                      // parent-managed boolean - show spinning icon
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : progressForTrack(trackId) > 0 ? (
                      // show progress ring for locally tracked retry progress
                      <ProgressRing
                        percent={progressForTrack(trackId)}
                        size={16}
                        stroke={2}
                        className="text-primary"
                      />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {isRetrying ? "Retrying lyrics…" : "Retry lyrics"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={() => handleOpenCustomQueryDialog(trackId)}
                    size="sm"
                    variant="outline"
                  >
                    {progressForTrack(trackId) > 0 ? (
                      <ProgressRing
                        percent={progressForTrack(trackId)}
                        size={16}
                        stroke={2}
                        className="text-primary"
                      />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {progressForTrack(trackId) > 0
                  ? `Custom dialogue: ${progressForTrack(trackId)}%`
                  : "Open custom 3D dialogue"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={openYoutubeForTrack}
                    size="sm"
                    variant="outline"
                    title="Search YouTube for audio"
                  >
                    {progressForTrack(trackId) > 0 ? (
                      <ProgressRing
                        percent={progressForTrack(trackId)}
                        size={16}
                        stroke={2}
                        className="text-primary"
                      />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {progressForTrack(trackId) > 0
                  ? `Searching YouTube: ${progressForTrack(trackId)}%`
                  : "Search YouTube for audio"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <CollapsibleContent>
          {isExpanded && (
            <div className="mt-4 space-y-4">
              {/* Track Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Title
                  </label>
                  <Input
                    value={tracksState[trackId]?.title ?? track.title}
                    onChange={(e) =>
                      handleTrackChange(trackId, "title", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Track Number
                  </label>
                  <Input
                    value={
                      tracksState[trackId]?.track_number ?? track.track_number
                    }
                    onChange={(e) =>
                      handleTrackChange(
                        trackId,
                        "track_number",
                        Number(e.target.value)
                      )
                    }
                    type="number"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Duration (ms)
                  </label>
                  <Input
                    value={
                      tracksState[trackId]?.duration_ms ?? track.duration_ms
                    }
                    onChange={(e) =>
                      handleTrackChange(
                        trackId,
                        "duration_ms",
                        Number(e.target.value)
                      )
                    }
                    type="number"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    ISRC
                  </label>
                  <Input
                    value={tracksState[trackId]?.isrc ?? track.isrc}
                    onChange={(e) =>
                      handleTrackChange(trackId, "isrc", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Audio Preview Player (uses shared AudioPlayer) */}
              <div className="space-y-2">
                <h4 className="font-medium">Audio Preview</h4>

                {!previewUrl && (
                  <div className="text-sm text-muted-foreground">
                    No preview available. Use the YouTube search button to find
                    and download audio for this track.
                  </div>
                )}

                {previewUrl && !canPlayPreview && (
                  <div className="text-sm text-rose-600">
                    Preview URL is invalid and cannot be played.
                  </div>
                )}

                {previewUrl && canPlayPreview && (
                  <AudioPlayer
                    src={previewUrl}
                    title={track.title ?? "Track"}
                    artist={artist?.name ?? "Unknown Artist"}
                    duration={track.duration_ms ?? 0}
                    autoPlay={false}
                  />
                )}
              </div>

              {/* Lyric Variants */}
              {lyric_variants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Lyrics</h4>
                  {lyric_variants.map((variant) => (
                    <div
                      key={variant._id}
                      className="border rounded p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{variant.source}</Badge>
                          {variant.url && (
                            <a
                              href={variant.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Source
                            </a>
                          )}
                        </div>
                        <Button
                          onClick={() =>
                            onDeleteVariant
                              ? onDeleteVariant(variant._id, variant.source)
                              : undefined
                          }
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Textarea
                        value={
                          variantsState[variant._id]?.lyrics ?? variant.lyrics
                        }
                        onChange={(e) =>
                          handleVariantChange(
                            variant._id,
                            "lyrics",
                            e.target.value
                          )
                        }
                        placeholder="Lyrics..."
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default TrackEditor;
