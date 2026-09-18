// 輕量邏輯測試（純 Node，不引入測試框架，與專案「無 build 流程」的慣例一致）。
// 執行方式：node test/logic.test.js
// 涵蓋：拼音轉換與多音字校正、草稿／字級偏好儲存層。

const assert = require("assert");
const path = require("path");

let failures = 0;
let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok - " + name);
  } catch (err) {
    failures++;
    console.error("  FAIL - " + name);
    console.error("    " + err.message);
  }
}

// ---- 建立最小瀏覽器環境假物件 ----
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

global.window = global;
global.localStorage = new MemoryStorage();
global.pinyinPro = require(path.join(__dirname, "..", "vendor", "pinyin-pro.min.js"));

const ZhPinyin = require(path.join(__dirname, "..", "pinyin.js"));
const ZhDraft = require(path.join(__dirname, "..", "draft-store.js"));
const { SAMPLES } = require(path.join(__dirname, "..", "samples.js"));

console.log("== 拼音轉換 ==");

check("一般詞語轉換正確且帶聲調符號", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("名人"), "míng rén");
  assert.strictEqual(ZhPinyin.toPlainPinyin("地方"), "dì fāng");
});

check("多音字校正：什麼／怎麼 讀輕聲 me，不是 mó", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("什麼"), "shén me");
  assert.strictEqual(ZhPinyin.toPlainPinyin("怎麼"), "zěn me");
});

check("多音字校正：嗎 讀輕聲 ma，不是 má", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("你好嗎"), "nǐ hǎo ma");
});

check("多音字校正：為什麼／因為 讀 wèi，不是 wéi", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("為什麼"), "wèi shén me");
  assert.strictEqual(ZhPinyin.toPlainPinyin("因為"), "yīn wèi");
});

check("多音字校正：銀行 讀 yín háng，不是 yín xíng", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("銀行附近有很多餐廳。").indexOf("yín háng"), 0);
});

check("一／不 變調：一個 yí gè、不是 bú shì", () => {
  assert.strictEqual(ZhPinyin.toPlainPinyin("一個"), "yí gè");
  assert.ok(ZhPinyin.toPlainPinyin("這不是問題").indexOf("bú shì") !== -1);
});

check("renderMarkup 對中文逐字輸出 ruby/rt，且提供螢幕閱讀器用的純文字（只出現一次）", () => {
  const html = ZhPinyin.renderMarkup("名人");
  assert.ok(html.includes('<ruby>名<rt>míng</rt>人<rt>rén</rt></ruby>'));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(html.includes('<span class="sr-only">名人</span>'));
});

check("renderMarkup 混合中英數標點與 emoji 不會壞掉，英文保留原樣", () => {
  const html = ZhPinyin.renderMarkup("我喜歡台灣的夜市，because 很熱鬧！😀123");
  assert.ok(html.includes("because"));
  assert.ok(html.includes("😀123"));
  assert.ok(html.includes("，"));
  assert.ok(html.includes("！"));
});

check("renderMarkup 對使用者輸入做 HTML escape，避免 XSS", () => {
  const html = ZhPinyin.renderMarkup('<img src=x onerror=alert(1)>你好');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
});

check("renderMarkup 保留換行", () => {
  const html = ZhPinyin.renderMarkup("第一行\n第二行");
  const visualPart = html.match(/aria-hidden="true">([\s\S]*?)<\/span>/)[1];
  assert.strictEqual(visualPart.split("\n").length, 2, visualPart);
});

check("renderMarkup 對空字串不報錯", () => {
  assert.strictEqual(ZhPinyin.renderMarkup(""), "");
});

check("renderMarkup 對完全不含中文的文字直接輸出，不多包一層 sr-only", () => {
  assert.strictEqual(ZhPinyin.renderMarkup("12 / 5"), "12 / 5");
});

console.log("== 使用者指定的 5 個測試句 ==");
[
  ["我喜歡台灣的夜市，because 很熱鬧！", "because"],
  ["今天我要和朋友去吃飯。", "hé"],
  ["這個地方很好玩，但是人太多了。", "le"],
  ["銀行附近有很多餐廳。", "yín háng"],
  ["音樂讓我覺得很放鬆。", "lè"],
].forEach(([sentence, expectFragment]) => {
  check(sentence, () => {
    const py = ZhPinyin.toPlainPinyin(sentence);
    assert.ok(py.includes(expectFragment), py);
  });
});

console.log("== 範例文章 ==");

check("範例文章至少有 3 篇，且 id／label 皆唯一、非空", () => {
  assert.ok(SAMPLES.length >= 3);
  const ids = new Set();
  SAMPLES.forEach((s) => {
    assert.ok(!ids.has(s.id), "重複的範例 id: " + s.id);
    ids.add(s.id);
    assert.ok(s.label && s.label.trim(), "缺少 label: " + s.id);
    assert.ok(s.text && s.text.trim(), "缺少內容: " + s.id);
  });
});

console.log("== 草稿與字級偏好儲存層 ==");

check("草稿預設為空字串", () => {
  assert.strictEqual(ZhDraft.getDraft(), "");
});

check("儲存與讀取草稿，保留換行", () => {
  ZhDraft.saveDraft("第一行\n第二行");
  assert.strictEqual(ZhDraft.getDraft(), "第一行\n第二行");
  ZhDraft.saveDraft("");
  assert.strictEqual(ZhDraft.getDraft(), "");
});

check("儲存空字串會清除草稿 key", () => {
  ZhDraft.saveDraft("暫存內容");
  assert.strictEqual(ZhDraft.getDraft(), "暫存內容");
  ZhDraft.saveDraft("");
  assert.strictEqual(ZhDraft.getDraft(), "");
});

check("字級預設為 md，儲存後可正確讀回", () => {
  assert.strictEqual(ZhDraft.getFontSize(), "md");
  ZhDraft.saveFontSize("lg");
  assert.strictEqual(ZhDraft.getFontSize(), "lg");
  ZhDraft.saveFontSize("sm");
  assert.strictEqual(ZhDraft.getFontSize(), "sm");
});

check("字級只接受 sm／md／lg，其餘值不寫入", () => {
  ZhDraft.saveFontSize("sm");
  const before = ZhDraft.getFontSize();
  const ok = ZhDraft.saveFontSize("huge");
  assert.strictEqual(ok, false);
  assert.strictEqual(ZhDraft.getFontSize(), before);
});

console.log("\n" + passed + " passed, " + failures + " failed");
process.exit(failures > 0 ? 1 : 0);
