import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import React, { useMemo, useState } from "react";

import { type ColumnFiltersState } from "@tanstack/react-table";

import AlbumReviewDrawer from "@/components/album-review-drawer";
import JobQueueTable, { type JobRow } from "@/components/JobQueueTable";
import StatusCard from "@/components/status-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function JobQueue() {
  const convex = useConvex();

  const { data = { jobs: [], albums: [], artists: [] } } = useQuery({
    ...convexQuery(api.workflow_jobs.getQueueBundle, {}),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { jobs, albums, artists } = data;

  const albumMap = useMemo(() => {
    const m = new Map<Id<"album">, Doc<"album">>();
    (albums ?? []).forEach((a) => m.set(a._id, a));
    return m;
  }, [albums]);

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
    } catch (e) {
      console.error("Reject failed", e);
    }
  };

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
            <JobQueueTable
              jobRows={jobRows}
              albumMap={albumMap}
              onCancel={handleCancelJob}
              onRetry={handleRetryJob}
              onApprove={(workflowId: string, albumId?: string) =>
                handleApprove(workflowId, albumId as Id<"album"> | undefined)
              }
              onReject={(workflowId: string, albumId?: string) =>
                handleReject(
                  workflowId,
                  albumId as Id<"album"> | undefined,
                  undefined
                )
              }
              jobGlobalFilter={jobGlobalFilter}
              onJobGlobalFilterChange={setJobGlobalFilter}
              jobColumnFilters={jobColumnFilters}
              onJobColumnFiltersChange={setJobColumnFilters}
              onOpen={(
                albumId?: string,
                workflowId?: string,
                status?: string
              ) => {
                if (!albumId) return;
                setSelectedAlbum({
                  albumId: albumId as Id<"album">,
                  workflowId,
                  status,
                });
                setDrawerOpen(true);
              }}
            />
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
