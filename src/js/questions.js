/* 問卷：問什麼、有哪些選項、答完怎麼回應、答案怎麼寫進 A。
   need(A)：這一題是後來新增的；舊存檔缺這一題時，「繼續上次的」只補問這幾題，其他資料保留。純資料與純函式，不碰 DOM（Node 測試可直接驗證所有題目）。
   app.js 負責把這些步驟畫成聊天、處理「改上一題」。
   設計原則（行為引導）：
   - 少問：年齡、身高、體重合成一張卡；每週幾天與每次多久合成「你能留出多少時間」一題（共 10 題，原本 14 題）。
   - 用生活語言問，不問術語：運動基礎問「最近三個月更像哪一種」，不適部位問「爬楼梯、下蹲时膝盖会不舒服吗」。
   - 每題都有「說不清／還沒想好」這類出口，並給一個保守的預設；有依據時才標「建议」（只是建議，不是結論）。
   - 答完用一句話回應，並且只說程式真的會做的事。 */

const BMI_LOW = 18.5, BMI_HIGH = 24;     // 中國常用分界：低於 18.5 偏低，24 以上偏高
function bmiOf(h,w){ return w/Math.pow(h/100,2) }
function autoGoal(bmi){ return bmi>=BMI_HIGH ? 'fat' : bmi<BMI_LOW ? 'muscle' : 'shape' }
// 「我不確定，幫我定」：依運動基礎給容易坚持的安排
const AUTO_TIME = {new:{days:3,mins:30}, some:{days:3,mins:45}, reg:{days:4,mins:45}};

const REACT_GOAL = {
  fat:'好，目标减脂。我会按温和的节奏算，不会让你吃得太少。',
  muscle:'好，目标增肌塑形。我会把蛋白质和训练量排得足一些。',
  shape:'好，想改善体态、紧致线条。力量训练会是重点。',
  keep:'好，保持健康。我们按稳定、能长期坚持来排。'
};
const has2 = (v,x) => v.indexOf(x)>=0;

const AGE_MIN = 18, AGE_MAX = 64;      // 中國身體活動指南與 WHO 的「成年人」分組是 18–64 歲；超出就轉介
const STEPS = [
  // 0 安全篩檢（保守版）：任何一項符合就不給計劃，只轉介。題目是本頁自己寫的，不是 PAR-Q+（PAR-Q+ 不允許修改或節錄）。
  {k:'screen', type:'multi', rows:true,
   q:'开始之前，先确认你适合用本页自己练。下面这些情况，有符合的吗？（可多选）',
   opts:()=>[
     {header:'身体状况'},
     {label:'医生说过我有心脏方面的问题，或高血压',value:'heart'},
     {label:'休息、日常活动或运动时，会胸口痛或胸闷',value:'chest'},
     {label:'最近一年，因为头晕站不稳，或晕倒过',value:'faint'},
     {label:'有其他长期疾病（例如糖尿病、哮喘、肾病），或正在长期吃药',value:'chronic'},
     {label:'骨头、关节或肌肉有问题，医生说过要限制运动，或一运动就明显加重',value:'msk'},
     {label:'医生说过我只能在医护人员看着时运动',value:'supervised'},
     {label:'现在正在感冒、发烧，或身体不舒服',value:'ill'},
     {header:'孕产'},
     {label:'怀孕中',value:'preg'},
     {label:'哺乳期',value:'bf'},
     {label:'产后一年内',value:'post'},
     {header:' '},
     {label:'以上都没有',value:'none'}],
   set:(A,v)=>{ A.scr = has2(v,'none') ? 'ok' : 'stop'; A.screen = v; A.health = ['none'] },
   need:(A)=> A.scr!=='ok',            // 舊存檔沒做過安全篩檢：繼續上次時要補答
   gate:(A,v)=> has2(v,'none') ? null : v.slice() },
  // 1 身体数据：一张卡四行，不一题一题地问
  {k:'body', type:'nums',
   q:'先认识一下你。年龄、身高、体重大概是多少？点 − ＋ 调到你的数字（点数字也算确认），腰围可以不填。',
   fields:[
     {k:'age',label:'年龄',unit:'岁',min:14,max:75,def:30,s1:1,s2:5},
     {k:'height',label:'身高',unit:'cm',min:130,max:200,def:160,s1:1,s2:5},
     {k:'weight',label:'体重',unit:'kg',min:30,max:150,def:55,s1:0.5,s2:5},
     {k:'waist',label:'腰围',unit:'cm',min:50,max:140,def:70,s1:1,s2:5,optional:true}],
   set:(A,v)=>{ A.age=v.age; A.height=v.height; A.weight=v.weight; A.waist=v.waist },
   react:(v)=>{ if(v.age<AGE_MIN || v.age>AGE_MAX) return null; const b=bmiOf(v.height,v.weight); return b<BMI_LOW ? '你的 BMI 是 '+b.toFixed(1)+'，偏低。之后我不会给你安排热量缺口。' : null },
   gate:(A,v)=> v.age<AGE_MIN ? ['young'] : v.age>AGE_MAX ? ['old'] : null},
  // 2 目标
  {k:'goal', type:'pick',
   q:'你最想改变什么？',
   opts:(A)=>{ const b=bmiOf(A.height,A.weight); return [
     {label:'减脂',sub:'把体脂降下来，同时尽量保住肌肉',value:'fat',rec:b>=BMI_HIGH},
     {label:'增肌塑形',sub:'练出线条，让身体更有力量',value:'muscle',rec:b<BMI_LOW},
     {label:'改善体态、紧致',sub:'肩背更挺，整个人更紧致',value:'shape'},
     {label:'保持健康',sub:'不追求变化，把现在的状态稳住',value:'keep'},
     {label:'说不清，帮我判断',sub:'我按你的身高体重给一个建议',value:'auto'}] },
   set:(A,v)=>{ A.goal = v==='auto' ? autoGoal(bmiOf(A.height,A.weight)) : v },
   react:(v,A,opt)=>{
     const b=bmiOf(A.height,A.weight);
     if(opt && opt.value==='auto') return '我先帮你判断：BMI '+b.toFixed(1)+'，建议先按「'+GOAL[A.goal]+'」来排。不合适的话，点「改上一题」重选就行。';
     if(A.goal==='fat' && b<BMI_LOW) return '你的 BMI 偏低，减脂这一项我会按维持来算，重点放在力量训练和吃够蛋白质。';
     return REACT_GOAL[A.goal] }},
  // 3 運動基礎：用生活情境問
  {k:'exp', type:'pick',
   q:'最近三个月，你的运动情况更像哪一种？',
   opts:()=>[
     {id:'none',label:'几乎没怎么运动',sub:'平时以坐着和走路为主',value:'new'},
     {id:'some',label:'偶尔动一动',sub:'每周 1–2 次，没有固定节奏',value:'some'},
     {id:'back',label:'以前练过，中断了一阵子',sub:'想重新开始',value:'some'},
     {id:'reg',label:'一直有固定的训练习惯',sub:'每周 3 次以上',value:'reg'}],
   set:(A,v)=>{ A.exp=v },
   react:(v,A,opt)=> !opt ? null : opt.id==='none' ? '没关系，从零开始最稳，动作和组数我会先排得轻松一点。'
     : opt.id==='back' ? '好，重新开始最重要的是别一下子练太猛，我会按「有一点基础」来排。'
     : opt.id==='reg' ? '好，那训练量我会排得足一些。' : null },
  // 4 時間：每週幾天、每次多久合成一題，用「現實能留出多少」來問
  {k:'time', type:'pick',
   q:'时间上，你现实一点能留出多少？先选能坚持的，不是最理想的。',
   opts:(A)=>[
     {label:'每周 2 次，每次约 30 分钟',sub:'时间比较紧，先把习惯养起来',value:{days:2,mins:30}},
     {label:'每周 3 次，每次约 30 分钟',sub:'循序渐进，容易坚持',value:{days:3,mins:30},rec:A.exp==='new'},
     {label:'每周 3 次，每次约 45 分钟',sub:'节奏比较平衡',value:{days:3,mins:45},rec:A.exp==='some'},
     {label:'每周 4 次，每次约 45 分钟',sub:'比较投入，记得留出休息和睡眠',value:{days:4,mins:45},rec:A.exp==='reg'},
     {label:'每周 5 次，每次约 1 小时',sub:'全力投入，适合已经有基础的',value:{days:5,mins:60}},
     {label:'我不确定，帮我定',sub:'按你的基础，给一个容易坚持的安排',value:{auto:true}}],
   set:(A,v)=>{ const t = v.auto ? AUTO_TIME[A.exp] : v; A.days=t.days; A.mins=t.mins },
   react:(v,A)=> v.auto ? '那就先按你的基础来：每周 '+A.days+' 次，每次约 '+A.mins+' 分钟，先把习惯养起来。' : null },
  // 5 場地
  {k:'place', type:'pick',
   q:'你平时更方便在哪里练？',
   opts:()=>[
     {id:'gym',label:'健身房',sub:'有器械可以用',value:'gym'},
     {id:'home',label:'家里有哑铃/弹力带',sub:'在家练，有一点器材',value:'home'},
     {id:'body',label:'家里徒手',sub:'什么器材都没有，一张垫子就够',value:'body'},
     {id:'undecided',label:'还没想好',sub:'先按徒手排，之后随时可以重新来一份',value:'body'}],
   set:(A,v)=>{ A.place=v },
   react:(v,A,opt)=> opt && opt.id==='undecided' ? '好，先按徒手排。想换成有器材的，点最下面的「重新开始」就行。' : null },
  // 6 重點部位：細分成 14 個部位，分三組；最多選 3 個（每個訓練日加練 2 個動作，部位太多就不集中了）
  {k:'focus', type:'multi', rows:true, max:3,
   q:'有没有特别想重点练的地方？最多选 3 个，这样加练更集中。',
   opts:()=>[
     {header:'上半身'},
     {label:'胸部',sub:'想让胸部更挺、更有线条',value:'chest'},
     {label:'肩部',sub:'想让肩线更圆润、更有力',value:'shoulder'},
     {label:'背部线条',sub:'想让背部更紧致、更有线条',value:'lats'},
     {label:'背部体态',sub:'想让肩背更挺，改善圆肩、驼背',value:'posture'},
     {label:'手臂后侧',sub:'想让手臂后侧（俗称蝴蝶袖）更紧致',value:'triceps'},
     {label:'手臂前侧',sub:'想让手臂更有线条',value:'biceps'},
     {header:'腰腹'},
     {label:'腹部',sub:'想让腹部更平坦、更有力',value:'abs'},
     {label:'腰线（腹斜肌）',sub:'想练出腰线',value:'obliques'},
     {header:'臀腿'},
     {label:'臀部',sub:'想要更翘、更紧实的臀部',value:'glutes'},
     {label:'臀部外侧、髋两侧',sub:'想让臀形更圆润、髋部更稳',value:'abduct'},
     {label:'大腿前侧',value:'quads'},
     {label:'大腿后侧',sub:'靠近臀部、坐下时贴着椅面的那一块',value:'hams'},
     {label:'大腿内侧',sub:'这类动作是我按类型归类的',value:'inner'},
     {label:'小腿',sub:'想让小腿线条更紧致',value:'calves'},
     {header:' '},
     {label:'没有特别想要的',sub:'整体均衡就好',value:'none'}],
   set:(A,v)=>{ A.focus=v },
   react:(v)=> !has2(v,'none') ? '好，每个训练日我会加一小段「重点加练」，重点放在：'+v.map(x=>FOCUS_LABEL[x]).join('、')+'。' : null },
  // 7 不適：用「會不會」的情境問，不問術語
  {k:'injury', type:'multi', rows:true,
   q:'平时身体有没有这些情况？有的话，我会避开容易加重的动作。（可多选）',
   opts:()=>[
     {label:'爬楼梯、下蹲时，膝盖会不舒服',value:'k'},
     {label:'久坐、弯腰后，腰会酸痛',value:'b'},
     {label:'肩颈常常僵硬，抬手臂会痛',value:'s'},
     {label:'都没有',value:'none'}],
   set:(A,v)=>{ A.injury=v },
   react:(v)=> !has2(v,'none') ? '收到，这些部位我会避开压力大的动作。' : null },
  // 9 忌口
  {k:'diet', type:'multi', rows:true,
   q:'吃的方面，有没有不吃或不能吃的？（可多选）',
   opts:()=>[
     {label:'吃蛋奶素',sub:'不吃肉和海鲜，蛋和奶可以',value:'veg'},
     {label:'不吃牛羊肉',value:'nobeef'},
     {label:'不吃猪肉',value:'nopork'},
     {label:'喝牛奶会不舒服（乳糖不耐）',value:'lactose'},
     {label:'不吃海鲜，或海鲜过敏',value:'seafood'},
     {label:'没有忌口',value:'none'}],
   set:(A,v)=>{ A.diet=v },
   react:(v)=> !has2(v,'none') ? '收到，菜单会避开这些。' : null },
  // 10 吃飯方式
  {k:'eat', type:'pick',
   q:'你平时吃饭，更多是怎么解决的？',
   opts:()=>[
     {label:'外食为主',sub:'食堂、外卖、餐厅',value:'out'},
     {label:'自己做饭',sub:'食材自己买，自己做',value:'cook'},
     {label:'两种都有',sub:'有时自己做，有时在外面吃',value:'mix'}],
   set:(A,v)=>{ A.eat=v }},
  // 最後：要不要看熱量與克數（給曾有飲食失調、或對吃東西壓力很大的人一個不看數字的選擇）
  {k:'nonum', type:'pick',
   q:'最后一个：计划里要不要显示具体的热量和克数？',
   opts:()=>[
     {label:'要，越具体越好',sub:'显示每日热量、蛋白质、每餐克数',value:false},
     {label:'不要，只看份量就好',sub:'用手掌、拳头表示份量。如果你曾经有饮食失调，或对吃东西压力很大，建议选这个，也建议找专业人士聊聊',value:true}],
   set:(A,v)=>{ A.nonum=v },
   need:(A)=> typeof A.nonum!=='boolean'}
];
const INTRO_HINT = '本页适合 18–64 岁、身体健康、不在孕产期的成年人自己练。一共 '+STEPS.length+' 个小问题，选错了可以点「改上一题」。所有数据只在你的手机上计算，不会上传。';
