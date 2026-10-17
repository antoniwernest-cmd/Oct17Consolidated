(function(root){
 'use strict';
 const levels=['A','B','C','AA','BB','CC'];
 function shuffle(a,random=Math.random){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
 function restore(item,answers){return item.blanks.map((_,i)=>Array.isArray(answers)&&item.options.includes(answers[i])?answers[i]:null);}
 const isRight=(item,answers,i)=>answers[i]===item.blanks[i].answer;
 const complete=(item,answers)=>item.blanks.every((_,i)=>isRight(item,answers,i));
 function display(item,i,value){if(!value)return'____';return /^[A-Z]/.test(item.sentence.slice(item.blanks[i].start))?value[0].toUpperCase()+value.slice(1):value;}
 function response(item,answers){let result='',at=0;item.blanks.forEach((b,i)=>{result+=item.sentence.slice(at,b.start)+display(item,i,answers[i]);at=b.end;});return result+item.sentence.slice(at);}
 const nextBlank=(item,answers)=>item.blanks.findIndex((_,i)=>!isRight(item,answers,i));
 const objectName=(objects,id)=>objects.find(o=>o.id===id)?.name||'';
 const correctCount=profile=>Object.values(profile?.progress||{}).filter(e=>e.complete).length;
 const rideStep=count=>Math.max(0,Math.floor(Number(count)||0))%20;
 root.BlendCore={levels,shuffle,restore,isRight,complete,display,response,nextBlank,objectName,correctCount,rideStep};
 if(typeof module!=='undefined')module.exports=root.BlendCore;
})(typeof window!=='undefined'?window:globalThis);
