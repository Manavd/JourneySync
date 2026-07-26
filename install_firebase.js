import { execSync } from "child_process";
console.log("Installing firebase via node execSync...");
try {
  execSync("npm install firebase --no-audit --no-fund", { stdio: "inherit" });
  console.log("SUCCESS: Firebase installed!");
} catch (e) {
  console.error("Installation error:", e);
}
