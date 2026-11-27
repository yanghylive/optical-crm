  // ⭐ 眼镜/视光行业专用版 CRM（remote-web / original-website）
  // 与通用版 cc.jiuzhangai.crm 并列但不同物：这条是行业版，核心差异是
  // 23 列配镜台账里的验光处方（度数R/L、瞳距、RPD/LPD）与配镜工艺字段。
  // 零安装：runtimes 为空，壳内 WebContentsView 直接加载原站。
  {
    appId: 'cn.kaypal.original.optical',
    name: '眼镜店 CRM · 行业版',
    kind: 'app',
    entry: 'remote-web',
    launchMode: 'original-website',
    version: '0.1.0',
    publisher: { publisherId: 'jiuzhang-first-party', name: '九章一方' },
    category: 'commerce',
    channel: 'stable',
    withdrawn: false,
    canonicalOrigin: 'https://optical.opensource.kaypal.cn',
    allowedOrigins: ['https://optical.opensource.kaypal.cn'],
    manifestDigest: '96736fb83b5d1de770a01edd93dffb27f7cce2dbf6aa2126a1d1d2bd3b9021f1',
    minShellVersion: '0.1.66',
    icon: { uri: 'https://vip.kaypal.cn/assets/cn.kaypal.original.optical/icon.webp', sha256: 'c13d7fac1017c00a031db848cc1dbf498b5e0a6a7ea74248a31ef81b253cccfb' },
    permissions: [],
    capabilities: [],
    runtimeRequirements: { os: ['win32'], arch: ['x64'], runtimes: [] },
    dataScope: { tenant: false, workspace: false, user: false, device: false },
    description: '眼镜/视光行业专用版 CRM：23 列配镜销售台账（含验光处方与瞳距）、会员储值/次卡/积分/等级、优惠券与充值赠送满减活动、佩戴适应与视力复查回访。与通用版「CRM 客户管理」的区别是把验光处方和配镜工艺做成了结构化字段。',
    firstParty: false,
    accessModel: 'listing_pricing',
    license: { spdxId: 'MIT', name: 'MIT 许可证' },
  },
