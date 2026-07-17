// ==========================================================================
// フロントエンド（バックエンドAPIを叩くだけ。計算ロジックはすべてサーバー側）
// ==========================================================================

const state = {
  user: null,
  industries: [],
  companies: [],
  selectedCompanyId: null,
  records: [],
  diagnosis: null,
  compareData: []
};

let trendChartObj = null;
let benchChartObj = null;

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `リクエストに失敗しました (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const SAMPLE_ANNUAL_CSV =
`年度,売上高,経常利益,総資産,純資産,流動資産,流動負債,従業員数,付加価値額
2022年3月期,150000000,4200000,95000000,32000000,48000000,38000000,12,40000000
2023年3月期,162000000,5100000,101000000,35500000,51000000,40000000,13,43500000
2024年3月期,171000000,4800000,108000000,38000000,53000000,44000000,13,45500000`;

const SAMPLE_MONTHLY_CSV =
`年度,経過月数,売上高,経常利益,総資産,純資産,流動資産,流動負債,従業員数,付加価値額
2026年度(試算表6ヶ月),6,50000000,3000000,40000000,15000000,25000000,18000000,5,20000000`;

// ---------------------------------------------------------------------
// 画面切り替え
// ---------------------------------------------------------------------
function showAuthView() {
  document.getElementById('authView').style.display = 'block';
  document.getElementById('appView').style.display = 'none';
}
function showAppView() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appView').style.display = 'block';
  document.getElementById('userEmailLabel').textContent = state.user.email + ' としてログイン中';
}
function showCompanyList() {
  document.getElementById('companyListView').style.display = 'block';
  document.getElementById('companyDetailView').style.display = 'none';
  state.selectedCompanyId = null;
}
function showCompanyDetail() {
  document.getElementById('companyListView').style.display = 'none';
  document.getElementById('companyDetailView').style.display = 'block';
}

// ---------------------------------------------------------------------
// 初期化・認証
// ---------------------------------------------------------------------
async function init() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('loginForm').style.display = btn.dataset.tab === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = btn.dataset.tab === 'register' ? 'block' : 'none';
    });
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      state.user = await api('/auth/login', { method: 'POST', body: { email, password } });
      document.getElementById('loginError').textContent = '';
      await afterLogin();
    } catch (err) {
      document.getElementById('loginError').textContent = err.message;
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    try {
      state.user = await api('/auth/register', { method: 'POST', body: { email, password } });
      document.getElementById('registerError').textContent = '';
      await afterLogin();
    } catch (err) {
      document.getElementById('registerError').textContent = err.message;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.user = null;
    showAuthView();
  });

  document.getElementById('newCompanyForm').addEventListener('submit', onCreateCompany);
  document.getElementById('backToListBtn').addEventListener('click', showCompanyList);
  document.getElementById('recordType').addEventListener('change', (e) => {
    document.getElementById('elapsedMonthsField').style.display = e.target.value === 'monthly' ? 'block' : 'none';
  });
  document.getElementById('addRecordBtn').addEventListener('click', onAddRecord);
  document.getElementById('csvFile').addEventListener('change', onCsvFileSelected);
  document.getElementById('loadSampleAnnualBtn').addEventListener('click', () => importCsvText(SAMPLE_ANNUAL_CSV));
  document.getElementById('loadSampleMonthlyBtn').addEventListener('click', () => importCsvText(SAMPLE_MONTHLY_CSV));

  document.getElementById('printReportBtn').addEventListener('click', () => window.print());

  document.getElementById('showCompareBtn').addEventListener('click', async () => {
    const card = document.getElementById('compareCard');
    const willShow = card.style.display === 'none';
    card.style.display = willShow ? 'block' : 'none';
    if (willShow) await loadCompare();
  });
  document.getElementById('compareSortKey').addEventListener('change', () => renderCompareTable());

  try {
    state.user = await api('/auth/me');
    await afterLogin();
  } catch {
    showAuthView();
  }
}

async function afterLogin() {
  state.industries = await api('/companies/industries');
  const sel = document.getElementById('newCompanyIndustry');
  sel.innerHTML = state.industries.map(i => `<option value="${i}">${i}</option>`).join('');
  showAppView();
  showCompanyList();
  await loadCompanies();
}

// ---------------------------------------------------------------------
// 会社一覧
// ---------------------------------------------------------------------
async function loadCompanies() {
  state.companies = await api('/companies');
  const list = document.getElementById('companyList');
  const empty = document.getElementById('companyListEmpty');
  if (state.companies.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = state.companies.map(c => `
    <div class="company-item" data-id="${c.id}">
      <div>
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="industry">${escapeHtml(c.industry)}</div>
      </div>
      <button class="delete-btn" data-id="${c.id}" type="button">削除</button>
    </div>
  `).join('');
  list.querySelectorAll('.company-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      openCompany(Number(el.dataset.id));
    });
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('この会社のデータを削除しますか？元に戻せません。')) return;
      await api(`/companies/${btn.dataset.id}`, { method: 'DELETE' });
      await loadCompanies();
    });
  });
}

async function onCreateCompany(e) {
  e.preventDefault();
  const name = document.getElementById('newCompanyName').value.trim();
  const industry = document.getElementById('newCompanyIndustry').value;
  try {
    await api('/companies', { method: 'POST', body: { name, industry } });
    document.getElementById('newCompanyName').value = '';
    document.getElementById('newCompanyError').textContent = '';
    await loadCompanies();
  } catch (err) {
    document.getElementById('newCompanyError').textContent = err.message;
  }
}

// ---------------------------------------------------------------------
// 会社詳細
// ---------------------------------------------------------------------
async function openCompany(id) {
  state.selectedCompanyId = id;
  const company = state.companies.find(c => c.id === id);
  document.getElementById('companyDetailName').textContent = company.name;
  document.getElementById('companyDetailIndustry').textContent = `業種: ${company.industry}`;
  document.getElementById('printCompanyName').textContent = `${company.name} 経営指標診断レポート`;
  showCompanyDetail();
  await refreshCompanyData();
}

async function refreshCompanyData() {
  const id = state.selectedCompanyId;
  state.records = await api(`/companies/${id}/records`);
  renderRecordsTable();
  if (state.records.length > 0) {
    state.diagnosis = await api(`/companies/${id}/diagnosis`);
    renderDiagnosis();
    document.getElementById('diagnosisArea').style.display = 'block';
  } else {
    state.diagnosis = null;
    document.getElementById('diagnosisArea').style.display = 'none';
  }
}

function renderRecordsTable() {
  const table = document.getElementById('recordsTable');
  const empty = document.getElementById('recordsEmpty');
  if (state.records.length === 0) {
    table.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  table.innerHTML = `
    <tr>
      <th>期間</th><th>区分</th><th>売上高</th><th>経常利益</th><th>総資産</th><th>純資産</th><th></th>
    </tr>
    ${state.records.map(r => `
      <tr>
        <td>${escapeHtml(r.periodLabel)}</td>
        <td>${r.recordType === 'monthly' ? `試算表(${r.elapsedMonths}ヶ月)` : '決算'}</td>
        <td>${formatYen(r.sales)}</td>
        <td>${formatYen(r.ordinaryProfit)}</td>
        <td>${formatYen(r.totalAssets)}</td>
        <td>${formatYen(r.equity)}</td>
        <td><button class="delete-btn" data-id="${r.id}" type="button">削除</button></td>
      </tr>
    `).join('')}
  `;
  table.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/companies/${state.selectedCompanyId}/records/${btn.dataset.id}`, { method: 'DELETE' });
      await refreshCompanyData();
    });
  });
}

async function onAddRecord() {
  const recordType = document.getElementById('recordType').value;
  const body = {
    periodLabel: document.getElementById('periodLabel').value || (recordType === 'monthly' ? '試算表データ' : '決算データ'),
    recordType,
    elapsedMonths: recordType === 'monthly' ? Number(document.getElementById('elapsedMonths').value) : null,
    sales: Number(document.getElementById('fSales').value || 0),
    ordinaryProfit: Number(document.getElementById('fProfit').value || 0),
    totalAssets: Number(document.getElementById('fAssets').value || 0),
    equity: Number(document.getElementById('fEquity').value || 0),
    currentAssets: Number(document.getElementById('fCurrentAssets').value || 0),
    currentLiabilities: Number(document.getElementById('fCurrentLiabilities').value || 0),
    employees: Number(document.getElementById('fEmployees').value || 0),
    valueAdded: document.getElementById('fValueAdded').value ? Number(document.getElementById('fValueAdded').value) : null,
    interestBearingDebt: document.getElementById('fInterestDebt').value ? Number(document.getElementById('fInterestDebt').value) : null,
    depreciation: document.getElementById('fDepreciation').value ? Number(document.getElementById('fDepreciation').value) : null
  };
  try {
    await api(`/companies/${state.selectedCompanyId}/records`, { method: 'POST', body });
    document.getElementById('addRecordError').textContent = '';
    ['periodLabel', 'fSales', 'fProfit', 'fAssets', 'fEquity', 'fCurrentAssets', 'fCurrentLiabilities', 'fEmployees', 'fValueAdded', 'fInterestDebt', 'fDepreciation']
      .forEach(id => { document.getElementById(id).value = ''; });
    await refreshCompanyData();
  } catch (err) {
    document.getElementById('addRecordError').textContent = err.message;
  }
}

function onCsvFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => importCsvText(ev.target.result);
  reader.readAsText(file, 'UTF-8');
}

async function importCsvText(text) {
  try {
    await api(`/companies/${state.selectedCompanyId}/records/import`, { method: 'POST', body: { csv: text } });
    document.getElementById('importError').textContent = '';
    await refreshCompanyData();
  } catch (err) {
    document.getElementById('importError').textContent = err.message;
  }
}

// ---------------------------------------------------------------------
// 診断結果の描画
// ---------------------------------------------------------------------
function fmt(v, digits = 1) {
  return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(digits);
}
function formatYen(v) {
  return '¥' + Math.round(v).toLocaleString('ja-JP');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDiagnosis() {
  const { series, diagnosis, summary, industry } = state.diagnosis;
  document.getElementById('summaryText').textContent = summary || '';
  const latestLabel = series.length ? series[series.length - 1].periodLabel : '';
  const today = new Date().toLocaleDateString('ja-JP');
  document.getElementById('printMeta').textContent = `業種: ${industry}　最新データ: ${latestLabel}　作成日: ${today}`;
  const labels = series.map(s => s.periodLabel + (s.indicators.annualized ? '(年換算)' : ''));

  if (trendChartObj) trendChartObj.destroy();
  trendChartObj = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '自己資本比率', data: series.map(s => s.indicators.equityRatio), borderColor: '#2f5d8a', backgroundColor: '#2f5d8a', tension: 0.25 },
        { label: '売上高経常利益率', data: series.map(s => s.indicators.profitMargin), borderColor: '#b3392c', backgroundColor: '#b3392c', tension: 0.25 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } } }
  });

  const latest = series[series.length - 1];
  const eqItem = diagnosis.find(d => d.key === 'equityRatio');
  const pmItem = diagnosis.find(d => d.key === 'profitMargin');
  const toItem = diagnosis.find(d => d.key === 'turnover');
  const roeItem = diagnosis.find(d => d.key === 'roe');

  if (benchChartObj) benchChartObj.destroy();
  benchChartObj = new Chart(document.getElementById('benchChart'), {
    type: 'bar',
    data: {
      labels: ['自己資本比率', '売上高経常利益率', '総資本回転率×10', 'ROE'],
      datasets: [
        { label: '自社（最新）', data: [latest.indicators.equityRatio, latest.indicators.profitMargin, (latest.indicators.turnover || 0) * 10, latest.indicators.roe], backgroundColor: '#2f5d8a' },
        { label: '業種平均（参考）', data: [eqItem.benchValue, pmItem.benchValue, (toItem.benchValue || 0) * 10, roeItem.benchValue], backgroundColor: '#c7ccd4' }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } } }
  });

  document.getElementById('diagList').innerHTML = diagnosis.map(it => `
    <div class="diag-item">
      <div>
        <div class="diag-name">${escapeHtml(it.name)}</div>
        <div class="diag-detail">${escapeHtml(it.detail)}<br>${escapeHtml(it.benchLabel)}</div>
      </div>
      <div class="diag-right">
        <div class="diag-value">${fmt(it.value, it.unit === '回' ? 2 : 0)} ${it.unit}</div>
        <span class="badge ${it.judge.cls}">${it.judge.label}</span>
      </div>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------
// 複数社比較・ランキング
// ---------------------------------------------------------------------
async function loadCompare() {
  state.compareData = await api('/companies/compare');
  renderCompareTable();
}

const COMPARE_COLUMNS = {
  equityRatio: { label: '自己資本比率', unit: '%', digits: 1 },
  profitMargin: { label: '売上高経常利益率', unit: '%', digits: 1 },
  turnover: { label: '総資本回転率', unit: '回', digits: 2 },
  roe: { label: 'ROE', unit: '%', digits: 1 },
  currentRatio: { label: '流動比率', unit: '%', digits: 1 },
  productivity: { label: '労働生産性', unit: '万円/人', digits: 0 }
};

function renderCompareTable() {
  const table = document.getElementById('compareTable');
  const empty = document.getElementById('compareEmpty');
  const sortKey = document.getElementById('compareSortKey').value;

  const withData = state.compareData.filter(c => c.hasData);
  const withoutData = state.compareData.filter(c => !c.hasData);

  if (state.compareData.length === 0) {
    table.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...withData].sort((a, b) => {
    if (sortKey === 'goodScore') return (b.goodCount - b.badCount) - (a.goodCount - a.badCount);
    const av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return bv - av; // 降順(良い値が上に来るよう単純に大きい順。逆指標の並び替えは今後の課題)
  });

  const cols = Object.entries(COMPARE_COLUMNS);

  table.innerHTML = `
    <tr>
      <th>会社名</th><th>業種</th><th>最新期間</th>
      ${cols.map(([, c]) => `<th>${c.label}</th>`).join('')}
      <th>総合評価</th>
    </tr>
    ${sorted.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.industry)}</td>
        <td>${escapeHtml(c.latestPeriod)}</td>
        ${cols.map(([key, col]) => `<td>${fmt(c[key], col.digits)}${c[key] !== null ? col.unit : ''}</td>`).join('')}
        <td>
          <span class="badge good">${c.goodCount}</span>
          <span class="badge mid">${c.midCount}</span>
          <span class="badge bad">${c.badCount}</span>
        </td>
      </tr>
    `).join('')}
    ${withoutData.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.industry)}</td>
        <td colspan="${cols.length + 2}" style="color:var(--sub);">データ未入力</td>
      </tr>
    `).join('')}
  `;
}

init();
