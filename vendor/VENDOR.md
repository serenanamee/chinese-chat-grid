# 第三方套件清單

## pinyin-pro

- 版本：3.28.2（鎖定，不自動升級）
- 來源：https://unpkg.com/pinyin-pro@3.28.2/dist/index.js
- 授權：MIT
- SHA-256：de23b01bfc76de73a041dd2b1600f146f56a02611ae9033f0042d5d9ab19bce9d7
- 檔案：`vendor/pinyin-pro.min.js`（已下載至本機，離線可用，不依賴 CDN）
- 用途：將繁體中文即時轉換為帶聲調符號的漢語拼音（HTML ruby 標記），支援多音字語境判斷
- 為什麼選這個套件：MIT 授權、零執行期相依、瀏覽器可直接用 `<script>` 載入（UMD，掛在 `window.pinyinPro`）、繁體中文辨識正確、內建常見多音字語境判斷（如「睡著了」→ shuì zháo le）、gzip 後約 137KB
- 已知需要人工校正的字詞（透過 `pinyinPro.customPinyin()` 覆寫，見 `pinyin.js`）：
  - 「什麼／怎麼／這麼／那麼／多麼」：套件預設把「麼」讀成 mó，但現代口語一律讀輕聲 me
  - 「嗎」：套件預設讀 má，但作疑問語助詞應讀輕聲 ma
  - 「為什麼／因為」：套件預設把「為」讀成 wéi，但這兩個詞應讀 wèi
  - 「銀行」：套件預設讀成 yín xíng，正確應為 yín háng

如需升級版本，請重新下載對應版本檔案、更新此檔的版本號與 SHA-256，並重新執行 `test/logic.test.js` 確認題庫拼音仍然正確。
