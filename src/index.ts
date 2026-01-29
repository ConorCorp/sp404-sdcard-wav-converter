#!/usr/bin/env node
import { select, confirm } from "@inquirer/prompts";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execAsync = promisify(exec);

interface IgnoreConfig {
  foldersInIMPORTToIgnore: string[];
}

function loadIgnoreConfig(): IgnoreConfig {
  const configPath = path.join(__dirname, "..", "ignore.json");
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { foldersInIMPORTToIgnore: [] };
  }
}
const testMode = process.argv.includes("--test") || process.argv.includes("-t");

interface ExternalDrive {
  name: string;
  mountPoint: string;
}

function getExternalDrives(): ExternalDrive[] {
  // macOS: list volumes mounted under /Volumes (excluding Macintosh HD)
  const volumes = fs.readdirSync("/Volumes");
  return volumes
    .filter((v) => v !== "Macintosh HD")
    .map((v) => ({
      name: v,
      mountPoint: path.join("/Volumes", v),
    }));
}

function getWavInfoFast(
  filePath: string
): { sampleRate: number; bitDepth: number } | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);
    fs.closeSync(fd);

    // Verify RIFF/WAVE header
    if (
      header.toString("ascii", 0, 4) !== "RIFF" ||
      header.toString("ascii", 8, 12) !== "WAVE"
    ) {
      return null;
    }

    const sampleRate = header.readUInt32LE(24);
    const bitDepth = header.readUInt16LE(34);

    // Sanity check values
    if (
      sampleRate < 8000 ||
      sampleRate > 192000 ||
      ![8, 16, 24, 32].includes(bitDepth)
    ) {
      return null;
    }

    return { sampleRate, bitDepth };
  } catch {
    return null;
  }
}

async function getWavInfoFfprobe(
  filePath: string
): Promise<{ sampleRate: number; bitDepth: number } | null> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate,bits_per_sample -of csv=p=0 "${filePath}"`
    );
    const [sampleRate, bitDepth] = stdout.trim().split(",").map(Number);
    return { sampleRate, bitDepth };
  } catch {
    return null;
  }
}

async function getWavInfo(
  filePath: string
): Promise<{ sampleRate: number; bitDepth: number } | null> {
  const fast = getWavInfoFast(filePath);
  if (fast) return fast;
  return getWavInfoFfprobe(filePath);
}

function isCompatible(info: { sampleRate: number; bitDepth: number }): boolean {
  return info.bitDepth === 8 || info.bitDepth === 16;
}

async function convertToSp404Format(filePath: string): Promise<boolean> {
  const tempPath = filePath.replace(/\.wav$/i, "_temp.wav");
  try {
    await execAsync(
      `ffmpeg -y -i "${filePath}" -af "aresample=dither_method=triangular_hp" -acodec pcm_s16le "${tempPath}"`
    );
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (e: any) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error(`\n    Error: ${e.stderr || e.message}`);
    return false;
  }
}

function findWavFiles(
  currentDir: string,
  importFolder: string,
  ignoreFolders: string[]
): string[] {
  const wavFiles: string[] = [];
  if (!fs.existsSync(currentDir)) return wavFiles;

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      // Check if this folder matches any ignore pattern (supports nested paths like "folder2/subfolder")
      const relPath = path.relative(importFolder, fullPath);
      if (ignoreFolders.includes(relPath)) {
        continue;
      }
      wavFiles.push(...findWavFiles(fullPath, importFolder, ignoreFolders));
    } else if (
      entry.isFile() &&
      /\.wav$/i.test(entry.name) &&
      !entry.name.startsWith("._")
    ) {
      wavFiles.push(fullPath);
    }
  }
  return wavFiles;
}

async function main() {
  console.log("\n🎹 Hello! Welcome to SE.CORP's SP404 MK2 WAV Converter.\n");
  if (testMode)
    console.log("🧪 TEST MODE: Will only grab and process 1 file.\n");

  // Check ffmpeg
  try {
    execSync("which ffmpeg", { stdio: "ignore" });
  } catch {
    console.error(
      "❌ ffmpeg not found. Please install it: brew install ffmpeg"
    );
    process.exit(1);
  }

  // List external drives
  const drives = getExternalDrives();
  if (drives.length === 0) {
    console.error("❌ No external drives found.");
    process.exit(1);
  }

  const selectedDrive = await select({
    message: "Which SP404 formatted SD card has your samples?",
    choices: drives.map((d) => ({ name: d.name, value: d.mountPoint })),
  });

  const importFolder = path.join(selectedDrive, "IMPORT");
  if (!fs.existsSync(importFolder)) {
    console.error(`❌ IMPORT folder not found at ${importFolder}`);
    process.exit(1);
  }

  const ignoreConfig = loadIgnoreConfig();
  if (ignoreConfig.foldersInIMPORTToIgnore.length > 0) {
    console.log(
      `\n📋 Ignoring folders:\n ${ignoreConfig.foldersInIMPORTToIgnore.join(
        ", "
      )}\n`
    );
  } else {
    console.log("📋 No folders in ignore list.\n");
  }

  const proceed = await confirm({
    message: "Scan for unsupported WAV files? (Nothing will be changed yet.)",
    default: true,
  });
  if (!proceed) {
    console.log("Cancelled.");
    return;
  }

  console.log(`📂 Scanning ${importFolder} for WAV files...\n`);

  const wavFiles = findWavFiles(
    importFolder,
    importFolder,
    ignoreConfig.foldersInIMPORTToIgnore
  );
  if (wavFiles.length === 0) {
    console.log("✅ No WAV files found in IMPORT folder.");
    return;
  }

  console.log(
    `Found ${wavFiles.length} WAV file(s). Checking compatibility...\n`
  );

  const incompatible: string[] = [];
  for (const file of wavFiles) {
    const info = await getWavInfo(file);
    if (!info || !isCompatible(info)) {
      incompatible.push(file);
      const relPath = path.relative(importFolder, file);
      const infoStr = info
        ? `${info.sampleRate}Hz, ${info.bitDepth}-bit`
        : "unknown format";
      console.log(`  ⚠️  ${relPath} (${infoStr})`);
      if (testMode) break;
    }
  }

  if (incompatible.length === 0) {
    console.log("✅ All WAV files are already SP404 MK2 compatible!");
    return;
  }

  console.log(`\n${incompatible.length} file(s) need conversion to 16-bit.\n`);

  const proceed1 = await confirm({
    message: "Convert these files? (Warning: Original files will be deleted)",
    default: true,
  });

  if (!proceed1) {
    console.log("Cancelled.");
    return;
  }

  console.log("\n🔄 Converting...\n");

  const toConvert = testMode ? incompatible.slice(0, 1) : incompatible;
  let success = 0;
  let failed = 0;
  for (const filePath of toConvert) {
    const relPath = path.relative(importFolder, filePath);
    process.stdout.write(`  ${relPath}...`);
    if (await convertToSp404Format(filePath)) {
      console.log(" ✅");
      success++;
    } else {
      console.log(" ❌");
      failed++;
    }
  }

  console.log(`\n🎉 Done! Converted: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
