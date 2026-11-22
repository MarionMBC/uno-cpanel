import type { NextConfig } from 'next';

// La app es 100 % cliente (Firebase desde el navegador): se exporta estática a `out/` y se sirve con
// Firebase Hosting (ver firebase.json).
const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {},
};

export default nextConfig;
