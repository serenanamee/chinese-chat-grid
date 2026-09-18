// 商務中文拼音標注：讀取使用者貼上的文章，即時在每個中文字上方顯示拼音。
// 拼音顯示透過 pinyin.js 的 ZhPinyin.renderMarkup()，草稿與字級偏好透過 draft-store.js 的 ZhDraft 存取，
// 範例文章資料在 samples.js。這裡只負責 DOM 渲染與事件綁定。

(function () {
  "use strict";

  const input = document.getElementById("article-input");
  const output = document.getElementById("article-output");
  const outputPlaceholder = document.getElementById("output-placeholder");
  const charCount = document.getElementById("char-count");
  const sampleSelect = document.getElementById("sample-select");
  const btnCopy = document.getElementById("btn-copy");
  const btnClear = document.getElementById("btn-clear");
  const sizeBtns = Array.from(document.querySelectorAll(".size-btn"));

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
  }

  function renderSampleOptions() {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— 選擇範例文章 —";
    sampleSelect.appendChild(placeholder);

    let currentGroup = null;
    let currentCategory = null;
    SAMPLES.forEach((s) => {
      if (s.category !== currentCategory) {
        currentCategory = s.category;
        currentGroup = document.createElement("optgroup");
        currentGroup.label = currentCategory;
        sampleSelect.appendChild(currentGroup);
      }
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      currentGroup.appendChild(opt);
    });
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

  const commit = ZhPinyin.debounce(function () {
    renderOutput();
    updateCharCount();
    ZhDraft.saveDraft(input.value);
  }, 150);

  input.addEventListener("input", commit);

  sampleSelect.addEventListener("change", function () {
    const sample = SAMPLES.find((s) => s.id === sampleSelect.value);
    sampleSelect.value = "";
    if (!sample) return;
    input.value = sample.text;
    renderOutput();
    updateCharCount();
    ZhDraft.saveDraft(input.value);
    input.focus();
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
    renderOutput();
    updateCharCount();
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
  renderOutput();
  updateCharCount();
})();
