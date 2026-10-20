// 画面描画(HTML文字列を組み立てる)
const Views = (() => {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const neg = (n) => (n < 0 ? "neg" : "");

  // ---------- 共通: サイクル切り替え ----------
  function cycleNav(data, s) {
    const { y, m } = Cycle.parseKey(s.key);
    const sub = s.isCurrent
      ? `${y}年${m}月${data.settings.payday}日の給料日から・残り${s.daysLeft}日`
      : `${y}年${m}月${data.settings.payday}日の給料日から`;
    return `
      <div class="card">
        <div class="month-nav">
          <button type="button" class="btn-icon" data-action="cycle-prev">‹</button>
          <div class="month-nav-main">
            <div class="month-nav-label">${Fmt.md(s.start)} 〜 ${Fmt.md(s.end)}</div>
            <div class="month-nav-sub">${sub}</div>
          </div>
          <button type="button" class="btn-icon" data-action="cycle-next">›</button>
        </div>
        ${s.isCurrent ? "" : `<button type="button" class="btn btn-secondary btn-block" style="margin-top:10px" data-action="cycle-today">今のサイクルに戻る</button>`}
      </div>`;
  }

  function bar(r) {
    const denom = Math.max(r.budget, r.spent + r.planned, 1);
    const over = r.spent + r.planned > r.budget;
    const color = over ? "var(--bad)" : r.cat.color;
    return `
      <div class="bar">
        <div class="bar-seg" style="width:${(r.spent / denom) * 100}%;background:${color}"></div>
        <div class="bar-seg bar-planned" style="width:${(r.planned / denom) * 100}%;background:${color}"></div>
        ${over && r.budget > 0 ? `<div class="bar-mark" style="left:${(r.budget / denom) * 100}%"></div>` : ""}
      </div>`;
  }

  // ---------- ホーム ----------
  function renderHome(data, s) {
    const hasBudget = s.budgetsTotal > 0;
    const notice = !s.cyc.hasPlan
      ? `<div class="card">
           <h2>このサイクルの予測がまだありません</h2>
           <p class="note">給料日に「予測」タブで、収入・固定費から変動費に使える額を見積もって配分しましょう。${s.cyc.inherited ? "(いまは前回の配分を引き継いで表示しています)" : ""}</p>
           <button class="btn btn-primary btn-block" data-action="goto" data-view="plan">予測を立てる</button>
         </div>`
      : "";

    const catCards = s.rows.map((r) => `
      <div class="cat-card">
        <div class="cat-head">
          <div class="cat-name"><span class="dot" style="background:${r.cat.color}"></span>${esc(r.cat.name)}</div>
          <div class="cat-remain ${neg(r.remaining)}">${Fmt.yen(r.remaining)}</div>
        </div>
        ${bar(r)}
        <div class="cat-meta">予算 ${Fmt.yen(r.budget)} ／ 使用 ${Fmt.yen(r.spent)}${r.planned ? ` ／ 予定 ${Fmt.yen(r.planned)}` : ""}</div>
      </div>`).join("");

    const recent = [...s.entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((e) => entryRow(data, e, false))
      .join("");

    return `
      ${cycleNav(data, s)}
      ${notice}
      <div class="card hero">
        <h2>残りの使えるお金</h2>
        <div class="big-number ${neg(s.remaining)}">${Fmt.yen(s.remaining)}</div>
        <div class="sub-number">入金額 ${Fmt.yen(s.budgetsTotal)} ／ 使用 ${Fmt.yen(s.spentTotal)}${s.plannedTotal ? ` ／ 予定 ${Fmt.yen(s.plannedTotal)}` : ""}</div>
        ${hasBudget && s.daysLeft > 0 ? `<div class="perday">1日あたり <b class="${neg(s.perDay)}">${Fmt.yen(s.perDay)}</b><span>(残り${s.daysLeft}日)</span></div>` : ""}
      </div>
      <button class="btn btn-primary btn-block" style="margin-bottom:14px" data-action="add-entry">＋ 支出を記録</button>
      <div class="section-title">変動費のカテゴリ別</div>
      ${s.rows.length ? catCards : `<div class="empty-state">カテゴリがありません。設定で追加してください。</div>`}
      <div class="section-title">最近の記録</div>
      ${recent ? `<div class="list">${recent}</div>` : `<div class="empty-state">まだ記録がありません</div>`}
    `;
  }

  // ---------- 記録 ----------
  function entryRow(data, e, withActions) {
    const cat = data.categories.find((c) => c.id === e.catId);
    const name = cat ? cat.name : "削除済みカテゴリ";
    const color = cat ? cat.color : "#93a0c2";
    return `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title"><span class="dot" style="background:${color}"></span>${esc(name)}${e.planned ? ` <span class="badge warn">予定</span>` : ""}</div>
          <div class="li-sub">${Fmt.mdw(e.date)}${e.memo ? "・" + esc(e.memo) : ""}</div>
        </div>
        <div class="li-amount">-${Fmt.yen(e.amount)}</div>
        ${withActions ? `
        <div class="li-actions">
          ${e.planned ? `<button class="btn-icon" title="使った" data-action="confirm-entry" data-id="${e.id}">✓</button>` : ""}
          <button class="btn-icon" data-action="edit-entry" data-id="${e.id}">✎</button>
          <button class="btn-icon" data-action="delete-entry" data-id="${e.id}">🗑</button>
        </div>` : ""}
      </div>`;
  }

  function renderRecords(data, s) {
    const sorted = [...s.entries].sort((a, b) => b.date.localeCompare(a.date) || 0);
    const groups = [];
    sorted.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });
    const rv = Calc.review(data, s.key);
    const acc = Calc.accuracy(data, s.key);
    const signed = (n) => (n > 0 ? "+" : n < 0 ? "-" : "±") + Fmt.yen(Math.abs(n));
    const pct = (p) => (p > 0 ? "+" : p < 0 ? "-" : "±") + (Math.abs(p) * 100).toFixed(1) + "%";
    const actualInputs = rv.rows.map((r) => `
      <div class="field">
        <label><span class="dot" style="background:${r.cat.color}"></span>${esc(r.cat.name)}
          <span class="label-right">予測 ${r.budget == null ? "未設定" : Fmt.yen(r.budget)}</span></label>
        <input type="text" inputmode="numeric" class="comma-input-yen" name="act_${r.cat.id}"
          value="${r.source === "manual" ? Fmt.inputYen(r.actual) : ""}"
          placeholder="${r.source === "entries" ? Fmt.inputYen(r.actual) + "(記録の合計)" : "実績を入力"}">
        ${r.diff != null ? `<div class="hint">差 <b class="${r.diff > 0 ? "neg" : ""}">${signed(r.diff)}</b>(${r.diff > 0 ? "予測より多かった" : r.diff < 0 ? "予測より少なかった" : "ぴったり"})</div>` : ""}
      </div>`).join("");
    const accRows = acc.cycles.map((c) => `
      <div class="calc-line"><span>${Fmt.md(c.start)}〜</span><span>予測 ${Fmt.yen(c.forecast)} → 実績 ${Fmt.yen(c.actual)} <b class="${c.diff > 0 ? "neg" : ""}">(${pct(c.pct)})</b></span></div>`).join("");
    return `
      ${cycleNav(data, s)}
      <form id="actuals-form" class="card">
        <h2>予測と実績(カテゴリ別)</h2>
        <p class="note">サイクルが終わったら、マネーフォワードのカテゴリ別の合計を転記します。予測との差が、次の予測の精度を上げる材料になります。</p>
        ${actualInputs || `<div class="empty-state">カテゴリがありません。設定で追加してください。</div>`}
        ${rv.hasComparison ? `<div class="calc-line calc-result"><span>合計の差(実績 − 予測)</span><b class="${rv.actualTotal - rv.forecastTotal > 0 ? "neg" : ""}">${signed(rv.actualTotal - rv.forecastTotal)}</b></div>` : ""}
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px">実績を保存</button>
      </form>
      ${acc.cycles.length ? `
      <div class="card">
        <h2>予測の当たり具合(直近${acc.cycles.length}サイクル)</h2>
        ${accRows}
        <div class="calc-line calc-result"><span>平均のずれ</span><b>${(acc.meanAbsPct * 100).toFixed(1)}%</b></div>
        <div class="hint">${acc.meanPct > 0.005 ? `実績が予測より平均 ${(acc.meanPct * 100).toFixed(1)}% 多くなっています。` : acc.meanPct < -0.005 ? `実績が予測より平均 ${(Math.abs(acc.meanPct) * 100).toFixed(1)}% 少なくなっています。` : "予測と実績はほぼ一致しています。"}</div>
      </div>` : ""}
      <div class="section-title">日付つきの予定・記録</div>
      <p class="note" style="padding:0 4px">交際費の予定など、日付が分かっているものはここに登録すると予測の流れに出ます。普段の細かい支出はマネーフォワードに任せて構いません。</p>
      <div class="fab-row" style="margin:14px 0">
        <button class="btn btn-primary" style="flex:1" data-action="add-planned">＋ 予定を追加</button>
        <button class="btn btn-secondary" style="flex:1" data-action="add-entry">＋ 支出を記録</button>
      </div>
      ${groups.length
        ? groups.map((g) => `
          <div class="section-title">${Fmt.mdw(g.date)}</div>
          <div class="list">${g.items.map((e) => entryRow(data, e, true)).join("")}</div>`).join("")
        : `<div class="empty-state">このサイクルの予定・記録はまだありません</div>`}
    `;
  }

  // ---------- 計画 ----------
  const KIND_LABEL = { fixed: "固定費", saving: "貯蓄・投資", oneoff: "単発", planned: "変動費の予定" };

  function outgoingRow(o, withActions) {
    return `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(o.name)}</div>
          <div class="li-sub">${Fmt.mdw(o.date)}・${KIND_LABEL[o.kind]}</div>
        </div>
        <div class="li-amount">-${Fmt.yen(o.amount)}</div>
        ${withActions && o.src === "oneoff" ? `
        <div class="li-actions">
          <button type="button" class="btn-icon" data-action="edit-oneoff" data-id="${o.id}">✎</button>
          <button type="button" class="btn-icon" data-action="delete-oneoff" data-id="${o.id}">🗑</button>
        </div>` : ""}
      </div>`;
  }

  function renderPlan(data, s) {
    const budgetInputs = data.categories.map((c) => {
      const ref = Calc.reference(data, s.key, c.id);
      const refHtml = ref
        ? `<div class="hint">過去の実績: 前回 ${Fmt.yen(ref.last)} ／ 直近${Math.min(3, ref.count)}回平均 ${Fmt.yen(ref.avg3)} ／ 最大 ${Fmt.yen(ref.max)}
             <button type="button" class="link-btn" data-action="fill-ref" data-cat="${c.id}" data-val="${ref.avg3}">平均を入れる</button></div>`
        : `<div class="hint">「実績」タブに過去の実績を入れると、予測の目安が出ます</div>`;
      return `
      <div class="field">
        <label><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</label>
        <input type="text" inputmode="numeric" class="comma-input-yen" data-bud="1" name="bud_${c.id}" value="${Fmt.inputYen(s.cyc.budgets[c.id] || 0)}">
        ${refHtml}
      </div>`;
    }).join("");
    const outflow = s.fixedTotal + s.oneOffTotal + s.budgetsTotal;

    const timeline = s.timeline.length
      ? s.timeline.map((ev) => `
        <div class="tl-item">
          <div class="tl-date">${Fmt.mdw(ev.date)}</div>
          <div class="tl-body">
            <div class="tl-name">${esc(ev.name)}<span class="tl-kind">${KIND_LABEL[ev.kind]}</span></div>
            <div class="tl-cum">ここまでの支出合計 ${Fmt.yen(ev.cumulative)}</div>
          </div>
          <div class="tl-amount">-${Fmt.yen(ev.amount)}</div>
        </div>`).join("")
      : `<div class="empty-state">予定はまだありません</div>`;

    return `
      ${cycleNav(data, s)}
      <form id="plan-form" data-fixed="${s.fixedTotal + s.oneOffTotal}">
        <div class="card">
          <h2>① 収入(この給料日)</h2>
          <div class="field" style="margin-bottom:0">
            <label>給料(手取り)</label>
            <input type="text" inputmode="numeric" class="comma-input-yen" name="income" value="${Fmt.inputYen(s.cyc.income)}">
            <div class="hint">${s.cyc.incomeSet ? "このサイクルだけの金額です" : "標準の給料(設定)を表示しています。変えるとこのサイクルだけに保存されます"}</div>
          </div>
        </div>

        <div class="card">
          <h2>② 固定費・単発の支出</h2>
          ${s.outgoings.length ? `<div class="list">${s.outgoings.map((o) => outgoingRow(o, true)).join("")}</div>` : `<div class="empty-state">固定費が未登録です。設定で登録してください。</div>`}
          <div class="total-row"><span>合計</span><b>-${Fmt.yen(s.fixedTotal + s.oneOffTotal)}</b></div>
          <button type="button" class="btn btn-secondary btn-block" style="margin-top:10px" data-action="add-oneoff">＋ 単発の支出を追加</button>
          <div class="hint" style="margin-top:6px">毎月の固定費(家賃・カード・NISAなど)は「設定」で登録します</div>
        </div>

        <div class="card">
          <h2>③ 変動費に使える額</h2>
          <div class="calc-line"><span>収入</span><span id="plan-income">${Fmt.yen(s.cyc.income)}</span></div>
          <div class="calc-line"><span>固定費・単発</span><span>-${Fmt.yen(s.fixedTotal + s.oneOffTotal)}</span></div>
          <div class="calc-line calc-result"><span>使える額</span><b id="plan-available" class="${neg(s.available)}">${Fmt.yen(s.available)}</b></div>
        </div>

        <div class="card">
          <h2>④ 変動費の予測(カテゴリ別)</h2>
          ${s.cyc.inherited && !s.cyc.hasPlan ? `<div class="hint" style="margin-bottom:10px">前回の配分を引き継いでいます。保存すると、このサイクルの配分になります。</div>` : ""}
          ${budgetInputs || `<div class="empty-state">カテゴリがありません。設定で追加してください。</div>`}
          <div class="calc-line"><span>配分の合計</span><span id="plan-budget-total">${Fmt.yen(s.budgetsTotal)}</span></div>
          <div class="calc-line calc-result"><span>未配分</span><b id="plan-unalloc" class="${neg(s.unallocated)}">${Fmt.yen(s.unallocated)}</b></div>
          <div class="hint">未配分がマイナスのときは、使える額より多く配分しています</div>
        </div>

        <div class="card deposit">
          <h2>銀行に入金する額</h2>
          <div class="big-number" id="plan-deposit">${Fmt.yen(s.budgetsTotal)}</div>
          <div class="sub-number">この金額を給料日にデビットカードの口座へ入金します</div>
        </div>

        <div class="card">
          <h2>この期間の支出予測(合計)</h2>
          <div class="calc-line"><span>固定費・単発</span><span>-${Fmt.yen(s.fixedTotal + s.oneOffTotal)}</span></div>
          <div class="calc-line"><span>変動費の予測</span><span id="plan-var-total">-${Fmt.yen(s.budgetsTotal)}</span></div>
          <div class="calc-line calc-result"><span>支出の予測</span><b id="plan-outflow">-${Fmt.yen(outflow)}</b></div>
          <div class="calc-line"><span>収入 − 支出 (残る額)</span><span id="plan-balance" class="${neg(s.cyc.income - outflow)}">${Fmt.yen(s.cyc.income - outflow)}</span></div>
        </div>

        <button type="submit" class="btn btn-primary btn-block">予測を保存</button>
      </form>

      <div class="section-title">予定の流れ(日付順)</div>
      <div class="card">
        ${timeline}
        <button type="button" class="btn btn-secondary btn-block" style="margin-top:10px" data-action="add-planned">＋ 変動費の予定を追加(交際費など)</button>
      </div>
    `;
  }

  // ---------- 設定 ----------
  function renderSettings(data) {
    const fixed = [...data.fixedItems].sort((a, b) => a.day - b.day);
    const fixedRows = fixed.map((it) => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(it.name)}</div>
          <div class="li-sub">毎月${it.day}日・${KIND_LABEL[it.kind || "fixed"]}</div>
        </div>
        <div class="li-amount">-${Fmt.yen(it.amount)}</div>
        <div class="li-actions">
          <button class="btn-icon" data-action="edit-fixed" data-id="${it.id}">✎</button>
          <button class="btn-icon" data-action="delete-fixed" data-id="${it.id}">🗑</button>
        </div>
      </div>`).join("");
    const catRows = data.categories.map((c) => `
      <div class="list-item">
        <div class="li-main"><div class="li-title"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</div></div>
        <div class="li-actions">
          <button class="btn-icon" data-action="edit-cat" data-id="${c.id}">✎</button>
          <button class="btn-icon" data-action="delete-cat" data-id="${c.id}">🗑</button>
        </div>
      </div>`).join("");
    const total = data.fixedItems.reduce((s, it) => s + it.amount, 0);

    return `
      <form id="settings-form">
        <div class="card">
          <h2>基本設定</h2>
          <div class="field">
            <label>給料日(毎月)</label>
            <input type="number" name="payday" min="1" max="31" inputmode="numeric" value="${data.settings.payday}" required>
          </div>
          <div class="field">
            <label>標準の給料(手取り・円)</label>
            <input type="text" inputmode="numeric" class="comma-input-yen" name="defaultIncome" value="${Fmt.inputYen(data.settings.defaultIncome)}">
            <div class="hint">新しいサイクルの収入の初期値になります</div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">保存</button>
        </div>
      </form>

      <div class="card">
        <h2>毎月の固定費・貯蓄投資</h2>
        ${fixedRows ? `<div class="list">${fixedRows}</div>` : `<div class="empty-state">家賃・カード支払い・NISA積立などを登録しましょう</div>`}
        <div class="total-row"><span>合計</span><b>-${Fmt.yen(total)}</b></div>
        <button class="btn btn-secondary btn-block" style="margin-top:10px" data-action="add-fixed">＋ 固定費を追加</button>
      </div>

      <div class="card">
        <h2>変動費のカテゴリ</h2>
        <div class="list">${catRows}</div>
        <button class="btn btn-secondary btn-block" style="margin-top:10px" data-action="add-cat">＋ カテゴリを追加</button>
      </div>

      <div class="card">
        <h2>データのバックアップ</h2>
        <p class="note">データはこの端末内のみに保存されています。機種変更などに備えて、ファイルに書き出しておくことをおすすめします。</p>
        <div class="fab-row">
          <button class="btn btn-secondary" style="flex:1" data-action="export-data">エクスポート</button>
          <button class="btn btn-secondary" style="flex:1" data-action="import-data">インポート</button>
        </div>
        <input type="file" id="import-file-input" accept="application/json,.json" class="hidden">
      </div>

      <div class="card">
        <h2>データ管理</h2>
        <button class="btn btn-danger btn-block" data-action="reset-data">すべてのデータを削除</button>
      </div>
    `;
  }

  // ---------- モーダル ----------
  function modal(title, formId, body) {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-sheet" data-action="noop">
          <h2>${title}</h2>
          <form id="${formId}">
            ${body}
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-action="close-modal" style="flex:1">キャンセル</button>
              <button type="submit" class="btn btn-primary" style="flex:1">保存</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  // e: 編集対象(なければ新規)。defaults: { date, planned }
  function entryModal(data, e, defaults) {
    const it = e || { date: defaults.date, catId: "", amount: 0, memo: "", planned: !!defaults.planned };
    const options = data.categories
      .map((c) => `<option value="${c.id}" ${c.id === it.catId ? "selected" : ""}>${esc(c.name)}</option>`)
      .join("");
    return modal(e ? "記録を編集" : it.planned ? "予定を追加" : "支出を記録", "entry-form", `
      <div class="field">
        <label>日付</label>
        <input type="date" name="date" value="${it.date}" required>
      </div>
      <div class="field">
        <label>カテゴリ</label>
        <select name="catId" required>
          <option value="" disabled ${it.catId ? "" : "selected"}>選択してください</option>
          ${options}
        </select>
      </div>
      <div class="field">
        <label>金額(円)</label>
        <input type="text" inputmode="numeric" class="comma-input-yen" name="amount" value="${it.amount ? Fmt.inputYen(it.amount) : ""}" placeholder="0" required>
      </div>
      <div class="field">
        <label>メモ(任意)</label>
        <input type="text" name="memo" value="${esc(it.memo || "")}" placeholder="例: 同僚とランチ">
      </div>
      <label class="toggle-row" style="margin-bottom:14px">
        <input type="checkbox" name="planned" ${it.planned ? "checked" : ""}>
        <span>予定(まだ使っていない)</span>
      </label>
      <input type="hidden" name="recordId" value="${it.id || ""}">`);
  }

  function fixedModal(it) {
    const f = it || { name: "", amount: 0, day: 1, kind: "fixed" };
    return modal(it ? "固定費を編集" : "固定費を追加", "fixed-form", `
      <div class="field">
        <label>名前</label>
        <input type="text" name="name" value="${esc(f.name)}" placeholder="例: 家賃・カード支払い・NISA積立" required>
      </div>
      <div class="field">
        <label>金額(円)</label>
        <input type="text" inputmode="numeric" class="comma-input-yen" name="amount" value="${f.amount ? Fmt.inputYen(f.amount) : ""}" placeholder="0" required>
      </div>
      <div class="field">
        <label>毎月の引き落とし日(1〜31。月末は31)</label>
        <input type="number" name="day" min="1" max="31" inputmode="numeric" value="${f.day}" required>
      </div>
      <div class="field">
        <label>種類</label>
        <select name="kind">
          <option value="fixed" ${f.kind !== "saving" ? "selected" : ""}>固定費</option>
          <option value="saving" ${f.kind === "saving" ? "selected" : ""}>貯蓄・投資</option>
        </select>
      </div>
      <input type="hidden" name="recordId" value="${f.id || ""}">`);
  }

  function oneOffModal(o, defaultDate) {
    const f = o || { name: "", amount: 0, date: defaultDate };
    return modal(o ? "単発の支出を編集" : "単発の支出を追加", "oneoff-form", `
      <div class="field">
        <label>名前</label>
        <input type="text" name="name" value="${esc(f.name)}" placeholder="例: 年会費・旅行代" required>
      </div>
      <div class="field">
        <label>金額(円)</label>
        <input type="text" inputmode="numeric" class="comma-input-yen" name="amount" value="${f.amount ? Fmt.inputYen(f.amount) : ""}" placeholder="0" required>
      </div>
      <div class="field">
        <label>日付</label>
        <input type="date" name="date" value="${f.date}" required>
      </div>
      <input type="hidden" name="recordId" value="${f.id || ""}">`);
  }

  function catModal(c) {
    return modal(c ? "カテゴリを編集" : "カテゴリを追加", "cat-form", `
      <div class="field">
        <label>名前</label>
        <input type="text" name="name" value="${esc(c ? c.name : "")}" placeholder="例: 交通費" maxlength="12" required>
      </div>
      <input type="hidden" name="recordId" value="${c ? c.id : ""}">`);
  }

  return {
    renderHome, renderRecords, renderPlan, renderSettings,
    entryModal, fixedModal, oneOffModal, catModal
  };
})();
