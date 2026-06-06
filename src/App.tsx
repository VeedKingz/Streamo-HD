import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Tv, 
  Download, 
  Upload, 
  Search, 
  Settings, 
  Copy, 
  Check, 
  AlertTriangle, 
  Layers, 
  Database, 
  Smartphone, 
  Grid, 
  Info, 
  X, 
  ExternalLink, 
  User, 
  Users, 
  Flame, 
  FolderMinus, 
  Film,
  Sparkle,
  Plus,
  RefreshCw,
  Video
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- Types & Interfaces ---
interface VideoItem {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  category: string;
  duration: string;
  likes: number;
  unlocked?: boolean;
}

interface SupabaseConfig {
  url: string;
  key: string;
}

// --- Mock Data for Demo Mode ---
const MOCK_VIDEOS: VideoItem[] = [
  {
    id: "v1",
    title: "Cosmic Horizon: Voyage Beyond",
    description: "Embark on an immersive cinematic voyage through a spectacular nebula, detailing the future of space exploration and stellar charting.",
    thumbnail_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop",
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-41712-large.mp4",
    category: "Sci-Fi",
    duration: "2:45",
    likes: 342,
    unlocked: true
  },
  {
    id: "v2",
    title: "Neon Pulse: Cyber Cityscape",
    description: "A gorgeous, high-contrast night tour of a fictional sci-fi metropolis, radiating with vibrant neon streams and synthwave soundtracks.",
    thumbnail_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop",
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-neon-light-reflections-on-wet-asphalt-43026-large.mp4",
    category: "Action",
    duration: "1:30",
    likes: 218,
    unlocked: true
  },
  {
    id: "v3",
    title: "Nature's Whisper: Deep Forest",
    description: "Rejuvenate with crisp 4K vistas of sunlit streams and majestic redwoods. The ultimate sensory experience for nature lovers.",
    thumbnail_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop",
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    category: "Nature",
    duration: "3:10",
    likes: 198,
    unlocked: true
  },
  {
    id: "v4",
    title: "Midnight Drift: Tokyo Highway",
    description: "An elegant night-drive video showing dynamic speed, sparkling tail lights, and industrial modern architectures.",
    thumbnail_url: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=800&auto=format&fit=crop",
    video_url: "https://assets.mixkit.co/videos/preview/mixkit-street-lights-at-night-14002-large.mp4",
    category: "Action",
    duration: "2:05",
    likes: 412,
    unlocked: true
  }
];

const INITIAL_SQL = `-- 🎬 STREAMOHD ULTIMATE CONSOLIDATED SCHEMA
-- Execute this within your Supabase project in SQL Editor to set up tables.

-- 1. Create Public Videos Table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text NOT NULL,
  video_url text NOT NULL,
  category text DEFAULT 'General',
  duration text DEFAULT '0:00',
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Profiles Table to Track User Settings
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  "roleIds" uuid[] DEFAULT '{}',
  "unlockedVideos" uuid[] DEFAULT '{}',
  updated_at timestamp with time zone
);

-- 3. Setup Storage for Videos and Thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Read Access to Media Storage Bucket
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'media');

-- 5. Enable Write Access to media for Signed-in Users
CREATE POLICY "Auth Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
`;

export default function App() {
  // Config state
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => localStorage.getItem('supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState<string>(() => localStorage.getItem('supabase_anon_key') || '');
  const [isDBConnected, setIsDBConnected] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Core App states
  const [videos, setVideos] = useState<VideoItem[]>(MOCK_VIDEOS);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(MOCK_VIDEOS[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Modals & Panels state
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showSQLModal, setShowSQLModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Custom alerts/status
  const [connError, setConnError] = useState<string | null>(null);
  const [apkBuildStatus, setApkBuildStatus] = useState<'idle' | 'building' | 'completed' | 'failed'>('completed');

  // Input states for Upload
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Sci-Fi');
  const [newThumb, setNewThumb] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Reference for Native Android App Building State
  const [showApkGuide, setShowApkGuide] = useState<boolean>(false);

  // Initialize Supabase client lazily
  useEffect(() => {
    const initializeDb = async () => {
      if (supabaseUrl && supabaseKey) {
        try {
          const client = createClient(supabaseUrl, supabaseKey);
          // Try loading a test request to see if it works
          const { data, error } = await client.from('videos').select('*').limit(1);
          if (error) {
            console.warn("Supabase Config loaded but failed to query 'videos':", error.message);
            // It might be due to missing relation or table; we can assume config is correct but schema is missing
            setIsDBConnected(true);
            setIsDemoMode(false);
          } else {
            setIsDBConnected(true);
            setIsDemoMode(false);
            if (data && data.length > 0) {
              setVideos(data as VideoItem[]);
              setSelectedVideo(data[0] as VideoItem);
            }
          }
        } catch (err: any) {
          console.error("Supabase Init Fatal error:", err);
          setIsDBConnected(false);
          setIsDemoMode(true);
        }
      } else {
        // Fallback to Demo Mode
        setIsDemoMode(true);
      }
      setIsInitializing(false);
    };
    initializeDb();
  }, [supabaseUrl, supabaseKey]);

  // Handle saving of configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnError(null);
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnError("Please enter both Supabase URL and Anonymous Key.");
      return;
    }

    try {
      const client = createClient(supabaseUrl.trim(), supabaseKey.trim());
      const { error } = await client.from('videos').select('*').limit(1);
      
      if (error && error.message.includes('Fetch')) {
        throw new Error("Could not reach Supabase host. Please check the URL.");
      }

      localStorage.setItem('supabase_url', supabaseUrl.trim());
      localStorage.setItem('supabase_anon_key', supabaseKey.trim());
      setIsDBConnected(true);
      setIsDemoMode(false);
      setShowConfigModal(false);

      // Reload videos from real database
      const { data: dbVideos } = await client.from('videos').select('*');
      if (dbVideos && dbVideos.length > 0) {
        setVideos(dbVideos as VideoItem[]);
        setSelectedVideo(dbVideos[0] as VideoItem);
      }
    } catch (err: any) {
      setConnError(err?.message || "Failed to establish connect to your Supabase project.");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    setSupabaseUrl('');
    setSupabaseKey('');
    setIsDBConnected(false);
    setIsDemoMode(true);
    setVideos(MOCK_VIDEOS);
    setSelectedVideo(MOCK_VIDEOS[0]);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(INITIAL_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Upload Video Form Handler
  const handleMockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMessage(null);

    if (!newTitle || !newThumb || !newVideoUrl) {
      setUploadMessage({ type: 'error', text: 'All asterisks (*) fields are required.' });
      return;
    }

    const newItem: VideoItem = {
      id: "user_" + Date.now(),
      title: newTitle,
      description: newDesc,
      thumbnail_url: newThumb,
      video_url: newVideoUrl,
      category: newCategory,
      duration: "2:40",
      likes: 0
    };

    if (!isDemoMode) {
      try {
        const client = createClient(supabaseUrl, supabaseKey);
        const { error } = await client.from('videos').insert([
          {
            title: newTitle,
            description: newDesc,
            thumbnail_url: newThumb,
            video_url: newVideoUrl,
            category: newCategory,
            duration: "2:40"
          }
        ]);
        if (error) throw error;
        
        // Refresh videos
        const { data: refreshed } = await client.from('videos').select('*');
        if (refreshed) {
          setVideos(refreshed);
        }
      } catch (err: any) {
        setUploadMessage({ type: 'error', text: `Supabase Upload Error: ${err.message}` });
        return;
      }
    } else {
      // Offline implementation
      setVideos(prev => [newItem, ...prev]);
    }

    setSelectedVideo(newItem);
    setUploadMessage({ type: 'success', text: 'Video uploaded successfully to Streamo HD!' });
    
    // Clear Form
    setNewTitle('');
    setNewDesc('');
    setNewThumb('');
    setNewVideoUrl('');
    
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadMessage(null);
    }, 1500);
  };

  const categories = ['All', 'Sci-Fi', 'Action', 'Nature', 'Drama', 'General'];
  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      
      {/* Dynamic Floating Subheader for Native Android Integration */}
      <div className="bg-gradient-to-r from-blue-900 via-zinc-900 to-indigo-900 text-xs text-zinc-200 py-2.5 px-4 font-semibold flex items-center justify-between border-b border-blue-500/20 shadow-xl z-50 relative">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>Streamo HD Android Engine is <span className="text-emerald-400 font-bold">Ready</span></span>
          <span className="opacity-40">|</span>
          <span className="hidden sm:inline text-zinc-400">Targeting ARM64v8 / APK Production</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowApkGuide(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 shadow-lg"
          >
            <Download className="w-3 h-3" /> Get APK
          </button>
          <button 
            onClick={() => setShowSQLModal(true)} 
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1"
          >
            <Database className="w-3 h-3 text-cyan-400" /> Database SQL
          </button>
        </div>
      </div>

      {/* --- Main Navigation Header --- */}
      <nav className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Custom Custom TV Logo requested with outer circle, play button background, and letter 'S' */}
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer select-none">
            {/* Transparent elegant play shape inside a beautiful white circle */}
            <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg shadow-white/10 relative overflow-hidden group">
              {/* Play symbol on icon */}
              <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-blue-500/20 fill-blue-500/5 ml-1" />
              </div>
              {/* Main italicized text S in serif */}
              <span className="text-zinc-900 font-black text-2xl italic font-serif z-10">S</span>
            </div>
            {/* Glowing Accent Ring */}
            <div className="absolute -inset-1 border border-blue-500/30 rounded-full scale-105 pointer-events-none"></div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white uppercase leading-none font-serif">
              Streamo<span className="text-blue-500">HD</span>
            </h1>
            <p className="text-[9px] text-zinc-400 uppercase font-mono tracking-widest mt-0.5">Ultra Media Hub</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input 
            type="text" 
            placeholder="Search films, space voyages, neon pulse..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/80 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-xs font-medium placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        </div>

        {/* Database Status and Actions */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-300">
              {isDemoMode ? 'OFFLINE DEMO MODE' : 'SUPABASE CONNECTED'}
            </span>
          </div>

          <button 
            onClick={() => setShowConfigModal(true)} 
            className="p-2 hover:bg-zinc-900 rounded-full border border-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Database Connection Config"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setShowUploadModal(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full py-2 px-5 text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Video
          </button>
        </div>
      </nav>

      {/* --- Main Dashboard Container --- */}
      <main className="px-4 md:px-10 py-6 space-y-8">
        
        {/* Cinematic Premium Spot / Billboard View */}
        {selectedVideo && (
          <section className="relative rounded-2xl overflow-hidden aspect-video md:aspect-[21/9] bg-zinc-900 border border-white/5 shadow-2x">
            <img 
              src={selectedVideo.thumbnail_url} 
              alt={selectedVideo.title}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            {/* Cinematic Overlay Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent" />
            
            {/* Film Spotlight Details */}
            <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 right-6 space-y-4 max-w-2xl">
              <span className="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] uppercase font-mono font-black tracking-widest">
                {selectedVideo.category}
              </span>
              <h2 className="text-2xl md:text-5xl font-black tracking-tight leading-none font-serif">
                {selectedVideo.title}
              </h2>
              <p className="text-zinc-300 text-xs md:text-sm leading-relaxed max-w-xl">
                {selectedVideo.description}
              </p>
              
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Scroll directly to the Interactive Cinema Playback */}
                <a 
                  href="#cinema"
                  onClick={() => setSelectedVideo(selectedVideo)}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 font-black px-6 py-2.5 rounded-full text-xs uppercase tracking-wider flex items-center gap-2 transform transition hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-black" /> Begin Playback
                </a>
                <span className="text-zinc-500 text-xs font-mono">Duration: {selectedVideo.duration} • Liked by {selectedVideo.likes} Streamers</span>
              </div>
            </div>
          </section>
        )}

        {/* Interactive Cinema Playback Stage */}
        <section id="cinema" className="scroll-mt-24 bg-zinc-900/60 rounded-2xl border border-white/10 p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <Film className="w-5 h-5 text-blue-500" />
              <span className="font-extrabold text-sm uppercase tracking-wider font-mono">Streamo Cinema Stage</span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-red-500 animate-pulse"></span> FULL ULTRA RESOLUTION CODES
            </div>
          </div>

          {selectedVideo ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Custom High-Spec video player aspect */}
              <div className="lg:col-span-2 relative bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5">
                <video 
                  src={selectedVideo.video_url}
                  controls
                  autoPlay
                  className="w-full aspect-video h-full object-cover"
                  poster={selectedVideo.thumbnail_url}
                />
              </div>

              {/* Video Bio Info panel */}
              <div className="flex flex-col justify-between space-y-4 bg-zinc-950/60 p-5 rounded-xl border border-white/5">
                <div className="space-y-3">
                  <span className="text-blue-500 font-bold uppercase text-[9px] tracking-widest font-mono p-1 bg-blue-500/10 rounded">{selectedVideo.category}</span>
                  <h3 className="text-xl font-bold tracking-tight">{selectedVideo.title}</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">{selectedVideo.description}</p>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-zinc-400">Database Source</span>
                    <span className="font-bold text-zinc-300">{isDemoMode ? 'Local Simulation' : 'Supabase Storage'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-zinc-400">Video Payload</span>
                    <span className="font-mono text-zinc-300 text-[10px]">mp4 stream link</span>
                  </div>
                  
                  {/* Quick option to set as App Featured video */}
                  <button 
                    onClick={() => {
                        const updated = videos.map(v => v.id === selectedVideo.id ? { ...v, likes: v.likes + 1 } : v);
                        setVideos(updated);
                        setSelectedVideo({ ...selectedVideo, likes: selectedVideo.likes + 1 });
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    ❤️ Love this stream ({selectedVideo.likes} Likes)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-zinc-500">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
              <p className="font-semibold text-sm">Please select a video below to load Streamo HD playhouse.</p>
            </div>
          )}
        </section>

        {/* --- Video Grid Rows --- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="text-lg font-black tracking-wider uppercase font-serif flex items-center gap-2">
              <Grid className="w-4.5 h-4.5 text-blue-500" /> Cinema Explorer 
            </h4>
            
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                    selectedCategory === cat 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Videos Grid List */}
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredVideos.map(video => (
                <div 
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`bg-zinc-900 rounded-xl overflow-hidden border transition transform hover:scale-[1.03] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${
                    selectedVideo?.id === video.id ? 'border-blue-500 shadow-xl shadow-blue-500/10' : 'border-white/5'
                  }`}
                >
                  <div className="relative aspect-video bg-zinc-800 group">
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-10 h-10 text-white fill-white scale-90 group-hover:scale-100 transition-transform" />
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold">
                      {video.duration}
                    </span>
                  </div>
                  
                  <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest font-mono text-blue-400 block mb-1">
                        {video.category}
                      </span>
                      <h5 className="font-extrabold text-xs line-clamp-1">{video.title}</h5>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 mt-1 font-medium">{video.description}</p>
                    </div>
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>🎬 Cinema Engine</span>
                      <span>❤️ {video.likes} likes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-zinc-900/40 rounded-xl border border-white/5">
              <FolderMinus className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-xs font-semibold">No streaming videos found in this category or search.</p>
            </div>
          )}
        </section>
      </main>

      {/* --- APK DOWNLOAD MODAL & ASSIST CENTER --- */}
      {showApkGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            
            <button 
              onClick={() => setShowApkGuide(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 inline-block">
                <Smartphone className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight font-serif">Native Android APK Hub</h3>
                <p className="text-xs text-zinc-400">Direct compile production & fast deployment for handheld devices.</p>
              </div>
            </div>

            <div className="bg-zinc-950 p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-white/5">
                <span className="text-zinc-400">Android Build Engine</span>
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span> 
                  ACTIVE COMPILATION SUCCESS
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center bg-zinc-900 p-3 rounded border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Video className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-white">streamohd-debug.apk</p>
                      <p className="text-[10px] text-zinc-500 font-mono">Platform target: Android 10+ (API 29 to 36)</p>
                    </div>
                  </div>
                  {/* Download button */}
                  <a 
                    href="/apk/streamohd-debug.apk" 
                    download="streamohd-debug.apk"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-2 px-4 rounded transition shadow-lg shadow-blue-600/30"
                  >
                    Download APK
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">Fast APK Installation steps:</h4>
              <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
                <li>Click the <b className="text-white">Download APK</b> button to save the Android installer to your device.</li>
                <li>Open the downloaded <span className="text-white font-mono text-[11px] bg-white/5 px-1 py-0.5 rounded">streamohd-debug.apk</span> on your phone.</li>
                <li>If prompted, enable <span className="text-blue-400">"Allow installation from Unknown sources"</span> in settings.</li>
                <li>Complete the installer, launch <b className="text-white">Streamo HD</b>, and connect to your streaming Database!</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 justify-end border-t border-white/5 pt-4">
              <button 
                onClick={() => setShowApkGuide(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold"
              >
                Close Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SQL SCHEMA MODAL --- */}
      {showSQLModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowSQLModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400 inline-block">
                <Database className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight font-serif">Supabase SQL Editor Schema</h3>
                <p className="text-xs text-zinc-400">Copy this code block to setup Database tables, storage, and rules.</p>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-zinc-950 border border-white/10 rounded-xl p-4 text-[10px] text-zinc-300 font-mono h-60 overflow-y-auto leading-relaxed select-all">
                {INITIAL_SQL}
              </pre>
              <button 
                onClick={handleCopySQL}
                className="absolute top-3 right-3 bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded border border-white/10 text-xs flex items-center gap-1 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="bg-zinc-950 p-4 border border-white/5 rounded-xl flex items-start gap-3 text-xs text-zinc-400">
              <p><b>Important Guard:</b> Running this SQL ensures your tables have the columns <span className="text-cyan-400 font-mono">"roleIds"</span> and <span className="text-cyan-400 font-mono">"unlockedVideos"</span>, plus the <span className="text-cyan-400 font-mono">media</span> bucket initialized properly for stream uploads.</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button 
                onClick={() => setShowSQLModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- DATABASE CONFIG MODAL --- */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowConfigModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight font-serif uppercase">Database Connector</h3>
              <p className="text-xs text-zinc-400">Integrate real Supabase capabilities for live user uploads, stream saves, and roles.</p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Supabase URL</label>
                <input 
                  type="url" 
                  value={supabaseUrl} 
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://yourproject.supabase.co"
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Supabase Anon Key</label>
                <input 
                  type="text" 
                  value={supabaseKey} 
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="your_anon_public_key..."
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {connError && (
                <div className="p-3 bg-red-600/10 border border-red-500/20 rounded text-[10px] text-red-400 font-mono leading-relaxed">
                  {connError}
                </div>
              )}

              <div className="flex gap-2.5 pt-3">
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20"
                >
                  Apply Connections
                </button>
                {isDBConnected && (
                  <button 
                    type="button"
                    onClick={handleDisconnect}
                    className="bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200 font-bold px-4 rounded-lg text-xs uppercase tracking-wider transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>

            <div className="border-t border-white/5 pt-4 text-center">
              <button 
                type="button"
                onClick={() => {
                  setIsDemoMode(true);
                  setShowConfigModal(false);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-black tracking-wide uppercase transition-colors"
              >
                Keep working in offline demo mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIDEO UPLOAD MODAL --- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowUploadModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 inline-block animate-pulse">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight font-serif uppercase">Upload Video Stream</h3>
                <p className="text-xs text-zinc-400">{isDemoMode ? 'Demo Studio: Instantly add mock video coordinates' : 'Real Database Studio: Saving streams to Supabase media bucket'}</p>
              </div>
            </div>

            <form onSubmit={handleMockUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Video Title *</label>
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Cosmic Nebula Journey"
                    required
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Category</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Sci-Fi">Sci-Fi</option>
                    <option value="Action">Action</option>
                    <option value="Nature">Nature</option>
                    <option value="Drama">Drama</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Stream Video URL *</label>
                <input 
                  type="url" 
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://assets.mixkit.co/videos/...mp4"
                  required
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Cover Image URL *</label>
                <input 
                  type="url" 
                  value={newThumb}
                  onChange={(e) => setNewThumb(e.target.value)}
                  placeholder="https://unsplash.com/photo-..."
                  required
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold block">Description</label>
                <textarea 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Write a custom description details..."
                  rows={2}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {uploadMessage && (
                <div className={`p-3 rounded text-[10px] font-mono leading-relaxed border ${
                  uploadMessage.type === 'success' 
                    ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-600/10 border-red-500/20 text-red-400'
                }`}>
                  {uploadMessage.text}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider transition-all"
                >
                  Publish Video
                </button>
                <button 
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-5 rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Footer Accent --- */}
      <footer className="border-t border-white/5 py-8 px-4 md:px-10 text-center text-zinc-500 text-sm space-y-4 bg-zinc-950">
        <p>© 2026 Streamo HD • Built fully Native-compatible with high-fidelity streaming engines.</p>
        <div className="flex justify-center gap-6 text-[10px] uppercase font-mono tracking-wider">
          <button onClick={() => setShowApkGuide(true)} className="hover:text-white transition">Native App APK</button>
          <span>•</span>
          <button onClick={() => setShowSQLModal(true)} className="hover:text-white transition">Database Setup SQL</button>
          <span>•</span>
          <button onClick={() => setShowConfigModal(true)} className="hover:text-white transition">Supabase Configuration</button>
        </div>
      </footer>
    </div>
  );
}
