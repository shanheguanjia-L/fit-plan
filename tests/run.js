/* 單元測試（不需安裝任何套件）：node tests/run.js
   涵蓋：資料完整性（授權/來源/圖片）、calc、workout、alts、applySwap、focusList、exLine、menu、qty、
   validSaved（存檔檢查）、卡片輸出沒有 undefined/NaN、與原版的文案與版面標記一致、老版微信相容性靜態掃描。
   黃金樣本逐字比對在 tests/golden.js（較久）。 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const L = require('./load.js');
const ROOT = L.ROOT;
const ctx = L.load({app:true});
const G = n => vm.runInContext(n, ctx);
const ORIG_FILE = process.env.FIT_ORIGINAL || path.join(__dirname,'golden','original.html.txt');

let pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ✓ '+name) }
  catch(e){ fail++; console.log('  ✗ '+name+'\n      '+(e && e.message || e)) }
}
// vm 沙箱裡的物件原型與 Node 主環境不同，比較前先轉成純 JSON
const J = x => JSON.parse(JSON.stringify(x));
const JNOPR = x => JSON.parse(JSON.stringify(x,(k,v)=>k==='pr'?undefined:v));   // 比對菜單時略過內部標記 pr（標示蛋白質食物，原版沒有）
const base = o => Object.assign({goal:'fat',age:30,height:160,weight:55,waist:null,exp:'some',days:3,mins:45,place:'home',
  focus:['none'],injury:['none'],health:['none'],diet:['none'],eat:'mix'}, o||{});

function origEXI(){   // 原版（重構前）的動作資料，供「舊資料不變」比對
  const o=L.loadOriginal(ORIG_FILE); return JSON.parse(JSON.stringify(vm.runInContext('EXI',o)));
}
const EXI=G('EXI'), EXM=G('EXM'), FOODS=G('FOODS'), FM=G('FM'), IMGS=G('IMGS'), LIB=G('LIB');
const calc=G('calc'), workout=G('workout'), alts=G('alts'), applySwap=G('applySwap'), focusList=G('focusList'),
  exLine=G('exLine'), menu=G('menu'), qty=G('qty'), validSaved=G('validSaved');

console.log('資料完整性');
const LICS = ['CC-BY-SA 3.0','CC-BY-SA 4.0','CC0'];
test('EXERCISE_ROWS 每行 6、10 或 11 欄', ()=>{
  G('EXERCISE_ROWS').forEach(r=>assert.ok([6,10,11].indexOf(r.length)>=0, r[0]+' 有 '+r.length+' 欄'));
});
test('動作共 129 筆（原 113 + 部位細分新增 16）、名稱不重複；原 113 筆的內容除三筆補上 wger 來源外完全不變', ()=>{
  assert.strictEqual(EXI.length,129);
  assert.strictEqual(Object.keys(EXM).length,129);
  const orig=origEXI(); assert.strictEqual(orig.length,113);
  const enriched=['哑铃卧推','胸部推举机','哑铃弯举'];   // 原本沒有 wger 資料，這次補上來源與要點
  orig.forEach((o,i)=>{ const n=J(EXI[i]); if(enriched.indexOf(o.n)>=0){ assert.strictEqual(n.n,o.n); assert.ok(n.how && n.id && n.lic,o.n+' 應補上來源'); assert.strictEqual(o.how,''); } else assert.deepStrictEqual(n,o,'第 '+i+' 筆 '+o.n+' 被改動') });
});
test('每個動作的欄位型別正確；有要點就必須有 wger id 與授權', ()=>{
  const GL=G('GL');
  EXI.forEach(x=>{
    assert.deepStrictEqual(Object.keys(x),['n','g','lv','t','mus','eq','how','id','au','lic'],x.n);
    assert.ok(GL[x.g], x.n+' 類別 '+x.g);
    assert.ok([0,1,2].indexOf(x.lv)>=0, x.n+' lv');
    assert.ok(['','k','b','s'].indexOf(x.t)>=0, x.n+' t');
    assert.ok(x.mus && x.eq, x.n+' mus/eq');
    if(x.how){
      assert.ok(Number.isInteger(x.id) && x.id>0, x.n+' 缺 wger id');
      assert.ok(LICS.indexOf(x.lic)>=0, x.n+' 授權 '+x.lic);
      assert.strictEqual(typeof x.au,'string');
    } else {
      assert.ok(x.id==='' && x.au==='' && x.lic==='', x.n+' 沒有要點卻有來源資料');
    }
  });
});
test('同一個 wger id 只出現在相鄰的別名行，且內容只差名稱', ()=>{
  const seen={};
  EXI.forEach((x,i)=>{ if(!x.id) return;
    if(seen[x.id]!==undefined){
      assert.strictEqual(seen[x.id],i-1, x.n+' 的別名不相鄰');
      const a=EXI[i-1]; assert.deepStrictEqual(J(Object.assign({},a,{n:x.n})),J(x));
    }
    seen[x.id]=i; });
  assert.deepStrictEqual(J(EXI.filter((x,i)=>i>0&&x.id&&EXI[i-1].id===x.id).map(x=>x.n)),['哑铃高脚杯深蹲','哑铃推肩','哑铃单臂划船（扶椅）']);
});
test('授權與作者抽查（與原版一致）', ()=>{
  const chk=(n,id,au,lic)=>{ const m=EXM[n]; assert.deepStrictEqual([m.id,m.au,m.lic],[id,au,lic],n) };
  chk('高脚杯深蹲',203,'ataraxie67','CC-BY-SA 4.0'); chk('哑铃高脚杯深蹲',203,'ataraxie67','CC-BY-SA 4.0');
  chk('哑铃推肩',567,'wger.de','CC-BY-SA 3.0'); chk('平板支撑',458,'YYCfit / BFad07','CC-BY-SA 3.0');
  chk('靠墙静蹲',718,'Blablabla','CC0'); chk('上台阶',981,'','CC-BY-SA 4.0'); chk('扶椅分腿蹲',2557,'','CC-BY-SA 3.0');
  chk('空心支撑',297,'Behrooz','CC0'); chk('台阶小腿拉伸',2666,'trs1800','CC-BY-SA 4.0');
});
test('訓練模板、補位、女性常練、計時、熱身拉伸用到的名稱都存在', ()=>{
  for(const p in LIB) for(const k in LIB[p]) LIB[p][k].forEach(n=>assert.ok(EXM[n], p+'.'+k+' '+n));
  G('SAFE').forEach(n=>{ assert.ok(EXM[n],n); assert.strictEqual(EXM[n].t,'',n+' 補位動作不得有不適部位') });
  G('WOMEN').forEach(n=>assert.ok(EXM[n] && EXM[n].how, n));
  G('TIMED').forEach(n=>assert.ok(EXM[n], n));
  ['肩部绕环','手臂绕环','儿童式','站姿小腿拉伸','三头肌拉伸'].forEach(n=>assert.ok(EXM[n] && EXM[n].how, n));
});
test('示範圖：每個 id 都對到有要點的動作、檔案都在 img/、img/ 沒有多餘檔案', ()=>{
  const used=[];
  Object.keys(IMGS).forEach(id=>{
    assert.ok(EXI.some(x=>String(x.id)===id && x.how), 'IMGS '+id+' 沒有對應動作');
    IMGS[id].forEach(x=>{ assert.ok(fs.existsSync(path.join(ROOT,'img',x.f)), '缺圖 '+x.f); assert.ok(LICS.indexOf(x.lic)>=0, x.f+' 授權'); used.push(x.f) });
  });
  const files=fs.readdirSync(path.join(ROOT,'img')).filter(f=>!f.startsWith('.'));
  assert.deepStrictEqual(files.slice().sort(), used.slice().sort());
  assert.strictEqual(files.length,66);
});
test('食物：48 種（原 47 + 羊腿肉）、名稱與 FDC 編號唯一、飲食範本用到的名稱都存在；原 47 種的內容與順序不變', ()=>{
  assert.strictEqual(FOODS.length,48);
  const of=JSON.parse(JSON.stringify(vm.runInContext('FOODS',L.loadOriginal(ORIG_FILE))));
  assert.strictEqual(of.length,47);
  const noMicro=f=>{ const o=Object.assign({},f); delete o.fe; delete o.ca; return o };   // 鐵、鈣是 2026-11-25 新增欄位，其餘欄位仍須與原版相同
  assert.deepStrictEqual(J(FOODS.filter(f=>f.n!=='羊腿肉（瘦、烤熟）')).map(noMicro),of,'原 47 種被改動');
  FOODS.forEach(f=>{ assert.ok(typeof f.fe==='number' && f.fe>=0 && f.fe<15,f.n+' 的鐵不合理：'+f.fe); assert.ok(typeof f.ca==='number' && f.ca>=0 && f.ca<1000,f.n+' 的鈣不合理：'+f.ca) });
  const lamb=FM['羊腿肉（瘦、烤熟）']; assert.deepStrictEqual(J(lamb),{c:'肉禽',n:'羊腿肉（瘦、烤熟）',k:191,p:28.3,cb:0,f:7.7,t:'m',u:0,us:'',ck:'烤、炖、少油快炒',fdc:174314,fe:2.12,ca:8});
  const fdc={}; FOODS.forEach(f=>{
    assert.ok(Number.isInteger(f.fdc) && f.fdc>0, f.n+' 缺 FDC 編號'); assert.ok(!fdc[f.fdc], '重複 FDC '+f.fdc); fdc[f.fdc]=1;
    assert.ok(['','m','s','e','d'].indexOf(f.t)>=0, f.n);
    ['k','p','cb','f','u'].forEach(k=>assert.ok(typeof f[k]==='number' && isFinite(f[k]), f.n+' '+k));
  });
  assert.strictEqual(Object.keys(FM).length,48);
  const names=[].concat(G('MAINP'),G('VEGP'),G('STAPLE'),G('BSTAPLE'),G('VEGS'),G('BEXTRA'),G('FRUITS').map(x=>x[0]),
    [].concat.apply([],G('SNACKS').map(s=>s.map(x=>x[0]))),Object.keys(G('UW')),[G('EGG'),'橄榄油']);
  names.forEach(n=>assert.ok(FM[n], n));
  Object.keys(G('UW')).forEach(n=>assert.ok(FM[n].u>0, n+' 要有單位重量'));
});

console.log('calc');
test('一般減脂：55kg/160cm/30 歲/每週 3 天', ()=>{
  const C=calc(base());
  assert.strictEqual(C.bmr,1239); assert.strictEqual(C.tdee,1800); assert.strictEqual(C.kcal,1440);
  assert.strictEqual(C.mode,'温和减脂'); assert.deepStrictEqual([C.p,C.f,C.c],[88,43,175]);
  assert.strictEqual(C.flagged,false); assert.strictEqual(C.low,false);
  assert.ok(Math.abs(C.weekly-(-0.3241))<1e-3);
});
test('未滿 18 歲或勾選健康狀況 → 只給維持', ()=>{
  assert.strictEqual(calc(base({age:17})).mode,'维持');
  assert.strictEqual(calc(base({health:['preg']})).mode,'维持');
  assert.strictEqual(calc(base({health:['chronic']})).flagged,true);
});
test('BMI < 18.5 時減脂與體態都改維持；增肌仍有盈餘', ()=>{
  assert.strictEqual(calc(base({weight:45,height:165})).low,true);
  assert.strictEqual(calc(base({weight:45,height:165})).mode,'维持');
  assert.strictEqual(calc(base({weight:45,height:165,goal:'shape'})).mode,'维持');
  assert.strictEqual(calc(base({weight:45,height:165,goal:'muscle'})).mode,'轻微盈余');
});
test('減脂熱量不低於 1200 kcal', ()=>{
  const C=calc(base({weight:50,height:150,age:75,days:2}));   // tdee×0.8 ≈ 974，被拉到 1200
  assert.strictEqual(C.kcal,1200); assert.strictEqual(C.mode,'温和减脂');
});

console.log('workout / alts / applySwap / focusList');
test('天數、每天動作數、有氧日', ()=>{
  [2,3,4,5].forEach(d=>assert.strictEqual(workout(base({days:d})).length,d));
  assert.strictEqual(workout(base({days:5}))[4].cardio,true);
  [[30,4],[45,5],[60,6]].forEach(([m,n])=>workout(base({mins:m})).forEach(d=>assert.strictEqual(d.ex.length,n)));
});
test('避開不適部位；不夠時依序補安全動作', ()=>{
  const W=workout(base({place:'body',mins:60,injury:['k','b','s']}));
  W.forEach(d=>d.ex.forEach(n=>assert.ok(!EXM[n].t, n)));
  assert.deepStrictEqual(J(W[0].ex),['臀桥','平板支撑','死虫','鸟狗式','侧平板支撑','蚌式开合']);
});
test('換動作：同類、可做、不含同一 wger 動作的別名、不含當天已有的', ()=>{
  const A=base({place:'home'}); const W=workout(A);
  W.forEach(d=>d.ex.forEach(n=>{
    alts(n,d.ex,A).forEach(c=>{
      assert.strictEqual(EXM[c].g,EXM[n].g); assert.ok(EXM[c].lv<=1); assert.ok(d.ex.indexOf(c)<0);
      assert.ok(!(EXM[n].id && EXM[c].id===EXM[n].id), n+' → '+c);
    });
  }));
  assert.ok(alts('哑铃肩推',['哑铃肩推'],A).indexOf('哑铃推肩')<0);
  assert.deepStrictEqual(J(alts('不存在',[],A)),[]);
});
test('applySwap 記到 A.sw、會反映在 workout；沒有替代時回傳 false', ()=>{
  const A=base({place:'gym'}); const before=workout(A)[0].ex[0];
  assert.strictEqual(applySwap(A,0,0),true);
  assert.strictEqual(workout(A)[0].ex[0],A.sw['0-0']); assert.notStrictEqual(A.sw['0-0'],before);
  // 家裡有器材、腰背不適、每週 3 天：第 3 天的「弹力带坐姿划船」在這個條件下沒有同類可換（hr 類其他動作都需要彎腰或器械）
  const B=base({place:'home',days:3,injury:['b']});
  const j=workout(B)[2].ex.indexOf('弹力带坐姿划船'); assert.ok(j>=0);
  assert.strictEqual(alts('弹力带坐姿划船',workout(B)[2].ex,B).length,0);
  assert.strictEqual(applySwap(B,2,j),false); assert.strictEqual(B.sw,undefined);
});
test('重點加練：沒選就沒有；最多 2 個；不重複當天動作；符合場地', ()=>{
  assert.deepStrictEqual(J(focusList(base(),0,[])),[]);
  assert.deepStrictEqual(J(focusList(base({focus:undefined}),0,[])),[]);
  const A=base({focus:['hips','abs','arms','posture'],place:'body'});
  workout(A).forEach((d,i)=>{ if(d.cardio) return;
    assert.ok(d.focus.length<=2); d.focus.forEach(n=>{ assert.ok(d.ex.indexOf(n)<0); assert.strictEqual(EXM[n].lv,0) }) });
});
test('exLine：計時、提踵、每側', ()=>{
  assert.strictEqual(exLine('平板支撑',{exp:'reg'}),'3 组 × 20–40 秒');
  assert.strictEqual(exLine('站姿提踵',{exp:'new'}),'2 组 × 15–20 次');
  assert.strictEqual(exLine('哑铃反向箭步蹲',{exp:'some'}),'3 组 × 每侧 10–15 次');
  assert.strictEqual(exLine('死虫',{exp:'some'}),'3 组 × 每侧/每次 8–12 次');
  assert.strictEqual(exLine('哑铃卧推',{exp:'reg'}),'3–4 组 × 8–12 次');
});

console.log('menu / qty');
test('7 天、每天 4 餐、主食克數為 5 的倍數', ()=>{
  const A=base(); const M=menu(A,calc(A));
  assert.strictEqual(M.length,7);
  M.forEach(d=>{ assert.deepStrictEqual(J(d.meals.map(m=>m.name)),['早餐','午餐','晚餐','加餐']);
    d.meals.forEach(m=>m.items.forEach(it=>{ assert.ok(FM[it.n],it.n); if(it.st) assert.strictEqual(it.g%5,0) })) });
});
test('忌口：素食無肉與海鮮、乳糖不耐無乳製品、海鮮過敏無海鮮', ()=>{
  [[['veg'],['m','s']],[['lactose'],['d']],[['seafood'],['s']],[['veg','lactose'],['m','s','d']]].forEach(([diet,banned])=>{
    const A=base({diet}); menu(A,calc(A)).forEach(d=>d.meals.forEach(m=>m.items.forEach(it=>
      assert.ok(banned.indexOf(FM[it.n].t)<0, diet+' 出現 '+it.n))));
  });
});
test('qty：以個/根/片顯示，其餘克數', ()=>{
  assert.strictEqual(qty('鸡蛋（煮熟）',100),'鸡蛋 2 个（约 100 g）');
  assert.strictEqual(qty('香蕉',136),'香蕉 1 根（约 136 g）');
  assert.strictEqual(qty('鸡胸肉（熟）',120),'鸡胸肉（熟） 120 g');
});

console.log('validSaved（上次存檔檢查）');
test('本頁產生的存檔、缺 focus/eat/sw 的舊存檔都接受', ()=>{
  assert.strictEqual(validSaved(base()),true);
  assert.strictEqual(validSaved(base({sw:{'0-1':'臀桥'}})),true);
  const old=base(); delete old.focus; delete old.eat; delete old.waist; assert.strictEqual(validSaved(old),true);
  assert.strictEqual(validSaved(JSON.parse(JSON.stringify(base({waist:72,weight:55.5})))),true);
});
test('竄改或壞掉的存檔一律拒絕（避免 HTML 注入與程式出錯）', ()=>{
  [null,0,'x',[],{},base({days:'<img src=x onerror=alert(1)>'}),base({mins:'45<b>'}),base({days:7}),base({goal:'hack'}),
   base({goal:'constructor'}),base({place:'__proto__'}),base({injury:'k'}),base({injury:['constructor']}),base({diet:null}),
   base({focus:'hips'}),base({age:'30'}),base({weight:NaN}),base({sw:{'0-0':'<script>'}}),base({sw:{'a':'臀桥'}}),
   base({sw:[]}),base({sw:{'0-0':'toString'}})].forEach((A,i)=>assert.strictEqual(validSaved(A),false,'第 '+i+' 個應被拒絕：'+JSON.stringify(A)));
});

console.log('卡片輸出');
test('各種組合的卡片都沒有 undefined / NaN / [object', ()=>{
  const names=['summaryCard','workoutCard','menuCard','foodLibCard','tipsCard','planText'];
  const fns=names.map(G), exLibCard=G('exLibCard');
  ['fat','muscle','shape','keep'].forEach(goal=>['gym','home','body'].forEach(place=>[2,3,4,5].forEach(days=>{
    const A=base({goal,place,days,focus:['hips','arms'],injury:['k'],diet:['lactose'],eat:'out'}), C=calc(A);
    fns.forEach((f,i)=>{ const h=f(A,C); assert.ok(!/undefined|NaN|\[object/.test(h), names[i]+' '+goal+'/'+place+'/'+days) });
  })));
  [0,1,2,'st','w'].forEach(s=>assert.ok(!/undefined|NaN/.test(exLibCard(s,base({injury:['k','b','s']})))));
});
test('每張卡片的來源/授權/免責文字都在', ()=>{
  const A=base(), C=calc(A);
  assert.ok(G('workoutCard')(A).indexOf('动作资料来自开源项目 <b>wger</b>（wger.de），按 CC-BY-SA 授权')>=0);
  assert.ok(G('workoutCard')(A).indexOf('来源：wger 动作 #')>=0);
  assert.ok(G('menuCard')(A,C).indexOf('营养数据来自美国农业部 FoodData Central')>=0);
  assert.ok(G('foodLibCard')(A).indexOf('数据来自美国农业部 FoodData Central')>=0);
  assert.ok(G('summaryCard')(A,C).indexOf('不是医学诊断')>=0);
  assert.ok(G('exLibCard')(1,A).indexOf('示范图作者：')>=0);
  assert.ok(G('planText')(A,C).indexOf('（公式估算，非医学建议）')>=0);
});

console.log('與原版一致（文案、版面標記）');
// 簡易 tokenizer：取出程式碼裡的字串常數（跳過註解）
function literals(code){
  const out=[]; let i=0;
  while(i<code.length){
    const c=code[i], d=code[i+1];
    if(c==='/'&&d==='*'){ i=code.indexOf('*/',i+2)+2; continue }
    if(c==='/'&&d==='/'){ const e=code.indexOf('\n',i); i=e<0?code.length:e; continue }
    if(c==="'"||c==='"'||c==='`'){ let j=i+1, s=''; while(j<code.length&&code[j]!==c){ if(code[j]==='\\'){ s+=code[j]+code[j+1]; j+=2 } else s+=code[j++] } out.push(s); i=j+1; continue }
    i++;
  }
  return out;
}
const CJK=/[　-鿿＀-￯]/;
const origHtml=fs.readFileSync(ORIG_FILE,'utf8');
const origCode=origHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
const newCode=L.scriptOrder().map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
test('所有含中文的字串常數：原版與重構版集合完全相同（問答文案、選項、卡片文字、資料）', ()=>{
  const a=new Set(literals(origCode).filter(s=>CJK.test(s))), b=new Set(literals(newCode).filter(s=>CJK.test(s)));
  const onlyOrig=[...a].filter(s=>!b.has(s)), onlyNew=[...b].filter(s=>!a.has(s));
  // 設計改版後，卡片 HTML 片段切法不同，所以改成比對「中文詞」：新版出現的每個中文詞，原版都要有，
  // 唯一例外是一週條新增的「周日」（原版的訓練日只會排到周六）。內容完整性另由 golden.js --text 逐筆驗證。
  const cjkWords=set=>{ const r=new Set(); set.forEach(x=>(x.match(/[\u4e00-\u9fff]+/g)||[]).forEach(w=>r.add(w))); return r };
  const wa=cjkWords(a), newWords=[...cjkWords(new Set(onlyNew))].filter(w=>!wa.has(w));
  // 個性化改版（選項說明、答完回應、建議標記、改上一題）新增了文案，所以這裡不再要求「不能多」，
  // 只要求「原版的每個中文詞都還在」（下面 onlyOrig 檢查），並印出新增的詞方便人工過目。
  if(process.env.FIT_SHOW_NEW) console.log('新增的中文詞：',newWords.join('、'));
  assert.ok(newWords.indexOf('周日')>=0,'一週條的周日');
  // 原版有、重構版沒有的，只允許三種：① 原版沒用到的死碼 PROT/CARB/VEG/BRK/SNK（已刪）② 錯誤提示條文字（搬到 dev.html/index.html 開頭的內嵌腳本）
  const dead=origCode.slice(origCode.indexOf('const PROT = {'),origCode.indexOf('const FM = {}'));
  const boot=fs.readFileSync(path.join(ROOT,'dev.html'),'utf8');
  // ③ 設計改版拿掉的聊天頭像文字「练」；個性化改版把「好的，我按你的情况算一下……」換成帶出她答案的一句話；腰圍改成「選填」，不再有「跳过」按鈕
  const wb=cjkWords(b);   // 新版所有中文詞；原版片段若只是切法不同（詞都還在）就算保留
  const oldFlow=origCode.slice(origCode.indexOf('async function flow('),origCode.indexOf('function start('));   // ④ 舊問卷流程裡的問題與選項（已由 questions.js 的新問法取代）
  onlyOrig.forEach(s=>assert.ok(oldFlow.indexOf(s)>=0 || s==='练' || s==='跳过' || s.indexOf('每次训练前 5 分钟')>=0 || s.indexOf('你选了重点部位，但在你的器材和不适部位限制下')>=0 || s==='好的，我按你的情况算一下……' || dead.indexOf(s)>=0 || boot.indexOf("'"+s+"'")>=0 || (s.match(/[\u4e00-\u9fff]+/g)||[]).every(w=>wb.has(w)), '原版文字不見了：'+s));
  assert.ok(boot.indexOf("'页面出错：'")>=0);
});
test('頁面骨架：除頁首（改版）外，#err、#chat、noscript 與原版逐字相同（dev.html 與 index.html）', ()=>{
  const pick=h=>h.slice(h.indexOf('<div id="app">'),h.indexOf('</div>\n<script')+6);
  // 設計改版：頁首拿掉重複的頭像、加進度線（#prog）。其餘（#err、#chat、noscript）仍須與原版逐字相同。
  const noHeader=t=>t.split('\n').filter(l=>l.indexOf('<header>')<0).join('\n');
  const NEW_HEADER='<header><div><b>健身小助手</b><small>回答几个问题，生成你的专属计划</small></div><div id="prog"><i></i></div></header>';
  assert.ok(pick(origHtml).length>100);
  ['dev.html','index.html'].forEach(f=>{
    const p=pick(fs.readFileSync(path.join(ROOT,f),'utf8'));
    assert.strictEqual(noHeader(p),noHeader(pick(origHtml)));
    assert.ok(p.indexOf(NEW_HEADER)>=0, f+' 的頁首不是新版');
  });
});


console.log('問卷（questions.js）');
const STEPS=G('STEPS'), bmiOf=G('bmiOf'), autoGoal=G('autoGoal'), AUTO_TIME=G('AUTO_TIME'), allowed=G('allowed');
const GOALS_=G('GOAL'), REPS_=G('REPS'), LIB_=G('LIB'), SCHED_=G('SCHED');
// 依「每一題的選項」逐一點選，產生使用者答案；可指定亂數種子讓結果可重現
function rng(seed){ let s=seed>>>0||1; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296 } }
function fillBody(r,st){
  const v={};
  st.fields.forEach(f=>{ v[f.k]=(f.optional && r()<.5) ? null : Math.round((f.min+r()*(f.max-f.min))*2)/2 });
  v.age=Math.round(v.age); v.height=Math.round(v.height);
  return v;
}
function simulate(r,A){
  const picks=[];
  STEPS.forEach(st=>{
    let v, opt=null;
    if(st.k==='screen'){ v=['none'] }
    else if(st.type==='nums'){ v=fillBody(r,st); v.age=18+Math.floor(r()*47) }
    else {
      const opts=st.opts(A).filter(x=>!x.header);
      if(st.type==='pick'){ opt=opts[Math.floor(r()*opts.length)]; v=opt.value }
      else { // multi：隨機選幾項；選了「none」就互斥
        const chosen=opts.filter(()=>r()<.4).map(o=>o.value).filter(x=>x!=='none');
        v=chosen.length?chosen:['none'];
      }
    }
    st.set(A,v);
    const t=st.react?st.react(v,A,opt):null;
    if(t!==null && t!==undefined) assert.strictEqual(typeof t,'string',st.k+' react');
    picks.push([st.k,J(v)]);
  });
  return picks;
}
test('問卷：11 題（安全篩檢 + 10 題）、每題型別與欄位完整；選項值都不重複（同值只允許用 id 區分）', ()=>{
  assert.strictEqual(STEPS.length,11); assert.strictEqual(STEPS[0].k,'screen');
  const A=base({});
  STEPS.forEach(st=>{
    assert.ok(['nums','pick','multi'].indexOf(st.type)>=0, st.k);
    assert.ok(st.q && typeof st.set==='function', st.k);
    if(st.type==='nums'){ st.fields.forEach(f=>assert.ok(f.min<f.def && f.def<f.max && f.s1>0 && f.s2>0, f.k)) }
    else {
      const o=st.opts(A).filter(x=>!x.header); assert.ok(o.length>=2, st.k);
      o.forEach(x=>assert.ok(x.label && x.value!==undefined, st.k));
      const labels=o.map(x=>x.label); assert.strictEqual(new Set(labels).size,labels.length, st.k+' 標籤重複');
      const vals=o.map(x=>JSON.stringify(x.value)); const dup=vals.filter((v,i)=>vals.indexOf(v)!==i);
      dup.forEach(v=>assert.ok(o.filter(x=>JSON.stringify(x.value)===v).every(x=>x.id), st.k+' 同值選項需要 id：'+v));
      if(st.type==='multi') assert.ok(o.some(x=>x.value==='none'), st.k+' 要有「没有」出口');
    }
  });
});
test('問卷：隨機答 3000 次，答案一律通過 validSaved，且 calc/workout/menu/卡片都算得出來（沒有 undefined/NaN）', ()=>{
  const r=rng(20261125); const sc=G('summaryCard'), wc=G('workoutCard'), mc=G('menuCard');
  for(let n=0;n<3000;n++){
    const A={}; simulate(r,A);
    assert.ok(validSaved(J(A)), '答案不合法：'+JSON.stringify(A));
    const C=calc(A); assert.ok(isFinite(C.kcal) && C.kcal>0, 'kcal '+C.kcal);   // 極端身體資料（例如 75 歲、130cm、30kg）的維持熱量本來就可能低於 1000，原版同樣如此
    assert.strictEqual(workout(A).length, A.days);
    assert.strictEqual(menu(A,C).length,7);
    [sc(A,C),wc(A),mc(A,C)].forEach(h=>assert.ok(!/undefined|NaN|\[object/.test(h)));
  }
});
test('問卷：「說不清，幫我判斷」依 BMI 判斷（≥24 減脂、<18.5 增肌、其餘體態）', ()=>{
  assert.strictEqual(autoGoal(24),'fat'); assert.strictEqual(autoGoal(23.9),'shape');
  assert.strictEqual(autoGoal(18.5),'shape'); assert.strictEqual(autoGoal(18.4),'muscle');
  const goal=STEPS.filter(s=>s.k==='goal')[0];
  [[160,70,'fat'],[160,45,'muscle'],[160,55,'shape']].forEach(([h,w,g])=>{ const A={height:h,weight:w}; goal.set(A,'auto'); assert.strictEqual(A.goal,g) });
  const A2={height:160,weight:70}; goal.set(A2,'keep'); assert.strictEqual(A2.goal,'keep');
});
test('問卷：「建议」標記只出現在有依據的選項（BMI 與運動基礎）', ()=>{
  const goal=STEPS.filter(s=>s.k==='goal')[0], time=STEPS.filter(s=>s.k==='time')[0];
  const recs=(st,A)=>st.opts(A).filter(x=>x.rec).map(x=>x.value.days!==undefined?x.value.days+'x'+x.value.mins:x.value);
  assert.deepStrictEqual(J(recs(goal,{height:160,weight:70})),['fat']);
  assert.deepStrictEqual(J(recs(goal,{height:160,weight:45})),['muscle']);
  assert.deepStrictEqual(J(recs(goal,{height:160,weight:55})),[]);
  assert.deepStrictEqual(J(recs(time,{exp:'new'})),['3x30']); assert.deepStrictEqual(J(recs(time,{exp:'some'})),['3x45']); assert.deepStrictEqual(J(recs(time,{exp:'reg'})),['4x45']);
});
test('問卷：「我不確定，幫我定」依運動基礎；回應文字與實際設定一致', ()=>{
  const time=STEPS.filter(s=>s.k==='time')[0];
  ['new','some','reg'].forEach(e=>{
    const A={exp:e}; time.set(A,{auto:true});
    assert.deepStrictEqual(J({d:A.days,m:A.mins}),J({d:AUTO_TIME[e].days,m:AUTO_TIME[e].mins}));
    assert.ok(time.react({auto:true},A).indexOf('每周 '+A.days+' 次')>=0);
    assert.ok(SCHED_[A.days] && REPS_[e] && [30,45,60].indexOf(A.mins)>=0);
  });
  assert.strictEqual(time.react({days:3,mins:30},{days:3,mins:30}),null);
});
test('問卷：兩個選項值相同（偶尔动一动／以前练过…）用 id 給不同回應', ()=>{
  const exp=STEPS.filter(s=>s.k==='exp')[0], o=exp.opts({});
  const some=o.filter(x=>x.id==='some')[0], back=o.filter(x=>x.id==='back')[0];
  assert.strictEqual(some.value,back.value);
  assert.strictEqual(exp.react('some',{},some),null);
  assert.ok(exp.react('some',{},back).indexOf('有一点基础')>=0);
});
test('問卷：「還沒想好」場地 → 徒手並提示；BMI 偏低時有說明', ()=>{
  const place=STEPS.filter(s=>s.k==='place')[0], o=place.opts({}), u=o.filter(x=>x.id==='undecided')[0];
  const A={}; place.set(A,u.value); assert.strictEqual(A.place,'body');
  assert.ok(place.react(u.value,A,u).indexOf('徒手')>=0);
  const body=STEPS.filter(s=>s.k==='body')[0]; assert.ok(body.react({age:30,height:160,weight:45}).indexOf('偏低')>=0); assert.strictEqual(body.react({age:30,height:160,weight:55}),null);
  const goal=STEPS.filter(s=>s.k==='goal')[0]; const A2={height:160,weight:45,goal:'fat'};
  assert.ok(goal.react('fat',A2,{value:'fat'}).indexOf('维持')>=0);
});
test('問卷：新忌口「不吃牛羊肉」「不吃猪肉」→ 菜單與食物庫都避開', ()=>{
  [['nobeef','瘦牛肉（烤熟）'],['nobeef','羊腿肉（瘦、烤熟）'],['nopork','猪里脊（烤熟）']].forEach(([d,name])=>{
    const A=base({diet:[d],goal:'muscle',weight:60}); const C=calc(A);
    assert.strictEqual(allowed(FM[name],A),false);
    assert.strictEqual(allowed(FM['鸡胸肉（熟）'],A),true);
    menu(A,C).forEach(day=>day.meals.forEach(m=>m.items.forEach(it=>assert.notStrictEqual(it.n,name))));
  });
  // 食物庫：羊肉對「不吃牛羊肉」會標成不推薦；對「不吃猪肉」則不會
  const fl=G('foodLibCard');
  const block=(html,name)=>html.split('<div class="meal"').filter(b=>b.indexOf('<b>'+name+'</b>')>=0)[0];
  assert.ok(block(fl({diet:['nobeef']}),'羊腿肉（瘦、烤熟）').indexOf('你的忌口，不推荐')>=0);
  assert.ok(block(fl({diet:['nobeef']}),'瘦牛肉（烤熟）').indexOf('你的忌口，不推荐')>=0);
  assert.ok(block(fl({diet:['nobeef']}),'猪里脊（烤熟）').indexOf('你的忌口，不推荐')<0);
  assert.ok(block(fl({diet:['nopork']}),'羊腿肉（瘦、烤熟）').indexOf('你的忌口，不推荐')<0);
  assert.strictEqual(allowed(FM['羊腿肉（瘦、烤熟）'],{diet:['nopork']}),true);
  assert.strictEqual(allowed(FM['羊腿肉（瘦、烤熟）'],{diet:['veg']}),false);   // 素食本來就不吃肉
  const A=base({diet:['nobeef','nopork','lactose','seafood']}); menu(A,calc(A)).forEach(d=>assert.strictEqual(d.meals.length,4));
});



test('羊腿肉進菜單：一般飲食一週 1 餐、任何飲食都不超過 2 餐；素食與「不吃牛羊肉」永遠沒有；其他餐與原版相同', ()=>{
  const O=L.loadOriginal(ORIG_FILE), oMenu=vm.runInContext('menu',O), oCalc=vm.runInContext('calc',O);
  const LAMB='羊腿肉（瘦、烤熟）';
  const lambCount=M=>{ let n=0; M.forEach(d=>d.meals.forEach(m=>m.items.forEach(it=>{ if(it.n===LAMB) n++ }))); return n };
  [['none'],['lactose'],['seafood'],['nopork'],['nobeef'],['veg'],['veg','lactose'],['lactose','seafood'],['nobeef','nopork'],['nobeef','nopork','seafood','lactose']].forEach(diet=>{
    [45,55,70,90].forEach(w=>['fat','muscle','keep'].forEach(goal=>{
      const A=base({diet,weight:w,goal}); const M=menu(A,calc(A)), n=lambCount(M);
      assert.ok(n<=2,diet+' 羊肉 '+n+' 餐');
      if(diet.indexOf('veg')>=0 || diet.indexOf('nobeef')>=0) assert.strictEqual(n,0,diet+' 不該有羊肉');
      if(diet.length===1 && diet[0]==='none') assert.strictEqual(n,1);
      // 與原版比對：原版沒有 nobeef/nopork，這兩種只比對「沒有這兩個值」的情況
      if(['nobeef','nopork'].every(x=>diet.indexOf(x)<0)){
        const OM=J(oMenu(A,oCalc(A))), NM=JNOPR(M);
        if(diet.indexOf('veg')>=0) NM.forEach((d,i)=>{ if(Math.abs(OM[i].total.k-oCalc(A).kcal)<=oCalc(A).kcal*0.03) assert.deepStrictEqual(d,OM[i],'素食菜單：原版沒超標的天不該變'); });
        if(diet.length===1 && diet[0]==='none') NM.forEach((d,i)=>{
          const names=m=>m.items.map(it=>it.n);
          assert.deepStrictEqual(names(d.meals[0]),names(OM[i].meals[0])); assert.deepStrictEqual(names(d.meals[1]),names(OM[i].meals[1]));   // 每天的早餐、午餐吃的食物不變（只有克數可能因校準而調整）
          assert.deepStrictEqual(names(d.meals[3]),names(OM[i].meals[3]));                                                                  // 加餐也不變
          if(i<4 && Math.abs(OM[i].total.k-oCalc(A).kcal)<=oCalc(A).kcal*0.03) assert.deepStrictEqual(d,OM[i],'前四天整天（含克數）不該變（原版沒超標的天）');                                                              // 前四天完全相同
        });
        if(diet.length===1 && diet[0]==='none') assert.ok(NM.some((d,i)=>i>=4 && d.meals[2].items[0].n!==OM[i].meals[2].items[0].n),'後三天的晚餐應該有輪到羊肉');
      }
    }));
  });
});


test('菜單熱量校準：整天熱量與目標差 ≤ 8%；原版沒超標的天完全不變、超標的天只會更準；蛋白質說明只在真的吃不到時出現', ()=>{
  const O=L.loadOriginal(ORIG_FILE), oMenu=vm.runInContext('menu',O), oCalc=vm.runInContext('calc',O);
  const mc=G('menuCard'); let worst=0, fixed=0, days=0, notes=0, profiles=0;
  [['none'],['veg'],['veg','lactose'],['lactose'],['seafood'],['lactose','seafood'],['nobeef'],['nopork']].forEach(diet=>{
    [20,35,60].forEach(age=>[150,160,170].forEach(height=>[42,50,58,66,80,100].forEach(weight=>['fat','muscle','keep'].forEach(goal=>{
      const A=base({diet,age,height,weight,goal,days:3}); const C=calc(A), M=menu(A,C); profiles++;
      M.forEach(d=>{ days++; const dev=Math.abs(d.total.k-C.kcal)/C.kcal; worst=Math.max(worst,dev); assert.ok(dev<=0.08,'熱量偏差 '+(dev*100).toFixed(1)+'%：'+JSON.stringify(diet)+' '+goal+' '+weight+'kg') });
      // 與原版比對（原版沒有羊肉與 nobeef/nopork，只比對輪換池沒變的飲食：素食、素食+乳糖）
      if(diet.indexOf('veg')>=0){
        const OM=J(oMenu(A,oCalc(A))), NM=JNOPR(M), tgt=oCalc(A).kcal;
        NM.forEach((d,i)=>{ const od=Math.abs(OM[i].total.k-tgt)/tgt;
          if(od<=0.03) assert.deepStrictEqual(d,OM[i],'原版沒超標的天不該變');
          else{ fixed++; assert.ok(Math.abs(d.total.k-tgt)/tgt<=od+1e-9,'超標的天應該更準') } });
      }
      // 蛋白質說明：平均低於目標 85% 才出現，而且數字就是實際平均
      const avgP=M.reduce((s,d)=>s+d.total.p,0)/M.length, html=mc(A,C), has=html.indexOf('每天的蛋白质平均约')>=0;
      assert.strictEqual(has, avgP<C.p*0.85,'蛋白質說明出現與否不符：'+avgP+' / '+C.p);
      if(has){ notes++; assert.ok(html.indexOf('约 '+Math.round(avgP)+' g')>=0) }
    }))));
  });
  assert.ok(worst<=0.08); assert.ok(fixed>200,'應該有大量原本超標、這次修正的天：'+fixed); assert.ok(notes>0 && notes<profiles*0.2,'蛋白質說明比例：'+notes+'/'+profiles);
});
test('菜單校準：被校準的食物（主食、蛋白質食物）克數 ≥ 5 且是 5 的倍數；主食與蛋白質食物都有標記；一般飲食蛋白質不會被縮到目標的一半以下', ()=>{
  [['none'],['veg']].forEach(diet=>[42,58,80,100].forEach(weight=>['fat','muscle'].forEach(goal=>{
    const A=base({diet,weight,goal}); const C=calc(A), M=menu(A,C);
    M.forEach(d=>d.meals.forEach(m=>m.items.forEach(it=>{ if(it.st||it.pr) assert.ok(it.g>=5 && it.g%5===0,it.n+' '+it.g) })));   // 主食與蛋白質食物的克數會被校準：5 的倍數（水果、坚果、油是固定份量）
    if(diet[0]==='none') M.forEach(d=>assert.ok(d.total.p>=C.p*0.5,'一般飲食蛋白質過低'));
  })));
});


console.log('蛋白質係數、依當天動作熱身、食物鐵鈣');
test('蛋白質：減脂、增肌 1.6 g/kg，其餘 1.5 g/kg（四捨五入）', ()=>{
  [50,55,63,80].forEach(w=>{
    assert.strictEqual(calc(base({weight:w,goal:'fat'})).p,Math.round(w*1.6));
    assert.strictEqual(calc(base({weight:w,goal:'muscle'})).p,Math.round(w*1.6));
    assert.strictEqual(calc(base({weight:w,goal:'shape'})).p,Math.round(w*1.5));
  });
});
test('熱身：每個訓練日都有；有下肢動作的日子有髖活動，有上肢動作的日子有肩、手臂繞環；有氧日不顯示', ()=>{
  const wu=G('warmupHtml');
  let lowerDays=0, upperDays=0, plain=0;
  ['body','home','gym'].forEach(place=>[2,3,4,5].forEach(days=>{
    const A=base({place,days}); const W=workout(A);
    const html=G('workoutCard')(A);
    W.filter(d=>!d.cardio).forEach(d=>{
      const h=wu(d.ex), gs=d.ex.map(e=>EXM[e].g);
      const lo=gs.some(g=>['sq','lg','gl','hg','calf'].indexOf(g)>=0), up=gs.some(g=>['hp','vp','hr','vr','rd','tr','bi'].indexOf(g)>=0);
      assert.ok(h.indexOf('第一个动作做 1–2 组')>=0,'沒有輕量第一個動作說明');
      assert.strictEqual(h.indexOf('90/90 髋转换')>=0, lo);
      assert.strictEqual(h.indexOf('肩部绕环')>=0, up);
      assert.strictEqual(h.indexOf('手臂绕环')>=0, up);
      if(lo) lowerDays++; if(up) upperDays++; if(!lo && !up) plain++;
    });
    assert.strictEqual((html.match(/热身（约 5 分钟）/g)||[]).length, W.filter(d=>!d.cardio).length);
    assert.ok(html.indexOf('每次训练前 5 分钟')<0,'舊的全域熱身區塊還在');
  }));
  assert.ok(lowerDays>0 && upperDays>0,'應該兩種日子都有：'+lowerDays+'/'+upperDays);
});
test('鐵、鈣：菜單每天都顯示，數字就是食物含量 × 克數；不看數字模式不顯示；食物庫每種都顯示', ()=>{
  const mc=G('menuCard'), fl=G('foodLibCard');
  [['none'],['veg'],['lactose']].forEach(diet=>{
    const A=base({diet}), C=calc(A), M=menu(A,C), html=mc(A,C);
    assert.strictEqual((html.match(/食物里大约含：铁/g)||[]).length,7);
    M.forEach(d=>{ let fe=0,ca=0; d.meals.forEach(m=>m.items.forEach(it=>{ fe+=FM[it.n].fe*it.g/100; ca+=FM[it.n].ca*it.g/100 }));
      assert.ok(html.indexOf('铁 '+fe.toFixed(1)+' mg · 钙 '+Math.round(ca)+' mg')>=0); });
    assert.ok(html.indexOf('请去医院验血')>=0);
    assert.ok(mc(base({diet,nonum:true}),calc(base({diet,nonum:true}))).indexOf('钙 ')<0,'不看數字模式不該顯示鐵鈣');
  });
  const lib=fl(base());
  FOODS.forEach(f=>assert.ok(lib.indexOf('铁 '+f.fe+' mg · 钙 '+f.ca+' mg')>=0,f.n));
  assert.ok(fl(base({nonum:true})).indexOf('铁 ')<0);
});

console.log('重點部位細分');
const FOCUS_ROWS=G('FOCUS_ROWS'), FOCUS_LABEL=G('FOCUS_LABEL'), FOCUS_NAMES=G('FOCUS_NAMES'), usableNames=G('usableNames'), WOMEN_=G('WOMEN');
const NEW_AREAS=['chest','shoulder','lats','posture','triceps','biceps','abs','obliques','glutes','abduct','quads','hams','inner','calves'];
test('重點部位：每個部位都有顯示名稱；指定名稱的動作都存在；舊的 hips/arms 仍可用', ()=>{
  NEW_AREAS.concat(['hips','arms']).forEach(k=>{ assert.ok(FOCUS_LABEL[k],k+' 沒有顯示名稱'); assert.ok(FOCUS_ROWS[k] && FOCUS_ROWS[k].length>0,k+' 沒有候選動作') });
  Object.keys(FOCUS_NAMES).forEach(k=>FOCUS_NAMES[k].forEach(n=>assert.ok(EXM[n],k+' 的動作不存在：'+n)));
  Object.keys(FOCUS_ROWS).forEach(k=>FOCUS_ROWS[k].forEach(x=>assert.ok(x && x.n,k+' 有空洞')));
});
test('重點部位：問卷的每個選項都有對應的部位；最多選 3 個；有「没有」出口', ()=>{
  const st=STEPS.filter(s=>s.k==='focus')[0]; assert.strictEqual(st.max,3);
  const o=st.opts({}), vals=o.filter(x=>!x.header).map(x=>x.value);
  vals.filter(v=>v!=='none').forEach(v=>assert.ok(FOCUS_ROWS[v] && FOCUS_LABEL[v],v));
  assert.deepStrictEqual(J(vals.filter(v=>v!=='none').slice().sort()),J(NEW_AREAS.slice().sort()),'問卷選項要涵蓋全部 14 個部位');
  assert.ok(vals.indexOf('none')>=0);
  assert.strictEqual(o.filter(x=>x.header).length,4);
  const r=st.react(['chest','glutes'],{}); assert.ok(r.indexOf('胸部')>=0 && r.indexOf('臀部')>=0);
});
test('胸部：徒手 7 個、家裡 9 個、健身房 15 個候選；肩頸不適時全部排除並在計劃卡提示', ()=>{
  const A=n=>base({place:n,injury:['none']});
  assert.strictEqual(usableNames(FOCUS_ROWS.chest,A('body')).length,7);
  assert.strictEqual(usableNames(FOCUS_ROWS.chest,A('home')).length,9);
  assert.strictEqual(usableNames(FOCUS_ROWS.chest,A('gym')).length,15);
  const B=base({place:'gym',injury:['s'],focus:['chest']});
  assert.strictEqual(usableNames(FOCUS_ROWS.chest,B).length,0);
  assert.ok(workout(B).every(d=>d.cardio||d.focus.length===0));
  assert.ok(G('workoutCard')(B).indexOf('「胸部」')>=0, '胸部沒有動作時要說明');
  const C=base({place:'gym',injury:['s'],focus:['chest','glutes']});
  const card=G('workoutCard')(C); assert.ok(card.indexOf('「胸部」')>=0 && card.indexOf('「臀部」')<0, '只提示真的沒有動作的部位');
});
test('重點部位：全部 14 個部位 × 3 種場地 × 5 種不適 × 5 種天數，加練動作都符合器材、避開不適部位、不重複當天動作、最多 2 個', ()=>{
  const PL={gym:2,home:1,body:0}; let checked=0;
  NEW_AREAS.forEach(area=>['gym','home','body'].forEach(place=>[['none'],['k'],['b'],['s'],['k','b','s']].forEach(inj=>[2,3,4,5].forEach(days=>{
    const A=base({place,injury:inj,days,focus:[area]});
    workout(A).forEach(d=>{
      if(d.cardio) return; assert.ok(d.focus.length<=2);
      d.focus.forEach(n=>{ const m=EXM[n]; assert.ok(m,n); assert.ok(m.lv<=PL[place],place+' 器材不符 '+n); assert.ok(!(m.t&&inj.indexOf(m.t)>=0),'碰到不適 '+n); assert.ok(d.ex.indexOf(n)<0,'重複 '+n); checked++ });
    });
  }))));
  assert.ok(checked>1000,'檢查筆數 '+checked);
});
test('重點部位：每個部位在「無不適」時，至少一種場地有動作；多個部位會輪流出現', ()=>{
  NEW_AREAS.forEach(a=>assert.ok(['gym','home','body'].some(p=>usableNames(FOCUS_ROWS[a],base({place:p})).length>0),a));
  const A=base({place:'gym',days:5,focus:['chest','lats','calves']});
  const seen={}; workout(A).forEach(d=>(d.focus||[]).forEach(n=>seen[n]=1));
  const hit=['chest','lats','calves'].filter(a=>FOCUS_ROWS[a].some(x=>seen[x.n]));
  assert.ok(hit.length>=2,'輪流取部位：'+hit);
});
test('女性常練動作庫包含胸、肩、手臂動作，且名稱都存在', ()=>{
  ['标准俯卧撑','哑铃上斜卧推','蝴蝶机夹胸','阿诺德推举','锤式弯举','坐姿髋内收（器械）'].forEach(n=>assert.ok(WOMEN_.indexOf(n)>=0,n));
  WOMEN_.forEach(n=>assert.ok(EXM[n] && EXM[n].how,n));
});


console.log('健康管理庫（data-health.js / health.js）');
const HS=J(G('HEALTH_SRC')), HT=J(G('HEALTH_TOPICS')), HD=J(G('DISCOMFORT')), HNOTE=G('HEALTH_NOTE');
const validLog=G('validLog'), logUpsert=G('logUpsert'), logStats=G('logStats'), logSeries=G('logSeries'), chartSvg=G('chartSvg'), dateKey=G('dateKey'), isDateKey=G('isDateKey');
const logCard=G('logCard'), healthKnowledgeCard=G('healthKnowledgeCard'), discomfortCard=G('discomfortCard'), logText=G('logText'), LOG_MAX=G('LOG_MAX');
const allHealthText=()=>{ const o=[]; HT.forEach(x=>{ o.push(x.title); x.pts.forEach(p=>o.push(p)) }); Object.keys(HD).forEach(k=>['common','self','see','soon','urgent'].forEach(f=>HD[k][f].forEach(p=>o.push(p)))); return o };
test('健康資料：每個來源有名稱、https 網址（只限 NHS、WHO、DOI、中國指南期刊、ACOG、PAR-Q+ 官網）、日期；主題與部位引用的來源都存在', ()=>{
  Object.keys(HS).forEach(k=>{ const s=HS[k]; assert.ok(s.n && s.d && /^https:\/\/(www\.nhs\.uk|www\.who\.int|doi\.org|www\.besjournal\.com|www\.acog\.org|eparmedx\.com)\//.test(s.u),k) });
  assert.strictEqual(new Set(HT.map(x=>x.id)).size,HT.length);
  HT.forEach(x=>{ assert.ok(x.title && x.pts.length>=4,x.id); x.src.forEach(k=>assert.ok(HS[k],x.id+' 缺來源 '+k)); x.pts.forEach(p=>assert.ok(typeof p==='string' && p.length>5,x.id)) });
  ['k','b','s'].forEach(k=>{ const d=HD[k]; assert.ok(d.name && d.common.length && d.self.length && d.see.length && d.soon.length,k); d.src.forEach(s=>assert.ok(HS[s],k+' 缺來源 '+s)) });
  assert.ok(HNOTE.indexOf('不是诊断')>=0 && HNOTE.indexOf('NHS')>=0);
});
test('健康資料：不含藥名、劑量與英國急救電話（只說行動，不給醫療建議）', ()=>{
  const bad=/(paracetamol|ibuprofen|布洛芬|对乙酰|扑热息痛|止痛药|mg|毫克.*片|\b999\b|\b111\b|\b112\b)/i;
  allHealthText().forEach(s=>{ if(s.indexOf('200 毫克')>=0) return; assert.ok(!bad.test(s),'含不該寫的內容：'+s) });   // 例外：NHS 原文「孕期咖啡因每天不超過 200 毫克」
});
test('健康資料：關鍵數字與原文一致（運動量、喝水、冰敷時間、恢復時間等）', ()=>{
  const has=(id,xs)=>{ const s=HT.filter(x=>x.id===id)[0].pts.join('\n'); xs.forEach(x=>assert.ok(s.indexOf(x)>=0,id+' 缺：'+x)) };
  has('activity',['150 分钟','75 分钟','2 天','4–5 天','能说话、但唱不出歌']);
  has('sitting',['7 小时']);
  has('sleep',['1 小时','1–2 小时','20 分钟']);
  has('water',['6–8 杯','150 毫升','200 毫克']);
  has('weight',['10 分钟','低于 35']);
  has('period',['3 天']);
  has('pregnancy',['150 分钟','10 分钟','6–8 周']);
  const flat=f=>HD[f].self.concat(HD[f].common,HD[f].see,HD[f].soon).join('\n');
  ['20 分钟','2–3 小时'].forEach(x=>assert.ok(flat('k').indexOf(x)>=0,'膝 '+x));
  ['2 周','6–8 周','6 个月'].forEach(x=>assert.ok(flat('s').indexOf(x)>=0,'肩 '+x));
  assert.ok(flat('b').indexOf('几周')>=0);
  assert.ok(HD.b.urgent.length>=4 && HD.k.urgent.length===0);
});
test('健康資料：沒有原文以外的「去診斷」口吻（不寫「你得了」「確診」「治療方案」）', ()=>{
  allHealthText().forEach(s=>assert.ok(!/(你得了|你患了|确诊|治疗方案|处方)/.test(s),s));
});
test('記錄檢查 validLog：合法的收、各種竄改與壞資料都拒絕', ()=>{
  const ok=[{d:'2026-11-25',w:50.5,wa:70,s:7.5,h:6},{d:'2026-11-26',s:8}];
  assert.strictEqual(validLog(ok),true); assert.strictEqual(validLog([]),true);
  const bad=[null,{},'x',[{d:'2026-02-30',w:50}],[{d:'2026-11-25'}],[{d:'2026-11-25',w:null}],[{d:'2026-11-25',w:'50'}],[{d:'2026-11-25',w:5}],[{d:'2026-11-25',w:500}],
    [{d:'2026-11-25',w:50,x:1}],[{d:'2026-11-25',w:50,__proto__:{a:1},evil:'<script>'}],[{d:'<img onerror=1>',w:50}],[{d:'2026-11-25',w:NaN}],[{d:'2026-11-25',w:Infinity}],
    [{d:'2026-11-26',w:50},{d:'2026-11-25',w:50}],[{d:'2026-11-25',w:50},{d:'2026-11-25',w:51}],[{d:'1999-01-01',w:50}],[{d:'2026-11-25',s:25}],[{d:'2026-11-25',h:-1}]];
  bad.forEach((b,i)=>assert.strictEqual(validLog(b),false,'第 '+i+' 個壞資料被接受了：'+JSON.stringify(b)));
  const big=[]; for(let i=0;i<LOG_MAX+1;i++){ const d=new Date(2025,0,1+i); big.push({d:dateKey(d),w:50}) } assert.strictEqual(validLog(big),false);
});
test('記錄 logUpsert：新增依日期排序、同一天合併不覆蓋沒填的欄位、不改原陣列、最多保留一年', ()=>{
  const A0=[{d:'2026-11-25',w:50,s:7}]; const snap=JSON.stringify(A0);
  const A1=logUpsert(A0,{d:'2026-11-24',wa:70}); assert.deepStrictEqual(J(A1),[{d:'2026-11-24',wa:70},{d:'2026-11-25',w:50,s:7}]);
  const A2=logUpsert(A0,{d:'2026-11-25',w:49.5,h:6,s:null}); assert.deepStrictEqual(J(A2),[{d:'2026-11-25',w:49.5,s:7,h:6}]);
  assert.strictEqual(JSON.stringify(A0),snap);
  let L=[]; for(let i=0;i<LOG_MAX+20;i++){ L=logUpsert(L,{d:dateKey(new Date(2025,0,1+i)),w:50}) }
  assert.strictEqual(L.length,LOG_MAX); assert.ok(validLog(L)); assert.strictEqual(L[L.length-1].d,dateKey(new Date(2025,0,LOG_MAX+20)));
});
test('記錄 logStats：首次、最近、變化、近 7 次平均、腰圍÷身高', ()=>{
  const L=[{d:'2026-11-20',w:52,wa:74,s:6},{d:'2026-11-21',w:51.5,s:7},{d:'2026-11-22',w:51,wa:72,s:8,h:5}];
  const st=logStats(L,160);
  assert.strictEqual(st.w.first.v,52); assert.strictEqual(st.w.last.v,51); assert.ok(Math.abs(st.w.delta+1)<1e-9);
  assert.strictEqual(st.wa.n,2); assert.ok(Math.abs(st.whr-72/160)<1e-9); assert.strictEqual(st.s.avg7,7); assert.strictEqual(st.h.avg7,5);
  assert.strictEqual(logStats([],160).whr,null); assert.strictEqual(logStats([{d:'2026-11-20',w:50}],160).w.delta,null);
});
test('折線圖 chartSvg：點數對、沒有 NaN、單點與全平的資料也能畫、只含圖形元素', ()=>{
  const mk=vs=>vs.map((v,i)=>({d:'2026-11-'+(10+i),v}));
  [[50],[50,50,50],[50,49.5,49,48.8],[1,100],[30,30.5]].forEach(vs=>{
    const s=chartSvg(mk(vs),1);
    assert.ok(!/NaN|undefined|Infinity/.test(s),JSON.stringify(vs)); assert.strictEqual((s.match(/<circle/g)||[]).length,vs.length);
    if(vs.length>1) assert.strictEqual(s.match(/points="([^"]+)"/)[1].split(' ').length,vs.length);
    assert.ok(!/<script|onerror|javascript:/i.test(s)); assert.ok(/^<svg[\s\S]*<\/svg>$/.test(s));
  });
  assert.strictEqual(chartSvg([],1),'');
});
test('日期：dateKey 用本機日期、isDateKey 嚴格檢查', ()=>{
  assert.strictEqual(dateKey(new Date(2026,0,5,23,59)),'2026-01-05'); assert.strictEqual(dateKey(new Date(2026,11,31,0,0)),'2026-12-31');
  assert.ok(isDateKey('2026-02-28') && !isDateKey('2026-02-29') && !isDateKey('2026-2-3') && !isDateKey('2026-13-01') && !isDateKey(20260101));
});
test('健康卡片：沒有 undefined/NaN；來源連結都來自 HEALTH_SRC；每張卡都有免責說明', ()=>{
  const srcUrls=Object.keys(HS).map(k=>HS[k].u);
  [healthKnowledgeCard(),discomfortCard({injury:['k']}),discomfortCard({}),logCard([],160),logCard([{d:'2026-11-25',w:50,wa:70,s:7,h:6},{d:'2026-11-26',w:49.5}],160)].forEach(h=>{
    assert.ok(!/undefined|NaN|\[object/.test(h));
    (h.match(/href="([^"]+)"/g)||[]).forEach(m=>assert.ok(srcUrls.indexOf(m.slice(6,-1))>=0,'未知連結 '+m));
  });
  assert.ok(healthKnowledgeCard().indexOf('不是诊断')>=0 && discomfortCard({}).indexOf('不是诊断')>=0);
  assert.strictEqual((healthKnowledgeCard().match(/<details/g)||[]).length,HT.length);
});
test('不適與運動調整：勾選的部位排最前並標「你選了」；會避開的動作與動作庫的不適標記一致；「還可以練」的動作不帶該標記', ()=>{
  const h=discomfortCard({injury:['b']}); assert.ok(h.indexOf('<summary>腰背 <span class="rec">你选了</span>')>=0);
  assert.ok(h.indexOf('<summary>腰背')<h.indexOf('<summary>膝盖') && h.indexOf('<summary>腰背')<h.indexOf('<summary>肩颈'));
  const none=discomfortCard({injury:['none']}); assert.ok(none.indexOf('你选了')<0);
  [['k','膝盖'],['b','腰背'],['s','肩颈']].forEach(([c,name])=>{
    const av=EXI.filter(x=>x.t===c && x.how); assert.ok(av.length>0,c);
    assert.ok(discomfortCard({injury:[c]}).indexOf('避开 '+av.length+' 个')>=0,c);
    const alt=J(G('safeAlternatives')(c)); assert.ok(alt.length>=3,c+' 還可以練的類別太少'); alt.forEach(g=>{ assert.ok(g.g && g.names.length>0 && g.names.length<=3); g.names.forEach(n=>{ assert.ok(EXM[n] && EXM[n].t!==c && EXM[n].how,c+' '+n) }) });
  });
});
test('複製用文字：表頭加每天一行，沒填的欄位留空', ()=>{
  const s=logText([{d:'2026-11-25',w:50,s:7},{d:'2026-11-26',wa:70}]).split('\n');
  assert.strictEqual(s.length,3); assert.strictEqual(s[1],'2026-11-25\t50\t\t7\t'); assert.strictEqual(s[2],'2026-11-26\t\t70\t\t');
});


console.log('保守版：安全篩檢、年齡門檻、轉介、不看數字');
const referralCard=G('referralCard'), summaryCard=G('summaryCard'), menuCard=G('menuCard'), foodLibCard=G('foodLibCard'), planText=G('planText'), handQty=G('handQty');
test('安全篩檢：只有「以上都没有」才放行；任何一項（含孕產、感冒）都擋下並回傳原因', ()=>{
  const st=STEPS[0], vals=st.opts({}).filter(x=>!x.header).map(x=>x.value);
  assert.deepStrictEqual(J(vals),['heart','chest','faint','chronic','msk','supervised','ill','preg','bf','post','none']);
  assert.strictEqual(st.gate({},['none']),null);
  vals.filter(v=>v!=='none').forEach(v=>assert.deepStrictEqual(J(st.gate({},[v])),[v],v));
  assert.deepStrictEqual(J(st.gate({},['heart','post'])),['heart','post']);
  const A={}; st.set(A,['none']); assert.strictEqual(A.scr,'ok'); assert.deepStrictEqual(J(A.health),['none']);
  const B={}; st.set(B,['chest']); assert.strictEqual(B.scr,'stop');
});
test('年齡門檻：18–64 歲放行，17 以下與 65 以上轉介（依 WHO 與中國指南的成人分組）', ()=>{
  const body=STEPS.filter(s=>s.k==='body')[0];
  [[17,['young']],[18,null],[40,null],[64,null],[65,['old']],[75,['old']],[14,['young']]].forEach(([age,exp])=>{
    const g=body.gate({},{age,height:160,weight:55,waist:null}); assert.deepStrictEqual(g===null?null:J(g),exp,'年齡 '+age) });
  assert.strictEqual(body.react({age:70,height:160,weight:40}),null,'被轉介的人不用再說 BMI');
});
test('轉介卡片：每種原因都有對應說明與來源；胸痛有急救提醒；孕產引用 ACOG；不含任何計劃數字', ()=>{
  const cases={heart:'先问',chest:'立即打急救电话',faint:'先问',chronic:'慢性病患者运动前先咨询医生',msk:'先问',supervised:'先问',ill:'先养',preg:'美国妇产科医师学会',bf:'孕产',post:'孕产',young:'6–17 岁',old:'平衡、灵敏和柔韧'};
  Object.keys(cases).forEach(c=>{
    const h=referralCard([c]);
    assert.ok(h.indexOf(cases[c])>=0,c+' 缺說明');
    assert.ok(!/undefined|NaN|kcal|每日建议摄入/.test(h),c);
    assert.ok(h.indexOf('不是经过验证的筛检工具')>=0 && h.indexOf('eparmedx.com')>=0,c+' 要說明不是 PAR-Q+ 並附官方連結');
    (h.match(/href="([^"]+)"/g)||[]).forEach(m=>assert.ok(Object.keys(HS).some(k=>HS[k].u===m.slice(6,-1)),'未知連結 '+m));
  });
  assert.ok(referralCard(['preg']).indexOf('acog.org')>=0 && referralCard(['heart']).indexOf('acog.org')<0);
  assert.ok(referralCard(['chest']).indexOf('nhs.uk/conditions/chest-pain')>=0);
  const combo=referralCard(['heart','post','ill']); ['先问','孕产','先养'].forEach(s=>assert.ok(combo.indexOf(s)>=0));
});
test('不看數字：結果頁、菜單、食物庫、複製摘要都沒有熱量與克數；菜單改用掌、拳、個、杯', ()=>{
  [['none'],['veg'],['lactose','seafood']].forEach(diet=>['fat','muscle','keep'].forEach(goal=>{
    const A=base({diet,goal,nonum:true}), C=calc(A);
    const outs=[summaryCard(A,C),menuCard(A,C),foodLibCard(A),planText(A,C)];
    outs.forEach(h=>{ assert.ok(!/\d\s*(kcal|g\b|毫升)|BMI|基础代谢|每 100 克/.test(h.replace(/<[^>]+>/g,' ')),'出現數字：'+diet+goal); assert.ok(!/undefined|NaN/.test(h)) });
    const mc=menuCard(A,C); assert.ok(mc.indexOf('掌')>=0 && mc.indexOf('拳')>=0);
    menu(A,C).forEach(d=>d.meals.forEach(m=>m.items.forEach(it=>{ const q=handQty(it); assert.ok(!/\d+\s*g/.test(q),q) })));
  }));
  const A=base({}), C=calc(A); assert.ok(summaryCard(A,C).indexOf('kcal')>=0,'沒選「不看數字」時照常顯示數字');
});
test('存檔檢查：nonum 必須是布林、scr 只能是 ok/stop、screen 必須是字串陣列', ()=>{
  const ok=J(base({scr:'ok',nonum:true,screen:['none']})); assert.ok(validSaved(ok));
  assert.ok(!validSaved(Object.assign({},ok,{nonum:'yes'}))); assert.ok(!validSaved(Object.assign({},ok,{scr:'<x>'}))); assert.ok(!validSaved(Object.assign({},ok,{screen:[1]})));
  assert.ok(validSaved(J(base({}))),'沒有 scr 的舊存檔格式仍然合法（流程上會要求重新篩檢）');
});
test('舊存檔補答：只有「安全篩檢」「要不要看數字」是後來新增的題目，其他題目不需要補問', ()=>{
  const old=J(base({})); delete old.scr; delete old.nonum;
  assert.deepStrictEqual(J(STEPS.filter(s=>s.need&&s.need(old)).map(s=>s.k)),['screen','nonum']);
  assert.deepStrictEqual(J(STEPS.filter(s=>s.need&&s.need(Object.assign({},old,{scr:'ok',nonum:false}))).map(s=>s.k)),[]);
  assert.deepStrictEqual(J(STEPS.filter(s=>s.need&&s.need(Object.assign({},old,{scr:'ok'}))).map(s=>s.k)),['nonum']);
});
test('問卷最後一題：要不要看數字，兩個選項是 false / true', ()=>{
  const st=STEPS[STEPS.length-1]; assert.strictEqual(st.k,'nonum');
  assert.deepStrictEqual(J(st.opts({}).map(o=>o.value)),[false,true]);
  const A={}; st.set(A,true); assert.strictEqual(A.nonum,true);
});

console.log('建置與部署');
const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const codeOnly=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').replace(/<!--[\s\S]*?-->/g,'');
test('index.html 是最新的（等於 node tools/build.js 的輸出）', ()=>{
  assert.ok(require('../tools/build.js')().html===src('index.html'), 'src/ 或 dev.html 改過但沒重新產生 index.html：請執行 node tools/build.js');
});
test('index.html 是單一檔案：沒有任何外部 <script src>、<link>', ()=>{
  const h=src('index.html');
  assert.ok(!/<script[^>]+src=/.test(h) && !/<link[^>]+href=/.test(h));
  assert.strictEqual((h.match(/<script>/g)||[]).length,9);
});
test('正式版 index.html 載入後與 src/ 版本的函式輸出相同', ()=>{
  const b=L.loadBuilt(), A=base({focus:['abs'],injury:['s']});
  ['summaryCard','workoutCard','menuCard'].forEach(n=>{
    const C=vm.runInContext('calc',b)(A);
    assert.strictEqual(vm.runInContext(n,b)(A,C), G(n)(A,calc(A)), n);
  });
});
test('dev.html 引用的檔案都存在、順序正確、每個 <script src>/<link> 都有 onerror', ()=>{
  const h=src('dev.html');
  L.scriptOrder().concat(['src/style.css']).forEach(f=>assert.ok(fs.existsSync(path.join(ROOT,f)),f));
  (h.match(/<script src=[^>]*>/g)||[]).concat(h.match(/<link [^>]*>/g)||[]).forEach(t=>assert.ok(/onerror=/.test(t),t));
  assert.deepStrictEqual(L.scriptOrder(),['src/js/data-exercises.js','src/js/data-foods.js','src/js/data-health.js','src/js/logic.js','src/js/render.js','src/js/health.js','src/js/questions.js','src/js/app.js']);
});
const files=['index.html','dev.html','src/style.css'].concat(L.scriptOrder());
test('不使用老版微信不支援的語法/API', ()=>{
  const bad=[[/\?\.(?![0-9])/,'?.'],[/\?\?/,'??'],[/\bimport\b/,'import'],[/\bexport\b/,'export'],[/type=["']module/,'type=module'],
    [/:has\(/,':has()'],[/\bdvh\b|\bsvh\b|\blvh\b/,'dvh/svh/lvh'],[/\.replaceWith\(/,'replaceWith'],[/\.replaceChildren\(/,'replaceChildren'],
    [/structuredClone/,'structuredClone'],[/\.at\(/,'.at()'],[/\.flatMap\(|\.flat\(/,'flat/flatMap'],[/Object\.fromEntries/,'fromEntries'],
    [/\.matchAll\(/,'matchAll'],[/\.padStart\(|\.padEnd\(/,'padStart'],[/\.finally\(/,'Promise.finally'],[/<input/,'<input>'],
    [/\bclass\s+[A-Z]\w*\s*\{[^}]*#/,'私有欄位'],[/\?\?=|\|\|=|&&=/,'邏輯指派']];
  files.forEach(f=>{ const s=codeOnly(src(f)); bad.forEach(([re,name])=>assert.ok(!re.test(s), f+' 用了 '+name)) });
});
test('掃描規則有效：原版的 :has() 會被抓到（重構版已改用 class）', ()=>{
  const s=codeOnly(origHtml);
  assert.ok(/:has\(/.test(s)); assert.ok(!/\?\.(?![0-9])/.test(s));
});
test('沒有外部資源請求（只允許使用者點擊的 B 站搜尋連結與健康知識的出處連結）', ()=>{
  files.forEach(f=>{ const s=codeOnly(src(f));
    assert.ok(!/(src|href)=["']?(https?:)?\/\//.test(s), f+' 有外部 src/href');
    assert.ok(!/url\(/.test(s), f+' 有 css url()');
    const okUrls=Object.values(J(G('HEALTH_SRC'))).map(x=>x.u);   // 健康知識的出處連結：只會在使用者點擊時才開啟，不會自動請求
    (s.match(/https?:\/\/[^'"\s)]+/g)||[]).forEach(u=>assert.ok(u.indexOf('https://search.bilibili.com/all?keyword=')===0 || okUrls.indexOf(u)>=0, f+' '+u));
  });
});
test('localStorage 都在 try/catch 裡', ()=>{
  L.scriptOrder().forEach(f=>codeOnly(src(f)).split('\n').forEach(l=>{ if(/localStorage\./.test(l)) assert.ok(/try\s*\{/.test(l), f+'：'+l.trim()) }));
});

console.log('\n'+(fail?'失敗':'全部通過')+'：'+pass+' 通過，'+fail+' 失敗');
process.exit(fail?1:0);
