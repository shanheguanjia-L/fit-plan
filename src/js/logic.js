/* 純邏輯：熱量計算、訓練排程、換動作、飲食範本、存檔檢查。
   不碰 DOM，只依賴 data-exercises.js、data-foods.js 定義的全域常數；瀏覽器與 Node 測試（tests/）共用同一份。
   語法層級刻意維持與原版相同（const/let、箭頭函式），不用 ?. ?? 與 ES module，以相容老版微信 X5/XWeb。 */

/* ---------- 常數 ---------- */
const GOAL = {fat:'减脂',muscle:'增肌塑形',shape:'改善体态、紧致线条',keep:'保持健康'};
const PLACE_LV = {gym:2,home:1,body:0};          // 場地 → 可用器材等級上限（動作 lv <= 這個值才能用）
const ACT_FACTOR = {2:1.35,3:1.45,4:1.55,5:1.6};  // 每週練幾天 → 活動係數
const SESSION_N = {30:4,45:5,60:6};               // 每次分鐘數 → 每天動作數
const INJ_NAME = {k:'膝盖',b:'腰背',s:'肩颈'};    // 不適部位代碼 → 顯示名稱
const EGG = '鸡蛋（煮熟）';
const PROTEIN_NOTE_RATIO = 0.85;                   // 菜單蛋白質平均低於目標這個比例時，菜單卡片要說明
const OVER_TOL = 1.03;                            // 菜單整天熱量超過目標多少倍才進行第二段校準
const MEAL_SHARE = {b:.25,l:.35,d:.30,s:.10};     // 早餐、午餐、晚餐、加餐的熱量/蛋白質比例

/* ---------- 動作資料與索引 ---------- */
// 由 EXERCISE_ROWS 展開成物件陣列；別名在原動作後緊接著插入一行（只換名稱），順序與舊版逐筆相同。
function buildExercises(rows){
  const out=[];
  rows.forEach(function(r){
    const x={n:r[0],g:r[1],lv:r[2],t:r[3],mus:r[4],eq:r[5],how:r.length>6?r[6]:'',id:r.length>6?r[7]:'',au:r.length>6?r[8]:'',lic:r.length>6?r[9]:''};
    out.push(x);
    if(r[10]){ const y={}; for(const k in x) y[k]=x[k]; y.n=r[10]; out.push(y) }
  });
  return out;
}
const EXI = buildExercises(EXERCISE_ROWS);
const EXM = {}; EXI.forEach(function(x){ if(!EXM[x.n]) EXM[x.n]=x });            // 名稱 → 動作
const EXG = {}; EXI.forEach(function(x){ (EXG[x.g]=EXG[x.g]||[]).push(x) });       // 類別 → 動作（保持 EXI 順序）
const FOCUS_ROWS = {};                                                              // 重點部位 → 候選動作（依類別的保持 EXI 順序；arms 的 tr/bi 交錯順序與舊版相同）
Object.keys(FOCUS_G).forEach(function(k){ FOCUS_ROWS[k]=EXI.filter(function(x){ return FOCUS_G[k].indexOf(x.g)>=0 }) });
Object.keys(FOCUS_NAMES).forEach(function(k){ FOCUS_ROWS[k]=FOCUS_NAMES[k].map(function(n){ return EXM[n] }) });   // 依指定名稱（順序 = 優先順序）

// 這個人能做的動作名稱（依 rows 順序、去重）：器材等級在場地範圍內，且不碰她勾選的不適部位
function usableNames(rows,A){
  const lv=PLACE_LV[A.place], names=[];
  rows.forEach(function(x){ if(x.lv<=lv && !(x.t && A.injury.indexOf(x.t)>=0) && names.indexOf(x.n)<0) names.push(x.n) });
  return names;
}

/* ---------- 計算 ---------- */
function calc(A){
  const w=A.weight,h=A.height,a=A.age;
  const bmr = 10*w + 6.25*h - 5*a - 161;            // Mifflin-St Jeor（女）
  const af = ACT_FACTOR[A.days];
  const tdee = bmr*af;
  const bmi = w/Math.pow(h/100,2);
  const flagged = A.health.some(x=>x!=='none') || a<18;
  const low = bmi<18.5;
  let kcal = tdee, mode='维持';
  if(!flagged){
    if(A.goal==='fat' && !low){ kcal=Math.max(tdee*0.8,bmr,1200); mode='温和减脂' }
    else if(A.goal==='shape' && !low){ kcal=tdee*0.95; mode='轻微热量缺口' }
    else if(A.goal==='muscle'){ kcal=tdee*1.05; mode='轻微盈余' }
  }
  kcal = Math.round(kcal/10)*10;
  const pPerKg = (A.goal==='fat'||A.goal==='muscle') ? 1.8 : 1.5;
  const p = Math.round(w*pPerKg);
  const f = Math.round(kcal*0.27/9);
  const c = Math.max(100, Math.round((kcal-4*p-9*f)/4));
  const weekly = (kcal-tdee)*7/7700;                  // 约值
  return {bmr:Math.round(bmr),tdee:Math.round(tdee/10)*10,bmi,flagged,low,kcal,mode,p,f,c,weekly};
}

/* ---------- 訓練 ---------- */
// 第 i 天的重點加練：最多 2 個，輪流取她選的部位，避開當天已有的動作
function focusList(A,i,dayEx){
  const areas=(A.focus||[]).filter(function(x){ return FOCUS_ROWS[x] });
  if(!areas.length) return [];
  const out=[];
  for(let k=0;k<2;k++){
    const pool=usableNames(FOCUS_ROWS[areas[(i+k)%areas.length]],A);
    const free=pool.filter(function(n){ return dayEx.indexOf(n)<0 && out.indexOf(n)<0 });
    if(free.length) out.push(free[(i+k*2)%free.length]);
  }
  return out;
}
function workout(A){
  const n = SESSION_N[A.mins];
  const lib = LIB[A.place];
  const sw = A.sw || {};
  return SCHED[A.days].map(([key,title],i)=>{
    const day = WK[A.days][i];
    if(key==='cardio') return {day,title,cardio:true};
    let list = lib[key].filter(nm=>{ const t=EXM[nm].t; return !t || !A.injury.includes(t) });
    for(const s of SAFE){ if(list.length>=n) break; if(!list.includes(s)) list.push(s) }
    list = list.slice(0,n).map((nm,j)=> sw[i+'-'+j] || nm);
    return {day,title,ex:list,focus:focusList(A,i,list)};
  });
}
// 同類、可做、當天沒有、且不是同一個 wger 動作（別名）的替代動作，從目前動作的下一個開始輪
function alts(cur,dayEx,A){
  const m=EXM[cur]; if(!m) return [];
  const names=usableNames(EXG[m.g],A);
  const pos=names.indexOf(cur), out=[];
  for(let k=1;k<=names.length;k++){ const c=names[(pos+k+names.length)%names.length];
    if(c!==cur && dayEx.indexOf(c)<0 && !(m.id && EXM[c].id===m.id)) out.push(c) }
  return out;
}
// 「换一个」：把第 i 天第 j 個動作換成下一個替代動作，記在 A.sw；沒有替代就回傳 false
function applySwap(A,i,j){
  const day=workout(A)[i]; const cur=day.ex[j];
  const list=alts(cur,day.ex,A); if(!list.length) return false;
  A.sw=A.sw||{}; A.sw[i+'-'+j]=list[0];
  return true;
}
function exLine(nm,A){
  const [sets,reps] = REPS[A.exp];
  if(TIMED.some(t=>nm.startsWith(t))) return sets.split('–')[0]+' 组 × 20–40 秒';
  if(nm.startsWith('站姿提踵')||nm.startsWith('哑铃提踵')) return sets+' 组 × 15–20 次';
  if(/死虫|鸟狗式|超人式|俯卧W字|蚌式|后踢|驴子踢腿|侧卧髋外展|帕洛夫|单腿臀桥/.test(nm)) return sets+' 组 × 每侧/每次 8–12 次';
  if(/箭步|分腿蹲|上台阶|单臂|单腿/.test(nm)) return sets+' 组 × 每侧 '+reps+' 次';
  return sets+' 组 × '+reps+' 次';
}

/* ---------- 飲食 ---------- */
const FM = {}; FOODS.forEach(function(f){ FM[f.n]=f });                            // 名稱 → 食物
function g5(x){ return Math.max(5, Math.round(x/5)*5) }                            // 取 5 克的倍數，最少 5 克
function qty(n,g){
  const f=FM[n];
  if(UW[n] && f.u){ const c=Math.max(0.5, Math.round(g/f.u*2)/2); return n.replace(/（.*）/,'')+' '+c+' '+UW[n]+'（约 '+Math.round(c*f.u)+' g）' }
  return n+' '+g+' g';
}
function itemStats(it){ const f=FM[it.n]; return {k:f.k*it.g/100, p:f.p*it.g/100, c:f.cb*it.g/100, f:f.f*it.g/100} }
const NOBEEF = ['瘦牛肉（烤熟）','羊腿肉（瘦、烤熟）'];   // 「不吃牛羊肉」要排除的食物
function allowed(f,A){
  if(f.t==='d' && A.diet.indexOf('lactose')>=0) return false;
  if(f.t==='s' && A.diet.indexOf('seafood')>=0) return false;
  if((f.t==='m'||f.t==='s') && A.diet.indexOf('veg')>=0) return false;
  if(A.diet.indexOf('nobeef')>=0 && NOBEEF.indexOf(f.n)>=0) return false;   // 不吃牛羊肉
  if(A.diet.indexOf('nopork')>=0 && f.n==='猪里脊（烤熟）') return false;
  return true;
}
function pickFrom(list,i,A){
  const L=list.filter(function(n){ return allowed(FM[n],A) });
  return L[((i%L.length)+L.length)%L.length];
}
function menu(A,C){
  const sh=MEAL_SHARE, egg=FM[EGG];
  const proteinPool = A.diet.indexOf('veg')>=0 ? VEGP : MAINP;
  const days=[];
  for(let i=0;i<7;i++){
    const meals=[];
    // 早餐：固定 1 份蛋（100 g），蛋白質不夠再加豆浆/酸奶/牛奶
    {
      const pM=C.p*sh.b, items=[{n:EGG,g:100,pr:1}];
      const left=pM-egg.p;
      if(left>6){ const e=pickFrom(BEXTRA,i,A); items.push({n:e,g:Math.min(300,g5(left/FM[e].p*100)),pr:1}) }
      const st=BSTAPLE[i%BSTAPLE.length];
      items.push({n:st,g:g5(C.c*sh.b/FM[st].cb*100*0.75),st:1});
      const fr=FRUITS[i%FRUITS.length]; items.push({n:fr[0],g:fr[1]});
      meals.push({name:'早餐',items:items,hint:'鸡蛋：水煮或蒸蛋；燕麦粥不加糖'});
    }
    // 午餐、晚餐：[名稱, 蛋白質池位移, 比例]
    [['午餐',0,sh.l],['晚餐',3,sh.d]].forEach(function(m,mi){
      const pM=C.p*m[2], pn=pickFrom(proteinPool,i+m[1],A), pf=FM[pn];
      const items=[]; let g=Math.min(260,g5(pM/pf.p*100)); items.push({n:pn,g:g,pr:1});
      const got=pf.p*g/100;
      // 主菜蛋白質不到目標 8 成就補蛋（每個 50 g、約 6.3 g 蛋白質），1–3 個
      if(got<pM*0.8 && allowed(egg,A)){ const c=Math.min(3,Math.max(1,Math.round((pM-got)/(egg.p/2)))); items.push({n:EGG,g:c*egg.u,pr:1}) }
      const st=pickFrom(STAPLE,i+(mi?2:0),A);
      items.push({n:st,g:g5(C.c*m[2]/FM[st].cb*100*0.8),st:1});
      items.push({n:pickFrom(VEGS,i+(mi?2:0),A),g:100});
      items.push({n:pickFrom(VEGS,i+(mi?6:4),A),g:100});
      items.push({n:'橄榄油',g:5});
      meals.push({name:m[0],items:items,hint:pf.ck+'；用油约 1 茶匙，其余清淡调味'});
    });
    // 加餐
    {
      const L=SNACKS.filter(function(x){ return x.every(function(y){ return allowed(FM[y[0]],A) }) });
      const sn=L[i%L.length];
      meals.push({name:'加餐',items:sn.map(function(y){ return {n:y[0],g:y[1]} }),hint:'下午或训练前后吃'});
    }
    // 总热量校准：只调整主食克数，让全天接近目标
    let tot=0, stk=0;
    meals.forEach(function(m){ m.items.forEach(function(it){ const k=itemStats(it).k; tot+=k; if(it.st) stk+=k }) });
    if(stk>0){
      const fct=Math.min(1.8,Math.max(0.5,(C.kcal-(tot-stk))/stk));
      meals.forEach(function(m){ m.items.forEach(function(it){ if(it.st) it.g=g5(it.g*fct) }) });
    }
    /* 第二、三段校準（熱量目標優先，蛋白質盡量靠近）：
       植物性蛋白每克蛋白質的熱量高（老豆腐 8、黑豆 15、鷹嘴豆 18 kcal，雞胸肉才 5），減脂的目標熱量又低，
       光蛋白質食物就可能超過整天的目標，主食縮到下限也救不回來（蛋奶素最多超標 60%）。
       所以主食縮到下限、整天仍超過目標 3% 以上時，才把蛋白質食物縮小（最低 55%）；還是超過，才把主食再縮（最低再縮到 40%）。
       沒超過 3% 的天完全不動。 */
    function kcalSplit(){ let t=0,st=0,pr=0; meals.forEach(function(m){ m.items.forEach(function(it){ const k=itemStats(it).k; t+=k; if(it.st) st+=k; if(it.pr) pr+=k }) }); return {t:t,st:st,pr:pr} }
    let ks=kcalSplit();
    if(ks.t>C.kcal*OVER_TOL && ks.pr>0){
      const fp=Math.min(1,Math.max(0.55,(C.kcal-(ks.t-ks.pr))/ks.pr));
      meals.forEach(function(m){ m.items.forEach(function(it){ if(it.pr) it.g=g5(it.g*fp) }) });
      ks=kcalSplit();
      if(ks.t>C.kcal*OVER_TOL && ks.st>0){
        const f2=Math.min(1,Math.max(0.4,(C.kcal-(ks.t-ks.st))/ks.st));
        meals.forEach(function(m){ m.items.forEach(function(it){ if(it.st) it.g=g5(it.g*f2) }) });
      }
    }
    let day={k:0,p:0,c:0,f:0};
    meals.forEach(function(m){
      m.k=0;m.p=0;
      m.items.forEach(function(it){ const x=itemStats(it); m.k+=x.k; m.p+=x.p; day.k+=x.k; day.p+=x.p; day.c+=x.c; day.f+=x.f });
    });
    days.push({day:'第 '+(i+1)+' 天',meals:meals,total:day});
  }
  return days;
}

/* ---------- 上次存檔的檢查 ----------
   localStorage 的內容不可信（GitHub Pages 同一個 username.github.io 底下的其他頁面共用 localStorage、
   舊版格式、手動竄改都有可能），而 A 的部分欄位會直接拼進 innerHTML 或拿來查表。
   原則：只擋「會被拼進 HTML 的非預期值」與「會讓原版程式出錯的值」，其他照原版寬鬆接受：
   - goal/exp/place/days/mins 必須是本頁選項之一（days、mins 會原樣顯示在頁面上）
   - age/height/weight 必須是正數；waist 可為 null 或數字（不顯示）
   - injury/health/diet 必須是字串陣列；focus、eat、sw 可以缺少（舊版存檔可能沒有，原版也能顯示）
   - 字串不得是 Object.prototype 上的名稱（例如 constructor），否則查表會取到函式
   - sw（換過的動作）必須是動作資料裡的名稱，因為它會原樣顯示 */
function has(o,k){ return Object.prototype.hasOwnProperty.call(o,k) }
function isPos(x){ return typeof x==='number' && isFinite(x) && x>0 }
function isStrArr(x){ return Array.isArray(x) && x.every(function(v){ return typeof v==='string' && !(v in Object.prototype) }) }
function validSaved(A){
  if(!A || typeof A!=='object' || Array.isArray(A)) return false;
  if(!has(GOAL,A.goal) || !has(REPS,A.exp) || !has(LIB,A.place)) return false;
  if(typeof A.days!=='number' || !has(SCHED,A.days) || typeof A.mins!=='number' || !has(SESSION_N,A.mins)) return false;
  if(!isPos(A.age) || !isPos(A.height) || !isPos(A.weight)) return false;
  if(A.waist!=null && !(typeof A.waist==='number' && isFinite(A.waist))) return false;
  if(!isStrArr(A.injury) || !isStrArr(A.health) || !isStrArr(A.diet)) return false;
  if(A.focus!==undefined && !isStrArr(A.focus)) return false;
  if(A.eat!==undefined && typeof A.eat!=='string') return false;
  if(A.nonum!==undefined && typeof A.nonum!=='boolean') return false;
  if(A.scr!==undefined && A.scr!=='ok' && A.scr!=='stop') return false;
  if(A.screen!==undefined && !isStrArr(A.screen)) return false;
  if(A.sw!==undefined){
    if(!A.sw || typeof A.sw!=='object' || Array.isArray(A.sw)) return false;
    for(const k in A.sw){ if(!/^\d+-\d+$/.test(k) || typeof A.sw[k]!=='string' || !has(EXM,A.sw[k])) return false }
  }
  return true;
}
