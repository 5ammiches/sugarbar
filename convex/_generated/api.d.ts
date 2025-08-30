/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as bars from "../bars.js";
import type * as db from "../db.js";
import type * as lyrics from "../lyrics.js";
import type * as providers_lyrics_python_lyrics from "../providers/lyrics/python_lyrics.js";
import type * as providers_music_spotify from "../providers/music/spotify.js";
import type * as spotify from "../spotify.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  bars: typeof bars;
  db: typeof db;
  lyrics: typeof lyrics;
  "providers/lyrics/python_lyrics": typeof providers_lyrics_python_lyrics;
  "providers/music/spotify": typeof providers_music_spotify;
  spotify: typeof spotify;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
