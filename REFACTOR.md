# 健身小助手：重構說明

目標：**對客戶的行為完全不變**（顯示文字、數字、版面、互動都一樣），讓程式更好維護、更穩、可以自動測試。
原版：重構前的單檔 index.html（一份原樣複本放在 `tests/golden/original.html.txt` 給測試用）。

## 一、檔案結構

```
健身-refactor/
├─ index.html          ← 正式上線用（單一檔案，由 tools/build.js 產生，不要直接改）
├─ dev.html            ← 開發用：直接用 <script src> 依序載入 src/ 的原始檔
├─ img/                ← 46 張 wger 示範圖（與原版相同）
├─ src/
│  ├─ style.css        ← 樣式
│  └─ js/
│     ├─ data-exercises.js  動作資料（EXERCISE_ROWS）、女性常練清單、示範圖對照、訓練模板、課表等常數
│     ├─ data-foods.js      食物營養（USDA FDC）與飲食範本輪替池
│     ├─ logic.js           純邏輯：calc、workout、focusList、alts、applySwap、exLine、menu、qty、validSaved
│     ├─ render.js          卡片 HTML 組字串（不碰 DOM）
│     └─ app.js             聊天介面、問答流程、localStorage、事件（唯一碰 DOM 的檔案）
├─ tools/build.js      ← 把 dev.html + src/ 內嵌成單一 index.html
├─ tests/
│  ├─ load.js          ← 用 Node vm 載入網頁腳本（src 版、正式版、原版）
│  ├─ run.js           ← 單元測試＋靜態掃描（約 1 秒）
│  ├─ golden.js        ← 黃金樣本：原版 vs 重構版逐字比對（全量約 2 分鐘，--quick 約 20 秒）
│  └─ golden/original.html.txt  ← 原版 index.html 原樣複本（比對基準）
└─ REFACTOR.md
```

載入順序（dev.html 與 build 都依此）：`data-exercises.js → data-foods.js → logic.js → render.js → app.js`。
各檔用一般全域（頂層 `const` / `function`），不用 ES module，與原版同一語法層級。

### 為什麼「原始碼拆檔、上線單檔」
- 拆檔方便維護與測試；但實測拆檔直接上線在慢網路（RTT 300 ms、1.5 Mbps）下，首屏 DOMContentLoaded 由約 0.73 秒變成約 1.10 秒（多一輪請求），請求數由 1 變 7，也多了「其中一個檔案載不到」與「微信快取新舊檔混用」的風險。
- 所以上線的 `index.html` 由 `tools/build.js` 把 css/js 原封不動內嵌（不壓縮、不刪註解），請求數與原版相同（1 個 HTML ＋ 圖片）。
- 整個資料夾原樣放到 GitHub Pages 根目錄即可；`dev.html`、`src/`、`tests/`、`tools/` 也會被公開，但不影響 `index.html`。

## 二、怎麼改、怎麼測

```bash
cd fit-plan   # 本仓库根目录
# 1. 改 src/ 底下的檔案，用 dev.html 預覽（需用 http 開，例如：python3 -m http.server 8766）
# 2. 產生正式版
node tools/build.js
# 3. 測試
node tests/run.js            # 單元測試＋「index.html 是否最新」檢查
node tests/golden.js --quick # 與原版抽樣比對（約 2 萬筆）
node tests/golden.js         # 與原版全量比對（188,745 筆）
```
不需要安裝任何套件（Node 18+ 即可，已在 Node 22 測過）。
注意：`golden.js` 的定義是「與原版完全相同」。日後如果**刻意**改了文案、公式或資料，黃金比對一定會失敗，這是預期的；那時要把新的上線版複製成新的基準檔（`tests/golden/original.html.txt`）。

## 三、做了哪些改動（與理由）

1. **拆分資料／邏輯／渲染／介面**（見上方結構），`render.js` 只回傳字串、`logic.js` 不碰 DOM，Node 可直接測。
2. **動作資料改成資料列 `EXERCISE_ROWS`**（取代約 110 行 `R(...)` 呼叫），由原檔機械轉出，避免手抄出錯：
   - 只有 6 欄的行＝訓練模板用、沒有 wger 資料的名稱；10 欄＝含 wger id、作者、授權。
   - 3 組「同一 wger 動作、模板用了不同名字」改用第 11 欄**別名**表示（`高脚杯深蹲→哑铃高脚杯深蹲`、`哑铃肩推→哑铃推肩`、`哑铃单臂划船→哑铃单臂划船（扶椅）`）。`buildExercises()` 在原動作後**緊接著**複製一行只換名稱，產生的 `EXI` 與原版逐筆、逐欄、同順序相同（測試驗證），模板比對、換動作排除別名的邏輯都不變。
   - 順序有意義（換動作、重點加練、動作庫依此順序），檔頭註明不可重排。
3. **訓練模板 `LIB` 只留名稱**：原版每個名稱旁重複標註不適部位，經程式驗證全部與動作資料一致，改為直接查動作資料的 `t`，少一處可能不一致的地方。
4. **集中常數**：`PLACE_LV`（gym/home/body → 器材等級，原本兩處重複）、`ACT_FACTOR`、`SESSION_N`、`INJ_NAME`（原本兩處重複）、`EGG`、`MEAL_SHARE`、`LIB_TITLE`、`FOOD_TAG`。飲食中的 12.6、6.3、50 改由雞蛋資料推出（數值與原本完全相同，已驗證）。
5. **去重**：
   - 換動作 `alts` 與重點加練 `focusList` 共用 `usableNames()`；並預先建立索引 `EXG`（類別→動作）、`FOCUS_ROWS`（部位→候選動作），不再每次掃描整個 `EXI`。
   - 「怎么做」區塊原本三處複製貼上，合併為 `howBlock()`。
   - 「换一个」的邏輯抽成 `applySwap(A,i,j)`（原本寫在 click handler 內），可單獨測試。
   - localStorage 讀寫集中為 `loadSaved / saveA / clearSaved`，全部包 try/catch。
6. **刪除死碼**：`PROT`、`CARB`、`VEG`、`BRK`、`SNK`（宣告了但沒有任何地方用到）；CSS 的 `.numrow*`（舊輸入框）、`.kpi.big`（沒有元素用）、`.day:first-of-type`（在所有卡片裡都不會命中，因為第一個 div 都是 `.muted`）。瀏覽器實測刪除前後 1,898 個元素的計算樣式完全相同。
7. **相容性**：`.row.bot:has(.wide) .av2` 改成在列上加 class `has-wide`、用 `.row.has-wide .av2`。新版 Chrome 下結果相同；老版微信（不支援 `:has()`）原本會在整寬卡片左邊多顯示頭像，現在也會正確隱藏。
8. **可靠性／安全**：
   - **存檔檢查 `validSaved()`（修正原版真實存在的注入點）**：原版直接信任 localStorage 的 `fit_A`，其中 `days`、`mins`、換過的動作名稱會原樣拼進 innerHTML。GitHub Pages 同一個 `帳號.github.io` 底下的所有頁面共用 localStorage，所以同網域其他頁面（或壞掉的舊存檔）可以注入 HTML/腳本；實測原版選「继续上次的」後確實會執行注入的腳本。現在存檔格式不對就當作沒有存檔、重新問。本頁自己產生的存檔、缺 `focus/eat/waist/sw` 的舊格式存檔都照常接受。
   - 錯誤提示條（#err）的處理程式移到頁面最前面先註冊（原版在腳本最後才註冊，前面出錯不會顯示）；`#err` 樣式內嵌在 `<head>`。錯誤訊息格式由 `(行號)` 改為 `(檔名:行號)`。
   - dev.html 的每個 `<script src>`／`<link>` 有 `onerror`：檔案載不到時顯示「页面文件加载失败（檔名），请检查网络后刷新页面。」且不啟動問答。正式版是單檔，不會發生。
   - 其餘拼進 HTML 的資料都是本頁常數或計算出的數字，沒有使用者自由輸入；`render.js` 檔頭註明日後若加自由輸入必須先跳脫。
9. **未改**：所有公式、菜單、動作內容、文案、授權與來源標註、頁面骨架、`min-height:100vh`、flex `gap`、`display:grid` 等既有用法、步進器（不用 `<input>`）、聊天流內的 #tray（非固定底欄）、圖片 `loading="lazy"`、B 站搜尋連結（使用者點了才開，原版就有）。

## 四、與原版不同的地方（完整清單）

對客戶顯示的文字與計算結果：**沒有差異**（見驗證）。以下是全部的非輸出差異：
1. 整寬卡片那一列多了 class `has-wide`（取代 `:has()`）；新版瀏覽器外觀相同，老版微信會隱藏頭像（原版在老版微信會顯示）。
2. 錯誤提示條：提早註冊；訊息多了檔名（`页面出错：… (index.html:123)`）；新增檔案載入失敗提示（只在 dev.html 有意義）。
3. localStorage 存檔格式不對時，改為重新問問題（原版會照用，可能顯示錯亂或被注入）。
4. 刪除死碼與無效 CSS（見上）。
5. 檔案大小：原版 78,064 bytes（gzip 27,811）→ 正式版 85,138 bytes（gzip 32,091），**變大約 9%（gzip 約 15%）**；全部來自新增的維護註解。去掉註解後兩者幾乎相同（76,278 vs 76,261 bytes）。

## 五、驗證結果（2026-11-25）

| 項目 | 結果 |
|---|---|
| `node tests/golden.js`（正式版 index.html 對原版） | 188,745 筆全部逐字相同，0 筆不一致 |
| `node tests/golden.js --src`（src/ 原始檔對原版，抽樣） | 19,747 筆，0 筆不一致 |
| 黃金比對的有效性（故意改 1 個係數／對調 2 個模板動作／改 1 個全形冒號） | 3 種突變分別抓到 4,706／3,900／15,600 筆不一致 |
| `node tests/run.js` | 35 項全部通過 |
| 無頭 Chromium 真實點擊完整流程（原版、正式版、dev.html 同一腳本） | 17 個階段的聊天區 HTML 雜湊三者完全相同；新版 0 個 console 錯誤、46 張圖全部載入、375px 寬無橫向溢出 |
| 瀏覽器計算樣式（1,898 個元素 × 45 個屬性） | 原版與正式版雜湊相同 |
| file:// 直接開 index.html、dev.html | 都能啟動、圖片相對路徑可載入 |

載入時間（無頭 Chromium、冷快取、各 7 次取中位數；python http.server，沒有 gzip）：

| | 請求數（不含圖） | 傳輸量 | 本機 DCL | 模擬慢網路 DCL（RTT 300 ms、1.5 Mbps） |
|---|---|---|---|---|
| 原版 | 1 | 78,364 B | 5 ms | 737 ms |
| 正式版 index.html（單檔） | 1 | 85,438 B | 5 ms | 764 ms |
| dev.html（拆檔直接上線的情況） | 7 | 87,478 B | 6 ms | 1,103 ms |

## 六、取捨

- 保留原本的全域函式名稱（calc、workout、menu…），沒有大規模改名：方便與原版逐行對照、黃金比對直接呼叫同名函式。
- 不做壓縮（minify）、不刪註解：上線檔可直接閱讀、除錯行號有意義；代價是多約 7 KB。
- 測試不依賴任何 npm 套件，方便在任何一台電腦直接跑。

## 七、建議（未實作，超出本次範圍）

1. **真機驗證**：在實際的舊版微信（安卓 X5/XWeb、iOS）各開一次，特別看頭像置中（`display:grid` 在 Chromium 57 以前無效）與 chips 間距（flex `gap` 在 Chromium 84 以前無效，原版即如此）。
2. 若要支援更舊的 X5，可把 flex `gap` 改成 margin、`display:grid` 頭像改成 flex 置中（這會改變 CSS，需另外比對）。
3. GitHub Pages 在大陸偶爾很慢或不通；若客戶反映打不開，可考慮同步一份到大陸可達的靜態空間（需另評估）。
4. 示範圖 3.4 MB，可轉 WebP 或壓縮（要確認老版微信支援 WebP）。
5. `tests/golden/original.html.txt` 會跟著整個資料夾公開在 GitHub Pages；如不想公開，可只部署 `index.html` 與 `img/`。
