import React from 'react';
import { Play, Lock, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { Video } from '../types';
import { cn } from '../lib/utils';

interface VideoCardProps {
  key?: string;
  video: Video;
  onSelect: (video: Video) => void;
  isUnlocked?: boolean;
}

export default function VideoCard({ video, onSelect, isUnlocked }: VideoCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      className="relative flex-none w-[180px] h-[100px] rounded-[6px] overflow-hidden cursor-pointer bg-brand-surface border border-white/5 shadow-lg group"
      onClick={() => onSelect(video)}
    >
      <img
        src={video.thumbnail}
        alt={video.title}
        className="w-full h-full object-cover opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 transition-opacity">
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
          {video.isPremium && !isUnlocked ? (
            <div className="bg-brand-accent p-2 rounded">
              <Lock className="text-white w-5 h-5" />
            </div>
          ) : (
            <>
              <div className="bg-white/10 backdrop-blur-md p-2 rounded-full border border-white/20 hover:scale-110 transition-transform">
                <Play className="text-white fill-current w-4 h-4" />
              </div>
              <a 
                href={video.videoUrl} 
                download={video.title}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/10 backdrop-blur-md p-2 rounded-full border border-white/20 hover:scale-110 transition-transform flex items-center justify-center"
                title="Download Video"
              >
                <Download className="text-white w-4 h-4" />
              </a>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-white text-[11px] font-medium truncate drop-shadow-md">{video.title}</p>
      </div>

      {video.isPremium && (
        <span className="absolute top-1.5 right-1.5 text-[8px] bg-brand-accent text-white px-1 py-0.5 rounded-sm font-bold uppercase tracking-wider shadow-md">
          Premium
        </span>
      )}
    </motion.div>
  );
}
