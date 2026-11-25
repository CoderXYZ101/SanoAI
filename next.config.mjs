/** @type {import('next').NextConfig} */
// SanoAI is a fully static, browser-only app: Firebase Hosting serves ./out; Firebase Auth + Firestore are the backend.
// (Security headers are set in firebase.json "hosting.headers" because static export has no server.)
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
