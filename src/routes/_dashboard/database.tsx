import { createFileRoute } from "@tanstack/react-router";
import AlbumGallery from "@/components/AlbumGallery";

export const Route = createFileRoute("/_dashboard/database")({
  component: AlbumGallery,
});
