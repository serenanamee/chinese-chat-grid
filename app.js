// 華語聊天九宮格：畫面渲染與互動邏輯。
// 資料來自 data.js，拼音顯示透過 pinyin.js 的 ZhPinyin.renderMarkup()，
// 筆記存取透過 notes.js 的 ZhNotes，這裡只負責 DOM 渲染與事件綁定。

(function () {
  "use strict";

  const grid = document.getElementById("grid");
  const modalOverlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalCloseBtn = document.getElementById("modal-close");
  const tplCard = document.getElementById("tpl-card");
  const tplQuestionBlock = document.getElementById("tpl-question-block");

  let currentTopicId = null;
  let lastFocusedBeforeModal = null;
  let highlightTimer = null;

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function setZh(el, text) {
    el.innerHTML = ZhPinyin.renderMarkup(text);
  }

  function getTopic(topicId) {
    return TOPICS.find((t) => t.id === topicId);
  }

  function cardEl(topicId) {
    return grid.querySelector('.card[data-topic-id="' + topicId + '"]');
  }

  // ---------- 靜態文字（標題、副標題、按鈕） ----------
  function renderStaticText() {
    setZh(document.getElementById("page-title"), "翻一張卡，開始說中文！");
    setZh(
      document.getElementById("page-subtitle"),
      "選擇一個主題，翻開卡片，回答問題並記下新的詞語。"
    );
    setZh(document.getElementById("btn-random-topic"), "隨機選主題");
    setZh(document.getElementById("btn-random-question"), "隨機選問題");
    setZh(document.getElementById("btn-restart"), "重新開始");
    setZh(document.getElementById("btn-clear-all"), "清除全部筆記");
  }

  // ---------- 九宮格 ----------
  function progressText(done, total) {
    return done === total ? "✓ 已完成" : done + " / " + total;
  }

  function refreshCardProgress(topicId) {
    const topic = getTopic(topicId);
    const card = cardEl(topicId);
    if (!topic || !card) return;
    const qIds = topic.questions.map((q) => q.id);
    const { done, total } = ZhNotes.getTopicProgress(topicId, qIds);
    const progressEl = card.querySelector(".card-progress");
    setZh(progressEl, progressText(done, total));
    card.classList.toggle("is-complete", done === total);
  }

  function renderGrid() {
    grid.innerHTML = "";
    for (const topic of TOPICS) {
      const node = tplCard.content.firstElementChild.cloneNode(true);
      node.classList.add("card--" + topic.color);
      node.dataset.topicId = topic.id;
      node.querySelector(".card-emoji").textContent = topic.emoji;
      setZh(node.querySelector(".card-title"), topic.zh);
      node.addEventListener("click", () => openTopic(topic.id));
      grid.appendChild(node);
      refreshCardProgress(topic.id);
    }
  }

  // ---------- 筆記區塊 ----------
  function buildNoteSection(topicId, question, block) {
    const textarea = block.querySelector(".note-textarea");
    const label = block.querySelector(".note-label");
    const preview = block.querySelector(".note-preview");
    const status = block.querySelector(".note-status");
    const clearBtn = block.querySelector(".note-clear-btn");

    const inputId = "note-input-" + question.id;
    textarea.id = inputId;
    label.setAttribute("for", inputId);
    setZh(label, "我的筆記");
    clearBtn.setAttribute("aria-label", "清除「" + question.zh + "」這一題的筆記");

    const existing = ZhNotes.getNote(topicId, question.id);
    textarea.value = existing;
    updatePreview(preview, existing);
    status.textContent = existing.trim() ? "已儲存" : "";

    const commit = ZhPinyin.debounce(function () {
      const text = textarea.value;
      ZhNotes.saveNote(topicId, question.id, text);
      status.textContent = text.trim() ? "已儲存" : "";
      refreshCardProgress(topicId);
    }, 300);

    textarea.addEventListener("input", function () {
      updatePreview(preview, textarea.value);
      status.textContent = textarea.value.trim() ? "儲存中…" : "";
      commit();
    });

    clearBtn.addEventListener("click", function () {
      if (!textarea.value.trim()) return;
      const ok = window.confirm("確定要清除這一題的筆記嗎？此動作無法復原。");
      if (!ok) return;
      textarea.value = "";
      ZhNotes.clearNote(topicId, question.id);
      updatePreview(preview, "");
      status.textContent = "";
      refreshCardProgress(topicId);
      textarea.focus();
    });
  }

  function updatePreview(previewEl, text) {
    if (!text || !text.trim()) {
      previewEl.innerHTML = "";
      return;
    }
    previewEl.innerHTML = ZhPinyin.renderMarkup(text);
  }

  // ---------- Modal ----------
  function renderModalBody(topic) {
    modalBody.innerHTML = "";
    topic.questions.forEach((q, i) => {
      const block = tplQuestionBlock.content.firstElementChild.cloneNode(true);
      block.dataset.questionId = q.id;
      setZh(block.querySelector(".question-text"), (i + 1) + ". " + q.zh);
      buildNoteSection(topic.id, q, block);
      modalBody.appendChild(block);
    });
  }

  function focusableElements() {
    return Array.from(
      modal.querySelectorAll(
        'button, textarea, [href], input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const items = focusableElements();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    } else {
      trapFocus(e);
    }
  }

  function openTopic(topicId, opts) {
    const topic = getTopic(topicId);
    if (!topic) return;
    currentTopicId = topicId;
    lastFocusedBeforeModal = document.activeElement;

    setZh(modalTitle, topic.zh);
    renderModalBody(topic);

    modalOverlay.hidden = false;
    document.addEventListener("keydown", onModalKeydown, true);
    modalCloseBtn.focus();

    if (opts && opts.scrollToQuestionId) {
      const target = modalBody.querySelector(
        '[data-question-id="' + opts.scrollToQuestionId + '"]'
      );
      if (target) {
        target.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    }
  }

  function closeModal() {
    modalOverlay.hidden = true;
    modalBody.innerHTML = "";
    document.removeEventListener("keydown", onModalKeydown, true);
    currentTopicId = null;
    if (lastFocusedBeforeModal && document.body.contains(lastFocusedBeforeModal)) {
      lastFocusedBeforeModal.focus();
    }
  }

  modalCloseBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  // ---------- 翻牌動畫（點卡片時的短暫效果） ----------
  function playFlip(card, then) {
    if (prefersReducedMotion()) {
      then();
      return;
    }
    card.classList.add("is-flipping");
    window.setTimeout(function () {
      card.classList.remove("is-flipping");
      then();
    }, 160);
  }

  function highlightCard(card) {
    clearHighlights();
    card.classList.add("is-highlighted");
    highlightTimer = window.setTimeout(function () {
      card.classList.remove("is-highlighted");
    }, 1400);
  }

  function clearHighlights() {
    if (highlightTimer) {
      window.clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    grid.querySelectorAll(".card.is-highlighted").forEach((c) => {
      c.classList.remove("is-highlighted");
    });
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- 工具列按鈕 ----------
  document.getElementById("btn-random-topic").addEventListener("click", function () {
    const topic = randomItem(TOPICS);
    const card = cardEl(topic.id);
    highlightCard(card);
    const delay = prefersReducedMotion() ? 0 : 500;
    window.setTimeout(function () {
      playFlip(card, function () {
        openTopic(topic.id);
      });
    }, delay);
  });

  document.getElementById("btn-random-question").addEventListener("click", function () {
    if (currentTopicId) {
      const topic = getTopic(currentTopicId);
      const q = randomItem(topic.questions);
      const block = modalBody.querySelector('[data-question-id="' + q.id + '"]');
      if (block) {
        modalBody.querySelectorAll(".question-block.is-highlighted").forEach((b) =>
          b.classList.remove("is-highlighted")
        );
        block.classList.add("is-highlighted");
        block.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
        window.setTimeout(() => block.classList.remove("is-highlighted"), 1400);
      }
      return;
    }
    const topic = randomItem(TOPICS);
    const q = randomItem(topic.questions);
    const card = cardEl(topic.id);
    highlightCard(card);
    const delay = prefersReducedMotion() ? 0 : 500;
    window.setTimeout(function () {
      playFlip(card, function () {
        openTopic(topic.id, { scrollToQuestionId: q.id });
      });
    }, delay);
  });

  document.getElementById("btn-restart").addEventListener("click", function () {
    closeModal();
    clearHighlights();
    grid.scrollIntoView({ block: "start", behavior: "auto" });
  });

  document.getElementById("btn-clear-all").addEventListener("click", function () {
    const step1 = window.confirm(
      "這會清除全部 9 個主題、45 題的筆記，且無法復原。確定要繼續嗎？"
    );
    if (!step1) return;
    const step2 = window.confirm("再次確認：真的要刪除所有筆記嗎？此動作無法復原。");
    if (!step2) return;
    ZhNotes.clearAllNotes(TOPICS);
    if (currentTopicId) {
      renderModalBody(getTopic(currentTopicId));
    }
    TOPICS.forEach((t) => refreshCardProgress(t.id));
  });

  // ---------- 初始化 ----------
  ZhPinyin.init();
  renderStaticText();
  renderGrid();
})();
