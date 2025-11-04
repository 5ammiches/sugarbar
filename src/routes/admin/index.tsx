import Search from "@/components/search/Search";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const SearchSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["album", "artist", "track", "playlist"]).optional(),
});
export type SearchParams = z.infer<typeof SearchSchema>;

export const Route = createFileRoute("/admin/")({
  validateSearch: SearchSchema,
  component: Search,
});
