import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Plus, X } from "lucide-react";
import DebouncedInput from "./debounced-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

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

export type SearchRow = {
  id: string;
  name: string;
  artist: string;
  releaseDate?: string;
  tracks?: number;
  explicit?: boolean;
  spotifyId?: string;
  image?: string;
};

type Status = "idle" | "adding" | "success" | "error";

type Props = {
  data: SearchRow[];
  adding: Record<string, Status>;
  setAdding: React.Dispatch<React.SetStateAction<Record<string, Status>>>;
  selectedAlbums: string[];
  setSelectedAlbums: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAlbum: any;
  setSelectedAlbum: React.Dispatch<React.SetStateAction<any>>;
  onAddAlbum: (row: SearchRow) => void;
  onAddSelected: () => void;
};

export default function SearchResultsTable({
  data,
  adding,
  setAdding,
  selectedAlbums,
  setSelectedAlbums,
  selectedAlbum,
  setSelectedAlbum,
  onAddAlbum,
  onAddSelected,
}: Props) {
  const [columnFilters, setColumnFilters] = React.useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});

  const statusKey = React.useCallback(
    (row: { spotifyId?: string; id: string }) =>
      (row.spotifyId && String(row.spotifyId)) || String(row.id),
    []
  );

  const handleAlbumClick = (album: any) => {
    setSelectedAlbum((prev: any) =>
      prev && prev.id === album.id ? null : album
    );
  };

  const columns = React.useMemo<ColumnDef<SearchRow>[]>(() => {
    return [
      {
        id: "select",
        header: ({ table }) => {
          const selectableRows = table.getRowModel().rows.filter((r) => {
            const st = adding[statusKey(r.original)];
            return (
              !!r.original.spotifyId && st !== "adding" && st !== "success"
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
          const st = adding[statusKey(row.original)];
          const disabled =
            !row.original.spotifyId || st === "adding" || st === "success";
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
                  selectedAlbums.some((id) => {
                    const found = data.find((r) => r.id === id);
                    const key = statusKey({
                      id,
                      spotifyId: found?.spotifyId,
                    });
                    return adding[key] === "adding";
                  }) &&
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
      { accessorKey: "artist", header: "Artist", filterFn: "includesString" },
      { accessorKey: "tracks", header: "Tracks", filterFn: "equalsString" },
      {
        accessorKey: "releaseDate",
        header: "Release Date",
        filterFn: "includesString",
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const st = adding[statusKey(row.original)];
          const disabled =
            !row.original.spotifyId || st === "adding" || st === "success";
          return (
            <div className="flex items-center justify-end">
              <Button
                variant={st === "error" ? "destructive" : "default"}
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAlbum(row.original);
                }}
                className={`cursor-pointer ${
                  st === "success"
                    ? "bg-green-600 hover:bg-green-600 text-white"
                    : st === "adding"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }`}
                title={
                  st === "success"
                    ? "Added"
                    : st === "adding"
                    ? "Adding..."
                    : "Add to pipeline"
                }
              >
                {st === "adding" ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding
                  </span>
                ) : st === "success" ? (
                  <span className="inline-flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Added
                  </span>
                ) : st === "error" ? (
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
    ];
  }, [adding, setSelectedAlbum, statusKey]);

  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection).filter(
      (key) => (rowSelection as any)[key]
    );
    const selectedIds = selectedRows
      .map((index) => data[parseInt(index)]?.id)
      .filter(Boolean) as string[];
    setSelectedAlbums(selectedIds);
  }, [rowSelection, data, setSelectedAlbums]);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, globalFilter, rowSelection },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
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
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    colSpan={h.colSpan}
                    className="h-auto px-4 py-2 text-left align-top font-medium text-muted-foreground"
                  >
                    {h.isPlaceholder ? null : (
                      <>
                        <div
                          className={
                            h.column.getCanSort()
                              ? "cursor-pointer select-none"
                              : ""
                          }
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                          {h.column.getIsSorted() === "asc"
                            ? " 🔼"
                            : h.column.getIsSorted() === "desc"
                            ? " 🔽"
                            : null}
                        </div>
                        {h.column.getCanFilter() ? (
                          <div>{/* your Filter component if needed */}</div>
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

                {selectedAlbum && selectedAlbum.id === row.original.id && (
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
  );
}
