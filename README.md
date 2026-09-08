# 拾光 Life Atlas

繁體中文年度回顧與行動規劃網頁。支援桌面與手機，不需要帳號，生活紀錄不會上傳。

[開啟網頁](https://world4jason.github.io/life-tool/) · [二分類示範](https://world4jason.github.io/life-tool/?guide=1&step=3) · [分群示範](https://world4jason.github.io/life-tool/?guide=1&step=3&method=group)

## 操作

| 頁面 | 操作 |
| --- | --- |
| 拾起片刻 | 每月記下 0–3 件事，標示計畫內／意外等發生方式。固定日常另外記錄。 |
| 看見起伏 | −10～＋10 能量評分，拖曳或用箭頭調整同月順序。事件摘要唯讀，不填情緒或觀察。 |
| 發現線索 | 二分類：選詞後逐張判斷有關／無關；分群：把事件放成群後命名。提供步驟提示、例子、拖曳、移動選單及復原。 |
| 打開可能 | 選擇詞語，確認想保留或改變的方向，比較不同做法與資源代價。 |
| 帶走實驗 | 方向 O → 成果 KR → 行動；也可以由行動向上聚類。設定數量、頻率、驗收、開始線索、備案與回顧日。 |
| 回來看看 | 分開記錄執行與方向感受，再決定維持、調整、減量、暫停或停止。 |

分類不推定正負：耗損的事件也可能與詞語有關；未操作不等於無關。每個詞保留獨立判斷，同一事件也能加入多個群。涵蓋數量不是目標優先順序。分類與命名不會改寫後面的路線或行動。

「操作示範」使用隔離的虛構資料，退出恢復原本的回顧；示範練習不會寫入個人紀錄。每段可以跳過，不新增目標也能結束。

## 執行

Node.js 22 以上，沒有 npm 安裝依賴。

```sh
git clone https://github.com/world4jason/life-tool.git
cd life-tool
npm run dev
# http://localhost:4173
```

根目錄可以直接由靜態主機提供；入口與模組使用相對路徑，支援 GitHub Pages 專案子路徑。Pages 使用 `main / (root)`。更新 main 後，部署狀態以 repository 的 Actions 紀錄為準。

```sh
npm run check
npm run build
# dist/index.html：包含所有 CSS 與 JavaScript 的單檔版。
node scripts/serve.mjs --dist
```

單檔版沒有 CDN、外部字型或追蹤請求。直接以檔案網址開啟時，儲存行為依瀏覽器而異；正式使用建議 HTTP(S)。

## 資料

分類操作即時保存；文字表單按儲存或確認後保存。未提交文字只在目前頁面記憶體中，不是可跨重新載入的草稿。每個瀏覽器／網站來源的個人桌保留一輪；跨裝置使用完整 JSON 備份／匯入，沒有雲端同步。

JSON 備份含私密文字，**未加密**。私密標記只遮蔽畫面，不是密碼鎖。SVG 探索地圖排除私密事件；主題與行動的手寫私人文字仍需自行檢查。摘要最多顯示前六個主題及行動，完整內容在 JSON。

v2 支援讀取 v1。原主題保留為分群，未勾選的事件不會被轉成無關。首次升級儲存前保留原始快照；其他舊分頁應重新整理。v2 備份不能交給舊版網頁使用。損壞資料不會被空白覆蓋；儲存配額錯誤或其他分頁衝突時提醒下載備份。

清除網站資料會刪除本機紀錄。請定期備份，不要把個人的 JSON 提交到公開 repository。

## 驗證

本版本機執行：91 項單元測試、38 項分類介面檢查；既有 flows 27、guide 22、rating 42、energy-board 40 項檢查通過。分類兩種模式在 320、390、768、1024、1440px 檢查無整頁水平溢位。

```sh
npm run check
npm run build
# 瀏覽器測試另外需要 Python、Playwright 與 Chromium。
python -m pip install playwright
python -m playwright install chromium
CHROMIUM_PATH=/path/to/chromium python tests/discovery.py
# 其他回歸：tests/flows.py、guide.py、rating.py、energy-board.py、smoke.py
```

瀏覽器測試使用精確單檔產物、Chromium 與明確的 Storage 測試替身；觸控為 CDP 模擬。**不是原生 HTTP 儲存、真實手機或 Safari 驗證。** 本機 HTTP 導航受到環境政策限制，未繞過。GitHub Pages 部署成功也不等於上述實機驗收完成。

分類規則、資料相容與測試邊界見 [docs/DISCOVERY.md](docs/DISCOVERY.md)。較早的 `docs/GUIDE.md`、`docs/TESTING.md`、`docs/ENERGY-BOARD.md` 與 OpenSpec 文件保留歷史設計；衝突時以本版分類規則為準。

## 架構

`src/domain.mjs`：v1→v2 讀取、白名單驗證與計畫規則。`src/discovery-model.mjs`：分類資料操作。`src/discovery.mjs`：二分類、分群、引導及方向銜接。`src/month-order.mjs`：月內排序。`src/guide.mjs`：隔離示範。`src/app.mjs`：頁面、對話框、儲存與匯出。`scripts/build.mjs`：保留模組作用域的單檔建置。

參考 [ORID](https://ica-associates.ca/news/orid-as-an-underlying-structure-for-effective-meeting-design/)、[GROW](https://www.performanceconsultants.com/resources/the-grow-model/) 與 [AntV Infographic](https://github.com/antvis/Infographic)。本版使用原生 SVG，沒有整合 AntV SDK。這是自行設計的回顧工具，不代表機構背書，不是心理治療或心理評量。
