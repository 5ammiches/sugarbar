import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Calendar,
  Check,
  Clock,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import AlbumCell from "../albums/album-cell";

export interface JobRow {
  workflowId: string;
  workflowName: string;
  status:
    | "queued"
    | "in_progress"
    | "completed"
    | "failed"
    | "canceled"
    | "rejected"
    | "pending_review"
    | "approved";
  progress: number;
  startedAt?: number;
  updatedAt?: number;
  error?: string;
  args?: any;
  albumId?: string;
  spotifyAlbumId?: string;
  albumTitle?: string;
  artistName?: string;
  albumCover?: string;
}

interface JobQueueTableProps {
  jobRows: JobRow[];
  albumMap: Map<Id<"album">, Doc<"album">>;
  onCancel: (workflowId: string) => Promise<void>;
  onRetry: (
    workflowId: string,
    albumId?: string,
    spotifyAlbumId?: string
  ) => Promise<void>;
  onApprove: (workflowId: string, albumId?: string) => Promise<void>;
  onReject: (workflowId: string, albumId?: string) => Promise<void>;
  jobGlobalFilter: string;
  onJobGlobalFilterChange: (value: string) => void;
  jobColumnFilters: ColumnFiltersState;
  onJobColumnFiltersChange: (filters: ColumnFiltersState) => void;
  onOpen: (albumId?: string, workflowId?: string, status?: string) => void;
}

const getStatusBadgeVariant = (status: JobRow["status"]) => {
  switch (status) {
    case "queued":
      return "secondary";
    case "in_progress":
      return "default";
    case "completed":
    case "approved":
      return "default";
    case "pending_review":
      return "outline";
    case "failed":
    case "canceled":
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusColor = (status: JobRow["status"]) => {
  switch (status) {
    case "queued":
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
    case "in_progress":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "completed":
    case "approved":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "pending_review":
      return "text-purple-300 bg-purple-500/10 border-purple-500/20";
    case "failed":
    case "canceled":
    case "rejected":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    default:
      return "text-gray-300 bg-gray-500/10 border-gray-500/20";
  }
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const formatDuration = (startedAt?: number, updatedAt?: number) => {
  if (!startedAt || !updatedAt) return "—";
  const duration = updatedAt - startedAt;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export default function JobQueueTable({
  jobRows,
  albumMap,
  onCancel,
  onRetry,
  onApprove,
  onReject,
  jobGlobalFilter,
  onJobGlobalFilterChange,
  jobColumnFilters,
  onJobColumnFiltersChange,
  onOpen,
}: JobQueueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loadingActions, setLoadingActions] = useState<Record<string, string>>(
    {}
  );
  const queryClient = useQueryClient();

  // Debounced prefetch to avoid too many requests on rapid hover
  const prefetchAlbumDetails = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return (albumId: string) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          queryClient.prefetchQuery({
            ...convexQuery(api.db.getAlbumDetails, {
              albumId: albumId as Id<"album">,
            }),
            staleTime: 5 * 60 * 1000, // 5 minutes
          });
        }, 200); // 200ms delay to avoid excessive prefetching
      };
    })(),
    [queryClient]
  );

  const handleAction = async (
    workflowId: string,
    action: string,
    fn: () => Promise<void>
  ) => {
    setLoadingActions((prev) => ({ ...prev, [workflowId]: action }));
    try {
      await fn();
    } catch (error) {
      console.error(`${action} failed:`, error);
    } finally {
      setLoadingActions((prev) => {
        const next = { ...prev };
        delete next[workflowId];
        return next;
      });
    }
  };

  const columns: ColumnDef<JobRow>[] = useMemo(
    () => [
      {
        accessorKey: "albumId",
        header: "Album",
        cell: ({ row }) => (
          <AlbumCell
            albumTitle={row.original.albumTitle}
            artistName={row.original.artistName}
            albumCover={row.original.albumCover}
            albumId={row.original.albumId}
            workflowId={row.original.workflowId}
          />
        ),
        size: 300,
      },
      {
        accessorKey: "workflowName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            Workflow
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <div className="font-medium text-sm">
            {String(getValue() || "Unknown")}
          </div>
        ),
        size: 150,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            Status
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const status = getValue() as JobRow["status"];

          return (
            <Badge
              variant={getStatusBadgeVariant(status)}
              className={cn(
                "text-xs font-medium px-2 py-1",
                getStatusColor(status)
              )}
            >
              {status.replace(/_/g, " ")}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          const status = row.getValue(id) as string;
          if (value === "__failed_or_canceled__") {
            return ["failed", "canceled", "rejected"].includes(status);
          }
          return status === value;
        },
        size: 100,
      },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const status = row.original.status;
          const progress = row.original.progress;

          if (status === "in_progress" && progress > 0) {
            return (
              <div className="space-y-1">
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, progress))}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {Math.round(progress)}%
                </div>
              </div>
            );
          }

          return (
            <div className="text-xs text-muted-foreground text-center">
              {status === "completed" || status === "approved" ? "100%" : "—"}
            </div>
          );
        },
        size: 80,
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-left font-medium"
          >
            <Clock className="mr-2 h-3 w-3" />
            Updated
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue, row }) => (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatTimestamp(getValue() as number)}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(row.original.startedAt, row.original.updatedAt)}
            </div>
          </div>
        ),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.updatedAt || 0;
          const b = rowB.original.updatedAt || 0;
          return a - b;
        },
        size: 180,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const job = row.original;
          const isLoading = loadingActions[job.workflowId];
          const canCancel = ["queued", "in_progress"].includes(job.status);
          const canRetry = ["failed", "canceled"].includes(job.status);
          const canReview = job.status === "pending_review" && job.albumId;

          return (
            <div className="flex items-center gap-2">
              {canReview && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(job.albumId, job.workflowId, job.status);
                  }}
                  className="h-8 px-3 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Review
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    disabled={!!isLoading}
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {job.albumId && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(job.albumId, job.workflowId, job.status);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                  )}

                  {canCancel && (
                    <DropdownMenuItem
                      onClick={() =>
                        handleAction(job.workflowId, "cancel", () =>
                          onCancel(job.workflowId)
                        )
                      }
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() =>
                      handleAction(job.workflowId, "retry", () =>
                        onRetry(job.workflowId, job.albumId, job.spotifyAlbumId)
                      )
                    }
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </DropdownMenuItem>

                  {canReview && (
                    <>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(job.workflowId, "approve", () =>
                            onApprove(job.workflowId, job.albumId)
                          )
                        }
                        className="text-green-600 focus:text-green-600"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(job.workflowId, "reject", () =>
                            onReject(job.workflowId, job.albumId)
                          )
                        }
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        size: 100,
      },
    ],
    [loadingActions, onCancel, onRetry, onApprove, onReject, onOpen]
  );

  // Custom global filter function that searches across multiple fields
  const globalFilterFn = (row: any, columnId: string, filterValue: string) => {
    const job = row.original as JobRow;
    const searchValue = filterValue.toLowerCase();

    // Search across relevant fields
    const searchableFields = [
      job.workflowName,
      job.albumTitle,
      job.artistName,
      job.status,
      job.workflowId,
      job.albumId,
    ].filter(Boolean); // Remove undefined/null values

    return searchableFields.some((field) =>
      String(field).toLowerCase().includes(searchValue)
    );
  };

  const table = useReactTable({
    data: jobRows,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updaterOrValue) => {
      if (typeof updaterOrValue === "function") {
        onJobColumnFiltersChange(updaterOrValue(jobColumnFilters));
      } else {
        onJobColumnFiltersChange(updaterOrValue);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters: jobColumnFilters,
      columnVisibility,
      globalFilter: jobGlobalFilter,
    },
    onGlobalFilterChange: onJobGlobalFilterChange,
    globalFilterFn: globalFilterFn,
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by album, artist, workflow, or status..."
            value={jobGlobalFilter}
            onChange={(e) => onJobGlobalFilterChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{table.getFilteredRowModel().rows.length} jobs</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-b"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                    style={{ width: header.column.columnDef.size }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                  onMouseEnter={() => {
                    const job = row.original;
                    // Prefetch album details on hover for faster drawer opening
                    if (job.albumId && job.albumTitle) {
                      prefetchAlbumDetails(job.albumId);
                    }
                  }}
                  onClick={() => {
                    const job = row.original;
                    // Only open drawer for jobs that have an album ID
                    // The drawer will handle cases where the album doesn't exist
                    if (job.albumId) {
                      onOpen(job.albumId, job.workflowId, job.status);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-4 align-top"
                      style={{ width: cell.column.columnDef.size }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 opacity-50" />
                    <p>No jobs found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {jobRows.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {jobRows.length} jobs
              {table.getPageCount() > 1 && (
                <span className="ml-2">
                  (Page {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()})
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
