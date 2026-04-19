export type Category = 'Movies' | 'Anime' | 'Web Series';

export type Permission = 'MANAGE_UPLOADS' | 'MANAGE_ROLES' | 'ADMIN' | 'UPLOAD_CONTENT';

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  color: string;
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  category: Category;
  videoUrl: string;
  description?: string;
  isPremium?: boolean;
  authorId?: string;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  roleIds: string[]; // List of Role IDs
  unlockedVideos: string[];
}

export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  content: string;
  createdAt: string;
  profiles?: UserProfile; // Joined profile data
}
