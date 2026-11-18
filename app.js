/* 기저귀·물티슈 1매당 최저가 비교 (쿠팡 기준)
 * 데이터는 fetch('data/products.json') 하나에서만 읽습니다.
 * 가격을 갱신할 때는 products.json의 items와 updatedAt만 바꾸면 됩니다. */

const DATA_URL = 'data/products.json';
const CONFIG_URL = 'data/config.json';

const CATEGORY_LABEL = { diaper: '기저귀', wipe: '아기 물티슈' };

const state = {
  category: 'diaper',
  brand: 'all',
  stage: 'all',
  type: 'all',
  form: 'all',
  sort: 'unit'
};

let products = [];
let items = [];
let config = {};
let calcMode = 'packs';   // 'packs' = 팩당 매수 × 팩 수, 'total' = 총 매수 직접 입력
let calcOpen = false;

const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */
const won = (n) => Math.round(n).toLocaleString('ko-KR');

function unitPriceOf(item) {
  const count = Number(item.totalCount);
  if (!count) return Infinity;
  return (Number(item.totalPrice) + Number(item.shipping || 0)) / count;
}

function formatUpdatedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${pad(d.getHours())}:${pad(d.getMinutes())} 기준`;
}

function fmtDate(ymd) {
  const [y, m, d] = String(ymd).split('-');
  if (!d) return ymd;
  return `${Number(m)}/${Number(d)}`;
}

function buyHref(item) {
  const partnersOn = Boolean(config.partnersEnabled);
  if (partnersOn && item.partnerUrl) return item.partnerUrl;
  return item.url;
}

/* 화면에 보여줄 때는 프로토콜을 떼고 도메인부터 보여줍니다. (link.coupang.com/a/...) */
function prettyUrl(url) {
  const s = String(url || '').trim();
  const noProto = s.replace(/^https?:\/\//i, '');
  return noProto.length > 1 ? noProto.replace(/\/$/, '') : noProto;
}

function partnerLinkOf(item) {
  if (!config.partnersEnabled) return '';
  return String(item.partnerUrl || '').trim();
}

/* ---------- rendering ---------- */
function currentItems() {
  return items.filter((it) => it.category === state.category);
}

function filteredItems() {
  let list = currentItems().filter((it) => {
    if (state.brand !== 'all' && it.brand !== state.brand) return false;
    if (state.category === 'diaper') {
      if (state.stage !== 'all' && String(it.stage) !== state.stage) return false;
      if (state.type !== 'all' && it.type !== state.type) return false;
    }
    if (state.category === 'wipe') {
      if (state.form !== 'all' && it.form !== state.form) return false;
    }
    return true;
  });

  const byUnit = (a, b) => unitPriceOf(a) - unitPriceOf(b);

  if (state.sort === 'total') {
    list = list.slice().sort((a, b) => a.totalPrice - b.totalPrice || byUnit(a, b));
  } else if (state.sort === 'updated') {
    list = list.slice().sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)) || byUnit(a, b));
  } else {
    list = list.slice().sort(byUnit);
  }
  return list;
}

function makeOption(value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function fillSelect(select, values, allLabel) {
  const previous = select.value;
  select.textContent = '';
  select.appendChild(makeOption('all', allLabel));
  values.forEach((v) => select.appendChild(makeOption(String(v.value), v.label)));
  const keep = values.some((v) => String(v.value) === previous);
  select.value = keep ? previous : 'all';
}

function resetFilterState() {
  Object.assign(state, { brand: 'all', stage: 'all', type: 'all', form: 'all' });
  ['filterBrand', 'filterStage', 'filterType', 'filterForm'].forEach((id) => {
    const el = $(id);
    if (el) el.value = 'all';
  });
}

function populateFilters() {
  const list = currentItems();
  const brands = [...new Set(list.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, 'ko'));
  fillSelect($('filterBrand'), brands.map((b) => ({ value: b, label: b })), '전체 브랜드');

  const isDiaper = state.category === 'diaper';
  $('stageField').hidden = !isDiaper;
  $('typeField').hidden = !isDiaper;
  $('formField').hidden = isDiaper;

  if (isDiaper) {
    const stages = [...new Set(list.map((i) => i.stage))].filter((v) => v != null).sort((a, b) => a - b);
    fillSelect($('filterStage'), stages.map((s) => ({ value: s, label: `${s}단계` })), '전체 단계');
    const types = [...new Set(list.map((i) => i.type))].filter(Boolean);
    fillSelect($('filterType'), types.map((t) => ({ value: t, label: t })), '전체 타입');
  } else {
    const forms = [...new Set(list.map((i) => i.form))].filter(Boolean);
    fillSelect($('filterForm'), forms.map((f) => ({ value: f, label: f })), '전체 형태');
  }

  state.brand = $('filterBrand').value;
  state.stage = isDiaper ? $('filterStage').value : 'all';
  state.type = isDiaper ? $('filterType').value : 'all';
  state.form = isDiaper ? 'all' : $('filterForm').value;
}

function cardEl(item, isBest) {
  const li = document.createElement('li');
  li.className = 'card' + (isBest ? ' card--best' : '');

  const top = document.createElement('div');
  top.className = 'card__top';

  const brand = document.createElement('span');
  brand.className = 'badge';
  brand.textContent = item.brand;
  top.appendChild(brand);

  if (isBest) {
    const best = document.createElement('span');
    best.className = 'badge badge--best';
    best.textContent = '1매당 최저';
    top.appendChild(best);
  }

  li.appendChild(top);

  const name = document.createElement('h3');
  name.className = 'card__name';
  name.textContent = item.name;
  li.appendChild(name);

  const spec = document.createElement('p');
  spec.className = 'card__spec';
  const specBits = [];
  if (item.category === 'diaper' && item.stage) specBits.push(`${item.stage}단계`);
  if (item.type) specBits.push(item.type);
  if (item.form) specBits.push(item.form);
  specBits.push(item.packLabel);
  spec.textContent = specBits.join(' · ');
  li.appendChild(spec);

  const unit = document.createElement('p');
  unit.className = 'card__unit';
  const strong = document.createElement('strong');
  strong.textContent = `${won(unitPriceOf(item))}원`;
  const per = document.createElement('span');
  per.textContent = '/ 매';
  unit.append(strong, per);
  li.appendChild(unit);

  const total = document.createElement('p');
  total.className = 'card__total';
  const priceB = document.createElement('b');
  priceB.textContent = `총 ${won(item.totalPrice)}원`;
  total.appendChild(priceB);
  const shipTxt = Number(item.shipping) > 0 ? ` + 배송 ${won(item.shipping)}원` : ' · 무료배송';
  total.appendChild(document.createTextNode(`${shipTxt} · 총 ${won(item.totalCount)}매`));
  li.appendChild(total);

  const foot = document.createElement('div');
  foot.className = 'card__foot';

  const note = document.createElement('span');
  note.className = 'card__note';
  note.textContent = item.note || item.seller || '';
  foot.appendChild(note);

  const buy = document.createElement('a');
  buy.className = 'buy';
  buy.href = buyHref(item);
  buy.target = '_blank';
  buy.rel = config.partnersEnabled && item.partnerUrl ? 'sponsored noopener noreferrer' : 'noopener noreferrer';
  buy.textContent = config.buyButtonLabel || '쿠팡에서 보기';
  if (item.seller) buy.title = `${item.seller}에서 보기`;
  foot.appendChild(buy);

  li.appendChild(foot);

  const meta = document.createElement('p');
  meta.className = 'card__note';
  meta.style.marginTop = '8px';
  meta.style.color = 'var(--ink-faint)';
  meta.textContent = `${item.seller || '판매처'} 기준 · ${fmtDate(item.checkedAt)} 확인`;
  li.appendChild(meta);

  /* 제휴 링크가 있으면 카드에 실제 링크 주소(link.coupang.com/...)를 그대로 보여 줍니다. */
  const partnerUrl = partnerLinkOf(item);
  if (partnerUrl) {
    const partner = document.createElement('div');
    partner.className = 'card__partner';

    const pBrand = document.createElement('span');
    pBrand.className = 'card__partner-brand';
    pBrand.textContent = 'COUPANG';

    const pUrl = document.createElement('a');
    pUrl.className = 'card__partner-url';
    pUrl.href = partnerUrl;
    pUrl.target = '_blank';
    pUrl.rel = 'sponsored noopener noreferrer';
    pUrl.textContent = prettyUrl(partnerUrl);
    pUrl.title = partnerUrl;

    partner.append(pBrand, pUrl);
    li.appendChild(partner);
  }

  return li;
}

function render() {
  const list = filteredItems();
  const cards = $('cards');
  cards.textContent = '';

  const minUnit = list.reduce((m, it) => Math.min(m, unitPriceOf(it)), Infinity);

  list.forEach((item) => {
    const isBest = unitPriceOf(item) === minUnit;
    cards.appendChild(cardEl(item, isBest));
  });

  $('emptyState').hidden = list.length > 0;
  $('resultCount').textContent = `쿠팡 ${CATEGORY_LABEL[state.category]} ${list.length}개 상품 · 1매당 낮은 순으로 비교`;

  renderCalcPeek();
  renderCalc();
}

/* ---------- calculator ---------- */
/* 비교 기준은 화면에 보이는 현재 목록(필터 적용 후)이고,
 * 필터 결과가 비면 같은 카테고리 전체를 기준으로 삼습니다. */
function calcStats() {
  const filtered = filteredItems();
  const useFiltered = filtered.length > 0;
  const list = useFiltered ? filtered : currentItems();
  if (!list.length) return null;
  const units = list.map(unitPriceOf).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!units.length) return null;
  const best = units[0];
  const avg = units.reduce((s, v) => s + v, 0) / units.length;
  return {
    best,
    avg,
    count: units.length,
    scoped: useFiltered,
    label: CATEGORY_LABEL[state.category]
  };
}

function renderCalcPeek() {
  const peek = $('calcPeek');
  if (!peek) return;
  const stats = calcStats();
  if (!stats) {
    peek.textContent = '마트 가격도 3초 만에 비교';
    return;
  }
  peek.textContent = `${stats.label} 최저 ${won(stats.best)}원/매 · 평균 ${won(stats.avg)}원/매`;
}

function setCalcMode(mode) {
  calcMode = mode === 'total' ? 'total' : 'packs';
  document.querySelectorAll('.calc__mode-btn').forEach((btn) => {
    const on = btn.dataset.mode === calcMode;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  $('calcPackFields').hidden = calcMode !== 'packs';
  $('calcTotalField').hidden = calcMode !== 'total';
  renderCalc();
}

function setCalcOpen(open) {
  calcOpen = Boolean(open);
  $('calcBody').hidden = !calcOpen;
  $('calcToggle').setAttribute('aria-expanded', String(calcOpen));
  $('calcPanel').classList.toggle('is-open', calcOpen);
  if (calcOpen) renderCalc();
}

function renderCalc() {
  const box = $('calcResult');
  const basis = $('calcBasis');
  if (!box) return;
  box.textContent = '';

  const price = Number($('calcPrice').value);
  const stats = calcStats();

  let totalCount = 0;
  let formula = '';

  if (calcMode === 'total') {
    totalCount = Number($('calcTotalCount').value);
    formula = `${won(price)}원 ÷ ${won(totalCount)}매`;
  } else {
    const perPack = Number($('calcPerPack').value);
    const packCount = Number($('calcPackCount').value || 1);
    totalCount = perPack * packCount;
    formula = `${won(price)}원 ÷ ${won(totalCount)}매 (${won(perPack)}매 × ${won(packCount)}팩)`;
  }

  const ready = Number.isFinite(price) && Number.isFinite(totalCount) && price > 0 && totalCount > 0;

  if (!ready) {
    const hint = document.createElement('p');
    hint.className = 'calc__hint';
    hint.textContent = calcMode === 'total'
      ? '결제 금액과 총 매수를 입력하면 1매당 가격이 나옵니다.'
      : '결제 금액과 팩당 매수를 입력하면 1매당 가격이 나옵니다.';
    box.appendChild(hint);
    basis.textContent = stats
      ? `${stats.scoped ? '현재 목록' : `쿠팡 ${stats.label} 전체`} ${stats.count}개 상품 기준 · 최저 ${won(stats.best)}원/매 · 평균 ${won(stats.avg)}원/매`
      : '';
    return;
  }

  const unit = price / totalCount;

  const line = document.createElement('p');
  line.className = 'calc__unit';
  const strong = document.createElement('strong');
  strong.textContent = `${won(unit)}원`;
  const per = document.createElement('span');
  per.textContent = '/ 매';
  line.append(strong, per);
  box.appendChild(line);

  const detail = document.createElement('p');
  detail.className = 'calc__line';
  detail.textContent = `${formula} · 총 ${won(totalCount)}매`;
  box.appendChild(detail);

  if (stats) {
    const cmp = document.createElement('div');
    cmp.className = 'calc__compare';

    const mine = document.createElement('div');
    mine.className = 'calc__cmp calc__cmp--mine';
    const mineLabel = document.createElement('span');
    mineLabel.textContent = '내 단가';
    const mineValue = document.createElement('b');
    mineValue.textContent = `${won(unit)}원`;
    mine.append(mineLabel, mineValue);

    const best = document.createElement('div');
    best.className = 'calc__cmp calc__cmp--best';
    const bestLabel = document.createElement('span');
    bestLabel.textContent = '목록 최저';
    const bestValue = document.createElement('b');
    bestValue.textContent = `${won(stats.best)}원`;
    best.append(bestLabel, bestValue);

    const avg = document.createElement('div');
    avg.className = 'calc__cmp calc__cmp--avg';
    const avgLabel = document.createElement('span');
    avgLabel.textContent = '목록 평균';
    const avgValue = document.createElement('b');
    avgValue.textContent = `${won(stats.avg)}원`;
    avg.append(avgLabel, avgValue);

    cmp.append(mine, best, avg);
    box.appendChild(cmp);

    const diffBest = unit - stats.best;
    const diffAvg = unit - stats.avg;
    const verdict = document.createElement('p');
    if (unit <= stats.best) {
      verdict.className = 'calc__verdict calc__verdict--good';
      verdict.textContent = `목록 최저가(${won(stats.best)}원/매)와 같거나 더 쌉니다. 지금 사기 좋아요.`;
    } else if (diffAvg <= 0) {
      verdict.className = 'calc__verdict calc__verdict--good';
      verdict.textContent = `평균(${won(stats.avg)}원/매)보다 ${won(-diffAvg)}원 저렴합니다. 최저가보다는 ${won(diffBest)}원 비쌉니다.`;
    } else if (unit <= stats.avg * 1.15) {
      verdict.className = 'calc__verdict calc__verdict--even';
      verdict.textContent = `평균보다 ${won(diffAvg)}원 비쌉니다. 묶음 구성을 한 번 더 보세요.`;
    } else {
      verdict.className = 'calc__verdict calc__verdict--bad';
      verdict.textContent = `평균보다 ${won(diffAvg)}원, 최저가보다 ${won(diffBest)}원 비쌉니다. 대용량 구성이 더 쌀 수 있어요.`;
    }
    box.appendChild(verdict);

    basis.textContent = `비교 기준: ${stats.scoped ? '현재 목록' : `쿠팡 ${stats.label} 전체`} ${stats.count}개 상품의 1매당 가격 · 최저 ${won(stats.best)}원 / 평균 ${won(stats.avg)}원 · 1매당 가격 = (상품가 + 배송비) ÷ 총 매수`;
  }
}

/* ---------- view switching ---------- */
function setCategory(category) {
  state.category = category;
  document.querySelectorAll('.tab').forEach((tab) => {
    const on = tab.dataset.category === category;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', String(on));
  });

  resetFilterState();
  populateFilters();
  render();
}

/* ---------- wiring ---------- */
function wire() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => setCategory(tab.dataset.category));
  });

  $('filterBrand').addEventListener('change', (e) => { state.brand = e.target.value; render(); });
  $('filterStage').addEventListener('change', (e) => { state.stage = e.target.value; render(); });
  $('filterType').addEventListener('change', (e) => { state.type = e.target.value; render(); });
  $('filterForm').addEventListener('change', (e) => { state.form = e.target.value; render(); });
  $('sortBy').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  $('resetFilters').addEventListener('click', () => {
    resetFilterState();
    populateFilters();
    render();
  });

  $('calcToggle').addEventListener('click', () => setCalcOpen(!calcOpen));
  document.querySelectorAll('.calc__mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setCalcMode(btn.dataset.mode));
  });

  ['calcPrice', 'calcPerPack', 'calcPackCount', 'calcTotalCount'].forEach((id) => {
    $(id).addEventListener('input', renderCalc);
    $(id).addEventListener('change', renderCalc);
  });
}

async function boot() {
  try {
    const [productsRes, configRes] = await Promise.all([fetch(DATA_URL), fetch(CONFIG_URL)]);
    if (!productsRes.ok) throw new Error(`products.json ${productsRes.status}`);
    if (!configRes.ok) throw new Error(`config.json ${configRes.status}`);
    const data = await productsRes.json();
    config = await configRes.json();

    items = (data.items || []).map((it) => ({ ...it }));
    products = data;

    $('updatedAt').textContent = `${config.updatedAtLabel || '최저가 확인'} ${formatUpdatedAt(data.updatedAt)}`;

    const notice = $('partnersNotice');
    if (config.partnersEnabled && config.partnersNotice) {
      notice.textContent = config.partnersNotice;
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }

    const notes = $('footNotes');
    notes.textContent = '';
    (config.notes || []).forEach((n) => {
      const li = document.createElement('li');
      li.textContent = n;
      notes.appendChild(li);
    });

    $('sortBy').value = config.defaultSort || 'unit';
    state.sort = $('sortBy').value;

    wire();
    setCategory('diaper');
    setCalcMode('packs');

    /* 예전 '직접 계산기' 탭 링크(#calc)로 들어와도 계산기가 펼쳐지게 합니다. */
    if (location.hash === '#calc') {
      setCalcOpen(true);
      $('calcPanel').scrollIntoView({ block: 'nearest' });
    }
  } catch (err) {
    $('updatedAt').textContent = '데이터를 불러오지 못했습니다';
    $('emptyState').hidden = false;
    $('emptyState').textContent = `데이터를 불러오지 못했습니다 (${err.message}). data/ 폴더의 JSON을 확인하세요.`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', boot);
