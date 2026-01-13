/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 1. 타입스크립트 오류 무시하고 빌드 진행
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 2. ESLint 문법 오류 무시하고 빌드 진행
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;