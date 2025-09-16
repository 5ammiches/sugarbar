import { api } from "@/../convex/_generated/api";
import { Album } from "@/../convex/utils/typings";
import {
  Route as SearchRoute,
  type SearchParams,
} from "@/routes/_dashboard/index";
import { useConvex } from "convex/react";
import React from "react";
import SearchResultsTable, { type SearchRow } from "./SearchResultsTable";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent as SelectContentComponent,
  SelectItem as SelectItemComponent,
  SelectTrigger as SelectTriggerComponent,
  SelectValue as SelectValueComponent,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Search as SearchIcon } from "lucide-react";
import { convexQuery } from "@convex-dev/react-query";

const searchTypes = [
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
  { value: "track", label: "Tracks" },
  { value: "playlist", label: "Playlists" },
];

export default function Search() {
  const convex = useConvex();

  const navigate = useNavigate();
  const { q, type } = SearchRoute.useSearch();
  type SearchType = "album" | "artist" | "track" | "playlist";
  const searchQuery = q ?? "";
  const searchType: SearchType = (type as SearchType | undefined) ?? "album";

  const [qDraft, setQDraft] = React.useState(searchQuery);
  const [typeDraft, setTypeDraft] = React.useState<SearchType>(searchType);

  const setUrlSearch = (next: Partial<SearchParams>, replace = false) =>
    navigate({
      to: "/",
      search: (prev: SearchParams): SearchParams => ({ ...prev, ...next }),
      replace,
    });

  const submitSearch = () => {
    setUrlSearch({ q: qDraft.trim() || undefined, type: typeDraft });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitSearch();
  };

  const [selectedAlbums, setSelectedAlbums] = React.useState<string[]>([]);
  const [selectedAlbum, setSelectedAlbum] = React.useState<any>(null);
  const [adding, setAdding] = React.useState<
    Record<string, "idle" | "adding" | "success" | "error">
  >({});

  const mapAlbumsToRows = React.useCallback((albums: Album[]): SearchRow[] => {
    return (albums ?? []).map((al, idx) => {
      const spotifyId = al?.metadata?.provider_ids?.spotify as
        | string
        | undefined;
      const primaryArtist = al?.primary_artist?.name ?? "Unknown Artist";
      const title = al?.title ?? "Unknown";
      const releaseDate = al?.release_date ?? "";
      const totalTracks = al?.total_tracks ?? 0;
      const image = (al.imageUrls ?? [])[0] ?? "";

      let explicit = false;
      if (Array.isArray(al?.tracks) && al.tracks.length > 0) {
        for (const tr of al.tracks) {
          if (tr && tr.explicit_flag === true) {
            explicit = true;
            break;
          }
        }
      }

      return {
        id: spotifyId || `row-${idx}`,
        name: title,
        artist: primaryArtist,
        releaseDate,
        tracks: totalTracks,
        explicit,
        spotifyId,
        image,
      };
    });
  }, []);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["search", searchType, searchQuery],
    enabled: Boolean(searchQuery?.trim() && !!searchType),
    queryFn: async () => {
      const data = await convex.action(api.spotify.searchAlbums, {
        query: searchQuery,
      });
      return mapAlbumsToRows(data ?? []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const statusKey = (row: { spotifyId?: string; id: string }) =>
    (row.spotifyId && String(row.spotifyId)) || String(row.id);

  const handleAddSelectedAlbums = async () => {
    const albumsToAdd = searchResults.filter((album) =>
      selectedAlbums.includes(album.id)
    );
    if (albumsToAdd.length === 0) return;

    setAdding((prev) => {
      const next = { ...prev };
      for (const a of albumsToAdd) next[statusKey(a)] = "adding";
      return next;
    });

    const results = await Promise.allSettled(
      albumsToAdd.map((a) =>
        a.spotifyId
          ? convex.action(api.album_workflow.startAlbumWorkflow, {
              albumId: a.spotifyId!,
            })
          : Promise.reject(new Error("Missing spotifyId"))
      )
    );

    setAdding((prev) => {
      const next = { ...prev };
      results.forEach((res, idx) => {
        const key = statusKey(albumsToAdd[idx]);
        next[key] = res.status === "fulfilled" ? "success" : "error";
      });
      return next;
    });

    setSelectedAlbums([]);
  };

  const addAlbumToPipeline = async (row: SearchRow) => {
    if (!row.spotifyId) return;
    const key = statusKey(row);
    setAdding((prev) => ({ ...prev, [key]: "adding" }));
    try {
      await convex.action(api.album_workflow.startAlbumWorkflow, {
        albumId: row.spotifyId!,
      });
      setAdding((prev) => ({ ...prev, [key]: "success" }));
    } catch {
      setAdding((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Spotify Content</CardTitle>
          <CardDescription>
            Search for albums, artists, tracks, or playlists to add to your
            pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search for albums, artists, tracks..."
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                className="flex-1"
                onKeyDown={onKeyDown}
              />
              <Select
                value={typeDraft}
                onValueChange={(val) => setTypeDraft(val as SearchType)}
              >
                <SelectTriggerComponent className="w-32">
                  <SelectValueComponent />
                </SelectTriggerComponent>
                <SelectContentComponent>
                  {searchTypes.map((type) => (
                    <SelectItemComponent key={type.value} value={type.value}>
                      {type.label}
                    </SelectItemComponent>
                  ))}
                </SelectContentComponent>
              </Select>
            </div>
            <Button
              onClick={submitSearch}
              disabled={isSearching || !qDraft.trim()}
              className="flex items-center gap-2 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                Click on an album name to view details, or select albums to add
                to your pipeline
              </CardDescription>
            </div>
            {selectedAlbums.length > 0 && (
              <Button
                onClick={handleAddSelectedAlbums}
                className="flex items-center gap-2 cursor-pointer"
                disabled={selectedAlbums.length === 0}
                title={
                  selectedAlbums.length === 0
                    ? "Select rows to add"
                    : "Add selected to pipeline"
                }
              >
                {selectedAlbums.length > 0 &&
                selectedAlbums.some((id) => {
                  const row = searchResults.find((r) => r.id === id);
                  const k = row ? statusKey(row) : id;
                  return adding[k] === "adding";
                }) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding Selected…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Selected ({selectedAlbums.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <SearchResultsTable
            data={searchResults}
            adding={adding}
            setAdding={setAdding}
            selectedAlbums={selectedAlbums}
            setSelectedAlbums={setSelectedAlbums}
            selectedAlbum={selectedAlbum}
            setSelectedAlbum={setSelectedAlbum}
            onAddAlbum={addAlbumToPipeline}
            onAddSelected={handleAddSelectedAlbums}
          />
        </CardContent>
      </Card>
    </div>
  );
}
