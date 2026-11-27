
\set ON_ERROR_STOP on
BEGIN;

-- 幂等保护：已存在就什么都不做
INSERT INTO shell_listing_app (app_id, lifecycle, pointers, updated_at)
SELECT 'cn.kaypal.original.optical', 'published', '{"stable":"0.1.0"}'::jsonb, now()
WHERE NOT EXISTS (SELECT 1 FROM shell_listing_app WHERE app_id = 'cn.kaypal.original.optical');

INSERT INTO shell_listing_version
  (id, app_id, version, channel, entry, pricing, published_at, submission_id, withdrawn, updated_at)
SELECT 'optical-listing-0-1-0', 'cn.kaypal.original.optical', '0.1.0', 'stable',
       $json${"appId":"cn.kaypal.original.optical","name":"眼镜店 CRM · 行业版","kind":"app","entry":"remote-web","launchMode":"original-website","version":"0.1.0","publisher":{"publisherId":"jiuzhang-first-party","name":"九章一方"},"category":"commerce","channel":"stable","withdrawn":false,"canonicalOrigin":"https://optical.opensource.kaypal.cn","allowedOrigins":["https://optical.opensource.kaypal.cn"],"manifestDigest":"281f7b68d0a9740fb45b8e3489bf68a48b71bd093350d47282807206671369fb","minShellVersion":"0.1.66","icon":{"uri":"https://vip.kaypal.cn/assets/cn.kaypal.original.optical/icon.webp","sha256":"c13d7fac1017c00a031db848cc1dbf498b5e0a6a7ea74248a31ef81b253cccfb"},"permissions":[],"capabilities":[],"runtimeRequirements":{"os":["win32"],"arch":["x64"],"runtimes":[]},"dataScope":{"tenant":false,"workspace":false,"user":false,"device":false},"artifact":{"digest":"7234b576e2a3a88c99ef30299bc8695d929933dca60ca4721923dde005b98b61","path":"/artifact/cn.kaypal.original.optical-0.1.0.bin","size":683},"description":"眼镜/视光行业专用版 CRM：23 列配镜销售台账（含验光度数、瞳距）、会员储值/次卡/积分/等级、优惠券与充值赠送满减活动、佩戴适应与视力复查回访。与通用版「CRM 客户管理」的区别是把验光处方和配镜工艺做成了结构化字段。","firstParty":false}$json$::jsonb, NULL, now(), 'seed-original-website', false, now()
WHERE NOT EXISTS (
  SELECT 1 FROM shell_listing_version
  WHERE app_id = 'cn.kaypal.original.optical' AND version = '0.1.0' AND channel = 'stable'
);

COMMIT;

SELECT app_id, lifecycle, pointers::text FROM shell_listing_app WHERE app_id = 'cn.kaypal.original.optical';
SELECT app_id, version, channel, withdrawn, length(entry::text) AS entry_len FROM shell_listing_version WHERE app_id = 'cn.kaypal.original.optical';
