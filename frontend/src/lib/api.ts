// Centralized API base URL.
// In dev, the Vite proxy forwards /api and /uploads to localhost:3000,
// so we use an empty string (relative URLs). In production, set VITE_API_URL.
export const API_BASE: string = import.meta.env.VITE_API_URL || "";
