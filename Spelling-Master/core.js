(function(root){
 'use strict';
 const levels=['A','B','C','AA','BB','CCC'];
 function shuffle(a,random=Math.random){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
 function mixedIds(pieces,random=Math.random){let a=shuffle(pieces.map((_,i)=>i),random);if(a.every((v,i)=>pieces[v]===pieces[i])&&a.length>1){const j=a.findIndex(v=>pieces[v]!==pieces[a[0]]);if(j>0)[a[0],a[j]]=[a[j],a[0]];}return a;}
 function distractors(item,level){
  const count=levels.indexOf(level)<3?1:3;
  const choices=[...'etaoinshrdlucmfwypvbgkjqxz'].filter(letter=>!item.word.includes(letter));
  let seed=2166136261;for(const c of item.id+'|'+level)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const result=[];for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;result.push(choices.splice(seed%choices.length,1)[0]);}return result;
 }
 function withBank(item,mode,level){const extras=mode==='spelling'?distractors(item,level):[];return{...item,distractors:extras,bank:item.pieces.concat(extras)};}
 function restoreModel(item,model){
  const bank=item.bank||item.pieces,n=bank.length;
  if(!model||!Array.isArray(model.pad)||!Array.isArray(model.tray))return null;
  const ids=model.pad.concat(model.tray),unique=new Set(ids);
  const validFor=count=>ids.length===count&&unique.size===count&&ids.every(x=>Number.isInteger(x)&&x>=0&&x<count);
  if(validFor(n))return model;
  // Older saved spelling work has only answer tiles. Add extras to its tray without moving the answer.
  if(n>item.pieces.length&&validFor(item.pieces.length))return{pad:model.pad.slice(),tray:shuffle(model.tray.concat(Array.from({length:n-item.pieces.length},(_,i)=>item.pieces.length+i)))};
  return null;
 }
 function move(model,id,area,gap){
  if(!['pad','tray'].includes(area)||!Number.isInteger(id)||!model.pad.concat(model.tray).includes(id))return model;
  const next={pad:model.pad.slice(),tray:model.tray.slice()};
  const old=next[area].indexOf(id);let at=Number.isFinite(gap)?gap:next[area].length;
  if(old>=0&&old<at)at--;
  for(const key of ['pad','tray'])next[key]=next[key].filter(v=>v!==id);
  next[area].splice(Math.max(0,Math.min(at,next[area].length)),0,id);
  return next;
 }
 const response=(item,model,mode)=>model.pad.map(id=>(item.bank||item.pieces)[id]).join(mode==='spelling'?'':' ');
 const correct=(item,model,mode)=>model.pad.length===item.pieces.length&&response(item,model,mode)===(mode==='spelling'?item.word:item.sentence);
 function masked(item){const re=new RegExp('\\b'+item.word+'\\b','ig');return item.sentence.replace(re,'________');}
 function objectName(objects,id){return objects.find(o=>o.id===id)?.name||'';}
 function notebookDate(date=new Date()){
  const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const year=date.getFullYear(),month=date.getMonth(),day=date.getDate();
  const suffix=day%100>=11&&day%100<=13?'th':({1:'st',2:'nd',3:'rd'}[day%10]||'th');
  // Local calendar fields follow the student's device, including dates near UTC midnight.
  return{iso:String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),text:weekdays[date.getDay()]+' '+months[month]+' '+day+suffix+', '+year};
 }
 root.SpellingCore={levels,shuffle,mixedIds,distractors,withBank,restoreModel,move,response,correct,masked,objectName,notebookDate};
 if(typeof module!=='undefined')module.exports=root.SpellingCore;
})(typeof window!=='undefined'?window:globalThis);
