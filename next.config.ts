import type { NextConfig } from "next";
import { execSync } from "child_process";
import pkg from "./package.json";

let gitCommit = "unknown";
let commitDate = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
  commitDate = execSync("git log -1 --format=%cd --date=format:%y%m%d%H%M").toString().trim();
} catch {
  // Not a git repo (e.g. Vercel CLI deploy)
  gitCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";
  const now = new Date();
  commitDate = `${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
    NEXT_PUBLIC_COMMIT_DATE: commitDate,
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
