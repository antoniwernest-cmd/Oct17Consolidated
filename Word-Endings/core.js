(function(root){
 'use strict';
 const levels=['A','B','C','AA','BB','CC'];
 function shuffle(a,random=Math.random){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
 function balancedOrder(rows,random=null,previousPattern=''){
  const groups=new Map(),alternateWords=rows[0]?.level==='A',startWithWord=alternateWords&&rows.filter(r=>r.blanks[0].kind==='word').length>rows.length/2;
  rows.forEach((row,index)=>{let group=groups.get(row.pattern);if(!group){group={pattern:row.pattern,size:0,used:0,queues:new Map(),bias:random?.()*.5+.25||.5};groups.set(row.pattern,group);}group.size++;const kind=alternateWords?row.blanks[0].kind:'any';if(!group.queues.has(kind))group.queues.set(kind,[]);group.queues.get(kind).push(index);});
  // Rotate pictured words inside a family, so duplicate illustrations are spaced apart.
  for(const group of groups.values())for(const [kind,indices]of group.queues){
   const words=new Map();for(const index of indices){const word=rows[index].word;if(!words.has(word))words.set(word,[]);words.get(word).push(index);}
   const names=random?shuffle([...words.keys()],random):[...words.keys()],queue=[];
   if(random)for(const name of names)words.set(name,shuffle(words.get(name),random));
   while(queue.length<indices.length)for(const name of names){const index=words.get(name).shift();if(index!==undefined)queue.push(index);}
   group.queues.set(kind,queue);
  }
  const result=[];let previous=previousPattern;
  while(result.length<rows.length){
   let kind=alternateWords?((result.length%2===0)===startWithWord?'word':'ending'):'any';
   let candidates=[...groups.values()].filter(g=>g.queues.get(kind)?.length);
   if(!candidates.length&&alternateWords){kind=kind==='word'?'ending':'word';candidates=[...groups.values()].filter(g=>g.queues.get(kind)?.length);}
   const different=candidates.filter(g=>g.pattern!==previous);if(different.length)candidates=different;
   if(!candidates.length)throw Error('The activity bank cannot supply the required question type.');
   candidates.sort((a,b)=>(a.used+a.bias)/a.size-(b.used+b.bias)/b.size);
   const chosen=candidates[0];result.push(chosen.queues.get(kind).shift());chosen.used++;previous=chosen.pattern;
  }
  return result;
 }
 function restore(item,answers){return item.blanks.map((_,i)=>Array.isArray(answers)&&item.options.includes(answers[i])?answers[i]:null);}
 const isRight=(item,answers,i)=>answers[i]===item.blanks[i].answer;
 const complete=(item,answers)=>item.blanks.every((_,i)=>isRight(item,answers,i));
 function display(item,i,value){if(!value)return'____';return /^[A-Z]/.test(item.sentence.slice(item.blanks[i].start))?value[0].toUpperCase()+value.slice(1):value;}
 function response(item,answers){let result='',at=0;item.blanks.forEach((b,i)=>{result+=item.sentence.slice(at,b.start)+display(item,i,answers[i]);at=b.end;});return result+item.sentence.slice(at);}
 const endingPatterns=["ow","owl","own","ower","er","our","owd","oud","el","let","aze","erd","ay","on","ight","eight","ite","ound","ake","ain","eep","eek","ore","ing","owy","all","op","elt","oe","orm","obe","ile","ift","ard","anche","uck","an","out","oo"];
 const endingOrder=endingPatterns.slice().sort((a,b)=>b.length-a.length);
 function highlights(text,includeEnding=false){
  if(!includeEnding)return text?[{text,feature:''}]:[];
  const token=/([a-z]+)([^a-z]*)$/i.exec(text);if(!token)return text?[{text,feature:''}]:[];
  const word=token[1],ending=endingOrder.find(p=>word.toLowerCase().endsWith(p));if(!ending)return[{text,feature:''}];
  const at=token.index+word.length-ending.length,parts=[];if(at)parts.push({text:text.slice(0,at),feature:''});parts.push({text:text.slice(at,at+ending.length),feature:'word-ending'});if(at+ending.length<text.length)parts.push({text:text.slice(at+ending.length),feature:''});return parts;
 }
 function joinedWord(item,index,value){const b=item.blanks[index];if(!b||!value)return'';const start=b.start-b.wordStart;return b.word.slice(0,start)+value+b.word.slice(start+b.answer.length);}
 const nextBlank=(item,answers)=>item.blanks.findIndex((_,i)=>!isRight(item,answers,i));
 const objectName=(objects,id)=>objects.find(o=>o.id===id)?.name||'';
 const correctCount=profile=>Object.values(profile?.progress||{}).filter(e=>e.complete).length;
 const rideStep=count=>Math.max(0,Math.floor(Number(count)||0))%20;
 root.EndingsCore={levels,shuffle,balancedOrder,restore,isRight,complete,display,response,joinedWord,highlights,endingPatterns,nextBlank,objectName,correctCount,rideStep};
 if(typeof module!=='undefined')module.exports=root.EndingsCore;
})(typeof window!=='undefined'?window:globalThis);
