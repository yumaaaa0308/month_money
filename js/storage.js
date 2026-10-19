// データ保存(localStorageのみ・サーバー送信なし)
const PALETTE = ["#34d399", "#5b8def", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#f472b6"];

const Storage = (() => {
  const KEY = "budgetApp:v1";

  function defaultData() {
    const names = ["食費", "日用品", "交際費", "医療費", "美容室"];
    return {
      settings: { payday: 25, defaultIncome: 0 },
      // 変動費カテゴリ: { id, name, color }
      categories: names.map((name, i) => ({ id: "c" + (i + 1), name, color: PALETTE[i % PALETTE.length] })),
      // 固定費・貯蓄投資: { id, name, amount(円), day(1-31), kind: "fixed"|"saving" }
      fixedItems: [],
      // 給料日サイクルごとの計画。キーは給料日の属する月 "YYYY-MM"
      //   { income(円)|未設定, budgets: { カテゴリid: 円 }, oneOff: [{ id, name, amount, date }] }
      cycles: {},
      // 変動費の支出: { id, date: "YYYY-MM-DD", catId, amount(円), memo, planned: 予定(まだ使っていない) }
      entries: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const p = JSON.parse(raw);
      const base = defaultData();
      return {
        settings: { ...base.settings, ...(p.settings || {}) },
        categories: Array.isArray(p.categories) ? p.categories : base.categories,
        fixedItems: Array.isArray(p.fixedItems) ? p.fixedItems : [],
        cycles: p.cycles && typeof p.cycles === "object" ? p.cycles : {},
        entries: Array.isArray(p.entries) ? p.entries : []
      };
    } catch (e) {
      console.error("Failed to load data, resetting.", e);
      return defaultData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Failed to save data.", e);
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return { KEY, load, save, uid, defaultData };
})();

const Fmt = (() => {
  const pad = (n) => String(n).padStart(2, "0");
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];

  function yen(n) {
    const v = Math.round(n || 0);
    return (v < 0 ? "-¥" : "¥") + Math.abs(v).toLocaleString("ja-JP");
  }
  function inputYen(n) {
    return Math.round(n || 0).toLocaleString("ja-JP");
  }
  function num(str) {
    const cleaned = String(str == null ? "" : str).replace(/,/g, "").trim();
    if (cleaned === "") return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function iso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseIso(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function md(isoStr) {
    const d = parseIso(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function mdw(isoStr) {
    const d = parseIso(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
  }
  function todayIso() {
    return iso(new Date());
  }
  return { yen, inputYen, num, iso, parseIso, md, mdw, todayIso };
})();
