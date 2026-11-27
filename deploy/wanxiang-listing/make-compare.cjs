/* 生成对比图：通用版 CRM 图标 vs 眼镜行业版图标，附现有分类图标做风格参照
 * 用法：node make-compare.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = __dirname;
const TMP = 'C:/Users/ThinkPad/AppData/Local/Temp/opencode';

const items = [
  ['ref-crm.png', '通用版 CRM'],
  [path.join(OUT, 'icon-256.png'), '眼镜行业版'],
  ['ref-office.png', 'office'],
  ['ref-tool.png', 'tool'],
  ['ref-media.png', 'media'],
  ['ref-education.png', 'education'],
];

const paths = items.map(([f]) => (path.isAbsolute(f) ? f : path.join(TMP, f)));
for (const p of paths) if (!fs.existsSync(p)) { console.error('缺文件:', p); process.exit(1); }

const labels = items.map((it) => it[1]);
const outFile = path.join(OUT, 'icon-compare.png');

const py = [
  'from PIL import Image, ImageDraw, ImageFont',
  'paths = ' + JSON.stringify(paths),
  'labels = ' + JSON.stringify(labels),
  'S, PAD, GAP, BAR = 200, 24, 20, 34',
  'cols = 3',
  'rows = (len(paths) + cols - 1) // cols',
  'W = PAD * 2 + cols * S + (cols - 1) * GAP',
  'H = PAD * 2 + rows * (S + BAR) + (rows - 1) * GAP',
  'sheet = Image.new("RGB", (W, H), (250, 250, 251))',
  'd = ImageDraw.Draw(sheet)',
  'try:',
  '    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)',
  'except Exception:',
  '    font = ImageFont.load_default()',
  'for i, p in enumerate(paths):',
  '    r, c = divmod(i, cols)',
  '    x = PAD + c * (S + GAP)',
  '    y = PAD + r * (S + BAR + GAP)',
  '    im = Image.open(p).convert("RGB").resize((S, S), Image.LANCZOS)',
  '    sheet.paste(im, (x, y))',
  '    d.rectangle([x, y, x + S - 1, y + S - 1], outline=(225, 225, 228))',
  '    d.text((x + 2, y + S + 7), labels[i], fill=(60, 60, 67), font=font)',
  'sheet.save(r"' + outFile + '")',
  'print("compare sheet", sheet.size)',
].join('\n');

execFileSync('python', ['-c', py], { stdio: 'inherit' });
console.log('产出: icon-compare.png');
