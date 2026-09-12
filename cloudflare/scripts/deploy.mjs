import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const secret = process.env.BATMAIL_WORKER_SECRET?.trim();

if (!secret) {
  console.error(
    "BATMAIL_WORKER_SECRET is missing. Add it as an encrypted Cloudflare Build variable.",
  );
  process.exit(1);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "batmail-secrets-"));
const secretsFile = join(temporaryDirectory, "secrets.json");

try {
  await writeFile(
    secretsFile,
    JSON.stringify({ BATMAIL_WORKER_SECRET: secret }),
    { mode: 0o600 },
  );

  const exitCode = await new Promise((resolve, reject) => {
    const deploy = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "deploy", "--secrets-file", secretsFile],
      { stdio: "inherit" },
    );

    deploy.once("error", reject);
    deploy.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
