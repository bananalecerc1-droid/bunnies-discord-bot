import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import fs from 'fs-extra';

const createDir = (dir: string) => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
};

const sourceLocalesDir = join(__dirname, '..', 'src', 'locales');
const targetLocalesDir = join(__dirname, '..', 'dist', 'src', 'locales');

if (existsSync(sourceLocalesDir)) {
    createDir(targetLocalesDir);
    const localeFiles = readdirSync(sourceLocalesDir);
    for (const file of localeFiles) {
        const sourcePath = join(sourceLocalesDir, file);
        const targetPath = join(targetLocalesDir, file);
        try {
            copyFileSync(sourcePath, targetPath);
            console.log(`Copied locale file: ${file}`);
        } catch (error) {
            console.error(`Error copying locale file ${file}:`, error);
        }
    }
}

const settingsSource = join(__dirname, '..', 'settings.json');
const settingsTarget = join(__dirname, '..', 'dist', 'settings.json');
if (existsSync(settingsSource)) {
    try {
        copyFileSync(settingsSource, settingsTarget);
        console.log('Copied settings.json');
    } catch (error) {
        console.error('Error copying settings.json:', error);
    }
}

const sourceDir = join(__dirname, '..');
const targetDir = join(__dirname, '../dist');

fs.copySync(
    join(sourceDir, 'dashboard/views'),
    join(targetDir, 'dashboard/views')
);

fs.copySync(
    join(sourceDir, 'dashboard/public'),
    join(targetDir, 'dashboard/public')
);

const partialsDir = join(targetDir, 'dashboard/views/partials');
if (!fs.existsSync(partialsDir)) {
    fs.mkdirSync(partialsDir, { recursive: true });
}

fs.copySync(
    join(sourceDir, 'dashboard/locales'),
    join(targetDir, 'dashboard/locales')
);

fs.copySync(
    join(sourceDir, 'dashboard/public/images/flags'),
    join(targetDir, 'dashboard/public/images/flags')
);

console.log('Files copied successfully!');