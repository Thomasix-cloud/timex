import type { NextConfig } from "next";
import { execSync } from "child_process";
import pkg from "./package.json";

const gitCommit = execSync("git rev-parse --short HEAD").toString().trim();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
