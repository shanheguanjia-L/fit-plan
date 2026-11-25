/* 健康管理庫的邏輯與卡片 HTML（純函式，不碰 DOM；瀏覽器與 Node 測試共用）。資料在 data-health.js。
   安全前提：拼進 HTML 的只有本頁常數（data-health.js）、動作庫名稱，以及經 validLog() 檢查過的「數字」與日期（固定格式）；
   沒有任何使用者自由輸入的文字。
   語法層級與其他檔案相同（const/let、箭頭函式），不用 ?. ?? 與 ES module，以相容老版微信。 */

/* ---------- 健康記錄：資料格式與檢查 ---------- */
const LOG_KEY = 'fit_log';
const LOG_MAX = 366;                                   // 最多留一年
// 欄位：w 體重 kg、wa 腰圍 cm、s 睡眠 小時、h 飲水 杯；值可以是 null（當天沒記）
const LOG_RANGE = {w:[20,250], wa:[30,200], s:[0,24], h:[0,40]};
const LOG_FIELDS = ['w','wa','s','h'];
const LOG_LABEL = {w:'体重',wa:'腰围',s:'睡眠',h:'饮水'};
const LOG_UNIT = {w:'kg',wa:'cm',s:'小时',h:'杯'};

function dateKey(dt){                                  // 本機日期 YYYY-MM-DD（中國使用者用手機本地時間）
  const p=n=>(n<10?'0':'')+n;
  return dt.getFullYear()+'-'+p(dt.getMonth()+1)+'-'+p(dt.getDate());
}
function isDateKey(s){
  if(typeof s!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y=+s.slice(0,4), m=+s.slice(5,7), d=+s.slice(8,10), t=new Date(y,m-1,d);
  return y>=2000 && y<=2100 && t.getFullYear()===y && t.getMonth()===m-1 && t.getDate()===d;
}
function validLogEntry(e){
  if(!e || typeof e!=='object' || Array.isArray(e) || !isDateKey(e.d)) return false;
  let any=false;
  for(const k in e){ if(k!=='d' && LOG_FIELDS.indexOf(k)<0) return false }
  for(const k of LOG_FIELDS){
    const v=e[k];
    if(v===null || v===undefined) continue;
    if(typeof v!=='number' || !isFinite(v) || v<LOG_RANGE[k][0] || v>LOG_RANGE[k][1]) return false;
    any=true;
  }
  return any;
}
// 整份記錄：陣列、日期遞增且不重複、每筆合法、不超過上限；不合法就整份當作沒有（避免注入與程式出錯）
function validLog(L){
  if(!Array.isArray(L) || L.length>LOG_MAX) return false;
  for(let i=0;i<L.length;i++){
    if(!validLogEntry(L[i])) return false;
    if(i>0 && !(L[i-1].d < L[i].d)) return false;
  }
  return true;
}
// 新增或更新某一天（同一天只留一筆，後記的覆蓋先記的有填的欄位）；回傳新陣列，不改原陣列
function logUpsert(L,e){
  const out=L.map(function(x){ return Object.assign({},x) });
  const i=out.findIndex(function(x){ return x.d===e.d });
  const clean={d:e.d}; LOG_FIELDS.forEach(function(k){ if(typeof e[k]==='number') clean[k]=e[k] });
  if(i>=0){ LOG_FIELDS.forEach(function(k){ if(typeof clean[k]==='number') out[i][k]=clean[k] }) }
  else { out.push(clean); out.sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:0 }) }
  return out.slice(Math.max(0,out.length-LOG_MAX));
}
// 某個欄位有值的點 [{d,v}]
function logSeries(L,k){
  return L.filter(function(x){ return typeof x[k]==='number' }).map(function(x){ return {d:x.d,v:x[k]} });
}
// 最近 n 筆有值的平均
function logAvgLast(L,k,n){
  const s=logSeries(L,k).slice(-n); if(!s.length) return null;
  return s.reduce(function(a,x){ return a+x.v },0)/s.length;
}
function logStats(L,height){
  const st={};
  LOG_FIELDS.forEach(function(k){
    const s=logSeries(L,k);
    st[k]={n:s.length, first:s.length?s[0]:null, last:s.length?s[s.length-1]:null, delta:s.length>1?s[s.length-1].v-s[0].v:null};
  });
  st.s.avg7=logAvgLast(L,'s',7); st.h.avg7=logAvgLast(L,'h',7);
  st.whr = (st.wa.last && height>0) ? st.wa.last.v/height : null;      // 腰圍 ÷ 身高（同單位 cm）；只顯示，不判斷
  return st;
}

/* ---------- 折線圖（純 SVG，只用數字） ---------- */
function fmtN(v,dec){ return (Math.round(v*Math.pow(10,dec))/Math.pow(10,dec)).toFixed(dec) }
function mmdd(d){ return d.slice(5,7)+'-'+d.slice(8,10) }
// points：[{d,v}]；回傳 SVG 字串。少於 2 點時只畫一個點。
function chartSvg(points,dec){
  const W=300,H=110,PL=8,PR=8,PT=14,PB=22;
  if(!points.length) return '';
  const vs=points.map(function(p){ return p.v });
  let lo=Math.min.apply(null,vs), hi=Math.max.apply(null,vs);
  if(hi-lo<1e-9){ lo-=1; hi+=1 }
  const pad=(hi-lo)*0.15; lo-=pad; hi+=pad;
  const x=i=> points.length===1 ? W/2 : PL+(W-PL-PR)*i/(points.length-1);
  const y=v=> PT+(H-PT-PB)*(1-(v-lo)/(hi-lo));
  const pts=points.map(function(p,i){ return fmtN(x(i),1)+','+fmtN(y(p.v),1) }).join(' ');
  const last=points[points.length-1], first=points[0];
  let s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="趋势图">';
  s+='<line class="ch-grid" x1="'+PL+'" y1="'+(H-PB)+'" x2="'+(W-PR)+'" y2="'+(H-PB)+'"/>';
  if(points.length>1) s+='<polyline class="ch-line" points="'+pts+'"/>';
  points.forEach(function(p,i){ s+='<circle class="ch-dot'+(i===points.length-1?' last':'')+'" cx="'+fmtN(x(i),1)+'" cy="'+fmtN(y(p.v),1)+'" r="'+(i===points.length-1?4:2.5)+'"/>' });
  s+='<text class="ch-t" x="'+PL+'" y="'+(H-6)+'">'+mmdd(first.d)+'</text>';
  s+='<text class="ch-t" x="'+(W-PR)+'" y="'+(H-6)+'" text-anchor="end">'+mmdd(last.d)+'</text>';
  s+='<text class="ch-t" x="'+(points.length===1?W/2:W-PR)+'" y="'+Math.max(10,y(last.v)-8)+'" text-anchor="'+(points.length===1?'middle':'end')+'">'+fmtN(last.v,dec)+'</text>';
  return s+'</svg>';
}

/* ---------- 安全篩檢後的轉介卡片 ----------
   保守版原則：本頁只負責「拒絕與轉介」，不做醫療判斷。任何一項篩檢符合，就不給訓練計劃與熱量目標。
   reasons：篩檢結果代碼（見 questions.js 的 screen 步驟）；另有 young（未滿 18）、old（65 歲以上）。 */
const SCREEN_MED = ['heart','chest','faint','chronic','msk','supervised'];
const SCREEN_PREG = ['preg','bf','post'];
function referralCard(reasons){
  const has=c=>reasons.indexOf(c)>=0, any=L=>L.some(has);
  let h='<div class="card"><h3>这次先不给你训练和饮食计划</h3><div class="muted">不是你做错了什么，是本页的设计比较保守：只适合 18–64 岁、目前没有心脏、慢性病、骨关节问题，也不在孕产期的成年人自己练。下面是建议的下一步。</div>';
  if(any(SCREEN_MED)){
    h+='<div class="day"><h4><span>先问</span>医生</h4><ul class="t">'+
      '<li>请先问医生：你现在能不能运动、适合怎样的强度和动作。中国身体活动指南也建议，慢性病患者运动前先咨询医生，并在专业人员指导下进行。</li>'+
      '<li>美国运动医学会的建议是：运动前要看是否有症状，或已知的心血管、代谢、肾脏疾病。这类情况请先由医生评估。</li>'+
      '<li>医生同意之后，你仍然可以看本页的「健康知识」，但具体计划请跟医生或康复治疗师一起定。</li></ul></div>';
  }
  if(has('chest')){
    h+='<div class="warn">如果胸口突然疼痛或不适、一直不消失，或者痛到手臂、颈部、下巴、胃部或背部，或者胸痛同时出汗、恶心、头晕、喘不过气，请立即打急救电话。（NHS 胸痛页面）</div>';
  }
  if(any(SCREEN_PREG)){
    h+='<div class="day"><h4><span>孕产</span>先评估</h4><ul class="t">'+
      '<li>美国妇产科医师学会认为：没有产科或医疗并发症时，孕期运动是安全且有益的；产后也鼓励运动。但要先由产科医生或助产士评估你的情况。</li>'+
      '<li>WHO 2020 指南有专门给孕产期女性的建议，本页还没有这部分内容，所以不给你一般的计划。</li>'+
      '<li>「健康知识」里有 NHS 的孕期与产后资料，可以先看看，再跟医生讨论。</li></ul></div>';
  }
  if(has('ill')){
    h+='<div class="day"><h4><span>先养</span>好身体</h4><ul class="t"><li>正在感冒、发烧或身体不舒服时，先休息，等好了再开始。（PAR-Q+ 问卷也建议暂时生病时延后增加运动。）</li></ul></div>';
  }
  if(has('young')){
    h+='<div class="day"><h4><span>未满</span>18 岁</h4><ul class="t"><li>本页是按 18–64 岁成年人设计的。WHO 和中国指南对 6–17 岁另有建议：每天平均至少 60 分钟中等到高强度活动，中国指南还建议每周至少 3 天做肌肉和骨骼强化练习。</li><li>建议在家长、老师或教练指导下运动。</li></ul></div>';
  }
  if(has('old')){
    h+='<div class="day"><h4><span>65 岁</span>以上</h4><ul class="t"><li>中国指南建议：65 岁以上除了成人的建议，还要坚持平衡、灵敏和柔韧练习。本页还没有这部分内容。</li><li>建议请康复治疗师或有经验的教练帮你安排，尤其是平衡练习。</li></ul></div>';
  }
  h+='<div class="muted hsrc">说明：本页的安全问题是自己编写的，不是经过验证的筛检工具。想用国际通用的版本，可以看加拿大 PAR-Q+ 官方表格（英文）。</div>';
  const keys=['cn2021','acsm2015','who2020'].concat(any(SCREEN_PREG)?['acog804']:[]).concat(has('chest')?['nhsChest']:[]).concat(['parq']);
  return h+srcHtml(keys)+'</div>';
}

/* ---------- 卡片 HTML ---------- */
function srcHtml(keys){
  return '<div class="muted hsrc">来源：'+keys.map(function(k){
    const s=HEALTH_SRC[k];
    return '<a href="'+s.u+'" target="_blank" rel="noopener">'+s.n+'</a>（'+s.d+'）';
  }).join('；')+'</div>';
}
const ul = (a)=> a.length ? '<ul class="t">'+a.map(function(x){ return '<li>'+x+'</li>' }).join('')+'</ul>' : '';

// 健康知识库
function healthKnowledgeCard(){
  let h='<div class="card"><h3>健康知识库（'+HEALTH_TOPICS.length+' 个主题）</h3><div class="muted">'+HEALTH_NOTE+'点主题展开。</div>';
  HEALTH_TOPICS.forEach(function(t,i){
    h+='<details class="dd"'+(i===0?' open':'')+'><summary>'+t.title+'</summary>'+ul(t.pts)+srcHtml(t.src)+'</details>';
  });
  return h+'</div>';
}

// 不适与运动调整库：A.injury 里勾选的部位排在最前面，并标「你选了」
const DIS_ORDER = ['k','b','s'];
function avoidedBy(code){ return EXI.filter(function(x){ return x.t===code && x.how }) }          // 本页计划会避开的动作（有做法说明的）
// 還可以練的動作：不帶這個不適標記、有做法說明的，按類別列出（每類最多 3 個）。
// 例如膝盖：深蹲、箭步類全都帶膝盖標記，所以會看到臀桥、早安式、俯卧撑這些其他類別的動作。
function safeAlternatives(code){
  const out=[];
  GORDER.forEach(function(g){
    if(g==='st') return;
    const names=EXI.filter(function(x){ return x.g===g && x.t!==code && x.how }).slice(0,3).map(function(x){ return x.n });
    if(names.length) out.push({g:GL[g],names:names});
  });
  return out;
}
function discomfortCard(A){
  const picked=(A && A.injury) || [];
  const order=DIS_ORDER.slice().sort(function(a,b){ return (picked.indexOf(b)>=0)-(picked.indexOf(a)>=0) });
  let h='<div class="card"><h3>不适与运动调整</h3><div class="muted">先说本页怎么处理，再列 NHS 的一般性提醒。'+HEALTH_NOTE+'</div>';
  order.forEach(function(code,i){
    const d=DISCOMFORT[code], av=avoidedBy(code), alt=safeAlternatives(code), mine=picked.indexOf(code)>=0;
    h+='<details class="dd"'+(i===0&&mine?' open':'')+'><summary>'+d.name+(mine?' <span class="rec">你选了</span>':'')+'</summary>';
    h+='<div class="day"><h4><span>本页</span>怎么处理</h4><ul class="t"><li>你在问卷里勾选「'+d.name+'」不适时，训练计划和换动作都会避开 '+av.length+' 个带这个标记的动作。这个标记是我按动作类型自己标的，不是医学判断。</li>'+
      '<li>如果某个动作做的时候疼（不是肌肉酸），马上停下来。</li></ul>';
    h+='<details class="xd"><summary>会避开的动作（'+av.length+' 个）</summary><div class="xb">'+av.map(function(x){ return x.n }).join('、')+'</div></details>';
    h+='<details class="xd"><summary>还可以练的动作（不带这个标记，每类最多列 3 个）</summary><div class="xb">'+alt.map(function(a){ return '<b>'+a.g+'</b>：'+a.names.join('、') }).join('<br>')+'</div></details></div>';
    h+='<div class="day"><h4><span>常见</span>情况</h4>'+ul(d.common)+'</div>';
    h+='<div class="day"><h4><span>自己</span>可以做</h4>'+ul(d.self)+'</div>';
    h+='<div class="day"><h4><span>去看</span>医生</h4>'+ul(d.see)+'</div>';
    h+='<div class="day"><h4><span>尽快</span>就医</h4>'+ul(d.soon)+'</div>';
    if(d.urgent.length) h+='<div class="day"><h4><span>立即</span>急救</h4>'+ul(d.urgent)+'</div>';
    h+=srcHtml(d.src)+'</details>';
  });
  return h+'</div>';
}

// 健康记录与趋势
function logCard(L,height){
  let h='<div class="card"><h3>健康记录与趋势</h3>';
  if(!L.length){
    return h+'<div class="muted">还没有记录。点「记今天」，可以记体重、腰围、睡眠和饮水，每项都可以不填。记录只存在这台手机里，不会上传；换手机或清除浏览器数据会丢，需要的话先点「复制记录」存到备忘录。</div></div>';
  }
  const st=logStats(L,height);
  h+='<div class="muted">共 '+L.length+' 天的记录，最近一次是 '+L[L.length-1].d+'。只存在这台手机里，不会上传。</div>';
  [['w',1],['wa',1]].forEach(function(p){
    const k=p[0], s=logSeries(L,k); if(!s.length) return;
    const dl=st[k].delta;
    h+='<div class="day"><h4><span>'+LOG_LABEL[k]+'</span>'+fmtN(st[k].last.v,p[1])+' '+LOG_UNIT[k]+'</h4>'+
      (dl===null?'<div class="muted">只有 1 次记录，再记几次就能看到变化。</div>':'<div class="muted">比第一次记录（'+st[k].first.d+'）'+(dl>0?'多 ':dl<0?'少 ':'没变，')+(dl===0?'':fmtN(Math.abs(dl),1)+' '+LOG_UNIT[k])+'</div>')+
      chartSvg(s,p[1])+'</div>';
  });
  if(st.whr!==null) h+='<div class="rows"><div><span>腰围 ÷ 身高</span><b>'+fmtN(st.whr,2)+'</b></div></div><div class="muted">只是把你最近一次的腰围除以身高，供你自己对照变化；怎么解读请问医生（NHS 建议 BMI 要和腰高比一起看）。</div>';
  [['s',1],['h',1]].forEach(function(p){
    const k=p[0]; if(!st[k].n) return;
    h+='<div class="rows"><div><span>'+LOG_LABEL[k]+'（最近 '+Math.min(7,st[k].n)+' 次平均）</span><b>'+fmtN(st[k].avg7,1)+' '+LOG_UNIT[k]+'</b></div></div>';
  });
  return h+'</div>';
}
// 複製用的純文字（備份到備忘錄）
function logText(L){
  const rows=L.map(function(x){ return [x.d].concat(LOG_FIELDS.map(function(k){ return typeof x[k]==='number'?x[k]:'' })).join('\t') });
  return ['日期\t体重kg\t腰围cm\t睡眠小时\t饮水杯'].concat(rows).join('\n');
}
