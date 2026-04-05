export const API_BASE: string = import.meta.env.VITE_API_URL || "";

/**
 * Returns a full URL for a given file path.
 * If the path is already an absolute URL (starts with http), it's returned as-is.
 * Otherwise, it prefixes the path with the API_BASE.
 */
export const getFileUrl = (path: string | undefined): string => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${API_BASE}${path}`;
};
