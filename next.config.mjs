/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  serverExternalPackages: ['puppeteer', 'ffmpeg-static', 'ffprobe-static'],
};
export default nextConfig;
