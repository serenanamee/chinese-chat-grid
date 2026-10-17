// 「已上過」勾選的雲端同步：登入 Google 後，老師和學生共用同一份清單（Firestore 的 progress/taught），
// 任何人勾選或取消，所有開著的頁面都會即時更新。沒登入或沒設定 Firebase 時，app.js 照舊只存本機。
// 畫面邏輯在 app.js，這裡只透過 window.ZhTaughtSync 跟它溝通。

import { hasFirebaseConfig, connectFirebase, signInWithGoogle } from "./firebase-client.js";

const MERGED_KEY = "zhArticleReader:taughtMerged";
const bridge = window.ZhTaughtSync;
const syncBtn = document.getElementById("sync-btn");

function showSignedOut() {
  syncBtn.hidden = false;
  syncBtn.classList.remove("is-synced");
  syncBtn.textContent = "☁️ 登入 Google，跟老師／同學同步勾選";
}

function showSynced(user) {
  syncBtn.hidden = false;
  syncBtn.classList.add("is-synced");
  syncBtn.textContent = "☁️ 已同步（" + (user.displayName || user.email || "已登入") + "）";
}

function showError() {
  syncBtn.hidden = false;
  syncBtn.classList.remove("is-synced");
  syncBtn.textContent = "⚠️ 同步失敗，勾選暫時只存在這台電腦（重新整理再試）";
}

function alreadyMerged() {
  try {
    return localStorage.getItem(MERGED_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function markMerged() {
  try {
    localStorage.setItem(MERGED_KEY, "1");
  } catch (e) {
    /* 存不了就下次再合併一次，合併是聯集，重複做也不會出錯 */
  }
}

async function main() {
  if (!bridge || !syncBtn || !hasFirebaseConfig()) return;

  let fb;
  try {
    fb = await connectFirebase();
  } catch (e) {
    return; // 連不上 Firebase 就維持只存本機，不打擾使用者
  }
  const { auth, authApi, db, api } = fb;
  const ref = api.doc(db, "progress", "taught");
  let unsubscribe = null;
  let currentUser = null;

  syncBtn.addEventListener("click", async () => {
    if (currentUser) return;
    try {
      await signInWithGoogle(fb);
    } catch (e) {
      /* 使用者關掉登入視窗之類，維持未登入狀態即可 */
    }
  });

  function write(data) {
    return api
      .setDoc(ref, { ...data, updatedAt: api.serverTimestamp() }, { merge: true })
      .catch(showError);
  }

  authApi.onAuthStateChanged(auth, async (user) => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    currentUser = user;

    if (!user) {
      bridge.onLocalChange = null;
      showSignedOut();
      return;
    }

    // 這個瀏覽器第一次同步時，把原本只存在本機的勾選併進雲端（聯集，不會蓋掉別人勾的）
    if (!alreadyMerged()) {
      const local = bridge.getIds();
      if (local.length) await write({ ids: api.arrayUnion(...local) });
      markMerged();
    }

    bridge.onLocalChange = (change) => {
      if (change.reset) write({ ids: [] });
      else if (change.taught) write({ ids: api.arrayUnion(change.id) });
      else write({ ids: api.arrayRemove(change.id) });
    };

    unsubscribe = api.onSnapshot(
      ref,
      (snap) => {
        const ids = snap.exists() && Array.isArray(snap.data().ids) ? snap.data().ids : [];
        bridge.replaceAll(ids.filter((id) => typeof id === "string"));
        showSynced(user);
      },
      showError
    );
  });
}

main();
