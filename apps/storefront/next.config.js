const checkEnvVariables = require("./check-env-variables")
const { createHash } = require("node:crypto")
const { readFileSync } = require("node:fs")

checkEnvVariables()

// Include the transition patch in Webpack's otherwise immutable dependency cache.
const transitionBuildHash = createHash("sha256")
  .update(readFileSync(require.resolve("next-view-transitions")))
  .digest("hex")

const staticDemo = process.env.NORD_STATIC_DEMO === "1"
const requestedBasePath =
  process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "/"
const demoBasePath =
  requestedBasePath === "/"
    ? ""
    : `/${requestedBasePath.replace(/^\/+|\/+$/g, "")}`
if (
  staticDemo &&
  demoBasePath !== "" &&
  !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(demoBasePath)
) {
  throw new Error("BASE_PATH должен быть / либо путём вида /repository/.")
}

const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  env: {
    NEXT_PUBLIC_COMMERCE_MODE: staticDemo ? "demo" : "medusa",
    NEXT_PUBLIC_BASE_PATH: staticDemo ? demoBasePath : "",
  },
  ...(staticDemo
    ? {
        output: "export",
        distDir: ".next-demo",
        trailingSlash: true,
        basePath: demoBasePath,
      }
    : {
        async redirects() {
          return [
            { source: "/ru", destination: "/", permanent: true },
            { source: "/catalog", destination: "/store", permanent: false },
            {
              source: "/product/:handle",
              destination: "/products/:handle",
              permanent: false,
            },
            {
              source: "/ru/catalog",
              destination: "/store",
              permanent: true,
            },
            {
              source: "/ru/product/:handle",
              destination: "/products/:handle",
              permanent: true,
            },
            {
              source: "/ru/:path*",
              destination: "/:path*",
              permanent: true,
            },
          ]
        },
      }),
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  reactStrictMode: true,
  webpack(config) {
    if (config.cache && typeof config.cache === "object") {
      config.cache.version = `${config.cache.version || ""}:nord-${transitionBuildHash}`
    }
    return config
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
