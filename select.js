/* Редактирование записей и выбор нескольких, как в «Фото» на iPhone.
   «Изменить» сверху: крестик удаляет запись, нажатие на запись открывает её редактирование.
   Зажать запись: включается выбор; дальше нажатия отмечают записи, а если не отпускать палец
   и провести по списку, отмечаются все записи под пальцем. Внизу кнопка «Удалить (N)». */

const SEL_WORDS = { tasks: ['задачу', 'задачи', 'задач'], ideas: ['идею', 'идеи', 'идей'], checks: ['пункт', 'пункта', 'пунктов'], lists: ['пункт', 'пункта', 'пунктов'] };
let selState = null, selSuppressUntil = 0;

function selList() {
  if (tab === 'tasks') return state.tasks;
  if (tab === 'ideas') return state.ideas;
  if (tab === 'checks') return state.checks;
  if (tab === 'lists') { const l = curList(); return l ? l.items : null; }
  return null;
}
const selOn = () => !!selState && selState.tab === tab && selState.list === selList();
const selCan = () => !!SEL_WORDS[tab] && !!selList();
const selRows = () => [...view.querySelectorAll('.row[data-id]')];

function selEnter(id) {
  selState = { tab, list: selList(), ids: new Set(id ? [id] : []) };
  document.body.classList.remove('editing');
  document.body.classList.add('selecting');
  buzz('medium');
  selPaint();
}
function selReset() { selState = null; document.body.classList.remove('selecting'); }
function selExit() { selReset(); render(); }
function selFlip(id, to) {
  const s = selState.ids, has = s.has(id), want = to === undefined ? !has : to;
  if (want === has) return;
  if (want) s.add(id); else s.delete(id);
  buzz('light');
  selPaint();
}

// обновляем отметки, шапку и нижнюю кнопку, не перерисовывая список (иначе палец «теряет» строку)
function selPaint() {
  const add = $('addBtn'), all = $('selAllBtn');
  if (!selOn()) {
    if (selState) selReset();
    all.style.display = 'none';
    add.classList.remove('danger'); add.disabled = false;
    return;
  }
  const exist = new Set(selList().map(x => x.id));
  for (const id of [...selState.ids]) if (!exist.has(id)) selState.ids.delete(id);
  const rows = selRows(), n = selState.ids.size;
  rows.forEach(r => r.classList.toggle('picked', selState.ids.has(r.dataset.id)));
  $('title').textContent = n ? 'Выбрано: ' + n : 'Выбери записи';
  const eb = $('editBtn'); eb.style.visibility = 'visible'; eb.textContent = 'Отмена';
  const allPicked = rows.length && rows.every(r => selState.ids.has(r.dataset.id));
  all.style.display = rows.length ? '' : 'none';
  all.textContent = allPicked ? 'Снять выбор' : 'Выбрать все';
  add.classList.remove('hide'); add.classList.add('danger');
  add.textContent = n ? 'Удалить (' + n + ')' : 'Удалить';
  add.disabled = !n;
}
// подсказка внизу списка, пока режим выбора не включён
function selHint() {
  if (selOn() || !selCan() || selRows().length < 2) return;
  const x = view.querySelector('[data-act="xfer"]');
  const html = '<div class="selhint">Зажми запись, чтобы выбрать несколько. «Изменить» сверху: переименовать или удалить</div>';
  if (x) x.insertAdjacentHTML('beforebegin', html); else view.insertAdjacentHTML('beforeend', html);
}

// клик по списку в режиме выбора: только отмечаем, ничего не открываем
function selClick(e) {
  if (Date.now() < selSuppressUntil) { e.preventDefault(); return true; }
  if (!selOn()) return false;
  const t = e.target.closest('[data-act]');
  if (t && (t.dataset.act === 'lback' || t.dataset.act === 'xfer')) { selReset(); return false; }
  const r = e.target.closest('.row[data-id]');
  if (r && view.contains(r)) selFlip(r.dataset.id);
  return true;
}
function selAllClick() {
  if (!selOn()) return;
  const ids = selRows().map(r => r.dataset.id), allPicked = ids.every(id => selState.ids.has(id));
  ids.forEach(id => allPicked ? selState.ids.delete(id) : selState.ids.add(id));
  buzz('light');
  selPaint();
}
function selDelete() {
  if (!selOn() || !selState.ids.size) return;
  const n = selState.ids.size, ids = selState.ids, w = SEL_WORDS[tab];
  ask('Удалить ' + n + ' ' + plural(n, w[0], w[1], w[2]) + '? Это нельзя отменить.', ok => {
    if (!ok) return;
    if (tab === 'lists') { const l = curList(); l.items = l.items.filter(x => !ids.has(x.id)); }
    else state[tab] = state[tab].filter(x => !ids.has(x.id));
    selReset();
    buzz('heavy'); save(); render();
  });
}

// зажатие записи и протягивание пальцем
function selInit() {
  let timer = null, sx = 0, sy = 0, fired = false, dragging = false, dragTo = true;
  const rowAt = (x, y) => { const el = document.elementFromPoint(x, y), r = el && el.closest('.row[data-id]'); return r && view.contains(r) ? r : null; };
  const start = (x, y, target) => {
    fired = false; dragging = false;
    const r = target && target.closest && target.closest('.row[data-id]');
    if (!r || !view.contains(r) || !selCan() || document.body.classList.contains('editing') || document.body.classList.contains('adding')) return;
    sx = x; sy = y;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true; dragging = true;
      if (!selOn()) { selEnter(r.dataset.id); dragTo = true; }
      else { dragTo = !selState.ids.has(r.dataset.id); selFlip(r.dataset.id, dragTo); }
    }, 450);
  };
  const move = (x, y, e) => {
    if (!fired) { if (Math.hypot(x - sx, y - sy) > 10) clearTimeout(timer); return; }
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const r = rowAt(x, y);
    if (r) selFlip(r.dataset.id, dragTo);
  };
  const end = () => { clearTimeout(timer); if (fired) selSuppressUntil = Date.now() + 450; fired = false; dragging = false; };
  view.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
  view.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientX, e.clientY, e.target); });
  document.addEventListener('mousemove', e => { if (e.buttons & 1) move(e.clientX, e.clientY, e); });
  document.addEventListener('mouseup', end);
  view.addEventListener('contextmenu', e => { if (e.target.closest('.row[data-id]')) e.preventDefault(); });
  $('selAllBtn').onclick = selAllClick;
}

/* ---------- редактирование записи (в режиме «Изменить») ---------- */
function editItem(id) {
  if (tab === 'tasks') {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    return formSheet({
      title: 'Задача', ok: 'Сохранить',
      fields: [{ key: 'text', ph: 'Что сделать', value: t.text, max: 120 }, { key: 'date', lab: 'Когда', mode: 'date', value: t.date }],
      chips: [{ key: 'anyw', lab: 'Если дата на выходных', value: t.anyWeekend ? 'yes' : 'no', items: [['no', 'Именно в этот день'], ['yes', 'Любой день выходных']] }],
      valid: v => !!v.text && /^\d{4}-\d{2}-\d{2}$/.test(v.date),
      save: v => {
        t.text = v.text; t.date = v.date;
        const wd = dateOf(v.date).getDay();
        if (v.anyw === 'yes' && (wd === 6 || wd === 0)) { t.anyWeekend = true; if (wd === 0) t.date = shift(v.date, -1); }
        else delete t.anyWeekend;
      },
      del: () => { state.tasks = state.tasks.filter(x => x !== t); }
    });
  }
  if (tab === 'ideas') {
    const i = state.ideas.find(x => x.id === id);
    if (!i) return;
    return formSheet({
      title: 'Идея', ok: 'Сохранить',
      fields: [{ key: 'text', ph: 'Идея', value: i.text, max: 120 }, { key: 'date', lab: 'Когда выйдет (можно не ставить)', mode: 'date', value: i.date || '', after: true }],
      chips: [{ key: 'format', value: i.format, items: Object.keys(FORMATS).map(k => [k, FORMATS[k][0] + ' ' + FORMATS[k][1]]) }],
      valid: v => !!v.text,
      save: v => { i.text = v.text; i.format = v.format; i.date = v.date || null; },
      del: () => { state.ideas = state.ideas.filter(x => x !== i); }
    });
  }
  if (tab === 'checks') {
    const c = state.checks.find(x => x.id === id);
    if (!c) return;
    return formSheet({
      title: 'Пункт', ok: 'Сохранить',
      fields: [{ key: 'name', ph: 'Например, закрыла дверь?', value: c.name }],
      chips: [{ key: 'emoji', value: c.emoji, items: CHECK_EMOJI.map(e => [e, e]) },
        { key: 'reset', lab: 'Когда снова становится «не сделано»', value: c.reset, items: Object.keys(RESETS).map(k => [k, RESETS[k]]) }],
      valid: v => !!v.name,
      save: v => { c.name = v.name; c.emoji = v.emoji; c.reset = v.reset; },
      del: () => { state.checks = state.checks.filter(x => x !== c); }
    });
  }
  if (tab === 'lists') {
    const l = curList(), it = l && l.items.find(x => x.id === id);
    if (!it) return;
    return formSheet({
      title: 'Пункт', ok: 'Сохранить',
      fields: [{ key: 'text', ph: 'Пункт', value: it.text, max: 120 }],
      valid: v => !!v.text,
      save: v => { it.text = v.text; },
      del: () => { l.items = l.items.filter(x => x !== it); }
    });
  }
}
