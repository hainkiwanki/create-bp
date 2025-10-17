import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

const TEMPLATE_REPO = 'https://github.com/hainkiwanki/templates.git';

async function cloneTemplate(subPath: string, dest: string): Promise<void> {
    const tmpDir = path.join(process.cwd(), `tmp-${Date.now()}`);

    // Clone full repo shallowly
    await execa('git', ['clone', '--depth', '1', TEMPLATE_REPO, tmpDir]);

    // Copy only the chosen template folder
    await fs.copy(path.join(tmpDir, subPath), dest, { overwrite: true });

    // Merge in "common" if exists
    const commonPath = path.join(tmpDir, 'common');
    try {
        await fs.copy(commonPath, dest, { overwrite: true });
        console.log('🧩 merged common files');
    } catch {
        /* no common folder → ignore */
    }

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(path.join(dest, '.git'), { recursive: true, force: true });
}
