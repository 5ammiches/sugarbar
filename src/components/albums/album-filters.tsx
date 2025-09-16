import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface FilterState {
  search: string;
  artistId: string; // stores Id<"artist"> as string or "" for All
  year: string; // stores year as string or "" for All
  genres: string[];
  hasExplicit: boolean | null;
  hasLyrics: boolean | null;
  hasAudio: boolean | null;
  sortBy: "newest" | "oldest" | "title" | "artist";
}

type AlbumDoc = Doc<"album">;

interface AlbumFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  albums: AlbumDoc[];
  artistMap: Map<Id<"artist">, Doc<"artist">>;
}

export function AlbumFilters({
  filters,
  onFiltersChange,
  albums,
  artistMap,
}: AlbumFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const artistNameFromId = (id: string) => {
    const found = artistMap.get(id as Id<"artist">);
    return found?.name ?? "Unknown Artist";
  };

  // Extract unique years and genres from albums
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const album of albums ?? []) {
      const d = new Date(album.release_date);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [albums]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const album of albums ?? []) {
      for (const g of album.genre_tags ?? []) {
        genres.add(g);
      }
    }
    return Array.from(genres).sort();
  }, [albums]);

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      artistId: "",
      year: "",
      genres: [],
      hasExplicit: null,
      hasLyrics: null,
      hasAudio: null,
      sortBy: "newest",
    });
  };

  const hasActiveFilters =
    !!filters.search ||
    !!filters.artistId ||
    !!filters.year ||
    (filters.genres?.length ?? 0) > 0 ||
    filters.hasExplicit !== null ||
    filters.hasLyrics !== null ||
    filters.hasAudio !== null;

  const toggleGenre = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    updateFilters({ genres: newGenres });
  };

  return (
    <div className="space-y-4">
      {/* Search and primary filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search albums..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={filters.artistId || "all-artists"}
            onValueChange={(value) =>
              updateFilters({ artistId: value === "all-artists" ? "" : value })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Artist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-artists">All Artists</SelectItem>
              {Array.from(artistMap.values()).map((artist) => (
                <SelectItem key={artist._id} value={String(artist._id)}>
                  {artist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.year || "all-years"}
            onValueChange={(value) =>
              updateFilters({ year: value === "all-years" ? "" : value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-years">All Years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sortBy}
            onValueChange={(value: FilterState["sortBy"]) =>
              updateFilters({ sortBy: value })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="artist">Artist</SelectItem>
            </SelectContent>
          </Select>

          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
            {/* Content filters */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Content</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="explicit"
                    checked={filters.hasExplicit === true}
                    onCheckedChange={(checked) =>
                      updateFilters({ hasExplicit: checked ? true : null })
                    }
                  />
                  <label htmlFor="explicit" className="text-sm">
                    Explicit
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lyrics"
                    checked={filters.hasLyrics === true}
                    onCheckedChange={(checked) =>
                      updateFilters({ hasLyrics: checked ? true : null })
                    }
                  />
                  <label htmlFor="lyrics" className="text-sm">
                    Has Lyrics
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="audio"
                    checked={filters.hasAudio === true}
                    onCheckedChange={(checked) =>
                      updateFilters({ hasAudio: checked ? true : null })
                    }
                  />
                  <label htmlFor="audio" className="text-sm">
                    Has Audio
                  </label>
                </div>
              </div>
            </div>

            {/* Genre filters */}
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-sm font-medium">Genres</h4>
              <div className="flex flex-wrap gap-2">
                {availableGenres.map((genre) => (
                  <Badge
                    key={genre}
                    variant={
                      filters.genres.includes(genre) ? "default" : "outline"
                    }
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer !pointer-events-auto"
                onClick={() => updateFilters({ search: "" })}
              />
            </Badge>
          )}
          {filters.artistId && (
            <Badge variant="secondary" className="gap-1">
              Artist: {artistNameFromId(filters.artistId)}
              <X
                className="h-3 w-3 cursor-pointer !pointer-events-auto"
                onClick={() => updateFilters({ artistId: "" })}
              />
            </Badge>
          )}
          {filters.year && (
            <Badge variant="secondary" className="gap-1">
              Year: {filters.year}
              <X
                className="h-3 w-3 cursor-pointer !pointer-events-auto"
                onClick={() => updateFilters({ year: "" })}
              />
            </Badge>
          )}
          {filters.genres.map((genre) => (
            <Badge key={genre} variant="secondary" className="gap-1">
              {genre}
              <X
                className="h-3 w-3 cursor-pointer !pointer-events-auto"
                onClick={() => toggleGenre(genre)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
