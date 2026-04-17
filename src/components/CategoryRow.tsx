import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';

interface CategoryRowProps {
  key?: string;
  title: string;
  videos: Video[];
  onSelect: (video: Video) => void;
  unlockedVideos: string[];
}

export default function CategoryRow({ title, videos, onSelect, unlockedVideos }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (videos.length === 0) return null;

  return (
    <div className="space-y-3 py-6 group/row">
      <h3 className="text-white text-lg font-semibold px-4 md:px-16 tracking-wide drop-shadow-sm">
        {title}
      </h3>
      
      <div className="relative">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-black/60 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center text-white"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
        >
          {videos.map((video) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onSelect={onSelect}
              isUnlocked={unlockedVideos.includes(video.id)}
            />
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-black/60 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center text-white"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
