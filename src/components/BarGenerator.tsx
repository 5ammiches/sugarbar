// import { api } from "@/../convex/_generated/api";
// import { useConvex } from "convex/react";
// import { useState, useRef, useEffect } from "react";
// import { Button } from "@/components/ui/neobrutalism-button";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import {
//   Play,
//   Pause,
//   Share2,
//   Music,
//   Shuffle,
//   ExternalLink,
//   Copy,
//   Twitter,
//   Facebook,
//   Instagram,
//   Volume2,
//   VolumeX,
// } from "lucide-react";
// import { toast } from "@/hooks/use-toast";

// interface Bar {
//   id: string;
//   text: string;
//   artist: string;
//   title: string;
//   album?: string;
//   year?: number;
//   platform: string;
//   contextScore: number;
//   lineCount: number;
//   generatedAt: number;
// }

// export function BarGenerator() {
//   const [isGenerating, setIsGenerating] = useState(false);
//   const [generationProgress, setGenerationProgress] = useState(0);
//   const [currentBar, setCurrentBar] = useState<Bar | null>(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [audioProgress, setAudioProgress] = useState(0);
//   const [isMuted, setIsMuted] = useState(false);
//   const [shareModalOpen, setShareModalOpen] = useState(false);
//   const audioRef = useRef<HTMLAudioElement>(null);
//   const convex = useConvex();

//   const generateBar = async () => {
//     setIsGenerating(true);
//     setGenerationProgress(0);
//     setCurrentBar(null);
//     setIsPlaying(false);
//     setAudioProgress(0);

//     const steps = [
//       { progress: 20, message: "DISCOVERING CONTENT..." },
//       { progress: 45, message: "PROCESSING LYRICS..." },
//       { progress: 70, message: "ANALYZING CONTEXT..." },
//       { progress: 90, message: "SYNCHRONIZING AUDIO..." },
//       { progress: 100, message: "COMPLETE!" },
//     ];

//     for (const step of steps) {
//       await new Promise((resolve) => setTimeout(resolve, 600));
//       setGenerationProgress(step.progress);
//     }

//     try {
//       const selectedBar = await convex.action(api.bars.generateRandomBar, {});
//       setCurrentBar(selectedBar);
//     } catch (error) {
//       console.error("Error generating bar:", error);
//       toast({
//         title: "ERROR GENERATING BAR",
//         description: "Failed to generate a new bar. Please try again.",
//       });
//     } finally {
//       setIsGenerating(false);
//     }
//   };

//   const togglePlayback = () => {
//     if (audioRef.current) {
//       if (isPlaying) {
//         audioRef.current.pause();
//       } else {
//         audioRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   const toggleMute = () => {
//     if (audioRef.current) {
//       audioRef.current.muted = !isMuted;
//       setIsMuted(!isMuted);
//     }
//   };

//   const copyToClipboard = async () => {
//     if (!currentBar) return;

//     const text = `"${currentBar.text}" - ${currentBar.artist}, "${currentBar.title}"`;
//     await navigator.clipboard.writeText(text);
//     toast({
//       title: "COPIED TO CLIPBOARD!",
//       description: "Bar has been copied to your clipboard.",
//     });
//   };

//   const shareToSocial = (platform: string) => {
//     if (!currentBar) return;

//     const text = `Check out this fire bar: "${
//       currentBar.text.split("\n")[0]
//     }" - ${currentBar.artist} 🔥`;
//     const url = window.location.href;

//     let shareUrl = "";
//     switch (platform) {
//       case "twitter":
//         shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
//           text
//         )}&url=${encodeURIComponent(url)}`;
//         break;
//       case "facebook":
//         shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
//           url
//         )}`;
//         break;
//       case "instagram":
//         toast({
//           title: "INSTAGRAM SHARING",
//           description: "Copy the text and share it on your Instagram story!",
//         });
//         copyToClipboard();
//         return;
//     }

//     if (shareUrl) {
//       window.open(shareUrl, "_blank", "width=600,height=400");
//     }
//   };

//   const openStreamingPlatform = (platform: string) => {
//     if (!currentBar) return;

//     const query = `${currentBar.artist} ${currentBar.title}`;
//     let url = "";

//     switch (platform) {
//       case "spotify":
//         url = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
//         break;
//       case "youtube":
//         url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
//           query
//         )}`;
//         break;
//       case "apple":
//         url = `https://music.apple.com/search?term=${encodeURIComponent(
//           query
//         )}`;
//         break;
//     }

//     if (url) {
//       window.open(url, "_blank");
//     }
//   };

//   useEffect(() => {
//     let interval: NodeJS.Timeout;
//     if (isPlaying) {
//       interval = setInterval(() => {
//         setAudioProgress((prev) => {
//           if (prev >= 100) {
//             setIsPlaying(false);
//             return 0;
//           }
//           return prev + 1;
//         });
//       }, 300);
//     }
//     return () => clearInterval(interval);
//   }, [isPlaying]);

//   return (
//     <div className="min-h-screen bg-retro-red relative overflow-hidden">
//       <div className="container mx-auto px-4 py-8 relative z-10">
//         <div className="text-center mb-12">
//           <div className="flex items-center justify-center gap-3 mb-4">
//             <div className="w-12 h-12 bg-black border-2 border-black flex items-center justify-center shadow-red-shadow">
//               <Music className="w-6 h-6 text-white" />
//             </div>
//             <h1 className="text-4xl md:text-6xl font-bold text-white font-mono tracking-wider drop-shadow-lg">
//               HIP-HOP BAR GENERATOR
//             </h1>
//           </div>
//           <div className="bg-yellow-400 border-2 border-black p-4 max-w-3xl mx-auto shadow-shadow">
//             <p className="text-lg text-black font-mono uppercase tracking-wide font-bold">
//               &gt; DISCOVER RANDOM HIP-HOP BARS WITH SYNCHRONIZED AUDIO
//               PLAYBACK_
//             </p>
//           </div>
//         </div>

//         <div className="max-w-4xl mx-auto">
//           <div className="text-center mb-8">
//             <Button
//               onClick={generateBar}
//               disabled={isGenerating}
//               size="lg"
//               className="px-12 py-6 text-xl font-mono uppercase tracking-wider"
//             >
//               {isGenerating ? (
//                 <div className="flex items-center gap-3">
//                   <div className="w-6 h-6 border-4 border-white border-t-transparent animate-spin"></div>
//                   GENERATING...
//                 </div>
//               ) : (
//                 <div className="flex items-center gap-3">
//                   <Shuffle className="w-6 h-6" />
//                   GENERATE HIP-HOP BAR
//                 </div>
//               )}
//             </Button>
//           </div>

//           {isGenerating && (
//             <div className="mb-8 bg-white border-2 border-black p-6 shadow-shadow">
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between text-black font-mono uppercase font-bold">
//                   <span>PROCESSING...</span>
//                   <span>{generationProgress}%</span>
//                 </div>
//                 <div className="w-full bg-gray-300 border-2 border-black h-6">
//                   <div
//                     className="h-full bg-black transition-all duration-300"
//                     style={{ width: `${generationProgress}%` }}
//                   ></div>
//                 </div>
//               </div>
//             </div>
//           )}

//           {currentBar && !isGenerating && (
//             <div className="mb-8 bg-white border-2 border-black p-8 shadow-shadow">
//               <div className="mb-6">
//                 <div className="text-2xl md:text-3xl font-bold text-black leading-relaxed space-y-2">
//                   {currentBar.text.split("\n").map((line, index) => (
//                     <div
//                       key={index}
//                       className="hover:text-retro-red transition-colors duration-200 p-2 border-l-4 border-transparent hover:border-retro-red hover:bg-gray-100 font-['Comic_Sans_MS',_'Marker_Felt',_'Brush_Script_MT',_cursive]"
//                     >
//                       {line}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className="mb-6 bg-yellow-400 border-2 border-black p-4 shadow-shadow">
//                 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//                   <div>
//                     <h3 className="text-xl font-bold text-black font-mono uppercase tracking-wide">
//                       ARTIST: {currentBar.artist}
//                     </h3>
//                     <p className="text-lg text-black font-mono font-bold">
//                       TRACK: "{currentBar.title}"
//                     </p>
//                     {currentBar.album && (
//                       <p className="text-sm text-black font-mono">
//                         ALBUM: {currentBar.album} • YEAR: {currentBar.year}
//                       </p>
//                     )}
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <div className="text-sm text-black font-mono uppercase font-bold">
//                       QUALITY:
//                     </div>
//                     <div className="bg-green-400 text-black px-3 py-1 border-2 border-black text-sm font-mono font-bold shadow-shadow">
//                       {currentBar.contextScore}/100
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="mb-6 bg-gray-100 border-2 border-black p-4 shadow-shadow">
//                 <div className="flex items-center gap-4 mb-3">
//                   <Button onClick={togglePlayback} size="sm">
//                     {isPlaying ? (
//                       <Pause className="w-4 h-4" />
//                     ) : (
//                       <Play className="w-4 h-4" />
//                     )}
//                   </Button>
//                   <Button onClick={toggleMute} size="sm" variant="neutral">
//                     {isMuted ? (
//                       <VolumeX className="w-4 h-4" />
//                     ) : (
//                       <Volume2 className="w-4 h-4" />
//                     )}
//                   </Button>
//                   <div className="flex-1 bg-white border-2 border-black h-6">
//                     <div
//                       className="h-full bg-retro-red transition-all duration-300"
//                       style={{ width: `${audioProgress}%` }}
//                     ></div>
//                   </div>
//                   <div className="text-sm text-black font-mono font-bold">
//                     {Math.floor(audioProgress * 0.3)}S / 30S
//                   </div>
//                 </div>
//                 <audio ref={audioRef} className="hidden">
//                   <source src="/placeholder-audio.mp3" type="audio/mpeg" />
//                 </audio>
//               </div>

//               <div className="flex flex-col md:flex-row gap-4">
//                 <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
//                   <DialogTrigger asChild>
//                     <Button variant="neutral">
//                       <Share2 className="w-4 h-4" />
//                       SHARE BAR
//                     </Button>
//                   </DialogTrigger>
//                   <DialogContent className="bg-white border-2 border-black shadow-shadow">
//                     <DialogHeader>
//                       <DialogTitle className="text-black font-mono uppercase text-xl font-bold">
//                         &gt; SHARE THIS BAR
//                       </DialogTitle>
//                     </DialogHeader>
//                     <div className="space-y-4">
//                       <div className="grid grid-cols-2 gap-3">
//                         <Button
//                           onClick={() => shareToSocial("twitter")}
//                           className="bg-blue-500 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                         >
//                           <Twitter className="w-4 h-4" />
//                           TWITTER
//                         </Button>
//                         <Button
//                           onClick={() => shareToSocial("facebook")}
//                           className="bg-blue-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                         >
//                           <Facebook className="w-4 h-4" />
//                           FACEBOOK
//                         </Button>
//                         <Button
//                           onClick={() => shareToSocial("instagram")}
//                           className="bg-purple-600 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                         >
//                           <Instagram className="w-4 h-4" />
//                           INSTAGRAM
//                         </Button>
//                         <Button
//                           onClick={copyToClipboard}
//                           className="bg-gray-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                         >
//                           <Copy className="w-4 h-4" />
//                           COPY TEXT
//                         </Button>
//                       </div>
//                     </div>
//                   </DialogContent>
//                 </Dialog>

//                 <div className="flex gap-3 flex-wrap">
//                   <Button
//                     onClick={() => openStreamingPlatform("spotify")}
//                     className="bg-green-500 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                   >
//                     <ExternalLink className="w-4 h-4" />
//                     SPOTIFY
//                   </Button>
//                   <Button
//                     onClick={() => openStreamingPlatform("youtube")}
//                     className="bg-red-600 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                   >
//                     <ExternalLink className="w-4 h-4" />
//                     YOUTUBE
//                   </Button>
//                   <Button
//                     onClick={() => openStreamingPlatform("apple")}
//                     className="bg-gray-800 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
//                   >
//                     <ExternalLink className="w-4 h-4" />
//                     APPLE MUSIC
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
