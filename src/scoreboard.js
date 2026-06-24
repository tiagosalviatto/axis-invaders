(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Global scoreboard backed by Supabase (PostgREST), with localStorage as an
  // offline cache / fallback. The async API (fetchTop / submit) is consumed by
  // game.js; if Supabase isn't configured or is unreachable, everything
  // degrades to the local cache so the game still works.
  const KEY = 'axis-invaders-scores';
  const MAX = 10;

  function cfg() { return ns.config || {}; }

  function isConfigured() {
    const c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey && c.supabaseUrl.indexOf('SEUPROJETO') === -1);
  }

  function headers(extra) {
    const c = cfg();
    return Object.assign({
      apikey: c.supabaseAnonKey,
      Authorization: 'Bearer ' + c.supabaseAnonKey,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  // Rank by score desc, then by faster total_time.
  function cmp(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return (a.total_time || 0) - (b.total_time || 0);
  }

  // ---- local cache / fallback ----
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveLocal(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) { /* ignore */ }
  }

  function mergeLocal(entry) {
    const list = loadLocal();
    list.push(entry);
    list.sort(cmp);
    const top = list.slice(0, MAX);
    saveLocal(top);
    return top;
  }

  // ---- remote ----
  // Returns the top entries (remote when possible, else the local cache).
  function fetchTop(limit) {
    limit = limit || MAX;
    if (!isConfigured()) return Promise.resolve(loadLocal());
    const url = cfg().supabaseUrl +
      '/rest/v1/scores?select=name,score,total_time,ship,created_at' +
      '&order=score.desc,total_time.asc&limit=' + limit;
    return fetch(url, { headers: headers() })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(list => { saveLocal(list); return list; })
      .catch(() => loadLocal());
  }

  // Inserts an entry and returns { list, offline }. Always caches locally first
  // so a network failure still keeps the player's run.
  function submit(entry) {
    mergeLocal(entry);
    if (!isConfigured()) return Promise.resolve({ list: loadLocal(), offline: true });
    const url = cfg().supabaseUrl + '/rest/v1/scores';
    return fetch(url, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(entry)
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(() => fetchTop().then(list => ({ list, offline: false })))
      .catch(() => ({ list: loadLocal(), offline: true }));
  }

  ns.scoreboard = { fetchTop, submit, isConfigured, loadLocal, saveLocal, MAX, KEY };
})();
