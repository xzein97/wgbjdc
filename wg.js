(function () {
  var RUN = false;
  var loss = 0;
  var LOSS_BJ = 0;
  var LOSS_DICE = 0;
  var totals = { profit: 0, wager: 0 };
  var hist = [];
  var simBal = 0;
  var startTs = 0;
  var elapsedMs = 0;
  var TIMER_INT = null;
  var LAST_ID = '';
  var GAME = localStorage.getItem('bj.game') || 'dice';
  function nv(s) {
    var v = parseFloat(String(s || '0').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var ss = s % 60;
    var hh = String(h).padStart(2, '0');
    var mm = String(m).padStart(2, '0');
    var ss2 = String(ss).padStart(2, '0');
    return (h > 0 ? hh + ':' : '') + mm + ':' + ss2;
  }
  function gid() {
    return 'BJ_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
  }
  function rv(r) {
    if (r === 'A') return 11;
    if (r === 'K' || r === 'Q' || r === 'J') return 10;
    return Number(r) || 0;
  }
  function host() {
    var h = localStorage.getItem('bj.host') || ('https://' + window.location.host);
    return h.replace(/\/$/, '');
  }
  async function req(q, v, t) {
    var h = { 'Content-Type': 'application/json' };
    if (t) h['x-access-token'] = t;
    var u = host() + '/_api/graphql';
    var r = await fetch(u, {
      method: 'POST',
      headers: new Headers(h),
      body: JSON.stringify({ query: q, variables: v })
    });
    return r.json();
  }
  function betAmount(){var gm=GAME;var baseKey=(gm==='blackjack'?'bj.baseBj':'bj.baseDice');var base=nv(localStorage.getItem(baseKey)||localStorage.getItem('bj.base')||'1');var maxf=nv(localStorage.getItem('bj.maxf')||'8');var mult=nv(localStorage.getItem('bj.mult')||'1.5');var mode=(localStorage.getItem(gm==='blackjack'?'bj.modeBj':'bj.modeDice')||(gm==='blackjack'?'recover':'auto'));var l=(gm==='blackjack'?LOSS_BJ:LOSS_DICE);var a=base;if(gm==='blackjack'){if(mode==='recover'||mode==='auto'){a=base*Math.pow(mult,l);var capB=base*maxf;if(a>capB)a=capB}}else{if(mode==='recover'){a=base*Math.pow(mult,l);var cap=base*maxf;if(a>cap)a=cap}else if(mode==='auto'){var prof=totals.profit||0;var belowStart=prof<0;if(belowStart){a=base*Math.pow(mult,l);var cap2=base*maxf;if(a>cap2)a=cap2}}}return a}
  function dc(k){var p=k.state.player[0];var d=k.state.dealer[0].cards[0].rank;var dv=rv(d);var total=p.value;var acts=p.actions||[];if(acts.includes('noInsurance')&&k.state.dealer[0].cards[0].rank==='A'&&p.actions.length===1)return 'noInsurance';var cards=p.cards||k.state.player[0].cards;var soft=false;var sum=0;for(var i=0;i<cards.length;i++){var rr=cards[i].rank;if(rr==='A'){soft=true;sum+=11}else sum+=rv(rr)}if(soft&&sum>21)soft=false;var a='hit';if(soft){if(total<=17)a='hit';else a='stand'}else{if(total<=11)a='hit';else if(total===12){a=(dv>=4&&dv<=6)?'stand':'hit'}else if(total>=13&&total<=16){a=(dv>=2&&dv<=6)?'stand':'hit'}else a='stand'}if(a==='hit'&&cards.length===2&&acts.includes('double')&&total>=9&&total<=11)a='double';if(cards.length===2){var r0=rv(cards[0].rank),r1=rv(cards[1].rank);if(r0===r1&&acts.includes('split')){if(cards[0].rank==='A'||cards[0].rank==='8'){a='split'}}}return a}
  async function playDiceOnce(cur,token,sim){var amt=betAmount();var sendAmt=sim?0:amt;var id=gid();var r=await req(GQL_DICE,{amount:sendAmt,target:99,condition:'below',currency:cur,identifier:id},token);var k=r&&r.data&&r.data.diceRoll;if(!k)return null;var cf=calc(k,sim?amt:undefined);totals.wager+=cf.stake;totals.profit+=cf.pnl;if(sim)simBal+=cf.pnl;hist.push({amount:cf.stake,pm:nv(k.payoutMultiplier||0),profit:cf.pnl});if(hist.length>200){hist=hist.slice(hist.length-200)}renderHistory();var md=(localStorage.getItem('bj.modeDice')||'auto');if(cf.pnl<0){LOSS_DICE+=1}else{if(md==='auto'){if(totals.profit>=0)LOSS_DICE=0}else LOSS_DICE=0}return k}
  function playDiceFire(cur,token,sim){try{var amt=betAmount();var sendAmt=sim?0:amt;var id=gid();req(GQL_DICE,{amount:sendAmt,target:99,condition:'below',currency:cur,identifier:id},token).then(function(r){var k=r&&r.data&&r.data.diceRoll;if(!k)return;var cf=calc(k,sim?amt:undefined);totals.wager+=cf.stake;totals.profit+=cf.pnl;if(sim)simBal+=cf.pnl;hist.push({amount:cf.stake,pm:nv(k.payoutMultiplier||0),profit:cf.pnl});if(hist.length>200){hist=hist.slice(hist.length-200)}renderHistory();var md=(localStorage.getItem('bj.modeDice')||'auto');if(cf.pnl<0){LOSS_DICE+=1}else{if(md==='auto'){if(totals.profit>=0)LOSS_DICE=0}else LOSS_DICE=0}}).catch(function(_){})}catch(_){}}
  function calc(node, base) {
    var am = nv(node.amountMultiplier || 1);
    var pm = nv(node.payoutMultiplier || 0);
    var stake = nv(base || node.amount || 0) * am;
    var pnl = stake * pm - stake;
    var payout = stake * pm;
    return { stake: stake, pnl: pnl, payout: payout };
  }
  async function playHand(cur,id,token,sim){GAME='blackjack';var amt=betAmount();var sendAmt=sim?0:amt;var baseId=id||gid();var useIdent=sim?(baseId+'_AMT_'+String(amt)):baseId;var b=await req(GQL_BET,{amount:sendAmt,currency:cur,identifier:useIdent},token);var k=b&&b.data&&b.data.blackjackBet;if(!k){var ex=(b&&b.errors)&&b.errors.find(function(x){var et=String(x.errorType||x.code||'');var msg=String(x.message||'');return et==='existingGame'||msg.indexOf('already have an active Blackjack')!==-1});if(ex){var actId=id||localStorage.getItem('bj.lastId')||'';var n0=await req(GQL_NEXT,{action:'stand',identifier:actId},token);k=n0&&n0.data&&n0.data.blackjackNext}}if(!k)return null;while(k.active){var act=dc(k);var n=await req(GQL_NEXT,{action:act,identifier:k.id||id},token);if(n&&n.errors){var ident=k.id||id;var hasInvalid=n.errors.some(function(x){return String(x.errorType||x.code||'').indexOf('blackjackInvalidAction')!==-1});if(hasInvalid){var n1=await req(GQL_NEXT,{action:'noInsurance',identifier:ident},token);if(n1&&n1.data&&n1.data.blackjackNext){n=n1}else{var n2=await req(GQL_NEXT,{action:'stand',identifier:ident},token);n=n2}}}k=n&&n.data&&n.data.blackjackNext;if(!k)break}if(k){var cf=calc(k,sim?amt:undefined);totals.wager+=cf.stake;totals.profit+=cf.pnl;if(sim)simBal+=cf.pnl;var pm=nv(k.payoutMultiplier||0);hist.push({amount:cf.stake,pm:pm,profit:cf.pnl});if(hist.length>200){hist=hist.slice(hist.length-200)}renderHistory();var md=(localStorage.getItem('bj.modeBj')||'recover');if(cf.pnl<0||pm===0){LOSS_BJ+=1}else{if(md==='auto'){if(totals.profit>=0)LOSS_BJ=0}else LOSS_BJ=0}if(k.id){localStorage.setItem('bj.lastId',k.id);LAST_ID=k.id}}return k}
  async function run(){if(RUN)return;RUN=true;var cur=(localStorage.getItem('bj.cur')||'trx');var token=localStorage.getItem('bj.token')||'';var delay=nv(localStorage.getItem('bj.delay')||'600');var sim=(localStorage.getItem('bj.sim')||'')==='true';totals.profit=0;totals.wager=0;loss=0;hist=[];renderHistory();simBal=nv(localStorage.getItem('bj.simBal')||simBal||'0');startTs=Date.now();elapsedMs=0;if(TIMER_INT){clearInterval(TIMER_INT);TIMER_INT=null}TIMER_INT=setInterval(function(){elapsedMs=Date.now()-startTs;updateUI()},500);while(RUN){try{if(GAME==='dice'){var dd=nv(localStorage.getItem('bj.diceDelay')||'100');while(RUN&&GAME==='dice'&&totals.profit>=0){playDiceFire(cur,token,sim);updateUI();if(totals.profit<0){GAME='blackjack';localStorage.setItem('bj.game','blackjack');LOSS_BJ=Math.max(LOSS_BJ,1);break}if(dd>0){var waited2=0;while(waited2<dd&&RUN){var chunk2=Math.min(50,dd-waited2);await new Promise(function(r){setTimeout(r,chunk2)});waited2+=chunk2}}}if(totals.profit<0){GAME='blackjack';localStorage.setItem('bj.game','blackjack');LOSS_BJ=Math.max(LOSS_BJ,1)}}else{var id=LAST_ID||localStorage.getItem('bj.lastId')||'';var useId=id||gid();var kb=await playHand(cur,useId,token,sim);if(kb&&kb.id){LAST_ID=kb.id;localStorage.setItem('bj.lastId',kb.id)}if(kb&&!kb.active){if(totals.profit>0){GAME='dice';localStorage.setItem('bj.game','dice')}LAST_ID='';localStorage.removeItem('bj.lastId')}}}catch(_){ }updateUI();if(!RUN)break;var waited=0;while(waited<delay&&RUN){var chunk=Math.min(100,delay-waited);await new Promise(function(r){setTimeout(r,chunk)});waited+=chunk}}if(TIMER_INT){clearInterval(TIMER_INT);TIMER_INT=null}updateUI()}
  function stop() {
    RUN = false;
  }
  function updateUI() {
    try {
      var e = document.getElementById('bj-panel');
      if (!e) return;
      var p = document.getElementById('bj-tot');
      var profitTxt = (totals.profit || 0).toFixed(8);
      var wagerTxt = (totals.wager || 0).toFixed(8);
      p.textContent = 'Profit: ' + profitTxt + ' | Wager: ' + wagerTxt;
      var s = document.getElementById('bj-state');
      s.textContent = RUN ? 'Running' : 'Stopped';
      var tm = document.getElementById('bj-timer');
      if (tm) {
        tm.textContent = 'Time: ' + fmt(elapsedMs);
      }
      var sb = document.getElementById('bj-sim-info');
      if (sb) {
        var sim = (localStorage.getItem('bj.sim') || '') === 'true';
        sb.textContent = sim ? 'Sim Balance: ' + ((simBal || 0).toFixed(8)) : '';
      }
    } catch (_) {}
  }
  function toggle() {
    var p = document.getElementById('bj-panel');
    if (!p) return;
    var v = p.style.display;
    p.style.display = v === 'none' ? 'block' : 'none';
  }
  function ensure(){var ex=document.getElementById('bj-panel');if(ex){var hasSim=document.getElementById('bj-sim');if(!hasSim){try{var simRow=document.createElement('div');simRow.style.display='grid';simRow.style.gridTemplateColumns='auto 1fr';simRow.style.alignItems='center';simRow.style.gap='8px';var sim=document.createElement('input');sim.type='checkbox';sim.id='bj-sim';sim.style.cursor='pointer';sim.checked=(localStorage.getItem('bj.sim')||'')==='true';var simLbl=document.createElement('label');simLbl.textContent='Simulator mode';simLbl.setAttribute('for','bj-sim');simLbl.style.cursor='pointer';simLbl.style.userSelect='none';simRow.appendChild(sim);simRow.appendChild(simLbl);var simBalInput=document.createElement('input');simBalInput.id='bj-sim-bal';simBalInput.type='number';simBalInput.step='0.00000001';simBalInput.placeholder='Simulator start balance';simBalInput.style.width='100%';simBalInput.style.margin='4px 0';simBalInput.value=localStorage.getItem('bj.simBal')||'';simBalInput.style.display=sim.checked?'block':'none';var infoNode=document.getElementById('bj-state');ex.insertBefore(simRow,infoNode);ex.insertBefore(simBalInput,infoNode.nextSibling);sim.addEventListener('change',function(){simBalInput.style.display=sim.checked?'block':'none';localStorage.setItem('bj.sim',sim.checked?'true':'false')});simLbl.addEventListener('click',function(){sim.checked=!sim.checked;sim.dispatchEvent(new Event('change'))})}catch(_){}}var hasTimer=document.getElementById('bj-timer');if(!hasTimer){try{var timer=document.createElement('div');timer.id='bj-timer';timer.style.margin='4px 0';timer.textContent='Time: 00:00:00';var totNode=document.getElementById('bj-tot');if(totNode){ex.insertBefore(timer,totNode)}}catch(_){}}var hasTable=document.getElementById('bj-table');if(!hasTable){try{var wrap=document.createElement('div');wrap.id='bj-hist-wrap';wrap.style.maxHeight='240px';wrap.style.overflowY='auto';var table=document.createElement('table');table.id='bj-table';table.style.width='100%';table.style.marginTop='6px';table.style.borderCollapse='collapse';table.style.tableLayout='fixed';var colgroup=document.createElement('colgroup');var ca=document.createElement('col');ca.className='bj-col-a';ca.style.width='40%';var cp=document.createElement('col');cp.className='bj-col-pm';cp.style.width='30%';var cf=document.createElement('col');cf.className='bj-col-pr';cf.style.width='30%';colgroup.appendChild(ca);colgroup.appendChild(cp);colgroup.appendChild(cf);table.appendChild(colgroup);var thead=document.createElement('thead');var hr=document.createElement('tr');['amount','payout multiplier','profit'].forEach(function(x){var th=document.createElement('th');th.textContent=x;th.style.textAlign='left';th.style.padding='8px';th.style.borderBottom='1px solid #444';hr.appendChild(th)});thead.appendChild(hr);var tbody=document.createElement('tbody');tbody.id='bj-hist';table.appendChild(thead);table.appendChild(tbody);wrap.appendChild(table);ex.appendChild(wrap)}catch(_){}}return}
    var d=document.createElement('div');d.id='bj-panel';d.style.position='fixed';d.style.zIndex='999999';d.style.background='linear-gradient(180deg,#081321,#0b1f2d)';d.style.color='#d8f7ff';d.style.padding='12px';d.style.borderRadius='12px';d.style.border='1px solid rgba(0,212,255,0.25)';d.style.boxShadow='0 0 24px rgba(0,212,255,0.15)';d.style.fontFamily='system-ui,sans-serif';d.style.width='340px';d.style.pointerEvents='auto';var px=nv(localStorage.getItem('bj.posX')||'');var py=nv(localStorage.getItem('bj.posY')||'');if(px&&py){d.style.left=px+'px';d.style.top=py+'px'}else{d.style.left=(window.innerWidth-360)+'px';d.style.top='12px'}d.style.right='';var style=document.getElementById('bj-style');if(!style){style=document.createElement('style');style.id='bj-style';style.textContent='#bj-panel input,#bj-panel select,#bj-panel button{background:#0b1f2d;color:#cfefff;border:1px solid rgba(0,212,255,0.25);border-radius:8px;box-shadow:0 0 12px rgba(0,212,255,0.08);outline:none}#bj-panel input::placeholder{color:#7ac9dc}#bj-panel button{background:linear-gradient(90deg,#0b2b3d,#0e3d55);color:#aefaff}#bj-panel button:hover{filter:brightness(1.1);box-shadow:0 0 16px rgba(0,212,255,0.15)}#bj-drag{background:linear-gradient(90deg,#0b2b3d,#0e3d55);color:#aefaff;border:1px solid rgba(0,212,255,0.3);border-radius:8px;padding:8px;margin-bottom:10px;text-shadow:0 0 6px rgba(0,212,255,0.4)}#bj-table thead th{color:#aefaff}#bj-hist tr{border-bottom:1px solid rgba(0,212,255,0.15)}#bj-hist tr:hover{background:rgba(0,212,255,0.08)}#bj-hist::-webkit-scrollbar{width:8px}#bj-hist::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.3);border-radius:8px}#bj-hist::-webkit-scrollbar-track{background:#091826}';document.head.appendChild(style)}var drag=document.createElement('div');drag.id='bj-drag';drag.textContent='Stake Blackjack Bot';drag.style.cursor='move';drag.style.fontWeight='600';drag.style.userSelect='none';d.appendChild(drag);var h=document.createElement('input');h.id='bj-host';h.placeholder='https://stake.com';h.style.width='100%';h.style.margin='6px 0';h.value=localStorage.getItem('bj.host')||('https://'+window.location.host);var b=document.createElement('input');b.id='bj-base';b.type='number';b.step='0.00000001';b.placeholder='Base amount';b.style.width='100%';b.style.margin='6px 0';b.value=localStorage.getItem('bj.base')||'0';var c=document.createElement('select');c.id='bj-cur';c.style.width='100%';c.style.margin='6px 0';['trx','btc','eth','doge','usdt'].forEach(function(x){var o=document.createElement('option');o.value=x;o.textContent=x;c.appendChild(o)});c.value=localStorage.getItem('bj.cur')||'trx';var t=document.createElement('input');t.id='bj-token';t.placeholder='x-access-token (optional)';t.style.width='100%';t.style.margin='6px 0';t.value=localStorage.getItem('bj.token')||'';var mf=document.createElement('input');mf.id='bj-maxf';mf.type='number';mf.step='0.1';mf.placeholder='Max recover factor';mf.style.width='100%';mf.style.margin='6px 0';mf.value=localStorage.getItem('bj.maxf')||'8';var ml=document.createElement('input');ml.id='bj-mult';ml.type='number';ml.step='0.1';ml.placeholder='Loss multiplier';ml.style.width='100%';ml.style.margin='6px 0';ml.value=localStorage.getItem('bj.mult')||'1.5';var de=document.createElement('input');de.id='bj-delay';de.type='number';de.placeholder='Delay ms';de.style.width='100%';de.style.margin='6px 0';de.value=localStorage.getItem('bj.delay')||'600';var simRow=document.createElement('div');simRow.style.display='grid';simRow.style.gridTemplateColumns='auto 1fr';simRow.style.alignItems='center';simRow.style.gap='8px';var sim=document.createElement('input');sim.type='checkbox';sim.id='bj-sim';sim.style.cursor='pointer';sim.checked=(localStorage.getItem('bj.sim')||'')==='true';var simLbl=document.createElement('label');simLbl.textContent='Simulator mode';simLbl.setAttribute('for','bj-sim');simLbl.style.cursor='pointer';simLbl.style.userSelect='none';simRow.appendChild(sim);simRow.appendChild(simLbl);var simBalInput=document.createElement('input');simBalInput.id='bj-sim-bal';simBalInput.type='number';simBalInput.step='0.00000001';simBalInput.placeholder='Simulator start balance';simBalInput.style.width='100%';simBalInput.style.margin='6px 0';simBalInput.value=localStorage.getItem('bj.simBal')||'';simBalInput.style.display=sim.checked?'block':'none';var row=document.createElement('div');row.style.display='grid';row.style.gridTemplateColumns='1fr 1fr';row.style.gap='8px';var st=document.createElement('button');st.textContent='Start';st.style.padding='8px';var sp=document.createElement('button');sp.textContent='Stop';sp.style.padding='8px';row.appendChild(st);row.appendChild(sp);var info=document.createElement('div');info.id='bj-state';info.style.margin='6px 0';info.textContent='Stopped';var simInfo=document.createElement('div');simInfo.id='bj-sim-info';simInfo.style.margin='4px 0';var tot=document.createElement('div');tot.id='bj-tot';tot.style.margin='6px 0';tot.textContent='Profit: 0 | Wager: 0';var wrap=document.createElement('div');wrap.id='bj-hist-wrap';wrap.style.maxHeight='240px';wrap.style.overflowY='auto';var table=document.createElement('table');table.id='bj-table';table.style.width='100%';table.style.marginTop='6px';table.style.borderCollapse='collapse';table.style.tableLayout='fixed';var colgroup=document.createElement('colgroup');var ca=document.createElement('col');ca.className='bj-col-a';ca.style.width='40%';var cp=document.createElement('col');cp.className='bj-col-pm';cp.style.width='30%';var cf=document.createElement('col');cf.className='bj-col-pr';cf.style.width='30%';colgroup.appendChild(ca);colgroup.appendChild(cp);colgroup.appendChild(cf);table.appendChild(colgroup);var thead=document.createElement('thead');var hr=document.createElement('tr');['amount','payout multiplier','profit'].forEach(function(x){var th=document.createElement('th');th.textContent=x;th.style.textAlign='left';th.style.padding='8px';th.style.borderBottom='1px solid rgba(0,212,255,0.25)';hr.appendChild(th)});thead.appendChild(hr);var tbody=document.createElement('tbody');tbody.id='bj-hist';table.appendChild(thead);table.appendChild(tbody);d.appendChild(drag);d.appendChild(h);d.appendChild(b);d.appendChild(c);d.appendChild(t);d.appendChild(mf);d.appendChild(ml);d.appendChild(de);d.appendChild(simRow);d.appendChild(simBalInput);d.appendChild(row);d.appendChild(info);d.appendChild(simInfo);d.appendChild(tot);wrap.appendChild(table);d.appendChild(wrap);document.body.appendChild(d);var md=false,ox=0,oy=0;drag.addEventListener('mousedown',function(ev){md=true;ox=ev.clientX-d.offsetLeft;oy=ev.clientY-d.offsetTop;ev.preventDefault()});document.addEventListener('mousemove',function(ev){if(!md)return;var nx=ev.clientX-ox;var ny=ev.clientY-oy;d.style.left=nx+'px';d.style.top=ny+'px';localStorage.setItem('bj.posX',String(nx));localStorage.setItem('bj.posY',String(ny))});document.addEventListener('mouseup',function(){md=false});sim.addEventListener('change',function(){simBalInput.style.display=sim.checked?'block':'none';localStorage.setItem('bj.sim',sim.checked?'true':'false')});simLbl.addEventListener('click',function(){sim.checked=!sim.checked;sim.dispatchEvent(new Event('change'))});st.addEventListener('click',function(){localStorage.setItem('bj.host',h.value);localStorage.setItem('bj.base',b.value);localStorage.setItem('bj.cur',c.value);localStorage.setItem('bj.token',t.value);localStorage.setItem('bj.maxf',mf.value);localStorage.setItem('bj.mult',ml.value);localStorage.setItem('bj.delay',de.value);localStorage.setItem('bj.sim',sim.checked?'true':'false');localStorage.setItem('bj.simBal',simBalInput.value||'0');simBal=nv(simBalInput.value||'0');run()});sp.addEventListener('click',function(){stop();updateUI()})}
  function renderHistory(){try{var tb=document.getElementById('bj-hist');if(!tb)return;tb.innerHTML='';var list=hist.slice(-200);for(var i=list.length-1;i>=0;i--){var h=list[i];var tr=document.createElement('tr');var td1=document.createElement('td');var td2=document.createElement('td');var td3=document.createElement('td');td1.textContent=(Number(h.amount)||0).toFixed(8);td2.textContent=(Number(h.pm)||0).toFixed(8);td3.textContent=(Number(h.profit)||0).toFixed(8);td1.style.padding='4px';td2.style.padding='4px';td3.style.padding='4px';tr.appendChild(td1);tr.appendChild(td2);tr.appendChild(td3);tb.appendChild(tr)}}catch(_){}}
  var GQL_BET='mutation BlackjackBet($amount: Float!, $currency: CurrencyEnum!, $identifier: String!) { blackjackBet(amount: $amount, currency: $currency, identifier: $identifier) { id active payoutMultiplier amountMultiplier amount payout updatedAt currency game user { id name } state { ... on CasinoGameBlackjack { player { value actions cards { rank suit } } dealer { value actions cards { rank suit } } } } } }';
  var GQL_NEXT='mutation BlackjackNext($action: BlackjackNextActionInput!, $identifier: String!) { blackjackNext(action: $action, identifier: $identifier) { id active payoutMultiplier amountMultiplier amount payout updatedAt currency game user { id name } state { ... on CasinoGameBlackjack { player { value actions cards { rank suit } } dealer { value actions cards { rank suit } } } } } }';
  var GQL_DICE='mutation DiceRoll($amount: Float!, $target: Float!, $condition: CasinoGameDiceConditionEnum!, $currency: CurrencyEnum!, $identifier: String!) { diceRoll(amount: $amount, target: $target, condition: $condition, currency: $currency, identifier: $identifier) { id active payoutMultiplier amountMultiplier amount payout updatedAt currency game user { id name } state { ... on CasinoGameDice { result target } } } }';
  document.addEventListener('keydown', function (ev) {
    try {
      if ((ev.ctrlKey || ev.metaKey) && String(ev.key || '').toLowerCase() === 'y') {
        ev.preventDefault();
        toggle();
      }
    } catch (_) {}
  });
  var mo = new MutationObserver(function () { ensure(); });
  mo.observe(document, { childList: true, subtree: true });
  setTimeout(ensure, 500);
  var SIM_INT=null;
  function setupSimHandlers() {
    try {
      var sim = document.getElementById('bj-sim');
      if (!sim) return;
      var bound = sim.getAttribute('data-bj-bound');
      if (bound === '1') return;
      var lbl = sim.nextElementSibling;
      sim.style.cursor = 'pointer';
      if (lbl) {
        lbl.setAttribute('for', 'bj-sim');
        lbl.style.cursor = 'pointer';
        lbl.addEventListener('click', function () {
          sim.checked = !sim.checked;
          var bal = document.getElementById('bj-sim-bal');
          if (bal) bal.style.display = sim.checked ? 'block' : 'none';
          localStorage.setItem('bj.sim', sim.checked ? 'true' : 'false');
        });
      }
      sim.addEventListener('change', function () {
        var bal = document.getElementById('bj-sim-bal');
        if (bal) bal.style.display = sim.checked ? 'block' : 'none';
        localStorage.setItem('bj.sim', sim.checked ? 'true' : 'false');
      });
      sim.setAttribute('data-bj-bound', '1');
      if (SIM_INT) {
        clearInterval(SIM_INT);
        SIM_INT = null;
      }
    } catch (_) {}
  }
  SIM_INT=setInterval(setupSimHandlers,300);
  var LABELS_INT = null;
  function ensureInputLabels() {
    try {
      var ex = document.getElementById('bj-panel');
      if (!ex) return;
      function addLabel(id, text) {
        var el = document.getElementById(id);
        if (!el) return;
        var prev = el.previousElementSibling;
        var ok = prev && prev.getAttribute && prev.getAttribute('data-bj-label') === '1';
        if (ok) return;
        var lab = document.createElement('label');
        lab.textContent = text;
        lab.setAttribute('for', id);
        lab.setAttribute('data-bj-label', '1');
        lab.style.display = 'block';
        lab.style.margin = '6px 0 2px 0';
        ex.insertBefore(lab, el);
      }
      addLabel('bj-host', 'Host');
      addLabel('bj-base', 'Base amount');
      addLabel('bj-base-bj', 'Base amount (Blackjack)');
      addLabel('bj-base-dice', 'Base amount (Dice)');
      addLabel('bj-cur', 'Currency');
      addLabel('bj-token', 'Access token');
      addLabel('bj-maxf', 'Max recover factor');
      addLabel('bj-mult', 'Loss multiplier');
      addLabel('bj-delay', 'Delay (ms)');
      addLabel('bj-sim-bal', 'Simulator start balance');
      var done = true;
      ['bj-host', 'bj-base', 'bj-cur', 'bj-token', 'bj-maxf', 'bj-mult', 'bj-delay'].forEach(function (id) {
        var el = document.getElementById(id);
        var prev = el && el.previousElementSibling;
        var ok = prev && prev.getAttribute && prev.getAttribute('data-bj-label') === '1';
        if (!ok) done = false;
      });
      if (done) {
        if (LABELS_INT) {
          clearInterval(LABELS_INT);
          LABELS_INT = null;
        }
      }
    } catch (_) {}
  }
  LABELS_INT = setInterval(ensureInputLabels, 400);
  var BASES_INT=null;
  function ensureBaseInputs(){try{var panel=document.getElementById('bj-panel');if(!panel)return;var baseEl=document.getElementById('bj-base');var bbj=document.getElementById('bj-base-bj');if(!bbj){var i=document.createElement('input');i.id='bj-base-bj';i.type='number';i.step='0.00000001';i.placeholder='Base amount (Blackjack)';i.style.width='100%';i.style.margin='4px 0';i.value=localStorage.getItem('bj.baseBj')||'';if(baseEl&&baseEl.nextSibling){panel.insertBefore(i,baseEl.nextSibling)}else{panel.appendChild(i)}i.addEventListener('change',function(){localStorage.setItem('bj.baseBj',String(i.value||''))})}var bd=document.getElementById('bj-base-dice');if(!bd){var j=document.createElement('input');j.id='bj-base-dice';j.type='number';j.step='0.00000001';j.placeholder='Base amount (Dice)';j.style.width='100%';j.style.margin='4px 0';j.value=localStorage.getItem('bj.baseDice')||'';var ref=document.getElementById('bj-base-bj')||baseEl;if(ref&&ref.nextSibling){panel.insertBefore(j,ref.nextSibling)}else{panel.appendChild(j)}j.addEventListener('change',function(){localStorage.setItem('bj.baseDice',String(j.value||''))})}}catch(_){}}
  ensureBaseInputs();
  if(!BASES_INT){BASES_INT=setInterval(ensureBaseInputs,600)}
  var LAYOUT_INT=null;
  function applyLayoutStyles(){try{var style=document.getElementById('bj-style');if(!style)return;var extra='\n#bj-panel.layout-wide{width:920px;}\n#bj-hist-wrap{max-height:500px;}\n.bj-row{display:grid;grid-template-columns:160px 1fr;align-items:center;gap:8px;margin:6px 0}\n.bj-row label{margin:0}\n.bj-row input,.bj-row select{width:100%}';if(style.textContent.indexOf('#bj-panel.layout-wide')===-1){style.textContent+=extra}}catch(_){}}
  function ensureWideLayout(){try{var panel=document.getElementById('bj-panel');if(!panel)return;applyLayoutStyles();panel.classList.add('layout-wide');panel.style.display='grid';panel.style.gridTemplateColumns='480px 420px';panel.style.gap='12px';panel.style.width='920px';var drag=document.getElementById('bj-drag');if(drag){drag.style.gridColumn='1 / span 2'}var wrap=document.getElementById('bj-hist-wrap');if(wrap){wrap.style.gridColumn='2';wrap.style.gridRow='2';wrap.style.width='100%';wrap.style.alignSelf='start'}var ids=['bj-host','bj-base','bj-base-bj','bj-base-dice','bj-cur','bj-token','bj-maxf','bj-mult','bj-delay','bj-sim-bal'];ids.forEach(function(id){try{var el=document.getElementById(id);if(!el)return;var lab=el.previousElementSibling;var isLab=lab&&lab.getAttribute&&lab.getAttribute('data-bj-label')==='1';if(!isLab)return;var row=lab.parentElement&&lab.parentElement.classList&&lab.parentElement.classList.contains('bj-row')?lab.parentElement:null;if(!row){row=document.createElement('div');row.className='bj-row';panel.insertBefore(row,lab);row.appendChild(lab);row.appendChild(el)}row.style.gridColumn='1'}catch(_){}})}catch(_){}}
  LAYOUT_INT=setInterval(ensureWideLayout,450);
})();
