/* Раздел «Деньги»: доход, накопления, расходы, кредит.
   Подключается перед основным скриптом и пользуется его помощниками (state, money, esc, section…). */

const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
let finSub = 'income';
let finMonth = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
let formCfg = null;

const nowMonth = () => keyOf(new Date()).slice(0, 7);
const mShift = (k, n) => { const d = new Date(+k.slice(0, 4), +k.slice(5) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const mName = k => MONTHS_NOM[+k.slice(5) - 1] + ' ' + k.slice(0, 4);
const mDiff = (a, b) => (b.slice(0, 4) - a.slice(0, 4)) * 12 + (b.slice(5) - a.slice(5));
const usd = n => money(n) + ' $';
const byn = n => Math.round(n).toLocaleString('ru-RU') + ' BYN';
const numOrNull = s => { const n = parseNum(s); return isNaN(n) ? null : n; };
const total = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const years = n => { const y = Math.floor(n / 12), m = n % 12; return (y ? y + ' ' + plural(y, 'год', 'года', 'лет') + ' ' : '') + (m || !y ? m + ' мес.' : '').trim(); };

const PALETTE = ['#f9dc6b', '#f4b6d9', '#cdc8f6', '#bdd3f3', '#b9e6d6', '#fad6b8', '#f6aaa3', '#c5d8a4', '#e7c6f5', '#a9dfe8'];
const CAT_EMOJI = ['🍎', '💅', '📱', '🏠', '👗', '📚', '🚕', '🎁', '💊', '🎉', '🐾', '✈️', '☕', '🧾', '💻', '🏷️'];
const CAT_NONE = { id: 'none', name: 'Без категории', emoji: '❔', color: '#d9d9e2' };
const defaultCats = () => [['subs', 'Подписки', '📱'], ['food', 'Еда', '🍎'], ['beauty', 'Красота', '💅'], ['home', 'Дом', '🏠'], ['clothes', 'Одежда', '👗'], ['study', 'Обучение', '📚']]
  .map((c, i) => ({ id: c[0], name: c[1], emoji: c[2], color: PALETTE[i] }));
const catOf = id => state.fin.cats.find(c => c.id === id) || CAT_NONE;
function finMigrate() {
  if (!state.fin.cats) state.fin.cats = defaultCats();
  // раньше было два поля «я» и «Лёша», теперь одна сумма за месяц
  Object.values(state.fin.months).forEach(m => { if (m.saveLesha != null) { m.saveMe = (m.saveMe || 0) + m.saveLesha; } delete m.saveLesha; });
}

function finEmpty() {
  return { months: {}, goal: null, expected: [], accounts: [], fixed: [], subs: [], cats: defaultCats(), rate: 3,
    loan: { balance: 0, rate1: 1, rate2: 15.4, graceEnd: '', deferEnd: '', pay1: 0, pay2: 0, payments: [] } };
}

// перенос из таблицы: компактная запись превращается в данные приложения
function finImport(seed) {
  const f = finEmpty();
  Object.keys(seed.months || {}).forEach(k => {
    const s = seed.months[k];
    f.months[k] = { items: (s.items || []).map(i => ({ id: newId(), name: i[0], amount: i[1], gift: i[2] === 'gift', tax: 0 })),
      goal: s.goal || null, taxFlat: s.taxFlat || null, saveMe: s.saveMe == null && s.saveLesha == null ? null : (s.saveMe || 0) + (s.saveLesha || 0), plan: s.plan || null };
  });
  f.goal = seed.goal || null;
  f.expected = (seed.expected || []).map(x => ({ id: newId(), name: x[0], amount: x[1] }));
  f.accounts = (seed.accounts || []).map(x => ({ id: newId(), name: x[0], amount: x[1] }));
  f.fixed = (seed.fixed || []).map(x => ({ id: newId(), name: x[0], amount: x[1], cat: x[2] || null }));
  f.subs = (seed.subs || []).map(x => ({ id: newId(), name: x[0], month: x[1], year: x[2], note: x[3] || '' }));
  if (seed.rate) f.rate = seed.rate;
  Object.assign(f.loan, seed.loan || {});
  state.fin = f;
  save(); render();
}

const monGet = k => state.fin.months[k] || { items: [] };
const monMake = k => state.fin.months[k] || (state.fin.months[k] = { items: [] });
function monCalc(k) {
  const m = monGet(k), work = m.items.filter(i => !i.gift);
  const gross = total(work, i => i.amount);
  const tax = total(work, i => i.amount * (i.tax || 0) / 100) + (m.taxFlat || 0);
  return { gross, tax, net: gross - tax, gifts: total(m.items.filter(i => i.gift), i => i.amount) };
}

function finRow(o) {
  return '<div class="row plain' + (o.cls ? ' ' + o.cls : '') + '"' + (o.act ? ' data-act="' + o.act + '" data-id="' + (o.id || '') + '"' : '') + '>' +
    '<div class="emo">' + o.emo + '</div><div class="info"><div class="name">' + esc(o.name) + '</div>' +
    (o.meta ? '<div class="meta">' + esc(o.meta) + '</div>' : '') + '</div>' +
    (o.amt ? '<div class="amt">' + esc(o.amt) + '</div>' : '') + '</div>';
}
function finHero(o) {
  return '<div class="hero money"><div class="goal">' + esc(o.label) + '</div><div class="num">' + esc(o.num) + '</div>' +
    '<div class="of">' + esc(o.of) + '</div>' + (o.pct == null ? '' : '<div class="bar"><i style="--w:' + Math.max(0, Math.min(100, o.pct)) + '%"></i></div>') +
    '<div class="foot"' + (o.pct == null ? ' style="margin-top:14px"' : '') + '><div class="pill">' + esc(o.pill) + '</div>' +
    '<button class="pill" data-act="' + o.act + '">' + o.btn + '</button></div></div>';
}
const stat = (value, label, cls, act) => '<div class="stat sm' + (cls ? ' ' + cls : '') + '"' + (act ? ' data-act="' + act + '"' : '') + '><b>' + esc(value) + '</b><span>' + label + '</span></div>';

/* ---------- экран ---------- */
function viewMoney() {
  $('title').textContent = 'Деньги';
  if (finSub === 'loan') finSub = 'income';
  const subs = [['income', 'Доход'], ['savings', 'Накопления'], ['costs', 'Расходы']];
  view.innerHTML = '<div class="seg">' + subs.map(s => '<button class="' + (s[0] === finSub ? 'cur' : '') + '" data-act="sub" data-id="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>' +
    ({ income: viewIncome, savings: viewSavings, costs: viewCosts })[finSub]();
}
// кредит живёт отдельной вкладкой в нижнем меню
function viewLoanTab() { $('title').textContent = 'Кредит'; view.innerHTML = viewLoan(); }
function loanAdd() { if (state.fin.loan.balance) payForm(); else finAct('loanset'); }
const finAddLabel = () => ({ income: '+ Добавить доход', savings: '+ Добавить счёт', costs: '+ Добавить расход', loan: '+ Внести платёж' })[finSub];

function viewIncome() {
  const k = finMonth, m = monGet(k), c = monCalc(k);
  const work = m.items.filter(i => !i.gift), gifts = m.items.filter(i => i.gift);
  let html = '<div class="mnav"><button data-act="mprev">‹</button><b>' + mName(k) + '</b><button data-act="mnext">›</button></div>' +
    finHero({ label: 'Заработано', num: usd(c.gross),
      of: '≈ ' + byn(c.gross * state.fin.rate) + ' · ' + (m.goal ? 'цель ' + usd(m.goal) + ' (' + Math.round(c.gross / m.goal * 100) + '%)' : 'цель не задана'),
      pct: m.goal ? c.gross / m.goal * 100 : null,
      pill: c.tax ? 'на руки ' + usd(c.net) + ' · налог ' + usd(c.tax) : 'налога нет',
      act: 'monthset', btn: 'цель и налог' });
  if (!m.items.length) {
    html += empty('В этом месяце доходов пока нет.');
    if (monGet(mShift(k, -1)).items.some(i => !i.gift)) html += '<button class="ghost" data-act="repeat">Повторить ' + mName(mShift(k, -1)).toLowerCase() + '</button>';
  }
  html += section('От кого · нажми, чтобы изменить', work.map(i => finRow({ act: 'edit', id: 'inc:' + i.id, emo: '💼', name: i.name, amt: usd(i.amount),
    meta: (i.tax ? 'налог ' + i.tax + '% · на руки ' + usd(i.amount * (1 - i.tax / 100)) : 'без налога') + ' · ≈ ' + byn(i.amount * (1 - (i.tax || 0) / 100) * state.fin.rate) })));
  if (m.taxFlat) html += finRow({ act: 'monthset', emo: '🧾', name: 'Налог за месяц', meta: 'одной суммой', amt: '−' + usd(m.taxFlat), cls: 'minus' });
  html += section('Подарки · в заработок не входят', gifts.map(i => finRow({ act: 'edit', id: 'inc:' + i.id, emo: '🎁', name: i.name, amt: usd(i.amount) })));
  return html;
}

function viewSavings() {
  const f = state.fin, g = f.goal, saved = total(f.accounts, a => a.amount), exp = total(f.expected, e => e.amount);
  let html = '';
  if (!g) html += empty('Цель накоплений не задана.') + '<button class="ghost" data-act="goalset">Поставить цель</button>';
  else {
    const left = Math.max(0, g.amount - saved), n = g.deadline ? Math.max(1, mDiff(nowMonth(), g.deadline)) : null;
    html += finHero({ label: '🎯 ' + g.name, num: usd(saved), of: 'из ' + usd(g.amount) + ' · ' + Math.round(saved / g.amount * 100) + '%',
      pct: saved / g.amount * 100, pill: left ? 'осталось ' + usd(left) : 'цель закрыта 🎉', act: 'goalset', btn: 'изменить цель' });
    if (n && left) html += '<div class="stats" style="margin-top:10px">' + stat(usd(Math.ceil(left / n)), 'нужно в месяц', 'hot') +
      stat(String(n), plural(n, 'месяц', 'месяца', 'месяцев') + ' до срока') +
      stat(exp ? usd(Math.ceil(Math.max(0, left - exp) / n)) : '—', 'в месяц, если придёт ожидаемое') + '</div>';
  }
  html += section('Ожидается · в накопленное не входит', f.expected.map(e => finRow({ act: 'edit', id: 'exp:' + e.id, emo: '⏳', name: e.name, amt: '~' + usd(e.amount) })));
  html += section('Счета · всего ' + usd(saved), f.accounts.map(a => finRow({ act: 'edit', id: 'acc:' + a.id, emo: '🏦', name: a.name, amt: usd(a.amount) })));
  const keys = Object.keys(f.months).filter(k => { const m = f.months[k]; return m.saveMe != null || m.plan; });
  if (!keys.includes(nowMonth())) keys.push(nowMonth());
  html += section('По месяцам · нажми, чтобы вписать', keys.sort().reverse().map(k => {
    const m = monGet(k), parts = [];
    parts.push(m.saveMe == null ? 'не вписано' : 'отложено');
    if (m.plan) parts.push('планка ' + usd(m.plan));
    return finRow({ act: 'edit', id: 'sav:' + k, emo: '📅', name: mName(k), meta: parts.join(' · '), amt: m.saveMe ? '+' + usd(m.saveMe) : '' });
  }));
  return html;
}

// постоянный расход или подписка действует с месяца from по месяц to (пусто = всегда)
const activeIn = (x, k) => (!x.from || x.from <= k) && (!x.to || k <= x.to);
// «убрать» постоянный расход: с этого месяца он больше не считается, прошлые месяцы не меняются
function stopItem(list, it) {
  it.to = mShift(nowMonth(), -1);
  if (it.from && it.to < it.from) list.splice(list.indexOf(it), 1);
}
function viewCosts() {
  const f = state.fin, k = finMonth, m = monGet(k), vars = m.costs || [];
  const fixed = f.fixed.filter(x => activeIn(x, k)), subs = f.subs.filter(x => activeIn(x, k));
  const subMonth = total(subs, s => s.month), subYear = total(subs, s => s.year);
  const fixSum = total(fixed, x => x.amount) + subMonth * f.rate, varSum = total(vars, x => x.amount), all = fixSum + varSum;
  let html = '<div class="mnav"><button data-act="mprev">‹</button><b>' + mName(k) + '</b><button data-act="mnext">›</button></div>' +
    finHero({ label: 'Расходы за месяц', num: byn(all), of: '≈ ' + usd(Math.round(all / f.rate)) + ' по курсу ' + String(f.rate).replace('.', ','), pct: null,
      pill: 'постоянные ' + byn(fixSum) + ' · переменные ' + byn(varSum), act: 'rateset', btn: 'курс $' });
  // куда ушли деньги: по категориям
  const sums = {};
  const put = (id, v) => { const key = catOf(id).id; sums[key] = (sums[key] || 0) + v; };
  fixed.forEach(x => put(x.cat, x.amount)); vars.forEach(x => put(x.cat, x.amount));
  if (subMonth) put('subs', subMonth * f.rate);
  const parts = Object.keys(sums).filter(id => sums[id] > 0).map(id => ({ cat: catOf(id), sum: sums[id] })).sort((a, b) => b.sum - a.sum);
  if (all > 0) {
    const R = 52, C = 2 * Math.PI * R; let acc = 0;
    html += '<div class="note chart"><svg viewBox="0 0 140 140" width="160" height="160"><g transform="rotate(-90 70 70)">' + parts.map(x => {
      const len = x.sum / all * C, seg = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + x.cat.color + '" stroke-width="24" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '"/>';
      acc += len; return seg;
    }).join('') + '</g><text x="70" y="68" text-anchor="middle" font-size="17" font-weight="800" fill="currentColor">' + Math.round(all).toLocaleString('ru-RU') + '</text>' +
      '<text x="70" y="84" text-anchor="middle" font-size="10" font-weight="600" fill="#8a8a96">BYN</text></svg><div class="legend">' +
      parts.map(x => '<button class="lg" data-act="cat" data-id="' + x.cat.id + '"><i style="background:' + x.cat.color + '"></i><span>' + x.cat.emoji + ' ' + esc(x.cat.name) + '</span><em>' + Math.round(x.sum / all * 100) + '%</em><b>' + byn(x.sum) + '</b></button>').join('') +
      '</div><button class="xfer" style="margin-top:4px" data-act="catnew">+ Новая категория</button></div>';
  }
  html += '<div class="sub">Переменные · только ' + mName(k).toLowerCase() + '</div>' + (vars.length
    ? vars.map(x => finRow({ act: 'edit', id: 'var:' + x.id, emo: x.cat ? catOf(x.cat).emoji : '🛒', name: x.name, meta: catOf(x.cat).name, amt: byn(x.amount) })).join('')
    : '<div class="note" style="margin-top:0;color:var(--muted)">Пока пусто. Разовые траты месяца добавляются кнопкой внизу.</div>');
  const fixedRows = fixed.map(x => finRow({ act: 'edit', id: 'fix:' + x.id, emo: x.cat ? catOf(x.cat).emoji : '📌', name: x.name, meta: catOf(x.cat).name, amt: byn(x.amount) }));
  if (subMonth) fixedRows.push(finRow({ emo: '📱', name: 'Подписки', meta: 'сумма из списка ниже', amt: byn(subMonth * f.rate) }));
  html += section('Постоянные · идут каждый месяц, пока не уберёшь', fixedRows);
  html += section('Подписки · ' + usd(subMonth) + ' в месяц' + (subYear ? ' · годовые тарифы ' + usd(subYear) : ''), subs.map(s => finRow({
    act: 'edit', id: 'sub:' + s.id, emo: '📱', name: s.name, amt: s.month ? usd(s.month) + '/мес' : '—',
    meta: [s.year ? 'за год ' + usd(s.year) : '', s.note].filter(Boolean).join(' · ') })));
  return html;
}

/* ---------- кредит ---------- */
function rateAt(k) { const L = state.fin.loan; return L.graceEnd && k > L.graceEnd ? L.rate2 : L.rate1; }
// плановый платёж месяца: в отсрочку только проценты, потом платёж льготного периода, потом основной
function planAt(k, bal) {
  const L = state.fin.loan, i = bal * rateAt(k) / 1200;
  if (L.deferEnd && k <= L.deferEnd) return i;
  return Math.max(i, (L.graceEnd && k <= L.graceEnd ? L.pay1 || L.pay2 : L.pay2) || 0);
}
const loanReady = () => { const L = state.fin.loan; return !!(L.graceEnd && L.pay2 > 0); };
// сколько месяцев до закрытия по графику (плюс extra сверху каждый месяц) и сколько уйдёт на проценты
function payoff(bal, extra, from) {
  let k = from || mShift(nowMonth(), 1), n = 0, int = 0;
  while (bal > 0.5) {
    if (n >= 720) return null;
    const i = bal * rateAt(k) / 1200;
    int += i; bal -= Math.min(bal, planAt(k, bal) + (extra || 0) - i); n++; k = mShift(k, 1);
  }
  return { n, int, end: mShift(k, -1) };
}
function applyPay(p) {
  const L = state.fin.loan, k = p.date.slice(0, 7), i = L.balance * rateAt(k) / 1200;
  p.interest = Math.min(p.amount, i);
  p.principal = Math.min(L.balance, p.amount - p.interest);
  p.shorter = null; p.saved = null;
  if (loanReady()) {
    const usual = Math.min(L.balance, planAt(k, L.balance) - i), next = mShift(k, 1);
    const before = payoff(L.balance - usual, 0, next), after = payoff(L.balance - p.principal, 0, next);
    if (before && after) { p.shorter = before.n - after.n; p.saved = before.int - after.int; }
  }
  L.balance -= p.principal;
}
function viewLoan() {
  const f = state.fin, L = f.loan, pc = x => String(x).replace('.', ',') + '%';
  if (!L.balance && !L.payments.length) return empty('Кредит не заполнен.') + '<button class="ghost" data-act="loanset">Вписать параметры кредита</button>';
  const now = nowMonth(), paid = total(L.payments, p => p.amount), num = x => Math.round(x).toLocaleString('ru-RU');
  const since = k => 'BYN в месяц с ' + MONTHS[+k.slice(5) - 1] + ' ' + k.slice(0, 4);
  let html = finHero({ label: 'Остаток долга', num: byn(L.balance), of: 'ставка сейчас ' + pc(rateAt(now)), pct: null,
    pill: L.graceEnd ? (now > L.graceEnd ? 'льготный период закончился' : pc(L.rate1) + ' по ' + mName(L.graceEnd).toLowerCase()) : 'не указано, до какого месяца ' + pc(L.rate1),
    act: 'loanset', btn: 'параметры' });
  if (!loanReady()) {
    html += '<div class="stats" style="margin-top:10px">' + stat(num(L.balance * L.rate1 / 1200), 'BYN · проценты в месяц под ' + pc(L.rate1)) +
      stat(num(L.balance * L.rate2 / 1200), 'BYN · проценты в месяц под ' + pc(L.rate2), 'bad') + stat(num(paid), 'BYN внесено всего') + '</div>' +
      '<div class="note">Чтобы посчитать срок и переплату, впиши в «параметрах» месяц, до которого действует льготная ставка, и платёж после неё.</div>';
  } else {
    const boxes = [stat(num(planAt(now, L.balance)), 'BYN · платёж сейчас')];
    if (L.deferEnd && now <= L.deferEnd && L.pay1) boxes.push(stat(num(L.pay1), since(mShift(L.deferEnd, 1))));
    if (now <= L.graceEnd) boxes.push(stat(num(Math.max(L.pay2, 0)), since(mShift(L.graceEnd, 1)), 'bad'));
    while (boxes.length < 3) boxes.push(stat(num(paid), 'BYN внесено всего'));
    const base = payoff(L.balance, 0);
    html += '<div class="stats" style="margin-top:10px">' + boxes.join('') + '</div><div class="note">' + (base
      ? 'По графику долг закроется через <b>' + years(base.n) + '</b> (' + mName(base.end).toLowerCase() + '). На проценты за это время уйдёт ≈ <b>' + byn(base.int) + '</b>.'
      : 'Плановый платёж не покрывает проценты, по такому графику долг не закроется. Проверь цифры в «параметрах».') + '</div>';
    if (base) html += section('А если платить сверх графика каждый месяц', [500, 1000, 2000].map(add => {
      const x = payoff(L.balance, add);
      return finRow({ emo: '⚡', name: '+' + byn(add) + ' в месяц', meta: 'быстрее на ' + years(base.n - x.n) + ' · процентов меньше на ≈ ' + byn(base.int - x.int) });
    }));
  }
  if (loanReady()) html += loanCalcHtml();
  html += section('Платежи', L.payments.slice().reverse().map(p => finRow({ act: 'edit', id: 'pay:' + p.id, emo: '💳', name: byn(p.amount),
    meta: 'в долг ' + byn(p.principal) + ' · проценты ' + byn(p.interest) + ' · ' + nearDate(p.date) +
      (p.shorter > 0 ? ' · срок короче на ' + years(p.shorter) : '') + (p.saved > 1 ? ' · процентов меньше на ≈ ' + byn(p.saved) : '') })));
  return html + '<div class="note" style="font-size:13px;color:var(--muted)">Расчёт ориентировочный: банк считает проценты по дням, а ставка после льготного периода плавающая.</div>';
}

/* ---------- калькулятор досрочных взносов в тело кредита ---------- */
const annuity = (b, r, n) => r ? b * r / (1 - Math.pow(1 + r, -n)) : b / n;
const extraByn = e => e.cur === 'usd' ? e.amt * state.fin.rate : e.amt;
// Модель как у банка (сверено с графиком до копейки): в отсрочку платятся только проценты,
// дальше платёж = аннуитет на остаток долга на оставшийся срок по текущей ставке.
// keepPay: после взносов платёж с 3-го года не уменьшается, кредит закрывается раньше.
// последний месяц кредита: если не вписан, подбираем такой, при котором расчёт совпадает с платежами из графика банка
let _endCache = { key: '', end: '' };
function loanEnd() {
  const L = state.fin.loan;
  if (L.endMonth) return L.endMonth;
  const key = [L.balance, L.rate1, L.rate2, L.deferEnd, L.graceEnd, L.pay1, L.pay2].join('|');
  if (_endCache.key === key) return _endCache.end;
  let best = '2046-08', err = Infinity;
  if (L.pay1 || L.pay2) for (let k = '2040-01'; k <= '2052-12'; k = mShift(k, 1)) {
    const b = loanSim([], false, null, k), e = (L.pay1 && b.payY2 ? Math.abs(b.payY2 - L.pay1) : 0) + (L.pay2 && b.pay3 ? Math.abs(b.pay3 - L.pay2) : 0);
    if (e < err) { err = e; best = k; }
  }
  _endCache = { key, end: best };
  return best;
}
function loanSim(extras, keepPay, basePay3, endOverride) {
  const L = state.fin.loan, end = endOverride || loanEnd(), first = mShift(nowMonth(), 1), ex = {};
  (extras || []).forEach(e => { const k = e.month < first ? first : e.month; ex[k] = (ex[k] || 0) + extraByn(e); });
  let bal = L.balance, k = first, int = 0, n = 0, pay3 = null, payY2 = null;
  const pays = {};
  while (bal > 0.5 && n < 720) {
    if (ex[k]) bal = Math.max(0, bal - ex[k]);
    if (bal <= 0.5) break;
    const r = rateAt(k) / 1200, i = bal * r, left = Math.max(1, mDiff(k, end) + 1);
    let pay;
    if (L.deferEnd && k <= L.deferEnd) pay = i;
    else if (keepPay && basePay3 && L.graceEnd && k > L.graceEnd) pay = basePay3;
    else pay = annuity(bal, r, left);
    if (L.deferEnd && k > L.deferEnd && payY2 === null) payY2 = pay;
    if (L.graceEnd && k > L.graceEnd && pay3 === null) pay3 = pay;
    pays[k] = pay;
    int += i; bal -= Math.min(bal, pay - i); n++; k = mShift(k, 1);
  }
  return { int, pay3, payY2, pays, end: mShift(k, -1), n };
}
function loanCalcHtml() {
  const L = state.fin.loan, f = state.fin, ex = (L.extras || []).slice().sort((a, b) => a.month.localeCompare(b.month));
  const num = x => Math.round(x).toLocaleString('ru-RU'), low = k => mName(k).toLowerCase(), gen = k => MONTHS[+k.slice(5) - 1] + ' ' + k.slice(0, 4);
  const base = loanSim([], false), y3 = L.graceEnd ? mShift(L.graceEnd, 1) : null;
  let html = '<div class="sub">Калькулятор досрочных взносов в тело кредита</div>';
  if (base.pay3 && y3 && nowMonth() <= L.graceEnd) {
    const per = loanSim([{ month: L.graceEnd, amt: 1000, cur: 'usd' }], false);
    html += '<div class="note" style="margin-top:0">Ориентир: каждые <b>1 000 $</b> (≈ ' + byn(1000 * f.rate) + ' по курсу ' + String(f.rate).replace('.', ',') + '), внесённые в тело до ' + gen(y3) +
      ', уменьшают платёж с 3-го года примерно на <b>' + num(base.pay3 - per.pay3) + ' BYN</b> в месяц, а проценты за весь срок примерно на <b>' + byn(base.int - per.int) + '</b>.</div>';
  }
  if (ex.length) {
    const sum = total(ex, extraByn), cut = loanSim(ex, false), fast = loanSim(ex, true, base.pay3);
    const last = ex[ex.length - 1].month, after = y3 && last >= y3 ? mShift(last, 1) : y3;
    html += section('Твой план · ' + byn(sum) + ' ≈ ' + usd(Math.round(sum / f.rate)), ex.map(e => finRow({ act: 'edit', id: 'ext:' + e.id, emo: '💰',
      name: e.cur === 'usd' ? usd(e.amt) : byn(e.amt), meta: mName(e.month) + (e.cur === 'usd' ? ' · ≈ ' + byn(extraByn(e)) : ''), amt: '' })));
    html += '<div class="note lxres"><div class="lxh">Вариант 1. Уменьшить платёж</div>' +
      (base.payY2 && cut.payY2 && Math.round(base.payY2) !== Math.round(cut.payY2) ? 'Платёж во 2-й год: ' + num(base.payY2) + ' → <b>' + num(cut.payY2) + ' BYN</b><br>' : '') +
      (after && base.pays[after] ? 'Платёж с ' + gen(after) + ': ' + num(base.pays[after]) + ' → <b>' + num(cut.pays[after] || 0) + ' BYN</b> (−' + num(base.pays[after] - (cut.pays[after] || 0)) + ' в месяц)<br>' : '') +
      'Проценты за весь срок меньше на ≈ <b>' + byn(base.int - cut.int) + '</b>' +
      '<div class="lxh">Вариант 2. Платить как раньше и закрыть раньше</div>' +
      'Платёж с 3-го года остаётся ' + num(base.pay3 || 0) + ' BYN, последний платёж — <b>' + low(fast.end) + '</b> вместо ' + gen(base.end) +
      (base.n > fast.n ? ' (на ' + years(base.n - fast.n) + ' раньше)' : '') + '<br>Проценты за весь срок меньше на ≈ <b>' + byn(base.int - fast.int) + '</b></div>';
  } else html += '<div class="note" style="color:var(--muted)">Добавь взносы, которые планируете внести в тело кредита, и здесь появится расчёт: насколько уменьшится платёж или на сколько раньше закроется кредит.</div>';
  html += '<button class="ghost" data-act="lxadd">+ Добавить взнос в план</button>';
  html += '<div class="sub">Как это работает</div><div class="note tips">' +
    '<p>• <b>Пока ставка 1%</b> (' + (L.graceEnd ? 'до ' + gen(mShift(L.graceEnd, 1)) : 'до конца льготного периода') + '), деньги в кредите почти не дорожают: внести взнос сейчас или в конце льготного периода — разница по процентам около 1% от суммы в год. Главное, на что влияет взнос, — платёж и проценты под 15,4%.</p>' +
    '<p>• <b>С 3-го года</b> каждый месяц, пока сумма лежит в долге, стоит примерно 1,3% от неё (15,4% в год). Поэтому после перехода на 15,4% чем раньше внесён взнос, тем больше экономия.</p>' +
    '<p>• <b>Уменьшить платёж или срок:</b> сокращение срока экономит на процентах больше, уменьшение платежа делает каждый месяц легче. Сравни оба варианта выше.</p>' +
    '<p>• <b>Что уточнить в банке:</b> как оформить частичное досрочное погашение и что банк пересчитает после него — платёж или срок. Комиссии за досрочное погашение по описанию программы нет, но порядок лучше проверить.</p>' +
    '<p>• Ставка после льготы <b>плавающая</b> (ставка рефинансирования + 6,15): если её поменяют, цифры сдвинутся. Взносы в долларах банк переведёт в рубли по своему курсу, здесь считаю по ' + String(f.rate).replace('.', ',') + '.</p></div>';
  return html;
}
function extraForm(e) {
  const L = state.fin.loan;
  formSheet({
    title: e ? 'Взнос в тело кредита' : 'Новый взнос в план', ok: e ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'amt', ph: 'Сумма', mode: 'num', value: e && e.amt }, { key: 'month', lab: 'Когда внести', mode: 'month', value: e ? e.month : mShift(nowMonth(), 1), after: true }],
    chips: [{ key: 'cur', value: e ? e.cur : 'usd', items: [['usd', 'в $'], ['byn', 'в BYN']] }],
    valid: v => pos(v.amt) && /^\d{4}-\d{2}$/.test(v.month),
    save: v => {
      const data = { amt: parseNum(v.amt), cur: v.cur, month: v.month };
      if (e) Object.assign(e, data); else (L.extras = L.extras || []).push(Object.assign({ id: newId() }, data));
    },
    del: e ? () => { L.extras = L.extras.filter(x => x !== e); } : null
  });
}

/* ---------- формы ---------- */
function formSheet(cfg) {
  formCfg = cfg; sheetKind = 'form'; form = {};
  const input = f => (f.lab ? '<div class="lab">' + f.lab + '</div>' : '') + '<input id="ff_' + f.key + '" ' +
    (f.mode === 'num' ? 'inputmode="decimal"' : f.mode === 'month' ? 'type="month"' : f.mode === 'date' ? 'type="date"' : 'maxlength="' + (f.max || 60) + '"') +
    ' placeholder="' + esc(f.ph || '') + '" autocomplete="off" value="' + esc(f.value == null ? '' : f.value) + '">';
  let html = '<h2>' + esc(cfg.title) + '</h2>' + cfg.fields.filter(f => !f.after).map(input).join('');
  (cfg.chips || []).forEach(c => { form[c.key] = c.value; html += (c.lab ? '<div class="lab">' + c.lab + '</div>' : '') + chips(c.key, c.items); });
  html += cfg.fields.filter(f => f.after).map(input).join('') + '<button class="save" id="saveBtn">' + (cfg.ok || 'Сохранить') + '</button>';
  if (cfg.del) html += '<button class="kill" id="killBtn">' + (cfg.delLabel || 'Удалить') + '</button>';
  sheet.innerHTML = html;
  check();
  document.body.classList.remove('editing');
  document.body.classList.add('adding');
  if (!cfg.del && !cfg.quiet) setTimeout(() => { const i = sheet.querySelector('input'); if (i) i.focus(); }, 250);
}
function formValues() {
  const v = Object.assign({}, form);
  formCfg.fields.forEach(f => { v[f.key] = $('ff_' + f.key).value.trim(); });
  return v;
}
function formKill() {
  const go = ok => { if (!ok) return; formCfg.del(); save(); closeSheet(); render(); };
  if (tg && tg.showConfirm) tg.showConfirm('Удалить эту запись?', go); else go(confirm('Удалить эту запись?'));
}
const pos = s => parseNum(s) > 0;
const optNum = s => s === '' || parseNum(s) >= 0;

function incomeForm(k, it) {
  const t = it ? it.tax || 0 : 0;
  formSheet({
    title: it ? 'Изменить доход' : 'Новый доход · ' + mName(k).toLowerCase(), ok: it ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'name', ph: 'От кого, например Инна', value: it && it.name }, { key: 'amount', ph: 'Сумма, $', mode: 'num', value: it && it.amount },
      { key: 'taxOther', ph: 'Свой процент налога', mode: 'num', value: t !== 0 && t !== 10 ? t : '', after: true }],
    chips: [{ key: 'kind', value: it && it.gift ? 'gift' : 'work', items: [['work', '💼 Заработок'], ['gift', '🎁 Подарок']] },
      { key: 'tax', value: t === 0 ? '0' : t === 10 ? '10' : 'x', items: [['0', 'Без налога'], ['10', 'Налог 10%'], ['x', 'Свой %']] }],
    valid: v => !!v.name && pos(v.amount) && (v.kind === 'gift' || v.tax !== 'x' || parseNum(v.taxOther) >= 0),
    save: v => {
      const data = { name: v.name, amount: parseNum(v.amount), gift: v.kind === 'gift', tax: v.kind === 'gift' ? 0 : v.tax === 'x' ? parseNum(v.taxOther) : +v.tax };
      if (it) Object.assign(it, data); else monMake(k).items.push(Object.assign({ id: newId() }, data));
    },
    del: it ? () => { const m = monMake(k); m.items = m.items.filter(x => x !== it); } : null
  });
}
function simpleForm(list, it, o) {
  formSheet({
    title: it ? o.edit : o.add, ok: it ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'name', ph: o.namePh, value: it && it.name }, { key: 'amount', ph: o.amountPh, mode: 'num', value: it && it.amount }]
      .concat(o.cats ? [{ key: 'newCat', ph: 'Название новой категории', after: true }] : []),
    chips: o.cats ? [{ key: 'cat', value: it && it.cat ? catOf(it.cat).id : 'none',
      items: [['none', 'Без категории']].concat(state.fin.cats.map(c => [c.id, c.emoji + ' ' + esc(c.name)]), [['new', '＋ Новая']]) }] : null,
    valid: v => !!v.name && parseNum(v.amount) >= 0 && (v.cat !== 'new' || !!v.newCat),
    save: v => { const data = { name: v.name, amount: parseNum(v.amount) };
      if (o.cats) data.cat = v.cat === 'new' ? addCat(v.newCat, '🏷️').id : v.cat === 'none' ? null : v.cat; if (it) Object.assign(it, data); else list.push(Object.assign({ id: newId() }, data, o.from ? { from: o.from } : {})); },
    del: it ? () => { if (o.stop) stopItem(list, it); else list.splice(list.indexOf(it), 1); } : null,
    delLabel: o.stop ? 'Больше не плачу, убрать с этого месяца' : null
  });
  if (o.cats) {
    const box = $('ff_newCat'), sync = () => { box.style.display = form.cat === 'new' ? '' : 'none'; };
    sync();
    sheet.querySelector('[data-group="cat"]').addEventListener('click', () => setTimeout(() => { sync(); if (form.cat === 'new') box.focus(); }, 0));
  }
}
function addCat(name, emoji) {
  const f = state.fin, c = { id: newId(), name, emoji, color: PALETTE[f.cats.length % PALETTE.length] };
  f.cats.push(c);
  return c;
}
function catForm(it) {
  const f = state.fin;
  formSheet({
    title: it ? 'Категория' : 'Новая категория', ok: it ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'name', ph: 'Название, например кафе', value: it && it.name }],
    chips: [{ key: 'emoji', value: it ? it.emoji : '🏷️', items: CAT_EMOJI.map(e => [e, e]) }],
    valid: v => !!v.name,
    save: v => { if (it) { it.name = v.name; it.emoji = v.emoji; } else addCat(v.name, v.emoji); },
    del: it && it.id !== 'subs' ? () => { f.cats.splice(f.cats.indexOf(it), 1); } : null
  });
}
function subForm(it) {
  const f = state.fin;
  formSheet({
    title: it ? 'Изменить подписку' : 'Новая подписка', ok: it ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'name', ph: 'Название, например iCloud+', value: it && it.name }, { key: 'month', ph: 'Цена за месяц, $', mode: 'num', value: it && it.month },
      { key: 'year', ph: 'Цена за год, $ (если есть)', mode: 'num', value: it && it.year }, { key: 'note', ph: 'Дата оплаты или заметка', value: it && it.note }],
    valid: v => !!v.name && optNum(v.month) && optNum(v.year),
    save: v => { const data = { name: v.name, month: numOrNull(v.month), year: numOrNull(v.year), note: v.note }; if (it) Object.assign(it, data); else f.subs.push(Object.assign({ id: newId(), from: finMonth }, data)); },
    del: it ? () => { stopItem(f.subs, it); } : null,
    delLabel: 'Больше не плачу, убрать с этого месяца'
  });
}
function payForm(it) {
  const L = state.fin.loan;
  formSheet({
    title: it ? 'Изменить платёж' : 'Платёж по кредиту', ok: it ? 'Сохранить' : 'Внести',
    fields: [{ key: 'amount', ph: 'Сколько заплатили, BYN', mode: 'num', value: it && it.amount }, { key: 'date', lab: 'Когда', mode: 'date', value: it ? it.date : keyOf(new Date()) }],
    valid: v => pos(v.amount) && !!v.date,
    save: v => {
      if (it) L.balance += it.principal;
      const p = it || { id: newId() };
      p.amount = parseNum(v.amount); p.date = v.date;
      applyPay(p);
      if (!it) L.payments.push(p);
    },
    del: it ? () => { L.balance += it.principal; L.payments.splice(L.payments.indexOf(it), 1); } : null
  });
}

function finAdd() {
  const f = state.fin;
  if (finSub === 'income') incomeForm(finMonth);
  else if (finSub === 'loan') { if (f.loan.balance) payForm(); else finAct('loanset'); }
  else if (finSub === 'savings') formSheet({
    title: 'Добавить в накопления', ok: 'Добавить',
    fields: [{ key: 'name', ph: 'Название, например Альфа-банк' }, { key: 'amount', ph: 'Сумма, $', mode: 'num' }],
    chips: [{ key: 'kind', value: 'acc', items: [['acc', '🏦 Счёт'], ['exp', '⏳ Ожидаемые деньги']] }],
    valid: v => !!v.name && parseNum(v.amount) >= 0,
    save: v => { (v.kind === 'acc' ? f.accounts : f.expected).push({ id: newId(), name: v.name, amount: parseNum(v.amount) }); }
  });
  else formSheet({
    title: 'Новый расход', ok: 'Дальше', quiet: true, fields: [],
    chips: [{ key: 'kind', value: 'var', items: [['var', '🛒 Переменный'], ['fix', '📌 Постоянный'], ['sub', '📱 Подписка']] }],
    valid: () => true,
    save: v => { setTimeout(() => {
      if (v.kind === 'sub') subForm();
      else if (v.kind === 'fix') simpleForm(f.fixed, null, { add: 'Постоянный расход · каждый месяц', namePh: 'Название, например маникюр', amountPh: 'Сумма в месяц, BYN', from: finMonth, cats: true });
      else { const m = monMake(finMonth); m.costs = m.costs || []; simpleForm(m.costs, null, { add: 'Расход · ' + mName(finMonth).toLowerCase(), namePh: 'На что, например заказ на ВБ', amountPh: 'Сумма, BYN', cats: true }); }
    }, 300); }
  });
}

function finAct(act, id) {
  const f = state.fin, L = f.loan;
  if (act === 'sub') { finSub = id; buzz('light'); render(); window.scrollTo(0, 0); }
  else if (act === 'catnew') catForm();
  else if (act === 'cat') { if (id !== 'none') catForm(f.cats.find(c => c.id === id)); }
  else if (act === 'mprev' || act === 'mnext') { finMonth = mShift(finMonth, act === 'mprev' ? -1 : 1); buzz('light'); render(); }
  else if (act === 'repeat') {
    const prev = monGet(mShift(finMonth, -1)), m = monMake(finMonth);
    prev.items.filter(i => !i.gift).forEach(i => m.items.push({ id: newId(), name: i.name, amount: i.amount, tax: i.tax || 0, gift: false }));
    if (!m.goal && prev.goal) m.goal = prev.goal;
    buzz('medium'); save(); render();
  }
  else if (act === 'monthset') { const m = monGet(finMonth); formSheet({
    title: mName(finMonth), quiet: true,
    fields: [{ key: 'goal', lab: 'Цель заработать за месяц, $', ph: 'Например, 2500', mode: 'num', value: m.goal },
      { key: 'taxFlat', lab: 'Налог одной суммой, $ (если не считаешь по каждому доходу)', ph: 'Например, 100', mode: 'num', value: m.taxFlat }],
    valid: v => optNum(v.goal) && optNum(v.taxFlat),
    save: v => { const x = monMake(finMonth); x.goal = numOrNull(v.goal); x.taxFlat = numOrNull(v.taxFlat); } }); }
  else if (act === 'goalset') { const g = f.goal || {}; formSheet({
    title: 'Цель накоплений', quiet: !!f.goal,
    fields: [{ key: 'name', ph: 'На что копим', value: g.name }, { key: 'amount', ph: 'Сколько нужно, $', mode: 'num', value: g.amount },
      { key: 'deadline', lab: 'К какому месяцу', mode: 'month', ph: '2027-06', value: g.deadline }],
    valid: v => !!v.name && pos(v.amount) && (v.deadline === '' || /^\d{4}-\d{2}$/.test(v.deadline)),
    save: v => { f.goal = { name: v.name, amount: parseNum(v.amount), deadline: v.deadline }; } }); }
  else if (act === 'rateset') formSheet({
    title: 'Курс доллара', fields: [{ key: 'rate', lab: 'Сколько белорусских рублей за 1 $', ph: 'Например, 3', mode: 'num', value: f.rate }],
    valid: v => pos(v.rate), save: v => { f.rate = parseNum(v.rate); } });
  else if (act === 'lxadd') extraForm();
  else if (act === 'loanset') formSheet({
    title: 'Параметры кредита', quiet: true,
    fields: [{ key: 'balance', lab: 'Остаток долга сейчас, BYN', mode: 'num', value: L.balance || '' },
      { key: 'rate1', lab: 'Льготная ставка, %', mode: 'num', value: L.rate1 }, { key: 'rate2', lab: 'Ставка после льготного периода, %', mode: 'num', value: L.rate2 },
      { key: 'graceEnd', lab: 'Последний месяц льготной ставки', mode: 'month', ph: '2028-08', value: L.graceEnd },
      { key: 'deferEnd', lab: 'Последний месяц, когда платите только проценты', mode: 'month', ph: '2027-09', value: L.deferEnd },
      { key: 'pay1', lab: 'Платёж на льготной ставке после отсрочки, BYN', mode: 'num', value: L.pay1 || '' },
      { key: 'pay2', lab: 'Платёж после льготного периода, BYN', mode: 'num', value: L.pay2 || '' },
      { key: 'endMonth', lab: 'Последний месяц кредита (можно не заполнять: подберу сама по платежам)', mode: 'month', value: L.endMonth || '' }],
    valid: v => parseNum(v.balance) >= 0 && parseNum(v.rate1) >= 0 && parseNum(v.rate2) >= 0 && [v.graceEnd, v.deferEnd, v.endMonth].every(m => m === '' || /^\d{4}-\d{2}$/.test(m)) && optNum(v.pay1) && optNum(v.pay2),
    save: v => { L.balance = parseNum(v.balance); L.rate1 = parseNum(v.rate1); L.rate2 = parseNum(v.rate2); L.graceEnd = v.graceEnd; L.deferEnd = v.deferEnd; L.pay1 = numOrNull(v.pay1) || 0; L.pay2 = numOrNull(v.pay2) || 0; L.endMonth = v.endMonth || ''; } });
  else if (act === 'edit') {
    const kind = id.slice(0, 3), key = id.slice(4), by = list => list.find(x => x.id === key);
    if (kind === 'inc') incomeForm(finMonth, by(monGet(finMonth).items));
    else if (kind === 'acc') simpleForm(f.accounts, by(f.accounts), { edit: 'Изменить счёт', namePh: 'Название', amountPh: 'Сумма, $' });
    else if (kind === 'exp') simpleForm(f.expected, by(f.expected), { edit: 'Ожидаемые деньги', namePh: 'Название', amountPh: 'Сумма, $' });
    else if (kind === 'fix') simpleForm(f.fixed, by(f.fixed), { edit: 'Постоянный расход', namePh: 'Название', amountPh: 'Сумма в месяц, BYN', stop: true, cats: true });
    else if (kind === 'var') { const list = monMake(finMonth).costs; simpleForm(list, by(list), { edit: 'Изменить расход', namePh: 'На что', amountPh: 'Сумма, BYN', cats: true }); }
    else if (kind === 'sub') subForm(by(f.subs));
    else if (kind === 'pay') payForm(by(L.payments));
    else if (kind === 'ext') extraForm(by(L.extras || []));
    else if (kind === 'sav') { const m = monGet(key); formSheet({
      title: 'Отложено · ' + mName(key).toLowerCase(), quiet: true,
      fields: [{ key: 'me', lab: 'Отложено за месяц, $', mode: 'num', value: m.saveMe },
        { key: 'plan', lab: 'Планка: сколько всего должно быть к концу месяца, $', mode: 'num', value: m.plan }],
      valid: v => optNum(v.me) && optNum(v.plan),
      save: v => { const x = monMake(key); x.saveMe = numOrNull(v.me); x.plan = numOrNull(v.plan); } }); }
  }
}
