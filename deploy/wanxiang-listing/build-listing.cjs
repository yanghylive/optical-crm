/* 生成上架物料：图标规范化 + sha256 + manifestDigest + 目录登记条目
 *
 * 用法：node build-listing.cjs <生成的原始图路径>
 * 产出：
 *   icon-256.webp          上架用图标（256×256 WebP）
 *   catalog-entry.json     目录登记条目（含真实 sha256 / manifestDigest）
 *   catalog-seed.snippet.ts  可直接粘进 catalog-seed.ts 的片段
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const OUT = __dirname;
const raw = process.argv[2];
if (!raw || !fs.existsSync(raw)) { console.error('用法: node build-listing.cjs <原始图路径>'); process.exit(1); }

const APP_ID = 'cn.kaypal.original.optical';
const NAME = '眼镜店 CRM · 行业版';
const ORIGIN = 'https://optical.opensource.kaypal.cn';
const VERSION = '0.1.0';
const MIN_SHELL = '0.1.66';
const ICON_URI = `https://vip.kaypal.cn/assets/${APP_ID}/icon.webp`;
const DESCRIPTION = '眼镜/视光行业专用版 CRM：23 列配镜销售台账（含验光处方与瞳距）、会员储值/次卡/积分/等级、优惠券与充值赠送满减活动、佩戴适应与视力复查回访。与通用版「CRM 客户管理」的区别是把验光处方和配镜工艺做成了结构化字段。';

// 1) 规范化图标：256×256、RGB、WebP
const png = path.join(OUT, 'icon-256.png');
const webp = path.join(OUT, 'icon-256.webp');
execFileSync('python', ['-c', `
from PIL import Image
im = Image.open(r'''${raw}''').convert('RGB')
w, h = im.size
s = min(w, h)
im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((256, 256), Image.LANCZOS)
im.save(r'''${png}''')
im.save(r'''${webp}''', 'WEBP', quality=92, method=6)
print('icon', im.size)
`], { stdio: 'inherit' });

const iconBytes = fs.readFileSync(webp);
const iconSha = crypto.createHash('sha256').update(iconBytes).digest('hex');

// 2) manifestDigest —— 按 catalog-seed.ts 里 tencent.octop 那条注释的口径：
//    sha256(JSON.stringify({appId,canonicalOrigin,channel,icon:{sha256,uri},minShellVersion,runtimes,version}))
//    键序必须逐字一致。
const digestPayload = {
  appId: APP_ID,
  canonicalOrigin: ORIGIN,
  channel: 'stable',
  icon: { sha256: iconSha, uri: ICON_URI },
  minShellVersion: MIN_SHELL,
  runtimes: [],
  version: VERSION,
};
const manifestDigest = crypto.createHash('sha256').update(JSON.stringify(digestPayload)).digest('hex');

// 3) 目录登记条目（字段与线上 6 条 original-website 应用逐字同构）
//    注意：fallbackIcon 是读路径派生值（fallback-icon.ts），不在种子里手写。
const entry = {
  appId: APP_ID,
  name: NAME,
  kind: 'app',
  entry: 'remote-web',
  launchMode: 'original-website',
  version: VERSION,
  publisher: { publisherId: 'jiuzhang-first-party', name: '九章一方' },
  category: 'commerce',
  channel: 'stable',
  withdrawn: false,
  canonicalOrigin: ORIGIN,
  allowedOrigins: [ORIGIN],
  manifestDigest,
  minShellVersion: MIN_SHELL,
  icon: { uri: ICON_URI, sha256: iconSha },
  permissions: [],
  capabilities: [],
  runtimeRequirements: { os: ['win32'], arch: ['x64'], runtimes: [] },
  dataScope: { tenant: false, workspace: false, user: false, device: false },
  description: DESCRIPTION,
  firstParty: false,
  accessModel: 'listing_pricing',
  license: { spdxId: 'MIT', name: 'MIT 许可证' },
};

fs.writeFileSync(path.join(OUT, 'catalog-entry.json'), JSON.stringify(entry, null, 2) + '\n');

// 4) 可粘贴的 TS 片段
const ts = `  // ⭐ 眼镜/视光行业专用版 CRM（remote-web / original-website）
  // 与通用版 cc.jiuzhangai.crm 并列但不同物：这条是行业版，核心差异是
  // 23 列配镜台账里的验光处方（度数R/L、瞳距、RPD/LPD）与配镜工艺字段。
  // 零安装：runtimes 为空，壳内 WebContentsView 直接加载原站。
  {
    appId: '${APP_ID}',
    name: '${NAME}',
    kind: 'app',
    entry: 'remote-web',
    launchMode: 'original-website',
    version: '${VERSION}',
    publisher: { publisherId: 'jiuzhang-first-party', name: '九章一方' },
    category: 'commerce',
    channel: 'stable',
    withdrawn: false,
    canonicalOrigin: '${ORIGIN}',
    allowedOrigins: ['${ORIGIN}'],
    manifestDigest: '${manifestDigest}',
    minShellVersion: '${MIN_SHELL}',
    icon: { uri: '${ICON_URI}', sha256: '${iconSha}' },
    permissions: [],
    capabilities: [],
    runtimeRequirements: { os: ['win32'], arch: ['x64'], runtimes: [] },
    dataScope: { tenant: false, workspace: false, user: false, device: false },
    description: '${DESCRIPTION}',
    firstParty: false,
    accessModel: 'listing_pricing',
    license: { spdxId: 'MIT', name: 'MIT 许可证' },
  },
`;
fs.writeFileSync(path.join(OUT, 'catalog-seed.snippet.ts'), ts);

console.log('icon sha256      :', iconSha);
console.log('icon bytes       :', iconBytes.length);
console.log('manifestDigest   :', manifestDigest);
console.log('digest 输入串     :', JSON.stringify(digestPayload));
console.log('产出             : icon-256.webp / catalog-entry.json / catalog-seed.snippet.ts');
