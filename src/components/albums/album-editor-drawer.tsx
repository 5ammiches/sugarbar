"use client";

import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { GenreTagSelector } from "@/components/albums/genre-tag-selector";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Save, X } from "lucide-react";

import TrackEditor from "@/components/albums/track-editor";
import { YouTubeSearchDialog } from "@/components/albums/youtube-search-dialog";
import { SingleAudioProvider } from "@/hooks/use-single-audio";

type AlbumDetailsResponse = {
  album: Doc<"album">;
  primaryArtist?: Doc<"artist"> | null;
  genres: Array<Doc<"genre">>;
  tracks: Array<{
    artist: Doc<"artist">;
    track: Doc<"track">;
    lyric_variants: Array<Doc<"lyric_variant">>;
  }>;
} | null;

type TrackEditState = {
  [trackId: Id<"track">]: Record<string, any>;
};

type VariantEditState = {
  [variantId: Id<"lyric_variant">]: Record<string, any>;
};

interface AlbumEditorDrawerProps {
  albumId?: Id<"album">;
  open: boolean;
  onClose: () => void;
}

interface EditableFieldProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  type?: "text" | "textarea" | "date" | "number";
  className?: string;
  placeholder?: string;
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  placeholder,
}: EditableFieldProps) {
  const stringValue = value?.toString() || "";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const newValue = e.target.value;
    if (type === "number") {
      const numValue = parseInt(newValue) || 0;
      onChange(numValue);
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className={className}>
      <label className="text-sm font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
      {type === "textarea" ? (
        <Textarea
          value={stringValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : (
        <Input
          value={stringValue}
          onChange={handleChange}
          type={type}
          placeholder={placeholder}
          className="text-sm"
        />
      )}
    </div>
  );
}

export function AlbumEditorDrawer({
  albumId,
  open,
  onClose,
}: AlbumEditorDrawerProps) {
  const convex = useConvex();

  const [albumState, setAlbumState] = useState<Record<string, any>>({});
  const [tracksState, setTracksState] = useState<TrackEditState>({});
  const [variantsState, setVariantsState] = useState<VariantEditState>({});
  const [genreIds, setGenreIds] = useState<Id<"genre">[]>([]);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [savingTracks, setSavingTracks] = useState<Record<string, boolean>>({});
  const [retrying, setRetrying] = useState<Record<Id<"track">, boolean>>({});
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>(
    {}
  );

  // YouTube search dialog state per-drawer; each TrackEditor will reuse this
  const [youtubeDialog, setYoutubeDialog] = useState<{
    open: boolean;
    trackId?: Id<"track">;
    title?: string;
    artist?: string;
    expectedDuration?: number;
  }>({ open: false });

  // Custome query dialog for custom lyric requests
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

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    variantId?: Id<"lyric_variant">;
    source?: string;
  }>({
    open: false,
  });

  const { data: details, refetch } = useQuery({
    ...convexQuery(api.db.getAlbumDetails, albumId ? { albumId } : "skip"),
    enabled: !!albumId && open,
  }) as {
    data: AlbumDetailsResponse | undefined;
    refetch: (options?: any) => Promise<any>;
  };

  const { data: previewTrackIds } = useQuery({
    ...convexQuery(
      api.audio.getPreviewTrackIdsForAlbum,
      albumId ? { albumId } : "skip"
    ),
    enabled: !!albumId && open,
  });

  const previewTrackIdSet = useMemo(() => {
    return new Set(previewTrackIds ?? []);
  }, [previewTrackIds]);

  useEffect(() => {
    if (!open) {
      setAlbumState({});
      setTracksState({});
      setVariantsState({});
      setGenreIds([]);
      setExpandedTracks({});
    } else if (details?.genres) {
      setGenreIds(details.genres.map((g) => g._id));
    }
  }, [open, albumId, details?.genres]);

  const handleAlbumChange = (field: string, value: any) => {
    setAlbumState((prev) => ({ ...prev, [field]: value }));
  };

  const saveAlbum = async () => {
    if (!albumId) return;

    const hasAlbumChanges = Object.keys(albumState).length > 0;
    const hasGenreChanges =
      (details?.genres && genreIds.length !== details.genres.length) ||
      (details?.genres &&
        !genreIds.every((id) => details.genres.some((g) => g._id === id)));

    if (!hasAlbumChanges && !hasGenreChanges) return;

    setSavingAlbum(true);
    try {
      if (hasAlbumChanges) {
        await convex.mutation(api.db.updateApprovedAlbum, {
          albumId,
          patch: albumState,
        });
        setAlbumState({});
      }

      if (hasGenreChanges) {
        const currentGenreIds = genres.map((g) => g._id);
        const genresToRemove = currentGenreIds.filter(
          (id) => !genreIds.includes(id)
        );

        for (const genreId of genresToRemove) {
          await convex.mutation(api.genre.removeAlbumGenre, {
            albumId,
            genreId,
          });
        }

        if (genreIds.length > 0) {
          await convex.mutation(api.genre.upsertAlbumGenres, {
            albumId,
            inputs: genreIds,
          });
        }
      }

      await refetch();
    } catch (error) {
      console.error("Failed to save album:", error);
    } finally {
      setSavingAlbum(false);
    }
  };

  const handleTrackChange = (
    trackId: Id<"track">,
    fieldOrPatch: string | Record<string, any>,
    value?: any
  ) => {
    if (typeof fieldOrPatch === "string") {
      setTracksState((prev) => ({
        ...prev,
        [trackId]: { ...prev[trackId], [fieldOrPatch]: value },
      }));
    } else {
      setTracksState((prev) => ({
        ...prev,
        [trackId]: { ...prev[trackId], ...fieldOrPatch },
      }));
    }
  };

  const saveTrack = async (trackId: Id<"track">) => {
    const trackPatch = tracksState[trackId] ?? {};
    const entry = details?.tracks.find((x) => x.track._id === trackId);
    const trackVariants = entry?.lyric_variants ?? [];
    const variantEdits = trackVariants
      .map((v) => ({ v, patch: variantsState[v._id] ?? {} }))
      .filter(({ patch }) => Object.keys(patch).length > 0);

    if (Object.keys(trackPatch).length === 0 && variantEdits.length === 0)
      return;

    setSavingTracks((prev) => ({ ...prev, [trackId]: true }));

    try {
      if (Object.keys(trackPatch).length > 0) {
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
              await convex.mutation(api.db.updateLyricVariant, {
                lyricVariantId: v._id,
                patch,
              });
              setVariantsState((prev) => ({ ...prev, [v._id]: {} }));
            } catch (e) {
              console.error("Failed to save lyric variant", v._id, e);
            }
          })
        );
      }

      await refetch();
    } catch (error) {
      console.error("Failed to save track:", error);
    } finally {
      setSavingTracks((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  const handleVariantChange = (
    variantId: Id<"lyric_variant">,
    field: string,
    value: any
  ) => {
    setVariantsState((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], [field]: value },
    }));
  };

  const retryLyrics = async (trackId: Id<"track">) => {
    setRetrying((prev) => ({ ...prev, [trackId]: true }));

    try {
      await convex.action(api.lyric.fetchLyrics, {
        trackId,
        forceOverwrite: true,
      });

      setTimeout(async () => {
        await refetch();
        setRetrying((prev) => ({ ...prev, [trackId]: false }));
      }, 10000);
    } catch (error) {
      console.error("Failed to retry lyrics:", error);
      setRetrying((prev) => ({ ...prev, [trackId]: false }));
    }
  };

  const openCustomQueryDialog = (trackId: Id<"track">) => {
    const track = details?.tracks.find((t) => t.track._id === trackId);
    setCustomQueryDialog({
      open: true,
      trackId,
      title: track?.track.title || "",
      artist: track?.artist?.name || "",
    });
  };

  const handleCustomRetry = async () => {
    if (!customQueryDialog.trackId) return;

    try {
      await convex.action(api.lyric.fetchLyricsWithCustomQuery, {
        trackId: customQueryDialog.trackId,
        customTitle: customQueryDialog.title,
        customArtist: customQueryDialog.artist,
        forceOverwrite: true,
      });

      setCustomQueryDialog({ open: false, title: "", artist: "" });
      setTimeout(() => refetch(), 10000);
    } catch (error) {
      console.error("Failed to fetch with custom query:", error);
    }
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
    if (!deleteConfirmDialog.variantId) return;

    try {
      await convex.mutation(api.db.deleteLyricVariant, {
        lyricVariantId: deleteConfirmDialog.variantId,
      });

      setDeleteConfirmDialog({ open: false });
      await refetch();
    } catch (error) {
      console.error("Failed to delete lyric variant:", error);
    }
  };

  const toggleTrack = (trackId: string) => {
    setExpandedTracks((prev) => ({
      ...prev,
      [trackId]: !prev[trackId],
    }));
  };

  if (!details) {
    return null;
  }

  const { album, primaryArtist, tracks, genres } = details;
  const hasAlbumChanges = Object.keys(albumState).length > 0;
  const hasGenreChanges =
    genreIds.length !== genres.length ||
    !genreIds.every((id) => genres.some((g) => g._id === id));

  // TrackEditor has been moved to a separate component file:
  // see `src/components/albums/track-editor.tsx` and import above.

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="w-full sm:max-w-4xl p-0"
          style={{ backgroundColor: "var(--background)" }}
        >
          <VisuallyHidden asChild>
            <SheetTitle>Edit Album: {album.title}</SheetTitle>
          </VisuallyHidden>

          <ScrollArea className="h-full">
            <SingleAudioProvider>
              <div className="p-6 space-y-6">
                {/* Album Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Edit Album</h2>
                    <p className="text-muted-foreground">
                      {primaryArtist?.name ?? "Unknown Artist"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(hasAlbumChanges || hasGenreChanges) && (
                      <Button
                        onClick={saveAlbum}
                        disabled={savingAlbum}
                        size="sm"
                      >
                        {savingAlbum ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Album
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onClose}>
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </div>
                </div>

                {/* Album Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Album Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditableField
                      label="Title"
                      value={albumState.title ?? album.title}
                      onChange={(value) => handleAlbumChange("title", value)}
                      placeholder="Album title"
                    />

                    <EditableField
                      label="Edition Tag"
                      value={albumState.edition_tag ?? album.edition_tag}
                      onChange={(value) =>
                        handleAlbumChange("edition_tag", value)
                      }
                      placeholder="e.g., Deluxe, Remaster"
                    />

                    <EditableField
                      label="Release Date"
                      value={albumState.release_date ?? album.release_date}
                      onChange={(value) =>
                        handleAlbumChange("release_date", value)
                      }
                      type="date"
                    />

                    <EditableField
                      label="Total Tracks"
                      value={albumState.total_tracks ?? album.total_tracks}
                      onChange={(value) =>
                        handleAlbumChange("total_tracks", value)
                      }
                      type="number"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">
                      Genres
                    </label>
                    <GenreTagSelector
                      selectedGenreIds={genreIds}
                      onGenresChange={setGenreIds}
                      placeholder="Search and select genres..."
                    />
                  </div>
                </div>

                <Separator />

                {/* Tracks */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Tracks ({tracks.length})
                  </h3>

                  {tracks.map((entry, index) => (
                    <TrackEditor
                      key={entry.track._id}
                      entry={entry}
                      index={index}
                      open={open}
                      tracksState={tracksState}
                      variantsState={variantsState}
                      savingTracks={savingTracks}
                      retrying={retrying}
                      expandedTracks={expandedTracks}
                      setExpandedTracks={setExpandedTracks}
                      handleTrackChange={handleTrackChange}
                      handleVariantChange={handleVariantChange}
                      saveTrack={saveTrack}
                      retryLyrics={retryLyrics}
                      openCustomQueryDialog={openCustomQueryDialog}
                      setYoutubeDialog={setYoutubeDialog}
                      refetch={refetch}
                      previewTrackIdSet={previewTrackIdSet}
                      onDeleteVariant={(variantId, source) =>
                        openDeleteConfirmDialog(variantId, source)
                      }
                    />
                  ))}
                </div>
              </div>
            </SingleAudioProvider>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* YouTube Search Dialog (shared instance) */}
      <YouTubeSearchDialog
        open={youtubeDialog.open}
        onClose={() => setYoutubeDialog((prev) => ({ ...prev, open: false }))}
        trackId={youtubeDialog.trackId}
        initialTitle={youtubeDialog.title}
        initialArtist={youtubeDialog.artist}
        expectedDuration={youtubeDialog.expectedDuration}
        onDownloadSuccess={() => {
          // Refresh album data and clear dialog
          refetch();
          setYoutubeDialog({ open: false });
        }}
      />

      {/* Custom Query Dialog */}
      <Dialog
        open={customQueryDialog.open}
        onOpenChange={(open) =>
          setCustomQueryDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Lyrics Search</DialogTitle>
            <DialogDescription>
              Search for lyrics using custom title and artist names
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <EditableField
              label="Title"
              value={customQueryDialog.title}
              onChange={(value) =>
                setCustomQueryDialog((prev) => ({
                  ...prev,
                  title: value.toString(),
                }))
              }
            />
            <EditableField
              label="Artist"
              value={customQueryDialog.artist}
              onChange={(value) =>
                setCustomQueryDialog((prev) => ({
                  ...prev,
                  artist: value.toString(),
                }))
              }
            />
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
            <Button onClick={handleCustomRetry}>Search</Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lyric Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {deleteConfirmDialog.source}{" "}
              lyrics? This action cannot be undone.
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
