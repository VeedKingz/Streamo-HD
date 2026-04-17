import React, { useState, useEffect } from 'react';
import { X, PlayCircle, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MockAdProps {
  onComplete: () => void;
  onClose: () => void;
}

export default function MockAd({ onComplete, onClose }: MockAdProps) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="max-w-md w-full bg-brand-surface rounded-lg overflow-hidden border border-white/5 shadow-2xl">
        <div className="aspect-video bg-black/40 flex items-center justify-center relative">
          <div className="text-center space-y-4">
            <Gift className="w-16 h-16 text-brand-accent mx-auto animate-pulse" />
            <p className="text-white font-serif text-lg">Watch this ad to unlock premium content!</p>
          </div>
          
          <div className="absolute top-4 right-4 bg-brand-accent/80 px-3 py-1 rounded text-white text-xs font-bold uppercase tracking-widest">
            {timeLeft > 0 ? `Ad ends in ${timeLeft}s` : 'Reward Unlocked!'}
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: `${((15 - timeLeft) / 15) * 100}%` }}
              className="h-full bg-brand-accent"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 text-white rounded font-medium hover:bg-white/10 transition-colors border border-white/5"
            >
              Cancel
            </button>
            <button
              disabled={!canClose}
              onClick={onComplete}
              className="flex-1 py-3 bg-brand-accent text-white rounded font-bold hover:bg-brand-accent/90 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shadow-lg"
            >
              Claim Reward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
