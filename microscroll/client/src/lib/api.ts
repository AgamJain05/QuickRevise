// API Client for MicroScroll Backend
// Handles authentication, requests, and error handling

const API_BASE = '/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'microscroll_access_token';
const REFRESH_TOKEN_KEY = 'microscroll_refresh_token';

// ===========================================
// Types
// ===========================================

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

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Deck {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  colorTheme: string;
  sourceType: string;
  sourceName: string | null;
  totalCards: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

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
}

export interface ProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: string;
  progress: number;
  error: string | null;
  resultDeckId: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===========================================
// Token Management
// ===========================================

export const tokens = {
  get: () => ({
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  }),
  
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ===========================================
// Request Helper
// ===========================================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = tokens.get();
  
  const headers: HeadersInit = {
    ...options.headers,
  };
  
  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }
  
  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  // Handle 401 - try to refresh token
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const newAccessToken = tokens.get().accessToken;
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed, clear tokens
      tokens.clear();
      window.location.href = '/onboarding';
      throw new Error('Session expired');
    }
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error?.message || 'Request failed');
  }
  
  return data.data;
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = tokens.get();
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      tokens.set(data.data.tokens.accessToken, data.data.tokens.refreshToken);
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

// ===========================================
// Auth API
// ===========================================

interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export const auth = {
  register: async (email: string, password: string, name?: string): Promise<User> => {
    const result = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    tokens.set(result.tokens.accessToken, result.tokens.refreshToken);
    return result.user;
  },
  
  login: async (email: string, password: string): Promise<User> => {
    const result = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokens.set(result.tokens.accessToken, result.tokens.refreshToken);
    return result.user;
  },
  
  logout: async (): Promise<void> => {
    const { refreshToken } = tokens.get();
    if (refreshToken) {
      try {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore errors on logout
      }
    }
    tokens.clear();
  },
  
  me: async (): Promise<User | null> => {
    const { accessToken } = tokens.get();
    if (!accessToken) return null;
    
    try {
      const result = await request<{ user: User }>('/auth/me');
      return result.user;
    } catch {
      return null;
    }
  },
  
  isAuthenticated: (): boolean => {
    return !!tokens.get().accessToken;
  },
};

// ===========================================
// Decks API
// ===========================================

interface ListDecksQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

interface CreateDeckInput {
  title: string;
  description?: string;
  emoji?: string;
  colorTheme?: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  sourceType?: 'text' | 'pdf' | 'docx' | 'pptx' | 'url';
  isPublic?: boolean;
}

interface DeckStats {
  totalDecks: number;
  totalCards: number;
  recentDecks: Array<{
    id: string;
    title: string;
    emoji: string;
    updatedAt: string;
    totalCards: number;
  }>;
}

export const decks = {
  list: async (query: ListDecksQuery = {}): Promise<PaginatedResult<Deck>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);
    
    const queryString = params.toString();
    return request<PaginatedResult<Deck>>(`/decks${queryString ? `?${queryString}` : ''}`);
  },
  
  get: async (id: string): Promise<{ deck: Deck & { cards: Card[] } }> => {
    return request<{ deck: Deck & { cards: Card[] } }>(`/decks/${id}`);
  },
  
  create: async (data: CreateDeckInput): Promise<{ deck: Deck }> => {
    return request<{ deck: Deck }>('/decks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  update: async (id: string, data: Partial<CreateDeckInput>): Promise<{ deck: Deck }> => {
    return request<{ deck: Deck }>(`/decks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete: async (id: string): Promise<void> => {
    await request(`/decks/${id}`, { method: 'DELETE' });
  },
  
  stats: async (): Promise<DeckStats> => {
    return request<DeckStats>('/decks/stats');
  },
};

// ===========================================
// Cards API
// ===========================================

interface CreateCardInput {
  headline: string;
  detailParagraph: string;
  bulletPoints?: string[];
  emoji?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  ghostWords?: string[];
  eli5Version?: string;
  quizQuestion?: string;
  quizAnswer?: boolean;
}

export const cards = {
  list: async (deckId: string): Promise<{ cards: Card[] }> => {
    return request<{ cards: Card[] }>(`/decks/${deckId}/cards`);
  },
  
  get: async (cardId: string): Promise<{ card: Card }> => {
    return request<{ card: Card }>(`/cards/${cardId}`);
  },
  
  create: async (deckId: string, data: CreateCardInput): Promise<{ card: Card }> => {
    return request<{ card: Card }>(`/decks/${deckId}/cards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  createBulk: async (deckId: string, cards: CreateCardInput[]): Promise<{ cards: Card[]; count: number }> => {
    return request<{ cards: Card[]; count: number }>(`/decks/${deckId}/cards/bulk`, {
      method: 'POST',
      body: JSON.stringify({ cards }),
    });
  },
  
  update: async (cardId: string, data: Partial<CreateCardInput>): Promise<{ card: Card }> => {
    return request<{ card: Card }>(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete: async (cardId: string): Promise<void> => {
    await request(`/cards/${cardId}`, { method: 'DELETE' });
  },
  
  reorder: async (deckId: string, cardIds: string[]): Promise<{ cards: Card[] }> => {
    return request<{ cards: Card[] }>(`/decks/${deckId}/cards/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ cardIds }),
    });
  },
};

// ===========================================
// Processing API
// ===========================================

interface ProcessResult {
  job: ProcessingJob;
  deck: Deck;
}

export interface ContentLimits {
  maxChars: number;
  maxCharsFormatted: string;
  approximatePages: number;
  approximateWords: number;
  fileMaxSizeMB: number;
  supportedFormats: string[];
}

export const process = {
  // Get content limits (no auth required)
  getLimits: async (): Promise<ContentLimits> => {
    const response = await fetch('/api/process/limits');
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to get limits');
    }
    return data.data;
  },
  
  uploadFile: async (file: File, title?: string): Promise<ProcessResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    
    return request<ProcessResult>('/process/upload', {
      method: 'POST',
      body: formData,
    });
  },
  
  processText: async (content: string, title: string): Promise<ProcessResult> => {
    return request<ProcessResult>('/process/text', {
      method: 'POST',
      body: JSON.stringify({ content, title }),
    });
  },
  
  listJobs: async (): Promise<{ jobs: ProcessingJob[] }> => {
    return request<{ jobs: ProcessingJob[] }>('/process/jobs');
  },
  
  getJob: async (jobId: string): Promise<{ job: ProcessingJob }> => {
    return request<{ job: ProcessingJob }>(`/process/jobs/${jobId}`);
  },
};

// ===========================================
// Health Check
// ===========================================

export const health = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    return request('/health');
  },
};

// ===========================================
// Default Export
// ===========================================

export const api = {
  auth,
  decks,
  cards,
  process,
  health,
  tokens,
};

export default api;
