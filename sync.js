/* Синхронизация с Google Диском через свой скрипт в Google-таблице.
   Адрес скрипта и ключ хранятся только на устройстве (не в данных и не в коде на GitHub). */

let syncCfg = null, syncTimer = null, syncBusy = false;
const syncKey = () => KEY + '-sync';
const syncOn = () => !!(syncCfg && syncCfg.url && syncCfg.key);
function syncLoadCfg() { try { syncCfg = JSON.parse(localStorage.getItem(syncKey())) || null; } catch (e) { syncCfg = null; } }
function syncSaveCfg() { try { if (syncCfg) localStorage.setItem(syncKey(), JSON.stringify(syncCfg)); else localStorage.removeItem(syncKey()); } catch (e) {} }

async function syncCall(op, extra) {
  const r = await fetch(syncCfg.url, { method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ key: syncCfg.key, op }, extra || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error === 'key' ? 'неверный ключ' : 'ошибка скрипта');
  return j;
}
function syncDone(err) {
  syncCfg.last = Date.now();
  syncCfg.err = err ? String(err.message || err) : '';
  syncSaveCfg();
  const s = $('syncStatus');
  if (s) s.textContent = syncStatusText();
}
function syncStatusText() {
  if (!syncOn()) return '';
  if (syncCfg.err) return 'не получилось: ' + syncCfg.err + '. Попробую снова, когда будет интернет';
  if (!syncCfg.last) return 'подключена, ещё не синхронизировалась';
  const d = new Date(syncCfg.last), k = keyOf(d);
  return 'включена · последняя ' + (k === keyOf(new Date()) ? 'сегодня' : nearDate(k)) + ' в ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + (syncCfg.dirty ? ' · есть неотправленные изменения' : '');
}

// вызывается из save(): помечаем, что есть свежие изменения, и отправляем через пару секунд
function syncTouch() {
  if (!syncOn()) return;
  syncCfg.dirty = true;
  syncCfg.localAt = Date.now();
  syncSaveCfg();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncPush, 1500);
}
async function syncPush() {
  if (!syncOn() || syncBusy) return;
  syncBusy = true;
  const at = syncCfg.localAt || Date.now();
  try {
    await syncCall('put', { data: JSON.stringify(state), at });
    syncCfg.serverAt = at;
    if (syncCfg.localAt === at) syncCfg.dirty = false;
    syncDone();
  } catch (e) { syncDone(e); }
  syncBusy = false;
}
function syncAdopt(j) {
  try { localStorage.setItem(KEY, j.data); } catch (e) {}
  load();
  syncCfg.serverAt = j.at; syncCfg.localAt = j.at; syncCfg.dirty = false;
  render();
}
// забираем изменения с Диска: при открытии приложения и при возвращении в него
async function syncPull() {
  if (!syncOn() || syncBusy) return;
  syncBusy = true;
  try {
    const j = await syncCall('get');
    if (!j.data) { syncBusy = false; return syncPush(); }
    if (j.at > (syncCfg.serverAt || 0)) {
      // на Диске есть версия новее той, что мы видели
      if (syncCfg.dirty && (syncCfg.localAt || 0) > j.at) {
        syncBusy = false; return syncPush();
      }
      if (syncCfg.dirty) await syncCall('backup', { data: JSON.stringify(state), at: syncCfg.localAt || Date.now() });
      syncAdopt(j);
    } else if (syncCfg.dirty) { syncBusy = false; return syncPush(); }
    syncDone();
  } catch (e) { syncDone(e); }
  syncBusy = false;
}

// код подключения: «MD1.» + адрес скрипта и ключ, закодированные одной строкой
function syncParse(code) {
  const s = String(code || '').trim().replace(/^MD1\./, '');
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (o && /^https:\/\/script\.google(usercontent)?\.com\//.test(o.u) && o.k) return { url: o.u, key: o.k };
  } catch (e) {}
  return null;
}
async function syncConnect(code) {
  const c = syncParse(code), msg = $('syncMsg');
  if (!c) { msg.textContent = 'Код не подходит: скопируй его целиком.'; return; }
  msg.textContent = 'Подключаю…';
  syncCfg = { url: c.url, key: c.key };
  try {
    const j = await syncCall('get');
    const hasLocal = state.habits.length || state.tasks.length || state.ideas.length || Object.keys(state.fin.months).length;
    const finish = () => { syncDone(); syncListen(); closeSheet(); render(); };
    if (!j.data) { syncCfg.localAt = Date.now(); syncCfg.dirty = true; syncSaveCfg(); await syncPush(); return finish(); }
    if (!hasLocal) { syncSaveCfg(); syncAdopt(j); return finish(); }
    ask('На Google Диске уже есть данные. Взять их? Данные на этом устройстве заменятся. «Отмена» — наоборот, отправить на Диск данные с этого устройства.', async ok => {
      syncSaveCfg();
      if (ok) syncAdopt(j);
      else { syncCfg.localAt = Date.now(); syncCfg.dirty = true; await syncPush(); }
      finish();
    });
  } catch (e) {
    syncCfg = null; syncSaveCfg();
    msg.textContent = 'Не получилось подключиться: ' + e.message + '. Проверь интернет и код.';
  }
}
function syncHtml() {
  if (!syncOn()) return '<div class="lab" style="margin-top:20px">Синхронизация с Google Диском</div>' +
    '<textarea id="syncCode" placeholder="Вставь сюда код синхронизации"></textarea>' +
    (navigator.clipboard && navigator.clipboard.readText ? '<button class="kill" id="syncPaste" style="color:var(--text);margin:-4px 0 6px">📋 Вставить код из буфера</button>' : '') +
    '<button class="save" id="syncConnect">Подключить</button><div class="lab" id="syncMsg"></div>';
  return '<div class="lab" style="margin-top:20px">Синхронизация с Google Диском</div>' +
    '<div class="note" style="margin:0 0 10px;background:var(--bg)"><b>☁️ </b><span id="syncStatus">' + esc(syncStatusText()) + '</span></div>' +
    '<button class="save" id="syncNow">Синхронизировать сейчас</button>' +
    '<button class="kill" id="syncOff">Отключить на этом устройстве</button><div class="lab" id="syncMsg"></div>';
}
function syncClick(id) {
  if (id === 'syncConnect') { syncConnect($('syncCode').value); return true; }
  if (id === 'syncPaste') { navigator.clipboard.readText().then(t => { $('syncCode').value = t.trim(); syncConnect(t); }, () => { $('syncMsg').textContent = 'Не получилось вставить: зажми поле и выбери «Вставить».'; }); return true; }
  if (id === 'syncNow') { $('syncMsg').textContent = 'Синхронизирую…'; syncPull().then(() => { if ($('syncMsg')) $('syncMsg').textContent = ''; }); return true; }
  if (id === 'syncOff') {
    ask('Отключить синхронизацию на этом устройстве? Данные останутся и здесь, и на Диске.', ok => { if (!ok) return; syncCfg = null; syncSaveCfg(); closeSheet(); render(); });
    return true;
  }
  return false;
}

let syncListening = false;
function syncListen() {
  if (syncListening) return;
  syncListening = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncPull(); });
  window.addEventListener('online', () => syncPull());
}
// на пустом приложении без синхронизации подсказываем, как вернуть данные из Google
function syncEmptyHint() {
  if (syncOn()) return;
  const empty = !state.habits.length && !state.tasks.length && !state.ideas.length && !Object.keys(state.fin.months).length && !state.bdays.length && !state.fin.goal;
  if (empty) view.insertAdjacentHTML('afterbegin', '<button class="banner" style="background:#e4e1fb" data-act="xfer">☁️ Тут пусто? Если твои данные хранятся в Google, нажми сюда и вставь код синхронизации, всё вернётся</button>');
}
function syncStart() {
  syncLoadCfg();
  if (!syncOn()) return;
  syncListen();
  syncPull();
}
