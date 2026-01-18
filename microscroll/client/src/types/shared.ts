// ============================================
// Shared Types (copied from shared/types)
// Keep in sync with server/src/types/shared.ts
// ============================================

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  dailyGoal: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  autoPlayEnabled: boolean;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Deck types
export interface Deck {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  colorTheme: string;
  sourceType: 'text' | 'pdf' | 'docx' | 'pptx' | 'url';
  sourceName: string | null;
  totalCards: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckRequest {
  title: string;
  description?: string;
  emoji?: string;
  colorTheme?: string;
}

// Card types
export interface Card {
  id: string;
  headline: string;
  detailParagraph: string;
  bulletPoints: string[];
  emoji: string;
  difficulty: 'easy' | 'medium' | 'hard';
  ghostWords: string[];
  eli5Version: string | null;
  quizQuestion: string | null;
  quizAnswer: boolean | null;
  order: number;
  cardType?: 'intro' | 'concept' | 'definition' | 'example' | 'list' | 'summary' | 'transition';
  transitionHint?: string | null;
}

export interface CreateCardRequest {
  headline: string;
  detailParagraph: string;
  bulletPoints: string[];
  emoji?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface UpdateCardRequest {
  headline?: string;
  detailParagraph?: string;
  bulletPoints?: string[];
  emoji?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Progress types
export interface CardProgress {
  cardId: string;
  reviewCount: number;
  correctCount: number;
  masteryLevel: number;
  lastReviewed: string | null;
  nextReviewDate: string | null;
}

export interface ReviewResult {
  cardId: string;
  correct: boolean;
  timeSpent: number;
}

// Stats types
export interface UserStats {
  totalDecks: number;
  totalCards: number;
  cardsStudiedToday: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyTime: number;
  averageAccuracy: number;
  masteredCards: number;
}

export interface WeeklyActivity {
  date: string;
  cardsStudied: number;
  timeSpent: number;
}

// Processing types
export interface ProcessingStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: 'upload' | 'parsing' | 'generating';
  progress: number;
  error?: string;
  resultDeckId?: string;
}

export interface ProcessTextRequest {
  content: string;
  title: string;
}

// API Response types
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
