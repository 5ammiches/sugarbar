import { api } from "@/../convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
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

import { Album } from "@/../convex/utils/typings";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Check,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: AlbumPipelineDashboard,
});

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

const mockJobs = [
  {
    id: "job-1",
    albumName: "Thriller",
    artist: "Michael Jackson",
    status: "processing",
    progress: 65,
    stage: "Fetching lyrics",
    startTime: "2024-01-15 14:30",
  },
  {
    id: "job-2",
    albumName: "Back in Black",
    artist: "AC/DC",
    status: "queued",
    progress: 0,
    stage: "Waiting",
    startTime: "2024-01-15 14:45",
  },
];

const mockAlbums = [
  {
    id: "album-1",
    name: "Hotel California",
    artist: "Eagles",
    tracks: 9,
    addedDate: "2024-01-10",
    status: "complete",
  },
  {
    id: "album-2",
    name: "Bohemian Rhapsody",
    artist: "Queen",
    tracks: 12,
    addedDate: "2024-01-08",
    status: "complete",
  },
];

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
  }, [value]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={`${props.className || ""} bg-background text-foreground`}
    />
  );
}

export default function AlbumPipelineDashboard() {
  const convex = useConvex();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("album");
  const [searchResults, setSearchResults] = useState<SearchRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeView, setActiveView] = useState("search");
  const [selectedAlbums, setSelectedAlbums] = useState<string[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [adding, setAdding] = useState<
    Record<string, "idle" | "adding" | "success" | "error">
  >({});
  // Stable status key helper: prefer spotifyId when present
  const statusKey = (row: { spotifyId?: string; id: string }) =>
    (row.spotifyId && String(row.spotifyId)) || String(row.id);

  // Job Queue data (Convex workflows)
  const jobs = useQuery(api.workflow_jobs.listJobs, {});
  type JobRow = {
    workflowId: string;
    workflowName: string;
    status: "queued" | "in_progress" | "success" | "failed" | "canceled";
    progress: number;
    startedAt?: number;
    updatedAt?: number;
    error?: string;
    args?: any;
  };

  const jobRows: JobRow[] = useMemo(
    () =>
      (jobs ?? []).map((j) => ({
        workflowId: j.workflow_id as string,
        workflowName: (j.workflow_name as string) ?? "unknown",
        status: j.status as JobRow["status"],
        progress: typeof j.progress === "number" ? (j.progress as number) : 0,
        startedAt: j.started_at as number | undefined,
        updatedAt: j.updated_at as number | undefined,
        error: j.error as string | undefined,
        args: j.args,
      })),
    [jobs]
  );

  const [jobRowSelection, setJobRowSelection] = useState<
    Record<string, boolean>
  >({});
  const [jobGlobalFilter, setJobGlobalFilter] = useState("");

  const formatDateTime = (ms?: number) =>
    ms ? new Date(ms).toLocaleString() : "-";

  const handleCancelJob = async (workflowId: string) => {
    await convex.mutation(api.workflow_jobs.cancelJob, { workflowId });
  };
  const handleRetryJob = async (workflowId: string) => {
    await convex.action(api.workflow_jobs.retryJob, { workflowId });
  };
  const handleSyncJob = async (workflowId: string) => {
    await convex.mutation(api.workflow_jobs.syncJob, { workflowId });
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
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "workflowName",
        header: "Workflow",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <div className="font-medium text-foreground">
              {row.getValue("workflowName")}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {row.original.workflowId}
            </div>
            {row.original.args?.albumId && (
              <div className="text-xs text-muted-foreground">
                albumId: {row.original.args.albumId}
              </div>
            )}
          </div>
        ),
        filterFn: "includesString",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          const variant =
            s === "failed"
              ? "destructive"
              : s === "in_progress"
              ? "secondary"
              : s === "queued"
              ? "outline"
              : "default";
          return <Badge variant={variant as any}>{s}</Badge>;
        },
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
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncJob(row.original.workflowId);
                }}
                title="Sync status"
                className="cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sync
              </Button>
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
      rowSelection: jobRowSelection,
      globalFilter: jobGlobalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setJobRowSelection,
    onGlobalFilterChange: setJobGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  // Poll queued/in-progress jobs periodically to sync progress/status
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

    // mark as adding
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

    // apply result per row without persisting (ephemeral status)
    setAdding((prev) => {
      const next = { ...prev };
      results.forEach((res, idx) => {
        const key = statusKey(albumsToAdd[idx]);
        next[key] = res.status === "fulfilled" ? "success" : "error";
      });
      return next;
    });

    // clear selection so user can see states held on rows
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
      // Mark as queued (ephemeral; do not persist)
      setAdding((prev) => ({ ...prev, [key]: "success" }));
    } catch (e) {
      setAdding((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const columns = useMemo<ColumnDef<SearchRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          // Determine which page rows are actually selectable (have a spotifyId and are not adding/success)
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
                // Toggle selection only for selectable rows
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
                // Prevent toggling selection when the row is disabled
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
    [adding]
  );

  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection).filter(
      (key) => rowSelection[key as keyof typeof rowSelection]
    );
    const selectedIds = selectedRows
      .map((index) => searchResults[parseInt(index)]?.id)
      .filter(Boolean);
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });

  return (
    <div className="dark">
      <SidebarProvider>
        <AppSidebar activeView={activeView} onViewChange={setActiveView} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Album Pipeline</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {activeView === "search" && "Search Albums"}
                      {activeView === "queue" && "Job Queue"}
                      {activeView === "database" && "My Albums"}
                      {activeView === "progress" && "Progress"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 p-4 pt-0 overflow-auto">
              {activeView === "search" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Search Spotify Content</CardTitle>
                      <CardDescription>
                        Search for albums, artists, tracks, or playlists to add
                        to your pipeline
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
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleSearch()
                            }
                          />
                          <Select
                            value={searchType}
                            onValueChange={setSearchType}
                          >
                            <SelectTriggerComponent className="w-32">
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
                              <Search className="h-4 w-4 mr-2" />
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
                            Click on an album name to view details, or select
                            albums to add to your pipeline
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
                              const row = searchResults.find(
                                (r) => r.id === id
                              );
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
                                <tr
                                  key={headerGroup.id}
                                  className="border-b bg-muted/50"
                                >
                                  {headerGroup.headers.map((header) => {
                                    return (
                                      <th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                        className="h-auto px-4 py-2 text-left align-top font-medium text-muted-foreground"
                                      >
                                        {header.isPlaceholder ? null : (
                                          <>
                                            <div
                                              {...{
                                                className:
                                                  header.column.getCanSort()
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
                                              {header.column.getIsSorted() ===
                                              "asc"
                                                ? " 🔼"
                                                : header.column.getIsSorted() ===
                                                  "desc"
                                                ? " 🔽"
                                                : null}
                                            </div>
                                            {header.column.getCanFilter() ? (
                                              <div>
                                                <Filter
                                                  column={header.column}
                                                />
                                              </div>
                                            ) : null}
                                          </>
                                        )}
                                      </th>
                                    );
                                  })}
                                </tr>
                              ))}
                            </thead>
                            <tbody>
                              {table.getRowModel().rows.map((row) => (
                                <React.Fragment key={row.id}>
                                  <tr className="border-b">
                                    {row.getVisibleCells().map((cell) => (
                                      <td
                                        key={cell.id}
                                        className="p-4 align-middle"
                                      >
                                        {flexRender(
                                          cell.column.columnDef.cell,
                                          cell.getContext()
                                        )}
                                      </td>
                                    ))}
                                  </tr>

                                  {selectedAlbum &&
                                    selectedAlbum.id === row.original.id && (
                                      <tr
                                        key={`${row.id}-details`}
                                        className="bg-muted/30"
                                      >
                                        <td
                                          colSpan={
                                            table.getVisibleLeafColumns().length
                                          }
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
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
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
                            onClick={() =>
                              table.setPageIndex(table.getPageCount() - 1)
                            }
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
                              defaultValue={
                                table.getState().pagination.pageIndex + 1
                              }
                              onChange={(e) => {
                                const page = e.target.value
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
              )}

              {activeView === "queue" && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Job Queue</CardTitle>
                        <CardDescription>
                          Track queued workflows, see progress, cancel or retry
                          jobs
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {jobTable.getFilteredSelectedRowModel().rows.length >
                          0 && (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="cursor-pointer"
                              onClick={async () => {
                                const rows =
                                  jobTable.getFilteredSelectedRowModel().rows;
                                await Promise.all(
                                  rows.map((r) =>
                                    handleCancelJob(r.original.workflowId)
                                  )
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
                              onClick={async () => {
                                const rows = jobTable
                                  .getFilteredSelectedRowModel()
                                  .rows.filter(
                                    (r) =>
                                      r.original.status === "failed" ||
                                      r.original.status === "canceled"
                                  );
                                await Promise.all(
                                  rows.map((r) =>
                                    handleRetryJob(r.original.workflowId)
                                  )
                                );
                                setJobRowSelection({});
                              }}
                              title="Retry selected"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Retry Selected
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer"
                              onClick={async () => {
                                const rows =
                                  jobTable.getFilteredSelectedRowModel().rows;
                                await Promise.all(
                                  rows.map((r) =>
                                    handleSyncJob(r.original.workflowId)
                                  )
                                );
                              }}
                              title="Sync selected"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Sync Selected
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={async () => {
                            const ids = jobRows.map((r) => r.workflowId);
                            if (ids.length === 0) return;
                            await convex.mutation(api.workflow_jobs.syncJobs, {
                              workflowIds: ids,
                            });
                          }}
                          title="Sync all jobs"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Sync All
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <DebouncedInput
                          value={jobGlobalFilter ?? ""}
                          onChange={(value) =>
                            setJobGlobalFilter(String(value))
                          }
                          className="p-2 font-lg shadow border border-gray-300 rounded max-w-sm bg-background text-foreground"
                          placeholder="Search jobs..."
                        />
                      </div>
                      <div className="rounded-md border">
                        <table className="w-full text-foreground">
                          <thead>
                            {jobTable.getHeaderGroups().map((headerGroup) => (
                              <tr
                                key={headerGroup.id}
                                className="border-b bg-muted/50"
                              >
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
                                            className:
                                              header.column.getCanSort()
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
                                            : header.column.getIsSorted() ===
                                              "desc"
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
                              <tr key={row.id} className="border-b">
                                {row.getVisibleCells().map((cell) => (
                                  <td
                                    key={cell.id}
                                    className="p-4 align-middle"
                                  >
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
                          onClick={() =>
                            jobTable.setPageIndex(jobTable.getPageCount() - 1)
                          }
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
                            defaultValue={
                              jobTable.getState().pagination.pageIndex + 1
                            }
                            onChange={(e) => {
                              const page = e.target.value
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
                </Card>
              )}

              {activeView === "database" && (
                <Card>
                  <CardHeader>
                    <CardTitle>My Albums Database</CardTitle>
                    <CardDescription>
                      Albums that have been successfully processed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Album
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Artist
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Tracks
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Added
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockAlbums.map((album) => (
                            <tr key={album.id} className="border-b">
                              <td className="p-4 align-middle">
                                <div className="font-medium text-foreground">
                                  {album.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  by {album.artist}
                                </div>
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.artist}
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.tracks}
                              </td>
                              <td className="p-4 align-middle text-foreground">
                                {album.addedDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeView === "progress" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Total Albums
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">1,234</div>
                        <p className="text-xs text-muted-foreground">
                          +20.1% from last month
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Active Jobs
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">23</div>
                        <p className="text-xs text-muted-foreground">
                          +180.1% from last month
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
