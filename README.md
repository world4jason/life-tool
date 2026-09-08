# 拾光 Life Atlas

**事件是素材，主題是假設，行動是實驗。**

以繁體中文設計的年度回顧網頁遊戲。支援手機、平板與桌面；不用帳號，不上傳生活紀錄，沒有排行榜。先從「先玩一輪示範」認識流程，示範資料完全虛構，與個人探索桌分開儲存。

## 開始使用

需要 Node.js 22 或更新版本；沒有 npm 安裝依賴。

```sh
git clone https://github.com/world4jason/life-tool.git
cd life-tool
npm run dev
# 開啟 http://localhost:4173
```

打包成可直接開啟、沒有外部資源的單一 HTML：

```sh
npm run check
npm run build
# dist/index.html：CSS 與程式都內嵌，可下載後離線開啟。
# 檔案網址的儲存行為依瀏覽器而異，正式使用建議透過 HTTP(S)。
node scripts/serve.mjs --dist
```

也可以使用任何靜態主機直接提供專案根目錄，不必先建置。所有資源採用相對路徑，適用 GitHub Pages 專案子路徑。

### GitHub Pages

在 repository 的 **Settings → Pages → Deploy from a branch → main / (root) → Save** 啟用。根目錄已提供入口、原始模組與 `.nojekyll`；不需要自訂建置流程，但 Pages 本身仍經由 GitHub Actions 部署。啟用成功後，以 Pages 設定頁顯示的實際網址為準。本專案交付不代表已經修改 Pages 管理設定或完成線上部署。

[GitHub 官方部署說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 怎麼玩

| 關卡 | 實際操作 |
| --- | --- |
| 拾起片刻 | 每月 0–3 張事件卡；先寫事實、計畫／意外／混合／不確定。持續發生的日常另放背景區。 |
| 看見起伏 | 以 −10～＋10 記錄能量；可以不評分。情緒、重要性與回應空間分開。提供年度 SVG 曲線與逐月卡片。 |
| 發現線索 | 先選事件聚類，或先選／自訂價值詞。卡片可連到多個主題；記錄反例、另一種解讀與未來方向。 |
| 打開可能 | 先探索做更多、做更少、換方法、維持現況、暫時不做，再比較時間／金錢／心力。提問卡、選擇理由、時間減半壓力測試與可撤回的第一步。 |
| 帶走實驗 | 方向 O → 成果 KR → 行動，可多層拆解；也可先寫行動再向上聚類。區分習慣、體驗、成果、界線、固定流程，寫驗收、頻率、觸發條件、縮小版與備案。 |
| 回來看看 | 完整執行、縮小版、未執行與純反思分開；同時追蹤執行量與方向感受。允許維持、調整、減量、暫停、停止。 |

### 兩個 O，不混在一起

**ORID 的 Objective** 放在回顧開頭：先記錄發生的事，暫緩詮釋。**GROW 的 Options** 放在主題與行動之間：比較不同路線，而不只是把同一個方法增加次數。比較後才選擇、寫理由與備案；可以保留未選路線，或記錄「先不比較／暫不新增目標」。系統不強迫湊出特定數量的目標。

主題不是 AI 判決，能量不是人生分數。圖上的線只是串聯被選出的事件，不是全年連續心理狀態量測。沒有事件的月份不補零，未評分與零分不同。切換「當時／現在回看」評分視角需要確認，並清空分數以免混用定義，事件文字仍保留。

## 保存、匯出與隱私

按對話框的「儲存」後保存至本機；**尚未送出的表單不是自動保存草稿**。每個瀏覽器／網站來源的個人桌與示範桌各保留一輪，跨裝置需匯出、匯入 JSON，沒有雲端同步。

完整 JSON 備份包含私密文字，**不是加密檔**。私密標記只遮蔽畫面文字，不是身份驗證或存取控制。SVG 探索地圖排除私密事件，但主題／行動裡手寫的私人內容仍需要自行檢查；摘要最多呈現前六個主題、前六個行動，完整資料在 JSON。

匯入先驗證版本、大小、欄位、關聯和循環，再要求確認取代；不做隱式合併。舊資料格式損壞時保留原始內容，提供下載而不是用空白覆蓋。儲存空間不足時顯示「尚未儲存」並保留記憶體內容；偵測其他分頁更新後暫停寫入，讓使用者先下載本頁版本再決定。

請定期下載備份。清除瀏覽器資料、裝置故障或無痕模式都可能造成紀錄遺失。不要把自己的 JSON 回顧紀錄提交到公開 repository。

## 開發與驗收

```sh
npm run check     # 語法 + 40 個 domain tests
npm run build     # 單檔離線產物
# UI 測試需 Python、Playwright 與 Chromium（不是應用程式的執行依賴）
python -m pip install playwright
python -m playwright install chromium
CHROMIUM_PATH=/path/to/chromium python tests/smoke.py
CHROMIUM_PATH=/path/to/chromium python tests/flows.py
```

初版驗證結果：**40 個 domain tests、27 個 UI 檢查、5 種寬度 × 7 關卡的版面檢查通過**。UI 測試直接載入建置後的單檔 HTML，使用 deterministic Storage shim，驗證序列化、重載、配額錯誤與衝突邏輯；不是原生瀏覽器儲存可靠性的證明。

測試環境限制、手動驗收與尚未完成的項目見 [docs/TESTING.md](docs/TESTING.md)。規則規格見 [openspec/specs/year-journey/spec.md](openspec/specs/year-journey/spec.md)；這份規格採 Requirement／Scenario 格式，未宣稱跑過 OpenSpec CLI 驗證。

### 架構

- `src/domain.mjs`：純資料規則、白名單匯入、時間週期、資源計算與關聯刪除。
- `src/app.mjs`：七個關卡、原生 dialog、儲存衝突处理與 JSON／SVG 匯出。
- `src/styles.css`：響應式版面、觸控與鍵盤樣式、減少動態效果與列印樣式。
- `scripts/build.mjs`：把本地模組與 CSS 內嵌為單一 HTML，無 CDN。

採原生 ES modules、CSS 與 SVG，沒有 React／AntV runtime 依賴。AntV Infographic 是資訊图設計參考，**本版沒有宣稱已整合 AntV**；後續如需更多摘要模板，可以用 adapter 替換摘要 renderer，而不改資料模型。

## 方法與設計來源

[ICA：ORID 對話與年度規劃](https://ica-associates.ca/news/orid-as-an-underlying-structure-for-effective-meeting-design/) · [Performance Consultants：GROW](https://www.performanceconsultants.com/resources/the-grow-model/) · [AntV Infographic](https://github.com/antvis/Infographic)

這是自行設計的反思與規劃遊戲，不代表上述機構的授權、認證或背書，也不是心理治療或已獲臨床驗證的介入。可以跳過、停止、不分享，不要求低谷都產生收穫。
