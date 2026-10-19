// 給料日サイクルの日付計算と、収支・予算の集計
const Cycle = (() => {
  const pad = (n) => String(n).padStart(2, "0");
  const dim = (y, m) => new Date(y, m, 0).getDate(); // m: 1-12
  const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  // サイクルのキーは給料日の属する月 "YYYY-MM"
  function key(y, m) { return `${y}-${pad(m)}`; }
  function parseKey(k) { const [y, m] = k.split("-").map(Number); return { y, m }; }
  function shift(k, delta) {
    let { y, m } = parseKey(k);
    m += delta;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    return key(y, m);
  }

  // サイクル開始日(給料日。月に存在しない日は末日)
  function startIso(k, payday) {
    const { y, m } = parseKey(k);
    return isoOf(y, m, Math.min(payday, dim(y, m)));
  }
  // サイクル終了日(次の給料日の前日)
  function endIso(k, payday) {
    const d = Fmt.parseIso(startIso(shift(k, 1), payday));
    d.setDate(d.getDate() - 1);
    return Fmt.iso(d);
  }
  function keyForDate(dateIso, payday) {
    const d = Fmt.parseIso(dateIso);
    let k = key(d.getFullYear(), d.getMonth() + 1);
    if (dateIso < startIso(k, payday)) k = shift(k, -1);
    return k;
  }
  // 毎月day日の固定費が、このサイクルのどの日付に当たるか
  // (給料日以降の日はサイクル開始月、給料日より前の日は翌月)
  function dateForDay(k, day, payday) {
    const { y, m } = parseKey(k);
    if (day >= payday) return isoOf(y, m, Math.min(day, dim(y, m)));
    const n = parseKey(shift(k, 1));
    return isoOf(n.y, n.m, Math.min(day, dim(n.y, n.m)));
  }
  function daysBetween(aIso, bIso) {
    return Math.round((Fmt.parseIso(bIso) - Fmt.parseIso(aIso)) / 86400000);
  }

  return { key, parseKey, shift, startIso, endIso, keyForDate, dateForDay, daysBetween };
})();

const Calc = (() => {
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

  // サイクルの計画。予算は未設定なら直近の過去サイクルの配分を引き継いで表示する
  function getCycle(data, k) {
    const stored = data.cycles[k] || {};
    let budgets = stored.budgets;
    let inherited = false;
    if (!budgets) {
      const prev = Object.keys(data.cycles)
        .filter((x) => x < k && data.cycles[x].budgets)
        .sort()
        .pop();
      budgets = prev ? data.cycles[prev].budgets : {};
      inherited = !!prev;
    }
    return {
      income: stored.income != null ? stored.income : data.settings.defaultIncome,
      incomeSet: stored.income != null,
      budgets,
      hasPlan: !!stored.budgets,
      inherited,
      oneOff: stored.oneOff || []
    };
  }

  function summary(data, k, todayIso) {
    const payday = data.settings.payday;
    const start = Cycle.startIso(k, payday);
    const end = Cycle.endIso(k, payday);
    const cyc = getCycle(data, k);

    const fixed = data.fixedItems.map((it) => ({
      id: it.id, name: it.name, amount: it.amount, kind: it.kind || "fixed",
      date: Cycle.dateForDay(k, it.day, payday), src: "master"
    }));
    const oneOff = cyc.oneOff.map((o) => ({
      id: o.id, name: o.name, amount: o.amount, kind: "oneoff", date: o.date, src: "oneoff"
    }));
    const outgoings = [...fixed, ...oneOff].sort((a, b) => a.date.localeCompare(b.date));
    const fixedTotal = sum(fixed, (x) => x.amount);
    const oneOffTotal = sum(oneOff, (x) => x.amount);
    const available = cyc.income - fixedTotal - oneOffTotal;

    const entries = data.entries.filter((e) => e.date >= start && e.date <= end);
    const catIds = new Set(data.categories.map((c) => c.id));
    const rows = data.categories.map((c) => {
      const mine = entries.filter((e) => e.catId === c.id);
      const budget = cyc.budgets[c.id] || 0;
      const spent = sum(mine.filter((e) => !e.planned), (e) => e.amount);
      const planned = sum(mine.filter((e) => e.planned), (e) => e.amount);
      return { cat: c, budget, spent, planned, remaining: budget - spent - planned };
    });
    // 削除済みカテゴリの支出も合計には含める
    const orphans = entries.filter((e) => !catIds.has(e.catId));
    if (orphans.length) {
      const spent = sum(orphans.filter((e) => !e.planned), (e) => e.amount);
      const planned = sum(orphans.filter((e) => e.planned), (e) => e.amount);
      rows.push({
        cat: { id: "_orphan", name: "削除済みカテゴリ", color: "#93a0c2" },
        budget: 0, spent, planned, remaining: -spent - planned
      });
    }

    const budgetsTotal = sum(rows, (r) => r.budget);
    const spentTotal = sum(rows, (r) => r.spent);
    const plannedTotal = sum(rows, (r) => r.planned);
    const remaining = budgetsTotal - spentTotal - plannedTotal;

    const isCurrent = todayIso >= start && todayIso <= end;
    let daysLeft = 0;
    if (todayIso < start) daysLeft = Cycle.daysBetween(start, end) + 1;
    else if (isCurrent) daysLeft = Cycle.daysBetween(todayIso, end) + 1;
    const perDay = daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0;

    // 予定の流れ: 固定費・単発の支出・変動費の予定を日付順に並べる
    const plannedEvents = entries
      .filter((e) => e.planned)
      .map((e) => {
        const cat = data.categories.find((c) => c.id === e.catId);
        return {
          id: e.id, name: (cat ? cat.name : "削除済みカテゴリ") + (e.memo ? `(${e.memo})` : ""),
          amount: e.amount, kind: "planned", date: e.date, src: "entry"
        };
      });
    const timeline = [...outgoings, ...plannedEvents].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    timeline.forEach((ev) => { cum += ev.amount; ev.cumulative = cum; });

    return {
      key: k, start, end, isCurrent, daysLeft, perDay, cyc,
      outgoings, fixedTotal, oneOffTotal, available,
      rows, budgetsTotal, spentTotal, plannedTotal, remaining,
      unallocated: available - budgetsTotal,
      timeline, entries
    };
  }

  return { getCycle, summary };
})();
