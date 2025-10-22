"use client";

import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Clock,
  Download,
  ExternalLink,
  PlayCircle,
  RefreshCw,
  Search,
} from "lucide-react";

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  durationSec: number;
  url: string;
  category?: string;
}

interface YouTubeSearchDialogProps {
  open: boolean;
  onClose: () => void;
  trackId?: Id<"track">;
  initialTitle?: string;
  initialArtist?: string;
  expectedDuration?: number;
  onDownloadSuccess?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getDurationMatchQuality(
  actual: number,
  expected: number
): "perfect" | "good" | "fair" | "poor" {
  const diff = Math.abs(actual - expected);
  if (diff <= 2) return "perfect";
  if (diff <= 5) return "good";
  if (diff <= 15) return "fair";
  return "poor";
}

function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
        title={title}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}

function SearchResultSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="w-full aspect-video rounded-lg" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function SearchResultCard({
  result,
  expectedDuration,
  onSelect,
  onDownload,
  isDownloading,
  downloadDisabledReason,
}: {
  result: YouTubeSearchResult;
  expectedDuration?: number;
  onSelect: () => void;
  onDownload: (result: YouTubeSearchResult, previewStartSec: number) => void;
  isDownloading: boolean;
  downloadDisabledReason?: string | null;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [previewStartInput, setPreviewStartInput] = useState<string>("0");
  const [previewStartError, setPreviewStartError] = useState<string | null>(
    null
  );

  const matchQuality = expectedDuration
    ? getDurationMatchQuality(result.durationSec, expectedDuration)
    : "good";

  const matchColors = {
    perfect:
      "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    good: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    poor: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  };

  const thumbnailUrl = `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;

  const handleDownloadClick = () => {
    // validate previewStartInput locally and call onDownload
    const parsed = Number.parseInt(previewStartInput || "0", 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setPreviewStartError("Start must be 0 or greater (seconds)");
      return;
    }
    if (result.durationSec && parsed >= result.durationSec) {
      setPreviewStartError("Start must be less than video duration");
      return;
    }
    setPreviewStartError(null);
    onDownload(result, parsed);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {showEmbed ? (
          <div className="space-y-2">
            <YouTubeEmbed videoId={result.videoId} title={result.title} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmbed(false)}
              className="w-full"
            >
              Hide Preview
            </Button>
          </div>
        ) : (
          <div
            className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:bg-muted/80 transition-colors group"
            onClick={() => setShowEmbed(true)}
          >
            <img
              src={thumbnailUrl}
              alt={result.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="bg-white/90 rounded-full p-3 group-hover:scale-110 transition-transform">
                <PlayCircle className="h-8 w-8 text-black" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(result.durationSec)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium text-sm line-clamp-2 leading-tight">
            {result.title}
          </h4>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(result.durationSec)}
            </Badge>

            {expectedDuration && (
              <Badge className={cn("text-xs", matchColors[matchQuality])}>
                {matchQuality === "perfect" && "Perfect match"}
                {matchQuality === "good" && "Good match"}
                {matchQuality === "fair" && "Fair match"}
                {matchQuality === "poor" && "Poor match"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onSelect}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in YouTube
            </Button>

            <div className="flex-1 flex items-center gap-2">
              <Input
                value={previewStartInput}
                onChange={(e) => setPreviewStartInput(e.target.value)}
                className="w-24"
                placeholder="Start (s)"
                aria-label="Preview start seconds"
              />
              <div className="flex-1">
                <Button
                  size="sm"
                  onClick={handleDownloadClick}
                  disabled={isDownloading || !!downloadDisabledReason}
                  className="w-full"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Use This Audio
                    </>
                  )}
                </Button>
                {previewStartError && (
                  <div className="text-xs text-destructive mt-1">
                    {previewStartError}
                  </div>
                )}
                {downloadDisabledReason && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {downloadDisabledReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function YouTubeSearchDialog({
  open,
  onClose,
  trackId,
  initialTitle = "",
  initialArtist = "",
  expectedDuration,
  onDownloadSuccess,
}: YouTubeSearchDialogProps) {
  const [searchTitle, setSearchTitle] = useState(initialTitle);
  const [searchArtist, setSearchArtist] = useState(initialArtist);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);

  const convex = useConvex();

  useEffect(() => {
    if (open) {
      setSearchTitle(initialTitle);
      setSearchArtist(initialArtist);
      setHasSearched(false);
      setDownloadingVideo(null);
    }
  }, [open, initialTitle, initialArtist]);

  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "youtube-search",
      searchTitle,
      searchArtist,
      expectedDuration,
      hasSearched,
    ],
    queryFn: async () => {
      if (!hasSearched || !searchTitle.trim() || !searchArtist.trim()) {
        return [];
      }

      const results = await convex.action(api.audio.searchYouTube, {
        title: searchTitle.trim(),
        artist: searchArtist.trim(),
        durationSec: expectedDuration || 180,
      });

      return results?.items || [];
    },
    enabled: open && hasSearched,
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = useCallback(() => {
    if (searchTitle.trim() && searchArtist.trim()) {
      setHasSearched(true);
    }
  }, [searchTitle, searchArtist]);

  const handleOpenInYouTube = (result: YouTubeSearchResult) => {
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDownloadAudio = async (
    result: YouTubeSearchResult,
    previewStartSec: number
  ) => {
    if (!trackId) {
      console.error("No trackId provided, cannot download audio");
      return;
    }

    // validate again as a safety net
    const parsed = Number.parseInt(String(previewStartSec || 0), 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      console.error("Invalid preview start seconds");
      return;
    }
    if (result.durationSec && parsed >= result.durationSec) {
      console.error("Preview start must be less than video duration");
      return;
    }

    setDownloadingVideo(result.videoId);

    try {
      const success = await convex.action(api.audio.fetchAudioPreviewFromUrl, {
        trackId,
        youtubeUrl: result.url,
        previewStartSec: parsed,
      });

      if (success) {
        onDownloadSuccess?.();
        // Close dialog after successful download
        onClose();
      } else {
        console.error("Failed to download audio: No result returned");
      }
    } catch (err) {
      console.error("Failed to download audio:", err);
    } finally {
      setDownloadingVideo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>YouTube Audio Search</DialogTitle>
          <DialogDescription>
            Search for the right YouTube video and download its audio for this
            track
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Track Title</label>
              <Input
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter track title"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Artist</label>
              <Input
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter artist name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Search</label>
              <Button
                onClick={handleSearch}
                disabled={!searchTitle.trim() || !searchArtist.trim()}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                Search YouTube
              </Button>
            </div>
          </div>

          {expectedDuration && (
            <div className="text-sm text-muted-foreground">
              Expected duration:{" "}
              <Badge variant="outline">
                {formatDuration(expectedDuration)}
              </Badge>
            </div>
          )}

          <ScrollArea className="flex-1 h-full">
            <div className="space-y-4 pr-4 pb-4">
              {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <SearchResultSkeleton key={i} />
                  ))}
                </div>
              )}

              {error && (
                <div className="text-center py-8 text-destructive">
                  <p>Failed to search YouTube. Please try again.</p>
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              )}

              {!isLoading &&
                !error &&
                hasSearched &&
                searchResults &&
                searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No results found. Try adjusting your search terms.</p>
                  </div>
                )}

              {!hasSearched && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    Ready to search YouTube
                  </p>
                  <p className="text-sm">
                    Enter a track title and artist, then click Search to find
                    videos
                  </p>
                </div>
              )}

              {!isLoading && searchResults && searchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((result: YouTubeSearchResult) => (
                    <SearchResultCard
                      key={result.videoId}
                      result={result}
                      expectedDuration={expectedDuration}
                      onSelect={() => handleOpenInYouTube(result)}
                      onDownload={(res, startSec) =>
                        handleDownloadAudio(res, startSec)
                      }
                      isDownloading={downloadingVideo === result.videoId}
                      downloadDisabledReason={
                        !trackId ? "No track selected" : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
