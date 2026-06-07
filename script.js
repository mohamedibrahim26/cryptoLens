/* ═══════════════════════════════════════════════
   CryptoLens — script.js
   Live crypto tracker using CoinGecko public API
═══════════════════════════════════════════════ */

const API = 'https://api.coingecko.com/api/v3';
let coins      = [];
let allCoins   = []; // unfiltered master list
let portfolio  = JSON.parse(localStorage.getItem('cl_portfolio') || '{}');
let watchlist  = JSON.parse(localStorage.getItem('cl_watchlist') || '[]');
let filterMode = 'all';
let searchQ    = '';
let sortKey    = 'rank';
let countdown  = 60;
let cdTimer    = null;
let detailChart = null;
let activeCoinId = null;
let activeDays   = 7;
const CIRC  = 2 * Math.PI * 15; // SVG ring circumference

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
async function init() {
  renderSkeletons(10);
  await Promise.all([fetchCoins(), fetchGlobal()]);
  startTimer();
}

/* ═══════════════════════════════════════════════
   API CALLS
═══════════════════════════════════════════════ */
async function fetchCoins() {
  try {
    const url = `${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const prev = Object.fromEntries(allCoins.map(c => [c.id, c.current_price]));
    allCoins = data;
    applyFilterSort();
    renderTicker(data.slice(0, 20));
    flashPriceChanges(prev);
  } catch (e) {
    if (allCoins.length === 0) {
      document.getElementById('coinGrid').innerHTML = `
        <div class="grid-empty">
          <div class="grid-empty-icon">⚠️</div>
          <p>Could not load prices. Check your connection or try again.</p>
          <br/><button class="ftab" onclick="refreshNow()" style="margin:0 auto">Retry</button>
        </div>`;
    }
  }
}

async function fetchGlobal() {
  try {
    const res  = await fetch(`${API}/global`);
    const json = await res.json();
    const d    = json.data;
    const cap  = d.total_market_cap.usd;
    const vol  = d.total_volume.usd;
    const chg  = d.market_cap_change_percentage_24h_usd;
    const btc  = d.market_cap_percentage.btc;
    const eth  = d.market_cap_percentage.eth;

    setText('mstatCap', '$' + compactNum(cap));
    setText('mstatVol', '$' + compactNum(vol));
    setText('mstatBTC', btc.toFixed(1) + '%');
    setText('mstatETH', eth.toFixed(1) + '%');
    const chgEl = document.getElementById('mstatChg');
    chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    chgEl.className = 'mstat-v ' + (chg >= 0 ? 'up' : 'down');
  } catch(e) { /* non-critical */ }
}

async function fetchCoinChart(id, days) {
  const res  = await fetch(`${API}/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
  const json = await res.json();
  return json.prices; // [[timestamp, price], ...]
}

/* ═══════════════════════════════════════════════
   FILTER + SORT
═══════════════════════════════════════════════ */
function applyFilterSort() {
  let list = [...allCoins];

  // search
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }

  // filter mode
  if (filterMode === 'gainers') list = list.filter(c => c.price_change_percentage_24h > 0).sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  else if (filterMode === 'losers') list = list.filter(c => c.price_change_percentage_24h < 0).sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
  else if (filterMode === 'watchlist') list = list.filter(c => watchlist.includes(c.id));

  // sort
  if (filterMode !== 'gainers' && filterMode !== 'losers') {
    list.sort((a, b) => {
      if (sortKey === 'rank')     return a.market_cap_rank - b.market_cap_rank;
      if (sortKey === 'price')    return b.current_price - a.current_price;
      if (sortKey === 'change24h')return b.price_change_percentage_24h - a.price_change_percentage_24h;
      if (sortKey === 'marketcap')return b.market_cap - a.market_cap;
      if (sortKey === 'volume')   return b.total_volume - a.total_volume;
      return 0;
    });
  }

  coins = list;
  renderGrid();
}

/* ═══════════════════════════════════════════════
   RENDER GRID
═══════════════════════════════════════════════ */
function renderGrid() {
  const grid = document.getElementById('coinGrid');
  if (coins.length === 0) {
    grid.innerHTML = `<div class="grid-empty"><div class="grid-empty-icon">${filterMode==='watchlist'?'⭐':'🔍'}</div><p>${filterMode==='watchlist'?'No coins in your watchlist yet. Click ☆ on any card.':'No coins match your search.'}</p></div>`;
    return;
  }
  grid.innerHTML = coins.map((c, i) => renderCard(c, i)).join('');
}

function renderCard(c, i) {
  const chg   = c.price_change_percentage_24h || 0;
  const chg7  = c.price_change_percentage_7d_in_currency || 0;
  const up    = chg >= 0;
  const spark = c.sparkline_in_7d?.price || [];
  const starred = watchlist.includes(c.id);
  const delay = Math.min(i * 40, 400);

  return `
    <div class="coin-card" id="card-${c.id}" style="animation-delay:${delay}ms" onclick="openModal('${c.id}')">
      <div class="card-top">
        <div class="coin-info">
          <img class="coin-img" src="${c.image}" alt="${c.name}" onerror="this.replaceWith(makePlaceholder('${c.symbol}'))"/>
          <div>
            <div class="coin-name">${c.name}</div>
            <div class="coin-sym">${c.symbol}</div>
          </div>
        </div>
        <div class="card-actions">
          <span class="rank-badge">#${c.market_cap_rank}</span>
          <button class="star-btn ${starred?'starred':''}" onclick="toggleWatch('${c.id}',event)" title="Watchlist">
            ${starred ? '★' : '☆'}
          </button>
          <button class="plus-btn" onclick="quickAddPortfolio('${c.id}',event)" title="Add to portfolio">+</button>
        </div>
      </div>
      <div class="card-price-row">
        <div class="card-price" id="price-${c.id}">${formatPrice(c.current_price)}</div>
        <div class="card-change ${up?'up':'down'}">${up?'+':''}${chg.toFixed(2)}%</div>
      </div>
      <div class="card-meta-row">
        <div class="card-meta-item">
          <span class="card-meta-label">Market Cap</span>
          <span class="card-meta-val">$${compactNum(c.market_cap)}</span>
        </div>
        <div class="card-meta-item">
          <span class="card-meta-label">Volume 24h</span>
          <span class="card-meta-val">$${compactNum(c.total_volume)}</span>
        </div>
        <div class="card-meta-item">
          <span class="card-meta-label">7d Change</span>
          <span class="card-meta-val" style="color:${chg7>=0?'var(--green)':'var(--red)'}">${chg7>=0?'+':''}${chg7.toFixed(2)}%</span>
        </div>
      </div>
      <div class="sparkline-wrap">${buildSparkline(spark, up)}</div>
    </div>
  `;
}

function makePlaceholder(sym) {
  const el = document.createElement('div');
  el.className = 'coin-img-placeholder';
  el.textContent = sym.slice(0,2).toUpperCase();
  return el;
}

/* ═══════════════════════════════════════════════
   SPARKLINE (SVG)
═══════════════════════════════════════════════ */
function buildSparkline(prices, up) {
  if (!prices || prices.length < 2) return '';
  const W = 280, H = 48;
  const sample = prices.filter((_,i) => i % 4 === 0); // thin out to ~42 pts
  const min = Math.min(...sample), max = Math.max(...sample);
  const range = max - min || 1;
  const pts = sample.map((p, i) => {
    const x = (i / (sample.length - 1)) * W;
    const y = H - ((p - min) / range) * (H - 4) - 2;
    return [x.toFixed(1), y.toFixed(1)];
  });
  const linePath = 'M ' + pts.map(p => p.join(',')).join(' L ');
  const areaPath = linePath + ` L ${W},${H} L 0,${H} Z`;
  const cls = up ? 'up' : 'down';
  return `
    <svg class="sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg-${cls}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${up?'#00d395':'#ff3b5c'}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${up?'#00d395':'#ff3b5c'}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="sparkline-area ${cls}" d="${areaPath}" fill="url(#sg-${cls})"/>
      <path class="sparkline-path ${cls}" d="${linePath}" style="stroke-dasharray:${W*4};stroke-dashoffset:${W*4}"/>
    </svg>`;
}

/* ═══════════════════════════════════════════════
   TICKER
═══════════════════════════════════════════════ */
function renderTicker(list) {
  const items = list.map(c => {
    const up = c.price_change_percentage_24h >= 0;
    return `<div class="ticker-item">
      <span class="ticker-sym">${c.symbol.toUpperCase()}</span>
      <span class="ticker-price">${formatPrice(c.current_price)}</span>
      <span class="ticker-chg ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(c.price_change_percentage_24h).toFixed(2)}%</span>
    </div>`;
  }).join('');
  // duplicate for seamless loop
  document.getElementById('tickerTrack').innerHTML = items + items;
}

/* ═══════════════════════════════════════════════
   PRICE FLASH ON REFRESH
═══════════════════════════════════════════════ */
function flashPriceChanges(prev) {
  allCoins.forEach(c => {
    const el = document.getElementById('price-' + c.id);
    if (!el) return;
    const oldPrice = prev[c.id];
    if (oldPrice === undefined) return;
    const dir = c.current_price > oldPrice ? 'flash-up' : c.current_price < oldPrice ? 'flash-down' : null;
    if (dir) {
      el.classList.add(dir);
      setTimeout(() => el.classList.remove(dir), 1200);
    }
  });
}

/* ═══════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════ */
function handleSearch(q) {
  searchQ = q.trim();
  const dd = document.getElementById('searchDropdown');
  if (!searchQ) { dd.classList.remove('open'); applyFilterSort(); return; }

  // live dropdown
  const matches = allCoins.filter(c =>
    c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.symbol.toLowerCase().includes(searchQ.toLowerCase())
  ).slice(0, 6);

  dd.innerHTML = matches.map(c => `
    <div class="search-result-item" onclick="jumpToCoin('${c.id}')">
      <span class="sr-rank">#${c.market_cap_rank}</span>
      <img class="sr-img" src="${c.image}" alt="${c.name}"/>
      <div>
        <div class="sr-name">${c.name}</div>
        <div class="sr-sym">${c.symbol}</div>
      </div>
      <span class="sr-price">${formatPrice(c.current_price)}</span>
    </div>
  `).join('') || '<div class="search-result-item" style="color:var(--text3)">No results found</div>';

  dd.classList.add('open');
  applyFilterSort();
}

function jumpToCoin(id) {
  document.getElementById('searchDropdown').classList.remove('open');
  document.getElementById('searchInput').value = '';
  searchQ = '';
  applyFilterSort();
  setTimeout(() => openModal(id), 100);
}

// close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) document.getElementById('searchDropdown').classList.remove('open');
});

/* ═══════════════════════════════════════════════
   FILTER & SORT
═══════════════════════════════════════════════ */
function setFilter(mode, btn) {
  filterMode = mode;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilterSort();
}

function handleSort(val) {
  sortKey = val;
  applyFilterSort();
}

/* ═══════════════════════════════════════════════
   WATCHLIST
═══════════════════════════════════════════════ */
function toggleWatch(id, e) {
  e.stopPropagation();
  const isWatched = watchlist.includes(id);
  if (isWatched) {
    watchlist = watchlist.filter(x => x !== id);
    showToast('Removed from watchlist', 'info');
  } else {
    watchlist.push(id);
    showToast('⭐ Added to watchlist!', 'success');
  }
  localStorage.setItem('cl_watchlist', JSON.stringify(watchlist));
  applyFilterSort();
}

/* ═══════════════════════════════════════════════
   PORTFOLIO
═══════════════════════════════════════════════ */
function togglePortfolio() {
  const panel   = document.getElementById('portfolioPanel');
  const overlay = document.getElementById('sideOverlay');
  const open    = panel.classList.toggle('open');
  overlay.classList.toggle('open', open);
  if (open) renderPortfolio();
}

function quickAddPortfolio(id, e) {
  e.stopPropagation();
  openModal(id);
  setTimeout(() => document.getElementById('modalQtyInput').focus(), 500);
}

function addFromModal() {
  const qty = parseFloat(document.getElementById('modalQtyInput').value);
  if (!activeCoinId || isNaN(qty) || qty <= 0) { showToast('Enter a valid amount', 'error'); return; }
  portfolio[activeCoinId] = (portfolio[activeCoinId] || 0) + qty;
  localStorage.setItem('cl_portfolio', JSON.stringify(portfolio));
  document.getElementById('modalQtyInput').value = '';
  const coin = allCoins.find(c => c.id === activeCoinId);
  updatePortBadge();
  showToast(`✓ Added ${qty} ${coin?.symbol?.toUpperCase() || ''} to portfolio`, 'success');
}

function removeHolding(id) {
  delete portfolio[id];
  localStorage.setItem('cl_portfolio', JSON.stringify(portfolio));
  updatePortBadge();
  renderPortfolio();
  showToast('Holding removed', 'info');
}

function renderPortfolio() {
  const ids    = Object.keys(portfolio).filter(id => portfolio[id] > 0);
  const empty  = document.getElementById('portfolioEmpty');
  const list   = document.getElementById('portfolioHoldings');
  const sumEl  = document.getElementById('portfolioSummary');

  if (ids.length === 0) {
    empty.style.display  = 'flex';
    list.innerHTML       = '';
    sumEl.style.display  = 'none';
    return;
  }

  empty.style.display = 'none';
  sumEl.style.display = 'block';

  let totalVal = 0, totalChange = 0;
  const items = ids.map(id => {
    const coin = allCoins.find(c => c.id === id);
    if (!coin) return '';
    const qty  = portfolio[id];
    const val  = qty * coin.current_price;
    const chg  = coin.price_change_percentage_24h || 0;
    const pnl  = val * (chg / 100);
    totalVal   += val;
    totalChange+= pnl;
    return `
      <div class="holding-item">
        <img class="holding-img" src="${coin.image}" alt="${coin.name}"/>
        <div class="holding-info">
          <div class="holding-name">${coin.name}</div>
          <div class="holding-qty">${qty} ${coin.symbol.toUpperCase()}</div>
        </div>
        <div class="holding-values">
          <div class="holding-val">${formatPrice(val)}</div>
          <div class="holding-pct ${chg>=0?'up':'down'}">${chg>=0?'+':''}${chg.toFixed(2)}%</div>
        </div>
        <button class="holding-remove" onclick="removeHolding('${id}')" title="Remove">✕</button>
      </div>`;
  }).join('');

  list.innerHTML = items;

  const pnlSign = totalChange >= 0 ? '+' : '';
  sumEl.innerHTML = `
    <div class="port-total-label">Total Portfolio Value</div>
    <div class="port-total-val">${formatPrice(totalVal)}</div>
    <div class="port-pnl ${totalChange>=0?'up':'down'}">
      ${pnlSign}${formatPrice(totalChange)} (${pnlSign}${((totalChange/totalVal)*100).toFixed(2)}%) today
    </div>`;
}

function updatePortBadge() {
  const count = Object.keys(portfolio).filter(id => portfolio[id] > 0).length;
  const badge = document.getElementById('portBadge');
  badge.style.display = count > 0 ? 'flex' : 'none';
  badge.textContent   = count;
}

/* ═══════════════════════════════════════════════
   COIN MODAL
═══════════════════════════════════════════════ */
async function openModal(id) {
  activeCoinId = id;
  activeDays   = 7;
  const coin   = allCoins.find(c => c.id === id);
  if (!coin) return;

  // reset tab
  document.querySelectorAll('.ctab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ctab')[1].classList.add('active'); // 7D

  // show
  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('coinModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // header
  const chg = coin.price_change_percentage_24h || 0;
  document.getElementById('modalCoinHeader').innerHTML = `
    <img class="modal-coin-img" src="${coin.image}" alt="${coin.name}"/>
    <div>
      <div class="modal-coin-name">${coin.name}</div>
      <div class="modal-coin-sym">${coin.symbol.toUpperCase()} · #${coin.market_cap_rank}</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div class="modal-coin-price">${formatPrice(coin.current_price)}</div>
      <div class="modal-coin-change ${chg>=0?'up':'down'}">${chg>=0?'▲':'▼'} ${Math.abs(chg).toFixed(2)}% (24h)</div>
    </div>`;

  // stats
  document.getElementById('modalCoinStats').innerHTML = [
    ['Market Cap',     '$' + compactNum(coin.market_cap)],
    ['24h Volume',     '$' + compactNum(coin.total_volume)],
    ['24h High',       formatPrice(coin.high_24h)],
    ['24h Low',        formatPrice(coin.low_24h)],
    ['Circulating',    compactNum(coin.circulating_supply) + ' ' + coin.symbol.toUpperCase()],
    ['ATH',            formatPrice(coin.ath)],
  ].map(([l,v]) => `<div class="mstat-box"><div class="mstat-box-label">${l}</div><div class="mstat-box-val">${v}</div></div>`).join('');

  // portfolio input pre-fill
  document.getElementById('modalQtyInput').value = portfolio[id] || '';

  // chart
  await loadChart(id, 7);
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('coinModal').classList.remove('open');
  document.body.style.overflow = '';
  if (detailChart) { detailChart.destroy(); detailChart = null; }
  activeCoinId = null;
}

async function switchDays(days, btn) {
  activeDays = days;
  document.querySelectorAll('.ctab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  await loadChart(activeCoinId, days);
}

async function loadChart(id, days) {
  const loadEl = document.getElementById('chartLoading');
  const canvas = document.getElementById('detailChart');
  loadEl.style.display  = 'flex';
  canvas.style.opacity  = '0';
  if (detailChart) { detailChart.destroy(); detailChart = null; }

  try {
    const prices = await fetchCoinChart(id, days);
    loadEl.style.display = 'none';
    canvas.style.opacity = '1';

    const coin   = allCoins.find(c => c.id === id);
    const labels = prices.map(p => formatChartDate(p[0], days));
    const vals   = prices.map(p => p[1]);
    const up     = vals[vals.length-1] >= vals[0];
    const color  = up ? '#00d395' : '#ff3b5c';

    detailChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: vals,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, up ? 'rgba(0,211,149,0.2)' : 'rgba(255,59,92,0.2)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            return g;
          }
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { display:false },
          tooltip: {
            callbacks: {
              label: ctx => '  ' + formatPrice(ctx.parsed.y),
              title: ctx => ctx[0].label,
            },
            backgroundColor: 'rgba(13,17,32,0.95)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#8892b0',
            bodyColor: '#e4e8f1',
            padding: 12,
            cornerRadius: 10,
          }
        },
        scales: {
          x: {
            ticks: { color:'#4a5270', maxTicksLimit: 6, font:{ family:'Space Mono', size:10 } },
            grid: { color:'rgba(255,255,255,0.04)' },
          },
          y: {
            position:'right',
            ticks: { color:'#4a5270', font:{ family:'Space Mono', size:10 }, callback: v => '$'+compactNum(v) },
            grid: { color:'rgba(255,255,255,0.04)' },
          }
        },
        animation: { duration:600 }
      }
    });
  } catch(e) {
    loadEl.textContent = '⚠️ Chart unavailable';
  }
}

function formatChartDate(ts, days) {
  const d = new Date(ts);
  if (days <= 1) return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  if (days <= 7) return d.toLocaleDateString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

/* ═══════════════════════════════════════════════
   REFRESH TIMER
═══════════════════════════════════════════════ */
function startTimer() {
  countdown = 60;
  if (cdTimer) clearInterval(cdTimer);
  cdTimer = setInterval(() => {
    countdown--;
    updateRing();
    if (countdown <= 0) {
      countdown = 60;
      fetchCoins();
      fetchGlobal();
    }
  }, 1000);
}

function updateRing() {
  const pct    = countdown / 60;
  const offset = CIRC * (1 - pct);
  const ring   = document.getElementById('ringFill');
  const sec    = document.getElementById('refreshSec');
  if (ring) ring.style.strokeDashoffset = offset;
  if (sec)  sec.textContent = countdown + 's';
}

function refreshNow() {
  countdown = 60;
  updateRing();
  fetchCoins();
  fetchGlobal();
  showToast('🔄 Refreshed!', 'info');
}

/* ═══════════════════════════════════════════════
   SKELETON LOADING
═══════════════════════════════════════════════ */
function renderSkeletons(n) {
  document.getElementById('coinGrid').innerHTML =
    Array(n).fill('<div class="skeleton-card"></div>').join('');
}

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function showToast(msg, type='info') {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2800);
}

/* ═══════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════ */
function formatPrice(n) {
  if (n === null || n === undefined) return '--';
  if (n >= 1000)   return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  if (n >= 1)      return '$' + n.toFixed(4);
  if (n >= 0.0001) return '$' + n.toFixed(6);
  return '$' + n.toExponential(4);
}

function compactNum(n) {
  if (n === null || n === undefined) return '--';
  if (n >= 1e12) return (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n/1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n/1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n/1e3).toFixed(2)  + 'K';
  return n.toFixed(2);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

/* ═══════════════════════════════════════════════
   START
═══════════════════════════════════════════════ */
updatePortBadge();
init();
