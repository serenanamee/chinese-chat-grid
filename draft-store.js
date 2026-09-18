// 草稿與偏好儲存層：獨立封裝 localStorage 存取，畫面元件不要直接呼叫 localStorage。
// 只存使用者輸入的原始文章文字與字級偏好，不存拼音（拼音永遠是顯示當下即時算出來的）。

(function (global) {
  const TEXT_KEY = "zhArticleReader:draftText";
  const SIZE_KEY = "zhArticleReader:fontSize";
  const VALID_SIZES = ["sm", "md", "lg"];

  function getDraft() {
    try {
      return global.localStorage.getItem(TEXT_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function saveDraft(text) {
    try {
      if (text) {
        global.localStorage.setItem(TEXT_KEY, text);
      } else {
        // 空字串等同於沒有草稿，順便清掉 key，避免 localStorage 塞空值
        global.localStorage.removeItem(TEXT_KEY);
      }
      return true;
    } catch (e) {
      // localStorage 不可用時（例如無痕視窗、儲存已滿）靜默失敗，不影響畫面功能
      return false;
    }
  }

  function getFontSize() {
    try {
      const v = global.localStorage.getItem(SIZE_KEY);
      return VALID_SIZES.includes(v) ? v : "md";
    } catch (e) {
      return "md";
    }
  }

  function saveFontSize(size) {
    if (!VALID_SIZES.includes(size)) return false;
    try {
      global.localStorage.setItem(SIZE_KEY, size);
      return true;
    } catch (e) {
      return false;
    }
  }

  const ZhDraft = { getDraft, saveDraft, getFontSize, saveFontSize };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ZhDraft;
  } else {
    global.ZhDraft = ZhDraft;
  }
})(typeof window !== "undefined" ? window : global);
