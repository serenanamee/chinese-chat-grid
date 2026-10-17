// 學習筆記本：學生用 Google 帳號登入，把不會的東西放上來，全班一起回覆討論。
// 資料存在 Firebase Firestore（notes／notes/{id}/replies／teachers），誰能讀寫由 firestore.rules 把關。
// 純邏輯（文字檢查、時間格式、篩選）在 notebook-logic.js；這裡負責 Firebase 串接與 DOM。

const FIREBASE_VERSION = "10.12.2";
const SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";
const PINYIN_KEY = "zhArticleReader:notebookPinyin";
const { LIMITS, cleanText, cleanName, formatRelativeTime, filterNotes } = window.ZhNotebook;

const $ = (id) => document.getElementById(id);
const els = {
  btnLogin: $("btn-login"),
  userChip: $("user-chip"),
  userAvatar: $("user-avatar"),
  userName: $("user-name"),
  userTeacher: $("user-teacher"),
  btnLogout: $("btn-logout"),
  btnPinyin: $("btn-pinyin-toggle"),
  setupNotice: $("setup-notice"),
  loginNotice: $("login-notice"),
  composer: $("composer"),
  noteInput: $("note-input"),
  noteSample: $("note-sample"),
  noteCount: $("note-count"),
  btnPost: $("btn-post"),
  board: $("board"),
  noteList: $("note-list"),
  noteEmpty: $("note-empty"),
  toast: $("toast"),
  tabs: Array.from(document.querySelectorAll(".filter-tab")),
};

const state = {
  fb: null, // { auth, db, api }
  user: null,
  isTeacher: false,
  notes: [],
  filter: "all",
  openReplies: new Map(), // noteId -> { unsubscribe, replies }
  unsubscribeNotes: null,
};

// samples.js 用 const 宣告，不會掛在 window 上，但模組仍可直接用名稱取用
const SAMPLE_LIST = typeof SAMPLES !== "undefined" ? SAMPLES : [];
const SAMPLE_TITLES = new Map(SAMPLE_LIST.map((s) => [s.id, s.label]));

// ---------- 小工具 ----------
function setZh(el, text) {
  el.innerHTML = ZhPinyin.renderMarkup(text);
}

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 3200);
}

function errorMessage(err) {
  const code = (err && err.code) || "";
  if (code.includes("permission-denied")) return "沒有權限做這件事（可能是登入過期，請重新登入）。";
  if (code.includes("popup-closed")) return "登入視窗被關掉了，再試一次。";
  if (code.includes("unauthorized-domain")) return "這個網址還沒加進 Firebase 的授權網域。";
  if (code.includes("unavailable") || code.includes("network")) return "網路好像不穩，稍後再試。";
  return "發生錯誤：" + (err && err.message ? err.message : "未知錯誤");
}

function avatarEl(name, photo) {
  const span = document.createElement("span");
  span.className = "avatar";
  span.setAttribute("aria-hidden", "true");
  if (typeof photo === "string" && photo.startsWith("https://")) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      span.textContent = (name || "?").slice(0, 1);
    });
    span.appendChild(img);
  } else {
    span.textContent = (name || "?").slice(0, 1);
  }
  return span;
}

function toDate(ts) {
  return ts && typeof ts.toDate === "function" ? ts.toDate() : null;
}

function canManage(item) {
  return !!state.user && (item.authorUid === state.user.uid || state.isTeacher);
}

function authorPayload() {
  return {
    authorUid: state.user.uid,
    authorName: cleanName(state.user.displayName),
    authorPhoto: (state.user.photoURL || "").slice(0, 500),
    authorIsTeacher: state.isTeacher,
  };
}

// ---------- 拼音顯示 ----------
function getPinyinVisible() {
  try {
    return localStorage.getItem(PINYIN_KEY) !== "0";
  } catch (e) {
    return true;
  }
}

function applyPinyinVisible(visible) {
  document.body.classList.toggle("pinyin-hidden", !visible);
  els.btnPinyin.setAttribute("aria-pressed", String(visible));
  els.btnPinyin.textContent = visible ? "隱藏拼音" : "顯示拼音";
}

els.btnPinyin.addEventListener("click", () => {
  const next = !getPinyinVisible();
  try {
    localStorage.setItem(PINYIN_KEY, next ? "1" : "0");
  } catch (e) {
    /* 無痕視窗等情況存不了，只影響這次瀏覽 */
  }
  applyPinyinVisible(next);
});

// ---------- 發問區 ----------
function renderSampleOptions() {
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "（不指定）";
  els.noteSample.appendChild(none);
  let group = null;
  let category = null;
  SAMPLE_LIST.forEach((s) => {
    if (s.category !== category) {
      category = s.category;
      group = document.createElement("optgroup");
      group.label = category;
      els.noteSample.appendChild(group);
    }
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    group.appendChild(opt);
  });
}

function updateNoteCount() {
  const n = els.noteInput.value.trim().length;
  els.noteCount.textContent = n + " / " + LIMITS.noteText;
}

els.noteInput.addEventListener("input", updateNoteCount);

els.btnPost.addEventListener("click", async () => {
  const text = cleanText(els.noteInput.value, LIMITS.noteText);
  if (!text) {
    toast("先寫下你的問題再送出喔。");
    els.noteInput.focus();
    return;
  }
  const { db, api } = state.fb;
  els.btnPost.disabled = true;
  try {
    await api.addDoc(api.collection(db, "notes"), {
      text,
      sampleId: els.noteSample.value.slice(0, LIMITS.sampleId),
      ...authorPayload(),
      createdAt: api.serverTimestamp(),
      lastActivityAt: api.serverTimestamp(),
      resolved: false,
      replyCount: 0,
    });
    els.noteInput.value = "";
    els.noteSample.value = "";
    updateNoteCount();
    toast("已經放上筆記本了！");
  } catch (err) {
    toast(errorMessage(err));
  } finally {
    els.btnPost.disabled = false;
  }
});

// ---------- 篩選 ----------
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.filter = tab.dataset.filter;
    els.tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    renderNotes();
  });
});

// ---------- 筆記列表 ----------
function renderNotes() {
  const uid = state.user && state.user.uid;
  els.tabs.forEach((t) => {
    t.querySelector(".filter-count").textContent = filterNotes(state.notes, t.dataset.filter, uid).length;
  });

  const visible = filterNotes(state.notes, state.filter, uid);
  els.noteList.innerHTML = "";
  visible.forEach((note) => els.noteList.appendChild(noteCard(note)));

  els.noteEmpty.hidden = visible.length > 0;
  els.noteEmpty.textContent =
    state.filter === "open" ? "目前沒有還沒解決的問題 🎉" :
    state.filter === "mine" ? "你還沒有發過筆記。" :
    "筆記本還是空的，第一個把問題放上來吧！";
}

function noteCard(note) {
  const card = document.createElement("article");
  card.className = "note-card" + (note.resolved ? " is-resolved" : "");
  card.dataset.id = note.id;

  const head = document.createElement("div");
  head.className = "note-head";
  head.appendChild(avatarEl(note.authorName, note.authorPhoto));
  const author = document.createElement("span");
  author.className = "note-author";
  author.textContent = note.authorName;
  head.appendChild(author);
  if (note.authorIsTeacher) head.appendChild(badge("teacher-badge", "老師"));
  const time = document.createElement("span");
  time.className = "note-time";
  time.textContent = formatRelativeTime(toDate(note.createdAt));
  head.appendChild(time);
  if (note.resolved) head.appendChild(badge("resolved-badge", "✓ 已解決"));
  card.appendChild(head);

  if (note.sampleId && SAMPLE_TITLES.has(note.sampleId)) {
    const chip = document.createElement("div");
    chip.className = "note-sample";
    chip.textContent = "📄 " + SAMPLE_TITLES.get(note.sampleId);
    card.appendChild(chip);
  }

  const text = document.createElement("div");
  text.className = "note-text";
  setZh(text, note.text);
  card.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "note-actions";
  const open = state.openReplies.has(note.id);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "reply-toggle";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "收起討論" : "💬 " + (note.replyCount ? note.replyCount + " 則回覆" : "回覆");
  toggle.addEventListener("click", () => toggleReplies(note.id));
  actions.appendChild(toggle);

  if (canManage(note)) {
    const resolve = document.createElement("button");
    resolve.type = "button";
    resolve.className = "resolve-btn";
    resolve.textContent = note.resolved ? "改回還沒解決" : "✓ 標記已解決";
    resolve.addEventListener("click", () => setResolved(note, !note.resolved));
    actions.appendChild(resolve);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "link-btn danger";
    del.textContent = "刪除";
    del.addEventListener("click", () => deleteNote(note));
    actions.appendChild(del);
  }
  card.appendChild(actions);

  if (open) card.appendChild(repliesBlock(note));
  return card;
}

function badge(cls, text) {
  const b = document.createElement("span");
  b.className = cls;
  b.textContent = text;
  return b;
}

async function setResolved(note, resolved) {
  const { db, api } = state.fb;
  try {
    await api.updateDoc(api.doc(db, "notes", note.id), { resolved });
  } catch (err) {
    toast(errorMessage(err));
  }
}

async function deleteNote(note) {
  if (!window.confirm("確定要刪除這則筆記嗎？刪除後就找不回來了。")) return;
  const { db, api } = state.fb;
  try {
    closeReplies(note.id);
    await api.deleteDoc(api.doc(db, "notes", note.id));
    toast("已刪除。");
  } catch (err) {
    toast(errorMessage(err));
  }
}

// ---------- 回覆 ----------
function toggleReplies(noteId) {
  if (state.openReplies.has(noteId)) {
    closeReplies(noteId);
    renderNotes();
    return;
  }
  const { db, api } = state.fb;
  const entry = { replies: null, unsubscribe: null };
  state.openReplies.set(noteId, entry);
  const q = api.query(api.collection(db, "notes", noteId, "replies"), api.orderBy("createdAt", "asc"));
  entry.unsubscribe = api.onSnapshot(
    q,
    (snap) => {
      entry.replies = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      rerenderCard(noteId);
    },
    (err) => toast(errorMessage(err))
  );
  renderNotes();
}

function closeReplies(noteId) {
  const entry = state.openReplies.get(noteId);
  if (entry && entry.unsubscribe) entry.unsubscribe();
  state.openReplies.delete(noteId);
}

function rerenderCard(noteId) {
  const note = state.notes.find((n) => n.id === noteId);
  const old = els.noteList.querySelector('.note-card[data-id="' + noteId + '"]');
  if (!note || !old) return;
  // 保留正在打的回覆內容，避免別人一回覆，自己打到一半的字就不見
  const draftEl = old.querySelector(".reply-input");
  const draft = draftEl ? draftEl.value : "";
  const hadFocus = draftEl && document.activeElement === draftEl;
  const fresh = noteCard(note);
  old.replaceWith(fresh);
  const input = fresh.querySelector(".reply-input");
  if (input) {
    input.value = draft;
    if (hadFocus) input.focus();
  }
}

function repliesBlock(note) {
  const wrap = document.createElement("div");
  wrap.className = "replies";
  const entry = state.openReplies.get(note.id);

  if (!entry || entry.replies === null) {
    wrap.appendChild(badge("reply-empty", "載入中…"));
  } else if (!entry.replies.length) {
    wrap.appendChild(badge("reply-empty", "還沒有人回覆，來當第一個吧！"));
  } else {
    entry.replies.forEach((r) => wrap.appendChild(replyEl(note, r)));
  }

  const form = document.createElement("form");
  form.className = "reply-form";
  const input = document.createElement("textarea");
  input.className = "reply-input";
  input.rows = 2;
  input.maxLength = LIMITS.replyText;
  input.placeholder = "寫下你的想法或解答…";
  input.setAttribute("aria-label", "回覆這則筆記");
  const send = document.createElement("button");
  send.type = "submit";
  send.className = "tool-btn tool-btn-solid";
  send.textContent = "回覆";
  form.appendChild(input);
  form.appendChild(send);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    postReply(note, input, send);
  });
  // Cmd/Ctrl + Enter 直接送出
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      postReply(note, input, send);
    }
  });
  wrap.appendChild(form);
  return wrap;
}

function replyEl(note, r) {
  const row = document.createElement("div");
  row.className = "reply" + (r.authorIsTeacher ? " is-teacher" : "");
  row.appendChild(avatarEl(r.authorName, r.authorPhoto));
  const body = document.createElement("div");
  body.className = "reply-body";
  const head = document.createElement("div");
  head.className = "reply-head";
  const name = document.createElement("span");
  name.className = "note-author";
  name.textContent = r.authorName;
  head.appendChild(name);
  if (r.authorIsTeacher) head.appendChild(badge("teacher-badge", "老師"));
  const time = document.createElement("span");
  time.className = "note-time";
  time.textContent = formatRelativeTime(toDate(r.createdAt));
  head.appendChild(time);
  if (canManage(r)) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "link-btn danger";
    del.textContent = "刪除";
    del.addEventListener("click", () => deleteReply(note, r));
    head.appendChild(del);
  }
  body.appendChild(head);
  const text = document.createElement("div");
  text.className = "reply-text";
  setZh(text, r.text);
  body.appendChild(text);
  row.appendChild(body);
  return row;
}

async function postReply(note, input, send) {
  const text = cleanText(input.value, LIMITS.replyText);
  if (!text) {
    input.focus();
    return;
  }
  const { db, api } = state.fb;
  send.disabled = true;
  try {
    const batch = api.writeBatch(db);
    batch.set(api.doc(api.collection(db, "notes", note.id, "replies")), {
      text,
      ...authorPayload(),
      createdAt: api.serverTimestamp(),
    });
    batch.update(api.doc(db, "notes", note.id), {
      replyCount: api.increment(1),
      lastActivityAt: api.serverTimestamp(),
    });
    await batch.commit();
    input.value = "";
  } catch (err) {
    toast(errorMessage(err));
  } finally {
    send.disabled = false;
  }
}

async function deleteReply(note, r) {
  if (!window.confirm("確定要刪除這則回覆嗎？")) return;
  const { db, api } = state.fb;
  try {
    const batch = api.writeBatch(db);
    batch.delete(api.doc(db, "notes", note.id, "replies", r.id));
    batch.update(api.doc(db, "notes", note.id), {
      replyCount: api.increment(-1),
      lastActivityAt: api.serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    toast(errorMessage(err));
  }
}

// ---------- 登入狀態 ----------
async function checkTeacher(user) {
  const { db, api } = state.fb;
  const ref = api.doc(db, "teachers", user.uid);
  try {
    if ((await api.getDoc(ref)).exists()) return true;
    // 老師第一次登入：規則只允許老師的 email 建立這筆資料，學生寫入會被拒絕（被拒＝學生）
    await api.setDoc(ref, { name: cleanName(user.displayName) });
    return true;
  } catch (e) {
    return false;
  }
}

function showSignedOut() {
  els.btnLogin.hidden = false;
  els.userChip.hidden = true;
  els.loginNotice.hidden = false;
  els.composer.hidden = true;
  els.board.hidden = true;
}

async function showSignedIn(user) {
  els.btnLogin.hidden = true;
  els.userChip.hidden = false;
  els.userAvatar.replaceWith((els.userAvatar = avatarEl(user.displayName, user.photoURL)));
  els.userAvatar.id = "user-avatar";
  els.userName.textContent = cleanName(user.displayName);
  els.loginNotice.hidden = true;
  els.composer.hidden = false;
  els.board.hidden = false;

  state.isTeacher = await checkTeacher(user);
  els.userTeacher.hidden = !state.isTeacher;
  subscribeNotes();
}

function subscribeNotes() {
  const { db, api } = state.fb;
  if (state.unsubscribeNotes) state.unsubscribeNotes();
  const q = api.query(api.collection(db, "notes"), api.orderBy("lastActivityAt", "desc"), api.limit(300));
  state.unsubscribeNotes = api.onSnapshot(
    q,
    (snap) => {
      state.notes = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      // 已被刪除的筆記，順便關掉它的回覆監聽
      for (const id of Array.from(state.openReplies.keys())) {
        if (!state.notes.some((n) => n.id === id)) closeReplies(id);
      }
      renderNotes();
    },
    (err) => toast(errorMessage(err))
  );
}

function resetData() {
  if (state.unsubscribeNotes) state.unsubscribeNotes();
  state.unsubscribeNotes = null;
  for (const id of Array.from(state.openReplies.keys())) closeReplies(id);
  state.notes = [];
  state.isTeacher = false;
  els.noteList.innerHTML = "";
}

// ---------- 初始化 ----------
async function connectFirebase(config) {
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(config);
  return { auth: authMod.getAuth(app), authApi: authMod, db: fsMod.getFirestore(app), api: fsMod };
}

async function main() {
  ZhPinyin.init();
  setZh($("page-title"), "學習筆記本");
  setZh($("page-subtitle"), "把不會的字、句子或問題放上來，大家一起討論。");
  applyPinyinVisible(getPinyinVisible());
  renderSampleOptions();
  updateNoteCount();

  const config = window.ZH_FIREBASE_CONFIG;
  if (!config || !config.apiKey) {
    els.setupNotice.hidden = false;
    return;
  }

  try {
    state.fb = await connectFirebase(config);
  } catch (err) {
    els.setupNotice.hidden = false;
    els.setupNotice.textContent = "連不上 Firebase，請檢查網路後重新整理頁面。";
    return;
  }

  const { auth, authApi } = state.fb;
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  els.btnLogin.addEventListener("click", async () => {
    try {
      await authApi.signInWithPopup(auth, provider);
    } catch (err) {
      if (err && err.code === "auth/popup-blocked") {
        await authApi.signInWithRedirect(auth, provider);
      } else {
        toast(errorMessage(err));
      }
    }
  });

  els.btnLogout.addEventListener("click", () => authApi.signOut(auth));

  authApi.onAuthStateChanged(auth, (user) => {
    resetData();
    state.user = user;
    if (user) showSignedIn(user);
    else showSignedOut();
  });

  // 每分鐘更新一次「3 分鐘前」這類相對時間
  setInterval(() => {
    if (state.user && state.notes.length) {
      els.noteList.querySelectorAll(".note-card").forEach((c) => rerenderCard(c.dataset.id));
    }
  }, 60000);
}

main();
