// 筆記本的純邏輯（不碰 DOM、不碰 Firebase），方便在 Node 裡測試。
// 長度上限要跟 firestore.rules 裡的檢查保持一致。

(function (global) {
  const LIMITS = { noteText: 1000, replyText: 1000, authorName: 60, sampleId: 60 };
  const FILTERS = ["all", "open", "mine"];

  // 回傳整理過的文字；空白或超過上限回傳 null（呼叫端負責顯示提示）。
  function cleanText(text, max) {
    if (typeof text !== "string") return null;
    const trimmed = text.replace(/\r\n/g, "\n").trim();
    if (!trimmed || trimmed.length > max) return null;
    return trimmed;
  }

  function cleanName(name) {
    const n = typeof name === "string" ? name.trim() : "";
    return (n || "同學").slice(0, LIMITS.authorName);
  }

  // 「剛剛／3 分鐘前／2 小時前／昨天／5 天前」，超過一週直接顯示日期。
  function formatRelativeTime(date, now) {
    if (!(date instanceof Date) || isNaN(date)) return "剛剛";
    const current = now instanceof Date ? now : new Date();
    const sec = Math.floor((current - date) / 1000);
    if (sec < 60) return "剛剛";
    const min = Math.floor(sec / 60);
    if (min < 60) return min + " 分鐘前";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + " 小時前";
    const day = Math.floor(hr / 24);
    if (day === 1) return "昨天";
    if (day < 7) return day + " 天前";
    return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
  }

  // notes: [{ authorUid, resolved, ... }]；mode: all（全部）／open（還沒解決）／mine（我發的）
  function filterNotes(notes, mode, uid) {
    if (!Array.isArray(notes)) return [];
    if (mode === "open") return notes.filter((n) => !n.resolved);
    if (mode === "mine") return notes.filter((n) => uid && n.authorUid === uid);
    return notes.slice();
  }

  const ZhNotebook = { LIMITS, FILTERS, cleanText, cleanName, formatRelativeTime, filterNotes };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ZhNotebook;
  } else {
    global.ZhNotebook = ZhNotebook;
  }
})(typeof window !== "undefined" ? window : global);
