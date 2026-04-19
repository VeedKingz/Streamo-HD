import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, X, Download, MessageSquare, Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { UserProfile, Comment as CommentType } from '../types';

interface VideoPlayerProps {
  videoId: string;
  src: string;
  title: string;
  currentUser: any;
  onClose: () => void;
  onViewProfile: (profile: UserProfile) => void;
}

export default function VideoPlayer({ videoId, src, title, currentUser, onClose, onViewProfile }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showComments, setShowComments] = useState(false);
  
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchComments();
    
    // Subscribe to new comments
    const channel = supabase
      .channel(`comments-${videoId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments', 
        filter: `videoId=eq.${videoId}` 
      }, () => {
        fetchComments(); // Re-fetch to get profile data
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [videoId]);

  const fetchComments = async () => {
    try {
      // Use left join to get profiles
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(*)')
        .eq('videoId', videoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data as CommentType[]);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert([{
        videoId,
        authorId: currentUser.id,
        content: newComment.trim()
      }]);

      if (error) throw error;
      setNewComment('');
    } catch (error) {
      alert("Failed to post comment. Make sure you are signed in.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    const container = videoRef.current?.parentElement;
    if (!document.fullscreenElement) {
      container?.requestFullscreen();
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

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex overflow-hidden lg:flex-row flex-col"
      onMouseMove={handleMouseMove}
    >
      {/* Video Side */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-full object-contain"
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
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg sm:text-xl font-bold truncate pr-4">{title}</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowComments(!showComments)}
                    className={cn(
                      "p-2 rounded-full transition-all lg:hidden",
                      showComments ? "bg-brand-accent text-white" : "hover:bg-white/20 text-white"
                    )}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="text-white w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                      {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                    </button>
                    <button onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)} className="text-white hover:scale-110 transition-transform hidden sm:block">
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:scale-110 transition-transform">
                      {isMuted ? <VolumeX /> : <Volume2 />}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <a 
                      href={src} 
                      download={title}
                      className="hidden sm:flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Download</span>
                    </a>
                    <button 
                      onClick={() => setShowComments(!showComments)}
                      className={cn(
                        "hidden lg:flex items-center gap-2 p-2 rounded-xl transition-all",
                        showComments ? "bg-white text-black" : "text-white/70 hover:text-white"
                      )}
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Comments ({comments.length})</span>
                    </button>
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

      {/* Comments Sidebar */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="lg:w-96 w-full lg:h-full h-[50vh] bg-brand-surface border-l border-white/10 flex flex-col z-10"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest italic font-serif">Comments</h3>
                <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">{comments.length} Interactions</p>
              </div>
              <button onClick={() => setShowComments(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors lg:block hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12 opacity-30">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-xs uppercase font-bold tracking-widest">No comments yet.</p>
                  <p className="text-[10px] mt-1">Be the first to share your cinematic opinion!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <button 
                      onClick={() => comment.profiles && onViewProfile(comment.profiles)}
                      className="shrink-0 w-8 h-8 rounded-full bg-brand-accent/20 border border-white/5 overflow-hidden hover:scale-110 transition-transform"
                    >
                      {comment.profiles?.avatarUrl ? (
                        <img src={comment.profiles.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-brand-accent">
                          {comment.profiles?.displayName?.[0] || 'U'}
                        </div>
                      )}
                    </button>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => comment.profiles && onViewProfile(comment.profiles)}
                          className="text-[11px] font-black hover:text-brand-accent transition-colors"
                        >
                          {comment.profiles?.displayName || "Member"}
                        </button>
                        <span className="text-[9px] text-brand-muted font-bold">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[13px] text-zinc-300 leading-relaxed font-medium">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              {currentUser ? (
                <form onSubmit={handleSendComment} className="relative">
                  <input 
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:border-brand-accent outline-none transition-all"
                  />
                  <button 
                    disabled={isSubmitting || !newComment.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-accent hover:text-white disabled:opacity-30 disabled:hover:text-brand-accent transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/10 border-dashed text-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-brand-muted">
                    Sign in to join the conversation
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
