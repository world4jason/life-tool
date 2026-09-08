# 畫布改版：流程參考與取捨

## 查核範圍

本輪一般網頁搜尋不可用。透過已連接的 GitHub 讀取下列官方 repository 文件；沒有登入、操作或實測競品 SaaS。教練段落是既有方法的設計對照，不是本輪取得的教練訪談，也不代表心理療效驗證。

| 來源 | 文件能支持的內容 | 本版採用 | 不採用 |
| --- | --- | --- | --- |
| [Parabol 官方 README](https://github.com/ParabolInc/parabol/blob/master/README.md) | 明確列出 reflect / group / vote / discuss / action 回顧流程，並提供免登入示範入口 | 分階段整理、分群與行動銜接；示範使用隔離資料 | 不把團隊投票搬成人生排名；不加入多人會議、AI 或自動選目標 |
| [Retrospected 官方 README](https://github.com/antoinejaussoin/retro-board/blob/develop/README.md) | 拖曳支援重排與分群；產品另有 moderator / grouping 設定 | 拖曳與直接操作卡片；另外提供不需拖曳的移動按鈕 | 不加入主持人權限、GIF、訂閱與協作平台 |
| [React Flow 官方 README](https://github.com/xyflow/xyflow/blob/main/packages/react/README.md) | 自訂節點／連線、平移、縮放、多選、小地圖；MIT 授權 | 作為畫布能力與 adapter 邊界的參考 | 本版未嵌入 React Flow，也未宣稱第三方引擎效能已驗證 |
| [Excalidraw 官方 README](https://github.com/excalidraw/excalidraw/blob/master/README.md)（前輪查核） | 編輯器有平移、縮放、復原／重做；官網協作等功能與套件功能分開列出 | 精簡工具列與可恢復操作 | 不把所有繪圖工具、帳號、協作或加密承諾一併帶入 |

這些專案只作流程與互動參考，沒有複製競品的產品程式碼、素材或品牌。上述參考不證明本工具已改善使用者的年度回顧或生活成效。

## 教練流程如何落在介面

GROW 與 ORID 的來源入口沿用前輪討論：[Performance Consultants / GROW](https://www.performanceconsultants.com/resources/the-grow-model/)、[ICA / ORID meeting design](https://ica-associates.ca/news/orid-as-an-underlying-structure-for-effective-meeting-design/)。本輪無法重新開啟這兩個網站，因此以下是設計應用，不是新增查核結果。

| 流程功能 | 介面行為 |
| --- | --- |
| 事實與現況 | 月份、事件與能量留在前兩關，不提前要求價值或情緒標籤。 |
| 理解經驗 | 二分類判斷有關／無關；分群整理事件並命名。未操作不代表無關。 |
| 當事人選擇方向 | 分類詞只描述經驗；到「打開可能」才確認想保留或改變什麼。不由數量、能量或程式替人選擇。 |
| Options | 同一方向可提出不同做法、比較資源與代價，不只是增加次數。路線圖保留未選路線。 |
| 行動與回看 | 從已選路線建立實驗，保留原驗收、頻率、支持與回顧日；回顧連回真正的行動 ID。 |

不用每一個理論字母再開一份表單。沒有重新加入已要求移除的「觀察」區；分類仍只有二分類與分群。

## 本輪技術決定

React Flow 是前輪的第一候選，本輪確實建立隔離分支嘗試建置 React 18.3.1 與 React Flow 12.11.6。[Actions run 34266524955](https://github.com/world4jason/life-tool/actions/runs/34266524955) 在啟動階段回報 failure，job 未提供 steps，因此不能歸因為 React Flow 編譯失敗，也不能說該套件通過測試。

正式改版採原生 DOM / SVG 的小型 canvas adapter，只提供本流程需要的卡片、群組、平移、縮放、框選、定位、版面整理與關聯圖。未將失敗的套件建置流程或未驗證的 runtime 接到 main。

`canvas-model.mjs` 產生呈現資料，`canvas.mjs` 處理視角與手勢；事件／詞語／群組的資料修改仍經 `discovery-model.mjs` 和既有驗證交易。後續更換引擎不需改變二分類、群組或 OKR 的資料意義。

這不是完整 Miro 替代品。沒有自由畫筆、任意連線、多人協作、雲端同步、自由排版文件或無限層級群組。卡片從一個語意區移到另一區會修改分類；拖動群組框或路線節點只改版面。群組名稱與後續方向不會自動互相覆寫。

版面位置與鏡頭分開儲存到 `life-atlas.canvas.v1.<workspace-id>.<kind>.<theme-id>`，只含 ID 與座標，不含事件文字。JSON 備份仍保留內容、分類、路線、行動和回顧，**不包含畫布版面**；在新瀏覽器匯入時自動排列。這個限制在畫布「操作說明」中明列。清除瀏覽器資料仍可能遺失本機紀錄，應定期備份。
