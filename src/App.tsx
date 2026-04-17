import React, { useState, useEffect } from 'react';
import { Plus, X, Film, Tv, MonitorPlay, Search as SearchIcon, User, LogIn, LogOut, LayoutDashboard, PlayCircle, Shield, Users, Trash2, CheckCircle2, Edit2, Search } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc, getDocs, where, getDocFromServer } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, storage } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
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
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errorInfo = {
      error: error.message || String(error),
      operation,
      path,
      auth: {
        loggedIn: !!auth.currentUser,
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email
      }
    };
    console.error("Firestore Error:", JSON.stringify(errorInfo, null, 2));
    setFirestoreError(error.message);
    throw error;
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

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, '_connection_test', 'status'));
      } catch (error: any) {
        if (error.message.includes('offline')) {
          console.warn("Firestore connection check failed: Client is offline. This usually indicates a Firebase configuration issue.");
          setFirestoreError("The application is unable to connect to the database. Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Listen for videos
    const q = query(collection(db, 'videos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Video[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'LIST', 'videos'));

    // Listen for roles
    const rolesUnsubscribe = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Role[]);
    }, (error) => handleFirestoreError(error, 'LIST', 'roles'));

    // Auth listener
    const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              roleIds: [],
              unlockedVideos: []
            };
            await setDoc(docRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, 'GET/SET', `users/${u.uid}`);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribe();
      rolesUnsubscribe();
      authUnsubscribe();
    };
  }, []);

  const isSuperAdmin = user?.email === 'khizarabbaskharal55@gmail.com';

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
    const q = query(collection(db, 'users'));
    try {
      const snap = await getDocs(q);
      setAllUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    } catch (error) {
      handleFirestoreError(error, 'GET_DOCS', 'users');
    }
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
        await updateDoc(doc(db, 'roles', editingRoleId), newRole);
        setEditingRoleId(null);
      } else {
        await addDoc(collection(db, 'roles'), newRole);
      }
      setNewRole({ name: '', permissions: [], color: '#E50914' });
    } catch (error) {
      handleFirestoreError(error, 'WRITE', editingRoleId ? `roles/${editingRoleId}` : 'roles');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!hasPermission('MANAGE_ROLES')) return;
    try {
      await deleteDoc(doc(db, 'roles', roleId));
      setRoleToDelete(null);
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Failed to delete role.");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const canDelete = hasPermission('MANAGE_UPLOADS') || video.authorId === user?.uid;
    if (!canDelete) {
      alert("You don't have permission to delete this video.");
      return;
    }

    if (!confirm('Permanently delete this video?')) return;
    try {
      await deleteDoc(doc(db, 'videos', videoId));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed. Check your permissions.");
    }
  };

  const handleUpdateUserRoles = async (uid: string, roleIds: string[]) => {
    if (!hasPermission('MANAGE_ROLES')) return;
    await updateDoc(doc(db, 'users', uid), { roleIds });
    fetchUsers();
    alert('Roles updated');
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
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
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        unlockedVideos: arrayUnion(showAdFor.id)
      });
      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        unlockedVideos: [...prev.unlockedVideos, showAdFor.id]
      } : null);
      
      const videoToPlay = showAdFor;
      setShowAdFor(null);
      setSelectedVideo(videoToPlay);
    }
  };

  const uploadFile = (file: File, type: 'thumbnail' | 'video'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `${type === 'thumbnail' ? 'thumbnails' : 'videos'}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [type]: progress }));
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
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

      await addDoc(collection(db, 'videos'), {
        ...newVideo,
        thumbnail: thumbUrl,
        videoUrl: vidUrl,
        authorId: user.uid,
        createdAt: serverTimestamp()
      });

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

  // Check if Firebase is initialized correctly
  const isConfigValid = !firebaseConfig.apiKey.startsWith('REPLACE_');

  if (loading && !firestoreError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConfigValid || firestoreError) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--color-brand-surface)_0%,_transparent_100%)]">
        <div className="max-w-md space-y-8">
          <h1 className="text-brand-accent text-5xl font-black font-serif tracking-tight uppercase">
            Streamo<span className="text-white">HD</span>
          </h1>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold font-serif">{firestoreError ? "Connection Error" : "Setup Required"}</h2>
            <p className="text-brand-muted text-sm leading-relaxed">
              {firestoreError || "To allow users to sign in and watch videos, you need to provide your Firebase credentials."}
            </p>
          </div>
          <div className="p-4 bg-brand-accent/10 rounded border border-brand-accent/20 space-y-2">
            <p className="text-xs text-brand-accent font-bold uppercase tracking-wider">Troubleshooting</p>
            <p className="text-[11px] text-zinc-400">
              {firestoreError 
                ? "This usually means the Firebase project ID or API Key is incorrect. Try running the 'set_up_firebase' tool again."
                : "Open the project settings to configure your Environment Variables."}
            </p>
          </div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Error Trace ID: {Math.random().toString(36).substring(7)}</p>
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

        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4 overflow-hidden">
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
                <span className="text-xs font-bold text-white truncate max-w-[100px]">{user.displayName}</span>
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
              <button onClick={() => signOut(auth)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors border border-white/10 group relative">
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full shadow-lg" />
                <div className="absolute top-full right-0 mt-2 bg-brand-surface border border-white/10 p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  <span className="text-[10px] font-bold">Logout</span>
                </div>
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/90 px-5 py-1.5 rounded text-sm font-bold transition-colors shadow-lg">
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
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {showAdFor && (
        <MockAd 
          onComplete={handleAdComplete}
          onClose={() => setShowAdFor(null)}
        />
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
