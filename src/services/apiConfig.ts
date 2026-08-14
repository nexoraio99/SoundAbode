export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  // Fallback for production deployments (e.g. soundabode.com or pages.dev) when VITE_API_URL is missing
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://soundabode-server.onrender.com/api';
    }
  }
  return '/api';
}
