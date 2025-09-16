"use client";

import { useState } from "react";
import { Doc } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Copy, Check } from "lucide-react";

interface LyricsDisplayProps {
  lyrics: Doc<"lyric_variant">[];
  trackTitle: string;
}

export function LyricsDisplay({ lyrics, trackTitle }: LyricsDisplayProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (lyrics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No lyrics available for this track</p>
      </div>
    );
  }

  const copyLyrics = async (lyric: Doc<"lyric_variant">) => {
    try {
      await navigator.clipboard.writeText(lyric.lyrics);
      setCopiedId(lyric._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy lyrics:", err);
    }
  };

  const formatLastCrawled = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const sortedLyrics = [...lyrics];

  if (sortedLyrics.length === 1) {
    const lyric = sortedLyrics[0];
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Lyrics for {trackTitle}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {lyric.source}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-64 w-full rounded-lg border bg-muted/30 p-4">
            <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
              {lyric.lyrics}
            </pre>
          </ScrollArea>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="space-x-4">
              <span>
                Last updated: {formatLastCrawled(lyric.last_crawled_at)}
              </span>
              {lyric.version && <span>Version: {lyric.version}</span>}
            </div>
            <div className="flex items-center gap-2">
              {lyric.url && (
                <Button size="sm" variant="ghost" className="h-6 px-2" asChild>
                  <a href={lyric.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Source
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => copyLyrics(lyric)}
              >
                {copiedId === lyric._id ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copiedId === lyric._id ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Lyrics for {trackTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Multiple sources available
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={sortedLyrics[0]._id} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
            {sortedLyrics.map((lyric) => (
              <TabsTrigger
                key={lyric._id}
                value={lyric._id}
                className="text-xs"
              >
                {lyric.source}
              </TabsTrigger>
            ))}
          </TabsList>

          {sortedLyrics.map((lyric) => (
            <TabsContent
              key={lyric._id}
              value={lyric._id}
              className="space-y-4 mt-4"
            >
              <ScrollArea className="h-64 w-full rounded-lg border bg-muted/30 p-4">
                <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                  {lyric.lyrics}
                </pre>
              </ScrollArea>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="space-x-4">
                  <span>
                    Last updated: {formatLastCrawled(lyric.last_crawled_at)}
                  </span>
                  {lyric.version && <span>Version: {lyric.version}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {lyric.url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      asChild
                    >
                      <a
                        href={lyric.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Source
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => copyLyrics(lyric)}
                  >
                    {copiedId === lyric._id ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {copiedId === lyric._id ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
