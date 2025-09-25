"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSingleAudio } from "@/hooks/use-single-audio";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

function formatDuration(ms?: number): string {
  const v = typeof ms === "number" ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const mins = Math.floor(v / 60);
  const secs = v % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export type AudioPlayerHandle = {
  play: () => void;
  pause: () => void;
};

interface AudioPlayerProps {
  src?: string;
  title: string;
  artist: string;
  duration: number;
  className?: string;
  audioRef?: React.RefObject<HTMLAudioElement>;
  autoPlay?: boolean;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  (
    {
      src,
      title,
      artist,
      duration,
      className,
      audioRef: audioRefProp,
      autoPlay,
    },
    ref
  ) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const internalAudioRef = useRef<HTMLAudioElement>(null);
    const effectiveAudioRef = (audioRefProp ??
      internalAudioRef) as React.RefObject<HTMLAudioElement>;

    const { requestPlay, notifyPause } = useSingleAudio();

    // Keep context informed + keep internal state in sync with native events
    useEffect(() => {
      const a = effectiveAudioRef.current;
      if (!a) return;

      const onPlay = () => {
        requestPlay(a);
        setIsPlaying(true);
      };
      const onPause = () => {
        setIsPlaying(false);
        notifyPause(a);
      };
      const onEnded = onPause;
      const onTime = () => setCurrentTime(a.currentTime);
      const onLoadedMetadata = () => {
        if (a.duration && !isNaN(a.duration)) {
          setAudioDuration(a.duration);
        }
      };

      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
      a.addEventListener("ended", onEnded);
      a.addEventListener("timeupdate", onTime);
      a.addEventListener("loadedmetadata", onLoadedMetadata);

      return () => {
        a.removeEventListener("play", onPlay);
        a.removeEventListener("pause", onPause);
        a.removeEventListener("ended", onEnded);
        a.removeEventListener("timeupdate", onTime);
        a.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [requestPlay, notifyPause]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          const a = effectiveAudioRef.current;
          if (!a || !src) return;
          requestPlay(a);
          a.play().catch(() => {});
          // isPlaying will be set by the "play" event
        },
        pause: () => {
          const a = effectiveAudioRef.current;
          if (!a) return;
          a.pause();
          // isPlaying will be set by the "pause" event
        },
      }),
      [src, requestPlay, notifyPause]
    );

    useEffect(() => {
      if (!autoPlay || !src) return;
      const a = effectiveAudioRef.current;
      if (a) {
        requestPlay(a);
        a.play().catch(() => {});
      }
    }, [autoPlay, src, requestPlay, audioRefProp]);

    const togglePlay = () => {
      const a = effectiveAudioRef.current;
      if (!a || !src) return;

      if (isPlaying) {
        a.pause();
      } else {
        requestPlay(a);
        a.play().catch(() => {});
      }
    };

    const handleSeek = (value: number[]) => {
      const a = effectiveAudioRef.current;
      if (!a) return;
      const newTime = value[0];
      a.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const handleVolumeChange = (value: number[]) => {
      const a = effectiveAudioRef.current;
      if (!a) return;
      const newVolume = value[0];
      a.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
      const a = effectiveAudioRef.current;
      if (!a) return;
      if (isMuted) {
        a.volume = volume;
        setIsMuted(false);
      } else {
        a.volume = 0;
        setIsMuted(true);
      }
    };

    if (!src) {
      return (
        <div
          className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg ${className}`}
        >
          <Button size="icon" variant="ghost" disabled className="h-8 w-8">
            <Play className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{artist}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            No audio available
          </span>
        </div>
      );
    }

    return (
      <div className={`space-y-3 p-3 bg-muted/50 rounded-lg ${className}`}>
        <audio ref={effectiveAudioRef} src={src} preload="metadata" />

        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={togglePlay}
            className="h-8 w-8"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{artist}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="h-6 w-6"
            >
              {isMuted ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
            <div className="w-16">
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10">
            {formatDuration(currentTime * 1000)}
          </span>
          <div className="flex-1">
            <Slider
              value={[currentTime]}
              onValueChange={handleSeek}
              max={Math.max(1, audioDuration || duration / 1000)}
              step={1}
              className="w-full"
            />
          </div>
          <span className="text-xs text-muted-foreground w-10">
            {formatDuration((audioDuration || duration / 1000) * 1000)}
          </span>
        </div>
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
