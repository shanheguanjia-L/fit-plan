/* 黃金樣本比對：同一組使用者資料，分別丟給「原版單檔」與「重構版」，輸出必須逐字相同。
   比對內容：calc、workout（每日動作與 focus）、每個動作的換動作清單 alts、focusList、menu（每餐項目與克數）、
   所有卡片 HTML（summary/workout/menu/動作庫 5 類/食物庫/小貼士）、複製摘要文字、連點「换一个」後的結果、
   EXI/FOODS/IMGS 等資料本身、每個動作的組數文字、每種食物的份量文字。
   用法：
     node tests/golden.js              全部（約 19 萬筆，2–3 分鐘）
     node tests/golden.js --text       設計改版後：卡片只比對文字內容（不比對 HTML 標記）
     node tests/golden.js --text --legacy  部位細分、新增動作之後：只比對「不該變」的部分（計算、菜單、食物庫、
                                       訓練主菜單 W（不含重點加練）、複製摘要、每個舊動作的組數文字）；換動作清單、重點加練、
                                       動作庫列表、動作資料本身會因新增動作而改變，改由 run.js 的不變量測試把關
     node tests/golden.js --quick      抽樣（約 1/10，十幾秒）
     node tests/golden.js --write orig out.tsv   只輸出某一版的「key<TAB>sha1」清單（orig 或 new）
     預設比對的「重構版」是正式上線的 index.html（單檔）；加 --src 改成比對 src/ 原始檔。
   原版檔：tests/golden/original.html.txt（= 重構前上線的 index.html，原樣複製，未修改）。
   環境變數 FIT_ORIGINAL 可指定其他原版路徑。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const L=require('./load.js');
const args=process.argv.slice(2), LEGACY=args.indexOf('--legacy')>=0, TEXT=args.indexOf('--text')>=0, QUICK=args.indexOf('--quick')>=0, SRC=args.indexOf('--src')>=0, wi=args.indexOf('--write');
const ORIG=process.env.FIT_ORIGINAL||path.join(__dirname,'golden','original.html.txt');

function api(kind){
  const ctx = kind==='orig' ? L.loadOriginal(ORIG) : (SRC ? L.load({app:true}) : L.loadBuilt());
  const get=n=>vm.runInContext(n,ctx);
  const o={get};
  ['calc','workout','menu','alts','focusList','summaryCard','workoutCard','menuCard','exLibCard','foodLibCard','tipsCard','planText','exLine','qty'].forEach(n=>{ o[n]=get(n) });
  // 換動作：原版是寫在 click handler 裡的邏輯（這裡逐字照抄）；重構版抽成 applySwap(A,i,j)
  o.swap = kind==='orig'
    ? function(A,i,j){ const day=o.workout(A)[i]; const cur=day.ex[j]; const list=o.alts(cur,day.ex,A); if(!list.length) return false; A.sw=A.sw||{}; A.sw[i+'-'+j]=list[0]; return true; }
    : get('applySwap');
  return o;
}

// 依固定順序產生所有紀錄：emit(tier, key, 輸出物件)
function generate(X, emit){
  const {calc,workout,menu,alts,focusList,summaryCard,workoutCard,menuCard,exLibCard,foodLibCard,tipsCard,planText,exLine,qty,swap,get}=X;
  const clone=o=>JSON.parse(JSON.stringify(o));
  const hsh=(i,m)=>((Math.imul(i+1,2654435761)>>>0)%m);
  const rec=(tier,key,obj)=>emit(tier,key,obj);
  const GOALS=['fat','muscle','shape','keep'],EXPS=['new','some','reg'],DAYS=[2,3,4,5],MINS=[30,45,60],PLACES=['gym','home','body'];
  const INJ=[['none'],['k'],['b'],['s'],['k','b','s']],HEALTH=[['none'],['preg']];
  const DIETS=[['none'],['veg'],['lactose'],['seafood'],['veg','lactose'],['lactose','seafood']];
  const FOCUS=[['none'],['hips'],['abs'],['arms'],['posture'],['hips','abs','arms','posture']];
  const PROFILES=[{age:30,height:160,weight:55},{age:16,height:158,weight:48},{age:25,height:170,weight:50},/*BMI 17.3*/
    {age:45,height:155,weight:72.5},{age:14,height:150,weight:40},{age:60,height:165,weight:90},{age:75,height:130,weight:30},{age:22,height:200,weight:150},{age:35,height:163,weight:58.5}];
  const EATS=['out','cook','mix'];

  // Tier 1：類別全組合
  let idx=0;
  for(const goal of GOALS)for(const exp of EXPS)for(const days of DAYS)for(const mins of MINS)for(const place of PLACES)
  for(let ii=0;ii<INJ.length;ii++)for(let hi=0;hi<HEALTH.length;hi++)for(let di=0;di<DIETS.length;di++)for(let fi=0;fi<FOCUS.length;fi++){
    if(QUICK && idx%10!==0){ idx++; continue }
    const P=PROFILES[hsh(idx,PROFILES.length)], eat=EATS[hsh(idx*7+3,3)];
    const A={goal,age:P.age,height:P.height,weight:P.weight,waist:null,exp,days,mins,place,focus:FOCUS[fi].slice(),injury:INJ[ii].slice(),health:HEALTH[hi].slice(),diet:DIETS[di].slice(),eat};
    const key=[goal,exp,days,mins,place,ii,hi,di,fi,P.age,P.height,P.weight,eat].join(',');
    const C=calc(A), W=workout(A);
    const al=W.map((d,i)=>d.cardio?null:d.ex.map(nm=>alts(nm,d.ex,A)));
    const fl=W.map((d,i)=>d.cardio?null:focusList(A,i,d.ex));
    const o={A:clone(A),C,W,al,fl,M:menu(A,C),sc:summaryCard(A,C),wc:workoutCard(A),mc:menuCard(A,C),pt:planText(A,C)};
    // Tier 3（子集）：依序點每個「換一个」，再連點第一個 3 次
    if(idx%5===0){
      const B=clone(A), seq=[];
      W.forEach((d,i)=>{ if(!d.cardio) d.ex.forEach((_,j)=>seq.push([i,j,swap(B,i,j)])) });
      for(let r=0;r<3;r++) seq.push([0,0,swap(B,0,0)]);
      o.swap={seq,sw:B.sw,W:workout(B),wc:workoutCard(B),pt:planText(B,calc(B))};
    }
    rec('T1',key,o); idx++;
  }
  // Tier 2：身體數據 × 目標 × 天數 × 健康，calc 全掃，menu/卡片按輪替飲食
  const AGES=[14,17,18,25,30,45,60,75],HTS=[130,145,155,160,170,185,200],WTS=[30,38.5,45,55,55.5,68,90,120,150];
  const H2=[['none'],['preg'],['chronic'],['preg','chronic']];
  idx=0;
  for(const age of AGES)for(const height of HTS)for(const weight of WTS)for(const goal of GOALS)for(const days of DAYS)for(let hi=0;hi<H2.length;hi++){
    if(QUICK && idx%10!==0){ idx++; continue }
    const diet=DIETS[hsh(idx,DIETS.length)], eat=EATS[hsh(idx+11,3)];
    const A={goal,age,height,weight,waist:70,exp:'some',days,mins:45,place:'home',focus:['none'],injury:['none'],health:H2[hi].slice(),diet:diet.slice(),eat};
    const C=calc(A);
    rec('T2',[age,height,weight,goal,days,hi,diet.join('+'),eat].join(','),{C,M:menu(A,C),sc:summaryCard(A,C),mc:menuCard(A,C)});
    idx++;
  }
  // Tier 4：動作庫、食物庫、靜態資料
  const subsets=a=>{const r=[];for(let m=0;m<(1<<a.length);m++){r.push(a.filter((_,i)=>m&(1<<i)))}return r};
  for(const inj of subsets(['k','b','s']).map(s=>s.length?s:['none']).concat([['s','k'],['b','k']]))
    for(const sc of [0,1,2,'st','w']) rec('T4lib',inj.join('+')+'/'+sc,exLibCard(sc,{injury:inj}));
  for(const d of subsets(['veg','lactose','seafood']).map(s=>s.length?s:['none'])) rec('T4food',d.join('+'),foodLibCard({diet:d}));
  rec('T4','tips',tipsCard({},{}));
  rec('T4','EXI',get('EXI')); rec('T4','EXMkeys',Object.keys(get('EXM'))); rec('T4','FOODS',get('FOODS')); rec('T4','IMGS',get('IMGS'));
  rec('T4','WOMEN',get('WOMEN')); rec('T4','REPS',get('REPS'));
  for(const x of get('EXI')) for(const e of EXPS) rec('T4exLine',x.n+'/'+e,exLine(x.n,{exp:e}));
  for(const f of get('FOODS')) for(const g of [5,15,40,50,100,136,150,158,182,250,333]) rec('T4qty',f.n+'/'+g,qty(f.n,g));
  // 邊界：focus 未定義 / 空陣列；injury 亂序
  for(const focus of [undefined,[],['abs','hips'],['posture','none']]) for(const place of PLACES) for(const days of DAYS){
    const A={goal:'shape',age:28,height:162,weight:52,exp:'new',days,mins:60,place,injury:['s','k'],health:['none'],diet:['none'],eat:'mix'}; if(focus!==undefined) A.focus=focus;
    const C=calc(A); rec('T5',JSON.stringify(focus)+'/'+place+'/'+days,{W:workout(A),wc:workoutCard(A),sc:summaryCard(A,C)});
  }
}

/* --text 模式（設計改版後使用）：含 HTML 的字串只比對「文字內容」——去掉標籤、依序切詞；
   結果摘要卡（class="card sum"）版面重排過，改成「詞的集合（排序後）」比對。其他非 HTML 資料（計算、動作、菜單、摘要文字）仍逐字比對。 */
function textOf(h){
  let t=h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(h.indexOf('class="card sum"')>=0 || h.indexOf('<div class="card"><h3>你的专属方案</h3>')>=0) t=t.sort();   // 新版摘要卡與原版摘要卡都排序後比對（版面重排過）
  return t.join(' ');
}
const H=s=>crypto.createHash('sha1').update(s).digest('hex');
const LEGACY_SKIP_T={T4lib:1,T4food:1};   // 動作庫列表、食物庫列表：新增動作／食物後必然改變（改由 run.js 驗證舊內容不變）                      // 動作庫列表：新增動作後必然改變
const LEGACY_SKIP_K={T4:{EXI:1,EXMkeys:1,IMGS:1,WOMEN:1,FOODS:1}};
function legacyRep(k,v){
  if(k==='al'||k==='fl'||k==='swap'||k==='wc') return undefined;   // 換動作清單、重點加練、訓練卡片、連點換動作
  // 菜單（M）與菜單卡片（mc）：羊肉進輪換、熱量校準修正之後，超標的天會改變。整個略過，
  // 改由 run.js 的「菜單熱量校準」「羊腿肉進菜單」兩個測試逐天對原版把關（原版沒超標的天必須完全相同）。
  if(k==='M'||k==='mc') return undefined;
  if(k==='focus' && this && this.ex) return undefined;               // 每天的重點加練（W 的 day 物件）
  return v;
}
const skipRec=(t,k)=> LEGACY && (LEGACY_SKIP_T[t] || (LEGACY_SKIP_K[t] && LEGACY_SKIP_K[t][k]));
const stringify=o=>JSON.stringify(o,function(k,v){
  if(LEGACY){ v=legacyRep.call(this,k,v); if(v===undefined) return v }
  return (TEXT && typeof v==='string' && v.indexOf('<')>=0) ? textOf(v) : v;
});
if(wi>=0){
  const kind=args[wi+1], out=args[wi+2]; const lines=[];
  generate(api(kind),(t,k,o)=>lines.push(t+'\t'+k+'\t'+H(stringify(o))));
  fs.writeFileSync(out,lines.join('\n')+'\n'); console.log(kind,'records',lines.length,'→',out);
} else {
  const t0=Date.now();
  // 原版只存 key 與 sha1（全部存 JSON 會吃掉數 GB 記憶體）；有不一致時再重跑一次取出前 5 筆的完整內容
  const ref=[], refMap={}; generate(api('orig'),(t,k,o)=>{ if(skipRec(t,k)) return; const h=H(stringify(o)); ref.push([t+' '+k,h]); refMap[t+' '+k]=h });
  let n=0, bad=0, added=0; const perTier={}, badKeys={}, seen={};
  generate(api('new'),(t,k,o)=>{
    if(skipRec(t,k)) return;
    const key=t+' '+k, h=H(stringify(o));
    if(LEGACY){
      if(!(key in refMap)){ added++; return }          // 新增動作產生的新紀錄（例如新動作的組數文字）
      n++; perTier[t]=(perTier[t]||0)+1; seen[key]=1;
      if(refMap[key]!==h){ bad++; if(bad<=5) badKeys[key]=1 }
      return;
    }
    const r=ref[n++]; perTier[t]=(perTier[t]||0)+1;
    if(!r || r[0]!==key || r[1]!==h){ bad++; if(bad<=5) badKeys[key]=1 }
  });
  if(LEGACY){ const lost=ref.filter(r=>!seen[r[0]]); if(lost.length){ bad+=lost.length; console.log('原版有、新版沒有的紀錄：',lost.slice(0,5).map(r=>r[0])) } console.log('新版新增的紀錄（不比對）：',added) }
  if(bad){
    const full={orig:{},neu:{}};
    generate(api('orig'),(t,k,o)=>{ if(badKeys[t+' '+k]) full.orig[t+' '+k]=stringify(o) });
    generate(api('new'),(t,k,o)=>{ if(badKeys[t+' '+k]) full.neu[t+' '+k]=stringify(o) });
    Object.keys(badKeys).forEach(key=>{
      const a=full.orig[key]||'', s=full.neu[key]||''; let p=0; while(p<a.length && a[p]===s[p]) p++;
      console.log('不一致：',key,'\n  原版：…'+a.slice(Math.max(0,p-60),p+80)+'\n  新版：…'+s.slice(Math.max(0,p-60),p+80));
    });
  }
  if(!LEGACY && n!==ref.length){ bad++; console.log('筆數不同：原版',ref.length,'新版',n) }
  console.log('各類筆數',JSON.stringify(perTier));
  console.log((bad?'失敗':'通過')+'：比對 '+n+' 筆，不一致 '+bad+' 筆（'+((Date.now()-t0)/1000).toFixed(1)+' 秒'+(QUICK?'，抽樣模式':'')+(SRC?'，src/ 原始檔':'，正式版 index.html')+'）');
  process.exit(bad?1:0);
}
