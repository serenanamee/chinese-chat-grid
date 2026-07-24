// 筆記儲存層：獨立封裝 localStorage 存取，畫面元件不要直接呼叫 localStorage。
// 本專案目前沒有登入或後端資料庫（純前端靜態頁），所以用 localStorage 持久化。
// key 同時包含主題 id 與問題 id，確保不同題目的筆記不會互相覆蓋。
// 只存原始筆記文字，不存拼音（拼音永遠是顯示當下即時算出來的）。

(function (global) {
  const KEY_PREFIX = "zhChatGrid:note:";

  function keyFor(topicId, questionId) {
    return KEY_PREFIX + topicId + ":" + questionId;
  }

  function getNote(topicId, questionId) {
    try {
      return global.localStorage.getItem(keyFor(topicId, questionId)) || "";
    } catch (e) {
      return "";
    }
  }

  function saveNote(topicId, questionId, text) {
    try {
      if (text) {
        global.localStorage.setItem(keyFor(topicId, questionId), text);
      } else {
        // 空字串等同於沒有筆記，順便清掉 key，避免 localStorage 塞一堆空值
        global.localStorage.removeItem(keyFor(topicId, questionId));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearNote(topicId, questionId) {
    try {
      global.localStorage.removeItem(keyFor(topicId, questionId));
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasNote(topicId, questionId) {
    return getNote(topicId, questionId).trim().length > 0;
  }

  // 主題進度：該主題底下有幾題已經寫了筆記
  function getTopicProgress(topicId, questionIds) {
    const done = questionIds.reduce(
      (count, qId) => count + (hasNote(topicId, qId) ? 1 : 0),
      0
    );
    return { done, total: questionIds.length };
  }

  // 清除「所有」主題的所有筆記，需搭配 UI 上的二次確認使用，這裡只負責實際刪除。
  function clearAllNotes(topics) {
    for (const topic of topics) {
      for (const q of topic.questions) {
        clearNote(topic.id, q.id);
      }
    }
  }

  const ZhNotes = {
    getNote,
    saveNote,
    clearNote,
    hasNote,
    getTopicProgress,
    clearAllNotes,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ZhNotes;
  } else {
    global.ZhNotes = ZhNotes;
  }
})(typeof window !== "undefined" ? window : global);
