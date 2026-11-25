/* 產生正式上線用的單一檔案 index.html：node tools/build.js
   做法：讀 dev.html，把 <link rel="stylesheet" href="src/…"> 換成 <style>檔案內容</style>，
   把 <script src="src/…"></script> 換成 <script>檔案內容</script>。其餘一字不改、不壓縮、不刪註解。
   為什麼要內嵌成單檔：客戶在大陸用微信開 GitHub Pages，每多一輪請求就多一次延遲與失敗機會；
   拆檔版實測在 RTT 300 ms 的慢網路下首屏多約 0.36 秒，也會有微信快取「新舊檔混用」的風險。
   開發時改 src/ 底下的檔案、用 dev.html 預覽；改完一定要重跑本腳本（tests/run.js 會檢查 index.html 是否最新）。 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

function build(){
  const dev = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');
  const read = f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/<\/(script|style)/i.test(s)) throw new Error(f + ' 內含 </script> 或 </style>，不能直接內嵌');
    return s.replace(/\s+$/, '');
  };
  let n = 0;
  let out = dev
    .replace(/<!-- 開發用頁面：[\s\S]*?-->\n/, '<!-- 此檔由 node tools/build.js 從 dev.html 與 src/ 產生，請勿直接修改。 -->\n')
    .replace(/<link rel="stylesheet" href="(src\/[^"]+)"[^>]*>/g, (m, f) => { n++; return '<style>\n/* ==== ' + f + ' ==== */\n' + read(f) + '\n</style>' })
    .replace(/<script src="(src\/[^"]+)"[^>]*><\/script>/g, (m, f) => { n++; return '<script>\n/* ==== ' + f + ' ==== */\n' + read(f) + '\n</script>' });
  if (/ src="src\/| href="src\//.test(out)) throw new Error('還有沒內嵌到的 src/ 引用');
  return {html: out, files: n};
}
module.exports = build;

if (require.main === module) {
  const r = build();
  fs.writeFileSync(path.join(ROOT, 'index.html'), r.html);
  console.log('已產生 index.html（內嵌 ' + r.files + ' 個檔案，' + Buffer.byteLength(r.html) + ' bytes）');
}
