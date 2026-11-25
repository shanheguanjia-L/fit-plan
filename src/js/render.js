/* 卡片 HTML：只把資料組成 HTML 字串，不碰 DOM（Node 測試可直接比對輸出）。
   安全前提：拼進 HTML 的只有本頁常數（動作、食物、文案）、計算出的數字，以及經 validSaved() 檢查過的存檔欄位；
   沒有任何使用者自由輸入的文字。若日後加入自由輸入，必須先做 HTML 跳脫。 */

const F = x=>x.toFixed(1);
/* ---------- 「不看數字」模式（A.nonum）：不顯示熱量、克數、BMI 等數字，飲食改用手掌、拳頭表示份量 ---------- */
function summaryCardNoNum(A,C){
  let w='';
  if(C.low && (A.goal==='fat'||A.goal==='shape')) w+='<div class="warn">按你的身高体重，不建议再减重，所以饮食会按「维持」来安排，重点放在力量训练和吃够蛋白质。</div>';
  return '<div class="card sum"><h3>你的专属方案</h3>'+
  '<div class="muted">目标：'+GOAL[A.goal]+' · 每周练 '+A.days+' 次 · 每次约 '+A.mins+' 分钟</div>'+w+
  '<ul class="t"><li>饮食：按份量吃，七分饱就停；每餐有一份蛋白质、一份主食、两份以上蔬菜。</li><li>训练：按「训练计划」做，量力而行，不舒服就停。</li></ul>'+
  '<div class="muted">你选择了不看数字，所以这里不显示热量和克数。想改，可以点「重新开始」。</div></div>';
}
// 份量：蛋白質 1 掌 ≈ 25 g 蛋白質、主食 1 拳 ≈ 28 g 碳水（本頁沿用的估算）；水果、蛋、麵包按個數；飲品按杯（≈250 g）
const DRINKS = ['无糖豆浆（低脂）','全脂牛奶','脱脂牛奶','原味低脂酸奶','希腊酸奶（脱脂、原味）'];
const half05 = x => Math.max(0.5, Math.round(x*2)/2);
function handQty(it){
  const f=FM[it.n], name=it.n.replace(/（.*）/,'');
  if(UW[it.n] && f.u) return name+' '+half05(it.g/f.u)+' '+UW[it.n];
  if(it.n==='橄榄油') return '用油约 1 茶匙';
  if(f.c==='坚果与油脂') return name+' 一小把';
  if(f.c==='水果') return name+' 一份';
  if(DRINKS.indexOf(it.n)>=0) return name+' 约 '+half05(it.g/250)+' 杯';
  if(it.st) return name+' 约 '+half05(f.cb*it.g/100/28)+' 拳';
  if(it.pr) return name+' 约 '+half05(f.p*it.g/100/25)+' 掌';
  return name;
}
function menuCardNoNum(A,C){
  const M = menu(A,C);
  let h = '<div class="card"><h3>7 天饮食示例</h3><div class="muted">按份量吃：1 掌 ≈ 手掌大小和厚度的肉、蛋、豆制品；1 拳 ≈ 一个拳头大小的熟主食；蔬菜每餐两拳以上；吃到七分饱就停。点每一天展开。</div>'+
  M.map(function(d,i){
    return '<details class="dd"'+(i===0?' open':'')+'><summary>'+d.day+'</summary>'+
    d.meals.map(function(m){
      const veg=m.items.filter(function(it){ return FM[it.n].c==='蔬菜' }).map(function(it){ return it.n.replace(/（.*）/,'') });
      const rest=m.items.filter(function(it){ return FM[it.n].c!=='蔬菜' }).map(handQty);
      return '<div class="meal"><b>'+m.name+'</b><br>'+rest.join('、')+(veg.length?'<br>蔬菜（'+veg.join('、')+'）两拳以上':'')+'<br><small>'+m.hint+'</small></div>';
    }).join('')+'</details>';
  }).join('');
  const avgP=M.reduce(function(s,d){ return s+d.total.p },0)/M.length;
  if(avgP<C.p*PROTEIN_NOTE_RATIO) h += '<div class="warn">这份菜单的蛋白质比建议的少一些。吃得下的话，可以多加蛋、豆制品或无糖酸奶，也可以请营养师帮你调整。</div>';
  if(A.eat!=='cook'){
    h += '<div class="day"><h4><span>外食</span>怎么点</h4><ul class="t"><li>选清蒸、水煮、炖、烤，少选油炸、勾芡和浓汤。</li><li>主食点小份，酱汁分开放。</li><li>麻辣烫选清汤，多放蔬菜和肉类，少放芝麻酱。</li><li>便利店：茶叶蛋、无糖豆浆、即食鸡胸肉、玉米、沙拉都是可以的。</li></ul></div>';
  }
  return h+'<div class="muted" style="margin-top:8px">份量是估算，按自己的饱足感调整。</div></div>';
}

function summaryCard(A,C){
  if(A.nonum) return summaryCardNoNum(A,C);
  let w='';
  if(C.flagged) w+='<div class="warn">你勾选了怀孕/哺乳、慢性病或年龄未满 18 岁。这种情况我只给「维持体重」的参考，不做热量缺口。开始训练或调整饮食前，请先问过医生。</div>';
  if(C.low && !C.flagged && (A.goal==='fat'||A.goal==='shape')) w+='<div class="warn">你的 BMI 偏低（'+F(C.bmi)+'），不建议再减重，所以热量按维持来算，重点放在力量训练和吃够蛋白质。</div>';
  const wk = Math.abs(C.weekly)<0.05 ? '体重基本持平' : (C.weekly<0?'每周约 -':'每周约 +')+F(Math.abs(C.weekly))+' kg（估算）';
  // 比例條：依熱量占比（蛋白質、碳水 4 kcal/g，脂肪 9 kcal/g）
  const kp=C.p*4, kc=C.c*4, kf=C.f*9, tot=kp+kc+kf;
  const pp=Math.round(kp/tot*100), cp=Math.round(kc/tot*100), fp=100-pp-cp;
  return '<div class="card sum"><h3>你的专属方案</h3>'+
  '<div class="muted">每日建议摄入</div>'+
  '<div class="big"><b>'+C.kcal+'</b><span>kcal</span></div>'+
  '<div class="muted">目标：'+GOAL[A.goal]+' · 每周练 '+A.days+' 次 · 每次约 '+A.mins+' 分钟</div>'+w+
  '<div class="mbar"><i class="m1" style="width:'+pp+'%"></i><i class="m2" style="width:'+cp+'%"></i><i class="m3" style="width:'+fp+'%"></i></div>'+
  '<div class="mleg"><span><s class="m1"></s>蛋白质 <b>'+C.p+' g</b></span><span><s class="m2"></s>碳水 <b>'+C.c+' g</b></span><span><s class="m3"></s>脂肪 <b>'+C.f+' g</b></span></div>'+
  '<div class="rows">'+
  '<div><span>BMI</span><b>'+F(C.bmi)+'</b></div>'+
  '<div><span>基础代谢（静息）</span><b>'+C.bmr+' kcal</b></div>'+
  '<div><span>每日总消耗（估）</span><b>'+C.tdee+' kcal</b></div>'+
  '<div><span>预期体重变化</span><b>'+wk+'</b></div></div>'+
  '<div class="muted">以上都是公式估算，不是医学诊断。按 2–3 周的实际体重变化再微调。</div></div>';
}

/* ---------- 動作說明（示範圖、影片入口、wger 來源） ---------- */
function mediaBlock(m){
  let h='';
  const L=IMGS[m.id]||[];
  if(L.length){
    h+='<div class="imgs">'+L.map(function(x){ return '<img loading="lazy" src="img/'+x.f+'" alt="'+m.n+' 示范图">' }).join('')+'</div>';
    const au=[]; L.forEach(function(x){ const t=(x.au||'wger 社区')+'（'+x.lic+'）'; if(au.indexOf(t)<0) au.push(t) });
    h+='<div class="muted">示范图作者：'+au.join('、')+'，来自 wger.de。</div>';
  }
  const v=VIDEOS[m.n];
  h+='<div class="vlink"><a href="'+(v||('https://search.bilibili.com/all?keyword='+encodeURIComponent(m.n+' 教学')))+'" target="_blank" rel="noopener">'+(v?'▶ 看示范视频':'▶ 找教学视频（B 站搜索）')+'</a></div>';
  return h;
}
function srcLine(m){
  if(!m.id) return '';
  return '<div class="muted">来源：wger 动作 #'+m.id+(m.au?'，作者 '+m.au:'')+'，'+m.lic+'。中文要点为改写。</div>';
}
// 「怎么做」展開區塊（訓練計劃、重點加練、熱身拉伸共用）
function howBlock(m){
  return '<details class="xd"><summary>怎么做</summary><div class="xb"><div class="muted">锻炼部位：'+m.mus+' · 器材：'+m.eq+'</div>'+m.how+mediaBlock(m)+srcLine(m)+'</div></details>';
}
function exItem(nm,i,j,A,dayEx){
  const m = EXM[nm];
  let h = '<li><div class="exr"><span>'+nm+' <i>'+exLine(nm,A)+'</i></span><span class="exb">'+
    (alts(nm,dayEx,A).length?'<button class="mini swp" data-k="'+i+'-'+j+'">换一个</button>':'')+'</span></div>';
  if(m && m.how) h += howBlock(m);
  return h+'</li>';
}
function focusItem(nm,A){
  const m=EXM[nm]; if(!m) return '';
  let h='<li>'+nm+' <i>'+exLine(nm,A).replace(/^\d(–\d)? 组/,'2 组')+'</i>';
  if(m.how) h+=howBlock(m);
  return h+'</li>';
}
function stItem(nm){
  const m=EXM[nm]; if(!m) return '';
  return '<li>'+nm+howBlock(m)+'</li>';
}

/* ---------- 訓練計劃 ---------- */
function workoutCard(A){
  const W = workout(A); const rest = REPS[A.exp][2];
  let h = '<div class="card"><h3>每周训练安排</h3><div class="muted">每个动作之间休息 '+rest+'；每组留 2–3 次余力，不要练到力竭。点「怎么做」看要点，点「换一个」换成同类动作。</div>';
  h += '<div class="week">'+['周一','周二','周三','周四','周五','周六','周日'].map(function(n){
    const d=W.filter(function(x){ return x.day===n })[0];
    return '<span class="wd'+(d?(d.cardio?' cd':' on'):'')+'" data-d="'+n+'"></span>';
  }).join('')+'</div>';
  W.forEach((d,i)=>{
    h += '<div class="day"><h4><span>'+d.day+'</span>'+d.title+'</h4>';
    if(d.cardio){
      h += '<ul class="t"><li>快走、椭圆机或骑车 30–40 分钟，强度以「能说话、不能唱歌」为准</li><li>结束后做 8–10 分钟拉伸：大腿前后侧、臀部、胸肩</li></ul>';
    } else {
      h += '<ol>'+d.ex.map((e,j)=>exItem(e,i,j,A,d.ex)).join('')+'</ol>';
      if(d.focus && d.focus.length){
        h += '<div class="muted" style="margin-top:6px">重点加练（约 8 分钟，每个动作 2 组）</div><ol>'+d.focus.map(function(e){ return focusItem(e,A) }).join('')+'</ol>';
      }
    }
    h += '</div>';
  });
  const cardio = (A.goal==='fat'||A.goal==='shape') ? '每周另外加 2–3 次快走或其他有氧，每次 30 分钟。' : '每周加 1–2 次轻松有氧，每次 20–30 分钟即可。';
  h += '<div class="day"><h4><span>其他</span>有氧与日常</h4><ul class="t"><li>'+cardio+'</li><li>日常步数争取 7000–9000 步。</li></ul></div>';
  h += '<div class="day"><h4><span>热身</span>每次训练前 5 分钟</h4><ol>'+['肩部绕环','手臂绕环'].map(function(n){ return stItem(n) }).join('')+'</ol></div>';
  h += '<div class="day"><h4><span>拉伸</span>训练后 5–8 分钟</h4><ol>'+['儿童式','站姿小腿拉伸','三头肌拉伸'].map(function(n){ return stItem(n) }).join('')+'</ol></div>';
  h += '<div class="day"><h4><span>进阶</span>怎么加重量</h4><ul class="t"><li>热身 5–8 分钟：关节活动加上第一个动作的空杆或轻重量。</li><li>某个动作连续两次、每组都做到次数上限，下次就加一点重量（哑铃加 1–2 kg，或换更强的弹力带）。</li><li>徒手动作做不到加重时，改成放慢下放速度（3 秒）或增加每组次数。</li></ul></div>';
  const wantF=(A.focus||[]).filter(function(x){ return FOCUS_ROWS[x] });
  const noneF=wantF.filter(function(x){ return !usableNames(FOCUS_ROWS[x],A).length });
  if(noneF.length){
    h += '<div class="warn">你选的重点部位里，「'+noneF.map(function(x){ return FOCUS_LABEL[x] }).join('、')+'」在你的器材和不适部位限制下，目前没有合适的加练动作，所以这次没有为它加。可以换个重点部位，或在「动作库」里挑安全的动作。</div>';
  }
  if(A.injury.length && !A.injury.includes('none')){
    const names=A.injury.filter(x=>INJ_NAME[x]).map(x=>INJ_NAME[x]).join('、');
    h += '<div class="warn">已避开对「'+names+'」压力大的动作，换动作时也会避开。这个分类是按动作类型整理的，不是医学判断。任何动作如果出现刺痛（不是肌肉酸），马上停下来，必要时去看医生。</div>';
  }
  h += '<div class="muted" style="margin-top:8px">动作资料来自开源项目 <b>wger</b>（wger.de），按 CC-BY-SA 授权，作者见各动作说明；中文要点由本页改写。</div>';
  return h+'</div>';
}

/* ---------- 飲食計劃 ---------- */
function menuCard(A,C){
  if(A.nonum) return menuCardNoNum(A,C);
  const M = menu(A,C);
  let h = '<div class="card"><h3>7 天饮食示例</h3><div class="muted">每日目标约 '+C.kcal+' kcal，蛋白质 '+C.p+' g。克数按你的目标反推，是煮熟后的重量（水果、坚果除外），用厨房秤或对照手掌估一下就行，吃到七分饱。点每一天展开。</div>'+
  M.map(function(d,i){
    return '<details class="dd"'+(i===0?' open':'')+'><summary>'+d.day+' <span class="muted">约 '+Math.round(d.total.k)+' kcal</span></summary>'+
    d.meals.map(function(m){
      return '<div class="meal"><b>'+m.name+'</b> <small>约 '+Math.round(m.k)+' kcal · 蛋白质约 '+Math.round(m.p)+' g</small><br>'+
        m.items.map(function(it){ return qty(it.n,it.g) }).join('、')+'<br><small>'+m.hint+'</small></div>';
    }).join('')+
    '<div class="muted">全天：蛋白质 '+Math.round(d.total.p)+' g · 碳水 '+Math.round(d.total.c)+' g · 脂肪 '+Math.round(d.total.f)+' g</div></details>';
  }).join('');
  // 蛋白質平均吃不到目標的 85% 時，如實說明（常見於蛋奶素 + 減脂：植物性蛋白每克蛋白質的熱量高，在低熱量下很難吃夠）
  const avgP=M.reduce(function(s,d){ return s+d.total.p },0)/M.length;
  if(avgP<C.p*PROTEIN_NOTE_RATIO){
    h += '<div class="warn">按你的热量目标，这份菜单每天的蛋白质平均约 '+Math.round(avgP)+' g，比目标 '+C.p+' g 低。蛋白质食物的热量比较高，在这个热量下不容易吃够。想补足，可以在热量允许的范围内多加蛋、豆制品或无糖酸奶，也可以请营养师帮你调整。</div>';
  }
  if(A.eat!=='cook'){
    h += '<div class="day"><h4><span>外食</span>怎么点</h4><ul class="t"><li>选清蒸、水煮、炖、烤，少选油炸、勾芡和浓汤。</li><li>主食点小份，酱汁分开放。</li><li>麻辣烫选清汤，多放蔬菜和肉类，少放芝麻酱。</li><li>便利店：茶叶蛋、无糖豆浆、即食鸡胸肉、玉米、沙拉都是可以的。</li></ul></div>';
  }
  h += '<div class="muted" style="margin-top:8px">营养数据来自美国农业部 FoodData Central，克数为估算。</div>';
  return h+'</div>';
}

/* ---------- 動作庫 ---------- */
const LIB_TITLE = {0:'徒手动作库',1:'家里器材动作库（哑铃、弹力带）',2:'健身房动作库',st:'热身与拉伸',w:'女性常练动作库'};
function inScope(x,scope){
  if(!x.how) return false;                       // 沒有 wger 資料的模板名稱不列
  if(scope==='w') return WOMEN.indexOf(x.n)>=0;
  if(scope==='st') return x.g==='st';
  return x.g!=='st' && x.lv===scope;
}
function exLibCard(scope,A){
  const list = EXI.filter(function(x){ return inScope(x,scope) });
  let h = '<div class="card"><h3>'+LIB_TITLE[scope]+'（'+list.length+' 个）</h3><div class="muted">点动作名展开做法。动作来自 wger，作者和授权见每条说明。'+(scope==='w'?'<br>这一类是按女性常见的训练重点（臀腿、髋、体态、手臂线条、核心、髋部灵活性）整理的，动作本身男女都能练，不是 wger 的分类。':'')+'</div>';
  GORDER.forEach(function(g){
    const L=list.filter(function(x){ return x.g===g });
    if(!L.length) return;
    h += '<div class="day"><h4><span>'+GL[g]+'</span></h4>';
    L.forEach(function(m){
      const w = (m.t && A.injury.indexOf(m.t)>=0) ? '<div class="warn" style="margin:4px 0">你选了「'+INJ_NAME[m.t]+'」不适，这个动作对该部位压力较大，不建议做。</div>' : '';
      h += '<details class="xd"><summary style="font-size:15px;color:var(--ink)">'+m.n+' <span class="muted">'+m.mus+'</span></summary><div class="xb"><div class="muted">器材：'+m.eq+'</div>'+m.how+w+mediaBlock(m)+srcLine(m)+'</div></details>';
    });
    h += '</div>';
  });
  return h+'</div>';
}

/* ---------- 食物庫 ---------- */
const FOOD_TAG = {m:'肉',s:'海鲜',e:'蛋',d:'含乳糖'};
function foodLibCard(A){
  const cats=[]; FOODS.forEach(function(f){ if(cats.indexOf(f.c)<0) cats.push(f.c) });
  let h='<div class="card"><h3>食物库（'+FOODS.length+' 种）</h3><div class="muted">'+(A.nonum?'按类别看能吃什么、怎么吃。':'每 100 克的营养。')+'带「含乳糖」「海鲜」「肉」标记的，和你的忌口有冲突时会提醒。数据来自美国农业部 FoodData Central。</div>';
  cats.forEach(function(c,ci){
    h += '<details class="dd"'+(ci===0?' open':'')+'><summary>'+c+'</summary>';
    FOODS.filter(function(f){ return f.c===c }).forEach(function(f){
      const bad = !allowed(f,A);
      h += '<div class="meal"'+(bad?' style="opacity:.5"':'')+'><b>'+f.n+'</b> '+(f.t?'<small style="color:var(--warn)">'+FOOD_TAG[f.t]+(bad?'（你的忌口，不推荐）':'')+'</small>':'')+
        (A.nonum?'':'<br><small>热量 '+f.k+' kcal · 蛋白质 '+f.p.toFixed(1)+' g · 碳水 '+f.cb.toFixed(1)+' g · 脂肪 '+f.f.toFixed(1)+' g</small>')+
        (f.us&&!A.nonum?'<br><small>份量：'+f.us+'</small>':'')+(f.ck?'<br><small>吃法：'+f.ck+'</small>':'')+'</div>';
    });
    h += '</details>';
  });
  return h+'<div class="muted" style="margin-top:8px">带「熟」的是煮熟、烤熟后的重量，不带的是生吃的重量。</div></div>';
}

/* ---------- 小貼士、複製摘要 ---------- */
function tipsCard(A,C){
  return '<div class="card"><h3>小贴士</h3><ul class="t">'+
  '<li><b>喝水：</b>每天 1.5–2 升，训练日再多一点。</li>'+
  '<li><b>睡眠：</b>尽量 7–8 小时，睡不够会更容易饿、恢复也慢。</li>'+
  '<li><b>称重：</b>每周固定同一天、同一时间（早上空腹）称 1–2 次，看趋势，不盯单日数字。</li>'+
  '<li><b>生理期：</b>体重会因水分波动，不用慌。状态差就降低强度或改成散步拉伸，不必硬撑。</li>'+
  '<li><b>身体信号：</b>头晕、心慌、持续乏力或生理期紊乱，说明吃得太少或练得太多，请调整并咨询医生。</li>'+
  '<li><b>复盘：</b>坚持 2–3 周后，用新的体重和感受再来算一次，计划也会跟着更新。</li></ul></div>';
}
function planText(A,C){
  let t='【我的健身计划】\n目标：'+GOAL[A.goal]+'\n'+(A.nonum?'饮食：按份量吃，七分饱\n':'每日建议摄入 '+C.kcal+' kcal（蛋白质 '+C.p+'g / 碳水 '+C.c+'g / 脂肪 '+C.f+'g）\n')+'\n训练安排：\n';
  workout(A).forEach(d=>{ t+=d.day+' '+d.title+'：'+(d.cardio?'有氧 30–40 分钟 + 拉伸':d.ex.join('、'))+'\n' });
  return t+'\n（公式估算，非医学建议）';
}
