import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface VideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
}

export default function VideoPlayer({ src, title, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(Number(e.target.value));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        autoPlay
      />

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-6"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-white text-xl font-bold truncate pr-4">{title}</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="text-white w-6 h-6" />
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                  </button>
                  <button onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)} className="text-white hover:scale-110 transition-transform">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:scale-110 transition-transform">
                    {isMuted ? <VolumeX /> : <Volume2 />}
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <a 
                    href={src} 
                    download={title}
                    className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                    title="Download Video"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Download</span>
                  </a>
                  <button onClick={toggleFullscreen} className="text-white hover:scale-110 transition-transform">
                    {isFullscreen ? <Minimize /> : <Maximize />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
