import { createCanvas, loadImage, GlobalFonts, type CanvasRenderingContext2D } from '@napi-rs/canvas';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'DejaVu Sans');
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

async function fetchImage(url: string): Promise<Buffer | null> {
    return new Promise(resolve => {
        https.get(url, response => {
            if (response.statusCode !== 200) {
                response.resume();
                resolve(null);
                return;
            }
            const chunks: Buffer[] = [];
            response.on('data', chunk => chunks.push(Buffer.from(chunk)));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
}

function safeName(value: string): string {
    return Array.from(value).filter(character => character.charCodeAt(0) >= 32 && !/[<>]/.test(character)).join('').trim() || 'Member';
}

export interface RankCardData {
    username: string;
    discriminator?: string;
    avatarUrl: string;
    level: number;
    currentXp: number;
    xpNeeded: number;
    totalXp: number;
    rank: number;
    customBackground?: Buffer;
}

export async function generateRankCard(input: RankCardData): Promise<Buffer> {
    const level = Number(input.level) || 0;
    const currentXp = Number(input.currentXp) || 0;
    const xpNeeded = Math.max(1, Number(input.xpNeeded) || 100);
    const totalXp = Number(input.totalXp) || 0;
    const rank = Number(input.rank) || 0;
    const width = 800;
    const height = 260;
    const split = 240;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    roundedRect(ctx, 0, 0, width, height, 22);
    ctx.clip();
    const defaultBackground = path.join(process.cwd(), 'backgrounds', 'rank_default.png');
    if (input.customBackground || fs.existsSync(defaultBackground)) {
        try {
            const image = await loadImage(input.customBackground || defaultBackground);
            ctx.drawImage(image, 0, 0, width, height);
            ctx.fillStyle = 'rgba(8, 8, 20, .62)';
            ctx.fillRect(0, 0, width, height);
        } catch {
            ctx.fillStyle = '#131328';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        const background = ctx.createLinearGradient(0, 0, width, height);
        background.addColorStop(0, '#0d0d1e');
        background.addColorStop(1, '#131328');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    }

    const avatarBuffer = await fetchImage(input.avatarUrl);
    const avatarSize = 140;
    const avatarX = (split - avatarSize) / 2;
    const avatarY = (height - avatarSize) / 2;
    const centerX = avatarX + avatarSize / 2;
    const centerY = avatarY + avatarSize / 2;
    if (avatarBuffer) {
        const avatar = await loadImage(avatarBuffer);
        ctx.save();
        ctx.shadowColor = '#7c3aed';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    }

    const divider = ctx.createLinearGradient(split, 0, split, height);
    divider.addColorStop(0, 'rgba(124,58,237,0)');
    divider.addColorStop(.5, 'rgba(124,58,237,.7)');
    divider.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = divider;
    ctx.fillRect(split, 0, 1.5, height);

    const rightX = split + 30;
    const rightWidth = width - rightX - 30;
    const originalName = safeName(input.username);
    let username = originalName;
    ctx.font = 'bold 30px "DejaVu Sans"';
    while (ctx.measureText(username).width > rightWidth - 100 && username.length > 4) username = username.slice(0, -1);
    if (username !== originalName) username += '…';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(username, rightX, 58);
    if (input.discriminator && input.discriminator !== '0') {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.font = '18px "DejaVu Sans"';
        ctx.fillText(`#${input.discriminator}`, rightX + ctx.measureText(username).width + 5, 58);
    }

    const rankText = `# ${rank}`;
    ctx.font = 'bold 14px "DejaVu Sans"';
    const rankWidth = ctx.measureText(rankText).width + 20;
    roundedRect(ctx, width - 30 - rankWidth, 30, rankWidth, 28, 14);
    ctx.fillStyle = 'rgba(124,58,237,.35)';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#c4b5fd';
    ctx.textAlign = 'center';
    ctx.fillText(rankText, width - 30 - rankWidth / 2, 49);
    ctx.textAlign = 'left';

    ctx.font = 'bold 13px "DejaVu Sans"';
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillText('LEVEL', rightX, 103);
    ctx.font = 'bold 52px "DejaVu Sans"';
    const levelGradient = ctx.createLinearGradient(rightX, 90, rightX + 120, 150);
    levelGradient.addColorStop(0, '#a78bfa');
    levelGradient.addColorStop(1, '#60a5fa');
    ctx.fillStyle = levelGradient;
    ctx.fillText(`${level}`, rightX + 58, 155);

    const barX = rightX + 130;
    const barWidth = width - barX - 30;
    const barY = 108;
    const barHeight = 18;
    const progress = Math.min(1, Math.max(0, currentXp / xpNeeded));
    roundedRect(ctx, barX, barY, barWidth, barHeight, 9);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fill();
    if (progress > 0) {
        const fillWidth = Math.max(barHeight, progress * barWidth);
        const fill = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        fill.addColorStop(0, '#7c3aed');
        fill.addColorStop(1, '#2563eb');
        roundedRect(ctx, barX, barY, fillWidth, barHeight, 9);
        ctx.fillStyle = fill;
        ctx.fill();
    }
    ctx.font = 'bold 13px "DejaVu Sans"';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(`${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, barX, barY + barHeight + 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '12px "DejaVu Sans"';
    ctx.fillText(`Total: ${totalXp.toLocaleString()} XP`, width - 30, barY + barHeight + 18);
    ctx.textAlign = 'left';

    const stats = [['RANK', `#${rank}`], ['TEXT LVL', `${level}`], ['TOTAL XP', totalXp.toLocaleString()]];
    const statY = 181;
    const spacing = rightWidth / stats.length;
    stats.forEach(([label, value], index) => {
        const x = rightX + index * spacing;
        ctx.font = '10px "DejaVu Sans"';
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillText(label, x, statY);
        ctx.font = 'bold 16px "DejaVu Sans"';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(value, x, statY + 20);
    });

    roundedRect(ctx, 1, 1, width - 2, height - 2, 22);
    ctx.strokeStyle = 'rgba(124,58,237,.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return canvas.toBuffer('image/png');
}
