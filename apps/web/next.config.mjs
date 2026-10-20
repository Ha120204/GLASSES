const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@glasses/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
