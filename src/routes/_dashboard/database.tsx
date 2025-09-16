import { createFileRoute } from "@tanstack/react-router";
import AlbumGallery from "@/components/albums/AlbumGallery";

export const Route = createFileRoute("/_dashboard/database")({
  component: AlbumGallery,
});
