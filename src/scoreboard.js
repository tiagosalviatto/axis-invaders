(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Global leaderboards backed by Supabase (PostgREST), with localStorage as an
  // offline cache / fallback. Two kinds of board:
  //  - overall:   table `scores` — only players who finish the whole game
  //  - per stage: table `stage_scores`, filtered by `stage` (the stage id)
  // Pass a stage id to work with that stage's board; omit it for the overall one.
  // If Supabase isn't configured or is unreachable, everything degrades to the
  // local cache so the game still works.
  const KEY = 'axis-invaders-scores';
  const MAX = 10;
  const COLS = 'name,score,total_time,ship,device,created_at';

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

  function table(stageId) { return stageId ? 'stage_scores' : 'scores'; }

  // Rank by score desc, then by faster total_time.
  function cmp(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return (a.total_time || 0) - (b.total_time || 0);
  }

  // ---- local cache / fallback (one cache per board) ----
  function cacheKey(stageId) { return stageId ? KEY + ':stage:' + stageId : KEY; }

  function loadLocal(stageId) {
    try {
      const raw = localStorage.getItem(cacheKey(stageId));
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveLocal(list, stageId) {
    try { localStorage.setItem(cacheKey(stageId), JSON.stringify(list.slice(0, MAX))); } catch (e) { /* ignore */ }
  }

  function mergeLocal(entry, stageId) {
    const list = loadLocal(stageId);
    list.push(entry);
    list.sort(cmp);
    saveLocal(list, stageId);
  }

  // ---- remote ----
  // Top entries of a board (remote when possible, else the local cache).
  function fetchTop(stageId, limit) {
    limit = limit || MAX;
    if (!isConfigured()) return Promise.resolve(loadLocal(stageId));
    const filter = stageId ? '&stage=eq.' + encodeURIComponent(stageId) : '';
    const url = cfg().supabaseUrl + '/rest/v1/' + table(stageId) +
      '?select=' + COLS + filter + '&order=score.desc,total_time.asc&limit=' + limit;
    return fetch(url, { headers: headers() })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(list => { saveLocal(list, stageId); return list; })
      .catch(() => loadLocal(stageId));
  }

  // Inserts an entry into a board and returns { list, offline }. Always caches
  // locally first so a network failure still keeps the player's result.
  function submit(entry, stageId) {
    mergeLocal(entry, stageId);
    if (!isConfigured()) return Promise.resolve({ list: loadLocal(stageId), offline: true });
    return fetch(cfg().supabaseUrl + '/rest/v1/' + table(stageId), {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(entry)
    })
      .then(r => (r.ok ? null : Promise.reject(new Error('HTTP ' + r.status))))
      .then(() => fetchTop(stageId).then(list => ({ list, offline: false })))
      .catch(() => ({ list: loadLocal(stageId), offline: true }));
  }

  ns.scoreboard = { fetchTop, submit, isConfigured, loadLocal, MAX };
})();
