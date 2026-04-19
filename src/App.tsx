import React, { useState, useEffect } from 'react';
import { Plus, X, Film, Tv, MonitorPlay, Search as SearchIcon, User, LogIn, LogOut, LayoutDashboard, PlayCircle, Shield, Users, Trash2, CheckCircle2, Edit2, AlertTriangle, Settings } from 'lucide-react';
import { supabase, getSupabaseConfig } from './lib/supabase';
import { Video, Category, UserProfile, Role, Permission } from './types';
import CategoryRow from './components/CategoryRow';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';
import MockAd from './components/MockAd';
import { cn } from './lib/utils';

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showAdFor, setShowAdFor] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'content' | 'roles' | 'users'>('content');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  const handleBackendError = (error: any, operation: string) => {
    console.error(`Supabase Error [${operation}]:`, error);
    setBackendError(error.message || String(error));
  };

  // Upload States
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ thumbnail: 0, video: 0 });

  // Admin Form State
  const [newVideo, setNewVideo] = useState({
    title: '',
    thumbnail: '',
    category: 'Movies' as Category,
    videoUrl: '',
    description: '',
    isPremium: false
  });

  // Role Management State
  const [newRole, setNewRole] = useState({ name: '', permissions: [] as Permission[], color: '#E50914' });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [deleteConfirmTimer, setDeleteConfirmTimer] = useState<number | null>(null);
  const [editProfileForm, setEditProfileForm] = useState({ displayName: '', username: '', bio: '', avatarUrl: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const initApp = async () => {
      // Safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setIsInitializing(false);
      }, 10000);

      try {
        // 1. Get initial session
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;

        const u = session?.user ?? null;
        setUser(u);
        
        // 2. Load context-specific data
        const promises: Promise<any>[] = [fetchVideos()];
        
        if (u) {
          promises.push(fetchUserProfile(u.id, u.email!));
          promises.push(fetchRoles());
        }

        await Promise.allSettled(promises);
      } catch (err) {
        handleBackendError(err, 'INIT_APP');
      } finally {
        clearTimeout(timeout);
        setIsInitializing(false);
      }
    };

    initApp();

    // Listen for auth changes
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await Promise.allSettled([
          fetchUserProfile(u.id, u.email!),
          fetchRoles()
        ]);
      } else {
        setUserProfile(null);
        setRoles([]); // Clear roles for guests
      }
    });

    // Real-time subscriptions
    const videosChannel = supabase
      .channel('videos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, fetchVideos)
      .subscribe();

    const rolesChannel = supabase
      .channel('roles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, fetchRoles)
      .subscribe();

    return () => {
      authListener.unsubscribe();
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, []);

  // Click outside to close profile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setVideos((data as Video[]) || []);
    } catch (error) {
      handleBackendError(error, 'FETCH_VIDEOS');
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase.from('roles').select('*');
      if (error) throw error;
      setRoles((data as Role[]) || []);
    } catch (error) {
      handleBackendError(error, 'FETCH_ROLES');
    }
  };

  const fetchUserProfile = async (uid: string, email: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('uid', uid).single();
      if (error && error.code !== 'PGRST116') { // PGRST116 is code for no rows found
        throw error;
      } else if (data) {
        setUserProfile(data as UserProfile);
      } else {
        // Create profile if missing
        const newProfile: UserProfile = {
          uid,
          email,
          displayName: email.split('@')[0],
          roleIds: [],
          unlockedVideos: []
        };
        const { error: insertError } = await supabase.from('profiles').insert([newProfile]);
        if (insertError) throw insertError;
        setUserProfile(newProfile);
      }
    } catch (error) {
      handleBackendError(error, 'FETCH_PROFILE');
    }
  };

  const isSuperAdmin = user?.email === 'khizarabbaskharal55@gmail.com' || user?.email === 'uniqueofficial6767@gmail.com';

  const hasPermission = (permission: Permission) => {
    if (isSuperAdmin) return true;
    if (!userProfile?.roleIds) return false;
    
    // Check if any assigned role has the required permission OR the ADMIN permission
    return userProfile.roleIds.some(roleId => {
      const role = roles.find(r => r.id === roleId);
      return role?.permissions.includes(permission) || role?.permissions.includes('ADMIN');
    });
  };

  const fetchUsers = async () => {
    if (!hasPermission('MANAGE_ROLES')) return;
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) handleBackendError(error, 'FETCH_USERS');
    else setAllUsers(data as UserProfile[]);
  };

  useEffect(() => {
    if (showAdmin && adminTab === 'users') {
      fetchUsers();
    }
  }, [showAdmin, adminTab]);

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('MANAGE_ROLES')) return;
    
    try {
      if (editingRoleId) {
        const { error } = await supabase.from('roles').update(newRole).eq('id', editingRoleId);
        if (error) throw error;
        setEditingRoleId(null);
      } else {
        const { error } = await supabase.from('roles').insert([newRole]);
        if (error) throw error;
      }
      setNewRole({ name: '', permissions: [], color: '#E50914' });
    } catch (error) {
      handleBackendError(error, 'WRITE_ROLE');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!hasPermission('MANAGE_ROLES')) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', roleId);
      if (error) throw error;
      setRoleToDelete(null);
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Failed to delete role.");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const canDelete = hasPermission('MANAGE_UPLOADS') || video.authorId === user?.id;
    if (!canDelete) {
      alert("You don't have permission to delete this video.");
      return;
    }

    if (!confirm('Permanently delete this video?')) return;
    try {
      const { error } = await supabase.from('videos').delete().eq('id', videoId);
      if (error) throw error;
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed. Check your permissions.");
    }
  };

  const handleUpdateUserRoles = async (uid: string, roleIds: string[]) => {
    if (!hasPermission('MANAGE_ROLES')) return;
    const { error } = await supabase.from('profiles').update({ roleIds }).eq('uid', uid);
    if (error) handleBackendError(error, 'UPDATE_USER_ROLES');
    else {
      fetchUsers();
      alert('Roles updated');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    let isRequesting = true;

    // Timeout for auth
    const authTimeout = setTimeout(() => {
      if (isRequesting) {
        setAuthLoading(false);
        setAuthError("Authentication timed out. Please check your connection.");
      }
    }, 15000);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setAuthLoading(false);
        alert('Account created! Please check your email for a verification link if required, then sign in.');
        setAuthMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setAuthLoading(false);
        setShowAuthModal(false);
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      isRequesting = false;
      clearTimeout(authTimeout);
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);

    try {
      // 1. Username and Bio Validation
      const username = editProfileForm.username.toLowerCase().trim();
      if (username && !/^[a-z0-9_]*$/.test(username)) {
        throw new Error("Username can only contain lowercase letters, numbers, and underscores.");
      }
      
      if (editProfileForm.bio.length > 5000) {
        throw new Error("Bio cannot exceed 5,000 characters.");
      }

      // 2. Uniqueness Check for Username
      if (username && username !== userProfile?.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .maybeSingle();
        
        if (checkError) throw checkError;
        if (existingUser) throw new Error("This username is already taken.");
      }

      let finalAvatarUrl = editProfileForm.avatarUrl;

      // 3. Avatar Upload (Handling as base64 for simplicity in this proto, or URL if provided)
      // Note: Ideally use supabase.storage, but since we don't have a bucket set up via UI, 
      // we'll stick to text fields or data-uris for this cinemative prototype.
      if (avatarFile) {
        // Mocking a successful upload for the prototype feel
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(avatarFile);
        });
        finalAvatarUrl = (await base64Promise) as string;
      }

      // 4. Update Profile
      const updateData = {
        displayName: editProfileForm.displayName,
        username: username || null,
        bio: editProfileForm.bio,
        avatarUrl: finalAvatarUrl
      };

      const { error } = await supabase.from('profiles').update(updateData).eq('uid', user.id);
      if (error) throw error;
      
      setUserProfile(prev => prev ? { ...prev, ...updateData } : null);
      setShowEditProfile(false);
      alert('Profile updated successfully!');
    } catch (error: any) {
      alert(error.message || "Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Small local loading indicator if needed, but not the global one
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error (non-fatal):", error);
    } finally {
      // Clear JS states (optional since redirect wipes them)
      setUser(null);
      setUserProfile(null);
      setRoles([]);
      setShowProfileMenu(false);
      
      // Full redirect is mandatory to reset the auth listener state
      window.location.href = window.location.origin;
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      // 1. Delete user profile and associated data (Cascade from DB handles comments)
      const { error: profileError } = await supabase.from('profiles').delete().eq('uid', user.id);
      if (profileError) throw profileError;
      
      // 2. Sign Out
      await supabase.auth.signOut();
      
      // 3. Clear State & Inform
      setUser(null);
      setUserProfile(null);
      setRoles([]);
      alert('Your account and identity have been permanently deleted.');
      
      // 4. Force Reload to Landing
      window.location.href = window.location.origin;
    } catch (error) {
      handleBackendError(error, 'DELETE_ACCOUNT');
    }
  };

  const DEFAULT_ROLE_COLORS = [
    '#E50914', // Netflix Red
    '#5865F2', // Discord Blue
    '#57F287', // Green
    '#FEE75C', // Yellow
    '#EB459E', // Fuchsia
    '#9B59B6', // Purple
    '#3498DB', // Blue
    '#E67E22', // Orange
  ];

  const handleVideoSelect = (video: Video) => {
    if (video.isPremium && !userProfile?.unlockedVideos.includes(video.id)) {
      setShowAdFor(video);
    } else {
      setSelectedVideo(video);
    }
  };

  const handleAdComplete = async () => {
    if (showAdFor && user) {
      const updatedUnlocked = [...(userProfile?.unlockedVideos || []), showAdFor.id];
      const { error } = await supabase.from('profiles').update({
        unlockedVideos: updatedUnlocked
      }).eq('uid', user.id);
      
      if (error) {
        handleBackendError(error, 'UNLOCK_VIDEO');
        return;
      }

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        unlockedVideos: updatedUnlocked
      } : null);
      
      const videoToPlay = showAdFor;
      setShowAdFor(null);
      setSelectedVideo(videoToPlay);
    }
  };

  const uploadFile = async (file: File, type: 'thumbnail' | 'video'): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${type === 'thumbnail' ? 'thumbnails' : 'videos'}/${fileName}`;

    // Note: This simplified version doesn't handle progress easily with standard upload
    // but we'll simulate the UI state for the user's benefit
    setUploadProgress(prev => ({ ...prev, [type]: 10 }));
    
    const { data, error } = await supabase.storage
      .from('media') // Assumes a 'media' bucket exists
      .upload(filePath, file);

    if (error) throw error;
    
    setUploadProgress(prev => ({ ...prev, [type]: 100 }));
    
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);
      
    return publicUrl;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!thumbnailFile || !videoFile) {
      alert("Please select both a thumbnail and a video file.");
      return;
    }

    setUploading(true);
    try {
      const thumbUrl = await uploadFile(thumbnailFile, 'thumbnail');
      const vidUrl = await uploadFile(videoFile, 'video');

      const { error } = await supabase.from('videos').insert([{
        ...newVideo,
        thumbnail: thumbUrl,
        videoUrl: vidUrl,
        authorId: user.id,
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;

      setNewVideo({
        title: '',
        thumbnail: '',
        category: 'Movies',
        videoUrl: '',
        description: '',
        isPremium: false
      });
      setThumbnailFile(null);
      setVideoFile(null);
      setUploadProgress({ thumbnail: 0, video: 0 });
      alert('Video added successfully!');
    } catch (error) {
      console.error("Error adding video:", error);
      alert('Failed to add video. Check your storage bucket permissions and connection.');
    } finally {
      setUploading(false);
    }
  };

  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories: Category[] = ['Movies', 'Anime', 'Web Series'];

  const [manualConfig, setManualConfig] = useState(getSupabaseConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('supabase_url', manualConfig.url || '');
    localStorage.setItem('supabase_anon_key', manualConfig.key || '');
    window.location.reload(); // Refresh to re-initialize the client
  };

  // Check if configuration is present
  const isConfigValid = !!manualConfig.url && !!manualConfig.key;

  const resetConfig = () => {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    window.location.reload();
  };

  if (isInitializing && isConfigValid && !backendError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-12 text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/5 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="space-y-6">
            <p className="text-[10px] text-brand-muted uppercase font-black tracking-widest animate-pulse">Initializing StreamoHD</p>
            <button 
              onClick={() => setIsInitializing(false)}
              className="text-[9px] bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white px-6 py-2 rounded-full border border-white/10 transition-all uppercase tracking-widest"
            >
              Bypass Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConfigValid || backendError) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--color-brand-surface)_0%,_transparent_100%)]">
        <div className="max-w-md space-y-8">
          <h1 className="text-brand-accent text-5xl font-black font-serif tracking-tight uppercase">
            Streamo<span className="text-white">HD</span>
          </h1>
          
          <form onSubmit={saveConfig} className="bg-brand-surface p-6 rounded-xl border border-white/10 shadow-2xl space-y-6 text-left">
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold font-serif">{backendError ? "Backend Connection Issue" : "Supabase Quick Setup"}</h2>
              <p className="text-brand-muted text-xs leading-relaxed">
                Enter your Supabase credentials below to connect your streaming database. these are stored locally in your browser.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Project URL</label>
                <input 
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand-accent outline-none transition-colors"
                  value={manualConfig.url || ''}
                  onChange={e => setManualConfig({...manualConfig, url: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Anon API Key</label>
                <input 
                  type="password"
                  placeholder="your-anon-key"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand-accent outline-none transition-colors"
                  value={manualConfig.key || ''}
                  onChange={e => setManualConfig({...manualConfig, key: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-brand-accent hover:bg-brand-accent/90 py-3 rounded font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-brand-accent/20"
            >
              Connect Database
            </button>

            <div className="p-3 bg-brand-accent/5 rounded border border-brand-accent/10">
              <p className="text-[10px] text-zinc-400 text-center leading-tight">
                Get these keys from your Supabase Dashboard under <br/> 
                <span className="text-brand-accent font-bold">Settings &gt; API</span>
              </p>
            </div>

            <button 
              type="button"
              onClick={resetConfig}
              className="w-full text-[10px] text-zinc-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
            >
              Reset Configuration
            </button>
          </form>

          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">SQL Setup required: ensure your tables exist!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white font-sans selection:bg-brand-accent/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 sm:px-4 md:px-12 py-3 flex items-center gap-4">
        <div className="flex items-center gap-6 shrink-0">
          <h1 className="text-brand-accent text-xl sm:text-2xl md:text-3xl font-black font-serif tracking-tight uppercase">
            Streamo<span className="text-white">HD</span>
          </h1>
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-brand-muted">
            {categories.map(cat => (
              <button key={cat} className="hover:text-white transition-colors">{cat}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
          <div className="relative max-w-[200px] sm:max-w-none flex-1 sm:flex-none">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-full py-1.5 pl-9 pr-3 text-xs sm:text-sm text-brand-muted focus:text-white focus:outline-none focus:ring-1 focus:ring-brand-accent/50 w-full sm:w-48 md:w-64 transition-all"
            />
          </div>

          {(hasPermission('MANAGE_UPLOADS') || hasPermission('MANAGE_ROLES') || hasPermission('UPLOAD_CONTENT')) && (
            <button 
              onClick={() => setShowAdmin(!showAdmin)}
              className={cn(
                "p-2 rounded transition-colors relative",
                showAdmin ? "bg-brand-accent text-white" : "bg-white/5 text-brand-muted hover:text-white"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              {isSuperAdmin && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-accent rounded-full border-2 border-brand-bg" />}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-white truncate max-w-[100px]">{user.email?.split('@')[0]}</span>
                <div className="flex gap-1">
                  {isSuperAdmin ? (
                    <span className="text-[10px] text-brand-accent font-black uppercase tracking-tighter">Owner</span>
                  ) : (
                    userProfile?.roleIds.map(rid => {
                      const role = roles.find(r => r.id === rid);
                      return (
                        <span 
                          key={rid} 
                          className="text-[8px] px-1 rounded-sm font-bold uppercase"
                          style={{ backgroundColor: role?.color || '#333' }}
                        >
                          {role?.name}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="relative profile-menu-container z-[60]">
                <button 
                  onClick={() => setShowProfileMenu(prev => !prev)} 
                  className={cn(
                    "flex items-center gap-2 p-1.5 rounded-full transition-all border group relative cursor-pointer",
                    showProfileMenu ? "bg-white/20 border-white/40" : "bg-white/10 hover:bg-white/20 border-white/10"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-xs font-black uppercase text-white shadow-lg shadow-brand-accent/20">
                    {userProfile?.displayName?.[0] || user.email?.[0]}
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute top-full right-0 mt-3 w-56 bg-brand-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                      <p className="text-sm font-bold truncate">{userProfile?.displayName || user.email?.split('@')[0]}</p>
                      <p className="text-[10px] text-brand-muted truncate mt-0.5">{user.email}</p>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => {
                          setEditProfileForm({ 
                            displayName: userProfile?.displayName || '',
                            username: userProfile?.username || '',
                            bio: userProfile?.bio || '',
                            avatarUrl: userProfile?.avatarUrl || ''
                          });
                          setAvatarFile(null);
                          setShowEditProfile(true);
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Edit Profile</span>
                      </button>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>

                    <div className="p-2 pt-0">
                      <button 
                        onClick={() => {
                          if (deleteConfirmTimer) {
                            handleDeleteAccount();
                          } else {
                            setDeleteConfirmTimer(Date.now());
                            setTimeout(() => setDeleteConfirmTimer(null), 3000);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all truncate",
                          deleteConfirmTimer 
                            ? "bg-red-650 text-white animate-pulse" 
                            : "text-red-500 hover:bg-red-500/10"
                        )}
                      >
                        {deleteConfirmTimer ? (
                          <>
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Confirm Deletion (3s)</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 shrink-0" />
                            <span>Delete Account</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowAuthModal(true); setAuthMode('signin'); }} className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/90 px-5 py-1.5 rounded text-sm font-bold transition-colors shadow-lg">
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        {showAdmin ? (
          <div className="max-w-4xl mx-auto px-4 py-8 bg-brand-surface sm:rounded border border-white/5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-xl sm:text-2xl font-bold font-serif">Management</h2>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 overflow-x-auto scrollbar-hide">
                  {(hasPermission('MANAGE_UPLOADS') || hasPermission('UPLOAD_CONTENT')) && (
                    <button 
                      onClick={() => setAdminTab('content')}
                      className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap", adminTab === 'content' ? "bg-brand-accent text-white shadow-lg" : "text-brand-muted hover:text-white")}
                    >
                      Content
                    </button>
                  )}
                  {hasPermission('MANAGE_ROLES') && (
                    <div className="flex shrink-0">
                      <button 
                        onClick={() => setAdminTab('roles')}
                        className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap", adminTab === 'roles' ? "bg-brand-accent text-white shadow-lg" : "text-brand-muted hover:text-white")}
                      >
                        Roles
                      </button>
                      <button 
                        onClick={() => setAdminTab('users')}
                        className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap", adminTab === 'users' ? "bg-brand-accent text-white shadow-lg" : "text-brand-muted hover:text-white")}
                      >
                        Members
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowAdmin(false)} 
                className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 text-brand-muted hover:text-white transition-colors p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {adminTab === 'content' && (hasPermission('MANAGE_UPLOADS') || hasPermission('UPLOAD_CONTENT')) && (
              <>
                <form onSubmit={handleAddVideo} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">Title</label>
                    <input 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand-accent outline-none transition-colors"
                      value={newVideo.title}
                      onChange={e => setNewVideo({...newVideo, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">Category</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand-accent outline-none transition-colors appearance-none"
                      value={newVideo.category}
                      onChange={e => setNewVideo({...newVideo, category: e.target.value as Category})}
                    >
                      {categories.map(c => <option key={c} value={c} className="bg-brand-surface">{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">Thumbnail Icon</label>
                    <div className="relative group h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center transition-all hover:bg-white/10 hover:border-brand-accent/50">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setThumbnailFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      {thumbnailFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                          <span className="text-xs text-brand-muted truncate max-w-[150px]">{thumbnailFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Plus className="w-8 h-8 text-brand-muted group-hover:text-brand-accent mb-2" />
                          <span className="text-xs text-brand-muted">Upload Thumbnail</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">Video File</label>
                    <div className="relative group h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center transition-all hover:bg-white/10 hover:border-brand-accent/50">
                      <input 
                        type="file" 
                        accept="video/*"
                        onChange={e => setVideoFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      {videoFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <Film className="w-8 h-8 text-brand-accent" />
                          <span className="text-xs text-brand-muted truncate max-w-[150px]">{videoFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Tv className="w-8 h-8 text-brand-muted group-hover:text-brand-accent mb-2" />
                          <span className="text-xs text-brand-muted">Upload Movie/Anime</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">Description</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand-accent outline-none transition-colors min-h-[100px]"
                    value={newVideo.description}
                    onChange={e => setNewVideo({...newVideo, description: e.target.value})}
                    placeholder="Describe this content..."
                  />
                </div>

                {uploading && (
                  <div className="space-y-3 p-4 bg-black/40 rounded-lg border border-white/5">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span>Thumbnail Progress</span>
                        <span>{Math.round(uploadProgress.thumbnail)}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress.thumbnail}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span>Video Upload Progress</span>
                        <span>{Math.round(uploadProgress.video)}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${uploadProgress.video}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 bg-white/5 p-4 rounded border border-white/5">
                  <input 
                    type="checkbox"
                    id="premium"
                    className="w-4 h-4 accent-brand-accent"
                    checked={newVideo.isPremium}
                    onChange={e => setNewVideo({...newVideo, isPremium: e.target.checked})}
                  />
                  <label htmlFor="premium" className="text-sm font-medium">Mark as Premium (Requires Ad to Unlock)</label>
                </div>

                <button 
                  type="submit" 
                  disabled={uploading}
                  className={cn(
                    "w-full py-4 rounded font-bold transition-all shadow-lg active:scale-[0.98]",
                    uploading ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" : "bg-brand-accent hover:bg-brand-accent/90"
                  )}
                >
                  {uploading ? 'Uploading Files...' : 'Add Content'}
                </button>
              </form>

              {/* Video List for Management */}
              <div className="mt-12 space-y-4">
                <h3 className="text-xs font-bold uppercase text-brand-muted tracking-widest">Managed Content</h3>
                <div className="grid gap-3">
                  {videos.map(v => {
                    const canDelete = hasPermission('MANAGE_UPLOADS') || v.authorId === user?.uid;
                    if (!canDelete) return null;
                    
                    return (
                      <div key={v.id} className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/5 hover:bg-white/[0.07] transition-colors">
                        <div className="flex items-center gap-4">
                          <img src={v.thumbnail} className="w-12 h-16 object-cover rounded" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-bold truncate max-w-[200px]">{v.title}</p>
                            <p className="text-[10px] text-brand-muted uppercase font-bold tracking-tighter">{v.category}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteVideo(v.id)}
                          className="p-2 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                          title="Delete Video"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

            {adminTab === 'roles' && hasPermission('MANAGE_ROLES') && (
              <div className="space-y-8">
                <form onSubmit={handleSubmitRole} className="space-y-6 bg-black/20 p-6 rounded-lg border border-white/5 relative">
                  {editingRoleId && (
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                       <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded font-black uppercase tracking-widest">Editing</span>
                       <button 
                        type="button"
                        onClick={() => {
                          setEditingRoleId(null);
                          setNewRole({ name: '', permissions: [], color: '#E50914' });
                        }}
                        className="text-zinc-500 hover:text-white transition-colors"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-brand-muted font-bold uppercase mb-1.5 block tracking-widest">Role Name</label>
                        <input 
                          value={newRole.name} 
                          onChange={e => setNewRole({...newRole, name: e.target.value})}
                          placeholder="e.g. Moderator"
                          className="w-full bg-white/5 border border-white/10 rounded p-2.5 text-sm outline-none focus:border-brand-accent transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] text-brand-muted font-bold uppercase mb-2 block tracking-widest">Role Color</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {DEFAULT_ROLE_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewRole({...newRole, color: c})}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                                newRole.color === c ? "border-white scale-110" : "border-transparent"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <div className="relative group">
                            <input 
                              type="color"
                              value={newRole.color}
                              onChange={e => setNewRole({...newRole, color: e.target.value})}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div 
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center bg-gradient-to-tr from-red-500 via-green-500 to-blue-500",
                                !DEFAULT_ROLE_COLORS.includes(newRole.color) ? "border-white scale-110" : "border-transparent"
                              )}
                            >
                              <span className="text-[8px] font-black text-white">C</span>
                            </div>
                          </div>
                        </div>
                        <input 
                          type="text"
                          value={newRole.color}
                          onChange={e => setNewRole({...newRole, color: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-brand-accent uppercase"
                          placeholder="#HEX"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-brand-muted font-bold uppercase mb-2 block tracking-widest">Permissions</label>
                      <div className="grid grid-cols-1 gap-2">
                        {(['MANAGE_UPLOADS', 'MANAGE_ROLES', 'ADMIN', 'UPLOAD_CONTENT'] as Permission[]).map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              const perms = newRole.permissions.includes(p) 
                                ? newRole.permissions.filter(x => x !== p)
                                : [...newRole.permissions, p];
                              setNewRole({...newRole, permissions: perms});
                            }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded text-xs transition-all border",
                              newRole.permissions.includes(p) 
                                ? "bg-brand-accent/10 border-brand-accent text-white" 
                                : "bg-white/5 border-transparent text-brand-muted hover:bg-white/10"
                            )}
                          >
                            <span className="font-bold">{p.replace('_', ' ')}</span>
                            {newRole.permissions.includes(p) && <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-white text-brand-bg py-3 rounded font-black uppercase tracking-widest text-sm hover:bg-zinc-200 transition-all active:scale-[0.98]">
                    {editingRoleId ? 'Update Role' : 'Create Role'}
                  </button>
                </form>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-brand-muted tracking-widest flex items-center gap-2">
                    <div className="w-4 h-[1px] bg-brand-muted/30" />
                    Active Roles
                  </h3>
                  <div className="grid gap-3">
                    {roles.map(role => (
                      <div key={role.id} className="group flex items-center justify-between bg-brand-surface p-4 rounded border border-white/5 hover:border-white/10 transition-all shadow-lg overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: role.color }} />
                        
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                             <Users className="w-5 h-5 text-brand-muted" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white tracking-tight">{role.name}</p>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                            </div>
                            <div className="flex gap-1.5 mt-1.5">
                              {role.permissions.map(p => (
                                <span key={p} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold uppercase border border-white/5">
                                  {p.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                         <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingRoleId(role.id);
                              setNewRole({ name: role.name, permissions: role.permissions, color: role.color });
                            }}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                            title="Edit Role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <div className="relative">
                            <button 
                              onClick={() => {
                                if (roleToDelete === role.id) {
                                  handleDeleteRole(role.id);
                                } else {
                                  setRoleToDelete(role.id);
                                  setTimeout(() => setRoleToDelete(null), 3000);
                                }
                              }} 
                              className={cn(
                                "p-2 transition-all flex items-center justify-center rounded",
                                roleToDelete === role.id ? "bg-brand-accent text-white" : "text-zinc-500 hover:text-brand-accent"
                              )}
                              title="Delete Role"
                            >
                              {roleToDelete === role.id ? <CheckCircle2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                            {roleToDelete === role.id && (
                              <div className="absolute bottom-full right-0 mb-2 bg-brand-accent text-white text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap shadow-xl">
                                Click again to confirm
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'users' && hasPermission('MANAGE_ROLES') && (
              <div className="space-y-4">
                <div className="overflow-hidden bg-white/5 rounded-lg border border-white/5">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/40 text-[10px] uppercase font-bold text-brand-muted">
                      <tr>
                        <th className="px-6 py-3">Member</th>
                        <th className="px-6 py-3">Current Roles</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allUsers.map(u => (
                        <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 flex flex-col">
                            <span className="font-bold">{u.email}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{u.uid}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {u.roleIds?.length > 0 ? u.roleIds.map(rid => {
                                const r = roles.find(x => x.id === rid);
                                return (
                                  <span 
                                    key={rid} 
                                    className="text-[9px] px-2 py-0.5 rounded font-black uppercase border"
                                    style={{ 
                                      backgroundColor: `${r?.color || '#333'}20`,
                                      borderColor: `${r?.color || '#333'}40`,
                                      color: r?.color || '#fff'
                                    }}
                                  >
                                    {r?.name || 'Deleted'}
                                  </span>
                                );
                              }) : <span className="text-[10px] text-zinc-600 italic">No Roles Assigned</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setUserToEdit(u)}
                              className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1 rounded font-bold border border-white/10 transition-all"
                            >
                              Edit Roles
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Hero Section (Featured) */}
            {videos.length > 0 && !searchQuery && (
              <div className="relative h-[280px] sm:h-[420px] w-full mb-8 sm:mb-12 flex items-center px-4 md:px-16 overflow-hidden sm:rounded-b-2xl">
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-10000 ease-linear transform hover:scale-110"
                  style={{ backgroundImage: `url(${videos[0].thumbnail})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-brand-bg via-brand-bg/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-transparent to-transparent" />
                
                <div className="relative max-w-xl space-y-6">
                  <div className="space-y-1">
                    <span className="text-brand-accent text-[11px] font-bold uppercase tracking-[2px]">Trending Now</span>
                    <h2 className="text-5xl md:text-6xl font-black font-serif leading-[1.1]">{videos[0].title}</h2>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-brand-muted">
                    <span>2024</span>
                    <span className="border border-brand-muted px-1.5 py-0.5 text-[10px] font-bold rounded-sm">HD</span>
                    <span>Action & Sci-Fi</span>
                    <span className="text-green-500 font-medium">98% Match</span>
                  </div>

                  <p className="text-brand-muted text-sm md:text-base line-clamp-2 max-w-md italic font-serif">
                    {videos[0].description || "Experience high-definition streaming at its best. Watch the latest content exclusively on Streamo HD."}
                  </p>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleVideoSelect(videos[0])}
                      className="flex items-center gap-2 bg-white text-brand-bg px-8 py-2.5 rounded font-bold hover:bg-zinc-200 transition-all shadow-lg"
                    >
                      <PlayCircle className="w-5 h-5 fill-brand-bg" />
                      Play Now
                    </button>
                    <button className="flex items-center gap-2 bg-zinc-600/40 backdrop-blur-md text-white px-8 py-2.5 rounded font-bold border border-white/10 hover:bg-zinc-600/60 transition-all">
                      + My List
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* My Library (Unlocked Videos) */}
            {userProfile && userProfile.unlockedVideos.length > 0 && !searchQuery && (
              <CategoryRow 
                title="My Library"
                videos={videos.filter(v => userProfile.unlockedVideos.includes(v.id))}
                onSelect={handleVideoSelect}
                unlockedVideos={userProfile.unlockedVideos}
              />
            )}

            {/* Content Rows */}
            <div className="space-y-8">
              {searchQuery ? (
                <div className="px-4 md:px-12">
                  <h2 className="text-xl font-bold mb-6">Search Results for "{searchQuery}"</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredVideos.map(v => (
                      <VideoCard 
                        key={v.id} 
                        video={v} 
                        onSelect={handleVideoSelect}
                        isUnlocked={userProfile?.unlockedVideos.includes(v.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                categories.map(cat => (
                  <CategoryRow 
                    key={cat}
                    title={cat}
                    videos={videos.filter(v => v.category === cat)}
                    onSelect={handleVideoSelect}
                    unlockedVideos={userProfile?.unlockedVideos || []}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Overlays */}
      {selectedVideo && (
        <VideoPlayer 
          src={selectedVideo.videoUrl}
          title={selectedVideo.title}
          videoId={selectedVideo.id}
          currentUser={user}
          onClose={() => setSelectedVideo(null)}
          onViewProfile={(profile) => setViewingProfile(profile)}
        />
      )}

      {showAdFor && (
        <MockAd 
          onComplete={handleAdComplete}
          onClose={() => setShowAdFor(null)}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowAuthModal(false)} />
          <div className="relative w-full max-w-sm bg-brand-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-brand-accent text-3xl font-black font-serif tracking-tight uppercase">
                  Streamo<span className="text-white">HD</span>
                </h1>
                <h3 className="text-xl font-bold">{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h3>
                <p className="text-xs text-brand-muted">
                  {authMode === 'signin' 
                    ? 'Sign in to access premium content and manage your profile.' 
                    : 'Join StreamoHD to start your cinematic journey.'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Email Address</label>
                  <input 
                    type="email"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand-accent outline-none transition-all"
                    placeholder="name@example.com"
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Password</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand-accent outline-none transition-all"
                    placeholder="Min. 6 characters"
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  />
                </div>

                {authError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-[10px] text-red-500 font-bold text-center">{authError}</p>
                  </div>
                )}

                <button 
                  disabled={authLoading}
                  className="w-full bg-brand-accent hover:bg-brand-accent/90 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-brand-accent/20 flex items-center justify-center gap-2"
                >
                  {authLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-brand-muted">
                  {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                    className="ml-2 text-brand-accent font-bold hover:underline"
                  >
                    {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Public Profile View Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setViewingProfile(null)} />
          <div className="relative w-full max-w-sm bg-brand-surface border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 flex flex-col items-center">
              <button 
                onClick={() => setViewingProfile(null)}
                className="absolute top-4 right-4 p-2 text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-32 h-32 rounded-full bg-brand-accent/10 border-4 border-white/5 overflow-hidden shadow-2xl mb-6">
                {viewingProfile.avatarUrl ? (
                  <img src={viewingProfile.avatarUrl} alt={viewingProfile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-brand-accent uppercase">
                    {viewingProfile.displayName?.[0] || viewingProfile.email?.[0]}
                  </div>
                )}
              </div>

              <div className="text-center space-y-4 w-full">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black italic font-serif tracking-tighter">{viewingProfile.displayName || "Unknown User"}</h3>
                  {viewingProfile.username && (
                    <p className="text-brand-accent text-xs font-bold tracking-widest uppercase">@{viewingProfile.username}</p>
                  )}
                </div>

                <div className="py-4 border-y border-white/5">
                   <p className="text-xs text-brand-muted uppercase font-black tracking-widest mb-1">Cinematic Bio</p>
                   <div className="max-h-48 overflow-y-auto scrollbar-hide">
                      <p className="text-sm text-zinc-300 leading-relaxed italic whitespace-pre-wrap">
                        {viewingProfile.bio || "This user hasn't written their cinematic story yet."}
                      </p>
                   </div>
                </div>

                <button 
                  onClick={() => setViewingProfile(null)}
                  className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !isUpdatingProfile && setShowEditProfile(false)} />
          <div className="relative w-full max-w-md max-h-[90vh] bg-brand-surface border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 text-center space-y-6 sm:space-y-8 scrollbar-hide">
              <div className="space-y-2 sticky top-0 bg-brand-surface pt-1 z-10 pb-4 border-b border-white/5">
                <h3 className="text-2xl font-black italic font-serif tracking-tighter uppercase">Edit <span className="text-brand-accent">Identity</span></h3>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-bold">Cinematic Presence Profile</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6 text-left">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4 py-2">
                   <div className="relative group">
                     <div className="w-24 h-24 rounded-full bg-brand-accent/10 border-2 border-white/10 overflow-hidden shadow-2xl transition-all group-hover:border-brand-accent">
                       {avatarFile || editProfileForm.avatarUrl ? (
                         <img 
                           src={avatarFile ? URL.createObjectURL(avatarFile) : editProfileForm.avatarUrl} 
                           alt="Preview" 
                           className="w-full h-full object-cover"
                         />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-3xl font-black text-brand-accent uppercase">
                           {editProfileForm.displayName?.[0] || user?.email?.[0]}
                         </div>
                       )}
                     </div>
                     <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                       <Plus className="w-8 h-8 text-white" />
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) setAvatarFile(file);
                         }} 
                       />
                     </label>
                   </div>
                   <p className="text-[9px] text-brand-muted uppercase font-bold tracking-widest">Tap to change profile picture (1:1 recommended)</p>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Display Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="Your choice name..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-brand-accent outline-none transition-all"
                      value={editProfileForm.displayName}
                      onChange={e => setEditProfileForm({ ...editProfileForm, displayName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Username</label>
                      <span className="text-[8px] text-brand-accent uppercase font-bold tracking-widest">lowercase_only_</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted text-sm font-bold">@</span>
                      <input 
                        type="text"
                        placeholder="unique_handle"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-3 text-sm focus:border-brand-accent outline-none transition-all placeholder:text-zinc-700"
                        value={editProfileForm.username}
                        onChange={e => setEditProfileForm({ ...editProfileForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Description (Bio)</label>
                      <span className={cn(
                        "text-[8px] font-bold tracking-widest",
                        editProfileForm.bio.length > 5000 ? "text-red-500" : "text-brand-muted"
                      )}>
                        {editProfileForm.bio.length} / 5000
                      </span>
                    </div>
                    <textarea 
                      rows={4}
                      placeholder="Tell your cinematic story..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-brand-accent outline-none transition-all resize-none scrollbar-hide"
                      value={editProfileForm.bio}
                      onChange={e => setEditProfileForm({ ...editProfileForm, bio: e.target.value.slice(0, 5000) })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 sticky bottom-0 bg-brand-surface border-t border-white/5 pb-2 mt-4 z-10">
                  <button 
                    type="button"
                    disabled={isUpdatingProfile}
                    onClick={() => setShowEditProfile(false)}
                    className="flex-1 px-4 py-3.5 rounded-2xl border border-white/10 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex-1 bg-brand-accent hover:bg-brand-accent/90 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-brand-accent/20 flex items-center justify-center gap-2"
                  >
                    {isUpdatingProfile ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Role Editing Modal */}
      {userToEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setUserToEdit(null)} />
          <div className="relative w-full max-w-md bg-brand-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Manage Roles</h3>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-bold mt-0.5">{userToEdit.email}</p>
              </div>
              <button 
                onClick={() => setUserToEdit(null)}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">Assign Roles</label>
                <div className="grid gap-2">
                  {roles.map(role => {
                    const isAssigned = userToEdit.roleIds?.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        onClick={() => {
                          const newRoleIds = isAssigned
                            ? userToEdit.roleIds.filter(id => id !== role.id)
                            : [...(userToEdit.roleIds || []), role.id];
                          
                          setUserToEdit({ ...userToEdit, roleIds: newRoleIds });
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                          isAssigned 
                            ? "bg-white/5 border-white/20" 
                            : "bg-transparent border-white/5 hover:bg-white/5 text-brand-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                          <span className="text-sm font-bold">{role.name}</span>
                        </div>
                        {isAssigned && <CheckCircle2 className="w-4 h-4 text-brand-accent animate-in fade-in" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 bg-black/20 flex gap-3">
              <button 
                onClick={() => setUserToEdit(null)}
                className="flex-1 px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  await handleUpdateUserRoles(userToEdit.uid, userToEdit.roleIds);
                  setUserToEdit(null);
                }}
                className="flex-1 bg-brand-accent px-4 py-2 rounded text-xs font-bold hover:bg-brand-accent/90 transition-all shadow-lg shadow-brand-accent/20"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
