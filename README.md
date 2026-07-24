# 華語聊天九宮格 🀄

給華語課堂使用的「九宮格翻牌聊天」小工具：9 個主題卡，每個主題 5 題聊天問題，
所有中文（標題、主題、問題、學生自己打的筆記）上方都會即時顯示帶聲調拼音。

## 使用

用瀏覽器直接打開 `index.html` 即可，不需要安裝、不需要 build。

## 內容

- 9 大主題 × 5 題＝45 題聊天問題（名人／地方／時事／戲劇／美食／壓力／文化／旅行／人際關係）
- 每題下方有獨立的筆記欄，中文輸入即時顯示拼音（ruby），存在瀏覽器 localStorage，換裝置不會同步
- 隨機選主題／隨機選問題／重新開始（只重設本次選題狀態，不會刪筆記）
- 清除全部筆記需要兩次確認，避免誤刪
- 支援鍵盤操作（Tab／Enter／Space／Esc）、螢幕閱讀器、`prefers-reduced-motion`
- 手機版自動改為單欄版面

## 結構

- `index.html` / `style.css` / `app.js` — 網頁本體與互動邏輯
- `data.js` — 九宮格題庫資料（主題、問題，皆有穩定 id）
- `pinyin.js` — 拼音轉換 helper（封裝 pinyin-pro，含多音字人工校正、XSS 安全的 ruby HTML 產生）
- `notes.js` — 筆記儲存層（封裝 localStorage 存取，key 含主題 id + 問題 id）
- `vendor/pinyin-pro.min.js` — 拼音套件（已下載至本機，鎖定版本，見 `vendor/VENDOR.md`）
- `test/logic.test.js` — 純 Node 邏輯測試（題庫完整性、拼音校正、筆記儲存），執行：`node test/logic.test.js`

## 拼音套件

使用 [pinyin-pro](https://pinyin-pro.cn)（MIT 授權），詳見 `vendor/VENDOR.md`，
包含目前已知需要人工校正的多音字清單。
