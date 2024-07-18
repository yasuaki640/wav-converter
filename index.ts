import ffmpeg from "fluent-ffmpeg";
import { parseArgs } from "util";

const codecExtensions = {
  libmp3lame: "mp3",
  aac: "m4a",
  pcm_s16le: "wav",
};
type Codec = keyof typeof codecExtensions;

function convert(
  inputPath: string,
  codec: Codec = "libmp3lame",
  bitrate: number = 192,
) {
  const outputExt = codecExtensions[codec];
  const outputName = inputPath.replace(/\.(wav|WAV)$/i, `.${outputExt}`);

  ffmpeg(inputPath)
    .audioCodec(codec)
    .audioBitrate(bitrate)
    .save(outputName)
    .on("start", (commandLine) => {
      console.log("Spawned Ffmpeg with command: " + commandLine);
    })
    .on("error", (err) => {
      console.log("An error occurred: " + err.message);
    })
    .on("end", () => {
      console.log("Processing finished !");
    });
}

async function main() {
  const { positionals } = parseArgs({
    args: Bun.argv,
    allowPositionals: true,
  });

  if (positionals.length < 3) {
    console.error("Please specify input file path");
    process.exit(1);
  }

  const inputPath = positionals[2];
  const exists = await Bun.file(inputPath).exists();
  if (!exists) {
    console.error("File not found");
    process.exit(1);
  }

  convert(inputPath);
}

main();
