import { createMapper } from "@/utils/mapping/createMapper";
import { AlbumSchema, Album } from "@/utils/typings";

export const mapSpotifyAlbum = createMapper<Album>(
  AlbumSchema,
  {
    name: "title",
    "artists.0.name": "artist_name",
    id: "metadata.external_ids.spotify",
    release_date: "release_date",
    genres: "genre_tags",
    "external_urls.spotify": "metadata.source_urls.spotify",
  },
  {
    genre_tags: (genres) => genres ?? [],
    metadata: (_, raw) => ({
      total_tracks: raw.total_tracks,
    }),
  }
);
