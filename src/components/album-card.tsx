"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

type AlbumCardAlbum = {
  _id?: string;
  title?: string;
  images?: string[];
  // Optional artist fields; pass one of these from callers if available
  artistName?: string;
  primary_artist_name?: string;
  // Metadata
  release_date?: string | number | null;
  total_tracks?: number | null;
  edition_tag?: string | null;
  genre_tags?: string[];
  // Approval flag (Convex album.approved)
  approved?: boolean;
};

interface AlbumCardProps {
  album: AlbumCardAlbum;
  onClick: () => void;
}

function formatDate(value?: string | number | null): string {
  if (value == null) return "";
  try {
    if (typeof value === "number") {
      // If it's a timestamp (ms), format directly
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    // Try to parse string dates, else fall back to raw string
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  } catch {
    return String(value);
  }
}

export function AlbumCard({ album, onClick }: AlbumCardProps) {
  const artist =
    album.artistName ?? album.primary_artist_name ?? "Unknown Artist";

  const hasExplicitTracks = false; // Future: compute if track data is available

  const cover =
    (Array.isArray(album.images) && album.images[0]) ||
    `/placeholder.svg?height=300&width=300&query=album cover for ${encodeURIComponent(
      album.title ?? "album"
    )}`;

  const genres = Array.isArray(album.genre_tags)
    ? album.genre_tags.slice(0, 2)
    : [];

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={`${album.title ?? "Unknown Album"} — ${artist}`}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden rounded-t-lg">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={cover}
            alt={`${album.title ?? "Album"} album cover`}
            className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="p-4 space-y-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-balance">
              {album.title ?? "Unknown Album"}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {artist}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatDate(album.release_date)} ·{" "}
              {Number(album.total_tracks ?? 0)} tracks
              {hasExplicitTracks ? " · E" : ""}
              {album.edition_tag ? ` · ${album.edition_tag}` : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {genres.map((genre: string) => (
                <Badge
                  key={genre}
                  variant="secondary"
                  className="text-xs px-2 py-0.5"
                >
                  {genre}
                </Badge>
              ))}
            </div>

            {album.approved === true && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span className="text-xs font-medium">Approved</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
