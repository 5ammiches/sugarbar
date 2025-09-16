import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Search from "@/components/Search";

export const SearchSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["album", "artist", "track", "playlist"]).optional(),
});
export type SearchParams = z.infer<typeof SearchSchema>;

export const Route = createFileRoute("/_dashboard/")({
  validateSearch: SearchSchema,
  component: Search,
});
