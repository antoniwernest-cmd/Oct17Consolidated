/* Spelling Master: local profiles, speech, Pointer Events dragging, and Excel assessment. */
(function(){
 'use strict';
 const D=window.SPELLING_DATA,O=window.SCHOOL_OBJECTS,C=window.SpellingCore;
 const $=id=>document.getElementById(id),KEY='spelling-master-v1';
 const palette=['#f7f0e2','#f1edf9','#fbedf0','#fbf3d9','#eaf4f1','#edf2fb'];
 let state={version:1,selected:'',profiles:{},speed:'0.82'},active=false,item=null,profile=null,entry=null,model=null,selectedTile=null,drag=null,hoverGap=null,lastTick=0,suppressClickUntil=0;
 let notebookDateTimer=null,fitPending=false,touchStartY=null;
 try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old?.version===1&&old.profiles&&typeof old.profiles==='object'){state=old;state.selected=C.objectName(O,old.selected)?old.selected:'';}}catch(e){notice('Saved progress could not be opened. You can still play and download an Excel assessment.');}
 function notice(message){$('storage-notice').textContent=message;$('storage-notice').hidden=false;requestFit();}
 function requestFit(){
  if(!active||fitPending)return;fitPending=true;
  requestAnimationFrame(()=>{fitPending=false;if(!active)return;
   const page=$('activity'),pad=$('pad'),available=window.innerHeight-($('storage-notice').hidden?0:$('storage-notice').getBoundingClientRect().height);
   pad.style.minHeight='';
   page.dataset.fit='standard';
   if(Math.ceil(page.getBoundingClientRect().height)>available)page.dataset.fit='compact';
   if(Math.ceil(page.getBoundingClientRect().height)>available)page.dataset.fit='tight';
   const spare=available-Math.ceil(page.getBoundingClientRect().height)-2;
   // Keep the spelling bank just below the answer, even on a tall screen.
   if(spare>0&&!spelling()){
    const answer=pad.getBoundingClientRect(),bank=$('tray').getBoundingClientRect();
    const base=Math.abs(answer.top-bank.top)<3?Math.max(answer.height,bank.height):answer.height;
    pad.style.minHeight=Math.floor(base+spare)+'px';
   }
  });
 }
 function refreshNotebookDate(){
  clearTimeout(notebookDateTimer);
  const now=new Date(),date=C.notebookDate(now);
  $('notebook-date').textContent=date.text;$('notebook-date').setAttribute('datetime',date.iso);
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  notebookDateTimer=setTimeout(refreshNotebookDate,Math.max(1000,tomorrow-now+100));
  requestFit();
 }
 function save(){if(active&&entry&&lastTick){const now=performance.now();entry.seconds=(entry.seconds||0)+(now-lastTick)/1000;lastTick=now;}try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){notice('This browser cannot save more progress. Download your Excel assessment before closing.');}}
 function getProfile(id){const p=state.profiles[id]??={level:'A',mode:'spelling',positions:{},orders:{},progress:{},attempts:[]};p.level=C.levels.includes(p.level)?p.level:'A';p.mode=p.mode==='sentences'?'sentences':'spelling';p.positions??={};p.orders??={};p.progress??={};p.attempts=Array.isArray(p.attempts)?p.attempts:[];return p;}
 function list(){return D[profile.mode][profile.level];}
 function group(){return profile.mode+'|'+profile.level;}
 function order(){const k=group(),n=list().length;let a=profile.orders[k];if(!Array.isArray(a)||a.length!==n||new Set(a).size!==n||a.some(x=>!Number.isInteger(x)||x<0||x>=n))profile.orders[k]=a=Array.from({length:n},(_,i)=>i);return a;}
 function position(){return Math.max(0,Math.min(list().length-1,Number(profile.positions[group()])||0));}
 function spelling(){return profile.mode==='spelling';}
 function makeModel(){return{pad:[],tray:C.mixedIds(item.bank)};}
 function setFeedback(text,type=''){const e=$('feedback');e.textContent=text;e.className='feedback '+type;requestFit();}
 function stop(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
 function speak(count=true){
  stop();if(!active)return;
  if(!('speechSynthesis'in window)){ $('voice-note').textContent='Voice is unavailable in this browser. A teacher can read the sentence; the hint button shows it.';return;}
  if(count){entry.listens=(entry.listens||0)+1;save();}
  const message=spelling()?item.sentence+' Spell the word '+item.word+'.':item.sentence+' Put the words in order.';
  const u=new SpeechSynthesisUtterance(message);u.lang='en-US';u.rate=Number(state.speed)||.82;
  const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>/^en[-_]CA/i.test(v.lang))||voices.find(v=>/^en[-_](US|GB)/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
  $('voice-note').textContent='Listening…';u.onend=()=>{if(active)$('voice-note').textContent='Tap Listen to hear it again.';};u.onerror=()=>{if(active)$('voice-note').textContent='Tap Listen to start the voice. Check your device volume.';};
  window.speechSynthesis.speak(u);
 }
 function landing(){save();stop();cancelDrag();active=false;lastTick=0;entry=null;$('landing').hidden=false;$('activity').hidden=true;renderObjects();window.scrollTo(0,0);}
 function renderObjects(){
  const grid=$('object-grid');grid.replaceChildren();
  O.forEach((o,i)=>{const b=document.createElement('button');b.className='object-tile'+(o.id===state.selected?' current':'');b.style.setProperty('--tile-bg',palette[i%palette.length]);b.setAttribute('aria-label','Choose '+o.name);const img=document.createElement('img');img.src=o.image;img.alt='';const label=document.createElement('span');label.textContent=o.name;b.append(img,label);b.onclick=()=>chooseObject(o.id);grid.append(b);});
 }
 function chooseObject(id){save();state.selected=id;profile=getProfile(id);active=true;$('landing').hidden=true;$('activity').hidden=false;const o=O.find(o=>o.id===id);$('object-badge').replaceChildren();const img=document.createElement('img');img.src=o.image;img.alt='';const span=document.createElement('span');span.textContent=o.name;$('object-badge').append(img,span);load(true);window.scrollTo(0,0);}
 function load(read=true){
  save();stop();cancelDrag();selectedTile=null;
  refreshNotebookDate();$('notebook').dataset.mode=profile.mode;
  item=C.withBank(list()[order()[position()]],profile.mode,profile.level);
  entry=profile.progress[item.id]??={started:new Date().toISOString(),checks:0,hints:0,listens:0,seconds:0,complete:false,teacher:'',lastResponse:'',events:0};
  model=C.restoreModel(item,entry.model)||makeModel();entry.model=model;lastTick=performance.now();
  for(const l of C.levels)document.querySelector('[data-level="'+l+'"]').setAttribute('aria-pressed',String(l===profile.level));
  for(const m of ['spelling','sentences'])$('mode-'+m).setAttribute('aria-selected',String(m===profile.mode));
  $('task-eyebrow').textContent='LEVEL '+profile.level;
  $('task-title').textContent=spelling()?'Spell the missing word':'Put the sentence together';
  $('piece-count').textContent=spelling()?item.pieces.length+' pieces + '+item.distractors.length+' extra '+(item.distractors.length===1?'letter':'letters'):item.pieces.length+' word pieces';
  $('piece-instructions').textContent=(spelling()?'Use '+item.pieces.length+' pieces. Leave '+item.distractors.length+' extra '+(item.distractors.length===1?'letter':'letters')+' in the tray. ':'')+'Drag pieces, or tap a piece then +. Insert before, between or after pieces. Move pieces back to the tray to remove them.';
  $('theme').textContent=item.theme||'Picture words';$('item-count').textContent=(position()+1)+' / '+list().length;
  $('activity-picture').src=item.image;$('activity-picture').alt=item.alt;$('activity-picture').classList.remove('failed');
  // The caption must not expose the spelling answer or sentence before the child responds.
  $('picture-caption').textContent='Look at the picture. Listen for the '+(spelling()?'missing word.':'sentence.');
  $('tray-label').textContent=spelling()?'MIXED-UP SPELLING PIECES':'MIXED-UP WORDS';
  $('hint-display').hidden=true;$('hint').textContent='Show me a hint';$('voice-note').textContent='';
  setFeedback(entry.complete?'You have completed this activity. You can practise it again.':'');
  $('previous').disabled=position()===0;$('next').disabled=position()===list().length-1;
  renderTiles();renderRating();renderProgress();save();if(read)speak();
 }
 function chunkClass(s){if(!spelling())return'';if(/^(str|spr|scr|spl|thr|bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sc|sk|sl|sm|sn|sp|st|sw|tr|tw|nd|nt|st|mp|ft|ld|lk|lp)$/.test(s))return'chunk-blend';if(/(igh|ear|air|eer|ee|oo|ai|ay|oa|ow|oe|ea|ue|ui|ie|ei|ey|ew|ou|au|aw|oi|oy|ar|er|ir|or|ur)/.test(s))return'chunk-vowel';if(/(ing|tion|sion|ness|ment|ful|less|ly|le)$/.test(s)&&s.length>1)return'chunk-ending';if(/(tch|dge|sh|ch|th|ck|ph|ng|gh|qu|wh|bb|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt|zz)/.test(s))return'chunk-team';return'';}
 function tile(id){const b=document.createElement('button');b.className='tile '+chunkClass(item.bank[id])+(selectedTile===id?' selected':'');b.dataset.tile=id;b.textContent=item.bank[id];b.setAttribute('aria-label',item.bank[id]+'. '+(model.pad.includes(id)?'On landing pad.':'In tray.')+' Select to move.');b.setAttribute('aria-pressed',String(selectedTile===id));b.addEventListener('pointerdown',pointerDown);b.onclick=()=>{if(performance.now()<suppressClickUntil)return;selectedTile=selectedTile===id?null:id;renderTiles();setFeedback(selectedTile===null?'':'Piece selected. Tap a + to put it in place, or return it to the tray.');};return b;}
 function gap(i){const b=document.createElement('button');b.className='gap';b.dataset.gap=i;b.textContent='+';b.setAttribute('aria-label',i===0?'Insert at the beginning':i===model.pad.length?'Insert at the end':'Insert before piece '+(i+1));b.onclick=()=>{if(selectedTile===null){setFeedback('Tap a piece first, then tap this +.');return;}place(selectedTile,'pad',i);};return b;}
 function renderContext(){
  const context=$('context');context.replaceChildren();
  if(!spelling()){
   const answer=C.response(item,model,'sentences'),preview=document.createElement('span');
   preview.className='sentence-preview'+(answer?'':' empty');preview.dataset.liveSentence='';
   preview.textContent=answer||'Listen, then build your sentence here.';context.append(preview);return;
  }
  const answer=C.response(item,model,'spelling'),pattern=new RegExp('\\b'+item.word+'\\b','ig');let end=0;
  for(const match of item.sentence.matchAll(pattern)){
   context.append(document.createTextNode(item.sentence.slice(end,match.index)));
   const blank=document.createElement('span');blank.className='sentence-blank';blank.dataset.liveWord='';
   // Show the actual placed pieces, including mistakes, without revealing unplaced letters.
   blank.textContent=answer?(match[0][0]===match[0][0].toUpperCase()?answer[0].toUpperCase()+answer.slice(1):answer):'\u00a0';
   context.append(blank);end=match.index+match[0].length;
  }
  context.append(document.createTextNode(item.sentence.slice(end)));
 }
 function renderTiles(){
  renderContext();
  const pad=$('pad'),tray=$('tray');pad.replaceChildren();tray.replaceChildren();pad.classList.toggle('empty',model.pad.length===0);tray.classList.toggle('empty',model.tray.length===0);pad.classList.toggle('has-selected',selectedTile!==null);
  pad.append(gap(0));model.pad.forEach((id,i)=>pad.append(tile(id),gap(i+1)));model.tray.forEach(id=>tray.append(tile(id)));
  $('placed-count').textContent=model.pad.length+' / '+item.pieces.length+' placed';$('return-selected').disabled=selectedTile===null;
  $('check').disabled=model.pad.length!==item.pieces.length||Boolean(entry.checkedCurrent&&C.correct(item,model,profile.mode));
  requestFit();
 }
 function place(id,area,index){model=C.move(model,id,area,index);entry.model=model;entry.events=(entry.events||0)+1;entry.checkedCurrent=false;selectedTile=null;setFeedback(spelling()&&model.pad.length>item.pieces.length?'Use only '+item.pieces.length+' pieces. Move the extra letters back to the tray.':'');renderTiles();save();}
 function findDrop(x,y){
  const e=document.elementFromPoint(x,y);if(!e)return null;const area=e.closest('[data-area]');if(!area)return null;
  if(area.dataset.area==='tray')return{area:'tray',gap:model.tray.length};
  const g=e.closest('[data-gap]');if(g)return{area:'pad',gap:Number(g.dataset.gap),node:g};
  const t=e.closest('[data-tile]');if(t){const r=t.getBoundingClientRect(),i=model.pad.indexOf(Number(t.dataset.tile));const at=i+(x>r.left+r.width/2?1:0);return{area:'pad',gap:at,node:area.querySelector('[data-gap="'+at+'"]')};}
  // Empty space, including wrapped rows: choose the nearest visible insertion point.
  const gs=[...area.querySelectorAll('[data-gap]')];let closest=null,distance=Infinity;
  for(const g of gs){const r=g.getBoundingClientRect(),d=Math.hypot(x-r.left-r.width/2,(y-r.top-r.height/2)*1.7);if(d<distance){distance=d;closest=g;}}
  return{area:'pad',gap:closest?Number(closest.dataset.gap):model.pad.length,node:closest};
 }
 function pointerDown(e){if(e.button!==undefined&&e.button!==0)return;if(drag)return;drag={id:Number(e.currentTarget.dataset.tile),pointer:e.pointerId,x:e.clientX,y:e.clientY,target:e.currentTarget,moving:false,drop:null};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.addEventListener('pointermove',pointerMove);e.currentTarget.addEventListener('pointerup',pointerUp);e.currentTarget.addEventListener('pointercancel',cancelDrag);}
 function pointerMove(e){if(!drag||e.pointerId!==drag.pointer)return;if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;e.preventDefault();if(!drag.moving){drag.moving=true;drag.target.classList.add('dragging');const ghost=$('drag-ghost');ghost.textContent=item.bank[drag.id];ghost.dataset.mode=profile.mode;ghost.dataset.origin=model.pad.includes(drag.id)?'pad':'tray';ghost.hidden=false;}
  $('drag-ghost').style.left=e.clientX+'px';$('drag-ghost').style.top=e.clientY+'px';drag.drop=findDrop(e.clientX,e.clientY);if(hoverGap)hoverGap.classList.remove('active');hoverGap=drag.drop?.node;if(hoverGap)hoverGap.classList.add('active');$('pad').classList.toggle('drop-over',drag.drop?.area==='pad');$('tray').classList.toggle('drop-over',drag.drop?.area==='tray');
  if(e.clientY>window.innerHeight-35)window.scrollBy(0,12);else if(e.clientY<45)window.scrollBy(0,-12);
 }
 function pointerUp(e){if(!drag||e.pointerId!==drag.pointer)return;const d=drag,drop=d.moving?findDrop(e.clientX,e.clientY):null;cancelDrag();if(d.moving){suppressClickUntil=performance.now()+400;if(drop)place(d.id,drop.area,drop.gap);else setFeedback('Drop on the landing pad or the pieces tray. Your piece is still here.');}}
 function cancelDrag(){if(drag){const t=drag.target;t.classList.remove('dragging');t.removeEventListener('pointermove',pointerMove);t.removeEventListener('pointerup',pointerUp);t.removeEventListener('pointercancel',cancelDrag);try{if(t.hasPointerCapture(drag.pointer))t.releasePointerCapture(drag.pointer);}catch(e){}drag=null;}if(hoverGap)hoverGap.classList.remove('active');hoverGap=null;$('drag-ghost').hidden=true;$('pad').classList.remove('drop-over');$('tray').classList.remove('drop-over');}
 function check(){
  if(model.pad.length!==item.pieces.length)return;const ok=C.correct(item,model,profile.mode),answer=C.response(item,model,profile.mode);
  entry.checks=(entry.checks||0)+1;entry.lastResponse=answer;entry.checkedCurrent=true;entry.lastChecked=new Date().toISOString();entry.complete=entry.complete||ok;if(ok&&!entry.completedAt)entry.completedAt=entry.lastChecked;
  save();profile.attempts.push({timestamp:entry.lastChecked,object:C.objectName(O,state.selected),level:profile.level,mode:profile.mode,item:item.id,target:spelling()?item.word:item.sentence,sentence:item.sentence,pieces:item.pieces.join(' | '),bank:item.bank.join(' | '),distractors:item.distractors.join(' | '),response:answer,correct:ok,check:entry.checks,hints:entry.hints,listens:entry.listens,seconds:Math.round(entry.seconds),teacher:entry.teacher||''});save();
  setFeedback(ok?(spelling()?'You spelled it! ':'You built the sentence! ')+(entry.hints?'You used a hint. Keep practising.':'Great listening and building.'):'Good try. Move the pieces, listen again, and check.',''+(ok?'success':'error'));renderTiles();renderProgress();
 }
 function renderRating(){document.querySelectorAll('[data-rating]').forEach(b=>b.setAttribute('aria-pressed',String(entry.teacher===b.dataset.rating)));}
 function renderProgress(){const bank=list(),done=bank.filter(r=>profile.progress[r.id]?.complete).length;$('progress').textContent=C.objectName(O,state.selected)+' · '+done+' / '+bank.length+' completed in '+profile.level+' · '+(spelling()?'Spelling':'Sentences')+' · Saved here';}
 function changeLevel(level){if(profile.level===level)return;save();profile.level=level;load();}
 function changeMode(mode){if(profile.mode===mode)return;save();profile.mode=mode;load();}
 function nav(delta){save();profile.positions[group()]=Math.max(0,Math.min(list().length-1,position()+delta));load();}
 function exportAssessment(all){
  save();const ids=all?O.map(o=>o.id):[state.selected];if(!ids[0])return;
  const summary=[['School supply','Level','Activity','Activities available','Started','Completed','First-check success without hint','Total checks','Hints used','Teacher: Independent','Teacher: With help','Teacher: Practising']];
  const progress=[['School supply','Level','Activity','Activity key','Target word or sentence','Picture sentence','Spelling pieces / sentence words','Status','Checks','Hints','Listens','Student response','Teacher support rating','First started (UTC)','Completed (UTC)','Last checked (UTC)','Active seconds','Picture theme','Source project','Word bank offered','Distractor letters']];
  const attempts=[['School supply','Time (UTC)','Level','Activity','Activity key','Target word or sentence','Picture sentence','Pieces','Student response','Correct','Check number','Hints so far','Listens so far','Active seconds','Teacher rating at check','Word bank offered','Distractor letters']];
  for(const id of ids){const p=state.profiles[id]||{progress:{},attempts:[]},name=C.objectName(O,id);for(const level of C.levels)for(const mode of ['spelling','sentences']){
    const bank=D[mode][level],es=bank.map(r=>p.progress?.[r.id]).filter(Boolean),completed=es.filter(e=>e.complete).length;
    const first=bank.filter(r=>(p.attempts||[]).some(a=>a.item===r.id&&a.correct&&a.check===1&&!a.hints)).length;
    summary.push([name,level,mode==='spelling'?'Spelling':'Sentence building',bank.length,es.length,completed,first,es.reduce((n,e)=>n+(e.checks||0),0),es.reduce((n,e)=>n+(e.hints||0),0),...['Independent','With help','Practising'].map(v=>es.filter(e=>e.teacher===v).length)]);
    for(const r of bank){const e=p.progress?.[r.id]||{};if(all&&!e.started)continue;const offered=C.withBank(r,mode,level);progress.push([name,level,mode==='spelling'?'Spelling':'Sentence building',r.id,mode==='spelling'?r.word:r.sentence,r.sentence,r.pieces.join(' | '),e.complete?'Completed':e.started?'Practising':'Not started',e.checks||0,e.hints||0,e.listens||0,e.lastResponse||'',e.teacher||'',e.started||'',e.completedAt||'',e.lastChecked||'',Math.round(e.seconds||0),r.theme||'',r.source,offered.bank.join(' | '),offered.distractors.join(' | ')]);}
   }
   for(const a of p.attempts||[])attempts.push([name,a.timestamp,a.level,a.mode==='spelling'?'Spelling':'Sentence building',a.item,a.target,a.sentence,a.pieces,a.response,a.correct?'Yes':'No',a.check,a.hints,a.listens,a.seconds,a.teacher,a.bank||a.pieces,a.distractors||'']);
  }
  const guide=[['Spelling Master assessment','Details'],['Exported (UTC)',new Date().toISOString()],['Profile',all?'All 20 school supplies':C.objectName(O,state.selected)],['Progress rows',all?'Activities started by any object. Summary includes all 20 objects.':'All activities for the selected object, including not started.'],['Identity','School-supply picture; no student name or ID is collected. Assign each child a distinct object on a shared browser.'],['Levels A, B, C','Exactly 3 spelling pieces.'],['Levels AA, BB, CCC','Exactly 4 spelling pieces.'],['Sentence levels','A: 3–4 words; B: 5–6; C: 7–8; AA: 9–10; BB: 11–14; CCC: 15–22.'],['Checks','A check is recorded only when all pieces have been placed and Check my answer is pressed.'],['Completed','At least one correct check. Earlier incorrect checks remain in Attempts.'],['Hints','Count of times the answer was revealed. Listening is recorded separately.'],['Teacher rating','Independent / With help / Practising is a teacher choice, separate from the automatic result.'],['Storage','Progress is saved only in this browser on this device. Download Excel to keep or share a copy.'],['Letter chunks','A tile may contain a letter, a sound spelling, a blend, an ending, or a larger word part. It does not always represent one sound.'],['Picture sources','Existing Mystic-Series, Magic Cat B and Magic Cat C cards, cropped at their native resolution.']];
  guide.push(['Spelling distractors','A, B, C: 3 answer chunks plus 1 extra letter. AA, BB, CCC: 4 answer chunks plus 3 extra letters. Leave unused letters in the tray.'],['Word bank columns','Progress shows the current available bank. Attempts records the bank offered for that check. Checks saved before distractors were introduced have a blank distractor field.']);
  const blob=SpellingExcel.workbook([{name:'Summary',rows:summary},{name:'Progress',rows:progress},{name:'Attempts',rows:attempts},{name:'Guide',rows:guide}]);
  const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='Spelling-Master-'+(all?'all-objects':state.selected)+'-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 C.levels.forEach((l,i)=>{const b=document.createElement('button');b.textContent=l;b.dataset.level=l;b.setAttribute('aria-label','Level '+l);b.onclick=()=>changeLevel(l);$(i<3?'levels-one':'levels-two').append(b);});
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>changeMode(b.dataset.mode));
 document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{entry.teacher=entry.teacher===b.dataset.rating?'':b.dataset.rating;save();renderRating();});
 $('home').onclick=landing;$('object-badge').onclick=landing;$('listen').onclick=()=>speak();$('stop').onclick=()=>{stop();$('voice-note').textContent='Voice stopped. Tap Listen to hear it again.';};
 $('speed').value=state.speed||'0.82';$('speed').onchange=()=>{state.speed=$('speed').value;save();};
 $('check').onclick=check;$('previous').onclick=()=>nav(-1);$('next').onclick=()=>nav(1);
 $('mix').onclick=()=>{
  stop();cancelDrag();touchStartY=null;suppressClickUntil=0;selectedTile=null;
  model=makeModel();entry.model=model;entry.checkedCurrent=false;
  $('hint-display').hidden=true;$('hint-display').textContent='';$('hint').textContent='Show me a hint';
  $('voice-note').textContent='Tap Listen to hear it again.';
  renderTiles();setFeedback('Question reset. Listen and try again.');save();
 };
 $('hint').onclick=()=>{if(!$('hint-display').hidden){$('hint-display').hidden=true;$('hint').textContent='Show me a hint';requestFit();return;}entry.hints=(entry.hints||0)+1;$('hint-display').textContent=spelling()?'Spell '+item.word+': '+item.pieces.join(' · '):item.sentence;$('hint-display').hidden=false;$('hint').textContent='Hide the hint';save();requestFit();};
 $('return-selected').onclick=()=>{if(selectedTile!==null)place(selectedTile,'tray',model.tray.length);};
 $('tray').onclick=e=>{if(e.target===$('tray')&&selectedTile!==null)place(selectedTile,'tray',model.tray.length);};
 $('shuffle-activities').onclick=()=>{save();profile.orders[group()]=C.shuffle(order());profile.positions[group()]=0;load();};
 $('export-current').onclick=()=>exportAssessment(false);$('export-all').onclick=()=>exportAssessment(true);
 $('reset').onclick=()=>{if(window.confirm('Reset all saved spelling and sentence progress for '+C.objectName(O,state.selected)+'? Other school supplies keep their progress.')){stop();active=false;entry=null;lastTick=0;delete state.profiles[state.selected];profile=getProfile(state.selected);active=true;load();}};
 $('activity-picture').onerror=()=>{$('activity-picture').classList.add('failed');notice('A picture could not load. Keep the complete Spelling-Master folder together when moving or uploading the project.');};
 window.addEventListener('pagehide',()=>{save();stop();cancelDrag();clearTimeout(notebookDateTimer);});
 window.addEventListener('pageshow',refreshNotebookDate);window.addEventListener('focus',refreshNotebookDate);
 window.addEventListener('resize',requestFit);
 document.addEventListener('touchstart',e=>{touchStartY=active&&e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
 document.addEventListener('touchmove',e=>{
  if(!active||touchStartY===null||e.touches.length!==1)return;
  const inTrayOrPad=Boolean(e.target.closest('[data-area]')),inMenu=Boolean(e.target.closest('[data-scrollable]'));
  const pullingDown=window.scrollY<=0&&e.touches[0].clientY>touchStartY;
  if(e.cancelable&&(drag||inTrayOrPad||(!inMenu&&pullingDown)))e.preventDefault();
 },{passive:false});
 document.addEventListener('touchend',()=>{touchStartY=null;},{passive:true});
 document.addEventListener('touchcancel',()=>{touchStartY=null;},{passive:true});
 if('ResizeObserver'in window){const observer=new window.ResizeObserver(requestFit);observer.observe($('activity'));}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){save();stop();lastTick=0;}else{refreshNotebookDate();if(active)lastTick=performance.now();}});
 refreshNotebookDate();
 renderObjects();
 // A saved object is highlighted, but the landing page always remains the entry point.
})();
