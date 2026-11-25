/* 測試用載入器：用 Node 的 vm 把網頁的 js 檔「照 dev.html 的順序」載進同一個沙箱，
   和瀏覽器一樣共用全域（頂層 const/function）。DOM 只給最小的假物件，setTimeout 永不觸發，
   所以 app.js 的問答流程會停在第一句，不影響純函式測試。
   用法：const ctx = require('./load.js').load(); vm.runInContext('calc', ctx)
   load()      ：依 dev.html 的順序載入 src/ 原始檔
   loadBuilt() ：載入正式上線的 index.html（單一檔案）裡所有內嵌 <script>，測的就是實際部署的東西
   另提供 loadOriginal(path)：載入「原版單檔 index.html」裡的 <script>，用來做黃金樣本比對。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function stubEl(){
  return {className:'',innerHTML:'',textContent:'',style:{},classList:{toggle(){},add(){},remove(){}},
    appendChild(c){return c},insertBefore(c){return c},remove(){},querySelectorAll(){return []},
    addEventListener(){},setAttribute(){},getAttribute(){return ''},closest(){return null}};
}
function makeContext(){
  const doc = {querySelector(){return stubEl()},createElement(){return stubEl()},getElementById(){return stubEl()},
    addEventListener(){},documentElement:{scrollHeight:0},body:Object.assign(stubEl(),{scrollHeight:0})};
  const store = {};
  const ctx = {document:doc,window:{addEventListener(){},scrollTo(){},isSecureContext:false},navigator:{},
    setTimeout(){},console,FIT_LOAD_FAILED:[],
    localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=String(v)},removeItem(k){delete store[k]}}};
  ctx.window.document = doc;
  return vm.createContext(ctx);
}
// dev.html 裡 <script src> 的順序
function scriptOrder(){
  const html = fs.readFileSync(path.join(ROOT,'dev.html'),'utf8');
  const out = []; const re = /<script src="([^"?]+)(?:\?[^"]*)?"/g; let m;
  while((m = re.exec(html))) out.push(m[1]);
  return out;
}
function load(opts){
  opts = opts || {};
  const ctx = makeContext();
  for(const f of scriptOrder()){
    if(/app\.js$/.test(f) && !opts.app) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'), ctx, {filename:f});
  }
  return ctx;
}
function loadOriginal(file){
  const html = fs.readFileSync(file,'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if(!m) throw new Error('原版檔案裡找不到 <script>');
  const ctx = makeContext();
  // 刻意改動的基準（2026-11-25）：蛋白質係數 1.8→1.6 g/kg（減脂、增肌）。比對基準跟著改，其餘仍是原版。
  const src = m[1].replace("? 1.8 : 1.5;", "? 1.6 : 1.5;");
  if(src === m[1]) throw new Error('原版裡找不到蛋白質係數那一行，基準補丁失效');
  vm.runInContext(src, ctx, {filename:'original'});
  return ctx;
}
// 正式版 index.html：依序執行所有內嵌 <script>（含最前面的錯誤提示條腳本）
function loadBuilt(file){
  const html = fs.readFileSync(file || path.join(ROOT,'index.html'),'utf8');
  const blocks = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  if(blocks.length < 6) throw new Error('index.html 內嵌腳本數量不對：'+blocks.length);
  const ctx = makeContext(); delete ctx.FIT_LOAD_FAILED;   // 由 index.html 自己的開頭腳本定義
  blocks.forEach((b,i) => vm.runInContext(b.slice(8,-9), ctx, {filename:'index.html#script'+i}));
  return ctx;
}
module.exports = {load, loadBuilt, loadOriginal, scriptOrder, ROOT};
