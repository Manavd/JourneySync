#!/usr/bin/env node
// Generates the platform token files from design/tokens.json.
//
//   node scripts/generate-design-tokens.mjs          write the files
//   node scripts/generate-design-tokens.mjs --check  fail if they have drifted
//
// The check mode is what makes the tokens binding rather than advisory. It runs
// as part of `npm test`, so a palette edit that touches only one platform stops
// at the gate instead of shipping as a colour that is subtly wrong on the other.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = join(repoRoot, "design/tokens.json");

const BANNER_LINES = [
  "Generated from design/tokens.json. Do not edit by hand.",
  "Run `npm run tokens` after changing that file.",
];

/** Web and Android both want #RRGGBB, but each codebase already writes its own case. */
const lower = (hex) => hex.toLowerCase();
const upper = (hex) => hex.toUpperCase();

function cssFile(tokens) {
  const lines = [
    "/*",
    ...BANNER_LINES.map((line) => ` * ${line}`),
    " */",
    "",
    ":root {",
  ];
  for (const [id, token] of Object.entries(tokens.color)) {
    if (!token.web) continue;
    lines.push(`  ${token.web}: ${lower(token.value)}; /* ${id} */`);
  }
  for (const [id, token] of Object.entries(tokens.radius)) {
    if (!token.web) continue;
    lines.push(`  ${token.web}: ${token.value}px; /* ${id} */`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

function xmlFile(tokens) {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<!--",
    ...BANNER_LINES.map((line) => `    ${line}`),
    "-->",
    "<resources>",
  ];
  for (const token of Object.values(tokens.color)) {
    if (!token.xml) continue;
    lines.push(`    <color name="${token.xml}">${upper(token.value)}</color>`);
  }
  lines.push("</resources>", "");
  return lines.join("\n");
}

function javaFile(tokens) {
  const lines = [
    "package com.manavdesai.journeysync;",
    "",
    "/**",
    ...BANNER_LINES.map((line) => ` * ${line}`),
    " *",
    " * <p>Colours are kept as #RRGGBB strings because the screens are built in code",
    " * and pass them straight to {@link android.graphics.Color#parseColor}.",
    " */",
    "final class DesignTokens {",
    "",
    "    private DesignTokens() {",
    "    }",
    "",
  ];
  for (const [id, token] of Object.entries(tokens.color)) {
    if (!token.android) continue;
    lines.push(`    /** ${token.use} */`);
    lines.push(`    static final String ${token.android} = "${upper(token.value)}"; // ${id}`);
    lines.push("");
  }
  for (const [id, token] of Object.entries(tokens.radius)) {
    if (!token.android) continue;
    lines.push(`    /** ${token.use} */`);
    lines.push(`    static final int ${token.android} = ${token.value}; // ${id}`);
    lines.push("");
  }
  lines.push("}", "");
  return lines.join("\n");
}

const outputs = [
  { path: "app/design-tokens.css", render: cssFile },
  { path: "android/app/src/main/res/values/colors.xml", render: xmlFile },
  {
    path: "android/app/src/main/java/com/manavdesai/journeysync/DesignTokens.java",
    render: javaFile,
  },
];

async function main() {
  const check = process.argv.includes("--check");
  const tokens = JSON.parse(await readFile(tokensPath, "utf8"));

  const declared = new Set(tokens.generated ?? []);
  for (const { path } of outputs) {
    if (!declared.has(path)) {
      throw new Error(
        `${path} is written by this script but missing from the "generated" list in design/tokens.json.`,
      );
    }
  }

  const drifted = [];
  for (const { path, render } of outputs) {
    const expected = render(tokens);
    const absolute = join(repoRoot, path);
    if (!check) {
      await writeFile(absolute, expected, "utf8");
      continue;
    }
    let actual = null;
    try {
      actual = await readFile(absolute, "utf8");
    } catch {
      drifted.push(`${path} (missing)`);
      continue;
    }
    if (actual !== expected) drifted.push(path);
  }

  if (!check) {
    console.log(`Wrote ${outputs.length} token files from ${relative(repoRoot, tokensPath)}.`);
    return;
  }

  if (drifted.length > 0) {
    console.error(
      "Design tokens are out of sync with design/tokens.json:\n" +
        drifted.map((path) => `  - ${path}`).join("\n") +
        "\n\nRun `npm run tokens` to regenerate, then commit the result.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Design tokens are in sync across web and Android.");
}

await main();
