/** @type {import('next').NextConfig} */
// TODO (Production Migration):
//   - Update BASE_DOMAIN to your real domain
//   - This app is served at sme.test/smeadmin via Nginx proxy
const nextConfig = {
  reactStrictMode: true,

  // web-admin is served under /smeadmin path by Nginx
  // TODO (Production): verify basePath if you keep admin on a sub-path
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-SME-App', value: 'web-admin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
