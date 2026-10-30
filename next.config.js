/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  // Previews are plain <img> from arbitrary hosts, so nothing uses the optimizer.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;
