#!/usr/bin/env node
import prompts from "prompts";
import { execa } from "execa";
import degit from "degit";
import fs from "fs/promises";
import path from "path";

async function cloneTemplate(repo: string, dest: string): Promise<void> {
  const emitter = degit(repo, { force: true });
  await emitter.clone(dest);
  await fs.rm(path.join(dest, ".git"), { recursive: true, force: true });
}

async function copyCommon(commonDir: string, targetDir: string): Promise<void> {
  const emitter = degit(commonDir, { force: true });
  await emitter.clone(path.join(targetDir, ".common-temp"));
  const src = path.join(targetDir, ".common-temp");
  const files = await fs.readdir(src);
  for (const file of files) {
    await fs.cp(path.join(src, file), path.join(targetDir, file), {
      recursive: true,
    });
  }
  await fs.rm(src, { recursive: true, force: true });
}

async function createMonorepo(targetDir: string): Promise<void> {
  const { feCount, beCount, addShared } = await prompts([
    {
      type: "number",
      name: "feCount",
      message: "How many frontends?",
      initial: 1,
    },
    {
      type: "number",
      name: "beCount",
      message: "How many backends?",
      initial: 1,
    },
    {
      type: "confirm",
      name: "addShared",
      message: "Add shared package?",
      initial: true,
    },
  ]);

  const monoRepo = degit(
    "github:hainkiwanki/binki-templates/template-monorepo",
    { force: true }
  );
  await monoRepo.clone(targetDir);

  const pkgDir = path.join(targetDir, "packages");
  await fs.mkdir(pkgDir, { recursive: true });

  const clone = async (src: string, name: string) => {
    const dest = path.join(pkgDir, name);
    await cloneTemplate(`github:hainkiwanki/binki-templates/${src}`, dest);
    await copyCommon("github:hainkiwanki/binki-templates/common", dest);
  };

  for (let i = 1; i <= feCount; i++)
    await clone("template-frontend", `fe-app${i}`);
  for (let i = 1; i <= beCount; i++)
    await clone("template-backend", `be-api${i}`);
  if (addShared) await clone("template-shared", "shared");

  await execa("yarn", ["install"], { cwd: targetDir, stdio: "inherit" });
  console.log("\n✅ Monorepo created successfully!");
}

async function main(): Promise<void> {
  const { type, name } = await prompts([
    {
      type: "select",
      name: "type",
      message: "Select project type:",
      choices: [
        { title: "Frontend (Vue + Vite + Vuetify)", value: "frontend" },
        { title: "Backend (Fastify + TS)", value: "backend" },
        { title: "Monorepo (multiple packages)", value: "monorepo" },
      ],
    },
    {
      type: "text",
      name: "name",
      message: "Project name:",
      validate: (v) => (v.trim() ? true : "Required"),
    },
  ]);

  const targetDir = path.resolve(process.cwd(), name);
  await fs.mkdir(targetDir, { recursive: true });

  if (type === "monorepo") {
    await createMonorepo(targetDir);
    return;
  }

  const repoMap: Record<string, string> = {
    frontend: "github:hainkiwanki/binki-templates/template-frontend",
    backend: "github:hainkiwanki/binki-templates/template-backend",
  };

  console.log(`\n📦 Cloning ${type} template...`);
  await cloneTemplate(repoMap[type], targetDir);
  await copyCommon("github:hainkiwanki/binki-templates/common", targetDir);

  console.log("📦 Installing dependencies...");
  await execa("yarn", ["install"], { cwd: targetDir, stdio: "inherit" });

  console.log(`\n✅ ${type} project "${name}" ready!`);
  console.log(`cd ${name}`);
  console.log("yarn dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
