// 共用的 Firebase 連線：筆記本（notebook.js）和「已上過」同步（taught-sync.js）都從這裡拿。
// SDK 從 gstatic CDN 動態載入（鎖定版本）；firebase-config.js 還沒設定時回傳 null。

const FIREBASE_VERSION = "10.12.2";
const SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";

export function hasFirebaseConfig() {
  const config = window.ZH_FIREBASE_CONFIG;
  return !!(config && config.apiKey);
}

export async function connectFirebase() {
  if (!hasFirebaseConfig()) return null;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(window.ZH_FIREBASE_CONFIG);
  return { auth: authMod.getAuth(app), authApi: authMod, db: fsMod.getFirestore(app), api: fsMod };
}

// Google 登入：先用彈出視窗，被瀏覽器擋住時改用整頁跳轉。
export async function signInWithGoogle(fb) {
  const provider = new fb.authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await fb.authApi.signInWithPopup(fb.auth, provider);
  } catch (err) {
    if (err && err.code === "auth/popup-blocked") {
      await fb.authApi.signInWithRedirect(fb.auth, provider);
    } else {
      throw err;
    }
  }
}
