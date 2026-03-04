// With Vite configured to proxy /api, /static, and /health,
// the frontend and backend now share the exact same origin!
// This solves CORS, Firewall blocks, and WebRTC mixed-content errors on mobile.

const protocol = window.location.protocol;
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.host; // includes port if any

export const API_BASE_URL = `${protocol}//${host}`;
export const WS_BASE_URL = `${wsProtocol}//${host}`;
