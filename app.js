// 商務中文拼音標注：讀取使用者貼上的文章，即時在每個中文字上方顯示拼音。
// 拼音顯示透過 pinyin.js 的 ZhPinyin.renderMarkup()，草稿與字級偏好透過 draft-store.js 的 ZhDraft 存取，
// 範例文章資料在 samples.js。這裡只負責 DOM 渲染與事件綁定。

(function () {
  "use strict";

  const input = document.getElementById("article-input");
  const output = document.getElementById("article-output");
  const outputPlaceholder = document.getElementById("output-placeholder");
  const charCount = document.getElementById("char-count");
  const picker = document.getElementById("picker");
  const pickerBtn = document.getElementById("picker-btn");
  const pickerBtnText = document.getElementById("picker-btn-text");
  const pickerPanel = document.getElementById("picker-panel");
  const pickerList = document.getElementById("picker-list");
  const taughtProgress = document.getElementById("taught-progress");
  const taughtReset = document.getElementById("taught-reset");
  const currentTaught = document.getElementById("current-taught");
  const currentTaughtBox = document.getElementById("current-taught-box");
  const currentTaughtText = document.getElementById("current-taught-text");
  const btnCopy = document.getElementById("btn-copy");
  const btnClear = document.getElementById("btn-clear");
  const sizeBtns = Array.from(document.querySelectorAll(".size-btn"));
  const vocabList = document.getElementById("vocab-list");
  const vocabPlaceholder = document.getElementById("vocab-placeholder");

  let loadedSample = null;
  let taughtIds = new Set(ZhDraft.getTaughtIds());
  const PICKER_PLACEHOLDER = "— 選擇範例文章 —";

  function setZh(el, text) {
    el.innerHTML = ZhPinyin.renderMarkup(text);
  }

  // ---------- 靜態文字（標題、標籤、按鈕） ----------
  function renderStaticText() {
    setZh(document.getElementById("page-title"), "商務中文拼音標注");
    setZh(
      document.getElementById("page-subtitle"),
      "貼上文章，自動在每個中文字上方顯示拼音，適合商務中文閱讀練習。"
    );
    setZh(document.getElementById("sample-label"), "範例文章");
    setZh(document.getElementById("size-label"), "字級");
    setZh(document.getElementById("input-label"), "輸入文章");
    setZh(document.getElementById("output-label"), "拼音標注");
    setZh(btnCopy, "複製純文字");
    setZh(btnClear, "清空");
    setZh(outputPlaceholder, "在上方貼上或輸入文章，這裡會即時顯示帶拼音的版本。");
    setZh(document.getElementById("vocab-label"), "生字重點");
    setZh(vocabPlaceholder, "選擇上方的範例文章，這裡會列出該篇建議練習的生字與例句。");
  }

  // ---------- 範例文章選單（可打勾標記「已上過」） ----------
  // 原生 <select> 無法放勾選框、也不能可靠地替選項換顏色（macOS 會忽略 option 樣式），
  // 所以改成自訂的下拉面板：點標題載入文章，點左邊勾選框標記已上過。
  function renderSampleOptions() {
    pickerList.innerHTML = "";
    let currentCategory = null;
    let groupEl = null;
    SAMPLES.forEach((s) => {
      if (s.category !== currentCategory) {
        currentCategory = s.category;
        groupEl = document.createElement("div");
        groupEl.className = "picker-group";
        groupEl.setAttribute("role", "group");
        const head = document.createElement("div");
        head.className = "picker-group-head";
        head.dataset.category = s.category;
        groupEl.setAttribute("aria-label", s.category);
        groupEl.appendChild(head);
        pickerList.appendChild(groupEl);
      }
      const row = document.createElement("div");
      row.className = "picker-row";
      row.dataset.id = s.id;

      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "picker-check";
      box.dataset.id = s.id;
      box.setAttribute("aria-label", "標記「" + s.label + "」已上過");

      const item = document.createElement("button");
      item.type = "button";
      item.className = "picker-item";
      item.dataset.id = s.id;
      item.textContent = s.label;
      const en = document.createElement("span");
      en.className = "picker-item-en";
      en.textContent = s.labelEn;
      item.appendChild(en);

      row.appendChild(box);
      row.appendChild(item);
      groupEl.appendChild(row);
    });
    refreshTaughtUI();
  }

  function refreshTaughtUI() {
    pickerList.querySelectorAll(".picker-row").forEach((row) => {
      const taught = taughtIds.has(row.dataset.id);
      row.classList.toggle("is-taught", taught);
      row.querySelector(".picker-check").checked = taught;
    });
    pickerList.querySelectorAll(".picker-group").forEach((groupEl) => {
      const rows = groupEl.querySelectorAll(".picker-row");
      const done = groupEl.querySelectorAll(".picker-row.is-taught").length;
      const head = groupEl.querySelector(".picker-group-head");
      head.textContent = head.dataset.category + "　" + done + "/" + rows.length;
      groupEl.classList.toggle("is-all-taught", done === rows.length);
    });
    const total = SAMPLES.length;
    const done = SAMPLES.filter((s) => taughtIds.has(s.id)).length;
    taughtProgress.textContent = "已上過 " + done + " / " + total;
    taughtReset.hidden = done === 0;

    if (loadedSample) {
      const taught = taughtIds.has(loadedSample.id);
      currentTaught.hidden = false;
      currentTaught.classList.toggle("is-taught", taught);
      currentTaughtBox.checked = taught;
      currentTaughtText.textContent = taught ? "這篇已上過 ✓" : "這篇已上過";
      pickerBtnText.textContent = loadedSample.label;
      pickerBtn.classList.toggle("is-taught", taught);
    } else {
      currentTaught.hidden = true;
      pickerBtnText.textContent = PICKER_PLACEHOLDER;
      pickerBtn.classList.remove("is-taught");
    }
  }

  function setTaught(id, taught) {
    if (taught) taughtIds.add(id);
    else taughtIds.delete(id);
    ZhDraft.saveTaughtIds(Array.from(taughtIds));
    refreshTaughtUI();
    if (taughtSync.onLocalChange) taughtSync.onLocalChange({ id, taught });
  }

  // 給 taught-sync.js（Firebase 雲端同步）用的介面：雲端有變動時用 replaceAll 整份覆蓋畫面，
  // 本機勾選／清除時透過 onLocalChange 通知它寫回雲端。沒登入或沒設定 Firebase 時就只存本機。
  const taughtSync = {
    onLocalChange: null,
    getIds: () => Array.from(taughtIds),
    replaceAll(ids) {
      taughtIds = new Set(ids);
      ZhDraft.saveTaughtIds(ids);
      refreshTaughtUI();
    },
  };
  window.ZhTaughtSync = taughtSync;

  function openPicker() {
    pickerPanel.hidden = false;
    pickerBtn.setAttribute("aria-expanded", "true");
    const target =
      (loadedSample && pickerList.querySelector('.picker-item[data-id="' + loadedSample.id + '"]')) ||
      pickerList.querySelector(".picker-item");
    if (target) {
      target.scrollIntoView({ block: "nearest" });
      target.focus();
    }
  }

  function closePicker(returnFocus) {
    if (pickerPanel.hidden) return;
    pickerPanel.hidden = true;
    pickerBtn.setAttribute("aria-expanded", "false");
    if (returnFocus) pickerBtn.focus();
  }

  function loadSample(sample) {
    input.value = sample.text;
    loadedSample = sample;
    renderOutput();
    updateCharCount();
    renderVocab(sample);
    refreshTaughtUI();
    ZhDraft.saveDraft(input.value);
  }

  // ---------- 字數統計（只算中文字） ----------
  function countHanChars(text) {
    const matches = text.match(/[㐀-䶿一-鿿]/g);
    return matches ? matches.length : 0;
  }

  function updateCharCount() {
    charCount.textContent = countHanChars(input.value) + " 字";
  }

  // ---------- 拼音輸出 ----------
  function renderOutput() {
    const text = input.value;
    if (!text.trim()) {
      output.innerHTML = "";
      outputPlaceholder.hidden = false;
      return;
    }
    outputPlaceholder.hidden = true;
    output.innerHTML = ZhPinyin.renderMarkup(text);
  }

  // ---------- 生字重點 ----------
  function renderVocab(sample) {
    vocabList.innerHTML = "";
    if (!sample || !sample.vocab || !sample.vocab.length) {
      vocabPlaceholder.hidden = false;
      return;
    }
    vocabPlaceholder.hidden = true;
    sample.vocab.forEach((v) => {
      const item = document.createElement("div");
      item.className = "vocab-item";

      const wordEl = document.createElement("div");
      wordEl.className = "vocab-word";
      setZh(wordEl, v.word);

      const meaningEl = document.createElement("div");
      meaningEl.className = "vocab-meaning";
      setZh(meaningEl, v.meaning);

      const exampleWrap = document.createElement("div");
      exampleWrap.className = "vocab-example";
      const exampleLabel = document.createElement("div");
      exampleLabel.className = "vocab-example-label";
      setZh(exampleLabel, "例句");
      const exampleList = document.createElement("ol");
      exampleList.className = "vocab-example-list";
      v.examples.forEach((ex) => {
        const li = document.createElement("li");
        setZh(li, ex);
        exampleList.appendChild(li);
      });
      exampleWrap.appendChild(exampleLabel);
      exampleWrap.appendChild(exampleList);

      item.appendChild(wordEl);
      item.appendChild(meaningEl);
      item.appendChild(exampleWrap);
      vocabList.appendChild(item);
    });
  }

  const commit = ZhPinyin.debounce(function () {
    renderOutput();
    updateCharCount();
    ZhDraft.saveDraft(input.value);
  }, 150);

  input.addEventListener("input", function () {
    // 使用者親自打字／貼上代表內容已經跟範例文章不同了，生字清單不再對得上，先收起來。
    if (loadedSample) {
      loadedSample = null;
      renderVocab(null);
      refreshTaughtUI();
    }
    commit();
  });

  pickerBtn.addEventListener("click", function () {
    if (pickerPanel.hidden) openPicker();
    else closePicker(false);
  });

  pickerList.addEventListener("click", function (e) {
    const item = e.target.closest(".picker-item");
    if (!item) return;
    const sample = SAMPLES.find((s) => s.id === item.dataset.id);
    if (!sample) return;
    loadSample(sample);
    closePicker(false);
    input.focus();
  });

  pickerList.addEventListener("change", function (e) {
    if (!e.target.classList.contains("picker-check")) return;
    setTaught(e.target.dataset.id, e.target.checked);
  });

  currentTaughtBox.addEventListener("change", function () {
    if (loadedSample) setTaught(loadedSample.id, currentTaughtBox.checked);
  });

  taughtReset.addEventListener("click", function () {
    const ok = window.confirm("確定要清除所有「已上過」的勾選嗎？");
    if (!ok) return;
    taughtIds = new Set();
    ZhDraft.saveTaughtIds([]);
    refreshTaughtUI();
    if (taughtSync.onLocalChange) taughtSync.onLocalChange({ reset: true });
  });

  document.addEventListener("click", function (e) {
    if (!picker.contains(e.target)) closePicker(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !pickerPanel.hidden) closePicker(true);
  });

  // ---------- 複製 / 清空 ----------
  let flashTimer = null;
  function flashLabel(btn, text, restoreFn) {
    btn.textContent = text;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(restoreFn, 1200);
  }

  btnCopy.addEventListener("click", async function () {
    const text = input.value;
    if (!text.trim()) return;
    const restore = function () {
      setZh(btnCopy, "複製純文字");
    };
    try {
      await navigator.clipboard.writeText(text);
      flashLabel(btnCopy, "已複製", restore);
    } catch (e) {
      // clipboard API 不可用時（例如非 https 環境），退回選取文字讓使用者手動複製
      input.focus();
      input.select();
      flashLabel(btnCopy, "請按 Ctrl/Cmd+C", restore);
    }
  });

  btnClear.addEventListener("click", function () {
    if (!input.value.trim()) return;
    const ok = window.confirm("確定要清空目前的文章嗎？此動作無法復原。");
    if (!ok) return;
    input.value = "";
    loadedSample = null;
    renderOutput();
    updateCharCount();
    renderVocab(null);
    refreshTaughtUI();
    ZhDraft.saveDraft("");
    input.focus();
  });

  // ---------- 字級切換 ----------
  function applyFontSize(size) {
    document.body.classList.remove("size-sm", "size-md", "size-lg");
    document.body.classList.add("size-" + size);
    sizeBtns.forEach((b) => {
      const active = b.dataset.size === size;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  sizeBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const size = btn.dataset.size;
      applyFontSize(size);
      ZhDraft.saveFontSize(size);
    });
  });

  // ---------- 初始化 ----------
  ZhPinyin.init();
  renderStaticText();
  renderSampleOptions();
  applyFontSize(ZhDraft.getFontSize());
  input.value = ZhDraft.getDraft();
  // 重新整理頁面後，若草稿剛好就是某篇範例原文，恢復該篇的生字與「已上過」勾選框。
  loadedSample = SAMPLES.find((s) => s.text === input.value) || null;
  renderOutput();
  updateCharCount();
  renderVocab(loadedSample);
  refreshTaughtUI();
})();
