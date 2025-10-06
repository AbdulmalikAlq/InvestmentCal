// Helpers
function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toFixed(2) + ' ' + currency;
  }
}

function computeSeries({ initial, monthly, years, annualRate }) {
  const monthlyRate = (annualRate / 100) / 12;
  const months = years * 12;
  let balance = initial;
  const series = [{ x: 0, y: balance }];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthly;
    series.push({ x: m, y: balance });
  }
  return { series, months };
}

// DOM
const els = {
  stockType: document.getElementById('stockType'),
  initial: document.getElementById('initial'),
  monthly: document.getElementById('monthly'),
  years: document.getElementById('years'),
  rate: document.getElementById('rate'), // for growth stocks
  sharePrice: document.getElementById('sharePrice'), // for dividend stocks (current price)
  rateGrowth: document.getElementById('rateGrowth'), // for dividend stocks (price growth)
  divYield: document.getElementById('divYield'), // for dividend stocks (yield)
  reinvest: document.getElementById('reinvest'),
  currency: document.getElementById('currency'),
  finalBalance: document.getElementById('finalBalance'),
  totalContrib: document.getElementById('totalContrib'),
  totalDivs: document.getElementById('totalDivs'),
  summary: document.getElementById('summary'),
  year: document.getElementById('year'),
};
if (els.year) els.year.textContent = String(new Date().getFullYear());

// Chart
let chart;
function ensureChart(ctx) {
  if (chart) return chart;
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'الرصيد',
        data: [],
        borderColor: '#0081a7',
        backgroundColor: 'rgba(0,129,167,0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => `${Math.floor(v/12)}y` } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const m = items[0].parsed.x;
            const year = Math.floor(m / 12);
            const month = (m % 12) + 1;
            return `السنة ${year} - شهر ${month}`;
          },
          label: (ctx) => {
            const currency = els.currency.value;
            const y = ctx.parsed.y;
            // تقدير الإيداعات حتى هذه النقطة
            const months = ctx.parsed.x;
            const initial = Number(els.initial.value) || 0;
            const monthly = Number(els.monthly.value) || 0;
            const contrib = initial + monthly * months;
            const profit = Math.max(0, y - contrib);
            return [
              `الرصيد: ${formatCurrency(y, currency)}`,
              `الأرباح المتراكمة: ${formatCurrency(profit, currency)}`
            ];
          }
        } }
      }
    }
  });
  return chart;
}

function update() {
  const type = els.stockType.value; // 'growth' | 'dividend'
  const initial = Number(els.initial.value) || 0;
  const monthly = Number(els.monthly.value) || 0;
  const years = Math.max(1, Number(els.years.value) || 1);
  const currency = els.currency.value || 'SAR';

  let series, months, finalBalance, totalContrib, totalDivs = 0;

  if (type === 'growth') {
    const annualRate = Number(els.rate.value) || 0;
    ({ series, months } = computeSeries({ initial, monthly, years, annualRate }));
    finalBalance = series[series.length - 1].y;
    totalContrib = initial + monthly * months;
    els.summary.textContent = `استثمار (أسهم النمو) خلال ${years} سنة بعائد ${annualRate}% قد يصل إلى ${formatCurrency(finalBalance, currency)}. زيادة ${pct(finalBalance, totalContrib)}% عن إجمالي الإيداعات.`;
  } else {
    const priceGrowth = Number(els.rateGrowth.value) || 0;
    const divYield = Number(els.divYield.value) || 0;
    const reinvest = !!els.reinvest.checked;

    // simulate dividend model
    const monthsCount = years * 12;
    const monthlyPriceGrowth = (priceGrowth / 100) / 12;
    const monthlyDivYield = (divYield / 100) / 12;
    let balance = initial;
    series = [{ x: 0, y: balance }];
    totalDivs = 0;
    for (let m = 1; m <= monthsCount; m++) {
      // monthly contribution
      balance += monthly;
      // apply price growth
      balance *= (1 + monthlyPriceGrowth);
      // dividends paid on current balance (approx)
      const div = balance * monthlyDivYield;
      totalDivs += div;
      if (reinvest) {
        balance += div;
      }
      series.push({ x: m, y: balance });
    }
    months = monthsCount;
    finalBalance = series[series.length - 1].y;
    totalContrib = initial + monthly * months;
    els.summary.textContent = `استثمار (أسهم العوائد) خلال ${years} سنة بنمو سعر ${priceGrowth}% وعائد توزيعات ${divYield}%${reinvest ? ' مع إعادة استثمار' : ''} قد يصل إلى ${formatCurrency(finalBalance, currency)}. التوزيعات الكلية ≈ ${formatCurrency(totalDivs, currency)}.`;
  }

  els.finalBalance.textContent = formatCurrency(finalBalance, currency);
  els.totalContrib.textContent = formatCurrency(totalContrib, currency);
  if (els.totalDivs) els.totalDivs.textContent = type === 'dividend' ? formatCurrency(totalDivs, currency) : '-';

  const ctx = document.getElementById('growthChart').getContext('2d');
  const c = ensureChart(ctx);
  c.data.labels = series.map(p => p.x);
  c.data.datasets[0].data = series.map(p => p.y);
  c.update();
  renderYearlyTable({ series, months, currency, type, totalContrib, totalDivs });
  saveState();
}

function pct(finalBalance, totalContrib) {
  return totalContrib > 0 ? Math.round(100 * (finalBalance - totalContrib) / totalContrib) : 0;
}

['input', 'change'].forEach(ev => {
  els.stockType.addEventListener(ev, onTypeChange);
  els.initial.addEventListener(ev, update);
  els.monthly.addEventListener(ev, update);
  els.years.addEventListener(ev, update);
  els.rate.addEventListener(ev, update);
  els.sharePrice.addEventListener(ev, update);
  els.rateGrowth.addEventListener(ev, update);
  els.divYield.addEventListener(ev, update);
  els.reinvest.addEventListener(ev, update);
  els.currency.addEventListener(ev, update);
});

// Calculate button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('calculateBtn');
  if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); update(); });
  
  // Dividend yield calculator
  const calcDivBtn = document.getElementById('calcDivBtn');
  if (calcDivBtn) {
    calcDivBtn.addEventListener('click', () => {
      const divPerShare = Number(document.getElementById('divPerShare').value) || 0;
      const sharePrice = Number(els.sharePrice.value) || 0;
      const result = document.getElementById('divResult');
      
      if (sharePrice > 0) {
        const yield = (divPerShare / sharePrice) * 100;
        result.textContent = `عائد التوزيعات = ${yield.toFixed(2)}%`;
        // تحديث حقل عائد التوزيعات تلقائياً
        els.divYield.value = yield.toFixed(1);
        update();
      } else {
        result.textContent = 'أدخل سعر السهم أولاً';
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  // اضبط إظهار الحقول حسب النوع قبل أول تحديث لتفادي عناصر غير مفيدة
  onTypeChange();
  update();
  // تفعيل فتح/إغلاق التولتيب بالنقر على زر i على الجوال
  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const info = btn.parentElement;
      if (!info) return;
      info.classList.toggle('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.info.open').forEach(el => el.classList.remove('open'));
  });
});

function onTypeChange() {
  const type = els.stockType.value;
  document.querySelectorAll('.growth-only').forEach(el => el.classList.toggle('hidden', type !== 'growth'));
  document.querySelectorAll('.dividend-only').forEach(el => el.classList.toggle('hidden', type !== 'dividend'));
  update();
  saveState();
}

// initialize visibility once DOM loaded
document.addEventListener('DOMContentLoaded', onTypeChange);

// Yearly table rendering and CSV export
function renderYearlyTable({ series, months, currency, type, totalContrib, totalDivs }) {
  const tbody = document.querySelector('#yearlyTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = [];
  const years = Math.ceil(months / 12);
  for (let y = 1; y <= years; y++) {
    const mIdx = Math.min(y * 12, months);
    // احصل على الرصيد عند نهاية كل سنة (أقرب قيمة <= mIdx)
    let balPoint = series[0];
    for (let i = 1; i < series.length; i++) {
      if (series[i].x <= mIdx) balPoint = series[i]; else break;
    }
    const bal = balPoint.y;
    const contrib = (Number(els.initial.value) || 0) + (Number(els.monthly.value) || 0) * mIdx;
    const row = {
      year: y,
      contrib,
      divs: type === 'dividend' ? estimateDivsUpTo(mIdx) : 0,
      balance: bal,
    };
    rows.push(row);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>${formatCurrency(row.contrib, currency)}</td>
      <td class="dividend-only ${type === 'dividend' ? '' : 'hidden'}">${type === 'dividend' ? formatCurrency(row.divs, currency) : '-'}</td>
      <td>${formatCurrency(row.balance, currency)}</td>
    `;
    tbody.appendChild(tr);
  }

  const exportBtn = document.getElementById('exportCsv');
  if (exportBtn) {
    exportBtn.onclick = () => exportRowsCsv(rows, type);
  }
}

function estimateDivsUpTo(months) {
  // إعادة محاكاة مبسطة حتى عدد الأشهر المطلوب للحصول على مجموع التوزيعات
  const priceGrowth = Number(els.rateGrowth.value) || 0;
  const divYield = Number(els.divYield.value) || 0;
  const reinvest = !!els.reinvest.checked;
  const monthlyPriceGrowth = (priceGrowth / 100) / 12;
  const monthlyDivYield = (divYield / 100) / 12;
  let balance = Number(els.initial.value) || 0;
  let totalDivs = 0;
  for (let m = 1; m <= months; m++) {
    balance += (Number(els.monthly.value) || 0);
    balance *= (1 + monthlyPriceGrowth);
    const div = balance * monthlyDivYield;
    totalDivs += div;
    if (reinvest) balance += div;
  }
  return totalDivs;
}

function exportRowsCsv(rows, type) {
  const head = ['year', 'total_contributions'].concat(type === 'dividend' ? ['dividends'] : []).concat(['year_end_balance']);
  const lines = [head.join(',')];
  for (const r of rows) {
    const parts = [r.year, r.contrib];
    if (type === 'dividend') parts.push(r.divs);
    parts.push(r.balance);
    lines.push(parts.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'yearly_summary.csv'; a.click();
  URL.revokeObjectURL(url);
}

// LocalStorage persistence
const KEY = 'smartinvest-state-v1';
function saveState() {
  const state = {
    stockType: els.stockType.value,
    initial: els.initial.value,
    monthly: els.monthly.value,
    years: els.years.value,
    rate: els.rate.value,
    sharePrice: els.sharePrice.value,
    rateGrowth: els.rateGrowth.value,
    divYield: els.divYield.value,
    reinvest: els.reinvest.checked,
    currency: els.currency.value,
  };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.stockType) els.stockType.value = s.stockType;
    if (s.initial) els.initial.value = s.initial;
    if (s.monthly) els.monthly.value = s.monthly;
    if (s.years) els.years.value = s.years;
    if (s.rate) els.rate.value = s.rate;
    if (s.sharePrice) els.sharePrice.value = s.sharePrice;
    if (s.rateGrowth) els.rateGrowth.value = s.rateGrowth;
    if (s.divYield) els.divYield.value = s.divYield;
    if (typeof s.reinvest === 'boolean') els.reinvest.checked = s.reinvest;
    if (s.currency) els.currency.value = s.currency;
  } catch {}
}


