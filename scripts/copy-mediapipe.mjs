// Copies the free MediaPipe face finder (model + WebAssembly) to public/mediapipe so the browser loads it
// from our own address (Album Studio: keep faces off the fold). Runs before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
const from = join(process.cwd(), "node_modules", "@mediapipe", "face_detection");
const to = join(process.cwd(), "public", "mediapipe", "fd");
if (!existsSync(from)) { console.warn("copy-mediapipe: package missing, skipped"); process.exit(0); }
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) if (!/^(README|package\.json|index\.d\.ts)/.test(f)) cpSync(join(from, f), join(to, f));
console.log("copy-mediapipe: done");
