(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Local high-score table persisted to localStorage. The interface
  // (load / save / qualifies) is intentionally small so it can later be
  // swapped for a Supabase-backed implementation without touching game.js.
  const KEY = 'axis-invaders-scores';
  const MAX = 10;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function persist(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* storage unavailable (private mode / quota) — scores just won't persist */
    }
  }

  // Returns true if `score` would land in the top MAX of the current table.
  function qualifies(score) {
    const list = load();
    return list.length < MAX || score > list[list.length - 1].score;
  }

  // Insert an entry, keep the table sorted and capped, persist, and return it.
  function save(entry) {
    const list = load();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, MAX);
    persist(top);
    return top;
  }

  ns.scoreboard = { load, save, qualifies, MAX, KEY };
})();
