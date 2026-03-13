/** @type {import('next').NextConfig} */
// TODO (Production Migration):
//   - Update BASE_DOMAIN to your real domain
//   - Add your production domain to the 'domains' / 'remotePatterns' image config
const nextConfig = {
  reactStrictMode: true,

  // Allow Next.js dev server to serve requests from sme.test and its subdomains
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-SME-App', value: 'web-portal' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
