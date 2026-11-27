const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- 数据层 ---------------- */
function pad(n) { return String(n).padStart(2, '0'); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function normalizePhone(v) {
  return String(v || '').replace(/[^\d]/g, '');
}

const DEFAULT_SETTINGS = {
  shopName: '明视眼镜',
  sources: ['门店自然客', '老客户转介绍', '抖音', '美团/大众点评', '小红书', '学校筛查', '医院转诊', '其他'],
  categories: ['框架眼镜', '隐形眼镜', '太阳镜', '功能镜片', '其他'],
  staffRoles: ['医生', '销售', '制作'],
};

const DEFAULT_MEMBER_LEVELS = [
  { name: '普通会员', threshold: 0, discount: 1, benefit: '无折扣' },
  { name: '银卡会员', threshold: 1000, discount: 0.95, benefit: '95 折' },
  { name: '金卡会员', threshold: 3000, discount: 0.9, benefit: '9 折 + 免费清洗保养' },
  { name: '钻石会员', threshold: 10000, discount: 0.85, benefit: '85 折 + 免费验光 + 优先加工' },
];

function seedDB() {
  const sources = DEFAULT_SETTINGS.sources;
  const categories = DEFAULT_SETTINGS.categories;
  const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
  const given = ['晓雨', '浩然', '倩', '子涵', '宇航', '雨桐', '思远', '欣怡', '俊杰', '梦琪', '明轩', '诗涵', '嘉豪', '雅静', '博文', '静怡', '天佑', '可欣', '泽宇', '若曦'];
  const schools = ['市第一中学', '实验中学', '第二小学', '师范大学', '职业技术学院', '', '', ''];
  const frames = ['暴龙', '陌森', '雷朋', '蔡司', '依视路', '明月', '万新', '康视达', '博士伦', '海昌'];
  const models = ['BJ7132', 'MJ3021', 'RB2140', 'ZS1234', 'MY8801', 'WX5602', 'KS9901', 'QL2024'];
  const lenses = ['1.56 单光', '1.60 非球面防蓝光', '1.67 非球面', '1.74 超薄', '渐进多焦点', '隐形眼镜'];
  const doctors = ['李医生', '王医生', '陈医生', '刘医生'];
  const sales = ['陈销售', '刘销售', '王销售', '赵销售'];
  const makers = ['周师傅', '吴师傅', '郑师傅'];
  const companies = ['明亮光学', '康视达', '博士伦', '依视路', '蔡司'];

  const customers = [];
  const prescriptions = [];
  const now = new Date();
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  for (let i = 0; i < 36; i++) {
    const name = rnd(surnames) + rnd(given);
    const gender = Math.random() > 0.48 ? '女' : '男';
    const age = rndInt(8, 55);
    const phone = '138' + String(rndInt(10000000, 99999999));
    const school = age < 22 ? rnd(schools) : '';
    const source = rnd(sources);
    const c = {
      id: uid('c_'),
      name, gender, age, phone, school,
      source,
      sourceDetail: source === '老客户转介绍' ? '老客户推荐' : (source === '抖音' ? '直播间团购' : ''),
      remark: '',
      createdAt: new Date(now.getTime() - rndInt(1, 180) * 86400000).toISOString(),
    };
    customers.push(c);

    const orderCount = rndInt(1, 3);
    for (let j = 0; j < orderCount; j++) {
      const daysAgo = rndInt(0, 215);
      const d = new Date(now.getTime() - daysAgo * 86400000);
      const category = rnd(categories);
      const amount = category === '隐形眼镜' ? rndInt(199, 699) : rndInt(399, 2599);
      const sph = (-1 * (rndInt(100, 600) / 100)).toFixed(2);
      const cyl = Math.random() > 0.5 ? `-${(rndInt(25, 200) / 100).toFixed(2)}×${rndInt(5, 180)}` : '';
      prescriptions.push({
        id: uid('p_'),
        customerId: c.id,
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        amount,
        doctor: category === '隐形眼镜' ? '' : rnd(doctors),
        sales: rnd(sales),
        maker: category === '隐形眼镜' ? '' : rnd(makers),
        company: rnd(companies),
        category,
        frame: category === '隐形眼镜' ? rnd(['博士伦', '海昌']) : rnd(frames),
        model: rnd(models),
        lens: category === '隐形眼镜' ? '隐形眼镜' : rnd(lenses),
        sphR: cyl ? `${sph}/${cyl}` : sph,
        sphL: cyl ? `${sph}/${cyl}` : sph,
        pd: (rndInt(580, 680) / 10).toFixed(1),
        rpd: (rndInt(285, 340) / 10).toFixed(1),
        lpd: (rndInt(285, 340) / 10).toFixed(1),
        phR: category === '隐形眼镜' ? '' : (rndInt(170, 230) / 10).toFixed(1),
        phL: category === '隐形眼镜' ? '' : (rndInt(170, 230) / 10).toFixed(1),
        remark: j === 0 ? '' : '老客户复购',
        createdAt: d.toISOString(),
      });
    }
  }

  const staff = [];
  [...doctors, ...sales, ...makers].forEach((name) => {
    const role = doctors.includes(name) ? '医生' : sales.includes(name) ? '销售' : '制作';
    staff.push({ id: uid('s_'), name, role, phone: '', active: true });
  });

  // ---- 会员体系演示数据 ----
  const members = [], memberCards = [], memberTxns = [];
  const cardTypes = ['框架卡', '隐形眼镜卡', '储值卡'];
  const payMethods = ['现金', '微信', '支付宝', '储值'];
  let mi = 0;
  for (const c of customers) {
    mi++;
    if (mi % 5 === 0) continue; // 约 80% 的客户是会员
    const ps = prescriptions.filter((p) => p.customerId === c.id);
    const totalSpend = ps.reduce((s, p) => s + p.amount, 0);
    const lv = DEFAULT_MEMBER_LEVELS.slice().sort((a, b) => b.threshold - a.threshold).find((l) => totalSpend >= l.threshold) || DEFAULT_MEMBER_LEVELS[0];
    const m = {
      id: uid('m_'), cardNo: 'M' + String(Date.now()).slice(-6) + String(mi).padStart(3, '0'),
      customerId: c.id, name: c.name, phone: c.phone, gender: c.gender, age: c.age,
      birthday: '', source: c.source, balance: 0, giftBalance: 0, points: 0,
      totalSpend: round2(totalSpend), totalRecharge: 0, orderCount: ps.length,
      levelManual: false, status: '正常', remark: '', createdAt: c.createdAt,
    };
    if (mi % 3 === 0) {
      const recharge = 500 + Math.floor(Math.random() * 8) * 500;
      const gift = Math.round(recharge * (mi % 2 ? 0.2 : 0.1));
      m.totalRecharge = recharge; m.balance = recharge + gift; m.giftBalance = gift;
      const rdate = addDays(todayISO(), -rndInt(5, 150));
      memberTxns.push({ id: uid('t_'), memberId: m.id, type: '充值', amount: recharge, points: recharge, cardId: '', refId: '', remark: '会员充值', balanceAfter: recharge + gift, date: rdate, createdAt: new Date().toISOString() });
      memberTxns.push({ id: uid('t_'), memberId: m.id, type: '赠送', amount: gift, points: 0, cardId: '', refId: '', remark: '充值赠送', balanceAfter: recharge + gift, date: rdate, createdAt: new Date().toISOString() });
    }
    m.points = Math.floor(totalSpend);
    if (mi % 4 === 0) {
      const type = cardTypes[mi % cardTypes.length];
      const totalTimes = 3 + (mi % 3);
      const usedTimes = mi % totalTimes;
      const price = 800 + totalTimes * 300;
      memberCards.push({
        id: uid('c_'), memberId: m.id, type, name: type + ' ' + totalTimes + ' 次',
        totalTimes, usedTimes, price, expireDate: addDays(todayISO(), rndInt(-20, 60)),
        status: usedTimes >= totalTimes ? '已用完' : (usedTimes > 0 ? '使用中' : '未用'), createdAt: new Date().toISOString(),
      });
    }
    members.push(m);
    ps.forEach((p) => { p.memberId = m.id; p.payMethod = payMethods[mi % payMethods.length]; });
    if (mi % 7 === 0) ps.forEach((p) => { p.date = addDays(p.date, -200); }); // 制造一批沉睡会员用于演示
  }

  // ---- 营销活动 / 优惠券演示数据 ----
  const coupons = [
    { name: '新客立减 50 元', type: '满减', faceValue: 50, threshold: 300, scopeCategory: '', validDays: 90, totalQty: 0 },
    { name: '框架镜 9 折券', type: '折扣', faceValue: 0.9, threshold: 0, scopeCategory: '框架眼镜', validDays: 60, totalQty: 0 },
    { name: '学生配镜满 800 减 120', type: '满减', faceValue: 120, threshold: 800, scopeCategory: '', validDays: 90, totalQty: 0 },
  ].map((c) => ({ id: uid('cp_'), ...c, startDate: '', endDate: '', status: '启用', remark: '', createdAt: new Date().toISOString() }));
  const activities = [
    { name: '开学季充 1000 送 200', type: '充值赠送', threshold: 1000, giftAmount: 200, memberLevel: '', scopeCategory: '' },
    { name: '框架配镜满 1500 减 200', type: '配镜满减', threshold: 1500, reward: 200, memberLevel: '', scopeCategory: '框架眼镜' },
    { name: '会员日双倍积分', type: '双倍积分', threshold: 0, multiplier: 2, memberLevel: '', scopeCategory: '' },
  ].map((a) => ({ id: uid('a_'), ...a, startDate: '', endDate: '', status: '进行中', remark: '', createdAt: new Date().toISOString() }));
  const couponGrants = [];
  members.slice(0, 20).forEach((m, i) => {
    const c = coupons[i % coupons.length];
    couponGrants.push({
      id: uid('g_'), couponId: c.id, memberId: m.id,
      status: i % 4 === 0 ? '已使用' : '未使用',
      expireDate: addDays(todayISO(), 15 + i * 6), grantedAt: addDays(todayISO(), -10 - i),
      usedAt: i % 4 === 0 ? addDays(todayISO(), -3) : '',
    });
  });

  return { settings: DEFAULT_SETTINGS, customers, prescriptions, staff, members, memberCards, memberTxns, coupons, couponGrants, activities, createdAt: new Date().toISOString() };
}

function loadDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const db = freshDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('db.json 解析失败，已备份并重建', e);
    fs.copyFileSync(DB_FILE, DB_FILE + '.broken-' + Date.now());
    const db = freshDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    return db;
  }
}

/* 全新部署默认空库；只有显式 SEED_DEMO=1 才灌演示数据，避免生产环境凭空出现假客户 */
function emptyDB() {
  return {
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    customers: [], prescriptions: [], staff: [], members: [], memberCards: [],
    memberTxns: [], coupons: [], couponGrants: [], activities: [], followUps: [],
    createdAt: new Date().toISOString(),
  };
}
function freshDB() {
  if (process.env.SEED_DEMO === '1') { console.log('  SEED_DEMO=1 → 生成演示数据'); return seedDB(); }
  console.log('  全新空库（如需演示数据请设 SEED_DEMO=1）');
  return emptyDB();
}

let db = loadDB();
let saveTimer = null;
let _cacheEpoch = 0; // 任何写操作递增，使派生计算缓存（随访建议/生命周期）失效
function saveDB() {
  _cacheEpoch++;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // 原子写：先写临时文件再 rename，避免掉电/崩溃时把 db.json 写成半截
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

function customerById(id) { return db.customers.find((c) => c.id === id); }
/* 性能：批量场景用 Map/分组索引，避免逐条线性查找（O(n×m) → O(n+m)） */
function buildCustMap() { return new Map(db.customers.map((c) => [c.id, c])); }
function groupPrescriptionsByCustomer() {
  const m = new Map();
  for (const p of db.prescriptions) {
    if (!m.has(p.customerId)) m.set(p.customerId, []);
    m.get(p.customerId).push(p);
  }
  return m;
}
function enrichPrescription(p, cmap) {
  const c = (cmap && typeof cmap.get === 'function' ? cmap.get(p.customerId) : customerById(p.customerId)) || {};
  return { ...p, customerName: c.name || '未知客户', phone: c.phone || '', gender: c.gender || '', age: c.age || '', school: c.school || '', source: c.source || '', sourceDetail: c.sourceDetail || '' };
}
/* 分页：传 pageSize 时返回 {items,total,page,pageSize}，否则返回数组（向后兼容） */
function paginate(list, req, res) {
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 0, 0), 500);
  if (!pageSize) return res.json(list);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const total = list.length;
  res.json({ items: list.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize });
}

/* ---------------- 统计 ---------------- */
function stats() {
  const today = todayISO();
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const monthOrders = db.prescriptions.filter((p) => String(p.date).startsWith(monthPrefix));
  const todayOrders = db.prescriptions.filter((p) => p.date === today);
  const sum = (arr) => arr.reduce((s, p) => s + Number(p.amount || 0), 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const list = db.prescriptions.filter((p) => p.date === key);
    days.push({ date: key.slice(5), amount: sum(list), count: list.length });
  }

  const sourceMap = {};
  db.customers.forEach((c) => { sourceMap[c.source || '未填写'] = (sourceMap[c.source || '未填写'] || 0) + 1; });
  const sourceDist = Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const salesMap = {};
  monthOrders.forEach((p) => { if (p.sales) salesMap[p.sales] = (salesMap[p.sales] || 0) + Number(p.amount || 0); });
  const salesRank = Object.entries(salesMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);

  const categoryMap = {};
  monthOrders.forEach((p) => { categoryMap[p.category || '未分类'] = (categoryMap[p.category || '未分类'] || 0) + 1; });
  const categoryDist = Object.entries(categoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return {
    todayAmount: sum(todayOrders),
    todayCount: todayOrders.length,
    monthAmount: sum(monthOrders),
    monthCount: monthOrders.length,
    totalCustomers: db.customers.length,
    memberCount: db.members.length,
    memberBalance: round2(db.members.reduce((s, m) => s + (m.balance || 0), 0)),
    avgOrder: monthOrders.length ? Math.round(sum(monthOrders) / monthOrders.length) : 0,
    followupsDue: followupSuggestions().filter((s) => s.dueDate <= today).length,
    days,
    sourceDist,
    salesRank,
    categoryDist,
  };
}

/* ---------------- 鉴权 ---------------- */
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
if (!Array.isArray(db.followUps)) db.followUps = [];
if (!Array.isArray(db.refractiveRecords)) db.refractiveRecords = [];
if (!Array.isArray(db.families)) db.families = [];
if (!db.settings.auth) { db.settings.auth = { passwordHash: sha256('admin123'), mustChange: true }; saveDB(); }

const sessions = new Map();
const SESSION_TTL = 7 * 24 * 3600 * 1000;
function newToken() { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, { exp: Date.now() + SESSION_TTL }); return t; }
function getToken(req) { const h = req.headers.authorization || ''; if (h.startsWith('Bearer ')) return h.slice(7); return req.query.token || ''; }
function authed(req) { const t = getToken(req); const s = sessions.get(t); if (s && s.exp > Date.now()) return true; if (t) sessions.delete(t); return false; }
function publicSettings() { const { auth, ...rest } = db.settings; return { ...rest, mustChangePassword: !!(auth && auth.mustChange) }; }

function lanUrls() {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const [name, list] of Object.entries(nets)) {
    if (/vEthernet|loopback|virtual|vmware|virtualbox|hyper-v|docker|wsl/i.test(name)) continue;
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) urls.push(`http://${n.address}:${PORT}`);
    }
  }
  return urls;
}

/* 健康检查：不返回任何业务数据，供 Docker / 负载均衡探活 */
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'optical-crm', version: '1.4.0', time: new Date().toISOString() }));

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: '请输入密码' });
  if (sha256(password) !== db.settings.auth.passwordHash) return res.status(401).json({ error: '密码错误' });
  res.json({ token: newToken(), mustChange: !!db.settings.auth.mustChange });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  if (!authed(req)) return res.status(401).json({ error: '未登录' });
  next();
});

app.post('/api/logout', (req, res) => { sessions.delete(getToken(req)); res.json({ ok: true }); });
app.post('/api/changePassword', (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (sha256(oldPassword || '') !== db.settings.auth.passwordHash) return res.status(400).json({ error: '原密码错误' });
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  db.settings.auth.passwordHash = sha256(newPassword); db.settings.auth.mustChange = false; saveDB();
  res.json({ ok: true });
});

/* ---------------- 回访提醒 ---------------- */
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function diffDays(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
/* ---- 产品类型推断（驱动差异化临床随访） ---- */
const PRODUCT_TYPES = ['OK镜', '离焦防控镜', '普通框架', '隐形眼镜', '视训', '换框换片', '其他'];
const DEFAULT_PRODUCT_KEYWORDS = {
  'OK镜': ['OK', 'ok', '角膜塑形', '塑型', '塑形镜', '角塑'],
  '离焦防控镜': ['离焦', '防控', '星趣控', '新乐学', '柯学优', '乐学', '环焦', '控优点', '学轻松', '不等像'],
  '隐形眼镜': ['隐形', '月抛', '季抛', '年抛', '半年抛', '角膜接触'],
  '视训': ['视训', '训练', '反转拍', '弱视', '视功能'],
};
function productTypeKeywords() { return db.settings.productTypeKeywords || DEFAULT_PRODUCT_KEYWORDS; }
function inferProductType(p) {
  if (p.productType) return p.productType;
  if (p.category === '换框' || p.category === '换片') return '换框换片';
  const text = [p.category, p.lens, p.frame, p.model].join(' ');
  const kw = productTypeKeywords();
  for (const t of ['OK镜', '离焦防控镜', '隐形眼镜', '视训']) {
    if ((kw[t] || []).some((k) => text.includes(k))) return t;
  }
  if (p.category === '隐形眼镜') return '隐形眼镜';
  return '普通框架';
}

/* ---- 分品类临床随访模板（对齐专家共识 + 院方病种节点时间轴） ---- */
const DEFAULT_FOLLOWUP_TEMPLATES = [
  { productType: 'OK镜', repeatDays: 90, repeatLabel: '定期复查', stages: [
    { label: '第1天复查', days: 1, script: '您好，我是{shopName}。孩子昨晚首次戴OK镜，今天务必到店复查——检查角膜健康、镜片配适和裸眼视力。首夜需睡足8小时，晨起2小时内戴镜状态下复诊；如强烈异物感或疼痛，先摘镜及时就诊。' },
    { label: '第1周复查', days: 7, script: '您好，我是{shopName}。OK镜配戴满一周，请到店复查角膜与配适情况，确认塑形效果与眼部健康。' },
    { label: '第2周复查', days: 14, script: '您好，我是{shopName}。OK镜配戴两周，建议复查视力与角膜，评估塑形稳定情况。' },
    { label: '第1月复查', days: 30, script: '您好，我是{shopName}。OK镜配戴满月，请到店复查裸眼视力、角膜地形图与眼轴，评估防控效果。' },
    { label: '第3月复查', days: 90, script: '您好，我是{shopName}。OK镜配戴满3个月，请复查视力、角膜与眼轴。之后建议每2~3个月定期复查，守护角膜安全与防控效果。' },
  ]},
  { productType: '离焦防控镜', repeatDays: 90, repeatLabel: '眼轴复查', stages: [
    { label: '第1月复查', days: 30, script: '您好，我是{shopName}。孩子戴离焦防控镜满1个月，建议到店复查视力与配戴适应情况，确认防控镜片佩戴正确。' },
    { label: '第3月眼轴复查', days: 90, script: '您好，我是{shopName}。防控满3个月，建议复查眼轴与屈光度，评估近视控制效果（6~10岁眼轴安全增长每年应小于0.20mm）。' },
    { label: '第6月眼轴复查', days: 180, script: '您好，我是{shopName}。防控满半年，请复查眼轴、屈光度与视力，对比既往数据评估控制效果，必要时调整防控方案。' },
  ]},
  { productType: '普通框架', repeatDays: 0, repeatLabel: '', stages: [
    { label: '佩戴适应回访', days: 7, script: '您好，我是{shopName}。您上周配的眼镜戴着还舒服吗？有没有压鼻、下滑或看东西疲劳？有空可以来店里免费调整、清洗。' },
    { label: '年度复查', days: 365, script: '您好，我是{shopName}。您的眼镜已配戴一年，建议复查视力，看看度数有无变化，镜片是否还合适。' },
  ]},
  { productType: '隐形眼镜', repeatDays: 90, repeatLabel: '角膜健康检查', stages: [
    { label: '复购提醒', days: 90, script: '您好，我是{shopName}。您的隐形眼镜差不多用完了吧？需要帮您留一盒吗？也可顺便检查角膜健康。' },
  ]},
  { productType: '视训', repeatDays: 0, repeatLabel: '', stages: [
    { label: '疗程第1周', days: 7, script: '您好，我是{shopName}。视功能训练第一周，孩子坚持得怎么样？有无不适？欢迎反馈，我们调整训练方案。' },
    { label: '疗程第2周', days: 14, script: '您好，我是{shopName}。训练两周，建议到店评估训练效果，调整方案。' },
    { label: '疗程第1月', days: 30, script: '您好，我是{shopName}。训练满月，请到店复查视功能进展。' },
  ]},
  { productType: '换框换片', repeatDays: 0, repeatLabel: '', stages: [
    { label: '佩戴适应回访', days: 7, script: '您好，我是{shopName}。换框/换片后戴着还合适吗？有无松动、压鼻或视物不适？欢迎到店免费调整。' },
  ]},
  { productType: '其他', repeatDays: 0, repeatLabel: '', stages: [
    { label: '使用回访', days: 7, script: '您好，我是{shopName}。感谢惠顾，使用上有任何问题欢迎随时联系我们。' },
  ]},
];
if (!Array.isArray(db.settings.followupTemplates)) db.settings.followupTemplates = JSON.parse(JSON.stringify(DEFAULT_FOLLOWUP_TEMPLATES));
if (!db.settings.lifecycleThresholds) db.settings.lifecycleThresholds = { newDays: 90, lostDays: 365, loyalOrders: 4, loyalDays: 180, graceDays: 7 };
let _tplCache = null, _tplKey = '';
function followupTemplates() {
  const key = JSON.stringify(db.settings.followupTemplates || null);
  if (_tplCache && _tplKey === key) return _tplCache;
  const cfg = db.settings.followupTemplates || [];
  const result = DEFAULT_FOLLOWUP_TEMPLATES.map((def) => {
    const c = cfg.find((x) => x && x.productType === def.productType);
    if (!c) return def;
    const stages = def.stages.map((s, i) => {
      const cs = (c.stages || [])[i];
      return { label: cs && cs.label ? cs.label : s.label, days: cs && Number(cs.days) > 0 ? Math.floor(Number(cs.days)) : s.days, script: cs && cs.script ? cs.script : s.script };
    });
    return { productType: def.productType, stages, repeatDays: c.repeatDays != null ? Number(c.repeatDays) : def.repeatDays, repeatLabel: c.repeatLabel != null ? c.repeatLabel : def.repeatLabel };
  });
  _tplCache = result; _tplKey = key;
  return result;
}
function templateFor(pt) { const ts = followupTemplates(); return ts.find((t) => t.productType === pt) || ts.find((t) => t.productType === '其他'); }
const DISCARD_DAYS = { '月抛': 30, '季抛': 90, '半年抛': 180, '年抛': 365 };
function shopScript(s) { return String(s || '').replace(/\{shopName\}/g, db.settings.shopName || '明视眼镜'); }
/* 展开某单的到期随访时点（固定时点全部到期项 + 最近一次周期复查） */
function expandDueStages(p, today, horizon) {
  const pt = inferProductType(p);
  const tpl = templateFor(pt);
  const stages = tpl.stages.map((s, i) => ({ ...s, index: i }));
  if (pt === '隐形眼镜' && stages.length) stages[0] = { ...stages[0], days: DISCARD_DAYS[p.discardCycle] || 90 };
  const out = [];
  for (const s of stages) {
    const due = addDays(p.date, s.days);
    if (due <= horizon) out.push({ index: s.index, label: s.label, due, script: s.script, productType: pt });
  }
  const R = Number(tpl.repeatDays) || 0;
  if (R > 0 && stages.length) {
    const lastDays = Math.max(...stages.map((s) => s.days));
    const k = Math.floor((diffDays(p.date, horizon) - lastDays) / R);
    if (k >= 1) {
      const due = addDays(p.date, lastDays + k * R);
      out.push({ index: stages.length + k, label: (tpl.repeatLabel || '定期复查') + '·第' + k + '次', due, script: '您好，我是{shopName}。按复查周期，建议您到店复查，评估眼部健康与防控效果。', productType: pt });
    }
  }
  return out;
}
let _suggCache = null, _suggKey = '';
function followupSuggestions() {
  const today = todayISO();
  const ck = _cacheEpoch + '|' + today;
  if (_suggCache && _suggKey === ck) return _suggCache;
  const horizon = addDays(today, 7);
  const handled = new Set(db.followUps.filter((f) => f.status !== 'pending' && f.stageIndex != null).map((f) => f.customerId + '|' + (f.productType || '') + '|' + f.basedOn + '|' + f.stageIndex));
  const byCust = groupPrescriptionsByCustomer();
  for (const arr of byCust.values()) arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const out = [];
  for (const c of db.customers) {
    const ps = byCust.get(c.id) || [];
    if (!ps.length) continue;
    const latestByType = new Map();
    for (const p of ps) { const pt = inferProductType(p); if (!latestByType.has(pt)) latestByType.set(pt, p); }
    for (const [pt, p] of latestByType) {
      // 每客户每产品类型只保留「最近一个到期时点」= 当前该做的复查，避免历史单全部时点淹没清单
      let pick = null;
      for (const s of expandDueStages(p, today, horizon)) {
        const key = c.id + '|' + pt + '|' + p.id + '|' + s.index;
        if (handled.has(key)) continue;
        if (!pick || s.due > pick.s.due) pick = { key, s };
      }
      if (!pick) continue;
      const s = pick.s;
      out.push({
        key: pick.key, customerId: c.id, customerName: c.name, phone: c.phone, age: c.age, school: c.school,
        productType: pt, type: pt + '·' + s.label, stageIndex: s.index, stageLabel: s.label,
        basedOn: p.id, lastDate: p.date, lastCategory: p.category, lastAmount: p.amount,
        dueDate: s.due, overdue: s.due < today, daysDiff: diffDays(today, s.due), script: shopScript(s.script),
      });
    }
  }
  out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  _suggCache = out; _suggKey = ck;
  return out;
}

/* ---- 客户生命周期阶段（派生） ---- */
function lifecycleThresholds() { return db.settings.lifecycleThresholds || { newDays: 90, lostDays: 365, loyalOrders: 4, loyalDays: 180, graceDays: 7 }; }
function expectedCycle(pt) { const tpl = templateFor(pt); if (Number(tpl.repeatDays) > 0) return Number(tpl.repeatDays); return Math.max(...tpl.stages.map((s) => s.days), 365); }
function computeStage(ps, today, th) {
  if (!ps.length) return '潜在';
  let latest = '', latestP = null;
  for (const p of ps) { if ((p.date || '') > latest) { latest = p.date || ''; latestP = p; } }
  const since = diffDays(latest, today);
  if (since > th.lostDays) return '流失';
  if (ps.length >= th.loyalOrders && since <= th.loyalDays) return '忠诚';
  if (since > expectedCycle(inferProductType(latestP))) return '沉睡';
  if (ps.length === 1 && since <= th.newDays) return '新客';
  return '活跃';
}
function lifecycleMap() {
  const byCust = groupPrescriptionsByCustomer();
  const today = todayISO(); const th = lifecycleThresholds();
  const m = new Map();
  for (const c of db.customers) m.set(c.id, computeStage(byCust.get(c.id) || [], today, th));
  return m;
}
/* 节点复查完成率（防控/OK镜，院方核心指标） */
function reviewCompliance() {
  const today = todayISO(); const grace = lifecycleThresholds().graceDays || 7;
  const byCust = groupPrescriptionsByCustomer();
  for (const arr of byCust.values()) arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const doneByKey = new Map();
  for (const f of db.followUps) {
    if (f.status === 'done' && f.stageIndex != null) {
      const k = f.customerId + '|' + (f.productType || '') + '|' + f.basedOn + '|' + f.stageIndex;
      const d = (f.doneAt || f.createdAt || '').slice(0, 10);
      if (!doneByKey.has(k) || d < doneByKey.get(k)) doneByKey.set(k, d);
    }
  }
  let due = 0, onTime = 0;
  for (const c of db.customers) {
    const ps = byCust.get(c.id) || [];
    const latestByType = new Map();
    for (const p of ps) { const pt = inferProductType(p); if (!latestByType.has(pt)) latestByType.set(pt, p); }
    for (const [pt, p] of latestByType) {
      if (pt !== 'OK镜' && pt !== '离焦防控镜') continue;
      for (const s of expandDueStages(p, today, today)) {
        due++;
        const doneDate = doneByKey.get(c.id + '|' + pt + '|' + p.id + '|' + s.index);
        if (doneDate && doneDate <= addDays(s.due, grace)) onTime++;
      }
    }
  }
  return { due, onTime, rate: due ? onTime / due : 0 };
}
app.get('/api/followups/suggestions', (req, res) => {
  const all = followupSuggestions();
  // 无分页/筛选参数 → 返回数组（向后兼容）；否则服务端分页，只回传当页，避免大响应
  if (!req.query.page && !req.query.pageSize && !req.query.productType) return res.json(all);
  const pt = req.query.productType || '';
  const filtered = pt ? all.filter((s) => s.productType === pt) : all;
  const dueCount = filtered.filter((s) => s.overdue || s.daysDiff <= 0).length;
  const products = [...new Set(all.map((s) => s.productType))];
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 30, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  res.json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, dueCount, soonCount: filtered.length - dueCount, products, page, pageSize });
});
app.get('/api/followups', (req, res) => res.json(db.followUps.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((f) => ({ ...f, customerName: (customerById(f.customerId) || {}).name || f.customerId }))));
app.post('/api/followups', (req, res) => {
  const b = req.body || {};
  if (!b.customerId || !b.type) return res.status(400).json({ error: '缺少客户或类型' });
  const f = { id: uid('f_'), customerId: b.customerId, type: b.type, basedOn: b.basedOn || '', status: b.status || 'done', note: b.note || '', channel: b.channel || '', productType: b.productType || '', stageIndex: b.stageIndex != null ? Number(b.stageIndex) : null, stageLabel: b.stageLabel || '', createdAt: new Date().toISOString(), doneAt: new Date().toISOString() };
  db.followUps.push(f); saveDB(); res.json(f);
});
let _lcCache = null, _lcKey = '';
app.get('/api/lifecycle-stats', (req, res) => {
  const ck = _cacheEpoch + '|' + todayISO();
  if (_lcCache && _lcKey === ck) return res.json(_lcCache);
  const stages = lifecycleMap();
  const dist = {};
  for (const s of stages.values()) dist[s] = (dist[s] || 0) + 1;
  const total = db.customers.length;
  const withOrders = [...stages.values()].filter((s) => s !== '潜在').length;
  const sleeping = (dist['沉睡'] || 0) + (dist['流失'] || 0);
  const byCust = groupPrescriptionsByCustomer();
  let repeat = 0;
  for (const arr of byCust.values()) if (arr.length >= 2) repeat++;
  const rc = reviewCompliance();
  const result = { total, stageDist: dist, sleepingRatio: total ? sleeping / total : 0, repurchaseRate: withOrders ? repeat / withOrders : 0, reviewDue: rc.due, reviewOnTime: rc.onTime, reviewRate: rc.rate };
  _lcCache = result; _lcKey = ck;
  res.json(result);
});

/* ---------------- P1-M5: 屈光发育档案 ---------------- */
function refractiveOf(customerId) {
  return db.refractiveRecords.filter((r) => r.customerId === customerId).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
function refractiveAnalysis(customerId) {
  const c = customerById(customerId);
  const recs = refractiveOf(customerId);
  const alerts = [];
  const age = Number(c && c.age) || 0;
  const withAL = recs.filter((r) => Number(r.alR) > 0 || Number(r.alL) > 0);
  let alGrowth = null;
  if (withAL.length >= 2) {
    const first = withAL[0], last = withAL[withAL.length - 1];
    const days = diffDays(first.date, last.date);
    if (days > 0) {
      const alFirst = Number(first.alR) || Number(first.alL) || 0;
      const alLast = Number(last.alR) || Number(last.alL) || 0;
      alGrowth = Math.round(((alLast - alFirst) / (days / 365)) * 1000) / 1000;
      if (age >= 6 && age <= 10 && alGrowth > 0.20) alerts.push({ level: 'warn', text: `眼轴年增长 ${alGrowth}mm，超过 6~10 岁安全值 0.20mm/年，建议加强防控并缩短复查间隔` });
    }
  }
  const latest = recs[recs.length - 1] || null;
  let alcr = null;
  if (latest && Number(latest.alR) > 0 && Number(latest.crR) > 0) {
    alcr = Math.round((Number(latest.alR) / Number(latest.crR)) * 100) / 100;
    if (alcr > 2.90) alerts.push({ level: 'warn', text: `轴率比 AL/CR=${alcr} > 2.90，建议睫状肌麻痹（散瞳）验光明确屈光度` });
  }
  return { records: recs, latest, alGrowth, alcr, alerts, count: recs.length };
}
app.get('/api/refractive/:customerId', (req, res) => res.json(refractiveAnalysis(req.params.customerId)));
app.post('/api/refractive', (req, res) => {
  const b = req.body || {};
  if (!b.customerId) return res.status(400).json({ error: '缺少客户' });
  if (!customerById(b.customerId)) return res.status(404).json({ error: '客户不存在' });
  const r = { id: uid('r_'), customerId: b.customerId, date: b.date || todayISO(), alR: b.alR || '', alL: b.alL || '', crR: b.crR || '', crL: b.crL || '', sphR: b.sphR || '', sphL: b.sphL || '', vaR: b.vaR || '', vaL: b.vaL || '', reserve: b.reserve || '', remark: b.remark || '', createdAt: new Date().toISOString() };
  db.refractiveRecords.push(r); saveDB(); res.json(r);
});
app.put('/api/refractive/:id', (req, res) => {
  const r = db.refractiveRecords.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: '记录不存在' });
  const b = req.body || {};
  ['date', 'alR', 'alL', 'crR', 'crL', 'sphR', 'sphL', 'vaR', 'vaL', 'reserve', 'remark'].forEach((k) => { if (b[k] !== undefined) r[k] = b[k]; });
  saveDB(); res.json(r);
});
app.delete('/api/refractive/:id', (req, res) => {
  const i = db.refractiveRecords.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '记录不存在' });
  db.refractiveRecords.splice(i, 1); saveDB(); res.json({ ok: true });
});

/* ---------------- P1-M6: RFM 分层 + 沉睡唤醒 ---------------- */
function rfmScores(ps, today) {
  let lastDate = '', total = 0;
  for (const p of ps) { total += Number(p.amount || 0); if ((p.date || '') > lastDate) lastDate = p.date || ''; }
  const F = ps.length;
  const since = lastDate ? diffDays(lastDate, today) : null;
  const R = since == null ? 1 : since <= 90 ? 5 : since <= 180 ? 4 : since <= 365 ? 3 : since <= 730 ? 2 : 1;
  const Fs = F >= 4 ? 5 : F === 3 ? 4 : F === 2 ? 3 : F === 1 ? 2 : 1;
  const M = total >= 5000 ? 5 : total >= 3000 ? 4 : total >= 1500 ? 3 : total >= 500 ? 2 : 1;
  return { R, F: Fs, M, since, total, orderCount: F, lastDate };
}
function rfmSegment(s) {
  if (!s.orderCount) return '潜在';
  const highR = s.R >= 4, highF = s.F >= 3, highM = s.M >= 3;
  if (highR && highF && highM) return '重要价值';
  if (highR && !highF && highM) return '重要发展';
  if (!highR && highF && highM) return '重要保持';
  if (!highR && !highF && highM) return '重要挽留';
  if (highR && highF && !highM) return '一般价值';
  if (s.R <= 2 && s.F <= 2 && !highM) return '流失预警';
  return '一般';
}
app.get('/api/rfm-stats', (req, res) => {
  const ck = _cacheEpoch + '|' + todayISO();
  if (_rfmCache && _rfmKey === ck) return res.json(_rfmCache);
  const byCust = groupPrescriptionsByCustomer();
  const today = todayISO();
  const segDist = {}; const winback = [];
  for (const c of db.customers) {
    const s = rfmScores(byCust.get(c.id) || [], today);
    const seg = rfmSegment(s);
    segDist[seg] = (segDist[seg] || 0) + 1;
    if (seg === '重要挽留' || seg === '重要保持') winback.push({ customerId: c.id, name: c.name, phone: c.phone, segment: seg, total: s.total, orderCount: s.orderCount, since: s.since, lastDate: s.lastDate });
  }
  winback.sort((a, b) => b.total - a.total);
  const result = { segDist, winback: winback.slice(0, 200), winbackTotal: winback.length };
  _rfmCache = result; _rfmKey = ck;
  res.json(result);
});
let _rfmCache = null, _rfmKey = '';

/* ---------------- P1-M4: 家庭账户（基础层：分组/绑定/隐私化概览；共享积分池待财务口径确认） ---------------- */
app.get('/api/families', (req, res) => {
  const list = db.families.map((f) => ({ ...f, memberCount: db.customers.filter((c) => c.familyId === f.id).length }));
  res.json(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
});
app.post('/api/families', (req, res) => {
  const b = req.body || {};
  const f = { id: uid('fam_'), name: b.name || '家庭', remark: b.remark || '', createdAt: new Date().toISOString() };
  db.families.push(f); saveDB(); res.json(f);
});
app.get('/api/families/:id', (req, res) => {
  const f = db.families.find((x) => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: '家庭不存在' });
  const today = todayISO(); const th = lifecycleThresholds();
  const byCust = groupPrescriptionsByCustomer();
  const allSug = followupSuggestions();
  // 隐私化概览：只提示"该查没查"，不展示具体诊断/数值（院方分层授权底线）
  const members = db.customers.filter((c) => c.familyId === f.id).map((c) => {
    const stage = computeStage(byCust.get(c.id) || [], today, th);
    const dueReview = allSug.filter((s) => s.customerId === c.id && (s.overdue || s.daysDiff <= 0)).length;
    return { id: c.id, name: c.name, familyRole: c.familyRole || '', relationNote: c.relationNote || '', age: c.age, lifecycleStage: stage, dueReview, hasPending: dueReview > 0 };
  });
  res.json({ ...f, members });
});
app.post('/api/families/:id/members', (req, res) => {
  const f = db.families.find((x) => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: '家庭不存在' });
  const b = req.body || {};
  const c = customerById(b.customerId);
  if (!c) return res.status(404).json({ error: '客户不存在' });
  c.familyId = f.id; c.familyRole = b.familyRole || ''; c.relationNote = b.relationNote || '';
  saveDB(); res.json({ ok: true });
});
app.delete('/api/families/:id/members/:customerId', (req, res) => {
  const c = customerById(req.params.customerId);
  if (c && c.familyId === req.params.id) { c.familyId = ''; c.familyRole = ''; c.relationNote = ''; saveDB(); }
  res.json({ ok: true });
});
app.delete('/api/families/:id', (req, res) => {
  const i = db.families.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '家庭不存在' });
  db.customers.forEach((c) => { if (c.familyId === req.params.id) { c.familyId = ''; c.familyRole = ''; c.relationNote = ''; } });
  db.families.splice(i, 1); saveDB(); res.json({ ok: true });
});

/* ---------------- 会员管理 ---------------- */
if (!Array.isArray(db.members)) db.members = [];
if (!Array.isArray(db.memberCards)) db.memberCards = [];
if (!Array.isArray(db.memberTxns)) db.memberTxns = [];
if (!db.settings.memberLevels) db.settings.memberLevels = DEFAULT_MEMBER_LEVELS;
if (db.settings.pointsPerYuan == null) db.settings.pointsPerYuan = 1;
if (db.settings.pointsPerRecharge == null) db.settings.pointsPerRecharge = 1;
saveDB();

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function memberLevelsCfg() { return db.settings.memberLevels || DEFAULT_MEMBER_LEVELS; }
function calcLevelBySpend(totalSpend) {
  const lv = memberLevelsCfg().slice().sort((a, b) => (b.threshold || 0) - (a.threshold || 0));
  for (const l of lv) if ((totalSpend || 0) >= (l.threshold || 0)) return l;
  return memberLevelsCfg()[0] || { name: '普通会员', discount: 1, benefit: '' };
}
function memberById(id) { return db.members.find((m) => m.id === id); }
function cardsOf(id) { return db.memberCards.filter((c) => c.memberId === id); }
function txnsOf(id) { return db.memberTxns.filter((t) => t.memberId === id); }
function applyLevel(m) {
  if (m.levelManual) return;
  const lv = calcLevelBySpend(m.totalSpend || 0);
  m.level = lv.name; m.discount = Number(lv.discount || 1); m.benefit = lv.benefit || '';
}
function enrichMember(m) {
  const lv = calcLevelBySpend(m.totalSpend || 0);
  const cards = cardsOf(m.id);
  return {
    ...m,
    levelName: m.level || lv.name,
    discount: m.levelManual && m.discount != null ? Number(m.discount) : Number(lv.discount || 1),
    benefit: m.levelManual ? (m.benefit || '') : (lv.benefit || ''),
    cardCount: cards.length,
    activeCards: cards.filter((c) => c.usedTimes < c.totalTimes).length,
    cashBalance: round2((m.balance || 0) - (m.giftBalance || 0)),
  };
}
function memberTxn(memberId, o) {
  const m = memberById(memberId); if (!m) return null;
  const amt = round2(o.amount || 0);
  if (amt) m.balance = Math.max(0, round2((m.balance || 0) + amt));
  m.points = Math.round((m.points || 0) + (o.points || 0));
  const t = { id: uid('t_'), memberId, type: o.type, amount: amt, points: o.points || 0, cardId: o.cardId || '', refId: o.refId || '', remark: o.remark || '', activityId: o.activityId || '', balanceAfter: m.balance, date: todayISO(), createdAt: new Date().toISOString() };
  db.memberTxns.push(t); return t;
}
function nextCardNo() { return 'M' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90 + 10)); }

app.get('/api/members', (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const lv = req.query.level || '';
  let list = db.members.map(enrichMember);
  if (q) list = list.filter((m) => [m.cardNo, m.name, m.phone, m.source].join(' ').toLowerCase().includes(q));
  if (lv) list = list.filter((m) => m.levelName === lv);
  list.sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
  res.json(list);
});
app.get('/api/members/:id', (req, res) => {
  const m = memberById(req.params.id); if (!m) return res.status(404).json({ error: '会员不存在' });
  const ps = db.prescriptions.filter((p) => p.memberId === m.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json({ ...enrichMember(m), cards: cardsOf(m.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), txns: txnsOf(m.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), prescriptions: ps.map(enrichPrescription) });
});
app.post('/api/members', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: '姓名必填' });
  let customerId = b.customerId || '';
  if (!customerId && b.phone) { const c = db.customers.find((x) => normalizePhone(x.phone) === normalizePhone(b.phone)); if (c) customerId = c.id; }
  if (!customerId) {
    const c = { id: uid('c_'), name: b.name, gender: b.gender || '', age: b.age || '', phone: b.phone || '', school: '', source: b.source || '', sourceDetail: '', remark: '', createdAt: new Date().toISOString() };
    db.customers.push(c); customerId = c.id;
  }
  const m = {
    id: uid('m_'), cardNo: b.cardNo || nextCardNo(), customerId, name: b.name, phone: b.phone || '',
    gender: b.gender || '', age: b.age || '', birthday: b.birthday || '', source: b.source || '',
    balance: 0, giftBalance: 0, points: 0, totalSpend: 0, totalRecharge: 0, orderCount: 0,
    levelManual: false, status: '正常', remark: b.remark || '', createdAt: new Date().toISOString(),
  };
  db.members.push(m); saveDB(); res.json(enrichMember(m));
});
app.put('/api/members/:id', (req, res) => {
  const m = memberById(req.params.id); if (!m) return res.status(404).json({ error: '会员不存在' });
  const b = req.body || {};
  ['name', 'phone', 'gender', 'age', 'birthday', 'source', 'status', 'remark', 'cardNo'].forEach((k) => { if (b[k] !== undefined) m[k] = b[k]; });
  if (b.levelManual !== undefined) { m.levelManual = !!b.levelManual; if (m.levelManual) { m.level = b.level || m.level; m.discount = b.discount != null ? Number(b.discount) : m.discount; m.benefit = b.benefit || m.benefit; } else applyLevel(m); }
  saveDB(); res.json(enrichMember(m));
});
app.delete('/api/members/:id', (req, res) => {
  const i = db.members.findIndex((m) => m.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '会员不存在' });
  db.members.splice(i, 1);
  db.memberCards = db.memberCards.filter((c) => c.customerId !== req.params.id && c.memberId !== req.params.id);
  db.memberTxns = db.memberTxns.filter((t) => t.memberId !== req.params.id);
  saveDB(); res.json({ ok: true });
});
app.post('/api/members/:id/recharge', (req, res) => {
  const m = memberById(req.params.id); if (!m) return res.status(404).json({ error: '会员不存在' });
  const b = req.body || {};
  const pay = round2(b.amount || 0); const gift = round2(b.gift || 0);
  if (pay <= 0 && gift <= 0) return res.status(400).json({ error: '请填写充值金额' });
  if (pay > 0) { memberTxn(m.id, { type: '充值', amount: pay, points: Math.floor(pay * (db.settings.pointsPerRecharge || 1)), remark: b.remark || '会员充值' }); m.totalRecharge = round2((m.totalRecharge || 0) + pay); }
  if (gift > 0) { memberTxn(m.id, { type: '赠送', amount: gift, points: 0, remark: b.remark || '充值赠送' }); m.giftBalance = round2((m.giftBalance || 0) + gift); }
  // 活动：充值赠送
  const act = activeActivities('充值赠送').find((a) => pay >= (a.threshold || 0) && (!a.memberLevel || a.memberLevel === m.level));
  if (act && (act.giftAmount || 0) > 0) {
    memberTxn(m.id, { type: '赠送', amount: act.giftAmount, points: 0, activityId: act.id, remark: '活动赠送 · ' + act.name });
    m.giftBalance = round2((m.giftBalance || 0) + act.giftAmount);
  }
  applyLevel(m); saveDB(); res.json(enrichMember(m));
});
app.post('/api/members/:id/cards', (req, res) => {
  const m = memberById(req.params.id); if (!m) return res.status(404).json({ error: '会员不存在' });
  const b = req.body || {};
  const price = round2(b.price || 0);
  const card = { id: uid('c_'), memberId: m.id, type: b.type || '框架卡', name: b.name || b.type || '框架卡', totalTimes: Number(b.totalTimes || 1), usedTimes: 0, price, expireDate: b.expireDate || '', status: '未用', createdAt: new Date().toISOString() };
  db.memberCards.push(card);
  if (price > 0) {
    // 售卡金额单独收取，不从储值余额扣；余额仅用于消费抵扣
    memberTxn(m.id, { type: '购卡', amount: 0, points: Math.floor(price * (db.settings.pointsPerYuan || 1)), cardId: card.id, remark: '购买 ' + card.name + ' ¥' + price });
    m.totalSpend = round2((m.totalSpend || 0) + price); m.orderCount = (m.orderCount || 0) + 1;
  }
  applyLevel(m); saveDB(); res.json(card);
});
app.post('/api/members/:id/cards/:cardId/use', (req, res) => {
  const m = memberById(req.params.id); if (!m) return res.status(404).json({ error: '会员不存在' });
  const card = db.memberCards.find((c) => c.id === req.params.cardId && c.memberId === m.id);
  if (!card) return res.status(404).json({ error: '卡项不存在' });
  if (card.usedTimes >= card.totalTimes) return res.status(400).json({ error: '该卡项已用完' });
  card.usedTimes += 1;
  card.status = card.usedTimes >= card.totalTimes ? '已用完' : '使用中';
  memberTxn(m.id, { type: '核销', amount: 0, points: 0, cardId: card.id, refId: (req.body || {}).refId || '', remark: '核销 ' + card.name });
  saveDB(); res.json(card);
});
app.get('/api/members-report', (req, res) => {
  const members = db.members.map(enrichMember);
  const today = todayISO(); const horizon = addDays(today, 30);
  const lvMap = {}; members.forEach((m) => { lvMap[m.levelName] = (lvMap[m.levelName] || 0) + 1; });
  const levelDist = Object.entries(lvMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const expiring = db.memberCards.filter((c) => c.expireDate && c.expireDate <= horizon && c.usedTimes < c.totalTimes)
    .map((c) => ({ ...c, memberName: (memberById(c.memberId) || {}).name || '', daysLeft: diffDays(today, c.expireDate) })).sort((a, b) => a.dueDate - b.dueDate || a.expireDate.localeCompare(b.expireDate));
  const sleeping = members.filter((m) => {
    const ps = db.prescriptions.filter((p) => p.memberId === m.id);
    const last = ps.map((p) => p.date).sort().pop() || '';
    return (m.orderCount || 0) > 0 && last && diffDays(last, today) > 180;
  }).map((m) => ({ ...m, lastDate: db.prescriptions.filter((p) => p.memberId === m.id).map((p) => p.date).sort().pop() || '' }));
  const totalAmount = db.prescriptions.reduce((s, p) => s + Number(p.amount || 0), 0);
  const memberAmount = db.prescriptions.filter((p) => p.memberId).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pointsTop = members.slice().sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10).map((m) => ({ name: m.name, points: m.points || 0, level: m.levelName }));
  res.json({
    totalMembers: members.length,
    totalBalance: round2(members.reduce((s, m) => s + (m.balance || 0), 0)),
    cashBalance: round2(members.reduce((s, m) => s + (m.cashBalance || 0), 0)),
    giftTotal: round2(members.reduce((s, m) => s + (m.giftBalance || 0), 0)),
    levelDist, expiring, sleeping, pointsTop,
    totalAmount: round2(totalAmount), memberAmount: round2(memberAmount),
    memberRatio: totalAmount ? memberAmount / totalAmount : 0,
  });
});
app.get('/api/member-levels', (req, res) => res.json(memberLevelsCfg()));
app.put('/api/member-levels', (req, res) => {
  const b = req.body || {};
  if (Array.isArray(b.levels) && b.levels.length) db.settings.memberLevels = b.levels;
  if (b.pointsPerYuan != null) db.settings.pointsPerYuan = Number(b.pointsPerYuan);
  if (b.pointsPerRecharge != null) db.settings.pointsPerRecharge = Number(b.pointsPerRecharge);
  db.members.forEach(applyLevel); saveDB(); res.json({ levels: memberLevelsCfg(), pointsPerYuan: db.settings.pointsPerYuan, pointsPerRecharge: db.settings.pointsPerRecharge });
});

/* ---------------- 营销活动 / 优惠券 ---------------- */
const COUPON_TYPES = ['满减', '折扣', '现金'];
const ACTIVITY_TYPES = ['充值赠送', '配镜满减', '双倍积分', '老带新'];
if (!Array.isArray(db.coupons)) db.coupons = [];
if (!Array.isArray(db.couponGrants)) db.couponGrants = [];
if (!Array.isArray(db.activities)) db.activities = [];
saveDB();

function couponById(id) { return db.coupons.find((c) => c.id === id); }
function activeActivities(type) {
  const t = todayISO();
  return db.activities.filter((a) => a.type === type && a.status === '进行中' && (!a.startDate || a.startDate <= t) && (!a.endDate || a.endDate >= t));
}
/** 计算某会员在指定消费场景下可用的券（按优惠力度从大到小） */
function applicableCoupons(memberId, amount, category) {
  const t = todayISO();
  const out = [];
  for (const g of db.couponGrants) {
    if (g.memberId !== memberId || g.status !== '未使用') continue;
    if (g.expireDate && g.expireDate < t) continue;
    const c = couponById(g.couponId);
    if (!c || c.status !== '启用') continue;
    if (c.startDate && c.startDate > t) continue;
    if (c.endDate && c.endDate < t) continue;
    if (c.scopeCategory && c.scopeCategory !== category) continue;
    if (amount < (c.threshold || 0)) continue;
    const discount = c.type === '折扣' ? round2(amount * (1 - Number(c.faceValue || 1))) : Math.min(round2(c.faceValue || 0), amount);
    if (discount <= 0) continue;
    out.push({ ...g, coupon: c, discount });
  }
  return out.sort((a, b) => b.discount - a.discount);
}
app.get('/api/coupons', (req, res) => {
  const list = db.coupons.map((c) => {
    const granted = db.couponGrants.filter((g) => g.couponId === c.id);
    return { ...c, grantedCount: granted.length, usedCount: granted.filter((g) => g.status === '已使用').length };
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list);
});
app.post('/api/coupons', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: '券名称必填' });
  const c = {
    id: uid('cp_'), name: b.name, type: b.type || '满减',
    faceValue: Number(b.faceValue || 0), threshold: Number(b.threshold || 0),
    scopeCategory: b.scopeCategory || '', validDays: Number(b.validDays || 90),
    totalQty: Number(b.totalQty || 0), startDate: b.startDate || '', endDate: b.endDate || '',
    status: b.status || '启用', remark: b.remark || '', createdAt: new Date().toISOString(),
  };
  db.coupons.push(c); saveDB(); res.json(c);
});
app.put('/api/coupons/:id', (req, res) => {
  const c = couponById(req.params.id); if (!c) return res.status(404).json({ error: '券不存在' });
  const b = req.body || {};
  Object.assign(c, { name: b.name ?? c.name, type: b.type ?? c.type, faceValue: b.faceValue != null ? Number(b.faceValue) : c.faceValue, threshold: b.threshold != null ? Number(b.threshold) : c.threshold, scopeCategory: b.scopeCategory ?? c.scopeCategory, validDays: b.validDays != null ? Number(b.validDays) : c.validDays, totalQty: b.totalQty != null ? Number(b.totalQty) : c.totalQty, startDate: b.startDate ?? c.startDate, endDate: b.endDate ?? c.endDate, status: b.status ?? c.status, remark: b.remark ?? c.remark });
  saveDB(); res.json(c);
});
app.delete('/api/coupons/:id', (req, res) => {
  const i = db.coupons.findIndex((c) => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '券不存在' });
  db.coupons.splice(i, 1);
  db.couponGrants = db.couponGrants.filter((g) => g.couponId !== req.params.id);
  saveDB(); res.json({ ok: true });
});
app.post('/api/coupons/:id/grant', (req, res) => {
  const c = couponById(req.params.id); if (!c) return res.status(404).json({ error: '券不存在' });
  const b = req.body || {};
  const ids = Array.isArray(b.memberIds) ? b.memberIds : (b.memberId ? [b.memberId] : []);
  if (!ids.length) return res.status(400).json({ error: '请选择会员' });
  const granted = [];
  for (const mid of ids) {
    const m = memberById(mid); if (!m) continue;
    if (c.totalQty && db.couponGrants.filter((g) => g.couponId === c.id).length >= c.totalQty) break;
    const g = { id: uid('g_'), couponId: c.id, memberId: mid, status: '未使用', expireDate: addDays(todayISO(), c.validDays || 90), grantedAt: todayISO(), usedAt: '' };
    db.couponGrants.push(g); granted.push(g);
  }
  saveDB(); res.json({ ok: true, count: granted.length, grants: granted });
});
app.get('/api/members/:id/coupons', (req, res) => {
  const t = todayISO();
  const list = db.couponGrants.filter((g) => g.memberId === req.params.id).map((g) => {
    const c = couponById(g.couponId) || {};
    return { ...g, couponName: c.name, type: c.type, faceValue: c.faceValue, threshold: c.threshold, scopeCategory: c.scopeCategory, expired: !!(g.expireDate && g.expireDate < t && g.status === '未使用') };
  });
  res.json(list);
});
app.post('/api/coupon-grants/:id/use', (req, res) => {
  const g = db.couponGrants.find((x) => x.id === req.params.id);
  if (!g) return res.status(404).json({ error: '券不存在' });
  if (g.status !== '未使用') return res.status(400).json({ error: '该券已使用或已过期' });
  g.status = '已使用'; g.usedAt = todayISO();
  saveDB(); res.json(g);
});

app.get('/api/activities', (req, res) => {
  const list = db.activities.map((a) => {
    const used = db.memberTxns.filter((t) => t.activityId === a.id).length;
    return { ...a, usedCount: used };
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list);
});
app.post('/api/activities', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: '活动名称必填' });
  const a = {
    id: uid('a_'), name: b.name, type: b.type || '充值赠送',
    threshold: Number(b.threshold || 0), reward: Number(b.reward || 0), giftAmount: Number(b.giftAmount || 0),
    multiplier: Number(b.multiplier || 2), memberLevel: b.memberLevel || '', scopeCategory: b.scopeCategory || '',
    startDate: b.startDate || '', endDate: b.endDate || '', status: b.status || '进行中', remark: b.remark || '',
    createdAt: new Date().toISOString(),
  };
  db.activities.push(a); saveDB(); res.json(a);
});
app.put('/api/activities/:id', (req, res) => {
  const a = db.activities.find((x) => x.id === req.params.id); if (!a) return res.status(404).json({ error: '活动不存在' });
  const b = req.body || {};
  ['name', 'type', 'status', 'memberLevel', 'scopeCategory', 'startDate', 'endDate', 'remark'].forEach((k) => { if (b[k] !== undefined) a[k] = b[k]; });
  ['threshold', 'reward', 'giftAmount', 'multiplier'].forEach((k) => { if (b[k] !== undefined) a[k] = Number(b[k]); });
  saveDB(); res.json(a);
});
app.delete('/api/activities/:id', (req, res) => {
  const i = db.activities.findIndex((a) => a.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '活动不存在' });
  db.activities.splice(i, 1); saveDB(); res.json({ ok: true });
});
app.get('/api/marketing/stats', (req, res) => {
  const t = todayISO();
  const couponStats = db.coupons.map((c) => {
    const granted = db.couponGrants.filter((g) => g.couponId === c.id);
    const used = granted.filter((g) => g.status === '已使用');
    return { name: c.name, type: c.type, faceValue: c.faceValue, granted: granted.length, used: used.length, useRate: granted.length ? Math.round(used.length / granted.length * 100) : 0 };
  }).sort((a, b) => b.used - a.used);
  const activityStats = db.activities.map((a) => {
    const txns = db.memberTxns.filter((t) => t.activityId === a.id);
    const amount = txns.filter((t) => t.type === '消费').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const gift = txns.filter((t) => t.type === '赠送').reduce((s, t) => s + (t.amount || 0), 0);
    return { id: a.id, name: a.name, type: a.type, status: a.status, usedCount: txns.length, amount: round2(amount), giftCost: round2(gift) };
  });
  const active = db.activities.filter((a) => a.status === '进行中' && (!a.startDate || a.startDate <= t) && (!a.endDate || a.endDate >= t));
  res.json({
    couponStats, activityStats, activeCount: active.length,
    totalGranted: db.couponGrants.length, totalUsed: db.couponGrants.filter((g) => g.status === '已使用').length,
    expiringCoupons: db.couponGrants.filter((g) => g.status === '未使用' && g.expireDate && g.expireDate <= addDays(t, 15)).length,
  });
});

/* ---------------- API ---------------- */
app.get('/api/bootstrap', (req, res) => {
  res.json({ settings: publicSettings(), lanUrls: lanUrls(), stats: stats(), recent: db.prescriptions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8).map(enrichPrescription) });
});

app.get('/api/stats', (req, res) => res.json(stats()));

app.get('/api/customers', (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const stageFilter = req.query.stage || '';
  const rfmFilter = req.query.rfm || '';
  const byCust = groupPrescriptionsByCustomer();
  const today = todayISO(); const th = lifecycleThresholds();
  let list = db.customers
    .filter((c) => !q || [c.name, c.phone, c.school, c.source].join(' ').toLowerCase().includes(q))
    .map((c) => {
      const ps = byCust.get(c.id) || [];
      let totalAmount = 0, lastDate = '';
      for (const p of ps) { totalAmount += Number(p.amount || 0); if ((p.date || '') > lastDate) lastDate = p.date || ''; }
      return { ...c, orderCount: ps.length, totalAmount, lastDate, _ps: ps };
    });
  if (stageFilter) list = list.map((c) => ({ ...c, lifecycleStage: computeStage(c._ps, today, th) })).filter((c) => c.lifecycleStage === stageFilter);
  if (rfmFilter) list = list.map((c) => ({ ...c, _rfmSeg: rfmSegment(rfmScores(c._ps, today)) })).filter((c) => c._rfmSeg === rfmFilter);
  list.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 0, 0), 500);
  const withStage = ({ _ps, _rfmSeg, ...c }) => { const s = rfmScores(_ps, today); return { ...c, lifecycleStage: c.lifecycleStage || computeStage(_ps, today, th), rfm: { R: s.R, F: s.F, M: s.M, segment: _rfmSeg || rfmSegment(s) } }; };
  if (!pageSize) return res.json(list.map(withStage));
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  res.json({ items: list.slice((page - 1) * pageSize, page * pageSize).map(withStage), total: list.length, page, pageSize });
});

app.get('/api/customers/:id', (req, res) => {
  const c = customerById(req.params.id);
  if (!c) return res.status(404).json({ error: '客户不存在' });
  const ps = db.prescriptions.filter((p) => p.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const s = rfmScores(ps, todayISO());
  res.json({ ...c, lifecycleStage: computeStage(ps, todayISO(), lifecycleThresholds()), rfm: { R: s.R, F: s.F, M: s.M, segment: rfmSegment(s) }, prescriptions: ps });
});

app.post('/api/customers', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: '姓名必填' });
  const c = {
    id: uid('c_'), name: b.name, gender: b.gender || '', age: b.age || '', phone: b.phone || '',
    school: b.school || '', source: b.source || '', sourceDetail: b.sourceDetail || '', remark: b.remark || '',
    createdAt: new Date().toISOString(),
  };
  db.customers.push(c); saveDB(); res.json(c);
});

app.put('/api/customers/:id', (req, res) => {
  const c = customerById(req.params.id);
  if (!c) return res.status(404).json({ error: '客户不存在' });
  const b = req.body || {};
  Object.assign(c, {
    name: b.name ?? c.name, gender: b.gender ?? c.gender, age: b.age ?? c.age, phone: b.phone ?? c.phone,
    school: b.school ?? c.school, source: b.source ?? c.source, sourceDetail: b.sourceDetail ?? c.sourceDetail, remark: b.remark ?? c.remark,
  });
  saveDB(); res.json(c);
});

app.delete('/api/customers/:id', (req, res) => {
  const idx = db.customers.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '客户不存在' });
  const has = db.prescriptions.some((p) => p.customerId === req.params.id);
  if (has) return res.status(400).json({ error: '该客户还有配镜记录，请先删除配镜记录' });
  db.customers.splice(idx, 1); saveDB(); res.json({ ok: true });
});

/* 批量删除客户：仍有配镜记录的客户跳过（与单条删除规则一致） */
app.post('/api/customers/batch-delete', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: '请先勾选要删除的客户' });
  const set = new Set(ids);
  const hasOrder = new Set(db.prescriptions.map((p) => p.customerId));
  const before = db.customers.length;
  db.customers = db.customers.filter((c) => !set.has(c.id) || hasOrder.has(c.id));
  const deleted = before - db.customers.length;
  saveDB(); res.json({ ok: true, deleted, skipped: ids.length - deleted });
});

app.get('/api/prescriptions', (req, res) => {
  const { from, to, source, category, sales, search } = req.query;
  const q = String(search || '').trim().toLowerCase();
  const cmap = buildCustMap();
  let list = db.prescriptions.map((p) => enrichPrescription(p, cmap));
  if (from) list = list.filter((p) => p.date >= from);
  if (to) list = list.filter((p) => p.date <= to);
  if (source) list = list.filter((p) => p.source === source);
  if (category) list = list.filter((p) => p.category === category);
  if (sales) list = list.filter((p) => p.sales === sales);
  if (q) list = list.filter((p) => [p.customerName, p.phone, p.frame, p.model, p.lens, p.sales, p.doctor].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  paginate(list, req, res);
});

app.post('/api/prescriptions', (req, res) => {
  const b = req.body || {};
  if (!b.customerId && !b.customerName) return res.status(400).json({ error: '请选择客户或填写客户姓名' });
  let customerId = b.customerId;
  if (!customerId) {
    const c = {
      id: uid('c_'), name: b.customerName, gender: b.gender || '', age: b.age || '', phone: b.phone || '',
      school: b.school || '', source: b.source || '', sourceDetail: b.sourceDetail || '', remark: '',
      createdAt: new Date().toISOString(),
    };
    db.customers.push(c); customerId = c.id;
  }
  const amount = Number(b.amount || 0);
  const p = {
    id: uid('p_'), customerId, date: b.date || todayISO(), amount,
    doctor: b.doctor || '', sales: b.sales || '', maker: b.maker || '', company: b.company || '',
    category: b.category || '', frame: b.frame || '', model: b.model || '', lens: b.lens || '',
    sphR: b.sphR || '', sphL: b.sphL || '', pd: b.pd || '', rpd: b.rpd || '', lpd: b.lpd || '',
    phR: b.phR || '', phL: b.phL || '',
    productType: b.productType || '', discardCycle: b.discardCycle || '',
    remark: b.remark || '', payMethod: b.payMethod || '现金', memberId: b.memberId || '',
    createdAt: new Date().toISOString(),
  };
  db.prescriptions.push(p);

  // ---- 会员联动：优惠券 / 活动 / 累计消费 / 积分 / 储值扣款 / 次卡核销 ----
  const memberId = b.memberId || (db.members.find((m) => m.customerId === customerId) || {}).id;
  let discountTotal = 0; const applied = [];
  if (memberId) {
    const m = memberById(memberId);
    if (m) {
      p.memberId = m.id;
      // 1) 优惠券
      if (b.couponGrantId) {
        const hit = applicableCoupons(memberId, amount, b.category || '').find((x) => x.id === b.couponGrantId);
        const g = db.couponGrants.find((x) => x.id === b.couponGrantId && x.memberId === memberId);
        if (hit && g) {
          discountTotal = round2(discountTotal + hit.discount);
          applied.push('券 ' + hit.coupon.name + ' -¥' + hit.discount);
          g.status = '已使用'; g.usedAt = todayISO();
        }
      }
      // 2) 配镜满减活动
      const act = activeActivities('配镜满减').find((a) => amount >= (a.threshold || 0) && (!a.scopeCategory || a.scopeCategory === (b.category || '')) && (!a.memberLevel || a.memberLevel === m.level));
      if (act && (act.reward || 0) > 0) {
        discountTotal = round2(discountTotal + act.reward);
        applied.push('活动 ' + act.name + ' -¥' + act.reward);
        p.activityId = act.id;
      }
      discountTotal = Math.min(discountTotal, amount);
      const payAmount = round2(amount - discountTotal);
      p.discount = discountTotal; p.payAmount = payAmount; p.discountNote = applied.join('；');

      // 3) 积分（含双倍积分活动）
      const dbl = activeActivities('双倍积分').find((a) => payAmount >= (a.threshold || 0));
      const mul = dbl ? (dbl.multiplier || 2) : 1;
      const earned = Math.floor(payAmount * (db.settings.pointsPerYuan || 1) * mul);
      if (dbl) applied.push('双倍积分 x' + mul);

      // 4) 储值扣款（不超过实收与余额）
      const useBalance = Math.max(0, Math.min(round2(b.useBalance || 0), m.balance || 0, payAmount));
      memberTxn(m.id, { type: '消费', amount: -useBalance, points: earned, refId: p.id, activityId: p.activityId, remark: '配镜消费 ¥' + payAmount + (discountTotal ? '（优惠 ¥' + discountTotal + '）' : '') });
      m.totalSpend = round2((m.totalSpend || 0) + payAmount);
      m.orderCount = (m.orderCount || 0) + 1;
      // 5) 次卡核销
      if (b.useCardId) {
        const card = db.memberCards.find((c) => c.id === b.useCardId && c.memberId === m.id);
        if (card && card.usedTimes < card.totalTimes) {
          card.usedTimes += 1;
          card.status = card.usedTimes >= card.totalTimes ? '已用完' : '使用中';
          memberTxn(m.id, { type: '核销', amount: 0, points: 0, cardId: card.id, refId: p.id, remark: '核销 ' + card.name });
        }
      }
      applyLevel(m);
    }
  }
  if (p.payAmount == null) { p.discount = 0; p.payAmount = amount; }
  saveDB(); res.json(enrichPrescription(p));
});

app.put('/api/prescriptions/:id', (req, res) => {
  const p = db.prescriptions.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '记录不存在' });
  const b = req.body || {};
  ['date', 'amount', 'doctor', 'sales', 'maker', 'company', 'category', 'frame', 'model', 'lens', 'sphR', 'sphL', 'pd', 'rpd', 'lpd', 'phR', 'phL', 'productType', 'discardCycle', 'remark'].forEach((k) => {
    if (b[k] !== undefined) p[k] = k === 'amount' ? Number(b[k] || 0) : b[k];
  });
  saveDB(); res.json(enrichPrescription(p));
});

app.delete('/api/prescriptions/:id', (req, res) => {
  const idx = db.prescriptions.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '记录不存在' });
  db.prescriptions.splice(idx, 1); saveDB(); res.json({ ok: true });
});

/* 批量删除配镜记录（与单条删除一致：不回滚会员联动，删前请确认） */
app.post('/api/prescriptions/batch-delete', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: '请先勾选要删除的记录' });
  const set = new Set(ids);
  const before = db.prescriptions.length;
  db.prescriptions = db.prescriptions.filter((p) => !set.has(p.id));
  saveDB(); res.json({ ok: true, deleted: before - db.prescriptions.length });
});

app.get('/api/staff', (req, res) => res.json(db.staff));
app.post('/api/staff', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: '姓名必填' });
  const s = { id: uid('s_'), name: b.name, role: b.role || '销售', phone: b.phone || '', active: b.active !== false };
  db.staff.push(s); saveDB(); res.json(s);
});
app.put('/api/staff/:id', (req, res) => {
  const s = db.staff.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: '员工不存在' });
  Object.assign(s, req.body || {}); saveDB(); res.json(s);
});
app.delete('/api/staff/:id', (req, res) => {
  const idx = db.staff.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '员工不存在' });
  db.staff.splice(idx, 1); saveDB(); res.json({ ok: true });
});

app.put('/api/settings', (req, res) => {
  const b = req.body || {};
  const { auth, ...safe } = b;
  db.settings = { ...db.settings, ...safe }; saveDB(); res.json(publicSettings());
});

/* ---------------- Excel 导入导出 ---------------- */
const COLUMNS = ['备注', '日期', '姓名', '性别', '年龄', '电话', '学校', '来源', '来源明细', '金额', '医生', '销售', '制作', '公司', '分类方式', '框/产品', '型号', '片', '度数R', '度数L', '瞳距', 'RPD', 'LPD', '瞳高R', '瞳高L', '产品类型', '抛弃周期'];

function excelDate(v) {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000) return serialToDate(v);
  const s = String(v || '').trim();
  if (!s) return todayISO();
  const m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return todayISO();
}
/** Excel 序列号 -> YYYY-MM-DD（1900 日期系统） */
function serialToDate(n) {
  const ms = Math.round((Number(n) - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return todayISO();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** 单元格值 -> 纯文本（处理日期、富文本、公式、链接） */
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'object') {
    if (v.error) return '';
    if (v.result !== undefined) return cellText(v.result);
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.hyperlink) return cellText(v.text || v.hyperlink);
    if (v.text !== undefined) return String(v.text);
    return '';
  }
  return String(v);
}
/** 'YYYY-MM-DD' -> UTC Date（避免时区偏移） */
function toUTCDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
/** 读取 Excel 首表为对象数组（首行表头） */
async function readExcelRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers = [];
  // 表头规范化：去掉换行/空格（原表常见「分类\n方式」「来源\n明细」「金额 」），避免列识别失败
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = cellText(cell.value).replace(/\s+/g, ''); });
  const maxCol = headers.length - 1;
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let any = false;
    for (let c = 1; c <= maxCol; c++) {
      const h = headers[c]; if (!h) continue;
      const raw = row.getCell(c).value;
      let val;
      if (h === '日期' && typeof raw === 'number') val = serialToDate(raw);
      else if (typeof raw === 'number') val = raw;
      else val = cellText(raw);
      obj[h] = val;
      if (val !== '' && val != null) any = true;
    }
    if (any) rows.push(obj);
  }
  return rows;
}
/** 生成 Excel 工作簿（首行表头 + 数据行） */
async function buildWorkbook(rows, sheetName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '配镜 CRM';
  const ws = wb.addWorksheet(sheetName || '配镜记录');
  ws.columns = COLUMNS.map((c) => ({ header: c, width: Math.max(10, c.length * 2 + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.alignment = { horizontal: 'center', vertical: 'middle' };
  head.height = 24;
  head.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
  const dateIdx = COLUMNS.indexOf('日期') + 1;
  const amountIdx = COLUMNS.indexOf('金额') + 1;
  ws.getColumn(dateIdx).numFmt = 'yyyy-mm-dd';
  ws.getColumn(amountIdx).numFmt = '¥#,##0.00';
  (rows || []).forEach((r) => {
    const vals = COLUMNS.map((c) => {
      let v = r[c];
      if (c === '日期') { const d = toUTCDate(v); return d || (v || ''); }
      if (c === '金额') return Number(v || 0);
      if (v === null || v === undefined) return '';
      return v;
    });
    const row = ws.addRow(vals);
    row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb;
}

app.post('/api/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择 Excel 文件' });
  try {
    const rows = await readExcelRows(req.file.buffer);
    if (!rows.length) return res.status(400).json({ error: 'Excel 中没有数据行' });

    let createdCustomers = 0;
    let createdOrders = 0;
    const errors = [];

    rows.forEach((row, i) => {
      const get = (name) => row[name] !== undefined ? row[name] : '';
      const name = String(get('姓名') || '').trim();
      if (!name) { errors.push(`第 ${i + 2} 行：姓名为空，已跳过`); return; }
      const phone = normalizePhone(get('电话'));
      const date = excelDate(get('日期'));
      const amount = Number(String(get('金额')).replace(/[^\d.-]/g, '')) || 0;

      let c = null;
      if (phone) c = db.customers.find((x) => normalizePhone(x.phone) === phone);
      if (!c) c = db.customers.find((x) => x.name === name && normalizePhone(x.phone) === phone && phone);
      if (!c) {
        c = {
          id: uid('c_'), name, gender: String(get('性别') || ''), age: get('年龄') || '', phone,
          school: String(get('学校') || ''), source: String(get('来源') || ''), sourceDetail: String(get('来源明细') || ''),
          remark: '', createdAt: new Date().toISOString(),
        };
        db.customers.push(c); createdCustomers++;
      } else {
        if (!c.school && get('学校')) c.school = String(get('学校'));
        if (!c.source && get('来源')) c.source = String(get('来源'));
      }

      // 验光数据：兼容单列「瞳高」、组合瞳距「RPD/LPD/瞳高」、RPD/LPD 列混入非数值
      let pd = String(get('瞳距') || ''), rpd = String(get('RPD') || ''), lpd = String(get('LPD') || '');
      let phR = String(get('瞳高R') || get('瞳高') || ''), phL = String(get('瞳高L') || '');
      const num = (s) => /^\d+(\.\d+)?$/.test(String(s).trim());
      if (pd.includes('/')) {
        const parts = pd.split('/').map((s) => s.trim()).filter(Boolean);
        if (parts.length === 3 && parts.every(num)) { if (!rpd) rpd = parts[0]; if (!lpd) lpd = parts[1]; if (!phR) phR = parts[2]; pd = ''; }
        else if (parts.length === 2 && parts.every(num)) { if (!rpd) rpd = parts[0]; if (!lpd) lpd = parts[1]; pd = ''; }
      }
      if (rpd && !num(rpd)) rpd = '';
      if (lpd && !num(lpd)) lpd = '';
      db.prescriptions.push({
        id: uid('p_'), customerId: c.id, date, amount,
        doctor: String(get('医生') || ''), sales: String(get('销售') || ''), maker: String(get('制作') || ''),
        company: String(get('公司') || ''), category: String(get('分类方式') || ''),
        frame: String(get('框/产品') || get('框') || ''), model: String(get('型号') || ''), lens: String(get('片') || ''),
        sphR: String(get('度数R') || ''), sphL: String(get('度数L') || ''),
        pd, rpd, lpd, phR, phL,
        productType: String(get('产品类型') || ''), discardCycle: String(get('抛弃周期') || ''),
        remark: String(get('备注') || ''), createdAt: new Date().toISOString(),
      });
      createdOrders++;
    });

    saveDB();
    res.json({ ok: true, rows: rows.length, createdCustomers, createdOrders, errors });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '导入失败：' + e.message });
  }
});

/* ---------------- 数据维护：备份 / 清空演示数据 ---------------- */
function localStamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

app.get('/api/backup', (req, res) => {
  try {
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('配镜CRM备份_' + localStamp() + '.json')}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(fs.readFileSync(DB_FILE));
  } catch (e) {
    res.status(500).json({ error: '备份失败：' + e.message });
  }
});

app.post('/api/admin/clear-demo', (req, res) => {
  try {
    const dir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `db-${localStamp()}.json`);
    fs.copyFileSync(DB_FILE, backup);
    const scope = (req.body && req.body.scope) === 'all' ? 'all' : 'business';
    db.customers = [];
    db.prescriptions = [];
    db.members = [];
    db.memberCards = [];
    db.memberTxns = [];
    db.couponGrants = [];
    db.followUps = [];
    if (scope === 'all') {
      db.staff = [];
      db.coupons = [];
      db.activities = [];
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    res.json({ ok: true, scope, backup: path.basename(backup), backupPath: backup });
  } catch (e) {
    console.error('清空失败', e);
    res.status(500).json({ error: '清空失败：' + e.message });
  }
});

app.get('/api/export', async (req, res) => {
  const cmap = buildCustMap();
  const list = db.prescriptions.map((p) => enrichPrescription(p, cmap)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const data = list.map((p) => ({
    '备注': p.remark || '', '日期': p.date || '', '姓名': p.customerName, '性别': p.gender, '年龄': p.age,
    '电话': p.phone, '学校': p.school, '来源': p.source, '来源明细': p.sourceDetail, '金额': p.amount,
    '医生': p.doctor, '销售': p.sales, '制作': p.maker, '公司': p.company, '分类方式': p.category,
    '框/产品': p.frame, '型号': p.model, '片': p.lens, '度数R': p.sphR, '度数L': p.sphL,
    '瞳距': p.pd, 'RPD': p.rpd, 'LPD': p.lpd, '瞳高R': p.phR || '', '瞳高L': p.phL || '',
    '产品类型': p.productType || '', '抛弃周期': p.discardCycle || '',
  }));
  try {
    const ws = await buildWorkbook(data, '配镜记录');
    const buf = await ws.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('配镜记录导出_' + todayISO() + '.xlsx')}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buf));
  } catch (e) { console.error('导出失败', e); res.status(500).json({ error: '导出失败：' + e.message }); }
});

app.get('/api/template', async (req, res) => {
  try {
    const ws = await buildWorkbook([], '配镜记录');
    const buf = await ws.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('配镜记录_导入模板.xlsx')}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buf));
  } catch (e) { console.error('模板生成失败', e); res.status(500).json({ error: '模板生成失败：' + e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  配镜 CRM 已启动：http://localhost:${PORT}\n`);
});
