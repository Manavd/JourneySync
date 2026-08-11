import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Cloudflare runtime declarations. The upstream interfaces use
    // `any`, so linting this shim creates noise without checking app code.
    "cloudflare.d.ts",
    // Vendored design reference, not our source. It is gitignored, so linting
    // it only ever failed the gate on code we do not maintain.
    "work/**",
  ]),
]);

export default eslintConfig;
