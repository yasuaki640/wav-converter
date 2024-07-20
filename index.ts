import ffmpeg from "fluent-ffmpeg";
import { parseArgs } from "util";
import * as fs from "node:fs";
import * as path from "node:path";

const codecExtensions = {
  libmp3lame: "mp3",
  aac: "m4a",
  pcm_s16le: "wav",
};
type Codec = keyof typeof codecExtensions;

const MAX_PARALLEL = 3;

function buildConvertFn(
  inputFilePath: string,
  {
    codec = "libmp3lame",
    bitrate = 256,
    outputDir,
  }: {
    codec?: Codec;
    bitrate?: number;
    outputDir?: string;
  } = {},
) {
  const outputFileExt = codecExtensions[codec];
  const fileName = path
    .basename(inputFilePath)
    .replace(path.extname(inputFilePath), `.${outputFileExt}`);
  const finalOutputDir = outputDir || path.dirname(inputFilePath);

  if (!fs.existsSync(finalOutputDir)) {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  }

  const outputName = path.join(finalOutputDir, fileName);

  return () =>
    new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .audioCodec(codec)
        .audioBitrate(bitrate)
        .save(outputName)
        .on("start", (commandLine) => {
          console.log("Spawned Ffmpeg with command: " + commandLine);
        })
        .on("error", (err) => {
          console.log("An error occurred: " + err.message);
          reject(err);
        })
        .on("end", () => {
          console.log("Processing finished: " + outputName);
          resolve(outputName);
        });
    });
}

function searchMixedWavRecursively(inputDir: string): string[] {
  const targets: string[] = [];
  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const path = `${inputDir}/${file}`;
    if (fs.statSync(path).isDirectory()) {
      targets.push(...searchMixedWavRecursively(path));
    } else if (file.match(/TrLR\.WAV$/i)) {
      targets.push(path);
    }
  }
  return targets;
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      inputDir: {
        short: "i",
        type: "string",
      },
      outputDir: {
        short: "o",
        type: "string",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const inputDir = values.inputDir;
  if (!inputDir) {
    console.error("Please specify input directory.");
    process.exit(1);
  }

  if (!fs.existsSync(inputDir)) {
    console.error(`Directory ${inputDir} does not exist.`);
    process.exit(1);
  }

  const targets = searchMixedWavRecursively(inputDir);
  if (targets.length === 0) {
    console.error(`No mixed wav files found in ${inputDir}.`);
    process.exit(1);
  }

  const outputDir = values.outputDir || inputDir;
  for (let i = 0; i < targets.length; i += MAX_PARALLEL) {
    const convertFn = targets
      .slice(i, i + MAX_PARALLEL)
      .map((target) => buildConvertFn(target, { outputDir }));
    await Promise.all(convertFn.map((fn) => fn()));
    console.log(`Processed ${i + MAX_PARALLEL} files.`);
  }
}

main();
