// In production on Vercel, we need to point to the external backend on Render.
// Locally, the proxy serves both.
const customUrl = import.meta.env.VITE_API_URL;

const protocol = customUrl ? new URL(customUrl).protocol : window.location.protocol;
const host = customUrl ? new URL(customUrl).host : window.location.host;

const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

export const API_BASE_URL = customUrl || `${protocol}//${host}`;
export const WS_BASE_URL = `${wsProtocol}//${host}`;
