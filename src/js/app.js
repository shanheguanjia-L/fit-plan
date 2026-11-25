/* 聊天介面與問答流程（唯一碰 DOM 的檔案）。最後一個載入。
   頁面開頭的內嵌小段程式（dev.html / index.html）已先註冊錯誤提示條（#err）與 FIT_LOAD_FAILED；
   開發版 dev.html 若前面任一檔案載入失敗就不啟動（正式版 index.html 是單檔，不會有這種情況）。 */

const $ = s => document.querySelector(s);
const chat = $('#chat'), tray = $('#tray');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STORE_KEY = 'fit_A';
const PROG_TOTAL = STEPS.length;   // 題數（見 questions.js）
let answered = 0;
function setProg(n){
  answered = n;
  const i = document.querySelector('#prog i');
  if(i) i.style.width = Math.min(100, Math.round(n/PROG_TOTAL*100)) + '%';
}
let A = {};
let runId = 0;

/* ---------- localStorage：一律包 try/catch（部分環境會丟 SecurityError） ---------- */
// 健康記錄（fit_log）：整份通過 validLog 才用，否則當作沒有
function loadLog(){ try{ const L=JSON.parse(localStorage.getItem(LOG_KEY)||'null'); return validLog(L) ? L : [] }catch(e){ return [] } }
function saveLog(L){ try{ localStorage.setItem(LOG_KEY,JSON.stringify(L)) }catch(e){} }
function loadSaved(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'null') }catch(e){ return null } }
function saveA(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(A)) }catch(e){} }
function clearSaved(){ try{ localStorage.removeItem(STORE_KEY) }catch(e){} }

/* ---------- 聊天泡泡 ---------- */
function el(tag, cls, html){const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e}
function toBottom(){ setTimeout(()=>{ const h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight); window.scrollTo(0,h); },30) }
function add(who, html, wide){
  // wide：整張卡片佔滿寬度，同一列加 has-wide 以隱藏頭像（取代原本的 :has()，老版微信不支援）
  const row = el('div','row '+who+(wide?' has-wide':''));
  row.appendChild(el('div','bub'+(wide?' wide':''), html));
  chat.insertBefore(row, tray); toBottom(); return row;
}
async function say(html, wide){
  const t = add('bot','<span class="typing"><span></span><span></span><span></span></span>');
  await sleep(wide?500:350+Math.min(html.length*9,800));
  t.remove(); add('bot',html,wide);
}
function clearTray(){tray.innerHTML=''}

/* ---------- 回答元件（都放在聊天流最後的 #tray，隨頁面自然捲動） ----------
   選項文字、說明都是本頁常數（questions.js），不接受使用者輸入（innerHTML 安全）。
   opts[i]：{label, value, sub?（一行說明）, rec?（顯示「建議」）, id?, cls?}；
   o.back 為 true 時多一個「改上一題」；o.rows 為 true 或任一選項有 sub 時，用整列可點的版面。 */
const BACK = {};   // 使用者按「改上一題」時回傳的標記
let lastOpt = null;   // 最近一次點選的選項（讓 react 能依選項回應，例如兩個選項的 value 相同時）
function backBtn(box,res){
  const b = el('button','chip ghost back','← 改上一题');
  b.onclick = ()=>{ clearTray(); res(BACK) };
  box.appendChild(b);
}
const recTag = x => x.rec ? '<span class="rec">建议</span>' : '';
const optHtml = (x,rows) => rows ? '<b>'+x.label+recTag(x)+'</b>'+(x.sub?'<small>'+x.sub+'</small>':'') : x.label+recTag(x);
// 单选
function pick(q, opts, o){
  o = o||{};
  return new Promise(async res=>{
    if(q) await say(q);
    clearTray();
    const rows = !!o.rows || opts.some(x=>x.sub);
    const box = el('div', rows?'opts':'chips');
    opts.forEach(x=>{
      const b = el('button','chip'+(rows?' opt':'')+(x.cls?' '+x.cls:''), optHtml(x,rows));
      b.onclick = ()=>{ lastOpt = x; add('user',x.label); clearTray(); res(x.value) };
      box.appendChild(b);
    });
    if(o.back) backBtn(box,res);
    tray.appendChild(box); toBottom();
  });
}
// 多选；exclusive 表示与其他互斥的选项（如“没有”）。选项里 {header:'上半身'} 是分组标题（不能点）；
// o.max：最多选几个，超过时自动取消最早选的那个。
function multi(q, opts, exclusive, o){
  o = o||{};
  return new Promise(async res=>{
    await say(q); clearTray();
    const real = opts.filter(x=>!x.header);
    const rows = !!o.rows || real.some(x=>x.sub);
    const box = el('div', rows?'opts':'chips'); const sel = new Set(); const btns = [];
    opts.forEach(x=>{
      if(x.header){ if(rows) box.appendChild(el('div','ogrp',x.header)); return }
      const b = el('button','chip'+(rows?' opt':''),optHtml(x,rows));
      b.onclick = ()=>{
        if(sel.has(x.value)){sel.delete(x.value)}
        else{
          if(x.value===exclusive){sel.clear()} else {sel.delete(exclusive)}
          sel.add(x.value);
          if(o.max && x.value!==exclusive && sel.size>o.max) sel.delete(sel.values().next().value);
        }
        btns.forEach((y,i)=>y.classList.toggle('on', sel.has(real[i].value)));
      };
      btns.push(b); box.appendChild(b);
    });
    const ok = el('button','chip go','确定');
    ok.onclick = ()=>{
      if(!sel.size){ sel.add(exclusive) }
      const labels = real.filter(x=>sel.has(x.value)).map(x=>x.label).join('、');
      add('user',labels); clearTray(); res([...sel]);
    };
    box.appendChild(ok);
    if(o.back) backBtn(box,res);
    tray.appendChild(box); toBottom();
  });
}
// 身体数据卡：几行「− ＋」数字，一次填完。不用 <input>（微信里不显示），也不弹键盘。
// 起始数字只是示例：必填项要点过 − ＋ 或点一下数字才算确认，没确认前「确定」按钮是灰的并写明还差几项，
// 避免不小心拿示例数字去算计划。选填项（腰围）默认「未填」，点数字可在「未填」和「已填」间切换。
function nums(q, fields, o){
  o = o||{};
  return new Promise(async res=>{
    await say(q); clearTray();
    const wrap = el('div','nbox'); const S = {}, refresh = [];
    const fmt = (f,x)=> (String(f.s1).indexOf('.')>=0) ? (Math.round(x*10)/10).toFixed(1) : String(Math.round(x));
    const ok = el('button','chip go','确定');
    const syncOk = ()=>{
      const left = fields.filter(f=>!f.optional && !S[f.k].touched);
      if(left.length){ ok.textContent='还差 '+left.length+' 项没确认：'+left.map(f=>f.label).join('、'); ok.className='chip ok0'; ok.disabled=true }
      else { ok.textContent='确定'; ok.className='chip go'; ok.disabled=false }
    };
    fields.forEach(f=>{
      const s = S[f.k] = {v:f.def, touched:false, on:!f.optional};
      const row = el('div','nrow');
      row.appendChild(el('div','nlab',f.label+(f.optional?'<small>选填</small>':'')));
      const val = el('button','nval','');
      const sync = ()=>{
        val.textContent = (f.optional && !s.on) ? '未填' : fmt(f,s.v)+' '+f.unit;
        val.className = 'nval'+(s.touched && s.on ? ' on' : '');
        val.style.setProperty('--off', (-s.v*8)+'px');
        syncOk();
      };
      const mk = (label,d)=>{
        const b = el('button','chip nbtn',label);
        b.onclick = ()=>{ s.v = Math.min(f.max, Math.max(f.min, Math.round((s.v+d)*10)/10)); s.touched = true; s.on = true; sync() };
        return b;
      };
      val.onclick = ()=>{
        if(f.optional){ s.on = !s.on; s.touched = s.on }   // 选填：点数字 = 在「未填」与「已填」之间切换
        else { s.touched = true }
        sync();
      };
      row.appendChild(mk('−'+f.s2,-f.s2)); row.appendChild(mk('−'+f.s1,-f.s1));
      row.appendChild(val);
      row.appendChild(mk('+'+f.s1,f.s1)); row.appendChild(mk('+'+f.s2,f.s2));
      wrap.appendChild(row); refresh.push(sync);
    });
    refresh.forEach(fn=>fn());
    const act = el('div','sact');
    ok.onclick = ()=>{
      const out = {}; const parts = [];
      fields.forEach(f=>{
        const s = S[f.k];
        if(f.optional && !s.on){ out[f.k] = null; return }
        out[f.k] = s.v; parts.push((f.optional?f.label+' ':'')+fmt(f,s.v)+' '+f.unit);
      });
      add('user', parts.join(' · ')); clearTray(); res(out);
    };
    act.appendChild(ok);
    if(o.back) backBtn(act,res);
    wrap.appendChild(act);
    tray.appendChild(wrap); toBottom();
  });
}

function copyText(t){
  try{ if(navigator.clipboard && window.isSecureContext){ return navigator.clipboard.writeText(t) } }catch(e){}
  const ta=el('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity=0; document.body.appendChild(ta); ta.select();
  try{document.execCommand('copy')}catch(e){} ta.remove(); return Promise.resolve();
}

/* ================= 对话流程 ================= */
/* ---------- 轉介之後：只能看健康知識或重新開始 ---------- */
async function referralMenu(my){
  while(true){
    const x = await pick('',[{label:'看健康知识',value:'k'},{label:'重新开始',value:'r',cls:'ghost'}]);
    if(my!==runId) return;
    if(x==='k') await say(healthKnowledgeCard(),true);
    else { start(); return }
  }
}

/* ---------- 健康管理：知识库、记录与趋势、不适与运动调整 ---------- */
async function healthFlow(my){
  while(true){
    const x = await pick('想看哪一部分？',[
      {label:'健康知识',sub:'运动量、久坐、睡眠、喝水、体重、经期、孕期与产后',value:'k'},
      {label:'健康记录与趋势',sub:'记体重、腰围、睡眠、饮水，看变化曲线',value:'l'},
      {label:'不适与运动调整',sub:'膝盖、腰背、肩颈不舒服时怎么办',value:'d'},
      {label:'返回',value:'b',cls:'ghost'}].filter(o=>!(A.nonum && o.value==='l')));   // 選了「不看數字」就不顯示體重記錄
    if(my!==runId) return;
    if(x==='k') await say(healthKnowledgeCard(),true);
    else if(x==='d') await say(discomfortCard(A),true);
    else if(x==='l') await logFlow(my);
    else return;
  }
}
async function logFlow(my){
  while(true){
    const L = loadLog();
    await say(logCard(L,A.height),true);
    const opts = [{label:'记今天',value:'r'}];
    if(L.length){ opts.push({label:'复制记录',value:'c',cls:'ghost'}); opts.push({label:'清除记录',value:'x',cls:'ghost'}) }
    opts.push({label:'返回',value:'b',cls:'ghost'});
    const x = await pick('',opts);
    if(my!==runId) return;
    if(x==='r') await recordToday();
    else if(x==='c'){ await copyText(logText(L)); await say('已复制。可以粘贴到备忘录里备份。') }
    else if(x==='x'){
      const y = await pick('清除后无法恢复，确定吗？',[{label:'确定清除',value:'y'},{label:'先不清除',value:'n',cls:'ghost'}]);
      if(y==='y'){ saveLog([]); await say('已清除。') }
    }
    else return;
  }
}
async function recordToday(){
  const L = loadLog();
  const lastOf = k => { const s=logSeries(L,k); return s.length ? s[s.length-1].v : null };
  const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
  const fields = [
    {k:'w',label:'体重',unit:'kg',min:30,max:150,def:clamp(lastOf('w')||A.weight||55,30,150),s1:0.5,s2:5,optional:true},
    {k:'wa',label:'腰围',unit:'cm',min:50,max:140,def:clamp(lastOf('wa')||A.waist||70,50,140),s1:1,s2:5,optional:true},
    {k:'s',label:'睡眠',unit:'小时',min:3,max:14,def:clamp(lastOf('s')||7,3,14),s1:0.5,s2:1,optional:true},
    {k:'h',label:'饮水',unit:'杯',min:0,max:20,def:clamp(lastOf('h')||6,0,20),s1:1,s2:2,optional:true}];
  const mark = rowCount();
  const v = await nums('记一下今天的情况。点数字填上，没记的项目保持「未填」就行。',fields,{back:true});
  if(v===BACK){ dropRowsFrom(mark); return }
  const e = {d:dateKey(new Date())}; LOG_FIELDS.forEach(k=>{ if(typeof v[k]==='number') e[k]=v[k] });
  if(LOG_FIELDS.every(k=>typeof e[k]!=='number')){ await say('这次什么都没填，所以没有记录。'); return }
  saveLog(logUpsert(L,e));
  await say('已记下 '+e.d+' 的情况。');
}

async function showResult(my){
  setProg(PROG_TOTAL);
  const C = calc(A);
  await say(summaryCard(A,C),true);
  while(true){
    if(my!==runId) return;
    const c = await pick('想先看哪一部分？',[
      {label:'训练计划',value:'w'},{label:'饮食计划',value:'m'},{label:'动作库',value:'x'},{label:'食物库',value:'f'},{label:'健康管理',value:'h'},{label:'小贴士',value:'t'},
      {label:'复制训练摘要',value:'c',cls:'ghost'},{label:'重新开始',value:'r',cls:'ghost'}]);
    if(my!==runId) return;
    if(c==='w') await say(workoutCard(A),true);
    else if(c==='m') await say(menuCard(A,C),true);
    else if(c==='f') await say(foodLibCard(A),true);
    else if(c==='h') await healthFlow(my);
    else if(c==='x'){
      const sc = await pick('看哪一类动作？',[{label:'徒手动作',value:0},{label:'哑铃/弹力带',value:1},{label:'健身房器械',value:2},{label:'热身与拉伸',value:'st'},{label:'女性常练',value:'w'}]);
      await say(exLibCard(sc,A),true);
    }
    else if(c==='t') await say(tipsCard(A,C),true);
    else if(c==='c'){ await copyText(planText(A,C)); await say('已复制，可以直接粘贴发给朋友或存到备忘录。'); }
    else if(c==='r'){ clearSaved(); start(); return }
  }
}
/* 問卷內容（問什麼、選項、回應）在 questions.js；這裡只負責畫出來。
   「改上一題」：把這一題與上一題在聊天裡留下的泡泡一起移除，重新問上一題。 */
function askStep(st,bk){
  const q = typeof st.q==='function' ? st.q(A) : st.q;
  if(st.type==='nums') return nums(q, st.fields, {back:bk});
  const opts = st.opts(A);
  if(st.type==='multi') return multi(q, opts, 'none', {back:bk, rows:st.rows, max:st.max});
  return pick(q, opts, {back:bk, rows:st.rows});
}
const rowCount = () => chat.querySelectorAll('.row').length;
const dropRowsFrom = n => [].slice.call(chat.querySelectorAll('.row')).slice(n).forEach(r=>r.remove());

/* 舊存檔補答：只問後來新增、這份存檔還沒答過的題目（questions.js 裡有 need 的步驟），其他資料保留。
   補答時一樣會做安全篩檢與年齡門檻；不符就轉介、刪除存檔。 */
async function supplement(my){
  const refer = async reasons => { clearSaved(); setProg(PROG_TOTAL); await say(referralCard(reasons),true); await referralMenu(my); return false };
  const body = STEPS.filter(s => s.k==='body')[0];
  const ageStop = body.gate(A,{age:A.age});                       // 舊存檔的年齡可能不在 18–64，先擋，免得白答
  if(ageStop) return refer(ageStop);
  const need = STEPS.filter(st => st.need && st.need(A));
  if(need.length) await say('问卷新增了 '+need.length+' 个问题，补答一下就好，其他资料不用重新填。');
  for(const st of need){
    lastOpt = null;
    const v = await askStep(st,false);
    if(my!==runId) return false;
    st.set(A,v);
    const t = st.react ? st.react(v,A,lastOpt) : null;
    if(t) await say(t);
    const stop = st.gate ? st.gate(A,v) : null;
    if(stop) return refer(stop);
  }
  if(need.length) saveA();
  return true;
}
async function flow(my){
  chat.querySelectorAll('.row').forEach(r=>r.remove()); clearTray(); A={}; setProg(0);
  let saved=loadSaved();
  if(saved && !validSaved(saved)) saved=null;   // 存檔格式不對就當作沒有，重新問
  await say('你好呀，我是健身小助手。回答几个小问题，我就能按你的身体情况，排出训练和饮食计划。');
  if(saved){
    const r = await pick('看到你上次已经做过一份计划，要继续用吗？',[{label:'继续上次的',value:'y'},{label:'重新来一份',value:'n'}]);
    if(r==='y'){ A=saved; if(await supplement(my)) return showResult(my); return }
  }
  await say(INTRO_HINT);
  const marks=[];
  let i=0;
  while(i<STEPS.length){
    if(my!==runId) return;
    const st=STEPS[i]; marks[i]=rowCount(); setProg(i);
    lastOpt = null;
    const v = await askStep(st, i>0);
    if(my!==runId) return;
    if(v===BACK){ dropRowsFrom(marks[i]); i--; dropRowsFrom(marks[i]); continue }
    st.set(A,v);
    const t = st.react ? st.react(v,A,lastOpt) : null;
    if(t) await say(t);
    const stop = st.gate ? st.gate(A,v) : null;              // 保守版：篩檢或年齡不符就轉介，不給計劃
    if(stop){ clearSaved(); setProg(PROG_TOTAL); await say(referralCard(stop),true); return referralMenu(my) }
    i++;
  }
  saveA();
  await say('好的：目标'+GOAL[A.goal]+'，'+A.age+' 岁、'+A.height+' cm、'+A.weight+' kg，每周练 '+A.days+' 次，每次约 '+A.mins+' 分钟。我来算一下……');
  await showResult(my);
}
function start(){ runId++; flow(runId) }

// 「换一个」：事件委派；换完重画所在的那张训练卡
chat.addEventListener('click',function(ev){
  const b = ev.target.closest ? ev.target.closest('.swp') : null; if(!b) return;
  const key=b.getAttribute('data-k').split('-');
  if(!applySwap(A,+key[0],+key[1])) return;
  saveA();
  b.closest('.bub').innerHTML=workoutCard(A);
});

if(!FIT_LOAD_FAILED.length) start();
