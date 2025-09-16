import { useMemo } from "react";
import { AlbumCard } from "./album-card";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";

type AlbumDoc = Doc<"album">;
type ArtistDoc = Doc<"artist">;
type AlbumWithArtist = AlbumDoc & { artistName?: string };

interface AlbumGridProps {
  albums: AlbumDoc[];
  onAlbumClick: (album: AlbumDoc) => void;
}

export function AlbumGrid({ albums, onAlbumClick }: AlbumGridProps) {
  const artistIds = useMemo(() => {
    const ids: Id<"artist">[] = [];
    for (const al of albums) {
      const id = al.primary_artist_id as Id<"artist"> | undefined;
      if (id) ids.push(id);
    }
    return Array.from(new Set(ids));
  }, [albums]);

  const artists = useQuery(
    api.db.getArtistsByIds,
    artistIds.length > 0 ? { artistIds } : "skip"
  ) as ArtistDoc[] | undefined;

  const artistMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of artists ?? []) {
      m.set(String(a._id), a.name ?? a.name_normalized ?? "Unknown Artist");
    }
    return m;
  }, [artists]);

  const enrichedAlbums = useMemo(() => {
    return albums.map((al) => {
      const name = artistMap.get(String(al.primary_artist_id));
      return name ? ({ ...al, artistName: name } as AlbumWithArtist) : al;
    });
  }, [albums, artistMap]);

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
          album={album as AlbumWithArtist}
          onClick={() => onAlbumClick(album as AlbumDoc)}
        />
      ))}
    </div>
  );
}
