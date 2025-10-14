import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check } from "lucide-react";
import React, { JSX } from "react";

interface AlbumCellProps {
  albumTitle?: string;
  artistName?: string;
  albumCover?: string;
  albumId?: string;
  workflowId: string;
}

function shortId(id?: string) {
  if (!id) return "";
  return id.length > 9 ? `${id.slice(0, 15)}…` : id;
}

export default function AlbumCell({
  albumTitle,
  artistName,
  albumCover,
  albumId,
  workflowId,
}: AlbumCellProps): JSX.Element {
  const isLoading = !albumTitle && !albumCover;

  const [wfCopied, setWfCopied] = React.useState(false);
  const [albCopied, setAlbCopied] = React.useState(false);
  const wfTimer = React.useRef<number | null>(null);
  const albTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (wfTimer.current) window.clearTimeout(wfTimer.current);
      if (albTimer.current) window.clearTimeout(albTimer.current);
    };
  }, []);

  const copyInline = async (
    id: string | undefined,
    which: "wf" | "alb"
  ): Promise<void> => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      if (which === "wf") {
        setWfCopied(true);
        if (wfTimer.current) window.clearTimeout(wfTimer.current);
        wfTimer.current = window.setTimeout(() => setWfCopied(false), 1000);
      } else {
        setAlbCopied(true);
        if (albTimer.current) window.clearTimeout(albTimer.current);
        albTimer.current = window.setTimeout(() => setAlbCopied(false), 1000);
      }
    } catch {
      // optional: set an error style briefly or fall back to toast
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-20 w-20 rounded" />
        <div className="flex flex-col flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {albumCover ? (
        <img
          src={albumCover}
          alt={`${albumTitle || "Album"} cover`}
          className="h-20 w-20 rounded object-cover flex-shrink-0 hidden sm:block"
          loading="lazy"
        />
      ) : (
        <div className="h-20 w-20 rounded bg-muted flex-shrink-0 sm:flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No Cover</span>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">
          {albumTitle ?? "Unknown Album"}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {artistName ?? "Unknown Artist"}
        </div>
        <div className="mt-1 flex flex-col gap-1 text-xs font-mono text-muted-foreground">
          {/* Workflow ID (top) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="w-fit max-w-full truncate cursor-pointer hover:text-foreground transition-colors outline-none"
                title={workflowId}
                onClick={(e) => {
                  e.stopPropagation();
                  void copyInline(workflowId, "wf");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void copyInline(workflowId, "wf");
                  }
                }}
              >
                {wfCopied ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check className="h-3 w-3" />
                    copied
                  </span>
                ) : (
                  <span>wf: {shortId(workflowId)}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={2}>{workflowId}</TooltipContent>
          </Tooltip>

          {/* Album ID (bottom) */}
          {albumId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="w-fit max-w-full truncate cursor-pointer hover:text-foreground transition-colors outline-none"
                  title={albumId}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyInline(albumId, "alb");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void copyInline(albumId, "alb");
                    }
                  }}
                >
                  {albCopied ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Check className="h-3 w-3" />
                      copied
                    </span>
                  ) : (
                    <span>alb: {shortId(albumId)}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={2}>{albumId}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
