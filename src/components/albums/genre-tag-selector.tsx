"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Plus, Check, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Genre {
  id: Id<"genre">;
  name: string;
  slug: string;
}

interface GenreTagSelectorProps {
  selectedGenreIds: Id<"genre">[];
  onGenresChange: (genreIds: Id<"genre">[]) => void;
  placeholder?: string;
  maxSelections?: number;
  className?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function GenreTagSelector({
  selectedGenreIds,
  onGenresChange,
  placeholder = "Search genres...",
  maxSelections,
  className,
}: GenreTagSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const convex = useConvex();
  const { toast } = useToast();

  const { data: searchResults = [], isLoading } = useQuery({
    ...convexQuery(
      api.genre.searchGenres,
      debouncedSearchTerm.trim() ? { query: debouncedSearchTerm } : "skip"
    ),
    enabled: !!debouncedSearchTerm.trim(),
    staleTime: 30 * 1000,
  });

  const { data: selectedGenres = [] } = useQuery({
    ...convexQuery(
      api.genre.getGenresByIds,
      selectedGenreIds.length > 0 ? { genreIds: selectedGenreIds } : "skip"
    ),
    enabled: selectedGenreIds.length > 0,
    staleTime: 30 * 1000,
  });

  const availableGenres = useMemo(() => {
    return searchResults.filter((genre) => !selectedGenreIds.includes(genre.id));
  }, [searchResults, selectedGenreIds]);

  const shouldShowCreateNew =
    debouncedSearchTerm.trim() &&
    !searchResults.some(
      (genre) => genre.name.toLowerCase() === debouncedSearchTerm.toLowerCase()
    ) &&
    availableGenres.length === 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenreSelect = (genre: Genre) => {
    if (maxSelections && selectedGenreIds.length >= maxSelections) {
      return;
    }

    if (!selectedGenreIds.includes(genre.id)) {
      onGenresChange([...selectedGenreIds, genre.id]);
    }
    setSearchTerm("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleGenreRemove = (genreId: Id<"genre">) => {
    onGenresChange(selectedGenreIds.filter((id) => id !== genreId));
  };

  const handleCreateGenre = async () => {
    const trimmedName = searchTerm.trim();
    if (!trimmedName || isCreating) return;

    try {
      setIsCreating(true);

      const newGenreId = await convex.mutation(api.genre.createGenre, {
        name: trimmedName,
      });

      onGenresChange([...selectedGenreIds, newGenreId]);

      toast({
        title: "Genre created",
        description: `"${trimmedName}" has been added to your genres.`,
      });

      setSearchTerm("");
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error creating genre",
        description: "Failed to create the new genre. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (shouldShowCreateNew && !isCreating) {
                handleCreateGenre();
              } else if (availableGenres.length > 0) {
                handleGenreSelect(availableGenres[0]);
              }
            }
          }}
          className={cn("pl-10", isLoading ? "pr-10" : "pr-4")}
          disabled={maxSelections ? selectedGenreIds.length >= maxSelections : false}
        />
      </div>

      {/* Selected genres display */}
      {selectedGenres.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedGenres.map((genre) => (
            <Badge
              key={genre.id}
              variant="secondary"
              className="px-3 py-1 text-sm flex items-center gap-2 hover:bg-secondary/80 transition-colors"
            >
              {genre.name}
              <button
                onClick={() => handleGenreRemove(genre.id)}
                className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${genre.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (searchTerm.trim() || isLoading) && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto border shadow-lg">
          <div className="p-2">
            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Searching genres...</span>
              </div>
            )}

            {/* Available genres */}
            {!isLoading && availableGenres.length > 0 && (
              <div className="space-y-1">
                {availableGenres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => handleGenreSelect(genre)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group"
                  >
                    <span>{genre.name}</span>
                    <Check className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {/* Create new genre option */}
            {!isLoading && shouldShowCreateNew && (
              <div className={cn(availableGenres.length > 0 && "border-t pt-2 mt-2")}>
                <button
                  onClick={handleCreateGenre}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateGenre();
                    }
                  }}
                  disabled={isCreating}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 text-primary disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{isCreating ? "Creating..." : `Create "${searchTerm}"`}</span>
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading &&
              !shouldShowCreateNew &&
              availableGenres.length === 0 &&
              searchTerm.trim() && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No matching genres found</p>
                </div>
              )}
          </div>
        </Card>
      )}

      {/* Selection limit indicator */}
      {maxSelections && (
        <div className="text-xs text-muted-foreground mt-2">
          {selectedGenreIds.length} / {maxSelections} genres selected
        </div>
      )}
    </div>
  );
}
