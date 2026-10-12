export const zoneNames={P:'自陣',S:'共有',U:'上段'};
export const spots=[[-2.5,.6,-2.5,'P',0],[-2.5,.6,2.5,'P',0],[2.5,.6,-2.5,'P',1],[2.5,.6,2.5,'P',1],[0,.6,-2.55,'S',-1],[0,.6,2.55,'S',-1],[-1.1,.9,-1.1,'U',-1],[-1.1,.9,1.1,'U',-1],[1.1,.9,-1.1,'U',-1],[1.1,.9,1.1,'U',-1]];
export function catalog(){let a=[];for(let x of ['S','P','U'])for(let y of ['P','S','U'])for(let mode of ['build','reuse','flip'])for(let mission of [true,false])for(let supply of ['balanced','earth','sky'])for(let end of ['expand','flip','late']){if(x==='P'&&y==='P'&&(mission||mode!=='build'))continue;a.push({id:a.length+1,zones:[x,y],mode,mission,supply,end});}return a;}
export const modes={build:'自力建設',reuse:'土台を利用',flip:'頂上を反転'},ends={expand:'建設を継続',flip:'反転を優先',late:'終盤に反転'},supplies={balanced:'土台2＋頂上1',earth:'土台を先行',sky:'頂上を先行'};
export const title=p=>p.zones.map(z=>zoneNames[z]).join(' → ');
export function simulate(plan,enemy,settings={},record=true){
 const cfg={speed:1.1,handling:2.2,success:1,seed:42,...settings};let seed=cfg.seed;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const towers=spots.map((p,i)=>({id:i,p:p.slice(0,3),zone:p[3],private:p[4],earth:[],sky:null}));
 const teams=[0,1].map(i=>({earth:20,sky:0,bufferE:0,bufferS:0,transfer:0,mandate:false,ever:[],mustika:false}));let groundSky=12,mustika='ground';
 const robots=[0,1].flatMap(team=>['TR','BR'].map(role=>({id:`${team?'B':'R'}-${role}`,team,role,p:[team?4.4:-4.4,0,role==='TR'?3.8:2.8],from:[],to:[],start:0,finish:0,job:null,carry:[],state:'待機'})));
 const plans=[plan,enemy],events=[],frames=[],intervals=[];let time=0;
 const score=()=>teams.map((t,i)=>t.transfer+towers.reduce((s,w)=>s+w.earth.reduce((v,o,k)=>v+(o===i?(k?20:10)*(w.zone==='U'?2:1):0),0)+(w.sky===i?40*(w.zone==='U'?2:1):0),0)+(mustika===i?250:0));
 const log=(r,label)=>events.push({t:time,robot:r.id,team:r.team,label});
 const buffer=i=>[i?2.8:-2.8,.6,1.6];
 function task(r,kind,to,data={},label=kind){let distance=Math.hypot(to[0]-r.p[0],to[2]-r.p[2])+Math.abs(to[1]-r.p[1])*3;r.from=[...r.p];r.to=to;r.start=time;r.finish=time+distance/cfg.speed+cfg.handling;r.job={kind,...data};r.state=label;intervals.push({robot:r.id,start:time,end:r.finish,label});}
 function choose(r){const i=r.team,t=teams[i],p=plans[i];if(r.role==='TR'){
 if(r.carry.length){task(r,'deliver',buffer(i),{},'搬送・受け渡し');return;}
 if(p.mission&&t.mandate&&mustika==='ground'){task(r,'takeM',[0,0,-4],{},'Mustikaを回収');return;}
 const needS=t.bufferS<2&&groundSky>0,needE=t.bufferE<5&&t.earth>0;if(!needS&&!needE)return;
 let kind=needS&&(!needE||p.supply==='sky'||t.bufferE>=2)?'takeS':'takeE';task(r,kind,kind==='takeS'?[0,0,4]:[i?4.3:-4.3,0,-3.8],{},kind==='takeS'?'頂上ブロックを回収':'土台ブロックを回収');return;
 }
 if(p.mission&&t.mustika&&t.mandate){t.mustika=false;r.carry=['M'];task(r,'placeM',[i?.6:-.6,.9,0],{},'中央柱へ奉納');return;}
 const allowed=towers.filter(w=>w.private<0||w.private===i),hasFlips=(p.mode==='flip'||p.end==='flip'||(p.end==='late'&&time>=120));
 const flip=allowed.filter(w=>w.sky!==null&&w.sky!==i).sort((a,b)=>Number(b.zone==='U')-Number(a.zone==='U'))[0];if(hasFlips&&flip){task(r,'flip',flip.p,{spot:flip.id},'頂上ブロックを反転');return;}
 const targetZone=p.zones[Math.min(t.ever.length,1)];let candidates=allowed.filter(w=>w.sky===null).sort((a,b)=>(Number(b.zone===targetZone)-Number(a.zone===targetZone))*10+(p.mode==='reuse'?b.earth.length-a.earth.length:0));
 let w=candidates.find(w=>(w.earth.length<2&&t.bufferE>0)||(w.earth.length===2&&t.bufferS>0));if(!w)return;
 if(w.earth.length<2){let n=Math.min(2-w.earth.length,t.bufferE);t.bufferE-=n;r.carry=Array(n).fill('E');task(r,'earth',w.p,{spot:w.id,n},'土台を積む');}
 else {t.bufferS--;r.carry=['S'];task(r,'sky',w.p,{spot:w.id},'頂上を積む');}
 }
 function finish(r){let j=r.job,t=teams[r.team],i=r.team,w=towers[j.spot];r.job=null;
 if(rand()>cfg.success){log(r,'操作を再試行');task(r,j.kind,r.to,j,r.state);return;}
 if(j.kind==='takeE'){let n=Math.min(3,t.earth);t.earth-=n;r.carry=Array(n).fill('E');}
 if(j.kind==='takeS'){let n=Math.min(3,groundSky);groundSky-=n;r.carry=Array(n).fill('S');}
 if(j.kind==='takeM'&&mustika==='ground'&&t.mandate){mustika='carry';r.carry=['M'];}
 if(j.kind==='deliver'){for(let c of r.carry){if(c==='E'){t.bufferE++;t.transfer+=5;}if(c==='S'){t.bufferS++;t.transfer+=5;}if(c==='M'){t.mustika=true;mustika='buffer';}}r.carry=[];}
 if(j.kind==='earth'){let n=Math.min(j.n,2-w.earth.length);w.earth.push(...Array(n).fill(i));t.bufferE+=j.n-n;r.carry=[];}
 if(j.kind==='sky'){if(w.earth.length===2&&w.sky===null){w.sky=i;if(!t.ever.includes(w.id))t.ever.push(w.id);}else t.bufferS++;r.carry=[];}
 if(j.kind==='flip'&&w.sky!==null){w.sky=i;if(!t.ever.includes(w.id))t.ever.push(w.id);}
 if(j.kind==='placeM'&&t.mandate){mustika=i;r.carry=[];}
 log(r,r.state+' 完了');for(let a=0;a<2;a++){let owned=towers.filter(x=>x.sky===a);if(!teams[a].mandate&&owned.length>=2&&owned.some(x=>x.zone!=='P')){teams[a].mandate=true;log(robots[a*2+1],'奉納資格を獲得');}}
 if(r.role==='BR'&&!['deliver'].includes(j.kind))task(r,'return',buffer(i),{},'受け渡し場所へ戻る');
 }
 for(time=0;time<=180;time+=.5){for(let r of robots){if(r.job){let f=Math.min(1,(time-r.start)/(r.finish-r.start));r.p=r.from.map((v,k)=>v+(r.to[k]-v)*f);if(time>=r.finish)finish(r);}if(!r.job)choose(r);}if(record)frames.push({t:time,scores:score(),robots:robots.map(r=>({id:r.id,team:r.team,role:r.role,p:[...r.p],state:r.state,carry:[...r.carry]})),towers:towers.map(w=>({earth:[...w.earth],sky:w.sky})),teams:teams.map(t=>({...t,ever:[...t.ever]})),groundSky,mustika});}
 return {plan,enemy,cfg,frames,events:record?events:[],intervals:record?intervals:[],scores:score(),mandates:teams.map(t=>t.mandate),mustika};
}
