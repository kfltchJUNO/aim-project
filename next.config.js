/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 타입스크립트 오류 무시
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ESLint 오류 무시
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;