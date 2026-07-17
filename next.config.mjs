import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["c7fc-184-22-42-135.ngrok-free.app"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
