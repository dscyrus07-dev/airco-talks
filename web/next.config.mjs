/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend WebSocket server runs separately on PORT (default 8080).
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080",
  },
};

export default nextConfig;
