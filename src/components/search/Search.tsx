import { api } from "@/../convex/_generated/api";
import { Route as SearchRoute, type SearchParams } from "@/routes/admin/index";
import { Album } from "@/shared/typings";
import { useConvex } from "@convex-dev/react-query";
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

const searchTypes = [
  { value: "album", label: "Albums" },
  // { value: "artist", label: "Artists" },
  // { value: "track", label: "Tracks" },
  // { value: "playlist", label: "Playlists" },
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
      to: "/admin",
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-balance">
              Search & Discover
            </h1>
            <p className="text-muted-foreground">
              Search Spotify's catalog and add albums to your processing
              pipeline ({searchResults.length} results)
            </p>
          </div>

          {/* Search Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Search Spotify</CardTitle>
                  <CardDescription>
                    Find albums, artists, tracks, and playlists
                  </CardDescription>
                </div>
                <SearchIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Search for albums, artists, tracks..."
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    className="flex-1 h-10"
                    onKeyDown={onKeyDown}
                  />
                  <Select
                    value={typeDraft}
                    onValueChange={(val) => setTypeDraft(val as SearchType)}
                  >
                    <SelectTriggerComponent className="w-full sm:w-40 h-10">
                      <SelectValueComponent />
                    </SelectTriggerComponent>
                    <SelectContentComponent>
                      {searchTypes.map((type) => (
                        <SelectItemComponent
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </SelectItemComponent>
                      ))}
                    </SelectContentComponent>
                  </Select>
                </div>
                <Button
                  onClick={submitSearch}
                  disabled={isSearching || !qDraft.trim()}
                  className="h-10 px-6"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

          {/* Results Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Search Results</CardTitle>
                  <CardDescription>
                    Select albums to add to your processing pipeline
                  </CardDescription>
                </div>
                {selectedAlbums.length > 0 && (
                  <Button
                    onClick={handleAddSelectedAlbums}
                    className="h-10 bg-emerald-600 hover:bg-emerald-700"
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Selected…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Selected ({selectedAlbums.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
                isSearching={isSearching}
                searchQuery={searchQuery}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
