#!/usr/bin/env node
import prompts from 'prompts';
import { execa } from 'execa';
import degit from 'degit';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATE_REPO = process.env.TEMPLATE_REPO!;
if (!TEMPLATE_REPO) {
    console.error('❌ Missing TEMPLATE_REPO in .env');
    process.exit(1);
}

async function cloneTemplate(subPath: string, dest: string): Promise<void> {
    const emitter = degit(`${TEMPLATE_REPO}/${subPath}`, { mode: 'git', force: true });
    await emitter.clone(dest);
    await fs.rm(path.join(dest, '.git'), { recursive: true, force: true });
}

async function createMonorepo(targetDir: string): Promise<void> {
    const { feCount, beCount, addShared } = await prompts([
        { type: 'number', name: 'feCount', message: 'How many frontends?', initial: 1 },
        { type: 'number', name: 'beCount', message: 'How many backends?', initial: 1 },
        { type: 'confirm', name: 'addShared', message: 'Add shared package?', initial: true },
    ]);

    console.log('\n📦 Cloning monorepo base...');
    const monoRepo = degit(`${TEMPLATE_REPO}/template-monorepo`, { mode: 'git', force: true });
    await monoRepo.clone(targetDir);

    const pkgDir = path.join(targetDir, 'packages');
    await fs.mkdir(pkgDir, { recursive: true });

    const clone = async (sub: string, name: string) => {
        const dest = path.join(pkgDir, name);
        await cloneTemplate(sub, dest);
        console.log(`  → created ${name}`);
    };

    for (let i = 1; i <= feCount; i++) await clone('template-frontend', `fe-app${i}`);
    for (let i = 1; i <= beCount; i++) await clone('template-backend', `be-api${i}`);
    if (addShared) await clone('packages/shared', 'shared');

    console.log('\n📦 Installing dependencies (this might take a bit)...');
    await execa('yarn', ['install'], { cwd: targetDir, stdio: 'inherit' });

    console.log('\n✅ Monorepo created successfully!');
}

async function main(): Promise<void> {
    const { type, name } = await prompts([
        {
            type: 'select',
            name: 'type',
            message: 'Select project type:',
            choices: [
                { title: 'Frontend (Vue + Vite + Vuetify)', value: 'template-frontend' },
                { title: 'Backend (Fastify + TS)', value: 'template-backend' },
                { title: 'Monorepo (frontend + backend + shared)', value: 'template-monorepo' },
            ],
        },
        {
            type: 'text',
            name: 'name',
            message: 'Project name:',
            validate: (v) => (v.trim() ? true : 'Required'),
        },
    ]);

    const targetDir = path.resolve(process.cwd(), name);
    await fs.mkdir(targetDir, { recursive: true });

    if (type === 'template-monorepo') {
        await createMonorepo(targetDir);
        return;
    }

    console.log(`\n📦 Cloning ${type}...`);
    await cloneTemplate(type, targetDir);

    console.log('📦 Installing dependencies...');
    await execa('yarn', ['install'], { cwd: targetDir, stdio: 'inherit' });

    console.log(`\n✅ ${name} is ready!`);
    console.log(`cd ${name}`);
    console.log('yarn dev');
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
