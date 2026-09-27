/** @type {import('next').NextConfig} */
const nextConfig = {
  // Quét HĐ PDF lớn (parse-hop-dong cho phép tới 80 MB) — mặc định proxy ~10 MB → 413
  experimental: {
    proxyClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
