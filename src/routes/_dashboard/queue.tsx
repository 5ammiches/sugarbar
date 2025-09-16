import { createFileRoute } from "@tanstack/react-router";
import JobQueue from "@/components/jobs/JobQueue";

export const Route = createFileRoute("/_dashboard/queue")({
  component: JobQueue,
});
