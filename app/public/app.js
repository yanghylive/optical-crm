/* 配镜 CRM 前端 */
const state = {
  settings: { shopName: '明视眼镜', sources: [], categories: [], staffRoles: [] },
  lanUrls: [],
  stats: null,
  recent: [],
  customers: [],
  prescriptions: [],
  staff: [],
  members: [],
  memberReport: null,
  memberLevels: [],
  memberFilter: { search: '', level: '' },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = (n) => '¥' + Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const TOKEN_KEY = 'oc_token';
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);
const authUrl = (u) => u + (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(getToken());

async function api(url, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, getToken() ? { Authorization: 'Bearer ' + getToken() } : {});
  const res = await fetch(url, opts);
  if (res.status === 401) { clearToken(); showLogin(); throw new Error('未登录'); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || '请求失败');
  return data;
}

/* ---------------- 登录 / 改密码 ---------------- */
function showLogin(msg) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal narrow">
        <div class="modal-head"><div><div class="modal-title">登录 · 配镜客户管理</div><div class="modal-sub">请输入门店管理密码</div></div></div>
        <div class="modal-body">
          <div class="field"><label>密码</label><input class="input" id="loginPwd" type="password" placeholder="默认 admin123" style="width:100%"></div>
          <div class="hint" id="loginMsg" style="color:${msg ? 'var(--danger)' : '#94a3b8'};margin-top:8px">${msg || '首次登录默认密码 admin123，登录后请及时修改。'}</div>
        </div>
        <div class="modal-foot"><button class="btn primary" id="loginBtn" style="width:100%">登 录</button></div>
      </div>
    </div>`;
  const doLogin = async () => {
    const pwd = $('#loginPwd', root).value;
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
      const j = await r.json();
      if (!r.ok) { $('#loginMsg', root).textContent = j.error || '登录失败'; $('#loginMsg', root).style.color = 'var(--danger)'; return; }
      setToken(j.token); root.innerHTML = '';
      if (j.mustChange) { toast('请先修改默认密码'); openChangePassword(true); }
      route();
    } catch (e) { $('#loginMsg', root).textContent = '网络错误'; }
  };
  $('#loginBtn', root).addEventListener('click', doLogin);
  $('#loginPwd', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  setTimeout(() => $('#loginPwd', root).focus(), 30);
}

function openChangePassword(force) {
  const { root, close } = openModal({
    title: '修改密码', subtitle: force ? '首次登录需修改默认密码' : '修改门店管理密码',
    body: `<div class="form-grid" style="grid-template-columns:1fr">
      <div class="field"><label>原密码</label><input class="input" id="cpOld" type="password" ${force ? 'value="admin123"' : ''}></div>
      <div class="field"><label>新密码（至少 6 位）</label><input class="input" id="cpNew" type="password"></div>
      <div class="field"><label>确认新密码</label><input class="input" id="cpNew2" type="password"></div>
    </div>`,
    footer: `${force ? '' : '<button class="btn" data-cancel>取消</button>'}<button class="btn primary" id="cpSave">保存</button>`,
    size: 'narrow',
  });
  if (!force) $('[data-cancel]', root).addEventListener('click', close);
  $('#cpSave', root).addEventListener('click', async () => {
    const o = $('#cpOld', root).value, n = $('#cpNew', root).value, n2 = $('#cpNew2', root).value;
    if (n !== n2) return toast('两次新密码不一致', 'error');
    try { await api('/api/changePassword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword: o, newPassword: n }) }); close(); toast('密码已修改'); }
    catch (e) { toast(e.message, 'error'); }
  });
}

function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast ' + type; }, 2600);
}

function setHeader(title, subtitle) {
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = subtitle;
}

function setNav(name) {
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
}

/* ---------------- 模态框 ---------------- */
function openModal({ title, subtitle = '', body, footer = '', size = '' }) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal ${size}">
        <div class="modal-head">
          <div>
            <div class="modal-title">${esc(title)}</div>
            ${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ''}
          </div>
          <button class="modal-close" data-close>×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
  const mask = $('.modal-mask', root);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  $('[data-close]', root).addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  return { root, close };
}

/* ---------------- 路由 ---------------- */
const routes = {
  dashboard: { title: '工作台', sub: '今天的生意，一眼看清', render: renderDashboard },
  prescriptions: { title: '配镜记录', sub: '每一单配镜，都有完整处方', render: renderPrescriptions },
  customers: { title: '客户管理', sub: '客户档案与历史配镜记录', render: renderCustomers },
  ops: { title: '客户运营', sub: 'RFM 分层 · 沉睡唤醒 · 家庭账户', render: renderOps },
  members: { title: '会员管理', sub: '储值、次卡、积分与等级', render: renderMembers },
  marketing: { title: '营销活动', sub: '优惠券、充值赠送、满减活动', render: renderMarketing },
  followups: { title: '回访提醒', sub: '该回访的客户，一个不漏', render: renderFollowups },
  staff: { title: '员工管理', sub: '医生、销售、制作人员', render: renderStaff },
  import: { title: '导入 / 导出', sub: '把原来的 Excel 平滑搬进来', render: renderImport },
};

async function route() {
  const name = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const r = routes[name] || routes.dashboard;
  setNav(name);
  setHeader(r.title, r.sub);
  $('#topActions').innerHTML = '';
  $('#view').innerHTML = '<div class="empty">加载中…</div>';
  try {
    await r.render();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="empty"><div class="big">⚠</div>${esc(e.message)}</div>`;
  }
}

/* ---------------- 工作台 ---------------- */
async function renderDashboard() {
  const [boot, lc] = await Promise.all([api('/api/bootstrap'), api('/api/lifecycle-stats')]);
  state.settings = boot.settings;
  state.lanUrls = boot.lanUrls || [];
  state.stats = boot.stats;
  state.recent = boot.recent;
  $('#shopName').textContent = boot.settings.shopName || '明视眼镜';
  document.title = `${boot.settings.shopName || '明视眼镜'} · 配镜客户管理`;

  const s = boot.stats;
  const maxDay = Math.max(1, ...s.days.map((d) => d.amount));
  const maxSource = Math.max(1, ...s.sourceDist.map((d) => d.value));
  const maxSales = Math.max(1, ...s.salesRank.map((d) => d.amount));

  $('#view').innerHTML = `
    <div class="grid stats">
      ${statCard('今日营业额', money(s.todayAmount), `${s.todayCount} 单`, 'accent')}
      ${statCard('本月营业额', money(s.monthAmount), `${s.monthCount} 单`, '')}
      ${statCard('会员 / 客户', (s.memberCount || 0) + ' / ' + s.totalCustomers, '会员 / 客户总数', 'teal')}
      ${statCard('本月客单价', money(s.avgOrder), '元 / 单', '')}
      <a href="#/followups" class="stat" style="display:block;${s.followupsDue ? 'border-color:#fcd34d' : ''}">
        <div class="stat-label">待回访客户</div>
        <div class="stat-value" style="color:${s.followupsDue ? '#d97706' : 'inherit'}">${s.followupsDue}<small></small></div>
        <div class="stat-foot">位 · 点击查看回访清单</div>
      </a>
    </div>

    <div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><div><div class="panel-title">客户经营 · 全生命周期</div><div class="panel-sub">对齐院方家庭眼健康指标</div></div><a class="link" href="#/customers">客户分层 →</a></div>
      <div class="panel-body">
        <div class="grid stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          ${statCard('节点复查完成率', (lc.reviewRate * 100).toFixed(0) + '%', `防控/OK镜 ${lc.reviewOnTime}/${lc.reviewDue} 按期`, 'accent')}
          ${statCard('复购率', (lc.repurchaseRate * 100).toFixed(0) + '%', '≥2 单客户占比', '')}
          ${statCard('沉睡+流失占比', (lc.sleepingRatio * 100).toFixed(0) + '%', '需唤醒', 'teal')}
          ${statCard('客户总数', lc.total, '人', '')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
          ${STAGES.map((st) => `<span class="tag ${STAGE_COLOR[st] || ''}">${st} ${lc.stageDist[st] || 0}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid two-col">
      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">近 7 天营业额</div><div class="panel-sub">按开单日期统计</div></div>
          <span class="tag green">实时</span>
        </div>
        <div class="panel-body">
          <div class="bars">
            ${s.days.map((d) => `
              <div class="bar-wrap" title="${d.date}：${money(d.amount)} / ${d.count} 单">
                <div class="bar-val">${d.amount ? money(d.amount) : ''}</div>
                <div class="bar" style="height:${Math.max(4, (d.amount / maxDay) * 100)}%"></div>
                <div class="bar-label">${d.date}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">客户来源</div><div class="panel-sub">客户档案渠道分布</div></div>
        </div>
        <div class="panel-body">
          ${s.sourceDist.length ? s.sourceDist.map((d) => `
            <div class="source-row">
              <div class="source-name" title="${esc(d.name)}">${esc(d.name)}</div>
              <div class="source-track"><div class="source-fill" style="width:${Math.max(3, (d.value / maxSource) * 100)}%"></div></div>
              <div class="source-val">${d.value} 人</div>
            </div>`).join('') : '<div class="empty">暂无客户数据</div>'}
        </div>
      </div>
    </div>

    <div class="grid two-col-2">
      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">本月销售排行</div><div class="panel-sub">按销售额</div></div>
        </div>
        <div class="panel-body">
          ${s.salesRank.length ? `<div class="rank-list">${s.salesRank.map((d, i) => `
            <div class="rank-row">
              <div class="rank-no">${i + 1}</div>
              <div>
                <div class="rank-name">${esc(d.name)}</div>
                <div class="rank-bar"><span style="width:${Math.max(4, (d.amount / maxSales) * 100)}%"></span></div>
              </div>
              <div class="rank-val">${money(d.amount)}</div>
            </div>`).join('')}</div>` : '<div class="empty">本月还没有销售数据</div>'}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">最近配镜</div><div class="panel-sub">最新 8 条记录</div></div>
          <a class="link" href="#/prescriptions">查看全部 →</a>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>日期</th><th>客户</th><th>分类</th><th class="num">金额</th></tr></thead>
            <tbody>
              ${state.recent.length ? state.recent.map((p) => `
                <tr>
                  <td class="muted">${esc(p.date)}</td>
                  <td><span class="link" data-customer="${esc(p.customerId)}">${esc(p.customerName)}</span></td>
                  <td><span class="tag">${esc(p.category || '—')}</span></td>
                  <td class="num money">${money(p.amount)}</td>
                </tr>`).join('') : '<tr><td colspan="4"><div class="empty">还没有配镜记录</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  $$('[data-customer]').forEach((el) => el.addEventListener('click', () => showCustomer(el.dataset.customer)));
}

function statCard(label, value, foot, cls) {
  return `<div class="stat ${cls}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}<small>${foot ? '' : ''}</small></div>
    <div class="stat-foot">${foot || ''}</div>
  </div>`;
}

/* ---------------- 配镜记录 ---------------- */
const filter = { from: '', to: '', source: '', category: '', sales: '', search: '' };
const pPage = { page: 1, pageSize: 100, total: 0 };
const cPage = { page: 1, pageSize: 100, total: 0 };
/* 分页控件（服务端分页，避免一次渲染上万行） */
function pagerHtml(id, pg) {
  const pages = Math.max(1, Math.ceil(pg.total / pg.pageSize));
  return `<div style="display:flex;gap:8px;align-items:center;padding:10px 4px;flex-wrap:wrap">
    <button class="btn sm" id="${id}Prev" ${pg.page <= 1 ? 'disabled' : ''}>上一页</button>
    <span class="muted" style="font-size:12px">第 ${pg.page} / ${pages} 页 · 共 ${pg.total} 条</span>
    <button class="btn sm" id="${id}Next" ${pg.page >= pages ? 'disabled' : ''}>下一页</button>
  </div>`;
}
function bindPager(id, pg, onChange) {
  const pages = Math.max(1, Math.ceil(pg.total / pg.pageSize));
  const prev = $('#' + id + 'Prev'), next = $('#' + id + 'Next');
  if (prev) prev.onclick = () => { if (pg.page > 1) { pg.page--; onChange(); } };
  if (next) next.onclick = () => { if (pg.page < pages) { pg.page++; onChange(); } };
}

async function renderPrescriptions() {
  const params = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, v]) => v)));
  params.set('page', pPage.page); params.set('pageSize', pPage.pageSize);
  const [resp, customers, staff, members] = await Promise.all([
    api('/api/prescriptions?' + params),
    api('/api/customers'),
    api('/api/staff'),
    api('/api/members'),
  ]);
  const list = resp.items || resp;
  pPage.total = resp.total != null ? resp.total : list.length;
  state.prescriptions = list;
  state.customers = customers;
  state.staff = staff;
  state.members = members;

  const salesOptions = [...new Set([...staff.filter((s) => s.role === '销售').map((s) => s.name), ...list.map((p) => p.sales).filter(Boolean)])];
  const sources = state.settings.sources || [];
  const categories = state.settings.categories || [];

  $('#topActions').innerHTML = `
    <a class="btn" href="${authUrl('/api/export')}">导出 Excel</a>
    <button class="btn primary" id="addPrescription">＋ 新增配镜记录</button>`;

  $('#view').innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <div class="field"><label>开始日期</label><input type="date" class="input" id="fFrom" value="${filter.from}"></div>
        <div class="field"><label>结束日期</label><input type="date" class="input" id="fTo" value="${filter.to}"></div>
        <div class="field"><label>来源</label><select class="select" id="fSource"><option value="">全部</option>${sources.map((s) => `<option ${filter.source === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>分类</label><select class="select" id="fCategory"><option value="">全部</option>${categories.map((s) => `<option ${filter.category === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>销售</label><select class="select" id="fSales"><option value="">全部</option>${salesOptions.map((s) => `<option ${filter.sales === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>搜索</label><input class="input search" id="fSearch" placeholder="姓名 / 电话 / 型号 / 销售" value="${esc(filter.search)}"></div>
        <div class="spacer"></div>
        <button class="btn danger" id="batchDelP" disabled>批量删除</button>
        <button class="btn ghost" id="resetFilter">重置</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="width:30px"><input type="checkbox" id="pCheckAll" title="全选当前列表"></th>
            <th>日期</th><th>客户</th><th>电话</th><th class="num">金额</th><th>分类</th>
            <th>框/产品</th><th>型号</th><th>度数R</th><th>度数L</th><th>瞳高R/L</th><th>销售</th><th>医生</th><th>操作</th>
          </tr></thead>
          <tbody id="pBody">${prescriptionRows(list)}</tbody>
        </table>
      </div>
      <div id="pPager">${pagerHtml('p', pPage)}</div>
    </div>`;

  const refresh = async () => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, v]) => v)));
    q.set('page', pPage.page); q.set('pageSize', pPage.pageSize);
    const r = await api('/api/prescriptions?' + q);
    const rows = r.items || r;
    pPage.total = r.total != null ? r.total : rows.length;
    state.prescriptions = rows;
    $('#pBody').innerHTML = prescriptionRows(rows);
    $('#pPager').innerHTML = pagerHtml('p', pPage);
    bindPager('p', pPage, refresh);
    bindRowActions();
    bindPChecks();
  };
  const readFilters = () => {
    filter.from = $('#fFrom').value; filter.to = $('#fTo').value;
    filter.source = $('#fSource').value; filter.category = $('#fCategory').value;
    filter.sales = $('#fSales').value; filter.search = $('#fSearch').value.trim();
    pPage.page = 1;
    refresh();
  };
  ['fFrom', 'fTo', 'fSource', 'fCategory', 'fSales'].forEach((id) => $('#' + id).addEventListener('change', readFilters));
  let t; $('#fSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(readFilters, 250); });
  $('#resetFilter').addEventListener('click', () => {
    Object.assign(filter, { from: '', to: '', source: '', category: '', sales: '', search: '' });
    pPage.page = 1;
    renderPrescriptions();
  });
  $('#addPrescription').addEventListener('click', () => openPrescriptionForm());
  bindPager('p', pPage, refresh);
  bindRowActions();

  // 批量删除：勾选状态跨筛选保留，删除前二次确认
  const pSelected = new Set();
  const batchBtn = $('#batchDelP');
  const checkAll = $('#pCheckAll');
  function syncBatchBtn() {
    batchBtn.disabled = !pSelected.size;
    batchBtn.textContent = pSelected.size ? `批量删除（${pSelected.size}）` : '批量删除';
    const boxes = $$('#pBody input[data-pcheck]');
    checkAll.checked = boxes.length > 0 && boxes.every((b) => b.checked);
  }
  function bindPChecks() {
    $$('#pBody input[data-pcheck]').forEach((b) => {
      b.checked = pSelected.has(b.dataset.pcheck);
      b.addEventListener('change', () => {
        if (b.checked) pSelected.add(b.dataset.pcheck); else pSelected.delete(b.dataset.pcheck);
        syncBatchBtn();
      });
    });
    syncBatchBtn();
  }
  checkAll.addEventListener('change', () => {
    $$('#pBody input[data-pcheck]').forEach((b) => {
      b.checked = checkAll.checked;
      if (checkAll.checked) pSelected.add(b.dataset.pcheck); else pSelected.delete(b.dataset.pcheck);
    });
    syncBatchBtn();
  });
  batchBtn.addEventListener('click', async () => {
    if (!pSelected.size) return;
    if (!confirm(`确定删除勾选的 ${pSelected.size} 条配镜记录？删除后不可恢复（会员积分/余额不会自动回滚）。`)) return;
    try {
      const r = await api('/api/prescriptions/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...pSelected] }) });
      pSelected.clear();
      toast(`已删除 ${r.deleted} 条记录`);
      route();
    } catch (e) { toast(e.message, 'error'); }
  });
  bindPChecks();
}

function prescriptionRows(list) {
  if (!list.length) return '<tr><td colspan="14"><div class="empty"><div class="big">◌</div>没有符合条件的记录</div></td></tr>';
  return list.map((p) => `
    <tr>
      <td><input type="checkbox" data-pcheck="${esc(p.id)}"></td>
      <td class="muted">${esc(p.date)}</td>
      <td><span class="link" data-customer="${esc(p.customerId)}">${esc(p.customerName)}</span></td>
      <td class="muted">${esc(p.phone || '—')}</td>
      <td class="num money">${money(p.amount)}</td>
      <td><span class="tag ${p.category === '隐形眼镜' ? 'green' : p.category === '功能镜片' ? 'orange' : ''}">${esc(p.category || '—')}</span></td>
      <td>${esc(p.frame || '—')}</td>
      <td class="muted">${esc(p.model || '—')}</td>
      <td class="muted">${esc(p.sphR || '—')}</td>
      <td class="muted">${esc(p.sphL || '—')}</td>
      <td class="muted">${p.phR && p.phL ? esc(p.phR + ' / ' + p.phL) : esc(p.phR || p.phL || '—')}</td>
      <td>${esc(p.sales || '—')}</td>
      <td class="muted">${esc(p.doctor || '—')}</td>
      <td><div class="actions">
        <button class="btn sm" data-edit="${esc(p.id)}">编辑</button>
        <button class="btn sm danger" data-del="${esc(p.id)}">删除</button>
      </div></td>
    </tr>`).join('');
}

function bindRowActions() {
  $$('[data-customer]').forEach((el) => el.addEventListener('click', () => showCustomer(el.dataset.customer)));
  $$('[data-edit]').forEach((el) => el.addEventListener('click', () => {
    const p = state.prescriptions.find((x) => x.id === el.dataset.edit);
    if (p) openPrescriptionForm(p);
  }));
  $$('[data-del]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('确定删除这条配镜记录？')) return;
    try {
      await api('/api/prescriptions/' + el.dataset.del, { method: 'DELETE' });
      toast('已删除');
      route();
    } catch (e) { toast(e.message, 'error'); }
  }));
}

/* ---------------- 配镜表单 ---------------- */
function openPrescriptionForm(p = null) {
  const isEdit = !!p;
  const customers = state.customers;
  const s = state.settings;
  const sources = s.sources || [];
  const categories = s.categories || [];
  const salesStaff = state.staff.filter((x) => x.role === '销售').map((x) => x.name);
  const doctorStaff = state.staff.filter((x) => x.role === '医生').map((x) => x.name);
  const makerStaff = state.staff.filter((x) => x.role === '制作').map((x) => x.name);
  const salesOptions = [...new Set([...salesStaff, p?.sales].filter(Boolean))];
  const doctorOptions = [...new Set([...doctorStaff, p?.doctor].filter(Boolean))];
  const makerOptions = [...new Set([...makerStaff, p?.maker].filter(Boolean))];

  const body = `
    <div class="form-section">
      <div class="section-title">客户信息</div>
      ${isEdit ? `
        <div class="customer-summary">
          <span>客户：<b>${esc(p.customerName)}</b></span>
          <span>电话：${esc(p.phone || '—')}</span>
          <span>来源：${esc(p.source || '—')}</span>
        </div>` : `
        <div class="customer-picker">
          <input class="input search" id="pCustomerSearch" placeholder="筛选老客户：姓名 / 电话 / 学校 / 来源" style="margin-bottom:8px">
          <select class="select" id="pCustomer">
            <option value="__new__">＋ 新客户（首次到店）</option>
            ${customers.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.phone || '无电话')} · ${esc(c.source || '未填来源')}</option>`).join('')}
          </select>
          <div class="hint" id="pCustomerCount" style="margin-top:6px"></div>
        </div>
        <div id="pCustomerSummary" class="customer-summary" style="display:none"></div>
        <div id="pNewCustomerFields" class="form-grid">
          <div class="field"><label>姓名 *</label><input class="input" id="nName" placeholder="客户姓名"></div>
          <div class="field"><label>性别</label><select class="select" id="nGender"><option value="">请选择</option><option>男</option><option>女</option></select></div>
          <div class="field"><label>年龄</label><input class="input" id="nAge" type="number" min="0" max="120" placeholder="如 28"></div>
          <div class="field"><label>电话</label><input class="input" id="nPhone" placeholder="手机号"></div>
          <div class="field"><label>学校</label><input class="input" id="nSchool" placeholder="学生填学校"></div>
          <div class="field"><label>来源</label><select class="select" id="nSource"><option value="">请选择</option>${sources.map((x) => `<option>${esc(x)}</option>`).join('')}</select></div>
          <div class="field span-2"><label>来源明细</label><input class="input" id="nSourceDetail" placeholder="推荐人 / 活动 / 团购单号"></div>
        </div>`}
    </div>

    <div class="form-section">
      <div class="section-title">配镜信息</div>
      <div class="form-grid">
        <div class="field"><label>日期 *</label><input class="input" id="fDate" type="date" value="${esc(p?.date || today())}"></div>
        <div class="field"><label>金额（元）</label><input class="input" id="fAmount" type="number" min="0" step="0.01" value="${esc(p?.amount ?? '')}" placeholder="0.00"></div>
        <div class="field"><label>会员</label><select class="select" id="pMember">
          <option value="">非会员 / 不关联</option>
          ${(state.members || []).map((m) => `<option value="${esc(m.id)}" ${p?.memberId === m.id ? 'selected' : ''}>${esc(m.name)} · ${esc(m.levelName)} · 余额 ¥${Number(m.balance).toLocaleString()}</option>`).join('')}
        </select></div>
        <div class="field"><label>支付方式</label><select class="select" id="pPayMethod">
          ${['现金', '微信', '支付宝', '储值'].map((x) => `<option ${p?.payMethod === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select></div>
        <div class="field"><label>使用储值金额</label><input class="input" id="pUseBalance" type="number" min="0" step="0.01" placeholder="0.00"></div>
        <div class="field"><label>使用卡项</label><select class="select" id="pUseCard"><option value="">不使用卡项</option></select></div>
        <div class="field"><label>使用优惠券</label><select class="select" id="pCoupon"><option value="">不使用优惠券</option></select></div>
        <div class="field"><label>分类方式</label><select class="select" id="fCat"><option value="">请选择</option>${categories.map((x) => `<option ${p?.category === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="field"><label>产品类型（驱动临床随访）</label><select class="select" id="fProductType"><option value="">自动推断</option>${['OK镜', '离焦防控镜', '普通框架', '隐形眼镜', '视训', '换框换片', '其他'].map((x) => `<option ${p?.productType === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>隐形抛弃周期</label><select class="select" id="fDiscard"><option value="">不适用</option>${['月抛', '季抛', '半年抛', '年抛'].map((x) => `<option ${p?.discardCycle === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>公司</label><input class="input" id="fCompany" value="${esc(p?.company || '')}" placeholder="供货公司 / 品牌方"></div>
        <div class="field"><label>框 / 产品</label><input class="input" id="fFrame" value="${esc(p?.frame || '')}" placeholder="镜架品牌或产品"></div>
        <div class="field"><label>型号</label><input class="input" id="fModel" value="${esc(p?.model || '')}" placeholder="具体型号"></div>
        <div class="field"><label>片</label><input class="input" id="fLens" value="${esc(p?.lens || '')}" placeholder="折射率 / 膜层 / 类型"></div>
        <div class="field"><label>医生 / 验光师</label><input class="input" id="fDoctor" list="doctorList" value="${esc(p?.doctor || '')}" placeholder="姓名"><datalist id="doctorList">${doctorOptions.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="field"><label>销售</label><input class="input" id="pSales" list="salesList" value="${esc(p?.sales || '')}" placeholder="姓名"><datalist id="salesList">${salesOptions.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="field"><label>制作</label><input class="input" id="fMaker" list="makerList" value="${esc(p?.maker || '')}" placeholder="姓名"><datalist id="makerList">${makerOptions.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="field span-2"><label>备注</label><input class="input" id="fRemark" value="${esc(p?.remark || '')}" placeholder="售后 / 特殊要求 / 复购"></div>
      </div>
    </div>

    <div class="form-section">
      <div class="section-title">验光数据</div>
      <div class="form-grid">
        <div class="field"><label>度数 R（右眼）</label><input class="input" id="fSphR" value="${esc(p?.sphR || '')}" placeholder="-3.50/-0.75×180"></div>
        <div class="field"><label>度数 L（左眼）</label><input class="input" id="fSphL" value="${esc(p?.sphL || '')}" placeholder="-3.25/-0.50×175"></div>
        <div class="field"><label>瞳距 PD（mm）</label><input class="input" id="fPd" type="number" step="0.1" value="${esc(p?.pd || '')}" placeholder="62.5"></div>
        <div class="field"><label>RPD（mm）</label><input class="input" id="fRpd" type="number" step="0.1" value="${esc(p?.rpd || '')}" placeholder="31.5"></div>
        <div class="field"><label>LPD（mm）</label><input class="input" id="fLpd" type="number" step="0.1" value="${esc(p?.lpd || '')}" placeholder="31.0"></div>
        <div class="field"><label>瞳高 R（mm）</label><input class="input" id="fPhR" type="number" step="0.1" value="${esc(p?.phR || '')}" placeholder="右眼瞳高，如 20.5"></div>
        <div class="field"><label>瞳高 L（mm）</label><input class="input" id="fPhL" type="number" step="0.1" value="${esc(p?.phL || '')}" placeholder="左眼瞳高，如 20.0"></div>
      </div>
      <div class="hint">度数建议统一写成「球镜/柱镜×轴位」，例如 -3.50/-0.75×180；只有球镜时写 -2.00。</div>
    </div>`;

  const { root, close } = openModal({
    title: isEdit ? '编辑配镜记录' : '新增配镜记录',
    subtitle: isEdit ? '修改后立即保存到客户档案' : '客户信息 + 配镜信息 + 验光数据',
    body,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="saveP">保存记录</button>`,
    size: 'wide',
  });

  const customerSelect = $('#pCustomer', root);
  const newFields = $('#pNewCustomerFields', root);
  const summary = $('#pCustomerSummary', root);

  // 会员联动：加载该会员的卡项、余额
  const memberSelect = $('#pMember', root);
  const useCardSelect = $('#pUseCard', root);
  const couponSelect = $('#pCoupon', root);
  const useBalanceInput = $('#pUseBalance', root);
  const paySelect = $('#pPayMethod', root);
  async function syncMember() {
    const mid = memberSelect ? memberSelect.value : '';
    if (!mid) {
      if (useCardSelect) useCardSelect.innerHTML = '<option value="">不使用卡项</option>';
      if (couponSelect) couponSelect.innerHTML = '<option value="">不使用优惠券</option>';
      if (useBalanceInput) useBalanceInput.value = '';
      return;
    }
    try {
      const m = await api('/api/members/' + mid);
      if (useCardSelect) {
        const usable = (m.cards || []).filter((c) => c.usedTimes < c.totalTimes);
        useCardSelect.innerHTML = '<option value="">不使用卡项</option>' + usable.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}（余 ${c.totalTimes - c.usedTimes} 次）</option>`).join('');
      }
      if (couponSelect) {
        const cs = await api('/api/members/' + mid + '/coupons');
        const usable = cs.filter((g) => g.status === '未使用' && !g.expired);
        couponSelect.innerHTML = '<option value="">不使用优惠券</option>' + usable.map((g) => `<option value="${esc(g.id)}">${esc(g.couponName)}（${g.type === '折扣' ? (Number(g.faceValue) * 10).toFixed(1) + ' 折' : '减 ' + g.faceValue + ' 元'}${g.threshold ? '，满 ' + g.threshold : ''}）</option>`).join('');
      }
      if (useBalanceInput) {
        useBalanceInput.value = '';
        useBalanceInput.placeholder = '余额 ¥' + Number(m.balance).toLocaleString() + '，可填抵扣金额';
      }
      if (paySelect && !paySelect.value) paySelect.value = '储值';
      toast('会员余额 ¥' + Number(m.balance).toLocaleString() + '，积分 ' + (m.points || 0) + '，' + m.levelName);
    } catch (e) { /* 忽略 */ }
  }
  if (memberSelect) { memberSelect.addEventListener('change', syncMember); syncMember(); }

  function updateCustomerMode() {
    if (!customerSelect) return;
    const isNew = customerSelect.value === '__new__';
    newFields.style.display = isNew ? '' : 'none';
    summary.style.display = isNew ? 'none' : 'flex';
    if (!isNew) {
      const c = customers.find((x) => x.id === customerSelect.value);
      summary.innerHTML = c ? `<span>客户：<b>${esc(c.name)}</b></span><span>电话：${esc(c.phone || '—')}</span><span>历史消费：<b>${money(c.totalAmount)}</b>（${c.orderCount} 次）</span><span>来源：${esc(c.source || '—')}</span>` : '';
    }
  }
  // 老客户筛选：按姓名/电话/学校/来源过滤下拉选项，当前选中项始终保留
  const customerSearch = $('#pCustomerSearch', root);
  const customerCount = $('#pCustomerCount', root);
  function filterCustomerOptions() {
    if (!customerSelect) return;
    const q = (customerSearch ? customerSearch.value : '').trim().toLowerCase();
    const matched = customers.filter((c) => !q || [c.name, c.phone, c.school, c.source].join(' ').toLowerCase().includes(q));
    const keepId = customerSelect.value;
    const keep = keepId !== '__new__' && !matched.some((c) => c.id === keepId) ? customers.find((c) => c.id === keepId) : null;
    const opts = keep ? [keep, ...matched] : matched;
    customerSelect.innerHTML = '<option value="__new__">＋ 新客户（首次到店）</option>' + opts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.phone || '无电话')} · ${esc(c.source || '未填来源')}</option>`).join('');
    customerSelect.value = keepId;
    if (customerCount) customerCount.textContent = q ? `筛选出 ${matched.length} 位老客户` : `共 ${customers.length} 位老客户，输入关键字可筛选`;
  }
  if (customerSearch) customerSearch.addEventListener('input', filterCustomerOptions);
  if (customerSelect) {
    customerSelect.addEventListener('change', updateCustomerMode);
    filterCustomerOptions();
    updateCustomerMode();
  }

  $('[data-cancel]', root).addEventListener('click', close);
  $('#saveP', root).addEventListener('click', async () => {
    const payload = {
      date: $('#fDate', root).value || today(),
      amount: Number($('#fAmount', root).value || 0),
      category: $('#fCat', root).value,
      company: $('#fCompany', root).value.trim(),
      frame: $('#fFrame', root).value.trim(),
      model: $('#fModel', root).value.trim(),
      lens: $('#fLens', root).value.trim(),
      doctor: $('#fDoctor', root).value.trim(),
      sales: $('#pSales', root).value.trim(),
      maker: $('#fMaker', root).value.trim(),
      remark: $('#fRemark', root).value.trim(),
      sphR: $('#fSphR', root).value.trim(),
      sphL: $('#fSphL', root).value.trim(),
      pd: $('#fPd', root).value,
      rpd: $('#fRpd', root).value,
      lpd: $('#fLpd', root).value,
      phR: $('#fPhR', root).value,
      phL: $('#fPhL', root).value,
      productType: $('#fProductType', root).value,
      discardCycle: $('#fDiscard', root).value,
      memberId: memberSelect ? memberSelect.value : '',
      payMethod: paySelect ? paySelect.value : '现金',
      useBalance: useBalanceInput ? Number(useBalanceInput.value || 0) : 0,
      useCardId: useCardSelect ? useCardSelect.value : '',
      couponGrantId: couponSelect ? couponSelect.value : '',
    };
    if (!isEdit) {
      if (customerSelect.value === '__new__') {
        const name = $('#nName', root).value.trim();
        if (!name) return toast('请填写新客户姓名', 'error');
        Object.assign(payload, {
          customerName: name,
          gender: $('#nGender', root).value,
          age: $('#nAge', root).value,
          phone: $('#nPhone', root).value.trim(),
          school: $('#nSchool', root).value.trim(),
          source: $('#nSource', root).value,
          sourceDetail: $('#nSourceDetail', root).value.trim(),
        });
      } else {
        payload.customerId = customerSelect.value;
      }
    }
    try {
      if (isEdit) await api('/api/prescriptions/' + p.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      else await api('/api/prescriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      close();
      toast(isEdit ? '记录已更新' : '配镜记录已保存');
      route();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- 客户管理 ---------------- */
const STAGE_COLOR = { '潜在': 'gray', '新客': 'green', '活跃': '', '沉睡': 'orange', '流失': 'orange', '忠诚': 'green' };
const STAGES = ['潜在', '新客', '活跃', '沉睡', '流失', '忠诚'];
async function renderCustomers() {
  const q = state._customerSearch || '';
  const stage = state._customerStage || '';
  const rfm = state._customerRfm || '';
  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (stage) params.set('stage', stage);
  if (rfm) params.set('rfm', rfm);
  params.set('page', cPage.page); params.set('pageSize', cPage.pageSize);
  const resp = await api('/api/customers?' + params);
  const list = resp.items || resp;
  cPage.total = resp.total != null ? resp.total : list.length;
  state.customers = list;
  $('#topActions').innerHTML = `<button class="btn primary" id="addCustomer">＋ 新增客户</button>`;
  $('#view').innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <div class="field"><label>搜索客户</label><input class="input search" id="cSearch" placeholder="姓名 / 电话 / 学校 / 来源" value="${esc(q)}"></div>
        <div class="field"><label>生命周期</label><select class="select" id="cStage"><option value="">全部</option>${STAGES.map((x) => `<option ${stage === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>RFM 分层</label><select class="select" id="cRfm"><option value="">全部</option>${['重要价值', '重要发展', '重要保持', '重要挽留', '一般价值', '一般', '流失预警', '潜在'].map((x) => `<option ${rfm === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="spacer"></div>
        <button class="btn danger" id="batchDelC" disabled>批量删除</button>
        <span class="tag gray">共 ${cPage.total} 位客户</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th style="width:30px"><input type="checkbox" id="cCheckAll" title="全选当前列表"></th><th>姓名</th><th>阶段</th><th>RFM</th><th>性别</th><th>年龄</th><th>电话</th><th>学校</th><th>来源</th><th class="num">消费次数</th><th class="num">累计金额</th><th>最近配镜</th><th>操作</th></tr></thead>
          <tbody>
            ${list.length ? list.map((c) => `
              <tr>
                <td><input type="checkbox" data-ccheck="${esc(c.id)}"></td>
                <td><span class="link" data-customer="${esc(c.id)}">${esc(c.name)}</span></td>
                <td><span class="tag ${STAGE_COLOR[c.lifecycleStage] || ''}">${esc(c.lifecycleStage || '—')}</span></td>
                <td><span class="tag ${RFM_COLOR[c.rfm && c.rfm.segment] || ''}">${esc(c.rfm ? c.rfm.segment : '—')}</span></td>
                <td>${esc(c.gender || '—')}</td>
                <td>${esc(c.age || '—')}</td>
                <td class="muted">${esc(c.phone || '—')}</td>
                <td class="muted">${esc(c.school || '—')}</td>
                <td><span class="tag">${esc(c.source || '未填')}</span></td>
                <td class="num">${c.orderCount}</td>
                <td class="num money">${money(c.totalAmount)}</td>
                <td class="muted">${esc(c.lastDate || '—')}</td>
                <td><div class="actions">
                  <button class="btn sm" data-editc="${esc(c.id)}">编辑</button>
                  <button class="btn sm danger" data-delc="${esc(c.id)}">删除</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="13"><div class="empty"><div class="big">☺</div>还没有客户，点右上角新增</div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div id="cPager">${pagerHtml('c', cPage)}</div>
    </div>`;

  let t;
  $('#cSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state._customerSearch = e.target.value.trim(); cPage.page = 1; renderCustomers(); }, 250);
  });
  $('#cStage').addEventListener('change', (e) => { state._customerStage = e.target.value; cPage.page = 1; renderCustomers(); });
  $('#cRfm').addEventListener('change', (e) => { state._customerRfm = e.target.value; cPage.page = 1; renderCustomers(); });
  bindPager('c', cPage, renderCustomers);
  $('#addCustomer').addEventListener('click', () => openCustomerForm());
  $$('[data-customer]').forEach((el) => el.addEventListener('click', () => showCustomer(el.dataset.customer)));
  $$('[data-editc]').forEach((el) => el.addEventListener('click', () => {
    const c = list.find((x) => x.id === el.dataset.editc);
    if (c) openCustomerForm(c);
  }));
  $$('[data-delc]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('确定删除该客户？')) return;
    try { await api('/api/customers/' + el.dataset.delc, { method: 'DELETE' }); toast('已删除'); renderCustomers(); }
    catch (e) { toast(e.message, 'error'); }
  }));

  // 批量删除客户：仍有配镜记录的客户会被后端跳过
  const cSelected = new Set();
  const batchBtn = $('#batchDelC');
  const checkAll = $('#cCheckAll');
  const syncBtn = () => {
    batchBtn.disabled = !cSelected.size;
    batchBtn.textContent = cSelected.size ? `批量删除（${cSelected.size}）` : '批量删除';
    const boxes = $$('input[data-ccheck]');
    checkAll.checked = boxes.length > 0 && boxes.every((b) => b.checked);
  };
  $$('input[data-ccheck]').forEach((b) => b.addEventListener('change', () => {
    if (b.checked) cSelected.add(b.dataset.ccheck); else cSelected.delete(b.dataset.ccheck);
    syncBtn();
  }));
  checkAll.addEventListener('change', () => {
    $$('input[data-ccheck]').forEach((b) => {
      b.checked = checkAll.checked;
      if (checkAll.checked) cSelected.add(b.dataset.ccheck); else cSelected.delete(b.dataset.ccheck);
    });
    syncBtn();
  });
  batchBtn.addEventListener('click', async () => {
    if (!cSelected.size) return;
    if (!confirm(`确定删除勾选的 ${cSelected.size} 位客户？还有配镜记录的客户会被自动跳过。`)) return;
    try {
      const r = await api('/api/customers/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...cSelected] }) });
      toast(`已删除 ${r.deleted} 位客户${r.skipped ? `，${r.skipped} 位因有配镜记录被跳过` : ''}`);
      renderCustomers();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openCustomerForm(c = null) {
  const s = state.settings;
  const body = `
    <div class="form-grid">
      <div class="field"><label>姓名 *</label><input class="input" id="cName" value="${esc(c?.name || '')}"></div>
      <div class="field"><label>性别</label><select class="select" id="cGender"><option value="">请选择</option><option ${c?.gender === '男' ? 'selected' : ''}>男</option><option ${c?.gender === '女' ? 'selected' : ''}>女</option></select></div>
      <div class="field"><label>年龄</label><input class="input" id="cAge" type="number" min="0" max="120" value="${esc(c?.age || '')}"></div>
      <div class="field"><label>电话</label><input class="input" id="cPhone" value="${esc(c?.phone || '')}"></div>
      <div class="field"><label>学校</label><input class="input" id="cSchool" value="${esc(c?.school || '')}"></div>
      <div class="field"><label>来源</label><select class="select" id="cSource"><option value="">请选择</option>${(s.sources || []).map((x) => `<option ${c?.source === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field span-2"><label>来源明细</label><input class="input" id="cSourceDetail" value="${esc(c?.sourceDetail || '')}" placeholder="推荐人 / 活动 / 团购单号"></div>
      <div class="field span-4"><label>备注</label><textarea class="input" id="cRemark">${esc(c?.remark || '')}</textarea></div>
    </div>`;
  const { root, close } = openModal({
    title: c ? '编辑客户' : '新增客户',
    subtitle: c ? '客户档案会同步到历史配镜记录' : '先建档案，再开配镜单',
    body,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="saveC">保存客户</button>`,
    size: 'narrow',
  });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#saveC', root).addEventListener('click', async () => {
    const payload = {
      name: $('#cName', root).value.trim(),
      gender: $('#cGender', root).value,
      age: $('#cAge', root).value,
      phone: $('#cPhone', root).value.trim(),
      school: $('#cSchool', root).value.trim(),
      source: $('#cSource', root).value,
      sourceDetail: $('#cSourceDetail', root).value.trim(),
      remark: $('#cRemark', root).value.trim(),
    };
    if (!payload.name) return toast('姓名必填', 'error');
    try {
      if (c) await api('/api/customers/' + c.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      else await api('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      close(); toast(c ? '客户已更新' : '客户已创建'); renderCustomers();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- P1-M5: 屈光发育档案 ---------------- */
function alChart(recs) {
  const pts = recs.filter((r) => Number(r.alR) > 0 || Number(r.alL) > 0);
  if (pts.length < 2) return '';
  const W = 560, H = 120, P = 24;
  const vals = []; pts.forEach((r) => { if (Number(r.alR) > 0) vals.push(Number(r.alR)); if (Number(r.alL) > 0) vals.push(Number(r.alL)); });
  const min = Math.min(...vals) - 0.1, max = Math.max(...vals) + 0.1;
  const x = (i) => P + (W - 2 * P) * (i / (pts.length - 1));
  const y = (v) => H - P - (H - 2 * P) * ((v - min) / (max - min));
  const line = (key) => pts.map((r, i) => Number(r[key]) > 0 ? `${x(i).toFixed(1)},${y(Number(r[key])).toFixed(1)}` : null).filter(Boolean).join(' ');
  return `<div style="margin-bottom:10px"><div class="muted" style="font-size:11px;margin-bottom:4px">眼轴趋势（mm）<span style="color:#6D28D9">— R</span> <span style="color:#d97706">— L</span></div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;background:#f8fafc;border-radius:8px">
      <polyline points="${line('alR')}" fill="none" stroke="#6D28D9" stroke-width="2"/>
      <polyline points="${line('alL')}" fill="none" stroke="#d97706" stroke-width="2"/>
      ${pts.map((r, i) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#94a3b8">${esc(r.date.slice(5))}</text>`).join('')}
    </svg></div>`;
}
function refractivePanel(ref, c) {
  const recs = ref.records || [];
  const alerts = (ref.alerts || []).map((a) => `<div class="result-box err" style="margin:0 0 8px">⚠ ${esc(a.text)}</div>`).join('');
  const summary = [];
  if (ref.alGrowth != null) summary.push(`眼轴年增长 <b>${ref.alGrowth}</b> mm/年`);
  if (ref.alcr != null) summary.push(`轴率比 AL/CR <b>${ref.alcr}</b>`);
  const rows = recs.slice().reverse().map((r) => `<tr>
    <td class="muted">${esc(r.date)}</td>
    <td class="num">${esc(r.alR || '—')}</td><td class="num">${esc(r.alL || '—')}</td>
    <td class="num">${esc(r.crR || '—')}</td><td class="num">${esc(r.crL || '—')}</td>
    <td class="muted">${esc(r.sphR || '—')}</td><td class="muted">${esc(r.sphL || '—')}</td>
    <td class="muted">${esc(r.vaR || '—')}/${esc(r.vaL || '—')}</td>
    <td class="muted">${esc(r.reserve || '—')}</td>
    <td><button class="btn sm danger" data-delref="${esc(r.id)}">删</button></td></tr>`).join('');
  return `<div class="panel" style="box-shadow:none;margin-bottom:14px">
    <div class="panel-head"><div><div class="panel-title">屈光发育档案</div><div class="panel-sub">眼轴/曲率/屈光纵向追踪 · ${recs.length} 次检查</div></div><button class="btn sm primary" id="addRefractive">＋ 新增检查</button></div>
    <div class="panel-body">
      ${alerts}
      ${summary.length ? `<div class="customer-summary" style="margin-bottom:10px">${summary.join(' · ')}</div>` : ''}
      ${alChart(recs)}
      ${recs.length ? `<div class="table-wrap"><table>
        <thead><tr><th>日期</th><th class="num">眼轴R</th><th class="num">眼轴L</th><th class="num">曲率R</th><th class="num">曲率L</th><th>屈光R</th><th>屈光L</th><th>裸眼视力</th><th>远视储备</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<div class="empty">还没有屈光检查记录。建议近视防控儿童每 3 个月测眼轴建档。</div>'}
    </div>
  </div>`;
}
function openRefractiveForm(c, existing, onSaved) {
  const r = existing || {};
  const body = `<div class="form-grid">
    <div class="field"><label>检查日期</label><input class="input" id="rfDate" type="date" value="${esc(r.date || today())}"></div>
    <div class="field"><label>眼轴 R（mm）</label><input class="input" id="rfAlR" type="number" step="0.01" value="${esc(r.alR || '')}" placeholder="如 23.5"></div>
    <div class="field"><label>眼轴 L（mm）</label><input class="input" id="rfAlL" type="number" step="0.01" value="${esc(r.alL || '')}"></div>
    <div class="field"><label>角膜曲率 R</label><input class="input" id="rfCrR" type="number" step="0.01" value="${esc(r.crR || '')}" placeholder="如 43.0"></div>
    <div class="field"><label>角膜曲率 L</label><input class="input" id="rfCrL" type="number" step="0.01" value="${esc(r.crL || '')}"></div>
    <div class="field"><label>屈光度 R</label><input class="input" id="rfSphR" value="${esc(r.sphR || '')}" placeholder="-2.00"></div>
    <div class="field"><label>屈光度 L</label><input class="input" id="rfSphL" value="${esc(r.sphL || '')}"></div>
    <div class="field"><label>裸眼视力 R</label><input class="input" id="rfVaR" value="${esc(r.vaR || '')}" placeholder="如 0.8"></div>
    <div class="field"><label>裸眼视力 L</label><input class="input" id="rfVaL" value="${esc(r.vaL || '')}"></div>
    <div class="field"><label>远视储备</label><input class="input" id="rfReserve" value="${esc(r.reserve || '')}" placeholder="如 +0.50"></div>
    <div class="field span-2"><label>备注</label><input class="input" id="rfRemark" value="${esc(r.remark || '')}"></div>
  </div>
  <div class="hint">6~10 岁眼轴安全年增长 &lt; 0.20mm；AL/CR &gt; 2.90 建议散瞳验光（眼轴应用专家共识 2023）。</div>`;
  const { root, close } = openModal({ title: '新增屈光检查', subtitle: c.name, body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="rfSave">保存</button>`, size: 'wide' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#rfSave', root).addEventListener('click', async () => {
    const payload = { customerId: c.id, date: $('#rfDate', root).value || today(), alR: $('#rfAlR', root).value, alL: $('#rfAlL', root).value, crR: $('#rfCrR', root).value, crL: $('#rfCrL', root).value, sphR: $('#rfSphR', root).value.trim(), sphL: $('#rfSphL', root).value.trim(), vaR: $('#rfVaR', root).value.trim(), vaL: $('#rfVaL', root).value.trim(), reserve: $('#rfReserve', root).value.trim(), remark: $('#rfRemark', root).value.trim() };
    try { await api('/api/refractive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('屈光检查已保存'); if (onSaved) onSaved(); } catch (e) { toast(e.message, 'error'); }
  });
}

async function showCustomer(id) {
  try {
    const [c, ref] = await Promise.all([api('/api/customers/' + id), api('/api/refractive/' + id)]);
    const total = c.prescriptions.reduce((s, p) => s + Number(p.amount || 0), 0);
    const body = `
      <div class="detail-head">
        <div class="avatar">${esc((c.name || '?').slice(0, 1))}</div>
        <div>
          <div class="detail-name">${esc(c.name)} <span class="tag ${STAGE_COLOR[c.lifecycleStage] || ''}" style="margin-left:6px">${esc(c.lifecycleStage || '')}</span> ${c.rfm ? `<span class="tag" style="margin-left:4px">RFM ${c.rfm.R}${c.rfm.F}${c.rfm.M} · ${esc(c.rfm.segment)}</span>` : ''}</div>
          <div class="detail-meta">${esc(c.gender || '—')} · ${esc(c.age || '—')} 岁 · ${esc(c.phone || '无电话')} · ${esc(c.school || '')}</div>
          <div class="detail-meta">来源：${esc(c.source || '—')} ${c.sourceDetail ? ' / ' + esc(c.sourceDetail) : ''}</div>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><b>${c.prescriptions.length}</b><span>配镜次数</span></div>
        <div class="detail-stat"><b>${money(total)}</b><span>累计消费</span></div>
        <div class="detail-stat"><b>${esc(c.prescriptions[0]?.date || '—')}</b><span>最近配镜</span></div>
      </div>
      ${c.remark ? `<div class="customer-summary">备注：${esc(c.remark)}</div>` : ''}
      ${refractivePanel(ref, c)}
      <div class="panel" style="box-shadow:none">
        <div class="panel-head"><div class="panel-title">历史配镜记录</div><button class="btn sm primary" id="addForCustomer">＋ 给该客户开单</button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>日期</th><th class="num">金额</th><th>分类</th><th>框/产品</th><th>度数R</th><th>度数L</th><th>瞳高R/L</th><th>销售</th></tr></thead>
            <tbody>
              ${c.prescriptions.length ? c.prescriptions.map((p) => `
                <tr><td class="muted">${esc(p.date)}</td><td class="num money">${money(p.amount)}</td><td><span class="tag">${esc(p.category || '—')}</span></td><td>${esc(p.frame || '—')}</td><td class="muted">${esc(p.sphR || '—')}</td><td class="muted">${esc(p.sphL || '—')}</td><td class="muted">${p.phR && p.phL ? esc(p.phR + ' / ' + p.phL) : esc(p.phR || p.phL || '—')}</td><td>${esc(p.sales || '—')}</td></tr>`).join('') : '<tr><td colspan="8"><div class="empty">还没有配镜记录</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    const { root, close } = openModal({
      title: '客户详情', subtitle: '客户档案 + 屈光档案 + 历史处方', body,
      footer: `<button class="btn" data-cancel>关闭</button><button class="btn" id="editC">编辑客户</button>`,
      size: 'wide',
    });
    $('[data-cancel]', root).addEventListener('click', close);
    $('#editC', root).addEventListener('click', () => { close(); openCustomerForm(c); });
    const addRef = $('#addRefractive', root);
    if (addRef) addRef.addEventListener('click', () => openRefractiveForm(c, null, () => { close(); showCustomer(id); }));
    $$('[data-delref]', root).forEach((el) => el.addEventListener('click', async () => {
      if (!confirm('删除这条屈光检查记录？')) return;
      try { await api('/api/refractive/' + el.dataset.delref, { method: 'DELETE' }); close(); showCustomer(id); } catch (e) { toast(e.message, 'error'); }
    }));
    $('#addForCustomer', root).addEventListener('click', () => {
      close();
      const fake = { customerId: c.id, customerName: c.name, phone: c.phone, source: c.source };
      state.customers = state.customers.some((x) => x.id === c.id) ? state.customers : [...state.customers, c];
      openPrescriptionForm();
      setTimeout(() => {
        const sel = $('#pCustomer');
        if (sel) { sel.value = c.id; sel.dispatchEvent(new Event('change')); }
      }, 30);
    });
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------------- P1-M6/M4: 客户运营（RFM 唤醒 + 家庭账户） ---------------- */
const RFM_COLOR = { '重要价值': 'green', '重要发展': 'green', '重要保持': 'orange', '重要挽留': 'orange', '一般价值': '', '一般': 'gray', '流失预警': 'orange', '潜在': 'gray' };
async function renderOps() {
  const [rfm, families] = await Promise.all([api('/api/rfm-stats'), api('/api/families')]);
  $('#topActions').innerHTML = `<button class="btn primary" id="addFamily">＋ 新建家庭账户</button>`;
  const segTags = Object.entries(rfm.segDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="tag ${RFM_COLOR[k] || ''}">${esc(k)} ${v}</span>`).join('');
  const winRows = rfm.winback.map((w) => `<tr>
    <td><span class="link" data-customer="${esc(w.customerId)}">${esc(w.name)}</span></td>
    <td class="muted">${esc(w.phone || '—')}</td>
    <td><span class="tag ${RFM_COLOR[w.segment] || ''}">${esc(w.segment)}</span></td>
    <td class="num money">${money(w.total)}</td>
    <td class="num">${w.orderCount}</td>
    <td class="muted">${esc(w.lastDate || '—')}</td>
    <td class="num">${w.since != null ? w.since + ' 天' : '—'}</td>
    <td><button class="btn sm" data-customer="${esc(w.customerId)}">查看</button></td></tr>`).join('');
  const famRows = families.map((f) => `<tr>
    <td><span class="link" data-family="${esc(f.id)}">${esc(f.name)}</span></td>
    <td class="num">${f.memberCount}</td>
    <td class="muted">${esc((f.createdAt || '').slice(0, 10))}</td>
    <td class="muted">${esc(f.remark || '—')}</td>
    <td><div class="actions"><button class="btn sm" data-family="${esc(f.id)}">查看</button><button class="btn sm danger" data-delfam="${esc(f.id)}">删除</button></div></td></tr>`).join('');
  $('#view').innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head"><div><div class="panel-title">RFM 分层 · 沉睡唤醒</div><div class="panel-sub">高价值流失客户优先唤醒（重要挽留/重要保持）</div></div><span class="tag orange">待唤醒 ${rfm.winbackTotal}</span></div>
      <div class="panel-body">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${segTags}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>姓名</th><th>电话</th><th>分层</th><th class="num">累计消费</th><th class="num">次数</th><th>最近配镜</th><th class="num">距今</th><th>操作</th></tr></thead>
          <tbody>${winRows || '<tr><td colspan="8"><div class="empty">暂无高价值流失客户</div></td></tr>'}</tbody>
        </table></div>
        <div class="hint">召回券请在「营销活动」给对应会员发放；非会员可先建档升级。RFM：R 最近消费 / F 频率 / M 金额。</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">家庭账户</div><div class="panel-sub">以家庭为单位绑定成员 · 概览仅提示"该查没查"，不展示具体病情（分层授权）</div></div><span class="tag gray">${families.length} 个家庭</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>家庭</th><th class="num">成员数</th><th>创建</th><th>备注</th><th>操作</th></tr></thead>
        <tbody>${famRows || '<tr><td colspan="5"><div class="empty">还没有家庭账户，点右上角新建（如"张晓雨家庭"）</div></td></tr>'}</tbody>
      </table></div>
    </div>`;
  $('#addFamily').addEventListener('click', () => openFamilyForm());
  $$('[data-customer]').forEach((el) => el.addEventListener('click', () => showCustomer(el.dataset.customer)));
  $$('[data-family]').forEach((el) => el.addEventListener('click', () => showFamily(el.dataset.family)));
  $$('[data-delfam]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('删除该家庭账户？成员客户关系会解除（不删客户）。')) return;
    try { await api('/api/families/' + el.dataset.delfam, { method: 'DELETE' }); toast('已删除'); renderOps(); } catch (e) { toast(e.message, 'error'); }
  }));
}
function openFamilyForm() {
  const { root, close } = openModal({
    title: '新建家庭账户', subtitle: '以家庭为单位承接长期眼健康管理',
    body: `<div class="form-grid" style="grid-template-columns:1fr">
      <div class="field"><label>家庭名称 *</label><input class="input" id="famName" placeholder="如：张晓雨家庭 / 张氏家庭"></div>
      <div class="field"><label>备注</label><input class="input" id="famRemark" placeholder="如：孩子近视防控，父母干眼"></div>
    </div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="famSave">创建</button>`, size: 'narrow',
  });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#famSave', root).addEventListener('click', async () => {
    const name = $('#famName', root).value.trim();
    if (!name) return toast('家庭名称必填', 'error');
    try { await api('/api/families', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, remark: $('#famRemark', root).value.trim() }) }); close(); toast('家庭已创建'); renderOps(); } catch (e) { toast(e.message, 'error'); }
  });
}
async function showFamily(id) {
  try {
    const f = await api('/api/families/' + id);
    const rows = f.members.map((m) => `<tr>
      <td><span class="link" data-customer="${esc(m.id)}">${esc(m.name)}</span></td>
      <td>${esc(m.familyRole || '—')}</td>
      <td class="muted">${esc(m.relationNote || '—')}</td>
      <td><span class="tag ${STAGE_COLOR[m.lifecycleStage] || ''}">${esc(m.lifecycleStage)}</span></td>
      <td>${m.hasPending ? `<span class="tag orange">有 ${m.dueReview} 项该查</span>` : '<span class="tag green">无待查</span>'}</td>
      <td><button class="btn sm danger" data-unbind="${esc(m.id)}">移除</button></td></tr>`).join('');
    const { root, close } = openModal({
      title: esc(f.name), subtitle: `家庭账户 · ${f.members.length} 位成员`,
      body: `<div class="panel" style="box-shadow:none">
        <div class="panel-head"><div class="panel-title">家庭成员</div><button class="btn sm primary" id="bindMember">＋ 绑定成员</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>姓名</th><th>关系</th><th>备注</th><th>阶段</th><th>复查提示</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6"><div class="empty">还没有成员，点右上角绑定</div></td></tr>'}</tbody>
        </table></div>
        <div class="hint">概览只显示"该查没查"，不展示具体诊断与数值；查看明细需进入对应客户档案（分层授权）。</div>
      </div>`,
      footer: `<button class="btn" data-cancel>关闭</button>`, size: 'wide',
    });
    $('[data-cancel]', root).addEventListener('click', close);
    $('#bindMember', root).addEventListener('click', () => { close(); openBindMember(id); });
    $$('[data-customer]', root).forEach((el) => el.addEventListener('click', () => { close(); showCustomer(el.dataset.customer); }));
    $$('[data-unbind]', root).forEach((el) => el.addEventListener('click', async () => {
      try { await api(`/api/families/${id}/members/${el.dataset.unbind}`, { method: 'DELETE' }); close(); showFamily(id); } catch (e) { toast(e.message, 'error'); }
    }));
  } catch (e) { toast(e.message, 'error'); }
}
function openBindMember(familyId) {
  const { root, close } = openModal({
    title: '绑定家庭成员', subtitle: '选择已有客户加入家庭',
    body: `<div class="form-grid" style="grid-template-columns:1fr">
      <div class="field"><label>搜索客户</label><input class="input" id="bmSearch" placeholder="姓名 / 电话"></div>
      <div class="field"><label>选择客户</label><select class="select" id="bmCustomer" size="6"></select></div>
      <div class="field"><label>家庭关系</label><select class="select" id="bmRole"><option value="">请选择</option><option>户主</option><option>配偶</option><option>子女</option><option>父母</option><option>其他</option></select></div>
      <div class="field"><label>关系备注</label><input class="input" id="bmNote" placeholder="如：孩子近视防控"></div>
    </div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="bmSave">绑定</button>`, size: 'narrow',
  });
  const loadCustomers = async (q) => {
    const r = await api('/api/customers?pageSize=30' + (q ? '&search=' + encodeURIComponent(q) : ''));
    const list = r.items || r;
    $('#bmCustomer', root).innerHTML = list.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.phone || '无电话')}</option>`).join('');
  };
  loadCustomers('');
  let t; $('#bmSearch', root).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => loadCustomers(e.target.value.trim()), 250); });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#bmSave', root).addEventListener('click', async () => {
    const customerId = $('#bmCustomer', root).value;
    if (!customerId) return toast('请选择客户', 'error');
    try { await api(`/api/families/${familyId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId, familyRole: $('#bmRole', root).value, relationNote: $('#bmNote', root).value.trim() }) }); close(); toast('已绑定'); showFamily(familyId); } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- 会员管理 ---------------- */
async function renderMembers() {
  const [list, report, levels] = await Promise.all([
    api('/api/members?' + new URLSearchParams(Object.fromEntries(Object.entries(state.memberFilter).filter(([, v]) => v)))),
    api('/api/members-report'),
    api('/api/member-levels'),
  ]);
  state.members = list; state.memberReport = report; state.memberLevels = levels;

  $('#topActions').innerHTML = `<span class="tag orange">储值余额 ¥${Number(report.cashBalance).toLocaleString()}</span><button class="btn primary" id="addMember">＋ 新增会员</button>`;

  const maxLv = Math.max(1, ...report.levelDist.map((d) => d.value));
  $('#view').innerHTML = `
    <div class="grid stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${statCard('会员总数', report.totalMembers, '人', 'accent')}
      ${statCard('储值余额（负债）', '¥' + Number(report.cashBalance).toLocaleString(), '元', '')}
      ${statCard('赠送金额', '¥' + Number(report.giftTotal).toLocaleString(), '元 营销成本', 'teal')}
      ${statCard('会员消费占比', (report.memberRatio * 100).toFixed(1) + '%', '会员单 / 全部', '')}
    </div>

    <div class="grid two-col">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">会员档案</div><span class="tag gray">${list.length} 位</span></div>
        <div class="toolbar">
          <div class="field"><label>搜索</label><input class="input search" id="mSearch" placeholder="卡号 / 姓名 / 电话" value="${esc(state.memberFilter.search)}"></div>
          <div class="field"><label>等级</label><select class="select" id="mLevel"><option value="">全部</option>${levels.map((l) => `<option ${state.memberFilter.level === l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
          <div class="spacer"></div><button class="btn ghost" id="mReset">重置</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>卡号</th><th>姓名</th><th>电话</th><th>等级</th><th class="num">余额</th><th class="num">积分</th><th class="num">累计消费</th><th class="num">次数</th><th>卡项</th><th>操作</th></tr></thead>
          <tbody>${list.length ? list.map((m) => `
            <tr>
              <td class="muted">${esc(m.cardNo)}</td>
              <td><span class="link" data-member="${esc(m.id)}">${esc(m.name)}</span></td>
              <td class="muted">${esc(m.phone || '—')}</td>
              <td><span class="tag ${m.levelName === '钻石会员' ? 'orange' : m.levelName === '金卡会员' ? '' : 'gray'}">${esc(m.levelName)}</span></td>
              <td class="num money">¥${Number(m.balance).toLocaleString()}</td>
              <td class="num">${m.points || 0}</td>
              <td class="num">${money(m.totalSpend)}</td>
              <td class="num">${m.orderCount || 0}</td>
              <td>${m.activeCards ? `<span class="tag green">${m.activeCards} 张可用</span>` : '<span class="muted">—</span>'}</td>
              <td><div class="actions">
                <button class="btn sm" data-mrecharge="${esc(m.id)}">充值</button>
                <button class="btn sm" data-mcard="${esc(m.id)}">售卡</button>
                <button class="btn sm danger" data-mdel="${esc(m.id)}">删除</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="10"><div class="empty"><div class="big">☺</div>还没有会员，点右上角新增</div></td></tr>'}
          </tbody>
        </table></div>
      </div>

      <div class="panel">
        <div class="panel-head"><div class="panel-title">会员分析</div></div>
        <div class="panel-body">
          <div class="section-title">等级分布</div>
          ${report.levelDist.length ? report.levelDist.map((d) => `
            <div class="source-row">
              <div class="source-name">${esc(d.name)}</div>
              <div class="source-track"><div class="source-fill" style="width:${Math.max(3, (d.value / maxLv) * 100)}%"></div></div>
              <div class="source-val">${d.value} 人</div>
            </div>`).join('') : '<div class="muted">暂无数据</div>'}

          <div class="section-title" style="margin-top:18px">卡项到期提醒（30 天内）</div>
          ${report.expiring.length ? report.expiring.slice(0, 8).map((c) => `
            <div style="font-size:12px;padding:7px 0;border-bottom:1px dashed #eef2f7">
              <b>${esc(c.memberName)}</b> · ${esc(c.name)}
              <span class="${c.daysLeft < 0 ? 'tag orange' : 'tag gray'}">${c.daysLeft < 0 ? '已过期' : c.daysLeft + ' 天后到期'}</span>
              <span class="muted"> ${c.expireDate} · 余 ${c.totalTimes - c.usedTimes}/${c.totalTimes} 次</span>
            </div>`).join('') : '<div class="muted">近期没有到期卡项</div>'}

          <div class="section-title" style="margin-top:18px">沉睡会员（超 180 天未消费）</div>
          ${report.sleeping.length ? report.sleeping.slice(0, 8).map((m) => `
            <div style="font-size:12px;padding:7px 0;border-bottom:1px dashed #eef2f7">
              <span class="link" data-member="${esc(m.id)}">${esc(m.name)}</span>
              <span class="muted"> 最近消费 ${esc(m.lastDate)} · 累计 ${money(m.totalSpend)}</span>
            </div>`).join('') : '<div class="muted">没有沉睡会员 👍</div>'}

          <div class="section-title" style="margin-top:18px">积分排行</div>
          ${report.pointsTop.length ? report.pointsTop.slice(0, 6).map((p, i) => `
            <div class="rank-row" style="margin-bottom:9px">
              <div class="rank-no">${i + 1}</div><div class="rank-name">${esc(p.name)} <span class="muted">${esc(p.level)}</span></div>
              <div class="rank-val">${p.points} 分</div>
            </div>`).join('') : '<div class="muted">暂无数据</div>'}
        </div>
      </div>
    </div>`;

  let t;
  $('#mSearch').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.memberFilter.search = e.target.value.trim(); renderMembers(); }, 250); });
  $('#mLevel').addEventListener('change', (e) => { state.memberFilter.level = e.target.value; renderMembers(); });
  $('#mReset').addEventListener('click', () => { state.memberFilter = { search: '', level: '' }; renderMembers(); });
  $('#addMember').addEventListener('click', () => openMemberForm());
  $$('[data-member]').forEach((el) => el.addEventListener('click', () => showMember(el.dataset.member)));
  $$('[data-mrecharge]').forEach((el) => el.addEventListener('click', () => openRecharge(el.dataset.mrecharge)));
  $$('[data-mcard]').forEach((el) => el.addEventListener('click', () => openSellCard(el.dataset.mcard)));
  $$('[data-mdel]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('确定删除该会员？其卡项与流水记录会一并删除。')) return;
    try { await api('/api/members/' + el.dataset.mdel, { method: 'DELETE' }); toast('已删除'); renderMembers(); } catch (e) { toast(e.message, 'error'); }
  }));
}

function openMemberForm() {
  const body = `
    <div class="form-grid">
      <div class="field"><label>姓名 *</label><input class="input" id="mfName"></div>
      <div class="field"><label>电话</label><input class="input" id="mfPhone"></div>
      <div class="field"><label>性别</label><select class="select" id="mfGender"><option value="">请选择</option><option>男</option><option>女</option></select></div>
      <div class="field"><label>年龄</label><input class="input" id="mfAge" type="number" min="0" max="120"></div>
      <div class="field"><label>生日（MM-DD）</label><input class="input" id="mfBirthday" placeholder="如 03-15"></div>
      <div class="field"><label>来源</label><select class="select" id="mfSource"><option value="">请选择</option>${(state.settings.sources || []).map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
      <div class="field span-2"><label>卡号</label><input class="input" id="mfCardNo" placeholder="留空自动生成"></div>
      <div class="field span-2"><label>备注</label><input class="input" id="mfRemark"></div>
    </div>
    <div class="hint">建档后会自动关联同名/同电话的客户档案；已有客户也可在「客户管理」里直接升级为会员。</div>`;
  const { root, close } = openModal({ title: '新增会员', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="mfSave">保存</button>`, size: 'narrow' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#mfSave', root).addEventListener('click', async () => {
    const payload = { name: $('#mfName', root).value.trim(), phone: $('#mfPhone', root).value.trim(), gender: $('#mfGender', root).value, age: $('#mfAge', root).value, birthday: $('#mfBirthday', root).value.trim(), source: $('#mfSource', root).value, cardNo: $('#mfCardNo', root).value.trim(), remark: $('#mfRemark', root).value.trim() };
    if (!payload.name) return toast('姓名必填', 'error');
    try { await api('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('会员已创建'); renderMembers(); } catch (e) { toast(e.message, 'error'); }
  });
}

async function showMember(id) {
  try {
    const m = await api('/api/members/' + id);
    const body = `
      <div class="detail-head">
        <div class="avatar">${esc((m.name || '?').slice(0, 1))}</div>
        <div>
          <div class="detail-name">${esc(m.name)} <span class="tag ${m.levelName === '钻石会员' ? 'orange' : ''}" style="margin-left:6px">${esc(m.levelName)}</span></div>
          <div class="detail-meta">${esc(m.cardNo)} · ${esc(m.phone || '无电话')} · ${esc(m.benefit || '')}</div>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><b>¥${Number(m.balance).toLocaleString()}</b><span>储值余额</span></div>
        <div class="detail-stat"><b>${m.points || 0}</b><span>积分</span></div>
        <div class="detail-stat"><b>${money(m.totalSpend)}</b><span>累计消费</span></div>
        <div class="detail-stat"><b>${m.orderCount || 0}</b><span>消费次数</span></div>
        <div class="detail-stat"><b>¥${Number(m.totalRecharge).toLocaleString()}</b><span>累计充值</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn primary" id="mdRecharge">充值</button>
        <button class="btn" id="mdSellCard">售卡</button>
      </div>
      <div class="panel" style="box-shadow:none">
        <div class="panel-head"><div class="panel-title">持有卡项</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>卡项</th><th>类型</th><th class="num">进度</th><th class="num">价格</th><th>有效期</th><th>操作</th></tr></thead>
          <tbody>${m.cards.length ? m.cards.map((c) => `
            <tr>
              <td>${esc(c.name)}</td>
              <td><span class="tag gray">${esc(c.type)}</span></td>
              <td class="num">${c.usedTimes}/${c.totalTimes}</td>
              <td class="num">${money(c.price)}</td>
              <td class="muted">${esc(c.expireDate || '不限')}</td>
              <td>${c.usedTimes < c.totalTimes ? `<button class="btn sm" data-use="${esc(c.id)}">核销一次</button>` : '<span class="tag gray">已用完</span>'}</td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="empty">还没有卡项</div></td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="panel" style="box-shadow:none;margin-top:14px">
        <div class="panel-head"><div class="panel-title">资金 / 积分流水</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>日期</th><th>类型</th><th class="num">金额</th><th class="num">积分</th><th class="num">余额</th><th>备注</th></tr></thead>
          <tbody>${m.txns.length ? m.txns.slice(0, 30).map((t) => `
            <tr><td class="muted">${esc(t.date)}</td><td><span class="tag ${t.amount < 0 ? 'orange' : t.amount > 0 ? 'green' : 'gray'}">${esc(t.type)}</span></td>
            <td class="num money">${t.amount ? (t.amount > 0 ? '+' : '') + t.amount : '—'}</td>
            <td class="num">${t.points ? (t.points > 0 ? '+' : '') + t.points : '—'}</td>
            <td class="num">¥${Number(t.balanceAfter).toLocaleString()}</td>
            <td class="muted">${esc(t.remark || '—')}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty">还没有流水</div></td></tr>'}</tbody>
        </table></div>
      </div>
      ${m.prescriptions.length ? `<div class="panel" style="box-shadow:none;margin-top:14px">
        <div class="panel-head"><div class="panel-title">配镜消费记录</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>日期</th><th class="num">金额</th><th>分类</th><th>框/产品</th><th>支付方式</th></tr></thead>
          <tbody>${m.prescriptions.map((p) => `<tr><td class="muted">${esc(p.date)}</td><td class="num money">${money(p.amount)}</td><td>${esc(p.category || '—')}</td><td>${esc(p.frame || '—')}</td><td><span class="tag gray">${esc(p.payMethod || '—')}</span></td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}`;
    const { root, close } = openModal({ title: '会员详情', subtitle: '储值 · 卡项 · 积分 · 消费', body, footer: `<button class="btn" data-cancel>关闭</button>`, size: 'wide' });
    $('[data-cancel]', root).addEventListener('click', close);
    $('#mdRecharge', root).addEventListener('click', () => { close(); openRecharge(id); });
    $('#mdSellCard', root).addEventListener('click', () => { close(); openSellCard(id); });
    $$('[data-use]', root).forEach((el) => el.addEventListener('click', async () => {
      try { await api(`/api/members/${id}/cards/${el.dataset.use}/use`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); toast('已核销 1 次'); close(); showMember(id); renderMembers(); } catch (e) { toast(e.message, 'error'); }
    }));
  } catch (e) { toast(e.message, 'error'); }
}

function openRecharge(id) {
  const body = `
    <div class="form-grid" style="grid-template-columns:1fr 1fr">
      <div class="field"><label>充值金额（元）*</label><input class="input" id="rcAmt" type="number" min="0" step="1" placeholder="如 1000"></div>
      <div class="field"><label>赠送金额（元）</label><input class="input" id="rcGift" type="number" min="0" step="1" placeholder="如 100"></div>
      <div class="field span-2"><label>备注</label><input class="input" id="rcRemark" placeholder="如：充 1000 送 100"></div>
    </div>
    <div class="hint">充值会同时增加积分（当前 ${state.settings.pointsPerRecharge || 1} 分/元），赠送金额计入营销成本。</div>`;
  const { root, close } = openModal({ title: '会员充值', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="rcSave">确认充值</button>`, size: 'narrow' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#rcSave', root).addEventListener('click', async () => {
    const payload = { amount: Number($('#rcAmt', root).value || 0), gift: Number($('#rcGift', root).value || 0), remark: $('#rcRemark', root).value.trim() };
    if (!payload.amount && !payload.gift) return toast('请填写金额', 'error');
    try { await api(`/api/members/${id}/recharge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('充值成功'); showMember(id); renderMembers(); } catch (e) { toast(e.message, 'error'); }
  });
}

function openSellCard(id) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>卡项类型</label><select class="select" id="scType">
        <option>框架卡</option><option>隐形眼镜卡</option><option>储值卡</option><option>折扣卡</option><option>其他</option></select></div>
      <div class="field"><label>卡项名称</label><input class="input" id="scName" placeholder="如：框架卡 3 次"></div>
      <div class="field"><label>总次数</label><input class="input" id="scTimes" type="number" min="1" value="3"></div>
      <div class="field"><label>售价（元）</label><input class="input" id="scPrice" type="number" min="0" step="1" placeholder="如 999"></div>
      <div class="field span-2"><label>有效期至</label><input class="input" id="scExpire" type="date"></div>
    </div>
    <div class="hint">售卡金额会计入会员累计消费并折算积分。储值请用「充值」，不要用售卡。</div>`;
  const { root, close } = openModal({ title: '售卡', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="scSave">确认售卡</button>`, size: 'narrow' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#scSave', root).addEventListener('click', async () => {
    const payload = { type: $('#scType', root).value, name: $('#scName', root).value.trim() || $('#scType', root).value, totalTimes: Number($('#scTimes', root).value || 1), price: Number($('#scPrice', root).value || 0), expireDate: $('#scExpire', root).value };
    try { await api(`/api/members/${id}/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('售卡成功'); showMember(id); renderMembers(); } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- 营销活动 ---------------- */
async function renderMarketing() {
  const [activities, coupons, stats] = await Promise.all([
    api('/api/activities'), api('/api/coupons'), api('/api/marketing/stats'),
  ]);
  state.activities = activities; state.coupons = coupons; state.marketingStats = stats;
  const T = today();

  $('#topActions').innerHTML = `<button class="btn" id="addCoupon">＋ 新建优惠券</button><button class="btn primary" id="addActivity">＋ 新建活动</button>`;

  $('#view').innerHTML = `
    <div class="grid stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${statCard('进行中活动', stats.activeCount, '个', 'accent')}
      ${statCard('累计发放券', stats.totalGranted, '张', '')}
      ${statCard('已核销券', stats.totalUsed, '张', 'teal')}
      ${statCard('15 天内到期券', stats.expiringCoupons, '张（提醒召回）', '')}
    </div>

    <div class="grid two-col">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">活动</div><span class="tag gray">${activities.length} 个</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>活动</th><th>类型</th><th>规则</th><th>期间</th><th>状态</th><th class="num">参与</th><th>操作</th></tr></thead>
          <tbody>${activities.length ? activities.map((a) => `
            <tr>
              <td><b>${esc(a.name)}</b></td>
              <td><span class="tag ${a.type === '充值赠送' ? 'green' : a.type === '配镜满减' ? 'orange' : ''}">${esc(a.type)}</span></td>
              <td class="muted">${activityRule(a)}</td>
              <td class="muted">${esc(a.startDate || '不限')}${a.endDate ? ' ~ ' + esc(a.endDate) : ''}</td>
              <td>${a.status === '进行中' ? '<span class="tag green">进行中</span>' : '<span class="tag gray">' + esc(a.status) + '</span>'}</td>
              <td class="num">${a.usedCount || 0}</td>
              <td><div class="actions">
                <button class="btn sm" data-atoggle="${esc(a.id)}" data-status="${esc(a.status)}">${a.status === '进行中' ? '停用' : '启用'}</button>
                <button class="btn sm danger" data-adel="${esc(a.id)}">删除</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="empty"><div class="big">%</div>还没有活动，点右上角新建</div></td></tr>'}
          </tbody>
        </table></div>
      </div>

      <div class="panel">
        <div class="panel-head"><div class="panel-title">优惠券</div><span class="tag gray">${coupons.length} 种</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>券名</th><th>面额</th><th>门槛</th><th class="num">已发/已用</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${coupons.length ? coupons.map((c) => `
            <tr>
              <td><b>${esc(c.name)}</b>${c.scopeCategory ? `<span class="muted" style="font-size:11px"> · 限${esc(c.scopeCategory)}</span>` : ''}</td>
              <td>${c.type === '折扣' ? (Number(c.faceValue) * 10).toFixed(1) + ' 折' : '¥' + c.faceValue}</td>
              <td class="muted">${c.threshold ? '满 ' + c.threshold : '无门槛'}</td>
              <td class="num">${c.grantedCount} / ${c.usedCount}</td>
              <td>${c.status === '启用' ? '<span class="tag green">启用</span>' : '<span class="tag gray">停用</span>'}</td>
              <td><div class="actions">
                <button class="btn sm primary" data-cgrant="${esc(c.id)}">发放</button>
                <button class="btn sm danger" data-cdel="${esc(c.id)}">删除</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="empty"><div class="big">%</div>还没有优惠券</div></td></tr>'}
          </tbody>
        </table></div>
      </div>
    </div>

    <div class="grid two-col-2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">券使用效果</div></div>
        <div class="panel-body">
          ${stats.couponStats.length ? stats.couponStats.map((c) => `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <b>${esc(c.name)}</b><span class="muted">${c.used}/${c.granted} · ${c.useRate}%</span>
              </div>
              <div class="rank-bar" style="margin-top:5px"><span style="width:${c.useRate}%"></span></div>
            </div>`).join('') : '<div class="muted">暂无数据</div>'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">活动效果</div></div>
        <div class="panel-body">
          ${stats.activityStats.length ? stats.activityStats.map((a) => `
            <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #eef2f7;font-size:12px">
              <span><b>${esc(a.name)}</b> <span class="muted">${esc(a.type)}</span></span>
              <span class="muted">参与 ${a.usedCount} 次 · 带来 ${money(a.amount)}${a.giftCost ? ' · 赠送成本 ¥' + a.giftCost : ''}</span>
            </div>`).join('') : '<div class="muted">暂无数据</div>'}
        </div>
      </div>
    </div>`;

  $('#addActivity').addEventListener('click', openActivityForm);
  $('#addCoupon').addEventListener('click', openCouponForm);
  $$('[data-atoggle]').forEach((el) => el.addEventListener('click', async () => {
    try { await api('/api/activities/' + el.dataset.atoggle, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: el.dataset.status === '进行中' ? '已停用' : '进行中' }) }); renderMarketing(); } catch (e) { toast(e.message, 'error'); }
  }));
  $$('[data-adel]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('删除该活动？')) return;
    try { await api('/api/activities/' + el.dataset.adel, { method: 'DELETE' }); toast('已删除'); renderMarketing(); } catch (e) { toast(e.message, 'error'); }
  }));
  $$('[data-cgrant]').forEach((el) => el.addEventListener('click', () => openGrantCoupon(el.dataset.cgrant)));
  $$('[data-cdel]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('删除该优惠券及其发放记录？')) return;
    try { await api('/api/coupons/' + el.dataset.cdel, { method: 'DELETE' }); toast('已删除'); renderMarketing(); } catch (e) { toast(e.message, 'error'); }
  }));
}

function activityRule(a) {
  if (a.type === '充值赠送') return `充 ${a.threshold} 送 ${a.giftAmount}`;
  if (a.type === '配镜满减') return `满 ${a.threshold} 减 ${a.reward}${a.scopeCategory ? '（限' + a.scopeCategory + '）' : ''}`;
  if (a.type === '双倍积分') return `满 ${a.threshold} 积分 x${a.multiplier}`;
  if (a.type === '老带新') return a.remark || '介绍有礼';
  return a.remark || '';
}

function openActivityForm() {
  const body = `
    <div class="form-grid">
      <div class="field"><label>活动名称 *</label><input class="input" id="afName" placeholder="如：开学季充值充1000送200"></div>
      <div class="field"><label>活动类型</label><select class="select" id="afType">
        <option>充值赠送</option><option>配镜满减</option><option>双倍积分</option><option>老带新</option></select></div>
      <div class="field"><label>门槛金额（元）</label><input class="input" id="afThreshold" type="number" min="0" value="1000"></div>
      <div class="field"><label>优惠 / 赠送（元）</label><input class="input" id="afReward" type="number" min="0" value="0"></div>
      <div class="field"><label>积分倍数（双倍积分用）</label><input class="input" id="afMul" type="number" min="1" value="2"></div>
      <div class="field"><label>限会员等级</label><select class="select" id="afLevel"><option value="">全部会员</option>${(state.memberLevels || []).map((l) => `<option>${esc(l.name)}</option>`).join('')}</select></div>
      <div class="field"><label>限配镜分类</label><select class="select" id="afCat"><option value="">全部</option>${(state.settings.categories || []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>开始日期</label><input class="input" id="afStart" type="date"></div>
      <div class="field"><label>结束日期</label><input class="input" id="afEnd" type="date"></div>
      <div class="field span-2"><label>说明</label><input class="input" id="afRemark" placeholder="如：仅限到店客户"></div>
    </div>
    <div class="hint">充值赠送：充值满门槛自动加送；配镜满减：开单时自动抵扣；双倍积分：消费达标积分翻倍。</div>`;
  const { root, close } = openModal({ title: '新建活动', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="afSave">保存并启用</button>`, size: 'wide' });
  $('[data-cancel]', root).addEventListener('click', close);
  const sync = () => {
    const t = $('#afType', root).value;
    $('#afReward', root).closest('.field').style.opacity = (t === '充值赠送' || t === '配镜满减') ? 1 : .4;
    $('#afMul', root).closest('.field').style.opacity = t === '双倍积分' ? 1 : .4;
  };
  $('#afType', root).addEventListener('change', sync); sync();
  $('#afSave', root).addEventListener('click', async () => {
    const payload = {
      name: $('#afName', root).value.trim(), type: $('#afType', root).value,
      threshold: Number($('#afThreshold', root).value || 0),
      reward: Number($('#afReward', root).value || 0),
      giftAmount: Number($('#afReward', root).value || 0),
      multiplier: Number($('#afMul', root).value || 2),
      memberLevel: $('#afLevel', root).value, scopeCategory: $('#afCat', root).value,
      startDate: $('#afStart', root).value, endDate: $('#afEnd', root).value, remark: $('#afRemark', root).value.trim(),
    };
    if (!payload.name) return toast('活动名称必填', 'error');
    try { await api('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('活动已创建'); renderMarketing(); } catch (e) { toast(e.message, 'error'); }
  });
}

function openCouponForm() {
  const body = `
    <div class="form-grid">
      <div class="field"><label>券名称 *</label><input class="input" id="cpName" placeholder="如：开学季满500减50"></div>
      <div class="field"><label>券类型</label><select class="select" id="cpType"><option>满减</option><option>折扣</option><option>现金</option></select></div>
      <div class="field"><label>面额（元）/ 折扣率</label><input class="input" id="cpValue" type="number" min="0" step="0.01" value="50"><div class="hint">折扣请填 0.9 表示 9 折</div></div>
      <div class="field"><label>使用门槛（元）</label><input class="input" id="cpThreshold" type="number" min="0" value="0"></div>
      <div class="field"><label>限配镜分类</label><select class="select" id="cpCat"><option value="">全部通用</option>${(state.settings.categories || []).map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>领取后有效天数</label><input class="input" id="cpDays" type="number" min="1" value="90"></div>
      <div class="field"><label>发放总量（0=不限）</label><input class="input" id="cpQty" type="number" min="0" value="0"></div>
      <div class="field"><label>有效期起</label><input class="input" id="cpStart" type="date"></div>
      <div class="field"><label>有效期止</label><input class="input" id="cpEnd" type="date"></div>
    </div>`;
  const { root, close } = openModal({ title: '新建优惠券', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="cpSave">保存</button>`, size: 'wide' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#cpSave', root).addEventListener('click', async () => {
    const payload = {
      name: $('#cpName', root).value.trim(), type: $('#cpType', root).value,
      faceValue: Number($('#cpValue', root).value || 0), threshold: Number($('#cpThreshold', root).value || 0),
      scopeCategory: $('#cpCat', root).value, validDays: Number($('#cpDays', root).value || 90),
      totalQty: Number($('#cpQty', root).value || 0), startDate: $('#cpStart', root).value, endDate: $('#cpEnd', root).value,
    };
    if (!payload.name) return toast('券名称必填', 'error');
    try { await api('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); close(); toast('优惠券已创建'); renderMarketing(); } catch (e) { toast(e.message, 'error'); }
  });
}

async function openGrantCoupon(couponId) {
  const [members, coupon] = await Promise.all([api('/api/members'), api('/api/coupons')]);
  const c = coupon.find((x) => x.id === couponId);
  const body = `
    <div class="form-grid" style="grid-template-columns:1fr">
      <div class="field"><label>优惠券</label><input class="input" value="${esc(c ? c.name : '')} — ${c && c.type === '折扣' ? (Number(c.faceValue) * 10).toFixed(1) + ' 折' : '¥' + (c ? c.faceValue : 0)}${c && c.threshold ? '，满 ' + c.threshold + ' 可用' : ''}" disabled></div>
      <div class="field"><label>发给谁（可多选，留空 = 发给全部会员）</label>
        <select class="select" id="grMembers" multiple size="8">
          ${members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)} · ${esc(m.levelName)} · ${esc(m.phone || '无电话')}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="hint">不选则发给全部 ${members.length} 位会员。券的有效期为领取后 ${c ? c.validDays : 90} 天。</div>`;
  const { root, close } = openModal({ title: '发放优惠券', body, footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="grSave">确认发放</button>`, size: 'narrow' });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#grSave', root).addEventListener('click', async () => {
    const sel = $('#grMembers', root);
    const ids = [...sel.selectedOptions].map((o) => o.value);
    try {
      const r = await api(`/api/coupons/${couponId}/grant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: ids }) });
      close(); toast('已发放 ' + r.count + ' 张'); renderMarketing();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- 回访提醒 ---------------- */
const FU_PRODUCT_COLOR = { 'OK镜': 'orange', '离焦防控镜': 'orange', '隐形眼镜': 'green', '视训': 'green' };
async function renderFollowups() {
  const fp = state._fuProduct || '';
  const fuPageSize = 30;
  const fuPage = state._fuPage || 1;
  const params = new URLSearchParams({ page: fuPage, pageSize: fuPageSize });
  if (fp) params.set('productType', fp);
  const [resp, history] = await Promise.all([api('/api/followups/suggestions?' + params), api('/api/followups')]);
  const pageItems = resp.items || [];
  const total = resp.total || 0;
  const dueCount = resp.dueCount || 0;
  const soonCount = resp.soonCount || 0;
  const products = resp.products || [];
  const fuPages = Math.max(1, Math.ceil(total / fuPageSize));
  $('#topActions').innerHTML = `<span class="tag orange">待回访 ${dueCount}</span><span class="tag gray">未来 7 天 ${soonCount}</span>`;

  const card = (s) => `
    <div class="panel" style="margin-bottom:12px">
      <div class="panel-body" style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:0 0 auto">
          <span class="tag ${FU_PRODUCT_COLOR[s.productType] || ''}">${esc(s.productType)}</span>
          <div style="font-size:12px;font-weight:600;margin-top:6px">${esc(s.stageLabel || s.type)}</div>
          <div style="margin-top:6px;font-size:12px" class="${s.overdue ? '' : 'muted'}">
            ${s.overdue ? `<b style="color:var(--danger)">已逾期 ${-s.daysDiff} 天</b>` : `${s.daysDiff} 天后到期`}
          </div>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="font-weight:650;font-size:15px"><span class="link" data-customer="${esc(s.customerId)}">${esc(s.customerName)}</span>
            <span class="muted" style="font-weight:400;font-size:12px"> ${esc(s.phone || '无电话')} · ${esc(s.age || '—')} 岁 ${s.school ? '· ' + esc(s.school) : ''}</span></div>
          <div class="muted" style="font-size:12px;margin-top:4px">上次配镜 ${esc(s.lastDate)} · ${esc(s.lastCategory || '—')} · ${money(s.lastAmount)} · 应复查日期 ${esc(s.dueDate)}</div>
          <div style="font-size:12px;color:#475569;background:#f8fbff;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.6">💬 ${esc(s.script)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn sm primary" data-done="${esc(s.key)}">✓ 已回访</button>
          <button class="btn sm" data-skip="${esc(s.key)}">跳过</button>
        </div>
      </div>
    </div>`;

  $('#view').innerHTML = `
    <div class="panel" style="margin-bottom:14px"><div class="toolbar">
      <div class="field"><label>产品类型</label><select class="select" id="fuProduct"><option value="">全部</option>${products.map((x) => `<option ${fp === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="spacer"></div>
      <span class="muted" style="font-size:12px">随访按临床规范自动生成（OK镜 1天/1周/2周/1月/3月/每2-3月；防控每3月眼轴）</span>
    </div></div>
    ${pageItems.length ? pageItems.map(card).join('') : '<div class="panel"><div class="empty"><div class="big">✓</div>太棒了，当前没有到期未回访的客户</div></div>'}
    ${total > fuPageSize ? `<div class="panel" style="margin-top:12px"><div style="display:flex;gap:8px;align-items:center;padding:10px 4px;flex-wrap:wrap">
      <button class="btn sm" id="fuPrev" ${fuPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="muted" style="font-size:12px">第 ${fuPage} / ${fuPages} 页 · 共 ${total} 条待回访</span>
      <button class="btn sm" id="fuNext" ${fuPage >= fuPages ? 'disabled' : ''}>下一页</button>
    </div></div>` : ''}
    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><div class="panel-title">回访记录</div><span class="tag gray">${history.length} 条</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>时间</th><th>客户</th><th>类型</th><th>结果</th><th>备注</th></tr></thead>
        <tbody>${history.length ? history.slice(0, 50).map((f) => {
          return `<tr><td class="muted">${esc((f.doneAt || f.createdAt || '').slice(0, 10))}</td><td>${esc(f.customerName || f.customerId)}</td><td><span class="tag">${esc(f.type)}</span></td><td>${f.status === 'done' ? '<span class="tag green">已回访</span>' : '<span class="tag gray">跳过</span>'}</td><td class="muted">${esc(f.note || '—')}</td></tr>`;
        }).join('') : '<tr><td colspan="5"><div class="empty">还没有回访记录</div></td></tr>'}</tbody>
      </table></div>
    </div>`;

  $('#fuProduct').addEventListener('change', (e) => { state._fuProduct = e.target.value; state._fuPage = 1; renderFollowups(); });
  const fuPrev = $('#fuPrev'), fuNext = $('#fuNext');
  if (fuPrev) fuPrev.onclick = () => { state._fuPage = fuPage - 1; renderFollowups(); };
  if (fuNext) fuNext.onclick = () => { state._fuPage = fuPage + 1; renderFollowups(); };
  const findSugg = (key) => pageItems.find((s) => s.key === key);
  const mark = (key, status) => {
    const s = findSugg(key); if (!s) return;
    const { root, close } = openModal({
      title: status === 'done' ? '标记已回访' : '跳过本次回访', subtitle: `${s.customerName} · ${s.type}`,
      body: `<div class="field"><label>备注（回访结果 / 跳过原因）</label><textarea class="input" id="fuNote" placeholder="${status === 'done' ? '如：已电话回访，客户下周到店复查' : '如：客户表示暂时不需要'}"></textarea></div>`,
      footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="fuSave">保存</button>`, size: 'narrow',
    });
    $('[data-cancel]', root).addEventListener('click', close);
    $('#fuSave', root).addEventListener('click', async () => {
      try { await api('/api/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: s.customerId, type: s.type, basedOn: s.basedOn, productType: s.productType, stageIndex: s.stageIndex, stageLabel: s.stageLabel, status, note: $('#fuNote', root).value.trim() }) }); close(); toast(status === 'done' ? '已记录回访' : '已跳过'); renderFollowups(); }
      catch (e) { toast(e.message, 'error'); }
    });
  };
  $$('[data-done]').forEach((el) => el.addEventListener('click', () => mark(el.dataset.done, 'done')));
  $$('[data-skip]').forEach((el) => el.addEventListener('click', () => mark(el.dataset.skip, 'skipped')));
  $$('[data-customer]').forEach((el) => el.addEventListener('click', () => showCustomer(el.dataset.customer)));
}

/* ---------------- 员工管理 ---------------- */
async function renderStaff() {
  const list = await api('/api/staff');
  state.staff = list;
  $('#topActions').innerHTML = `<button class="btn primary" id="addStaff">＋ 新增员工</button>`;
  const roles = state.settings.staffRoles || ['医生', '销售', '制作'];
  $('#view').innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <span class="tag gray">共 ${list.length} 人</span>
        <div class="spacer"></div>
        <span class="muted" style="font-size:12px">医生、销售、制作人员会出现在配镜表单的候选列表中</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>姓名</th><th>岗位</th><th>电话</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${list.length ? list.map((s) => `
              <tr>
                <td>${esc(s.name)}</td>
                <td><span class="tag ${s.role === '医生' ? 'green' : s.role === '销售' ? '' : 'orange'}">${esc(s.role)}</span></td>
                <td class="muted">${esc(s.phone || '—')}</td>
                <td>${s.active === false ? '<span class="tag gray">停用</span>' : '<span class="tag green">在职</span>'}</td>
                <td><div class="actions">
                  <button class="btn sm" data-edits="${esc(s.id)}">编辑</button>
                  <button class="btn sm danger" data-dels="${esc(s.id)}">删除</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="5"><div class="empty">还没有员工</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  $('#addStaff').addEventListener('click', () => openStaffForm());
  $$('[data-edits]').forEach((el) => el.addEventListener('click', () => {
    const s = list.find((x) => x.id === el.dataset.edits);
    if (s) openStaffForm(s);
  }));
  $$('[data-dels]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('确定删除该员工？')) return;
    try { await api('/api/staff/' + el.dataset.dels, { method: 'DELETE' }); toast('已删除'); renderStaff(); }
    catch (e) { toast(e.message, 'error'); }
  }));
}

function openStaffForm(s = null) {
  const roles = state.settings.staffRoles || ['医生', '销售', '制作'];
  const body = `
    <div class="form-grid">
      <div class="field"><label>姓名 *</label><input class="input" id="sName" value="${esc(s?.name || '')}"></div>
      <div class="field"><label>岗位</label><select class="select" id="sRole">${roles.map((r) => `<option ${s?.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
      <div class="field"><label>电话</label><input class="input" id="sPhone" value="${esc(s?.phone || '')}"></div>
      <div class="field"><label>状态</label><select class="select" id="sActive"><option value="true" ${s?.active !== false ? 'selected' : ''}>在职</option><option value="false" ${s?.active === false ? 'selected' : ''}>停用</option></select></div>
    </div>`;
  const { root, close } = openModal({
    title: s ? '编辑员工' : '新增员工', body,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn primary" id="saveS">保存</button>`,
    size: 'narrow',
  });
  $('[data-cancel]', root).addEventListener('click', close);
  $('#saveS', root).addEventListener('click', async () => {
    const payload = { name: $('#sName', root).value.trim(), role: $('#sRole', root).value, phone: $('#sPhone', root).value.trim(), active: $('#sActive', root).value === 'true' };
    if (!payload.name) return toast('姓名必填', 'error');
    try {
      if (s) await api('/api/staff/' + s.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      else await api('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      close(); toast(s ? '员工已更新' : '员工已添加'); renderStaff();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------- 导入 / 导出 ---------------- */
function renderImport() {
  $('#topActions').innerHTML = '';
  $('#view').innerHTML = `
    <div class="import-grid">
      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">导入配镜记录</div><div class="panel-sub">支持 .xlsx / .xls，列名与原表一致</div></div>
        </div>
        <div class="panel-body">
          <div class="dropzone" id="dropzone">
            <div class="big">⇪</div>
            <div class="t1">点击选择 Excel，或把文件拖到这里</div>
            <div class="t2">表头需包含：备注、日期、姓名、性别、年龄、电话、学校、来源、来源明细、金额、医生、销售、制作、公司、分类方式、框/产品、型号、片、度数R、度数L、瞳距、RPD、LPD、瞳高R、瞳高L、产品类型、抛弃周期</div>
            <input type="file" id="fileInput" accept=".xlsx,.xls" style="display:none">
          </div>
          <div id="fileName" class="muted" style="margin-top:10px;font-size:12px"></div>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primary" id="doImport" disabled>开始导入</button>
            <a class="btn" href="${authUrl('/api/template')}">下载空白模板</a>
            <a class="btn" href="${authUrl('/api/export')}">导出全部记录</a>
          </div>
          <div id="importResult"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><div class="panel-title">导入说明</div></div>
        <div class="panel-body">
          <div class="steps">
            <div class="step"><div class="step-no">1</div><div><div class="step-title">沿用原表头</div><div class="step-text">列名、列顺序不用改；多出来的列会被忽略。</div></div></div>
            <div class="step"><div class="step-no">2</div><div><div class="step-title">客户自动去重</div><div class="step-text">按「电话」匹配已有客户；没有电话时按「姓名 + 电话」新建。同一客户多次配镜会归到同一档案。</div></div></div>
            <div class="step"><div class="step-no">3</div><div><div class="step-title">金额与日期</div><div class="step-text">金额只填数字；日期支持 2026-11-02、2026/11/2、Excel 日期格式。</div></div></div>
            <div class="step"><div class="step-no">4</div><div><div class="step-title">先备份再导入</div><div class="step-text">导入前建议先导出一次当前数据；数据保存在 app/data/db.json，可直接复制备份。</div></div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="panel-head">
        <div><div class="panel-title">数据维护</div><div class="panel-sub">备份、批量清理测试数据</div></div>
      </div>
      <div class="panel-body">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <a class="btn" href="${authUrl('/api/backup')}">下载完整备份（JSON）</a>
          <button class="btn danger" id="btnClearDemo">🗑 一键清空测试 / 演示数据</button>
          <span class="muted" style="font-size:12px">清空全部客户、配镜记录、会员等业务数据；清空前会自动在 app/data/backups/ 留一份备份。只想删部分测试数据，请到「配镜记录 / 客户管理」列表勾选后批量删除。</span>
        </div>
      </div>
    </div>`;

  const fileInput = $('#fileInput');
  const dropzone = $('#dropzone');
  let selected = null;
  const pick = () => fileInput.click();
  dropzone.addEventListener('click', pick);
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault(); dropzone.classList.remove('drag');
    if (e.dataTransfer.files[0]) { selected = e.dataTransfer.files[0]; showFile(); }
  });
  fileInput.addEventListener('change', () => { selected = fileInput.files[0]; showFile(); });
  function showFile() {
    if (!selected) return;
    $('#fileName').textContent = `已选择：${selected.name}（${(selected.size / 1024).toFixed(1)} KB）`;
    $('#doImport').disabled = false;
  }
  $('#doImport').addEventListener('click', async () => {
    if (!selected) return;
    const fd = new FormData();
    fd.append('file', selected);
    const btn = $('#doImport');
    btn.disabled = true; btn.textContent = '导入中…';
    try {
      const r = await api('/api/import', { method: 'POST', body: fd });
      $('#importResult').innerHTML = `<div class="result-box ok">
        <b>导入完成</b><br>
        读取 ${r.rows} 行，新增客户 ${r.createdCustomers} 位，新增配镜记录 ${r.createdOrders} 条。
        ${r.errors && r.errors.length ? `<br><span style="color:#b45309">${r.errors.length} 行被跳过：${r.errors.slice(0, 5).map(esc).join('；')}${r.errors.length > 5 ? '…' : ''}</span>` : ''}
      </div>`;
      toast('导入完成');
    } catch (e) {
      $('#importResult').innerHTML = `<div class="result-box err">导入失败：${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '开始导入';
    }
  });

  $('#btnClearDemo').addEventListener('click', () => {
    const { root, close } = openModal({
      title: '一键清空测试 / 演示数据',
      subtitle: '不可撤销，但会自动备份',
      size: 'narrow',
      body: `
        <div class="result-box err" style="margin-top:0">
          将清空：客户、配镜记录、会员、次卡、储值/积分流水、已发优惠券、回访记录。<br>
          保留：门店设置、员工、优惠券模板、活动模板、会员等级。
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px">
          <input type="checkbox" id="clearAll"> 同时清空员工、优惠券模板和活动模板（彻底恢复出厂）
        </label>`,
      footer: '<button class="btn" data-cancel>取消</button><button class="btn danger" id="confirmClear">确认清空</button>',
    });
    root.querySelector('[data-cancel]').onclick = close;
    root.querySelector('#confirmClear').onclick = async () => {
      const scope = root.querySelector('#clearAll').checked ? 'all' : 'business';
      try {
        const r = await api('/api/admin/clear-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope }),
        });
        close();
        toast('已清空，备份：' + r.backup);
        location.hash = '#/dashboard';
        route();
      } catch (e) { toast(e.message, 'error'); }
    };
  });
}

/* ---------------- 门店设置 ---------------- */
function openSettings() {
  const s = state.settings || {};
  const list = (arr) => (arr || []).join('\n');
  const body = `
    <div class="form-section">
      <div class="section-title">基本信息</div>
      <div class="form-grid">
        <div class="field span-2">
          <label>门店名称</label>
          <input class="input" id="setShopName" value="${esc(s.shopName || '')}" placeholder="例如：明视眼镜">
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="section-title">临床随访规则（按产品类型，配镜后多少天提醒）</div>
      ${(() => {
        const templates = Array.isArray(s.followupTemplates) ? s.followupTemplates : [];
        return templates.map((t) => `
          <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">
            <div style="font-weight:600;font-size:13px;margin-bottom:8px">${esc(t.productType)}
              <span class="muted" style="font-weight:400;font-size:12px"> · 周期复查间隔</span>
              <input class="input" style="width:64px;display:inline-block;padding:4px 6px" data-ftr="${esc(t.productType)}" type="number" min="0" max="3650" value="${Number(t.repeatDays) || 0}">
              <span class="muted" style="font-size:12px">天（0=不循环）</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${(t.stages || []).map((st, i) => `<div class="field" style="min-width:118px"><label style="font-size:11px">${esc(st.label)}</label><input class="input" data-ft="${esc(t.productType)}" data-stage="${i}" type="number" min="1" max="3650" value="${st.days}"></div>`).join('')}
            </div>
          </div>`).join('');
      })()}
      <div class="hint">默认对齐临床共识：OK镜 1/7/14/30/90 天 + 每 90 天；离焦防控 30/90/180 天 + 每 90 天眼轴。改完立即生效，已处理的回访不受影响。</div>
    </div>
    <div class="form-section">
      <div class="section-title">下拉选项（每行一个）</div>
      <div class="form-grid">
        <div class="field span-2">
          <label>客户来源</label>
          <textarea class="input" id="setSources" rows="5">${esc(list(s.sources))}</textarea>
        </div>
        <div class="field span-2">
          <label>产品分类</label>
          <textarea class="input" id="setCategories" rows="5">${esc(list(s.categories))}</textarea>
        </div>
        <div class="field span-2">
          <label>员工角色</label>
          <textarea class="input" id="setStaffRoles" rows="4">${esc(list(s.staffRoles))}</textarea>
        </div>
        <div class="field span-2">
          <label>局域网访问（同一 WiFi 下的手机/收银机）</label>
          <div class="hint" style="line-height:1.9">${(state.lanUrls || []).map((u) => `<div><code>${esc(u)}</code></div>`).join('') || '未检测到局域网地址'}</div>
        </div>
      </div>
    </div>`;
  const { root, close } = openModal({
    title: '门店设置',
    subtitle: '改完立即生效，无需重启',
    body,
    footer: '<button class="btn" data-cancel>取消</button><button class="btn primary" id="saveSettings">保存</button>',
  });
  root.querySelector('[data-cancel]').onclick = close;
  root.querySelector('#saveSettings').onclick = async () => {
    const lines = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);
    const payload = {
      shopName: $('#setShopName', root).value.trim() || '明视眼镜',
      sources: lines($('#setSources', root).value),
      categories: lines($('#setCategories', root).value),
      staffRoles: lines($('#setStaffRoles', root).value),
      followupTemplates: [...new Set($$('[data-ft]', root).map((el) => el.dataset.ft))].map((pt) => ({
        productType: pt,
        stages: $$('[data-ft="' + pt + '"]', root).map((el) => ({ days: Math.max(1, Math.floor(Number(el.value) || 1)) })),
        repeatDays: Math.max(0, Math.floor(Number(($('[data-ftr="' + pt + '"]', root) || {}).value) || 0)),
      })),
    };
    try {
      const r = await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      state.settings = r;
      $('#shopName').textContent = r.shopName || '明视眼镜';
      document.title = `${r.shopName || '明视眼镜'} · 配镜客户管理`;
      close();
      toast('门店设置已保存');
      route();
    } catch (e) { toast(e.message, 'error'); }
  };
}

/* ---------------- 启动 ---------------- */
function bindAccount() {
  const cp = $('#btnChangePwd'), lo = $('#btnLogout'), st = $('#btnSettings');
  if (cp) cp.onclick = () => openChangePassword(false);
  if (st) st.onclick = () => openSettings();
  if (lo) lo.onclick = async () => { try { await api('/api/logout', { method: 'POST' }); } catch (e) {} clearToken(); showLogin('已退出，请重新登录'); };
}
(async function init() {
  bindAccount();
  window.addEventListener('hashchange', route);
  if (!getToken()) { showLogin(); return; }
  try {
    const boot = await api('/api/bootstrap');
    state.settings = boot.settings;
    state.lanUrls = boot.lanUrls || [];
    $('#shopName').textContent = boot.settings.shopName || '明视眼镜';
    document.title = `${boot.settings.shopName || '明视眼镜'} · 配镜客户管理`;
    route();
  } catch (e) { /* 401 已由 api() 弹出登录 */ }
})();
