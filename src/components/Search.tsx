import { api } from "@/../convex/_generated/api";
import { Album } from "@/../convex/utils/typings";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useConvex } from "convex/react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent as SelectContentComponent,
  SelectItem as SelectItemComponent,
  SelectTrigger as SelectTriggerComponent,
  SelectValue as SelectValueComponent,
} from "@/components/ui/select";
import { Check, Loader2, Plus, Search as SearchIcon, X } from "lucide-react";

type SearchRow = {
  id: string;
  name: string;
  artist: string;
  releaseDate?: string;
  tracks?: number;
  explicit?: boolean;
  spotifyId?: string;
  image?: string;
};

const searchTypes = [
  { value: "album", label: "Albums" },
  { value: "artist", label: "Artists" },
  { value: "track", label: "Tracks" },
  { value: "playlist", label: "Playlists" },
];

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <img
      src="/brand-spotify.svg"
      alt="Spotify"
      className={className}
      loading="lazy"
    />
  );
}

function ExplicitIcon({ className }: { className?: string }) {
  return (
    <img
      src="/explicit.svg"
      alt="Explicit"
      className={className}
      loading="lazy"
    />
  );
}

function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={`${props.className || ""} bg-background text-foreground`}
    />
  );
}

function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue();

  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? "") as string}
      onChange={(value) => column.setFilterValue(value)}
      placeholder="Search..."
      className="w-36 border shadow rounded px-2 py-1 text-xs bg-background text-foreground"
    />
  );
}

export default function Search() {
  const convex = useConvex();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchType, setSearchType] = React.useState("album");
  const [searchResults, setSearchResults] = React.useState<SearchRow[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const [selectedAlbums, setSelectedAlbums] = React.useState<string[]>([]);
  const [selectedAlbum, setSelectedAlbum] = React.useState<any>(null);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});

  const [adding, setAdding] = React.useState<
    Record<string, "idle" | "adding" | "success" | "error">
  >({});

  // Prefer spotifyId when present
  const statusKey = (row: { spotifyId?: string; id: string }) =>
    (row.spotifyId && String(row.spotifyId)) || String(row.id);

  const mapAlbumsToRows = (albums: Album[]): SearchRow[] => {
    return (albums ?? []).map((al, idx: number) => {
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
  };

  const handleSearch = async () => {
    if (!searchQuery?.trim()) return;
    setIsSearching(true);
    setSelectedAlbum(null);
    setSelectedAlbums([]);
    setAdding({});

    try {
      if (searchType === "album") {
        const data = await convex.action(api.spotify.searchAlbums, {
          query: searchQuery,
        });
        setSearchResults(mapAlbumsToRows(data ?? []));
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error("Search failed:", err?.message ?? err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSelectedAlbums = async () => {
    const albumsToAdd = searchResults.filter((album) =>
      selectedAlbums.includes(album.id)
    );
    if (albumsToAdd.length === 0) return;

    setAdding((prev) => {
      const next = { ...prev };
      for (const a of albumsToAdd) {
        next[statusKey(a)] = "adding";
      }
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
    setRowSelection({});
  };

  const handleAlbumClick = (album: any) => {
    setSelectedAlbum((prev: any) =>
      prev && prev.id === album.id ? null : album
    );
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
    } catch (e) {
      setAdding((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const columns = React.useMemo<ColumnDef<SearchRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const selectableRows = table.getRowModel().rows.filter((r) => {
            const st =
              adding[
                statusKey(r.original as { spotifyId?: string; id: string })
              ];
            return (
              !!(r.original as { spotifyId?: string }).spotifyId &&
              st !== "adding" &&
              st !== "success"
            );
          });

          const allSelected =
            selectableRows.length > 0 &&
            selectableRows.every((r) => r.getIsSelected());

          return (
            <Checkbox
              checked={allSelected}
              onCheckedChange={(value) => {
                selectableRows.forEach((r) => r.toggleSelected(!!value));
              }}
              aria-label="Select all"
            />
          );
        },
        cell: ({ row }) => {
          const status = adding[statusKey(row.original)];
          const disabled =
            !row.original.spotifyId ||
            status === "adding" ||
            status === "success";
          return (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => {
                if (disabled) return;
                row.toggleSelected(!!value);
              }}
              aria-label="Select row"
              disabled={disabled}
            />
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: "Album",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.image ? (
              <img
                src={row.original.image}
                alt={`${row.original.name} cover`}
                className="h-20 w-20 rounded object-cover flex-shrink-0"
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAlbumClick(row.original);
                }}
              />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
            )}

            <div
              className="cursor-pointer hover:bg-muted/50 p-1 rounded text-foreground flex-1"
              onClick={() => handleAlbumClick(row.original)}
            >
              <div className="font-medium text-foreground flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  {row.getValue("name")}
                  {row.original.explicit && (
                    <ExplicitIcon className="h-5 w-5 opacity-90" />
                  )}
                </span>
                {adding[statusKey(row.original)] === "adding" && (
                  <span className="text-xs rounded bg-primary/10 text-primary px-2 py-0.5 animate-pulse">
                    Queuing…
                  </span>
                )}
                {selectedAlbums.includes(row.original.id) &&
                  selectedAlbums.some(
                    (id) =>
                      adding[
                        statusKey({
                          id,
                          spotifyId: searchResults.find((r) => r.id === id)
                            ?.spotifyId,
                        })
                      ] === "adding"
                  ) &&
                  adding[statusKey(row.original)] !== "adding" && (
                    <span className="text-xs rounded bg-primary/10 text-primary px-2 py-0.5">
                      In batch…
                    </span>
                  )}
                {adding[statusKey(row.original)] === "success" && (
                  <span className="text-xs rounded bg-green-500/10 text-green-500 px-2 py-0.5">
                    Queued
                  </span>
                )}
                {adding[statusKey(row.original)] === "error" && (
                  <span className="text-xs rounded bg-red-500/10 text-red-500 px-2 py-0.5">
                    Failed
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                by {row.original.artist}
              </div>
            </div>

            {row.original.spotifyId && (
              <a
                href={`https://open.spotify.com/album/${row.original.spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-green-500 hover:text-green-400 p-1"
                onClick={(e) => e.stopPropagation()}
                title="Open in Spotify"
              >
                <SpotifyIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        ),
        filterFn: "includesString",
      },
      {
        accessorKey: "artist",
        header: "Artist",
        cell: ({ row }) => (
          <span className="text-foreground">{row.getValue("artist")}</span>
        ),
        filterFn: "includesString",
      },
      {
        accessorKey: "tracks",
        header: "Tracks",
        cell: ({ row }) => (
          <span className="text-foreground">{row.getValue("tracks")}</span>
        ),
        filterFn: "equalsString",
      },
      {
        accessorKey: "releaseDate",
        header: "Release Date",
        cell: ({ row }) => (
          <span className="text-foreground">{row.getValue("releaseDate")}</span>
        ),
        filterFn: "includesString",
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const status = adding[statusKey(row.original)];
          const disabled =
            !row.original.spotifyId ||
            status === "adding" ||
            status === "success";
          return (
            <div className="flex items-center justify-end">
              <Button
                variant={status === "error" ? "destructive" : "default"}
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  addAlbumToPipeline(row.original);
                }}
                className={`cursor-pointer ${
                  status === "success"
                    ? "bg-green-600 hover:bg-green-600 text-white"
                    : status === "adding"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }`}
                title={
                  status === "success"
                    ? "Added"
                    : status === "adding"
                    ? "Adding..."
                    : "Add to pipeline"
                }
              >
                {status === "adding" ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding
                  </span>
                ) : status === "success" ? (
                  <span className="inline-flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Added
                  </span>
                ) : status === "error" ? (
                  <span className="inline-flex items-center">
                    <X className="h-4 w-4 mr-1" />
                    Retry
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </span>
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [adding, searchResults, selectedAlbums]
  );

  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection).filter(
      (key) => (rowSelection as any)[key]
    );
    const selectedIds = selectedRows
      .map((index) => searchResults[parseInt(index)]?.id)
      .filter(Boolean) as string[];
    setSelectedAlbums(selectedIds);
  }, [rowSelection, searchResults]);

  const table = useReactTable({
    data: searchResults,
    columns,
    state: {
      columnFilters,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });

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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Select value={searchType} onValueChange={setSearchType}>
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
              onClick={handleSearch}
              disabled={isSearching}
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
          <div className="space-y-4">
            <div>
              <DebouncedInput
                value={globalFilter ?? ""}
                onChange={(value) => setGlobalFilter(String(value))}
                className="p-2 font-lg shadow border border-gray-300 rounded max-w-sm bg-background text-foreground"
                placeholder="Search all columns..."
              />
            </div>
            <div className="rounded-md border">
              <table className="w-full text-foreground">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b bg-muted/50">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className="h-auto px-4 py-2 text-left align-top font-medium text-muted-foreground"
                        >
                          {header.isPlaceholder ? null : (
                            <>
                              <div
                                {...{
                                  className: header.column.getCanSort()
                                    ? "cursor-pointer select-none"
                                    : "",
                                  onClick:
                                    header.column.getToggleSortingHandler(),
                                }}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                {header.column.getIsSorted() === "asc"
                                  ? " 🔼"
                                  : header.column.getIsSorted() === "desc"
                                  ? " 🔽"
                                  : null}
                              </div>
                              {header.column.getCanFilter() ? (
                                <div>
                                  <Filter column={header.column} />
                                </div>
                              ) : null}
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-b">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-4 align-middle">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>

                      {selectedAlbum &&
                        selectedAlbum.id === row.original.id && (
                          <tr key={`${row.id}-details`} className="bg-muted/30">
                            <td
                              colSpan={table.getVisibleLeafColumns().length}
                              className="p-4"
                            >
                              <Card>
                                <CardHeader className="py-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <CardTitle className="text-base">
                                          {row.original.name}
                                        </CardTitle>
                                        {row.original.explicit && (
                                          <ExplicitIcon className="h-5 w-5 opacity-90" />
                                        )}
                                      </div>
                                      <CardDescription>
                                        by {row.original.artist}
                                      </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {row.original.spotifyId && (
                                        <a
                                          href={`https://open.spotify.com/album/${row.original.spotifyId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-green-500 hover:text-green-400 p-1"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Open in Spotify"
                                        >
                                          <SpotifyIcon className="h-4 w-4" />
                                        </a>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAlbum(null);
                                        }}
                                        title="Close details"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  {row.original.releaseDate && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Release Date:
                                      </span>
                                      <span className="text-foreground">
                                        {row.original.releaseDate}
                                      </span>
                                    </div>
                                  )}
                                  {row.original.tracks != null && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Tracks:
                                      </span>
                                      <span className="text-foreground">
                                        {row.original.tracks}
                                      </span>
                                    </div>
                                  )}
                                  {row.original.spotifyId && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Spotify ID:
                                      </span>
                                      <span className="font-mono text-xs text-foreground">
                                        {row.original.spotifyId}
                                      </span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </td>
                          </tr>
                        )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="border rounded p-1"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                {"<<"}
              </button>
              <button
                className="border rounded p-1"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {"<"}
              </button>
              <button
                className="border rounded p-1"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {">"}
              </button>
              <button
                className="border rounded p-1"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                {">>"}
              </button>
              <span className="flex items-center gap-1">
                <div>Page</div>
                <strong>
                  {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                | Go to page:
                <input
                  type="number"
                  defaultValue={table.getState().pagination.pageIndex + 1}
                  onChange={(e) => {
                    const page =
                      e.target.value &&
                      Number(e.target.value) < table.getPageCount() + 1
                        ? Number(e.target.value) - 1
                        : 0;
                    table.setPageIndex(page);
                  }}
                  className="border p-1 rounded w-16 bg-background text-foreground"
                />
              </span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="bg-background text-foreground border rounded p-1"
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-foreground">
              {table.getPrePaginationRowModel().rows.length} Rows
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
