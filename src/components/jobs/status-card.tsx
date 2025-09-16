import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

export type StatusCardProps = {
  title: string;
  count: number | string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onToggle?: () => void;
};

/**
 * StatusCard
 * - Reusable, clickable summary card for filtering table views.
 * - Uses shadcn Card primitives.
 * - Accessibility: role="button", aria-pressed, keyboard toggle (Enter/Space).
 */
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

  return (
    <Card
      className={cn(
        "select-none",
        disabled ? "opacity-60 pointer-events-none" : "cursor-pointer",
        active ? "ring-2 ring-primary" : "hover:bg-muted/50",
        "transition-colors",
        className
      )}
      role="button"
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      title={
        active ? "Click to clear filter" : "Click to filter by this status"
      }
    >
      <CardHeader className={cn("pb-2")}>
        <CardTitle className="text-sm font-medium text-foreground">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{count}</div>
      </CardContent>
    </Card>
  );
}
