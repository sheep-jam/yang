import fs from "node:fs";

const required = [
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "api/chat.js",
  "api/skills.js",
  "lib/runtime.js",
  "skills/yang-perspective/SKILL.md",
];

const missing = required.filter((file) => !fs.existsSync(file));

if (missing.length) {
  console.error("Missing required files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Build check passed. This project is static HTML/CSS/JS plus Vercel API functions.");
