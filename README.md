# 商務中文拼音標注 🀄

給商務中文課堂使用的「文章拼音標注」小工具：貼上一篇文章，
每個中文字上方會即時顯示帶聲調拼音，方便學生朗讀與閱讀練習。

## 使用

用瀏覽器直接打開 `index.html` 即可，不需要安裝、不需要 build。

## 內容

- 大尺寸輸入框：貼上或輸入任意中文文章，下方即時（150ms 防抖）顯示帶拼音版本
- 內建 41 篇範例文章，依主題情境分 13 類，可從選單一鍵載入：
  - 商務正式類：書信往來、會議與簡報、商務社交、談判與電話、**專案管理**、**行銷與電商**、**財務與報價**、求職與人資、新聞讀報
  - 輕鬆調性類：**台灣職場有趣的習慣**（尾牙抽獎、辦公室團購、放颱風假、交換禮物、責任制、摸魚文化）、**年輕人用語對話**（同事間的流行語對話，如笑死、社畜、已讀不回、機車、母湯、凡爾賽、厭世）、**生活閒聊（口語）**（約出去玩、訂手搖飲、換手機、下雨天抱怨）、**韓流與 Threads 回文**（用 Threads 貼文＋回覆的格式，練習追星、韓劇相關的網路用語）；這類詞屬於非正式口語／網路用語，vocab 的解釋有特別註明使用情境
  - 「新聞讀報」是模仿財經新聞寫作風格自寫的練習文章（標題＋導言＋引述），公司／人物皆虛構，不是真實報導的摘錄或改寫
  - 每篇範例文章都附「生字重點」：4 個從該篇文章挑出的生字，各附簡明解釋與 2 句另外新寫的範例句子（帶拼音），載入範例後會顯示在拼音標注下方；若自行輸入或貼上其他文章，生字區會收起來（沒有預先準備好的生字資料）
- **已上過標記**：選單裡每篇文章左邊有勾選框，打勾後該篇會變成綠色並標示「✓ 已上過」，每個分類顯示進度（如 2/3），選單頂端顯示總進度；載入文章後輸入框下方也有「這篇已上過」可以直接勾。勾選紀錄存在瀏覽器 localStorage（換電腦或換瀏覽器不會同步），「全部清除」可一次重設
- 字級切換（小／中／大），方便投影或不同閱讀需求
- 輸入內容自動存在瀏覽器 localStorage，換分頁或重新整理不會遺失（換裝置不會同步）
- 複製純文字、清空（清空需二次確認，避免誤刪）
- 支援鍵盤操作、螢幕閱讀器、`prefers-reduced-motion`
- 手機版自動改為單欄版面

## 學習筆記本（notebook.html）

學生用 Google 帳號登入，把不會的字、句子或問題放上來，全班都看得到，可以互相回覆討論。
筆記內容一樣會自動加上拼音；可以標註跟哪篇範例文章有關；發問的人或老師可以標記「已解決」或刪除；
上方可篩選「全部／還沒解決／我發的」。老師的發言會有「老師」標籤。

資料存在 Firebase（Firestore + Google 登入），**第一次使用前老師要設定一次**：

1. 到 https://console.firebase.google.com 用 Google 帳號建立專案（Google Analytics 可以關掉）
2. 左側「建構 → Authentication」→ 開始使用 →「登入方式」啟用 **Google**
3. Authentication →「設定」→「已授權網域」新增 `serenanamee.github.io`
4. 左側「建構 → Firestore Database」→ 建立資料庫（地區選 `asia-east1` 台灣，選「正式版模式」）
5. Firestore →「規則」分頁：貼上 `firestore.rules` 的全部內容，把 `TEACHER_EMAIL` 換成老師登入用的 Gmail，按「發布」
6. 專案設定（齒輪）→「你的應用程式」→ 新增網頁應用程式 `</>`，把出現的 `firebaseConfig` 那段值貼進 `firebase-config.js`
   （`window.ZH_FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", ... };`），推上 GitHub

設定值本來就會公開在網頁裡，不是密碼；擋住亂改資料的是 Firestore 規則（只有登入的人能讀寫、只能刪改自己的內容，老師可以管理全部）。
筆記本需要用 http(s) 開啟（GitHub Pages 上沒問題），直接雙擊 `notebook.html` 用 file:// 開無法登入。

## 結構

- `index.html` / `style.css` / `app.js` — 網頁本體與互動邏輯
- `samples.js` — 範例文章資料（皆有穩定 id，供下拉選單使用）
- `draft-store.js` — 草稿、字級偏好與「已上過」清單儲存層（封裝 localStorage 存取）
- `pinyin.js` — 拼音轉換 helper（封裝 pinyin-pro，含多音字人工校正、XSS 安全的 ruby HTML 產生）
- `vendor/pinyin-pro.min.js` — 拼音套件（已下載至本機，鎖定版本，見 `vendor/VENDOR.md`）
- `notebook.html` / `notebook.css` / `notebook.js` — 學習筆記本頁面（Firebase 串接與畫面）
- `notebook-logic.js` — 筆記本的純邏輯（文字檢查、相對時間、篩選），長度上限要跟 `firestore.rules` 一致
- `firebase-config.js` — Firebase 網頁設定（未設定時筆記本頁面會顯示提示）
- `firestore.rules` — Firestore 安全規則（貼到 Firebase 主控台用）
- `test/logic.test.js` — 純 Node 邏輯測試（拼音校正、範例資料、草稿／字級儲存），執行：`node test/logic.test.js`

## 拼音套件

使用 [pinyin-pro](https://pinyin-pro.cn)（MIT 授權），詳見 `vendor/VENDOR.md`，
包含目前已知需要人工校正的多音字清單。
