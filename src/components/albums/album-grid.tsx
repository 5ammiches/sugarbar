import { useMemo } from "react";
import { AlbumCard } from "./album-card";
import { Doc, Id } from "@/../convex/_generated/dataModel";

type AlbumDoc = Doc<"album">;
type AlbumWithArtistAndFlags = AlbumDoc & { artistName?: string } & {
  flags?: { hasExplicit: boolean; hasLyrics: boolean; hasAudio: boolean };
};

interface AlbumGridProps {
  albums: AlbumDoc[];
  onAlbumClick: (album: AlbumDoc) => void;
  artistMap: Map<Id<"artist">, Doc<"artist">>;
  flagsMap: Map<
    Id<"album">,
    { hasExplicit: boolean; hasLyrics: boolean; hasAudio: boolean }
  >;
}

export function AlbumGrid({
  albums,
  onAlbumClick,
  artistMap,
  flagsMap,
}: AlbumGridProps) {
  const artistNameMap = useMemo(() => {
    const m = new Map<Id<"artist">, string>();
    const source = artistMap ?? new Map<Id<"artist">, Doc<"artist">>();
    for (const [id, a] of source) {
      m.set(id, a?.name ?? a?.name_normalized ?? "Unknown Artist");
    }
    return m;
  }, [artistMap]);

  const enrichedAlbums = useMemo(() => {
    return albums.map((al) => {
      const name = artistNameMap.get(al.primary_artist_id);
      const flags = flagsMap?.get(al._id);
      return {
        ...al,
        artistName: name ?? "Unknown Artist",
        flags,
      } as AlbumWithArtistAndFlags;
    });
  }, [albums, artistNameMap]);

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            No approved albums yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Search for albums and approve them in the Job Queue to see them
            here.
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              Go to Search
            </button>
            <button className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors">
              Go to Job Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {enrichedAlbums.map((album) => (
        <AlbumCard
          key={album._id}
          album={album as AlbumWithArtistAndFlags}
          onClick={() => onAlbumClick(album as AlbumDoc)}
        />
      ))}
    </div>
  );
}
