(function(){
 'use strict';
 const D=window.SHORT_VOWEL_DATA,O=window.SCHOOL_OBJECTS,C=window.ShortVowelCore,$=id=>document.getElementById(id),KEY='short-vowels-v1';
 const palette=['#e3edfc','#ffe4d8','#e1f1eb','#fff0d6','#e9e7fa','#e4f1f9'];
 const vowelWords=new Set(Object.values(D).flatMap(rows=>rows.flatMap(row=>[row.word,...row.blanks.map(b=>b.word)])));
 let state={version:1,selected:'',profiles:{},speed:'0.82'},active=false,profile=null,item=null,entry=null,answers=[],activeBlank=0,choiceOrder=[];
 let drag=null,hoverBlank=null,suppressClickUntil=0,lastTick=0,dateTimer=null,fitPending=false,touchStartY=null;
 let rideProfile='',rideCount=-1,rideToken=0,rideTimers=[];
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.version===1&&saved.profiles&&typeof saved.profiles==='object'){state=saved;if(!C.objectName(O,state.selected))state.selected='';}}catch(e){notice('Saved work could not be opened. You can still play and download Excel.');}
 function notice(text){$('storage-notice').textContent=text;$('storage-notice').hidden=false;requestFit();}
 function requestFit(){
  if(!active||fitPending)return;fitPending=true;
  requestAnimationFrame(()=>{fitPending=false;if(!active)return;const page=$('activity'),available=window.innerHeight-($('storage-notice').hidden?0:$('storage-notice').getBoundingClientRect().height);
   page.dataset.fit='standard';if(Math.ceil(page.getBoundingClientRect().height)>available)page.dataset.fit='compact';if(Math.ceil(page.getBoundingClientRect().height)>available)page.dataset.fit='tight';
  });
 }
 function refreshDate(){clearTimeout(dateTimer);const now=new Date(),date=window.notebookDate(now);$('notebook-date').textContent=date.text;$('notebook-date').setAttribute('datetime',date.iso);dateTimer=setTimeout(refreshDate,Math.max(1000,new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now+100));requestFit();}
 function save(){
  if(active&&entry&&lastTick){const now=performance.now();entry.seconds=(entry.seconds||0)+(now-lastTick)/1000;lastTick=now;}
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){notice('This browser cannot save progress. Download Excel before closing.');}
 }
 function getProfile(id){const p=state.profiles[id]??={level:'A',positions:{},orders:{},progress:{},attempts:[]};if(!C.levels.includes(p.level))p.level='A';p.positions??={};p.orders??={};p.progress??={};if(!Array.isArray(p.attempts))p.attempts=[];return p;}
 function list(){return D[profile.level];}
 function position(){return Math.max(0,Math.min(list().length-1,Number(profile.positions[profile.level])||0));}
 function order(){
  const key=profile.level,rows=list(),n=rows.length;let a=profile.orders[key];
  const valid=Array.isArray(a)&&a.length===n&&new Set(a).size===n&&!a.some(x=>!Number.isInteger(x)||x<0||x>=n);
  profile.orderVersions??={};if(valid&&profile.orderVersions[key]===2)return a;
  const keepCurrent=valid||Number.isInteger(profile.positions[key]),at=position();
  if(keepCurrent){
   const previous=valid?a:Array.from({length:n},(_,i)=>i),prefix=previous.slice(0,at+1),seen=new Set(prefix),remaining=rows.map((_,i)=>i).filter(i=>!seen.has(i));
   a=prefix.concat(C.balancedOrder(remaining.map(i=>rows[i]),null,rows[prefix.at(-1)]?.pattern).map(i=>remaining[i]));
  }else a=C.balancedOrder(rows);
  profile.orders[key]=a;profile.orderVersions[key]=2;profile.positions[key]=keepCurrent?at:0;
  return a;
 }
 function feedback(text,type=''){$('feedback').textContent=text;$('feedback').className='feedback '+type;requestFit();}
 function stop(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
 function speak(){
  stop();if(!active)return;if(!('speechSynthesis'in window)){$('voice-note').textContent='Voice is unavailable here. A teacher can read the sentence using the hint.';return;}
  entry.listens=(entry.listens||0)+1;save();const u=new SpeechSynthesisUtterance(item.sentence);u.lang='en-US';u.rate=Number(state.speed)||.82;
  const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>/^en[-_]CA/i.test(v.lang))||voices.find(v=>/^en[-_](US|GB)/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
  $('voice-note').textContent='Listening…';u.onend=()=>{if(active)$('voice-note').textContent='Tap Listen to hear it again.';};u.onerror=()=>{if(active)$('voice-note').textContent='Tap Listen to start the voice. Check the volume.';};window.speechSynthesis.speak(u);
 }
 function renderObjects(){const grid=$('object-grid');grid.replaceChildren();O.forEach((o,i)=>{const b=document.createElement('button');b.className='object-tile'+(state.selected===o.id?' current':'');b.style.setProperty('--tile-bg',palette[i%palette.length]);b.setAttribute('aria-label','Choose '+o.name);const img=document.createElement('img');img.src=o.image;img.alt='';const label=document.createElement('span');label.textContent=o.name;b.append(img,label);b.onclick=()=>chooseObject(o.id);grid.append(b);});}
 function chooseObject(id){save();state.selected=id;profile=getProfile(id);active=true;$('landing').hidden=true;$('activity').hidden=false;const object=O.find(o=>o.id===id),img=document.createElement('img'),label=document.createElement('span');img.src=object.image;img.alt='';label.textContent=object.name;$('object-badge').replaceChildren(img,label);load();window.scrollTo(0,0);}
 function landing(){save();stop();cancelDrag();stopRocketFlight();rideProfile='';rideCount=-1;active=false;entry=null;lastTick=0;$('activity').hidden=true;$('landing').hidden=false;renderObjects();window.scrollTo(0,0);}
 function load(read=true){
  save();stop();cancelDrag();refreshDate();item=list()[order()[position()]];
  entry=profile.progress[item.id]??={started:new Date().toISOString(),choiceAttempts:0,checks:0,hints:0,listens:0,seconds:0,complete:false,teacher:'',blankStats:[],contentRevision:item.contentRevision||1};
  if((item.contentRevision||1)>1&&entry.contentRevision!==item.contentRevision){entry.answers=[];entry.blankStats=[];entry.checkedCurrent=false;entry.lastResponse='';delete entry.choiceOrder;entry.contentRevision=item.contentRevision;}
  entry.blankStats??=[];answers=C.restore(item,entry.answers);entry.answers=answers;activeBlank=C.nextBlank(item,answers);if(activeBlank<0)activeBlank=0;
  choiceOrder=Array.isArray(entry.choiceOrder)&&entry.choiceOrder.length===item.options.length&&new Set(entry.choiceOrder).size===item.options.length&&entry.choiceOrder.every(v=>item.options.includes(v))?entry.choiceOrder:C.shuffle(item.options);entry.choiceOrder=choiceOrder;lastTick=performance.now();
  for(const level of C.levels)document.querySelector('[data-level="'+level+'"]').setAttribute('aria-pressed',String(profile.level===level));
  $('task-eyebrow').textContent='LEVEL '+profile.level;$('piece-count').textContent=item.blanks.length+' '+(item.blanks.length===1?'blank':'blanks')+' · '+item.options.length+' choices';$('item-count').textContent=(position()+1)+' / '+list().length;
  $('activity-picture').src=item.image;$('activity-picture').alt=item.alt;$('activity-picture').style.maxWidth=item.nativeWidth+'px';$('activity-picture').classList.remove('failed');
  $('picture-frame').style.setProperty('--native-width',item.nativeWidth+'px');$('picture-frame').style.setProperty('--mobile-width',Math.min(74,item.nativeWidth,78*item.nativeWidth/item.nativeHeight)+'px');$('picture-covers').replaceChildren();
  for(const cover of item.covers||[]){const mask=document.createElement('span');mask.className='picture-cover';mask.style.left=cover.left+'%';mask.style.top=cover.top+'%';mask.style.width=cover.width+'%';mask.style.height=cover.height+'%';mask.style.background=cover.fill;$('picture-covers').append(mask);}
  $('previous').disabled=position()===0;['next','next-date','next-choices'].forEach(id=>$(id).disabled=position()===list().length-1);$('hint-display').hidden=true;$('hint').textContent='Show me a hint';$('voice-note').textContent='';
  feedback(entry.complete?'You have completed this activity. You can practise it again.':'');render();renderRating();renderProgress();renderRocketFlight();save();if(read)speak();
 }
 function selectBlank(i){if(!Number.isInteger(i)||!item.blanks[i])return;activeBlank=i;entry.activeBlank=i;render();save();}
 function allowsVowel(text){const word=text.toLowerCase().replace(/[^a-z]/g,'');return vowelWords.has(word)||C.vowelPatterns.includes(word);}
 function appendHighlighted(parent,text,includeVowel=allowsVowel(text)){
  for(const part of C.highlights(text,includeVowel)){if(!part.feature){parent.append(document.createTextNode(part.text));continue;}const mark=document.createElement('mark');mark.className='vowel-highlight '+part.feature;mark.textContent=part.text;parent.append(mark);}
 }
 function render(){
  const context=$('context');context.replaceChildren();
  const makeBlank=i=>{const b=item.blanks[i],blank=document.createElement('button');blank.type='button';blank.dataset.blank=i;
   blank.className='cloze-blank '+b.kind+(i===activeBlank?' current':'')+(answers[i]?(C.isRight(item,answers,i)?' correct':' incorrect'):'');if(answers[i])appendHighlighted(blank,C.display(item,i,answers[i]));else blank.textContent='\u00a0';
   blank.style.setProperty('--blank-width',(b.kind==='word'?Math.max(4.5,Math.min(10,b.answer.length+.6)):Math.max(2.4,Math.min(4,b.answer.length+.2)))+'ch');
   blank.setAttribute('aria-label','Blank '+(i+1)+', '+(b.kind==='word'?'missing whole word':'missing short vowel')+(answers[i]?', your answer '+answers[i]:', empty'));
   blank.setAttribute('aria-pressed',String(i===activeBlank));blank.onclick=()=>selectBlank(i);return blank;
  };
  let wordIndex=0;
  for(const token of item.sentence.matchAll(/\S+/g)){
   if(wordIndex++)context.append(document.createTextNode(' '));
   const word=document.createElement('span');word.className='cloze-line-word';let at=token.index;const end=at+token[0].length,includeVowel=allowsVowel(token[0]);
   item.blanks.forEach((b,i)=>{if(b.start>=token.index&&b.end<=end){appendHighlighted(word,item.sentence.slice(at,b.start),false);word.append(makeBlank(i));at=b.end;}});
   appendHighlighted(word,item.sentence.slice(at,end),item.blanks.some(b=>b.start>=token.index&&b.end<=end)?false:includeVowel);context.append(word);
  }
  const joined=$('joined-words');joined.replaceChildren();item.blanks.forEach((b,i)=>{if(!answers[i])return;const word=document.createElement('span');word.className='joined-word'+(C.isRight(item,answers,i)?' correct':' trying');word.dataset.joinedBlank=i;word.setAttribute('role','listitem');appendHighlighted(word,C.joinedWord(item,i,answers[i]),allowsVowel(b.word)||allowsVowel(answers[i]));joined.append(word);});
  if(!joined.children.length){const prompt=document.createElement('span');prompt.className='joined-word-prompt';prompt.textContent='Choose a vowel or whole word to see the whole word here.';joined.append(prompt);}
  $('choices').replaceChildren();choiceOrder.forEach(value=>{const b=document.createElement('button');b.type='button';b.className='tile cloze-choice';b.dataset.choice=value;appendHighlighted(b,value);b.setAttribute('aria-label',value+'. Place in selected blank '+(activeBlank+1));b.addEventListener('pointerdown',pointerDown);b.onclick=()=>{if(performance.now()>=suppressClickUntil)place(value,activeBlank,'Tap');};$('choices').append(b);});
  const correct=item.blanks.filter((_,i)=>C.isRight(item,answers,i)).length;$('placed-count').textContent=correct+' / '+item.blanks.length+' correct';$('choice-label').textContent='BLANK '+(activeBlank+1)+' OF '+item.blanks.length+' · '+(item.blanks[activeBlank].kind==='word'?'CHOOSE A WHOLE WORD':'CHOOSE A SHORT VOWEL');
  $('clear-blank').disabled=!answers[activeBlank];$('check').disabled=answers.some(v=>v===null)||Boolean(entry.checkedCurrent);requestFit();
 }
 function record(event,index,value,correct,method){
  save();const b=item.blanks[index];profile.attempts.push({timestamp:new Date().toISOString(),level:profile.level,item:item.id,event,blank:b?index+1:'',kind:b?b.feature:'Sentence',word:b?b.word:item.word,target:b?b.answer:item.sentence,choice:value,correct,sentence:C.response(item,answers),options:choiceOrder.join(' | '),method,hints:entry.hints,listens:entry.listens,teacher:entry.teacher||'',seconds:Math.round(entry.seconds)});save();
 }
 function markComplete(){if(C.complete(item,answers)&&!entry.complete){entry.complete=true;entry.completedAt??=new Date().toISOString();renderRocketFlight(true);}}
 function place(value,index,method='Tap'){
  if(!item.options.includes(value)||!Number.isInteger(index)||!item.blanks[index])return;
  activeBlank=index;answers[index]=value;entry.answers=answers;entry.checkedCurrent=false;entry.choiceAttempts=(entry.choiceAttempts||0)+1;
  const right=C.isRight(item,answers,index),stats=entry.blankStats[index]??={attempts:0,correct:0};stats.attempts++;if(right)stats.correct++;
  entry.lastResponse=C.response(item,answers);markComplete();record('Choice',index,value,right,method);
  if(right){const next=C.nextBlank(item,answers);if(next>=0)activeBlank=next;feedback(next<0?'You completed the sentence! Great listening and reading.':'That fits! Complete the next blank.','success');}
  else feedback('Try another choice for this blank. You can listen again.','error');render();renderProgress();save();
 }
 function check(){if(answers.some(v=>v===null)||entry.checkedCurrent)return;entry.checks=(entry.checks||0)+1;entry.checkedCurrent=true;entry.lastChecked=new Date().toISOString();entry.lastResponse=C.response(item,answers);const correct=C.complete(item,answers);markComplete();record('Sentence check',-1,entry.lastResponse,correct,'Check button');feedback(correct?'You completed the sentence!':'Listen again and change the blanks that need another choice.',correct?'success':'error');render();renderProgress();save();}
 function clearBlank(){if(!answers[activeBlank])return;cancelDrag();answers[activeBlank]=null;entry.answers=answers;entry.checkedCurrent=false;feedback('This blank is ready for another choice.');render();save();}
 function resetQuestion(){stop();cancelDrag();touchStartY=null;suppressClickUntil=0;answers=item.blanks.map(()=>null);entry.answers=answers;entry.checkedCurrent=false;activeBlank=0;choiceOrder=C.shuffle(item.options);entry.choiceOrder=choiceOrder;$('hint-display').hidden=true;$('hint-display').textContent='';$('hint').textContent='Show me a hint';$('voice-note').textContent='Tap Listen to hear it again.';feedback('Question reset. Listen and try again.');render();save();}
 function pointerDown(e){if(e.button!==undefined&&e.button!==0||drag)return;drag={value:e.currentTarget.dataset.choice,target:e.currentTarget,pointer:e.pointerId,x:e.clientX,y:e.clientY,moving:false};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.addEventListener('pointermove',pointerMove);e.currentTarget.addEventListener('pointerup',pointerUp);e.currentTarget.addEventListener('pointercancel',cancelDrag);}
 function findDrop(x,y){return document.elementFromPoint(x,y)?.closest('[data-blank]')||null;}
 function pointerMove(e){if(!drag||drag.pointer!==e.pointerId)return;if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;e.preventDefault();drag.moving=true;drag.target.classList.add('dragging');const ghost=$('drag-ghost');ghost.textContent=drag.value;ghost.hidden=false;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';if(hoverBlank)hoverBlank.classList.remove('drop-target');hoverBlank=findDrop(e.clientX,e.clientY);if(hoverBlank)hoverBlank.classList.add('drop-target');if(e.clientY>window.innerHeight-35)window.scrollBy(0,12);else if(e.clientY<45)window.scrollBy(0,-12);}
 function pointerUp(e){if(!drag||drag.pointer!==e.pointerId)return;const moving=drag.moving,value=drag.value,target=moving?findDrop(e.clientX,e.clientY):null;cancelDrag();if(moving){suppressClickUntil=performance.now()+400;if(target)place(value,Number(target.dataset.blank),'Drag');else feedback('Drop on a sentence blank. Your choice is still in the bank.');}}
 function cancelDrag(){if(drag){const t=drag.target;t.classList.remove('dragging');t.removeEventListener('pointermove',pointerMove);t.removeEventListener('pointerup',pointerUp);t.removeEventListener('pointercancel',cancelDrag);try{if(t.hasPointerCapture(drag.pointer))t.releasePointerCapture(drag.pointer);}catch(e){}drag=null;}if(hoverBlank)hoverBlank.classList.remove('drop-target');hoverBlank=null;$('drag-ghost').hidden=true;}
 function renderRating(){document.querySelectorAll('[data-rating]').forEach(b=>b.setAttribute('aria-pressed',String(entry.teacher===b.dataset.rating)));}
 function renderProgress(){const rows=list(),completed=rows.filter(r=>profile.progress[r.id]?.complete).length;$('progress').textContent=C.objectName(O,state.selected)+' · '+completed+' / '+rows.length+' completed in '+profile.level+' · Saved here';}
 function stopRocketFlight(){rideToken++;rideTimers.forEach(clearTimeout);rideTimers=[];$('rocket-rig').classList.remove('is-moving');}
 function renderRocketFlight(animate=false){
  if(!active)return;const count=C.correctCount(profile),sameProfile=rideProfile===state.selected,previous=rideCount;
  if(sameProfile&&previous===count)return;
  stopRocketFlight();rideProfile=state.selected;rideCount=count;const token=rideToken,rig=$('rocket-rig'),step=C.rideStep(count);
  $('rocket-count').textContent=String(count);$('rocket-flight').setAttribute('aria-label',C.objectName(O,state.selected)+': '+count+' correct questions. A new rocket starts every 20.');
  $('flight-status').textContent=count+' correct questions. '+step+' of 20 on this rocket flight.';
  const setStep=n=>rig.style.setProperty('--rise-progress',n*5+'%');
  const colour=n=>rig.dataset.flight=String(Math.floor(n/20)+1);
  const later=(fn,ms)=>rideTimers.push(setTimeout(()=>{if(token===rideToken)fn();},ms));
  const reveal=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===rideToken)rig.classList.remove('resetting');}));
  if(!animate||!sameProfile||count<=previous){rig.classList.add('resetting');colour(count);setStep(step);reveal();return;}
  const move=()=>{rig.classList.remove('resetting');colour(count-1);setStep(step||20);rig.classList.add('is-moving');later(()=>rig.classList.remove('is-moving'),1050);
   if(step===0)later(()=>{rig.classList.add('resetting');colour(count);setStep(0);$('flight-status').textContent=count+' correct questions. A new rocket is ready at the bottom.';reveal();},1500);
  };
  if(previous>0&&C.rideStep(previous)===0){rig.classList.add('resetting');colour(count);setStep(0);later(move,60);}else move();
 }
 function changeLevel(level){if(profile.level===level)return;save();profile.level=level;load();}
 function nav(delta){save();profile.positions[profile.level]=Math.max(0,Math.min(list().length-1,position()+delta));load();}
 function exportAssessment(all){
  save();const ids=all?O.map(o=>o.id):[state.selected];if(!ids[0])return;
  const summary=[['School supply','Level','Available','Started','Completed','Choice attempts','Sentence checks','Hints','Listens','Independent','With help','Practising']];
  const progress=[['School supply','Level','Activity','Picture word','Sentence','Current student sentence','Correct choices','Choices offered','Blanks','Filled','Correct now','Status','Choice attempts','Sentence checks','Hints','Listens','Teacher support','First started (UTC)','Completed (UTC)','Active seconds','Picture file']];
  const blanks=[['School supply','Level','Activity','Blank','Kind','Word','Correct choice','Student choice','Correct now','Choice attempts','Correct selections','Choices offered']];
  const attempts=[['School supply','Time (UTC)','Level','Activity','Event','Blank','Answer type','Word','Correct choice or sentence','Student choice or sentence','Correct','Student sentence','Choices offered','Method','Hints so far','Listens so far','Teacher support','Active seconds']];
  for(const id of ids){const name=C.objectName(O,id),p=state.profiles[id]||{progress:{},attempts:[]};
   for(const level of C.levels){const rows=D[level],es=rows.map(r=>p.progress[r.id]).filter(Boolean);summary.push([name,level,rows.length,es.length,es.filter(e=>e.complete).length,es.reduce((n,e)=>n+(e.choiceAttempts||0),0),es.reduce((n,e)=>n+(e.checks||0),0),es.reduce((n,e)=>n+(e.hints||0),0),es.reduce((n,e)=>n+(e.listens||0),0),...['Independent','With help','Practising'].map(v=>es.filter(e=>e.teacher===v).length)]);
    for(const r of rows){const e=p.progress[r.id];if(all&&!e)continue;const current=C.restore(r,e?.answers),offered=e?.choiceOrder||r.options;progress.push([name,level,r.id,r.word,r.sentence,C.response(r,current),r.blanks.map(b=>b.answer).join(' | '),offered.join(' | '),r.blanks.length,current.filter(Boolean).length,r.blanks.filter((_,i)=>C.isRight(r,current,i)).length,e?.complete?'Completed':e?'Practising':'Not started',e?.choiceAttempts||0,e?.checks||0,e?.hints||0,e?.listens||0,e?.teacher||'',e?.started||'',e?.completedAt||'',Math.round(e?.seconds||0),r.image]);r.blanks.forEach((b,i)=>blanks.push([name,level,r.id,i+1,b.feature,b.word,b.answer,current[i]||'',C.isRight(r,current,i)?'Yes':'No',e?.blankStats?.[i]?.attempts||0,e?.blankStats?.[i]?.correct||0,offered.join(' | ')]));}
   }
   for(const a of p.attempts||[])attempts.push([name,a.timestamp,a.level,a.item,a.event,a.blank,a.kind,a.word,a.target,a.choice,a.correct?'Yes':'No',a.sentence,a.options,a.method,a.hints,a.listens,a.teacher,a.seconds]);
  }
  const guide=[["Short Vowels assessment","Details"],["Exported (UTC)",new Date().toISOString()],["A","Alternating whole-word cloze and missing short vowels, with one blank and three choices."],["B and C","One short-vowel blank and three vowel choices. C adds a connected sentence about the picture."],["AA, BB, CC","Two, three and four blanks respectively, with five reusable choices. Missing vowels and whole words are mixed, as in the established levels."],["Choices","Vowel buttons contain a, e, i, o or u. Mixed banks have two whole words and three vowels; vowel-only higher-level banks contain all five vowels."],["Vocabulary","110 native picture cards and 660 activities across six levels."],["Short vowels","Short a as in cat, e as in bed, i as in pig, o as in log, u as in sun. Vowels are inside CVC words."],["Order","All five vowel groups are spread throughout each level. Duplicate illustrations of a word are spaced within its group. Shuffle retains the mix."],["Attempts","Progress counts choices per question; Blanks counts attempts and correct selections per blank; Attempts logs each tap/drop, target word, correct vowel or word, selected answer, correctness and input method."],["Checks","Sentence checks are counted separately from choices. All blanks must be filled first."],["Rocket","Reuses the established rising behaviour. One first fully correct question earns one step. Every 20 correct questions a new rocket starts at the bottom with the cumulative count."],["Joined words","A separate display shows each whole word made by the current selections, including incorrect combinations."],["Highlights","Golden highlights mark the short vowel in complete CVC words and selected vowel letters. Empty blanks never reveal their vowel."],["Pictures","Source captions are cropped away. Embedded BUS and TAXI labels are covered. Incorrect captions are corrected to sit, rug, rag, leg and man. Jar is r-controlled and the yo-yo caption yog is invalid, so both are omitted. The identical Set 9 attachment is included once."],["Identity","20 school-supply picture profiles; no names, ID or passwords."],["Storage","Saved locally in this browser on this device under short-vowels-v1. Export before clearing browser data or changing devices."],["Voice","Reads only the full target sentence or connected sentences; no reward speech."],["Reset question","Clears answers and hints but preserves attempts, completion history and cumulative score. Full selected-profile reset is separate and confirmed."],["Tablet","Tap or Pointer Events dragging to any blank. Work-area pull-to-refresh is suppressed; browser/OS controls remain available."]];
  const blob=window.SpellingExcel.workbook([{name:'Summary',rows:summary},{name:'Progress',rows:progress},{name:'Blanks',rows:blanks},{name:'Attempts',rows:attempts},{name:'Guide',rows:guide}]);
  const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='Short-Vowels-'+(all?'all-objects':state.selected)+'-'+window.notebookDate(new Date()).iso+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 C.levels.forEach((level,i)=>{const b=document.createElement('button');b.textContent=level;b.dataset.level=level;b.setAttribute('aria-label','Level '+level);b.onclick=()=>changeLevel(level);$(i<3?'levels-one':'levels-two').append(b);});
 document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{entry.teacher=entry.teacher===b.dataset.rating?'':b.dataset.rating;save();renderRating();});
 $('home').onclick=landing;$('object-badge').onclick=landing;$('listen').onclick=speak;$('stop').onclick=()=>{stop();$('voice-note').textContent='Voice stopped. Tap Listen to hear it again.';};$('speed').value=state.speed||'0.82';$('speed').onchange=()=>{state.speed=$('speed').value;save();};
 $('check').onclick=check;$('reset-question').onclick=resetQuestion;$('clear-blank').onclick=clearBlank;$('previous').onclick=()=>nav(-1);['next','next-date','next-choices'].forEach(id=>$(id).onclick=()=>nav(1));
 $('hint').onclick=()=>{if(!$('hint-display').hidden){$('hint-display').hidden=true;$('hint').textContent='Show me a hint';requestFit();return;}entry.hints=(entry.hints||0)+1;$('hint-display').textContent=item.sentence;$('hint-display').hidden=false;$('hint').textContent='Hide the hint';save();requestFit();};
 $('shuffle-activities').onclick=()=>{save();profile.orders[profile.level]=C.balancedOrder(list(),Math.random);profile.orderVersions??={};profile.orderVersions[profile.level]=2;profile.positions[profile.level]=0;load();};$('export-current').onclick=()=>exportAssessment(false);$('export-all').onclick=()=>exportAssessment(true);
 $('reset-all').onclick=()=>{if(window.confirm('Reset all saved Short Vowels progress for '+C.objectName(O,state.selected)+'? Other school supplies keep their progress.')){stop();cancelDrag();active=false;entry=null;lastTick=0;delete state.profiles[state.selected];profile=getProfile(state.selected);active=true;load();}};
 $('activity-picture').onerror=()=>notice('A picture could not load. Keep the complete Short-Vowels folder together.');
 document.addEventListener('touchstart',e=>{touchStartY=active&&e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
 document.addEventListener('touchmove',e=>{if(!active||touchStartY===null||e.touches.length!==1)return;const inWork=Boolean(e.target.closest('[data-area]')),inMenu=Boolean(e.target.closest('[data-scrollable]')),pulling=window.scrollY<=0&&e.touches[0].clientY>touchStartY;if(e.cancelable&&(drag||inWork||(!inMenu&&pulling)))e.preventDefault();},{passive:false});
 document.addEventListener('touchend',()=>{touchStartY=null;},{passive:true});document.addEventListener('touchcancel',()=>{touchStartY=null;},{passive:true});
 window.addEventListener('resize',requestFit);if('ResizeObserver'in window)new window.ResizeObserver(requestFit).observe($('activity'));
 window.addEventListener('pagehide',()=>{save();stop();cancelDrag();stopRocketFlight();rideProfile='';rideCount=-1;clearTimeout(dateTimer);});window.addEventListener('pageshow',()=>{refreshDate();renderRocketFlight();});window.addEventListener('focus',refreshDate);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){save();stop();cancelDrag();stopRocketFlight();rideProfile='';rideCount=-1;lastTick=0;}else{refreshDate();if(active){lastTick=performance.now();renderRocketFlight();}}});
 refreshDate();renderObjects();
})();
