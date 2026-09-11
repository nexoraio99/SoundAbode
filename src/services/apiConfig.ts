export function getApiBaseUrl(): string {
  // When running in browser on localhost / 127.0.0.1, connect via local proxy
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return '/api';
    }
  }

  // Production environment configuration
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() && envUrl !== '/api') {
    return envUrl.trim();
  }

  // Fallback for production deployments (e.g. soundabode.com or pages.dev)
  return 'https://soundabode-server.onrender.com/api';
}
