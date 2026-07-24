// 拼音轉換 helper：封裝 pinyin-pro，提供「中文 + 上方帶聲調拼音」的 HTML 產生器。
// 所有畫面上的中文（主題、問題、標題、筆記預覽）都應該透過 ZhPinyin.renderMarkup() 顯示，
// 不要各自呼叫 pinyin-pro 或手刻 ruby HTML，避免拼音規則各地不一致。
//
// 為什麼自己組 ruby HTML，而不是直接用 pinyin-pro 內建的 html()：
// pinyin-pro 的 html() 對「非中文片段」（英文、標點、使用者輸入的任意文字）不會做 HTML escape，
// 若直接把使用者在筆記欄輸入的文字餵給它並塞進 innerHTML，會有 XSS 風險。
// 這裡固定用 pinyin-pro 的 pinyin() 陣列模式（只取純中文片段做逐字比對），
// 其餘片段一律走 escapeHtml 再輸出，確保任何使用者輸入都安全。

(function (global) {
  const HAN_RUN = /[㐀-䶿一-鿿]+/;
  const HAN_OR_NOT = /[㐀-䶿一-鿿]+|[^㐀-䶿一-鿿]+/g;

  let initialized = false;

  // 固定題庫／常見詞的人工校正：pinyin-pro 內建字典在這些詞上的預設讀音不符合現代口語，
  // 詳細原因見 vendor/VENDOR.md。用 customPinyin 全域覆寫一次，畫面上所有出現這些詞的地方
  // （題庫、學生自己打的筆記）都會套用校正後的讀音。
  const PINYIN_CORRECTIONS = {
    "什麼": "shén me",
    "怎麼": "zěn me",
    "這麼": "zhè me",
    "那麼": "nà me",
    "多麼": "duō me",
    "嗎": "ma",
    "還是": "hái shì",
    "為什麼": "wèi shén me",
    "因為": "yīn wèi",
    "銀行": "yín háng",
  };

  function init() {
    if (initialized) return;
    if (!global.pinyinPro || typeof global.pinyinPro.customPinyin !== "function") {
      throw new Error("pinyin-pro 尚未載入，請確認 vendor/pinyin-pro.min.js 有在此檔案之前被引入");
    }
    global.pinyinPro.customPinyin(PINYIN_CORRECTIONS);
    initialized = true;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 把一段純中文（不含英數標點）轉成一個 <ruby> 區塊，每個字對應自己的 <rt> 拼音。
  function hanRunToRuby(run) {
    const pinyinArr = global.pinyinPro.pinyin(run, { type: "array" });
    const chars = Array.from(run);
    let out = "<ruby>";
    for (let i = 0; i < chars.length; i++) {
      const py = pinyinArr[i] || "";
      out += escapeHtml(chars[i]) + "<rt>" + escapeHtml(py) + "</rt>";
    }
    out += "</ruby>";
    return out;
  }

  // 產生「視覺上中文字＋上方拼音，但螢幕閱讀器只唸一次原始文字」的 HTML 片段。
  // 換行（\n）保留原樣，交給呼叫端用 white-space: pre-wrap 顯示，避免拼音跟文字分開換行。
  function buildVisualHtml(text) {
    if (!text) return "";
    const segments = text.match(HAN_OR_NOT) || [];
    let html = "";
    for (const seg of segments) {
      if (HAN_RUN.test(seg)) {
        html += hanRunToRuby(seg);
      } else {
        html += escapeHtml(seg);
      }
    }
    return html;
  }

  // 對外主要 API：回傳可直接塞進 innerHTML 的完整標記（含無障礙處理）。
  function renderMarkup(text) {
    init();
    const safeText = text == null ? "" : text;
    // 完全不含中文字（例如純數字進度「2 / 5」）就不需要 ruby／sr-only 雙層結構，
    // 直接輸出跳脫後的文字即可，避免多一層看不見但仍會被 innerText／複製貼上讀到的重複文字。
    if (!HAN_RUN.test(safeText)) {
      return escapeHtml(safeText);
    }
    const visual = buildVisualHtml(safeText);
    const plain = escapeHtml(safeText);
    // 視覺版本（ruby 拼音）對輔助科技隱藏，另外提供純文字版本給螢幕閱讀器唸一次，
    // 避免同一句話因為 <rt> 內容被重複朗讀兩次。
    return (
      '<span class="zh-ruby-visual" aria-hidden="true">' + visual + "</span>" +
      '<span class="sr-only">' + plain + "</span>"
    );
  }

  // 純文字拼音（不含 HTML），用於 aria-label 等需要一整串拼音字串的情境。
  function toPlainPinyin(text) {
    init();
    if (!text) return "";
    // nonZh: 'consecutive' 讓連續的非中文字元（英文單字、emoji）保持完整，
    // 不會被拆成一個字母一個字母（預設行為在混合中英文時會把英文字母拆散）。
    return global.pinyinPro.pinyin(text, { nonZh: "consecutive" });
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const ZhPinyin = { init, renderMarkup, toPlainPinyin, escapeHtml, debounce };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ZhPinyin;
  } else {
    global.ZhPinyin = ZhPinyin;
  }
})(typeof window !== "undefined" ? window : global);
