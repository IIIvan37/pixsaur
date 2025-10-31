#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const RADIX_IMPORT_PATTERN = /from ['"]@radix-ui\/[^'"]*['"]/g;
const ALLOWED_DIR = "src/components/ui";

/**
 * Check if a file path is within the allowed directory
 */
function isInAllowedDir(filePath) {
  return filePath.includes(ALLOWED_DIR);
}

/**
 * Recursively find all TypeScript/JavaScript files
 */
function findFiles(dir, files = []) {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (
      stat.isDirectory() &&
      !item.startsWith(".") &&
      item !== "node_modules" &&
      item !== "dist"
    ) {
      findFiles(fullPath, files);
    } else if (
      stat.isFile() &&
      (extname(item) === ".ts" ||
        extname(item) === ".tsx" ||
        extname(item) === ".js" ||
        extname(item) === ".jsx")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a file for forbidden Radix UI imports
 */
function checkFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    const matches = content.match(RADIX_IMPORT_PATTERN);

    if (matches && !isInAllowedDir(filePath)) {
      console.error(`❌ Forbidden Radix UI import found in: ${filePath}`);
      for (const match of matches) {
        console.error(`   ${match.trim()}`);
      }
      console.error("");
      return true;
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }

  return false;
}

function main() {
  console.log("🔍 Checking for forbidden Radix UI imports...\n");

  const files = findFiles("src");
  let hasErrors = false;

  for (const file of files) {
    if (checkFile(file)) {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error(
      "❌ Found forbidden Radix UI imports outside of ui/ directory!"
    );
    console.error(
      "💡 Use the Icon component from @/components/ui/icon instead."
    );
    process.exit(1);
  } else {
    console.log("✅ No forbidden Radix UI imports found!");
  }
}

main();
