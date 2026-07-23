import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["board-codec"],
  turbopack: {
    root: import.meta.dirname,
  },
  // Next's dev server blocks cross-origin HMR/dev-asset requests by
  // default — without this, loading the app through the ngrok tunnel gets
  // stuck (the page renders but HMR's websocket handshake is refused, so
  // the client bundle never finishes initializing). Wildcarded rather than
  // pinned to the current tunnel hostname because that hostname rotates on
  // every restart (§8 tunnel URL rotation, docs/list.md decision #2).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app"],
};

export default nextConfig;
