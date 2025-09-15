import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { useConvex, useQuery } from "convex/react";
import React, { useMemo, useState } from "react";

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

import StatusCard from "@/components/StatusCard";
import AlbumCell from "@/components/AlbumCell";
import AlbumReviewDrawer from "@/components/AlbumReviewDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw, XCircle, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

// TODO add album cover to schema using upsertAlbum
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

type JobRow = {
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

export default function JobQueue() {
  const convex = useConvex();

  const jobs = useQuery(api.workflow_jobs.listJobs, {});

  const albumIds: Id<"album">[] = useMemo(() => {
    const ids = (jobs ?? [])
      .map((j) => j.context?.albumId)
      .filter((x): x is Id<"album"> => !!x);
    return Array.from(new Set(ids));
  }, [jobs]);

  const albums = useQuery(api.db.getAlbumsByIds, { albumIds });

  const albumMap = useMemo(() => {
    const m = new Map<Id<"album">, Doc<"album">>();
    (albums ?? []).forEach((a) => m.set(a._id, a));
    return m;
  }, [albums]);

  const artistIds: Id<"artist">[] = useMemo(() => {
    const ids = (albums ?? [])
      .map((a) => a.primary_artist_id as Id<"artist"> | undefined)
      .filter((x): x is Id<"artist"> => !!x);
    return Array.from(new Set(ids));
  }, [albums]);

  const artists = useQuery(api.db.getArtistsByIds, { artistIds });

  const artistMap = useMemo(() => {
    const m = new Map<Id<"artist">, Doc<"artist">>();
    (artists ?? []).forEach((ar) => m.set(ar._id, ar));
    return m;
  }, [artists]);

  function getAlbumCover(al?: Doc<"album">): string | undefined {
    return al?.images?.[0] ?? undefined;
  }

  function getPrimaryArtistName(al?: Doc<"album">): string | undefined {
    const artistId = al?.primary_artist_id;
    if (!artistId) return undefined;
    const artist = artistMap.get(artistId);
    return artist?.name ?? artist?.name_normalized ?? undefined;
  }

  const latestByAlbum = useMemo(() => {
    const map = new Map<string, Doc<"workflow_job">>();
    for (const j of jobs ?? []) {
      const internalId = j.context?.albumId as string | undefined;
      const spotifyId = j.context?.spotifyAlbumId as string | undefined;
      const key = internalId ?? spotifyId;
      if (!key) continue;

      const prev = map.get(key);
      const jUpdated = (j.updated_at ?? j.started_at ?? 0) as number;
      const pUpdated = (prev?.updated_at ?? prev?.started_at ?? 0) as number;

      if (!prev || jUpdated >= pUpdated) {
        map.set(key, j);
      }
    }
    return map;
  }, [jobs]);

  const jobRows: JobRow[] = useMemo(() => {
    const rows: JobRow[] = [];

    for (const j of latestByAlbum.values()) {
      const albumId = j.context?.albumId as Id<"album"> | undefined;
      const spotifyAlbumId = j.context?.spotifyAlbumId as string | undefined;
      const album = albumId ? albumMap.get(albumId) : undefined;

      rows.push({
        workflowId: j.workflow_id as string,
        workflowName: (j.workflow_name as string) ?? "unknown",
        status: j.status as JobRow["status"],
        progress: typeof j.progress === "number" ? (j.progress as number) : 0,
        startedAt: (j.started_at as number | undefined) ?? undefined,
        updatedAt: (j.updated_at as number | undefined) ?? undefined,
        error: j.error as string | undefined,
        args: j.args,
        albumId: albumId ?? spotifyAlbumId,
        albumTitle: album?.title,
        artistName:
          getPrimaryArtistName(album) ??
          (spotifyAlbumId ? "Unknown Artist" : undefined),
        albumCover: getAlbumCover(album),
      });
    }

    rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return rows;
  }, [latestByAlbum, albumMap, artistMap]);

  React.useEffect(() => {
    const ids = jobRows
      .filter((j) => j.status === "queued" || j.status === "in_progress")
      .map((j) => j.workflowId);
    if (ids.length === 0) {
      return;
    }
    const interval = setInterval(() => {
      convex
        .mutation(api.workflow_jobs.syncJobs, { workflowIds: ids })
        .catch(() => {});
    }, 10000); // 10s
    return () => clearInterval(interval);
  }, [convex, jobRows]);

  // Drawer state for album review details
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<{
    albumId?: Id<"album">;
    workflowId?: string;
    status?: string;
  } | null>(null);

  const [jobRowSelection, setJobRowSelection] = useState<
    Record<string, boolean>
  >({});
  const [jobGlobalFilter, setJobGlobalFilter] = useState("");
  const [jobColumnFilters, setJobColumnFilters] = useState<ColumnFiltersState>(
    []
  );

  // Counts & derived filters
  const inQueueCount = useMemo(
    () => jobRows.filter((j) => j.status === "queued").length,
    [jobRows]
  );
  const inProgressCount = useMemo(
    () => jobRows.filter((j) => j.status === "in_progress").length,
    [jobRows]
  );
  const pendingReviewCount = useMemo(
    () => jobRows.filter((j) => (j as any).status === "pending_review").length,
    [jobRows]
  );
  const failedCanceledCount = useMemo(
    () =>
      jobRows.filter(
        (j) =>
          j.status === "failed" ||
          j.status === "canceled" ||
          j.status === "rejected"
      ).length,
    [jobRows]
  );

  const isInQueueActive = useMemo(
    () =>
      jobColumnFilters.some(
        (f) => f.id === "status" && String(f.value) === "queued"
      ),
    [jobColumnFilters]
  );
  const isInProgressActive = useMemo(
    () =>
      jobColumnFilters.some(
        (f) => f.id === "status" && String(f.value) === "in_progress"
      ),
    [jobColumnFilters]
  );
  const isPendingReviewActive = useMemo(
    () =>
      jobColumnFilters.some(
        (f) => f.id === "status" && String(f.value) === "pending_review"
      ),
    [jobColumnFilters]
  );
  const isFailedCanceledActive = useMemo(
    () =>
      jobColumnFilters.some(
        (f) => f.id === "status" && String(f.value) === "__failed_or_canceled__"
      ),
    [jobColumnFilters]
  );

  const setStatusFilter = (value?: string) => {
    setJobColumnFilters(value ? [{ id: "status", value }] : []);
  };

  const toggleInQueueFilter = () => {
    const nowActive = isInQueueActive;
    setStatusFilter(nowActive ? undefined : "queued");
  };

  const toggleInProgressFilter = () => {
    const nowActive = isInProgressActive;
    setStatusFilter(nowActive ? undefined : "in_progress");
  };

  const togglePendingReviewFilter = () => {
    const nowActive = isPendingReviewActive;
    setStatusFilter(nowActive ? undefined : "pending_review");
  };

  const toggleFailedCanceledFilter = () => {
    const nowActive = isFailedCanceledActive;
    setStatusFilter(nowActive ? undefined : "__failed_or_canceled__");
  };

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const formatDateTime = (ms?: number) =>
    ms ? new Date(ms).toLocaleString() : "-";

  const handleCancelJob = async (workflowId: string) => {
    await convex.mutation(api.workflow_jobs.cancelJob, { workflowId });
  };
  const handleRetryJob = async (workflowId: string) => {
    await convex.action(api.workflow_jobs.retryJob, { workflowId });
  };

  const handleApprove = async (workflowId: string, albumId?: Id<"album">) => {
    if (!albumId) return;
    try {
      await convex.mutation(api.db.approveAlbum, {
        albumId,
        workflowId,
      });
      // rely on polling to pick up job updates
    } catch (e) {
      console.error("Approve failed", e);
    }
  };

  const handleReject = async (
    workflowId: string,
    albumId?: Id<"album">,
    reason?: string
  ) => {
    if (!albumId) return;
    try {
      await convex.mutation(api.db.rejectAlbum, {
        albumId,
        workflowId,
        reason,
      });
      // rely on polling to pick up job updates
    } catch (e) {
      console.error("Reject failed", e);
    }
  };

  const jobColumns = useMemo<ColumnDef<JobRow>[]>(
    () => [
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
      },
      {
        accessorKey: "workflowName",
        header: "Album",
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.albumTitle ?? "").toLowerCase();
          const b = (rowB.original.albumTitle ?? "").toLowerCase();
          if (a < b) return -1;
          if (a > b) return 1;
          return 0;
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
              albumTitle={row.original.albumTitle}
              artistName={row.original.artistName}
              albumCover={row.original.albumCover}
              albumId={row.original.albumId}
              workflowId={row.original.workflowId}
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
        filterFn: "equalsString",
      },
      {
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ row }) => (
          <span className="text-foreground">
            {formatDateTime(row.original.startedAt)}
          </span>
        ),
        filterFn: "includesString",
      },
      {
        id: "job_actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
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
                  handleCancelJob(row.original.workflowId);
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
                  handleRetryJob(row.original.workflowId);
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
                      handleApprove(
                        row.original.workflowId,
                        row.original.albumId as Id<"album">
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
                      handleReject(
                        row.original.workflowId,
                        row.original.albumId as Id<"album">
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
    ],
    []
  );

  const jobTable = useReactTable({
    data: jobRows,
    columns: jobColumns,
    state: {
      pagination,
      rowSelection: jobRowSelection,
      globalFilter: jobGlobalFilter,
      columnFilters: jobColumnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setJobRowSelection,
    onGlobalFilterChange: setJobGlobalFilter,
    onColumnFiltersChange: setJobColumnFilters,
    onPaginationChange: setPagination,
    getRowId: (row) => row.workflowId,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Job Queue</CardTitle>
            <CardDescription>
              Track queued workflows, see progress, cancel or retry jobs
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
                  onClick={async () => {
                    const rows = jobTable.getFilteredSelectedRowModel().rows;
                    await Promise.all(
                      rows.map((r) => handleCancelJob(r.original.workflowId))
                    );
                    setJobRowSelection({});
                  }}
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
                  onClick={async () => {
                    const rows = jobTable
                      .getFilteredSelectedRowModel()
                      .rows.filter(
                        (r) =>
                          r.original.status === "failed" ||
                          r.original.status === "canceled"
                      );
                    await Promise.all(
                      rows.map((r) => handleRetryJob(r.original.workflowId))
                    );
                    setJobRowSelection({});
                  }}
                  title="Retry selected"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry Selected
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatusCard
              title="Queued"
              count={inQueueCount}
              active={isInQueueActive}
              onToggle={toggleInQueueFilter}
            />
            <StatusCard
              title="In Progress"
              count={inProgressCount}
              active={isInProgressActive}
              onToggle={toggleInProgressFilter}
            />
            <StatusCard
              title="Pending Review"
              count={pendingReviewCount}
              active={isPendingReviewActive}
              onToggle={togglePendingReviewFilter}
            />
            <StatusCard
              title="Failed/Canceled"
              count={failedCanceledCount}
              active={isFailedCanceledActive}
              onToggle={toggleFailedCanceledFilter}
            />
          </div>
          <div>
            <DebouncedInput
              value={jobGlobalFilter ?? ""}
              onChange={(value) => setJobGlobalFilter(String(value))}
              className="p-2 font-lg shadow border border-gray-300 rounded max-w-sm bg-background text-foreground"
              placeholder="Search jobs..."
            />
          </div>

          {/* Mobile list view */}
          <div className="sm:hidden space-y-3">
            {jobTable.getRowModel().rows.map((row) => {
              const r = row.original;
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
                  key={row.id}
                  className="border rounded p-3 cursor-pointer"
                  onClick={() => {
                    const aid = r.albumId as Id<"album"> | undefined;
                    if (!aid || !albumMap.has(aid)) {
                      return;
                    }
                    setSelectedAlbum({
                      albumId: aid,
                      workflowId: r.workflowId,
                      status: r.status,
                    });
                    setDrawerOpen(true);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(v) => row.toggleSelected(!!v)}
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
                        handleCancelJob(r.workflowId);
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
                        handleRetryJob(r.workflowId);
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
                            handleApprove(
                              r.workflowId,
                              r.albumId as Id<"album">
                            );
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // reuse existing reject handler signature
                            handleReject(
                              r.workflowId,
                              r.albumId as Id<"album">
                            );
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
          <div className="hidden sm:block rounded-md border overflow-x-auto">
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
                {jobTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b cursor-pointer"
                    onClick={() => {
                      const r = row.original;
                      const aid = r.albumId as Id<"album"> | undefined;
                      // Only open drawer for internal albums that we have loaded in albumMap
                      if (!aid || !albumMap.has(aid)) {
                        return;
                      }
                      setSelectedAlbum({
                        albumId: aid,
                        workflowId: r.workflowId,
                        status: r.status,
                      });
                      setDrawerOpen(true);
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
      </CardContent>

      <AlbumReviewDrawer
        open={drawerOpen}
        albumId={selectedAlbum?.albumId}
        workflowId={selectedAlbum?.workflowId}
        status={selectedAlbum?.status}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAlbum(null);
        }}
      />
    </Card>
  );
}
