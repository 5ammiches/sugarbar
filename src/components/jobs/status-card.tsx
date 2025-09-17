import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";
import { Clock, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Eye } from "lucide-react";

export type StatusCardProps = {
  title: string;
  count: number | string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onToggle?: () => void;
};

const getStatusIcon = (title: string) => {
  switch (title.toLowerCase()) {
    case "queued":
      return Clock;
    case "in progress":
      return RefreshCw;
    case "pending review":
      return Eye;
    case "failed/canceled":
      return XCircle;
    case "completed":
    case "approved":
      return CheckCircle2;
    default:
      return AlertTriangle;
  }
};

const getStatusColor = (title: string, active: boolean) => {
  const baseClasses = active ? "ring-2" : "";

  switch (title.toLowerCase()) {
    case "queued":
      return cn(
        baseClasses,
        active
          ? "ring-slate-400 bg-slate-500/10 border-slate-500/20"
          : "hover:bg-slate-500/5 hover:border-slate-500/10"
      );
    case "in progress":
      return cn(
        baseClasses,
        active
          ? "ring-amber-400 bg-amber-500/10 border-amber-500/20"
          : "hover:bg-amber-500/5 hover:border-amber-500/10"
      );
    case "pending review":
      return cn(
        baseClasses,
        active
          ? "ring-purple-400 bg-purple-500/10 border-purple-500/20"
          : "hover:bg-purple-500/5 hover:border-purple-500/10"
      );
    case "failed/canceled":
      return cn(
        baseClasses,
        active
          ? "ring-red-400 bg-red-500/10 border-red-500/20"
          : "hover:bg-red-500/5 hover:border-red-500/10"
      );
    default:
      return cn(
        baseClasses,
        active ? "ring-primary bg-accent/50 border-accent-foreground/20" : "hover:bg-accent/50"
      );
  }
};

const getIconColor = (title: string, active: boolean) => {
  const intensity = active ? "300" : "400";

  switch (title.toLowerCase()) {
    case "queued":
      return `text-slate-${intensity}`;
    case "in progress":
      return `text-amber-${intensity}`;
    case "pending review":
      return `text-purple-${intensity}`;
    case "failed/canceled":
      return `text-red-${intensity}`;
    default:
      return `text-muted-foreground`;
  }
};

export default function StatusCard({
  title,
  count,
  description,
  active = false,
  disabled = false,
  className,
  onToggle,
}: StatusCardProps) {
  const handleToggle = (e?: React.SyntheticEvent) => {
    e?.preventDefault?.();
    if (disabled) return;
    onToggle?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.();
    }
  };

  const Icon = getStatusIcon(title);

  return (
    <Card
      className={cn(
        "select-none transition-all duration-200 border-2",
        disabled
          ? "opacity-60 pointer-events-none"
          : "cursor-pointer transform hover:scale-[1.02] hover:shadow-md",
        getStatusColor(title, active),
        className
      )}
      role="button"
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      title={active ? "Click to clear filter" : "Click to filter by this status"}
    >
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          <Icon className={cn("h-4 w-4", getIconColor(title, active))} />
        </div>
        {description && (
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-foreground tabular-nums">{count}</div>
          {active && <div className="text-xs text-muted-foreground font-medium">filtered</div>}
        </div>
      </CardContent>
    </Card>
  );
}
