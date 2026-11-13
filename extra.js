/* Разделы и настройки поверх основного приложения:
   нижняя панель и «Ещё», привычки карточками, помодоро, «Сделал ли я?», дни рождения, списки, дневник.
   Подключается перед основным скриптом и пользуется его помощниками (state, $, esc, keyOf, row, section…). */

const MOD_LIST = [
  { id: 'habits', icon: '🔥', label: 'Привычки' },
  { id: 'tasks', icon: '✅', label: 'Задачи' },
  { id: 'ideas', icon: '💡', label: 'Контент' },
  { id: 'money', icon: '💰', label: 'Деньги' },
  { id: 'loan', icon: '🏠', label: 'Кредит' },
  { id: 'focus', icon: '⏱️', label: 'Помодоро', short: 'Фокус' },
  { id: 'checks', icon: '🔑', label: 'Сделал ли я?', short: 'Сделал?' },
  { id: 'bdays', icon: '🎂', label: 'Дни рождения', short: 'Дни рожд.' },
  { id: 'lists', icon: '📝', label: 'Списки' },
  { id: 'diary', icon: '📖', label: 'Дневник на 5 лет', short: 'Дневник' },
];
const MORE = { id: 'more', icon: '☰', label: 'Ещё' };
const TONES = { habits: '#f9dc6b', tasks: '#cdc8f6', ideas: '#f4b6d9', money: '#b9e6d6', loan: '#bdd3f3',
  focus: '#cdc8f6', checks: '#fad6b8', bdays: '#f4b6d9', lists: '#b9e6d6', diary: '#bdd3f3' };
const BAR_MAX = 4;
const BAR_DEFAULT = ['habits', 'tasks', 'money', 'loan'];
const WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const modInfo = id => id === 'more' ? MORE : MOD_LIST.find(m => m.id === id);
const ask = (msg, go) => tg && tg.showConfirm ? tg.showConfirm(msg, go) : go(confirm(msg));
const editing = () => document.body.classList.contains('editing');

function barIds() {
  const b = (state.ui && Array.isArray(state.ui.bar) ? state.ui.bar : BAR_DEFAULT).filter(id => id !== 'more' && modInfo(id));
  return b.slice(0, BAR_MAX);
}

let extraReady = false;
function extraMigrate() {
  state.ui = state.ui || { bar: BAR_DEFAULT.slice() };
  state.focus = Object.assign({ work: 25, short: 5, long: 15, rounds: 4, sound: 'off', label: '' }, state.focus || {});
  state.focusRun = state.focusRun || { phase: 'work', round: 1, left: state.focus.work * 60, endAt: null };
  state.focusLog = state.focusLog || {};
  state.checks = state.checks || [];
  state.bdays = state.bdays || [];
  state.lists = state.lists || [{ id: 'main', name: 'Общий', emoji: '📝', items: [] }, { id: 'shop', name: 'Покупки', emoji: '🛒', items: [] }];
  state.diary = state.diary || {};
  if (extraReady) return;
  extraReady = true;
  view.addEventListener('input', e => { if (e.target.id === 'fLabel') { state.focus.label = e.target.value; save(); } });
  setInterval(focusTick, 500);
  selInit();
}

let _mods;
function MODS() {
  return _mods || (_mods = {
    habits: { view: viewHabitsList, add: '+ Добавить привычку', onAdd: () => openSheet('habits'), count: () => state.habits.length },
    tasks: { view: viewTasks, add: '+ Добавить задачу', onAdd: () => openSheet('tasks'), count: () => state.tasks.length },
    ideas: { view: viewIdeas, add: '+ Добавить идею', onAdd: () => openSheet('ideas'), count: () => state.ideas.length },
    money: { view: viewMoney, add: () => finAddLabel(), onAdd: finAdd, count: () => 0, act: finAct },
    loan: { view: viewLoanTab, add: '+ Внести платёж', onAdd: loanAdd, count: () => 0, act: finAct },
    focus: { view: viewFocus, add: null, count: () => 0, act: focusAct },
    checks: { view: viewChecks, add: '+ Добавить пункт', onAdd: checkForm, count: () => state.checks.length, act: checksAct },
    bdays: { view: viewBdays, add: '+ Добавить день рождения', onAdd: () => bdayForm(), count: () => 0, act: bdaysAct },
    lists: { view: viewLists, add: () => curList() ? '+ Добавить пункт' : '+ Новый список', onAdd: () => curList() ? itemForm() : listForm(),
      count: () => curList() ? curList().items.length : state.lists.length, act: listsAct },
    diary: { view: viewDiary, add: null, count: () => 0, act: diaryAct },
    more: { view: viewMore, add: null, count: () => 0, act: moreAct },
  });
}

function goTab(id) {
  if (!MODS()[id]) return;
  selReset();
  if (id === 'lists' && tab !== 'lists') openList = null;
  tab = id;
  try { localStorage.setItem(KEY + '-tab', tab); } catch (err) {}
  document.body.classList.remove('editing');
  buzz('light'); render(); window.scrollTo(0, 0);
}

/* ---------- «Ещё» и настройка нижней панели ---------- */
function viewMore() {
  $('title').textContent = 'Ещё';
  const bar = barIds();
  view.innerHTML = '<div class="mgrid">' + MOD_LIST.map(m => '<button class="mcard" data-act="go" data-id="' + m.id + '">' +
    '<span class="mi" style="background:' + TONES[m.id] + '">' + m.icon + '</span><b>' + m.label + '</b>' +
    (bar.includes(m.id) ? '<em>на панели</em>' : '') + '</button>').join('') + '</div>' +
    '<button class="ghost" data-act="barset">⚙️ Настроить нижнюю панель</button>';
}
function moreAct(act) { if (act === 'barset') openBar(); }

function openBar() {
  sheetKind = 'bar';
  const bar = barIds(), rest = MOD_LIST.filter(m => !bar.includes(m.id));
  sheet.innerHTML = '<h2>Нижняя панель</h2><div class="lab">На панели, до ' + BAR_MAX + '. «Ещё» всегда последняя</div>' +
    bar.map((id, i) => { const m = modInfo(id); return '<div class="brow"><span>' + m.icon + ' ' + m.label + '</span>' +
      '<button data-b="up" data-id="' + id + '"' + (i ? '' : ' disabled') + '>↑</button>' +
      '<button data-b="down" data-id="' + id + '"' + (i < bar.length - 1 ? '' : ' disabled') + '>↓</button>' +
      '<button class="bminus" data-b="off" data-id="' + id + '"' + (bar.length > 1 ? '' : ' disabled') + '>−</button></div>'; }).join('') +
    '<div class="lab" style="margin-top:16px">Остальное открывается из «Ещё»</div>' +
    rest.map(m => '<div class="brow"><span>' + m.icon + ' ' + m.label + '</span><button class="bplus" data-b="on" data-id="' + m.id + '"' +
      (bar.length >= BAR_MAX ? ' disabled' : '') + '>+</button></div>').join('') +
    '<button class="save" id="barDone">Готово</button>';
  document.body.classList.remove('editing');
  document.body.classList.add('adding');
}
function barClick(t) {
  if (t.id === 'barDone') return closeSheet();
  const b = t.closest('[data-b]');
  if (!b || b.disabled) return;
  const bar = barIds(), id = b.dataset.id, i = bar.indexOf(id), how = b.dataset.b;
  if (how === 'up') { bar.splice(i, 1); bar.splice(i - 1, 0, id); }
  else if (how === 'down') { bar.splice(i, 1); bar.splice(i + 1, 0, id); }
  else if (how === 'off') { if (bar.length > 1) bar.splice(i, 1); }
  else if (bar.length < BAR_MAX) bar.push(id);
  state.ui.bar = bar;
  buzz('light'); save(); render(); openBar();
}

/* ---------- привычки: у каждой своя неделя ---------- */
function viewHabitsList() {
  const today = keyOf(new Date()), total = state.habits.length;
  const s = streak(k => doneOn(k).length > 0), tDone = doneOn(today).length;
  $('title').textContent = 'Привычки';
  let html = '<div class="hero"><div><div class="num">' + s + '</div>' +
    '<div class="lbl">' + plural(s, 'день подряд', 'дня подряд', 'дней подряд') + '</div>' +
    '<div class="pill">' + (total === 0 ? 'добавь первую привычку' : tDone === total ? 'сегодня всё сделано ✨' : 'сегодня ' + tDone + ' из ' + total) + '</div></div>' +
    '<div class="fire">' + (s === 0 ? '🌱' : s < 7 ? '🔥' : s < 30 ? '🚀' : '👑') + '</div></div>';
  if (!total) html += empty('Пока пусто.<br>Нажми «Добавить привычку» внизу 👇');
  else html += '<div class="sub">Нажми на день, чтобы отметить</div>' + state.habits.map(h => {
    const hs = streak(k => (state.log[k] || []).includes(h.id));
    let days = '';
    for (let i = 6; i >= 0; i--) {
      const k = shift(today, -i), d = dateOf(k), on = (state.log[k] || []).includes(h.id);
      days += '<button class="hd' + (on ? ' on' : '') + (k === today ? ' now' : '') + '" data-act="hday" data-id="' + h.id + '|' + k + '">' +
        '<span>' + WD[d.getDay()] + '</span><i>' + (on ? '✓' : d.getDate()) + '</i></button>';
    }
    return '<div class="hcard"><div class="hhead"><div class="emo">' + h.emoji + '</div><div class="info"><div class="name">' + esc(h.name) + '</div>' +
      '<div class="meta">' + (hs ? '🔥 ' + hs + ' ' + plural(hs, 'день', 'дня', 'дней') + ' подряд' : 'серия начнётся с первой отметки') + '</div></div>' +
      '<button class="del" data-act="del" data-id="' + h.id + '">✕</button></div><div class="hweek">' + days + '</div></div>';
  }).join('');
  view.innerHTML = html;
}
function habitDay(v) {
  const [id, k] = v.split('|'), arr = state.log[k] || [], on = arr.includes(id);
  state.log[k] = on ? arr.filter(x => x !== id) : arr.concat(id);
  if (!state.log[k].length) delete state.log[k];
  buzz(on ? 'light' : 'medium'); save(); render();
}

/* ---------- помодоро ---------- */
const PHASE = { work: 'Работа', short: 'Короткий перерыв', long: 'Длинный перерыв' };
const SOUNDS = [['off', '🔇', 'Тишина'], ['rain', '🌧️', 'Дождь'], ['storm', '⛈️', 'Ливень'], ['fire', '🔥', 'Камин'], ['waves', '🌊', 'Волны'], ['noise', '〰️', 'Шум']];
const RING = 2 * Math.PI * 88;
const phaseLen = p => state.focus[p] * 60;
const runLeft = () => { const r = state.focusRun; return r.endAt ? Math.max(0, Math.round((r.endAt - Date.now()) / 1000)) : r.left; };
const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const ringOff = left => (RING * (1 - left / phaseLen(state.focusRun.phase))).toFixed(1);

function viewFocus() {
  $('title').textContent = 'Помодоро';
  const r = state.focusRun, F = state.focus, left = runLeft(), today = keyOf(new Date());
  const lg = state.focusLog[today] || { n: 0, min: 0 };
  let week = 0;
  for (let i = 0; i < 7; i++) { const x = state.focusLog[shift(today, -i)]; if (x) week += x.min; }
  const next = r.phase === 'work' ? r.round + ' из ' + F.rounds : r.phase === 'long' ? 'потом новый круг' : 'потом работа ' + (r.round + 1) + ' из ' + F.rounds;
  let dots = '';
  for (let i = 1; i <= F.rounds; i++) dots += '<i' + (i < r.round || (i === r.round && r.phase !== 'work') ? ' class="on"' : i === r.round ? ' class="cur"' : '') + '></i>';
  view.innerHTML = '<div class="hero focus"><div class="fhead"><b>' + PHASE[r.phase] + '</b><span>' + next + '</span></div>' +
    '<div class="fdots">' + dots + '</div>' +
    '<div class="fring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" class="ftrack"/>' +
    '<circle id="fArc" cx="100" cy="100" r="88" class="farc" stroke-dasharray="' + RING.toFixed(1) + '" stroke-dashoffset="' + ringOff(left) + '" transform="rotate(-90 100 100)"/></svg>' +
    '<div class="ftime"><b id="fTime">' + mmss(left) + '</b><span>' + (r.endAt ? 'идёт' : left < phaseLen(r.phase) ? 'пауза' : 'готов начать') + '</span></div></div>' +
    '<input id="fLabel" class="flabel" maxlength="60" placeholder="На чём фокус?" value="' + esc(F.label) + '">' +
    '<div class="fbtns"><button class="fsm" data-act="freset" aria-label="Сбросить">■</button>' +
    '<button class="fplay" data-act="fplay" aria-label="' + (r.endAt ? 'Пауза' : 'Старт') + '">' + (r.endAt ? '❚❚' : '▶') + '</button>' +
    '<button class="fsm" data-act="fskip" aria-label="Пропустить">⏭</button></div></div>' +
    '<div class="sounds">' + SOUNDS.map(s => '<button class="' + (F.sound === s[0] ? 'cur' : '') + '" data-act="fsound" data-id="' + s[0] + '"><i>' + s[1] + '</i>' + s[2] + '</button>').join('') + '</div>' +
    '<div class="stats" style="margin-top:12px">' + stat(String(lg.n), plural(lg.n, 'помидор', 'помидора', 'помидоров') + ' сегодня', 'hot') +
    stat(String(lg.min), 'мин фокуса сегодня') + stat((week / 60).toFixed(1).replace('.', ','), 'ч за 7 дней') + '</div>' +
    '<button class="ghost" data-act="fset">⚙️ ' + F.work + ' / ' + F.short + ' / ' + F.long + ' мин · ' + F.rounds + ' ' + plural(F.rounds, 'круг', 'круга', 'кругов') + '</button>' +
    '<div class="note" style="font-size:13px;color:var(--muted)">Если заблокировать телефон, время продолжит идти, но сигнал о конце прозвучит, только когда откроешь приложение.</div>';
}

function focusAct(act, id) {
  const r = state.focusRun, F = state.focus;
  if (act === 'fplay') {
    unlockChime();
    if (r.endAt) { r.left = runLeft(); r.endAt = null; stopAmb(); }
    else { r.endAt = Date.now() + r.left * 1000; playAmb(); }
    buzz('medium');
  } else if (act === 'freset') {
    state.focusRun = { phase: 'work', round: 1, left: phaseLen('work'), endAt: null };
    stopAmb(); buzz('light');
  } else if (act === 'fskip') return finishPhase(false);
  else if (act === 'fsound') { F.sound = id; if (r.endAt) playAmb(); else stopAmb(); buzz('light'); }
  else if (act === 'fset') return formSheet({
    title: 'Настройки помодоро', quiet: true, fields: [],
    chips: [
      { key: 'work', lab: 'Работа', value: String(F.work), items: [15, 20, 25, 30, 45, 50].map(x => [String(x), x + ' мин']) },
      { key: 'short', lab: 'Короткий перерыв', value: String(F.short), items: [3, 5, 10].map(x => [String(x), x + ' мин']) },
      { key: 'long', lab: 'Длинный перерыв', value: String(F.long), items: [10, 15, 20, 30].map(x => [String(x), x + ' мин']) },
      { key: 'rounds', lab: 'Сколько работ до длинного перерыва', value: String(F.rounds), items: [2, 3, 4, 5].map(x => [String(x), String(x)]) }],
    valid: () => true,
    save: v => {
      F.work = +v.work; F.short = +v.short; F.long = +v.long; F.rounds = +v.rounds;
      if (r.round > F.rounds) r.round = F.rounds;
      if (!r.endAt) r.left = phaseLen(r.phase);
    }
  });
  save(); render();
}

function focusTick() {
  const r = state.focusRun;
  if (!r || !r.endAt) return;
  const left = runLeft();
  if (left <= 0) return finishPhase(true);
  if (tab !== 'focus') return;
  const t = $('fTime'), a = $('fArc');
  if (t) t.textContent = mmss(left);
  if (a) a.setAttribute('stroke-dashoffset', ringOff(left));
}
function finishPhase(natural) {
  const r = state.focusRun, F = state.focus, today = keyOf(new Date());
  if (r.phase === 'work') {
    if (natural) { const lg = state.focusLog[today] || (state.focusLog[today] = { n: 0, min: 0 }); lg.n++; lg.min += F.work; }
    r.phase = r.round >= F.rounds ? 'long' : 'short';
  } else {
    r.round = r.phase === 'long' ? 1 : r.round + 1;
    r.phase = 'work';
  }
  r.left = phaseLen(r.phase); r.endAt = null;
  stopAmb();
  if (natural) { chime(); buzz('heavy'); }
  save(); render();
}

// звуки: генерируем прямо в телефоне и играем через <audio>,
// так они слышны даже в беззвучном режиме iPhone
let ambEl = null, chimeEl = null;
const soundUrls = {};
function wavUrl(kind) {
  if (soundUrls[kind]) return soundUrls[kind];
  const sr = 22050, fade = Math.floor(sr * 0.5), n = Math.floor(sr * (kind === 'chime' ? 1.6 : 16.5));
  let d = new Float32Array(n);
  if (kind === 'chime') {
    [[0, 880], [0.28, 1318.5]].forEach(([t0, f]) => {
      for (let i = Math.floor(t0 * sr); i < n; i++) { const t = i / sr - t0; d[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3.2) * 0.45; }
    });
  } else {
    let lp = 0, lp2 = 0, hp = 0, prev = 0, br = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      br = (br + 0.02 * w) / 1.02;
      if (kind === 'rain') { hp = 0.95 * (hp + w - prev); prev = w; lp += 0.5 * (hp - lp); d[i] = lp; }
      else if (kind === 'storm') { lp += 0.25 * (w - lp); lp2 += 0.25 * (lp - lp2); d[i] = lp2 + br * 2; }
      else if (kind === 'fire') { lp += 0.05 * (w - lp); d[i] = br * 2 + lp * 0.4; }
      else if (kind === 'waves') { lp += 0.08 * (w - lp); d[i] = (br * 2.5 + lp * 0.6) * (0.12 + 0.88 * Math.pow(Math.sin(Math.PI * i / sr / 8), 2)); }
      else d[i] = br * 3;
    }
    if (kind === 'fire') {
      for (let i = 0; i < n;) {
        i += Math.floor(sr * (0.03 + Math.random() * 0.25));
        const len = Math.floor(sr * (0.002 + Math.random() * 0.012)), amp = 0.3 + Math.random() * 0.9;
        for (let j = 0; j < len && i + j < n; j++) d[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / len);
      }
    }
    if (kind === 'rain') {
      for (let i = 0; i < n;) {
        i += Math.floor(sr * (0.005 + Math.random() * 0.05));
        const len = Math.floor(sr * 0.004), amp = Math.random() * 0.35;
        for (let j = 0; j < len && i + j < n; j++) d[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / len);
      }
    }
    // склейка петли без щелчка: начало плавно смешиваем с хвостом
    for (let j = 0; j < fade; j++) { const a = j / fade; d[j] = d[j] * a + d[n - fade + j] * (1 - a); }
    d = d.subarray(0, n - fade);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const k = peak ? 0.7 / peak : 1;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  const buf = new ArrayBuffer(44 + d.length * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return (soundUrls[kind] = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
}
function playAmb() {
  const s = state.focus.sound;
  if (s === 'off') return stopAmb();
  if (!ambEl) { ambEl = new Audio(); ambEl.loop = true; }
  if (ambEl.dataset.k !== s) { ambEl.src = wavUrl(s); ambEl.dataset.k = s; }
  ambEl.play().catch(() => {});
}
function stopAmb() { if (ambEl) ambEl.pause(); }
function unlockChime() {
  if (!chimeEl) chimeEl = new Audio(wavUrl('chime'));
  if (chimeEl.dataset.ok) return;
  chimeEl.muted = true;
  chimeEl.play().then(() => { chimeEl.pause(); chimeEl.currentTime = 0; chimeEl.muted = false; chimeEl.dataset.ok = '1'; })
    .catch(() => { chimeEl.muted = false; });
}
function chime() {
  if (!chimeEl) chimeEl = new Audio(wavUrl('chime'));
  chimeEl.muted = false; chimeEl.currentTime = 0;
  chimeEl.play().catch(() => {});
}

/* ---------- «Сделал ли я?» ---------- */
const CHECK_EMOJI = ['🔑', '💊', '🔌', '🚪', '💡', '🪴', '🐈', '💧', '🧴', '📦', '🚗', '🔥'];
const RESETS = { day: 'Каждый день', week: 'Каждую неделю', manual: 'Вручную' };
const hm = iso => { const d = new Date(iso); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
function mondayKey() { const d = new Date(); return shift(keyOf(d), -((d.getDay() + 6) % 7)); }
function checkDone(c) {
  if (!c.at) return false;
  const k = keyOf(new Date(c.at));
  return c.reset === 'manual' || (c.reset === 'week' ? k >= mondayKey() : k === keyOf(new Date()));
}
function viewChecks() {
  $('title').textContent = 'Сделал ли я?';
  const total = state.checks.length, done = state.checks.filter(checkDone).length, today = keyOf(new Date());
  let html = '<div class="hero"><div>' + (total
    ? '<div class="num">' + done + '<small> из ' + total + '</small></div><div class="lbl">уже сделано</div><div class="pill">' + (done === total ? 'всё на месте, можно не переживать ✨' : 'нажми, когда сделаешь') + '</div>'
    : '<div class="lbl" style="font-size:19px;font-weight:800;line-height:1.3">Закрыла дверь?<br>Выпила таблетки?</div><div class="pill">глянула и убедилась, что сделала</div>') +
    '</div><div class="fire">🔑</div></div>';
  if (!total) html += empty('Добавь рутинные дела, про которые потом сомневаешься.<br>Нажми «Добавить пункт» внизу 👇');
  else html += section('Нажми, когда сделала', state.checks.map(c => {
    const on = checkDone(c), k = on ? keyOf(new Date(c.at)) : '';
    return row({ id: c.id, emo: c.emoji, name: c.name, on,
      meta: on ? 'сделано ' + (k === today ? 'сегодня' : nearDate(k)) + ' в ' + hm(c.at) : 'ещё нет · сброс: ' + RESETS[c.reset].toLowerCase() });
  }));
  view.innerHTML = html;
}
function checksAct(act, id) {
  const c = state.checks.find(x => x.id === id);
  if (!c) return;
  if (act === 'del') return ask('Удалить «' + c.name + '»?', ok => { if (!ok) return; state.checks = state.checks.filter(x => x !== c); save(); render(); });
  if (act !== 'toggle') return;
  if (editing()) return editItem(id);
  c.at = checkDone(c) ? null : new Date().toISOString();
  buzz(c.at ? 'medium' : 'light'); save(); render();
}
function checkForm() {
  formSheet({
    title: 'Новый пункт', ok: 'Добавить',
    fields: [{ key: 'name', ph: 'Например, закрыла дверь?' }],
    chips: [{ key: 'emoji', value: CHECK_EMOJI[0], items: CHECK_EMOJI.map(e => [e, e]) },
      { key: 'reset', lab: 'Когда снова становится «не сделано»', value: 'day', items: Object.keys(RESETS).map(k => [k, RESETS[k]]) }],
    valid: v => !!v.name,
    save: v => { state.checks.push({ id: newId(), name: v.name, emoji: v.emoji, reset: v.reset, at: null }); }
  });
}

/* ---------- дни рождения ---------- */
function bdayDate(b, y) {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return new Date(y, b.month - 1, b.month === 2 && b.day === 29 && !leap ? 28 : b.day);
}
function bdayNext(b) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  let y = t.getFullYear(), d = bdayDate(b, y);
  if (d < t) d = bdayDate(b, ++y);
  return { days: Math.round((d - t) / 864e5), date: d, age: b.year ? y - b.year : null };
}
const inDays = n => n === 0 ? 'сегодня 🎉' : n === 1 ? 'завтра' : 'через ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
const ageTxt = a => a + ' ' + plural(a, 'год', 'года', 'лет');
function viewBdays() {
  $('title').textContent = 'Дни рождения';
  const list = state.bdays.map(b => Object.assign({ b }, bdayNext(b))).sort((x, y) => x.days - y.days);
  if (!list.length) {
    view.innerHTML = '<div class="hero"><div><div class="lbl" style="font-size:19px;font-weight:800">Никого не забыть</div><div class="pill">приложение подскажет за день</div></div><div class="fire">🎂</div></div>' +
      empty('Дней рождения пока нет.<br>Нажми «Добавить день рождения» внизу 👇');
    return;
  }
  const n = list[0], fresh = state.bdays.filter(b => !b.cal).length;
  let html = '<div class="hero"><div style="min-width:0"><div class="lbl">Ближайший</div><div class="num bname">' + esc(n.b.name) + '</div>' +
    '<div class="pill">' + inDays(n.days) + ' · ' + n.date.getDate() + ' ' + MONTHS[n.date.getMonth()] + (n.age ? ' · исполнится ' + ageTxt(n.age) : '') + '</div></div><div class="fire">🎂</div></div>';
  html += section('Все · нажми, чтобы изменить', list.map(x => finRow({ act: 'bedit', id: x.b.id, emo: x.days <= 1 ? '🎉' : '🎂', name: x.b.name,
    cls: x.days <= 1 ? 'soon' : '', amt: inDays(x.days),
    meta: x.date.getDate() + ' ' + MONTHS[x.date.getMonth()] + (x.age ? ' · исполнится ' + ageTxt(x.age) : '') + (x.b.note ? ' · ' + x.b.note : '') })));
  html += '<button class="ghost" data-act="bics">📅 ' + (fresh ? 'Добавить в Календарь iPhone · ' + fresh + ' ' + plural(fresh, 'новый', 'новых', 'новых') : 'Все уже в Календаре · выгрузить заново') + '</button>' +
    '<div class="note" style="font-size:13px;color:var(--muted)">Когда открываешь приложение, сверху появляется плашка, если день рождения сегодня или завтра. Чтобы напоминание пришло само, даже если приложение закрыто, добавь дни рождения в Календарь iPhone: он напомнит накануне в 10:00 и в сам день в 9:00.</div>';
  view.innerHTML = html;
}
function bdaysAct(act, id) {
  if (act === 'bedit') bdayForm(state.bdays.find(b => b.id === id));
  else if (act === 'bics') bdaysToCalendar();
}
function bdayForm(b) {
  const pad = x => String(x).padStart(2, '0');
  formSheet({
    title: b ? 'День рождения' : 'Новый день рождения', ok: b ? 'Сохранить' : 'Добавить',
    fields: [{ key: 'name', ph: 'Кто, например мама', value: b && b.name },
      { key: 'date', lab: 'Дата', mode: 'date', value: b ? (b.year || 2000) + '-' + pad(b.month) + '-' + pad(b.day) : '' },
      { key: 'note', ph: 'Заметка: что подарить, телефон (необязательно)', value: b && b.note, max: 100, after: true }],
    chips: [{ key: 'year', value: b && !b.year ? 'n' : 'y', items: [['y', 'Знаю год рождения'], ['n', 'Год не знаю']] }],
    valid: v => !!v.name && /^\d{4}-\d{2}-\d{2}$/.test(v.date),
    save: v => {
      const [y, m, d] = v.date.split('-').map(Number), data = { name: v.name, day: d, month: m, year: v.year === 'y' ? y : null, note: v.note };
      if (b) { if (b.day !== d || b.month !== m) data.cal = false; Object.assign(b, data); }
      else state.bdays.push(Object.assign({ id: newId(), cal: false }, data));
    },
    del: b ? () => { state.bdays = state.bdays.filter(x => x !== b); } : null
  });
}
function bdaysToCalendar() {
  const fresh = state.bdays.filter(b => !b.cal), list = fresh.length ? fresh : state.bdays;
  if (!list.length) return;
  const pad = x => String(x).padStart(2, '0'), y = new Date().getFullYear();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const txt = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moi den//RU', 'CALSCALE:GREGORIAN'];
  list.forEach(b => {
    const feb29 = b.month === 2 && b.day === 29;
    L.push('BEGIN:VEVENT', 'UID:bday-' + b.id + '@my-day', 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + y + pad(b.month) + pad(bdayDate(b, y).getDate()),
      'RRULE:FREQ=YEARLY' + (feb29 ? ';BYMONTH=2;BYMONTHDAY=-1' : ''),
      'SUMMARY:' + txt('🎂 День рождения: ' + b.name), 'TRANSP:TRANSPARENT');
    if (b.note) L.push('DESCRIPTION:' + txt(b.note));
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + txt('Завтра день рождения: ' + b.name), 'TRIGGER:-PT14H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + txt('Сегодня день рождения: ' + b.name), 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  const url = URL.createObjectURL(new Blob([L.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
  a.href = url; a.download = 'дни-рождения.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  list.forEach(b => { b.cal = true; });
  save(); render();
}
function bdayBanner() {
  const soon = state.bdays.map(b => Object.assign({ b }, bdayNext(b))).filter(x => x.days <= 1);
  if (!soon.length) return;
  const now = soon.filter(x => !x.days).map(x => x.b.name), tom = soon.filter(x => x.days === 1).map(x => x.b.name);
  const t = [now.length ? 'Сегодня день рождения: ' + now.join(', ') : '', tom.length ? 'Завтра день рождения: ' + tom.join(', ') : ''].filter(Boolean).join(' · ');
  view.insertAdjacentHTML('afterbegin', '<button class="banner" data-act="go" data-id="bdays">🎂 ' + esc(t) + '</button>');
}

/* ---------- списки ---------- */
const LIST_EMOJI = ['📝', '🛒', '🎬', '💡', '🎁', '✈️', '📚', '🏠', '💄', '🍳'];
let openList = null;
const curList = () => state.lists.find(l => l.id === openList) || null;
function viewLists() {
  const l = curList();
  if (!l) {
    openList = null;
    $('title').textContent = 'Списки';
    view.innerHTML = state.lists.length ? '<div class="mgrid">' + state.lists.map(x => '<div class="mcard" data-act="lopen" data-id="' + x.id + '">' +
      '<span class="mi" style="background:' + TONES.lists + '">' + x.emoji + '</span><b>' + esc(x.name) + '</b>' +
      '<em>' + x.items.filter(i => i.done).length + ' из ' + x.items.length + '</em>' +
      '<button class="del" data-act="ldelist" data-id="' + x.id + '">✕</button></div>').join('') + '</div>'
      : empty('Списков пока нет.<br>Нажми «Новый список» внизу 👇');
    return;
  }
  $('title').textContent = l.emoji + ' ' + l.name;
  const r = i => row({ id: i.id, emo: '', name: i.text, on: i.done, meta: '', cls: 'li' });
  const open = l.items.filter(i => !i.done), done = l.items.filter(i => i.done);
  view.innerHTML = '<button class="back" data-act="lback">‹ Все списки</button>' +
    (l.items.length ? '' : empty('Список пустой.<br>Нажми «Добавить пункт» внизу 👇')) +
    section('Нужно', open.map(r)) + section('Готово', done.map(r)) +
    (done.length ? '<button class="ghost" data-act="lclear">Убрать выполненные</button>' : '');
}
function listsAct(act, id) {
  const l = curList();
  if (act === 'lopen') { if (editing()) return; openList = id; buzz('light'); render(); window.scrollTo(0, 0); return; }
  if (act === 'lback') { openList = null; document.body.classList.remove('editing'); render(); return; }
  if (act === 'ldelist') {
    const x = state.lists.find(y => y.id === id);
    return ask('Удалить список «' + x.name + '» со всеми пунктами?', ok => { if (!ok) return; state.lists = state.lists.filter(y => y !== x); save(); render(); });
  }
  if (!l) return;
  if (act === 'lclear') l.items = l.items.filter(i => !i.done);
  else if (act === 'del') l.items = l.items.filter(i => i.id !== id);
  else if (act === 'toggle' && editing()) return editItem(id);
  else if (act === 'toggle') { const i = l.items.find(x => x.id === id); if (i) { i.done = !i.done; buzz(i.done ? 'medium' : 'light'); } }
  else return;
  save(); render();
}
function listForm() {
  formSheet({
    title: 'Новый список', ok: 'Создать',
    fields: [{ key: 'name', ph: 'Например, что посмотреть' }],
    chips: [{ key: 'emoji', value: LIST_EMOJI[0], items: LIST_EMOJI.map(e => [e, e]) }],
    valid: v => !!v.name,
    save: v => { state.lists.push({ id: newId(), name: v.name, emoji: v.emoji, items: [] }); }
  });
}
function itemForm() {
  const l = curList();
  formSheet({
    title: 'Добавить в «' + l.name + '»', ok: 'Добавить', keep: 'text',
    fields: [{ key: 'text', ph: 'Например, молоко', max: 120 }],
    valid: v => !!v.text,
    save: v => { l.items.push({ id: newId(), text: v.text, done: false }); }
  });
}

/* ---------- дневник на пять лет ---------- */
const DIARY_Q = [
  'От чего ни за что не откажешься?', 'Что сегодня порадовало больше всего?', 'Чему хочется научиться в этом году?',
  'Кому сегодня хочется сказать спасибо?', 'Какая песня сейчас крутится в голове?', 'Чем займёшься, если выпадет лишний свободный день?',
  'Что сейчас отнимает больше всего сил?', 'Какой маленький шаг можно сделать завтра к большой цели?', 'Что в себе нравится прямо сейчас?',
  'Какое решение давно откладывается?', 'Где хочется побывать?', 'Что сегодня получилось лучше, чем ожидалось?',
  'О чём сейчас думается чаще всего?', 'Какую привычку хочется завести?', 'Что можно перестать делать без потерь?',
  'Кто вдохновляет сейчас?', 'Что было самым вкусным на этой неделе?', 'Какой совет дать себе год назад?',
  'Чего сейчас хочется больше: покоя или движения?', 'Что сейчас читаешь, смотришь или слушаешь?', 'За что сегодня можно себя похвалить?',
  'Что пугает, но очень хочется попробовать?', 'Какое место дома самое любимое?', 'Что купить, если бы деньги не были вопросом?',
  'Какой разговор запомнился на этой неделе?', 'Как выглядит идеальное утро?', 'Чем гордишься в работе?',
  'Что сейчас даёт больше всего энергии?', 'С кем давно не виделись, а хочется?', 'Какое слово описывает этот месяц?',
  'Что хочется успеть до конца года?', 'Какая мечта кажется самой смелой?', 'Что сделает завтрашний день хорошим?',
  'Какие три вещи всегда поднимают настроение?', 'Чему научила последняя ошибка?', 'Что хочется сказать себе через пять лет?',
  'Как отдыхаешь по-настоящему?', 'Что сейчас самое важное в жизни?', 'Какой комплимент запомнился?',
  'От чего хочется освободиться?', 'Что нового попробовано за последнее время?', 'Какой день недели любимый и почему?',
  'Как описать себя тремя словами?', 'Какая погода за окном и как она влияет на настроение?', 'Что сейчас вызывает любопытство?',
  'Кому хочется помочь?', 'На что на этой неделе приятно было потратить деньги?', 'Какое самое тёплое воспоминание из детства?',
  'Чего не хватает прямо сейчас?', 'Какой фильм или книгу посоветовать другу?', 'Что сегодня было лишним?',
  'Как поменялись приоритеты за последний год?', 'Какую черту характера хочется развить?', 'Что хочется сделать для своего здоровья?',
  'Где чувствуешь себя на своём месте?', 'Чем закончился бы этот день, будь он фильмом?', 'Что сейчас стоило бы отпустить?',
  'О чём мечтается перед сном?', 'Чей поступок недавно тронул?', 'Что из сегодняшнего дня хочется запомнить?'
];
const dayOfYear = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5);
const diaryQ = key => dayOfYear(dateOf(key)) % DIARY_Q.length;
function viewDiary() {
  $('title').textContent = 'Дневник';
  const today = keyOf(new Date()), d = new Date(), q = diaryQ(today), cur = state.diary[today];
  const ym = today.slice(0, 7), filled = Object.keys(state.diary).filter(k => k.startsWith(ym)).length;
  const past = Object.keys(state.diary).filter(k => k < today && state.diary[k].q === q).sort().reverse();
  let html = '<div class="hero"><div style="min-width:0"><div class="lbl">' + WDF[d.getDay()] + ', ' + longDate(today) + '</div>' +
    '<div class="dq">' + esc(DIARY_Q[q]) + '</div></div></div>' +
    '<div class="note"><div class="lab" style="margin:0 0 8px">Твой ответ</div><textarea id="dText" placeholder="Напиши строчку или две...">' + esc(cur ? cur.text : '') + '</textarea>' +
    '<button class="vsave" data-act="dsave">' + (cur ? 'Обновить' : 'Сохранить') + '</button></div>' +
    '<div class="stats" style="margin-top:10px">' + stat(filled + ' / ' + d.getDate(), 'дней с записью в этом месяце', 'hot') + stat(String(Object.keys(state.diary).length), 'записей всего') + '</div>';
  html += past.length
    ? section('Ты уже отвечала на этот вопрос', past.map(k => '<div class="note"><div class="lab" style="margin:0 0 6px">' + longDate(k) + ' ' + k.slice(0, 4) + '</div><div class="dtext">' + esc(state.diary[k].text) + '</div></div>'))
    : '<div class="note" style="font-size:14px;color:var(--muted)">Этот вопрос вернётся через ' + DIARY_Q.length + ' дней. Ответишь снова и увидишь, как поменялся ответ.</div>';
  view.innerHTML = html;
}
function diaryAct(act) {
  if (act !== 'dsave') return;
  const today = keyOf(new Date()), text = $('dText').value.trim();
  if (text) state.diary[today] = { q: diaryQ(today), text };
  else delete state.diary[today];
  buzz('medium'); save(); render();
}
