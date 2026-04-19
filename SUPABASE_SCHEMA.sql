-- 🎬 STREAMOHD ULTIMATE CONSOLIDATED SCHEMA (MASTER FIX)
-- This script ensures all tables, social features, and security rules are in perfect sync.

-- 1. VIDEOS (The Core Library)
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  thumbnail text NOT NULL,
  category text NOT NULL CHECK (category IN ('Movies', 'Anime', 'Web Series')),
  "videoUrl" text NOT NULL,
  description text,
  "isPremium" boolean DEFAULT false,
  "authorId" uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ROLES (Permissions)
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  permissions text[] NOT NULL,
  color text DEFAULT '#E50914'
);

-- 3. PROFILES (Identity & Social)
CREATE TABLE IF NOT EXISTS public.profiles (
  uid uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text NOT NULL,
  "displayName" text,
  "username" text UNIQUE,
  "bio" text,
  "avatarUrl" text,
  roleIds uuid[] DEFAULT '{}',
  "unlockedVideos" uuid[] DEFAULT '{}',
  CONSTRAINT username_lowercase CHECK (username = LOWER(username))
);

-- 4. COMMENTS (Interaction)
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "videoId" uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  "authorId" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 5000),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. REALTIME (Sync Engine)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.videos, public.roles, public.comments;
COMMIT;

-- 6. SECURITY (RLS Enforcement)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 7. DEFINITIVE POLICIES

-- Videos
DROP POLICY IF EXISTS "Public view" ON public.videos;
CREATE POLICY "Public view" ON public.videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owner write" ON public.videos;
CREATE POLICY "Owner write" ON public.videos FOR INSERT WITH CHECK (auth.uid() = "authorId");
DROP POLICY IF EXISTS "Owner delete" ON public.videos;
CREATE POLICY "Owner delete" ON public.videos FOR DELETE USING (auth.uid() = "authorId");

-- Roles
DROP POLICY IF EXISTS "Roles public view" ON public.roles;
CREATE POLICY "Roles public view" ON public.roles FOR SELECT USING (true); -- Allow all to see roles for UI purposes

-- Profiles
DROP POLICY IF EXISTS "Profiles public" ON public.profiles;
CREATE POLICY "Profiles public" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profile self update" ON public.profiles;
CREATE POLICY "Profile self update" ON public.profiles FOR UPDATE USING (
  auth.uid() = uid OR 
  auth.email() = 'khizarabbaskharal55@gmail.com' OR 
  auth.email() = 'uniqueofficial6767@gmail.com'
);
DROP POLICY IF EXISTS "Profile self delete" ON public.profiles;
CREATE POLICY "Profile self delete" ON public.profiles FOR DELETE USING (
  auth.uid() = uid OR 
  auth.email() = 'khizarabbaskharal55@gmail.com' OR 
  auth.email() = 'uniqueofficial6767@gmail.com'
);

-- Comments
DROP POLICY IF EXISTS "Comments public view" ON public.comments;
CREATE POLICY "Comments public view" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth comment insert" ON public.comments;
CREATE POLICY "Auth comment insert" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = "authorId");
DROP POLICY IF EXISTS "Auth comment delete" ON public.comments;
CREATE POLICY "Auth comment delete" ON public.comments FOR DELETE USING (auth.uid() = "authorId");
