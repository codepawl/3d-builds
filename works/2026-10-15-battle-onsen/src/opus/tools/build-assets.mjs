// Runs the Blender asset build headless at below-normal priority.
import { spawn } from "node:child_process";
import { setPriority, constants } from "node:os";
import { fileURLToPath } from "node:url";

const blenderPath = process.env.BLENDER_PATH || "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const buildScript = fileURLToPath(new URL("../blender/build_assets.py", import.meta.url));

const blenderProcess = spawn(blenderPath, ["--background", "--factory-startup", "--python", buildScript], { stdio: "inherit" });
try {
  setPriority(blenderProcess.pid, constants.priority.PRIORITY_BELOW_NORMAL);
} catch (error) {
  console.warn("Could not lower Blender priority:", error.message);
}
blenderProcess.on("exit", (exitCode) => process.exit(exitCode ?? 1));
