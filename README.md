# 拾光 Life Atlas

年度事件回顧、能量曲線、二分類／分群、候選路線與生活實驗。繁體中文，單人，本機保存。

[使用網頁版](https://world4jason.github.io/life-tool/) · [分群畫布示範](https://world4jason.github.io/life-tool/?guide=1&step=3&method=group&v=canvas-4)

## 使用

Node.js 22+，目前正式 runtime 沒有 npm 安裝依賴。

```sh
npm run dev
# http://localhost:4173
npm run check
npm run build
# dist/index.html 為自包含的離線檔。
```

GitHub Pages 可繼續以 `main / (root)` 部署。根目錄使用原生 ES modules 與 import map；單檔建置會內嵌模組並移除 import map。沒有 CDN 或外部字型請求。

## 流程

| 頁面 | 操作 |
| --- | --- |
| 拾起片刻 | 每月 0–3 張事件卡；日常背景另外記錄。 |
| 看見起伏 | 能量評分與月內拖曳排序。此階段不要求情緒標籤，也沒有額外的觀察表單。 |
| 發現線索 | 二分類：選詞，判斷有關／無關；未操作保留未判斷。分群：把事件成群後命名。 |
| 打開可能 | 選擇接下來想保留或改變的方向，再比較不同做法。來源可用路線圖檢視。 |
| 帶走實驗 | 原方向 O／成果 KR／行動結構，記錄驗收、頻率、開始線索、縮小版本及回顧日。 |
| 回來看看 | 記錄執行量與是否支持方向，允許調整、暫停或停止。 |

桌面分群預設畫布，提供平移、縮放、框選、成群、命名、拖曳換群、群組移動、定位、整理、復原／重做與展開。二分類預設逐張，亦可切換畫布。手機預設逐張／清單，不要求使用者靠拖曳或縮放完成任務。

畫布只提供任務需要的工具，不是完整白板。路線圖連線來自原本的關聯資料，不是可以任意畫出的新關係。拖動群組框／路線節點不會改寫原本的目標或分類。

本版使用原生 DOM / SVG canvas adapter，**沒有整合 React Flow、tldraw、Excalidraw 或 AFFiNE 的 runtime**。React Flow 的隔離建置嘗試未成功啟動，詳見 [研究與取捨](docs/CANVAS-RESEARCH.md)。

## 保存與隱私

事件資料保持 version 2，沿用原本的個人與示範儲存鍵及 v1 遷移。畫布版面分開保存，只含座標與識別碼。

JSON 備份包含事件、分類、路線、行動與回顧，**未加密，也包含私密卡文字**。私密標記是畫面遮蔽，不是密碼或存取控制。JSON 不包含畫布位置；在另一台裝置匯入後自動排列。

引導示範在隔離的記憶體副本操作，退出恢復個人紀錄。沒有帳號、雲端同步、多人協作或自動通知。表單須按儲存，尚未提交的輸入不是自動儲存的草稿。清除瀏覽器資料可能刪除紀錄，請定期備份。

## 驗證

```sh
npm run check
npm run build
# 需 Python + Playwright + 已安裝 Chromium
python tests/canvas.py
python tests/canvas-journey.py
python tests/discovery.py
python tests/flows.py
python tests/guide.py
python tests/rating.py
python tests/energy-board.py
python tests/smoke.py
```

[UI / UX 角色走查](docs/CANVAS-REVIEW.md) · [最新測試結果](docs/canvas-validation.json) · [流程研究](docs/CANVAS-RESEARCH.md)

角色走查是同一位實作者的模擬檢查，不是獨立真人測試。瀏覽器驗證採本機單檔與 Storage shim，不等同真實手機、Safari、螢幕閱讀器或 HTTP 儲存驗收。Pages 部署結果與產品驗證分開記錄。

## 程式結構

- `src/domain.mjs`：資料規則、驗證、備份相容、計畫與回顧。
- `src/discovery-model.mjs`：二分類、群組與引用操作。
- `src/discovery.mjs`：兩種操作方式、引導、命名與方向交接。
- `src/canvas-model.mjs`：畫布呈現資料、佈局驗證與座標計算。
- `src/canvas.mjs`：DOM / SVG 畫布與手勢 adapter。
- `src/app.mjs`：其他關卡、儲存、防衝突與資料匯出。

這是自行設計的回顧與規劃工具，不是心理治療，沒有機構授權、認證或效果背書。
