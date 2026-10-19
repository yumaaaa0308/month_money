(function () {
  let data = Storage.load();
  let currentView = "home";
  let cycleKey = Cycle.keyForDate(Fmt.todayIso(), data.settings.payday);
  const root = document.getElementById("view-root");
  const tabBar = document.getElementById("tab-bar");

  function persist() {
    return Storage.save(data);
  }
  function persistAndToast(msg) {
    const ok = persist();
    render();
    showToast(ok ? msg : "保存に失敗しました(端末の空き容量やプライベートブラウズ設定をご確認ください)");
  }
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function summary() {
    return Calc.summary(data, cycleKey, Fmt.todayIso());
  }

  function render() {
    tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === currentView);
    });
    switch (currentView) {
      case "home": root.innerHTML = Views.renderHome(data, summary()); break;
      case "plan": root.innerHTML = Views.renderPlan(data, summary()); break;
      case "records": root.innerHTML = Views.renderRecords(data, summary()); break;
      case "settings": root.innerHTML = Views.renderSettings(data); break;
    }
  }

  function goto(view) {
    currentView = view;
    render();
    window.scrollTo(0, 0);
  }

  function closeModal() {
    const modal = document.querySelector(".modal-backdrop");
    if (modal) modal.remove();
  }
  function openModal(html) {
    closeModal();
    document.body.insertAdjacentHTML("beforeend", html);
  }

  // 新規の支出の初期日付: 今のサイクルなら今日、別のサイクルならそのサイクルの開始日
  function defaultEntryDate() {
    const s = summary();
    return s.isCurrent ? Fmt.todayIso() : s.start;
  }

  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) goto(btn.dataset.view);
  });

  // ---- クリック ----
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.id;

    switch (el.dataset.action) {
      case "goto": goto(el.dataset.view); break;
      case "close-modal": closeModal(); break;
      case "cycle-prev": cycleKey = Cycle.shift(cycleKey, -1); render(); break;
      case "cycle-next": cycleKey = Cycle.shift(cycleKey, 1); render(); break;
      case "cycle-today":
        cycleKey = Cycle.keyForDate(Fmt.todayIso(), data.settings.payday);
        render();
        break;

      case "add-entry":
        openModal(Views.entryModal(data, null, { date: defaultEntryDate(), planned: false }));
        break;
      case "add-planned":
        openModal(Views.entryModal(data, null, { date: defaultEntryDate(), planned: true }));
        break;
      case "edit-entry":
        openModal(Views.entryModal(data, data.entries.find((x) => x.id === id), {}));
        break;
      case "delete-entry":
        if (confirm("この記録を削除しますか？")) {
          data.entries = data.entries.filter((x) => x.id !== id);
          persistAndToast("削除しました");
        }
        break;
      case "confirm-entry": {
        // 予定を「使った」にする。未来の日付なら今日に直す
        const entry = data.entries.find((x) => x.id === id);
        if (entry) {
          entry.planned = false;
          if (entry.date > Fmt.todayIso()) entry.date = Fmt.todayIso();
          persistAndToast("使った記録にしました");
        }
        break;
      }

      case "add-fixed": openModal(Views.fixedModal(null)); break;
      case "edit-fixed": openModal(Views.fixedModal(data.fixedItems.find((x) => x.id === id))); break;
      case "delete-fixed":
        if (confirm("この固定費を削除しますか？")) {
          data.fixedItems = data.fixedItems.filter((x) => x.id !== id);
          persistAndToast("削除しました");
        }
        break;

      case "add-oneoff": openModal(Views.oneOffModal(null, summary().start)); break;
      case "edit-oneoff": {
        const o = (data.cycles[cycleKey] || {}).oneOff?.find((x) => x.id === id);
        openModal(Views.oneOffModal(o, summary().start));
        break;
      }
      case "delete-oneoff":
        if (confirm("この単発の支出を削除しますか？")) {
          const c = data.cycles[cycleKey];
          if (c) c.oneOff = (c.oneOff || []).filter((x) => x.id !== id);
          persistAndToast("削除しました");
        }
        break;

      case "add-cat": openModal(Views.catModal(null)); break;
      case "edit-cat": openModal(Views.catModal(data.categories.find((x) => x.id === id))); break;
      case "delete-cat":
        if (confirm("このカテゴリを削除しますか？\n(過去の記録は「削除済みカテゴリ」として残ります)")) {
          data.categories = data.categories.filter((x) => x.id !== id);
          persistAndToast("削除しました");
        }
        break;

      case "export-data": {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `budget-backup-${Fmt.todayIso()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("バックアップを書き出しました");
        break;
      }
      case "import-data": {
        const input = document.getElementById("import-file-input");
        if (input) input.click();
        break;
      }
      case "reset-data":
        if (confirm("すべてのデータを削除します。よろしいですか？この操作は取り消せません。")) {
          data = Storage.defaultData();
          cycleKey = Cycle.keyForDate(Fmt.todayIso(), data.settings.payday);
          persistAndToast("データを削除しました");
        }
        break;
    }
  });

  // ---- 金額入力欄の桁区切り(フォーカスが外れたとき) ----
  document.addEventListener("focusout", (e) => {
    if (!e.target.classList || !e.target.classList.contains("comma-input-yen")) return;
    e.target.value = e.target.value.trim() === "" ? "" : Fmt.inputYen(Fmt.num(e.target.value));
  });

  // ---- 計画フォームの合計をリアルタイムで更新 ----
  document.addEventListener("input", (e) => {
    const form = e.target.closest && e.target.closest("#plan-form");
    if (!form) return;
    const fixed = Number(form.dataset.fixed) || 0;
    const income = Fmt.num(form.elements.income.value);
    let budgets = 0;
    form.querySelectorAll("[data-bud]").forEach((i) => { budgets += Fmt.num(i.value); });
    const available = income - fixed;
    const unalloc = available - budgets;
    const set = (id, text, isNeg) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      if (isNeg !== undefined) el.classList.toggle("neg", isNeg);
    };
    set("plan-income", Fmt.yen(income));
    set("plan-available", Fmt.yen(available), available < 0);
    set("plan-budget-total", Fmt.yen(budgets));
    set("plan-unalloc", Fmt.yen(unalloc), unalloc < 0);
    set("plan-deposit", Fmt.yen(budgets));
  });

  // ---- バックアップの読み込み ----
  document.addEventListener("change", (e) => {
    if (e.target.id !== "import-file-input") return;
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        alert("ファイルの形式が正しくありません(JSONとして読み込めませんでした)。");
        return;
      }
      if (!parsed || typeof parsed !== "object" || !parsed.settings || !Array.isArray(parsed.categories)) {
        alert("このアプリのバックアップファイルではないようです。");
        return;
      }
      if (!confirm("現在のデータを、選択したファイルの内容で置き換えます。よろしいですか？")) return;
      localStorage.setItem(Storage.KEY, JSON.stringify(parsed));
      data = Storage.load();
      cycleKey = Cycle.keyForDate(Fmt.todayIso(), data.settings.payday);
      persistAndToast("データを読み込みました");
    };
    reader.onerror = () => alert("ファイルの読み込みに失敗しました。");
    reader.readAsText(file);
  });

  // ---- フォーム送信 ----
  document.addEventListener("submit", (e) => {
    // フォーム内にname="id"のinputがあるとform.idが乗っ取られるため、属性から読む
    const formId = e.target.getAttribute && e.target.getAttribute("id");
    const fd = new FormData(e.target);
    const upsert = (arr, item) => {
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) arr[i] = item;
      else arr.push(item);
    };

    if (formId === "plan-form") {
      e.preventDefault();
      const budgets = {};
      data.categories.forEach((c) => { budgets[c.id] = Math.round(Fmt.num(fd.get("bud_" + c.id))); });
      const prev = data.cycles[cycleKey] || {};
      data.cycles[cycleKey] = { ...prev, income: Math.round(Fmt.num(fd.get("income"))), budgets, oneOff: prev.oneOff || [] };
      persistAndToast("計画を保存しました");
    }

    if (formId === "entry-form") {
      e.preventDefault();
      const entry = {
        id: fd.get("recordId") || Storage.uid(),
        date: String(fd.get("date")),
        catId: String(fd.get("catId") || ""),
        amount: Math.round(Fmt.num(fd.get("amount"))),
        memo: String(fd.get("memo") || "").trim(),
        planned: fd.get("planned") === "on"
      };
      if (!entry.date || !entry.catId || !entry.amount) return;
      upsert(data.entries, entry);
      closeModal();
      persistAndToast(entry.planned ? "予定を保存しました" : "記録しました");
    }

    if (formId === "fixed-form") {
      e.preventDefault();
      const item = {
        id: fd.get("recordId") || Storage.uid(),
        name: String(fd.get("name") || "").trim(),
        amount: Math.round(Fmt.num(fd.get("amount"))),
        day: Math.min(31, Math.max(1, parseInt(fd.get("day"), 10) || 1)),
        kind: fd.get("kind") === "saving" ? "saving" : "fixed"
      };
      if (!item.name || !item.amount) return;
      upsert(data.fixedItems, item);
      closeModal();
      persistAndToast("固定費を保存しました");
    }

    if (formId === "oneoff-form") {
      e.preventDefault();
      const item = {
        id: fd.get("recordId") || Storage.uid(),
        name: String(fd.get("name") || "").trim(),
        amount: Math.round(Fmt.num(fd.get("amount"))),
        date: String(fd.get("date"))
      };
      if (!item.name || !item.amount || !item.date) return;
      const c = data.cycles[cycleKey] || (data.cycles[cycleKey] = {});
      c.oneOff = c.oneOff || [];
      upsert(c.oneOff, item);
      closeModal();
      persistAndToast("保存しました");
    }

    if (formId === "cat-form") {
      e.preventDefault();
      const name = String(fd.get("name") || "").trim();
      if (!name) return;
      const id = fd.get("recordId");
      if (id) {
        const c = data.categories.find((x) => x.id === id);
        if (c) c.name = name;
      } else {
        data.categories.push({ id: Storage.uid(), name, color: PALETTE[data.categories.length % PALETTE.length] });
      }
      closeModal();
      persistAndToast("カテゴリを保存しました");
    }

    if (formId === "settings-form") {
      e.preventDefault();
      data.settings.payday = Math.min(31, Math.max(1, parseInt(fd.get("payday"), 10) || 25));
      data.settings.defaultIncome = Math.round(Fmt.num(fd.get("defaultIncome")));
      cycleKey = Cycle.keyForDate(Fmt.todayIso(), data.settings.payday);
      persistAndToast("設定を保存しました");
    }
  });

  // ---- Service Worker(オフライン対応・更新の自動反映) ----
  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {});
    });
  }

  render();
})();
