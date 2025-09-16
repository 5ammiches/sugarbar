import AlbumCell from "@/components/albums/album-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table";

import { Check, RotateCcw, XCircle } from "lucide-react";
import React, { useMemo, useState } from "react";
import DebouncedInput from "@/components/search/debounced-input";

function Filter({ column }: { column: any }) {
  const columnFilterValue = column.getFilterValue();

  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? "") as string}
      onChange={(value: string | number) => column.setFilterValue(value)}
      placeholder="Search..."
      className="w-36 border shadow rounded px-2 py-1 text-xs bg-background text-foreground"
    />
  );
}

export type JobRow = {
  workflowId: string;
  workflowName: string;
  status:
    | "queued"
    | "in_progress"
    | "success"
    | "failed"
    | "canceled"
    | "pending_review"
    | "rejected";
  progress: number;
  startedAt?: number;
  updatedAt?: number;
  error?: string;
  args?: any;
  albumId?: string;
  albumTitle?: string;
  artistName?: string;
  albumCover?: string;
};

type Props = {
  jobRows: JobRow[];
  albumMap?: Map<string, any>;
  onCancel: (workflowId: string) => Promise<void>;
  onRetry: (workflowId: string) => Promise<void>;
  onApprove: (workflowId: string, albumId?: string) => Promise<void>;
  onReject: (workflowId: string, albumId?: string) => Promise<void>;
  onOpen?: (albumId?: string, workflowId?: string, status?: string) => void;

  jobGlobalFilter?: string;
  onJobGlobalFilterChange?: (value: string) => void;
  jobColumnFilters?: ColumnFiltersState;
  onJobColumnFiltersChange?: (value: ColumnFiltersState) => void;
};

export default function JobQueueTable({
  jobRows,
  albumMap = new Map(),
  onCancel,
  onRetry,
  onApprove,
  onReject,
  onOpen,
  jobGlobalFilter: controlledGlobalFilter,
  onJobGlobalFilterChange,
  jobColumnFilters: controlledColumnFilters,
  onJobColumnFiltersChange,
}: Props) {
  const [jobRowSelection, setJobRowSelection] = useState<
    Record<string, boolean>
  >({});

  // Global filter (controlled or local no-op)
  const jobGlobalFilter = controlledGlobalFilter ?? "";
  const setJobGlobalFilter = onJobGlobalFilterChange ?? ((_: string) => {});

  // Column filters (controlled locally, can be synced from parent)
  const [jobColumnFilters, setJobColumnFilters] = useState<ColumnFiltersState>(
    controlledColumnFilters ?? []
  );

  React.useEffect(() => {
    // Only update local if parent controls and it's different
    if (
      controlledColumnFilters &&
      controlledColumnFilters !== jobColumnFilters
    ) {
      setJobColumnFilters(controlledColumnFilters);
    }
  }, [controlledColumnFilters]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const formatDateTime = (ms?: number) =>
    ms ? new Date(ms).toLocaleString() : "-";

  const jobColumns = useMemo<ColumnDef<JobRow>[]>(() => {
    return [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "albumTitle",
        header: "Album",
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.albumTitle ?? "").toLowerCase();
          const b = (rowB.original.albumTitle ?? "").toLowerCase();
          return a < b ? -1 : a > b ? 1 : 0;
        },
        cell: ({ row }) => {
          const ctx = row.original;
          const isLoadingAlbum = !ctx.albumTitle && !ctx.albumCover;
          return isLoadingAlbum ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-20 w-20 rounded" />
              <div className="flex flex-col flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ) : (
            <AlbumCell
              albumTitle={ctx.albumTitle}
              artistName={ctx.artistName}
              albumCover={ctx.albumCover}
              albumId={ctx.albumId}
              workflowId={ctx.workflowId}
            />
          );
        },
        filterFn: "includesString",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          const variant =
            s === "failed" || s === "rejected"
              ? "destructive"
              : s === "in_progress"
              ? "secondary"
              : s === "queued"
              ? "outline"
              : "default";
          return <Badge variant={variant as any}>{s}</Badge>;
        },
        // custom inline fn is fine alongside built-ins
        filterFn: (row, _id, value) => {
          const s = row.original.status;
          if (!value) return true;
          if (value === "__failed_or_canceled__") {
            return s === "failed" || s === "canceled" || s === "rejected";
          }
          if (typeof value === "string") {
            return String(s).toLowerCase().includes(value.toLowerCase());
          }
          return true;
        },
      },
      {
        accessorKey: "startedAt",
        header: "Started",
        accessorFn: (row) => formatDateTime(row.startedAt),
        cell: ({ getValue }) => (
          <span className="text-foreground">{String(getValue() ?? "-")}</span>
        ),
        filterFn: "includesString",
      },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const p = Math.max(
            0,
            Math.min(100, Number(row.getValue("progress") ?? 0))
          );
          return (
            <div className="flex items-center space-x-2 min-w-[180px]">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${p}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">{p}%</span>
            </div>
          );
        },
        enableColumnFilter: false,
      },
      {
        id: "job_actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const s = row.original.status;
          const canCancel = s === "queued" || s === "in_progress";
          const canRetry = s === "failed" || s === "canceled";
          const canApprove = s === "pending_review";
          const canReject = s === "pending_review";
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!canCancel}
                onClick={(e) => {
                  e.stopPropagation();
                  void onCancel(row.original.workflowId);
                }}
                title="Cancel job"
                className="cursor-pointer"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={!canRetry}
                onClick={(e) => {
                  e.stopPropagation();
                  void onRetry(row.original.workflowId);
                }}
                title="Retry job"
                className="cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>

              {canApprove && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onApprove(
                        row.original.workflowId,
                        row.original.albumId
                      );
                    }}
                    title="Approve album"
                    className="cursor-pointer text-white bg-green-700 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onReject(
                        row.original.workflowId,
                        row.original.albumId
                      );
                    }}
                    title="Reject album"
                    className="cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ];
  }, [onCancel, onRetry, onApprove, onReject]);

  const jobTable = useReactTable({
    data: jobRows,
    columns: jobColumns,
    state: {
      pagination,
      rowSelection: jobRowSelection,
      globalFilter: jobGlobalFilter,
      columnFilters: jobColumnFilters,
    },
    onRowSelectionChange: setJobRowSelection,
    onGlobalFilterChange: setJobGlobalFilter,
    onColumnFiltersChange: (updater) => {
      setJobColumnFilters((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (o: ColumnFiltersState) => ColumnFiltersState)(prev)
            : (updater as ColumnFiltersState);

        // forward the exact value we just computed
        onJobColumnFiltersChange?.(next);
        return next;
      });
    },
    onPaginationChange: setPagination,
    getRowId: (row) => row.workflowId,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // required for client-side filtering
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleCancelSelected = async () => {
    const rows = jobTable.getFilteredSelectedRowModel().rows;
    await Promise.all(rows.map((r) => onCancel(r.original.workflowId)));
    setJobRowSelection({});
  };

  const handleRetrySelected = async () => {
    const rows = jobTable
      .getFilteredSelectedRowModel()
      .rows.filter(
        (r) =>
          r.original.status === "failed" || r.original.status === "canceled"
      );
    await Promise.all(rows.map((r) => onRetry(r.original.workflowId)));
    setJobRowSelection({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg">Jobs</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Manage workflows: cancel, retry or approve processed albums
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {jobTable.getFilteredSelectedRowModel().rows.length > 0 && (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="cursor-pointer"
                disabled={jobTable
                  .getSelectedRowModel()
                  .rows.some(
                    (r) =>
                      r.original.status === "success" ||
                      r.original.status === "rejected"
                  )}
                onClick={handleCancelSelected}
                title="Cancel selected"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel Selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                disabled={jobTable
                  .getSelectedRowModel()
                  .rows.some(
                    (r) =>
                      r.original.status === "success" ||
                      r.original.status === "rejected"
                  )}
                onClick={handleRetrySelected}
                title="Retry selected"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Selected
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <DebouncedInput
          value={jobGlobalFilter ?? ""}
          onChange={(value: string | number) =>
            setJobGlobalFilter(String(value))
          }
          className="p-2 font-lg shadow border border-gray-300 rounded max-w-sm bg-background text-foreground"
          placeholder="Search jobs..."
        />
      </div>

      {/* Mobile list view */}
      <div className="sm:hidden space-y-3">
        {jobRows.map((r, idx) => {
          const s = r.status;
          const variant =
            s === "failed" || s === "rejected"
              ? "destructive"
              : s === "in_progress"
              ? "secondary"
              : s === "queued"
              ? "outline"
              : "default";
          const p = Math.max(0, Math.min(100, Number(r.progress ?? 0)));
          const canCancel = s === "queued" || s === "in_progress";
          const canRetry = s === "failed" || s === "canceled";
          const canApprove = s === "pending_review";

          return (
            <div
              key={r.workflowId}
              className="border rounded p-3 cursor-pointer"
              onClick={() => {
                const aid = r.albumId;
                if (!aid || !albumMap.has(aid)) return;
                onOpen?.(aid, r.workflowId, r.status);
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={!!jobRowSelection[r.workflowId]}
                    onCheckedChange={(v) =>
                      setJobRowSelection((prev) => ({
                        ...prev,
                        [r.workflowId]: !!v,
                      }))
                    }
                    aria-label="Select row"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <AlbumCell
                    albumTitle={r.albumTitle}
                    artistName={r.artistName}
                    albumCover={r.albumCover}
                    albumId={r.albumId}
                    workflowId={r.workflowId}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Badge variant={variant}>{s}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">
                    {p}%
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canCancel}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCancel(r.workflowId);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canRetry}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onRetry(r.workflowId);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>

                {canApprove && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onApprove(r.workflowId, r.albumId);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onReject(r.workflowId, r.albumId);
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Started: {formatDateTime(r.startedAt)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block">
        <div className="rounded-md border overflow-x-auto">
          <table className="min-w-[900px] w-full text-foreground">
            <thead>
              {jobTable.getHeaderGroups().map((headerGroup) => (
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
                              onClick: header.column.getToggleSortingHandler(),
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
              {jobTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b cursor-pointer"
                  onClick={() => {
                    const r = row.original;
                    const aid = r.albumId;
                    if (!aid || !albumMap?.has?.(aid)) return;
                    onOpen?.(aid, r.workflowId, r.status);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => jobTable.setPageIndex(0)}
          disabled={!jobTable.getCanPreviousPage()}
        >
          {"<<"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => jobTable.previousPage()}
          disabled={!jobTable.getCanPreviousPage()}
        >
          {"<"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => jobTable.nextPage()}
          disabled={!jobTable.getCanNextPage()}
        >
          {">"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => jobTable.setPageIndex(jobTable.getPageCount() - 1)}
          disabled={!jobTable.getCanNextPage()}
        >
          {">>"}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {jobTable.getState().pagination.pageIndex + 1} of{" "}
            {jobTable.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            defaultValue={jobTable.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page =
                e.target.value &&
                Number(e.target.value) < jobTable.getPageCount() + 1
                  ? Number(e.target.value) - 1
                  : 0;
              jobTable.setPageIndex(page);
            }}
            className="border p-1 rounded w-16 bg-background text-foreground"
          />
        </span>
        <select
          value={jobTable.getState().pagination.pageSize}
          onChange={(e) => {
            jobTable.setPageSize(Number(e.target.value));
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
        {jobTable.getPrePaginationRowModel().rows.length} Rows
      </div>
    </div>
  );
}
