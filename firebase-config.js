// Firebase 專案設定（筆記本頁面用）。
// 從 Firebase 主控台 →「專案設定」→「你的應用程式」→ 網頁應用程式的 firebaseConfig 整段貼進來。
// 這些值本來就會出現在網頁原始碼裡，不是密碼；真正擋住亂寫資料的是 firestore.rules。
// 還沒設定（null）時，筆記本頁面會顯示「尚未接上資料庫」，不會壞掉。

window.ZH_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD6U3If27m3GgsOQ9H1EGbGSQjZ2g5Xw5E",
  authDomain: "mandarin-class-ef065.firebaseapp.com",
  projectId: "mandarin-class-ef065",
  storageBucket: "mandarin-class-ef065.firebasestorage.app",
  messagingSenderId: "957092525656",
  appId: "1:957092525656:web:8bfcfe02b3ea809448bc2d",
};
