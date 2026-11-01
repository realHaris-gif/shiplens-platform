// scripts/generate-permissions-doc.ts
import fs from 'fs';
import path from 'path';
import { PERMISSIONS, Roles } from './src/config/permissions';

const roles = Object.values(Roles);

let md = '# ShipLens System Role & Permission Matrix\n\n';
md += '> Automatically generated from `src/config/permissions.ts`. Deny-by-default architecture.\n\n';
md += '| Permission ID | Method | Path | ' + roles.join(' | ') + ' |\n';
md += '| :--- | :--- | :--- | ' + roles.map(() => ':---:').join(' | ') + ' |\n';

PERMISSIONS.forEach((p) => {
  const row = [
    `\`${p.id}\``,
    `**${p.method}**`,
    `\`${p.path}\``,
    ...roles.map((r) => (p.roles.includes(r as any) ? '✅' : '❌'))
  ];
  md += '| ' + row.join(' | ') + ' |\n';
});

const outDir = path.join(__dirname, '../docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'permissions.md'), md, 'utf-8');
console.log('Generated docs/permissions.md successfully.');