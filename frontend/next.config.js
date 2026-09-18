/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exportación estática: el backend sirve estos archivos y la API en el mismo origen
  output: "export",
  async rewrites() {
    // En dev, el frontend habla con el backend sin CORS extra
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
    ];
  },
};
module.exports = nextConfig;
