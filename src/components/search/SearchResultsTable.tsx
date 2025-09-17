import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  Loader2,
  Plus,
  X,
  Search,
  ArrowUpDown,
  Calendar,
  Music,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SpotifyIcon({ className }: { className?: string }) {
  return <img src="/brand-spotify.svg" alt="Spotify" className={className} loading="lazy" />;
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
  isSearching?: boolean;
  searchQuery?: string;
};

const getStatusBadgeVariant = (status: Status) => {
  switch (status) {
    case "adding":
      return "default";
    case "success":
      return "default";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusColor = (status: Status) => {
  switch (status) {
    case "adding":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "success":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "error":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
  }
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
  isSearching = false,
  searchQuery = "",
}: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});

  const statusKey = React.useCallback(
    (row: { spotifyId?: string; id: string }) =>
      (row.spotifyId && String(row.spotifyId)) || String(row.id),
    []
  );

  const columns = React.useMemo<ColumnDef<SearchRow>[]>(() => {
    return [
      {
        id: "select",
        header: ({ table }) => {
          const selectableRows = table.getRowModel().rows.filter((r) => {
            const st = adding[statusKey(r.original)];
            return !!r.original.spotifyId && st !== "adding" && st !== "success";
          });
          const allSelected =
            selectableRows.length > 0 && selectableRows.every((r) => r.getIsSelected());
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
          const disabled = !row.original.spotifyId || st === "adding" || st === "success";
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
        size: 50,
      },
      {
        accessorKey: "name",
        header: "Album",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              {row.original.image ? (
                <img
                  src={row.original.image}
                  alt={`${row.original.name} cover`}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground flex items-center gap-2 mb-1">
                <span className="truncate">{row.getValue("name")}</span>
                {row.original.explicit && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    E
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground truncate">by {row.original.artist}</div>

              {/* Status badges */}
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const st = adding[statusKey(row.original)];
                  if (st === "adding") {
                    return (
                      <Badge
                        variant={getStatusBadgeVariant(st)}
                        className={cn("text-xs font-medium px-2 py-1", getStatusColor(st))}
                      >
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Adding...
                      </Badge>
                    );
                  }
                  if (st === "success") {
                    return (
                      <Badge
                        variant={getStatusBadgeVariant(st)}
                        className={cn("text-xs font-medium px-2 py-1", getStatusColor(st))}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Added
                      </Badge>
                    );
                  }
                  if (st === "error") {
                    return (
                      <Badge
                        variant={getStatusBadgeVariant(st)}
                        className={cn("text-xs font-medium px-2 py-1", getStatusColor(st))}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {row.original.spotifyId && (
              <a
                href={`https://open.spotify.com/album/${row.original.spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-green-500 hover:text-green-400 p-2 rounded-md hover:bg-green-500/10 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Open in Spotify"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        ),
        filterFn: "includesString",
        size: 400,
      },
      {
        accessorKey: "artist",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            Artist
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <div className="font-medium text-sm truncate">
            {String(getValue() || "Unknown Artist")}
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: "releaseDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            <Calendar className="mr-2 h-3 w-3" />
            Release Date
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <div className="text-sm text-muted-foreground">
            {getValue() ? String(getValue()) : "—"}
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: "tracks",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            <Music className="mr-2 h-3 w-3" />
            Tracks
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <div className="text-sm text-center tabular-nums">
            {getValue() ? String(getValue()) : "—"}
          </div>
        ),
        size: 100,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const st = adding[statusKey(row.original)];
          const disabled = !row.original.spotifyId || st === "adding" || st === "success";

          return (
            <div className="flex items-center justify-end">
              <Button
                variant={st === "error" ? "destructive" : st === "success" ? "default" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAlbum(row.original);
                }}
                className={cn(
                  "h-8 px-3 text-xs",
                  st === "success" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                )}
                title={
                  st === "success"
                    ? "Added to pipeline"
                    : st === "adding"
                    ? "Adding to pipeline..."
                    : st === "error"
                    ? "Retry adding to pipeline"
                    : "Add to pipeline"
                }
              >
                {st === "adding" ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Adding
                  </>
                ) : st === "success" ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Added
                  </>
                ) : st === "error" ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          );
        },
        size: 120,
      },
    ];
  }, [adding, statusKey, onAddAlbum]);

  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection).filter((key) => (rowSelection as any)[key]);
    const selectedIds = selectedRows
      .map((index) => data[parseInt(index)]?.id)
      .filter(Boolean) as string[];
    setSelectedAlbums(selectedIds);
  }, [rowSelection, data, setSelectedAlbums]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  // Global filter function that searches across multiple fields
  const globalFilterFn = (row: any, columnId: string, filterValue: string) => {
    const searchRow = row.original as SearchRow;
    const searchValue = filterValue.toLowerCase();

    const searchableFields = [
      searchRow.name,
      searchRow.artist,
      searchRow.releaseDate,
      searchRow.spotifyId,
    ].filter(Boolean);

    return searchableFields.some((field) => String(field).toLowerCase().includes(searchValue));
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search albums, artists, or release dates..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{table.getFilteredRowModel().rows.length} albums</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                    style={{ width: header.column.columnDef.size }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isSearching ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                    <p>Searching Spotify...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-4 align-top"
                      style={{ width: cell.column.columnDef.size }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <Search className="h-8 w-8 opacity-50" />
                    <p>{searchQuery ? "No results found" : "Start searching to see results"}</p>
                    {searchQuery && (
                      <p className="text-sm">Try different keywords or check your spelling</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.length > 0 && !isSearching && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {data.length} albums
              {table.getPageCount() > 1 && (
                <span className="ml-2">
                  (Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()})
                </span>
              )}
            </p>
          </div>
          {table.getPageCount() > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
