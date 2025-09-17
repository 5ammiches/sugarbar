import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";

import { AlbumGrid } from "@/components/albums/album-grid";
import {
  AlbumFilters,
  type FilterState,
} from "@/components/albums/album-filters";
import { AlbumDetailDrawer } from "@/components/albums/album-detail-drawer";

type AlbumDoc = Doc<"album">;

function normalize(str?: string | null) {
  return (str ?? "").toLowerCase().trim();
}

export default function AlbumGallery() {
  const [selectedAlbumId, setSelectedAlbumId] = useState<Id<"album"> | null>(
    null
  );
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    artistId: "",
    year: "",
    genres: [],
    hasExplicit: null,
    hasLyrics: null,
    hasAudio: null,
    sortBy: "newest",
  });

  const { data: approvedAlbums = [] } = useQuery({
    ...convexQuery(api.db.getApprovedAlbums, {}),
  }) as { data: AlbumDoc[] };

  const albumIds = useMemo(
    () => approvedAlbums.map((a) => a._id),
    [approvedAlbums]
  );

  // Content flags (explicit/lyrics/audio) per album
  const { data: flagList = [] } = useQuery({
    ...convexQuery(api.db.getAlbumContentFlags, albumIds.length > 0 ? { albumIds } : "skip"),
    enabled: albumIds.length > 0,
  });

  const flagsMap = useMemo(() => {
    const m = new Map<
      Id<"album">,
      { hasExplicit: boolean; hasLyrics: boolean; hasAudio: boolean }
    >();
    for (const f of flagList) m.set(f.albumId, f);
    return m;
  }, [flagList]);

  const primaryArtistIds = useMemo(() => {
    const ids = approvedAlbums
      .map((a) => a.primary_artist_id as Id<"artist"> | undefined)
      .filter(Boolean) as Id<"artist">[];
    return Array.from(new Set(ids));
  }, [approvedAlbums]);

  const { data: artists = [] } = useQuery({
    ...convexQuery(api.db.getArtistsByIds, primaryArtistIds.length > 0 ? { artistIds: primaryArtistIds } : "skip"),
    enabled: primaryArtistIds.length > 0,
  });

  const artistMap = useMemo(() => {
    const m = new Map<Id<"artist">, Doc<"artist">>();
    for (const a of artists) m.set(a._id, a);
    return m;
  }, [artists]);

  const filteredAlbums = useMemo(() => {
    const list = approvedAlbums;
    const q = normalize(filters.search);

    const filtered = list.filter((album) => {
      // Artist filter (ignore sentinel "all-artists")
      if (filters.artistId && filters.artistId !== "all-artists") {
        if (String(album.primary_artist_id) !== filters.artistId) return false;
      }

      // Year filter (ignore sentinel "all-years")
      if (filters.year && filters.year !== "all-years") {
        const y = new Date(album.release_date).getFullYear();
        if (String(y) !== String(filters.year)) return false;
      }

      // Genre filters: require all selected genres to be present
      if ((filters.genres?.length ?? 0) > 0) {
        // const set = new Set(album.genre_tags ?? []);
        // TODO update for genre tags
        const set = new Set();
        for (const g of filters.genres) {
          if (!set.has(g)) return false;
        }
      }

      // Content flags
      const f = flagsMap.get(album._id);
      if (filters.hasExplicit === true && !f?.hasExplicit) return false;
      if (filters.hasLyrics === true && !f?.hasLyrics) return false;
      if (filters.hasAudio === true && !f?.hasAudio) return false;

      // Free text search over album title and primary artist name
      if (q) {
        const t = normalize(album.title);
        const artistName =
          artistMap.get(album.primary_artist_id as Id<"artist">)?.name ?? "";
        const an = normalize(artistName);
        if (!t.includes(q) && !an.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case "newest": {
          const da = new Date(a.release_date).getTime() || 0;
          const db = new Date(b.release_date).getTime() || 0;
          return db - da;
        }
        case "oldest": {
          const da = new Date(a.release_date).getTime() || 0;
          const db = new Date(b.release_date).getTime() || 0;
          return da - db;
        }
        case "title": {
          return normalize(a.title).localeCompare(normalize(b.title));
        }
        case "artist": {
          const an =
            artistMap.get(a.primary_artist_id as Id<"artist">)?.name ?? "";
          const bn =
            artistMap.get(b.primary_artist_id as Id<"artist">)?.name ?? "";
          return normalize(an).localeCompare(normalize(bn));
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [approvedAlbums, filters, flagsMap, artistMap]);

  const handleAlbumClick = (album: AlbumDoc) => {
    setSelectedAlbumId(album._id);
  };

  const handleCloseDrawer = () => {
    setSelectedAlbumId(null);
  };

  const totalCount = approvedAlbums.length;
  const filteredCount = filteredAlbums.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-balance">
              Approved Albums
            </h1>
            <p className="text-muted-foreground">
              Browse and explore your approved album collection ({filteredCount}{" "}
              of {totalCount} albums)
            </p>
          </div>

          <AlbumFilters
            filters={filters}
            onFiltersChange={setFilters}
            albums={approvedAlbums}
            artistMap={artistMap}
          />

          {/* AlbumGrid also expects Album[], cast for compatibility */}
          <AlbumGrid
            albums={filteredAlbums}
            onAlbumClick={handleAlbumClick}
            artistMap={artistMap}
            flagsMap={flagsMap}
          />
        </div>
      </div>

      <AlbumDetailDrawer
        albumId={selectedAlbumId ?? undefined}
        open={!!selectedAlbumId}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
