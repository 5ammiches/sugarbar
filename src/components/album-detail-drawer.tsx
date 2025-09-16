"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  Calendar,
  Music,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Share,
} from "lucide-react";

import { AudioPlayer } from "./audio-player";
import { LyricsDisplay } from "./lyrics-display";

type AlbumDetailsResponse = {
  album: Doc<"album">;
  primaryArtist?: Doc<"artist"> | null;
  tracks: Array<{
    track: Doc<"track">;
    lyric_variants: Array<Doc<"lyric_variant">>;
  }>;
} | null;

interface AlbumDetailDrawerProps {
  albumId?: Id<"album"> | undefined | null;
  open: boolean;
  onClose: () => void;
}

function safeFormatDate(value?: string | number | null) {
  if (value == null || value === "") return "";
  try {
    const d = new Date(value as any);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TrackItem({
  track,
  index,
  artistName,
  lyricVariants,
}: {
  track: Doc<"track">;
  index: number;
  artistName?: string;
  lyricVariants: Array<Doc<"lyric_variant">>;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const audioUrl =
    typeof track.metadata === "object" && track.metadata
      ? (track.metadata as any).audio_url ||
        (track.metadata as any).preview_url ||
        undefined
      : undefined;

  return (
    <div className="space-y-3">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-sm text-muted-foreground w-6 text-right">
                {index}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {track.title ?? "Untitled"}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {artistName ?? "Unknown Artist"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDurationMs(track.duration_ms)}
              </span>
              {track.explicit_flag && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  E
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Play className="h-3 w-3" />
              </Button>
              {(lyricVariants.length > 0 || audioUrl) && (
                <div className="ml-1">
                  {expanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {(lyricVariants.length > 0 || audioUrl) && (
          <CollapsibleContent className="pl-12 pr-3 space-y-4">
            {audioUrl && (
              <AudioPlayer
                src={audioUrl}
                title={track.title ?? "Track"}
                artist={artistName ?? "Unknown Artist"}
                duration={track.duration_ms ?? 0}
              />
            )}

            {lyricVariants.length > 0 && (
              <LyricsDisplay
                lyrics={lyricVariants}
                trackTitle={track.title ?? "Track"}
              />
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function AlbumDetailDrawer({
  albumId,
  open,
  onClose,
}: AlbumDetailDrawerProps) {
  const details = useQuery(
    api.db.getAlbumDetails,
    albumId ? { albumId } : "skip"
  ) as AlbumDetailsResponse | undefined;

  const trackArtistIds = useMemo(() => {
    if (!details) return [];
    const ids = details.tracks
      .map((t) => t.track.primary_artist_id as Id<"artist"> | undefined)
      .filter((x): x is Id<"artist"> => !!x);
    return Array.from(new Set(ids));
  }, [details]);

  const trackArtists = useQuery(
    api.db.getArtistsByIds,
    trackArtistIds.length > 0 ? { artistIds: trackArtistIds } : "skip"
  ) as Array<Doc<"artist">> | undefined;

  const trackArtistMap = useMemo(() => {
    const m = new Map<Id<"artist">, Doc<"artist">>();
    (trackArtists ?? []).forEach((a) => m.set(a._id, a));
    return m;
  }, [trackArtists]);

  if (!open) return null;

  if (albumId && details === undefined) {
    return (
      <div
        className="fixed inset-0 z-50 flex"
        role="dialog"
        aria-hidden="false"
      >
        <div
          className="fixed inset-0 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside className="ml-auto w-full max-w-3xl bg-background text-foreground shadow-xl relative z-50 h-full overflow-y-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-3/4 bg-muted rounded" />
            <div className="h-6 w-1/3 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
            <div className="h-6 w-1/2 bg-muted rounded" />
          </div>
        </aside>
      </div>
    );
  }

  if (!details || !details.album) return null;

  const album = details.album;
  const primaryArtist = details.primaryArtist ?? null;
  const tracks = details.tracks ?? [];

  const approvedDate =
    album.approved_at && typeof album.approved_at === "number"
      ? new Date(album.approved_at).toLocaleDateString()
      : "Unknown";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={
                      Array.isArray(album.images) && album.images[0]
                        ? album.images[0]
                        : `/placeholder.svg?height=300&width=300&query=album cover for ${encodeURIComponent(
                            album.title ?? "album"
                          )}`
                    }
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="flex-1 space-y-2">
                  <SheetTitle className="text-2xl font-bold text-balance leading-tight">
                    {album.title ?? "Untitled Album"}
                  </SheetTitle>
                  <p className="text-lg text-muted-foreground">
                    {primaryArtist?.name ?? "Unknown Artist"}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Released: {safeFormatDate(album.release_date)}
                      </span>
                    </div>
                    {album.total_tracks ? (
                      <>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <Music className="h-4 w-4" />
                          <span>{album.total_tracks} tracks</span>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(album.genre_tags) ? album.genre_tags : [])
                      .slice(0, 6)
                      .map((g) => (
                        <Badge key={g} variant="secondary" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    {album.edition_tag && (
                      <Badge variant="outline" className="text-xs">
                        {album.edition_tag}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {album.approved && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Approved on {approvedDate}
                  </span>
                  {album.latest_workflow_id && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      Workflow: {String(album.latest_workflow_id).slice(0, 8)}
                      ...
                    </Badge>
                  )}
                </div>
              )}
            </SheetHeader>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Tracks ({tracks.length})
                </h3>
              </div>

              <div className="space-y-1">
                {tracks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      No tracks available for this album
                    </p>
                  </div>
                )}

                {tracks.map((entry, idx) => {
                  const t = entry.track;
                  const artistId = t.primary_artist_id as
                    | Id<"artist">
                    | undefined;
                  const artistName = artistId
                    ? trackArtistMap.get(artistId)?.name ?? undefined
                    : undefined;
                  return (
                    <TrackItem
                      key={t._id}
                      track={t}
                      index={idx + 1}
                      artistName={artistName}
                      lyricVariants={entry.lyric_variants ?? []}
                    />
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={
                      album.metadata && album.metadata.provider_ids?.spotify
                        ? `https://open.spotify.com/album/${album.metadata.provider_ids.spotify}`
                        : "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Spotify
                  </a>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (album._id) {
                      void navigator.clipboard.writeText(String(album._id));
                    }
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Album ID
                </Button>

                <Button variant="outline" size="sm">
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            {album.metadata && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Metadata</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(album.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default AlbumDetailDrawer;
