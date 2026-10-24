/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera build enxuto e autossuficiente para rodar em Container LXC / Docker Alpine
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,

  // Otimização de imagens compatível com arquivos servidos de /app/uploads
  images: {
    unoptimized: true,
  },

  // Cabeçalhos de Segurança e Conformidade LGPD / DevSecOps
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
        ],
      },
      {
        // Suporte CORS seguro para o App Android Capacitor
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: process.env.ALLOWED_ORIGIN || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
