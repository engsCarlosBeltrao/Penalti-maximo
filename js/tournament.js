// Campeonato: 4 grupos de 4 (todos contra todos, 3 rodadas), top-2 → quartas, semi, final. Cada jogo é uma disputa de pênaltis.
import { TEAMS } from './teams.js';
const rnd=()=>Math.random()<.72;
export function simulate(){let a=0,b=0;for(let i=0;i<5;i++){a+=rnd();b+=rnd();}while(a===b){a+=rnd();b+=rnd();}return[a,b];}
const FIX=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
export class Cup {
  constructor(me){
    this.me=me; const ids=[me,...TEAMS.map(t=>t.id).filter(i=>i!==me).sort(()=>Math.random()-.5).slice(0,15)].sort(()=>Math.random()-.5);  // 16 dos 20 clubes
    this.groups=[0,1,2,3].map(g=>ids.slice(g*4,g*4+4));
    this.tab={}; ids.forEach(i=>this.tab[i]={id:i,pts:0,w:0,l:0,gf:0,ga:0});
    this.round=0; this.stage='grupos'; this.ko=[]; this.hist=[]; this.champion=null; this.alive=true;
  }
  name(i){return TEAMS[i].nome;}
  stageName(){ if(this.stage==='grupos')return`Grupos – rodada ${this.round+1}/3`; return this.ko.length===4?'Quartas de final':this.ko.length===2?'Semifinal':'Final'; }
  pairs(){ return this.stage==='grupos'?this.groups.flatMap(g=>FIX[this.round].map(([i,j])=>[g[i],g[j]])):this.ko; }
  nextForMe(){ const p=this.pairs().find(p=>p.includes(this.me)); return p?(p[0]===this.me?p:[p[1],p[0]]):null; }
  rank(g){ return [...g].sort((a,b)=>{const A=this.tab[a],B=this.tab[b];return B.pts-A.pts||(B.gf-B.ga)-(A.gf-A.ga)||B.gf-A.gf||Math.random()-.5;}); }
  _apply(a,b,ga,gb){
    this.hist.push(`${this.stageName()}: ${this.name(a)} ${ga} x ${gb} ${this.name(b)}`);
    if(this.stage==='grupos'){const A=this.tab[a],B=this.tab[b];A.gf+=ga;A.ga+=gb;B.gf+=gb;B.ga+=ga;
      if(ga>gb){A.pts+=3;A.w++;B.l++;}else{B.pts+=3;B.w++;A.l++;}}
    return ga>gb?a:b;
  }
  // Registra o resultado do jogador, simula o resto da rodada e avança o torneio.
  playerResult(ga,gb){
    const [me,op]=this.nextForMe(); const winners=[];
    for(const p of this.pairs()){
      if(p.includes(me)){const w=this._apply(me,op,ga,gb);winners.push(w);}
      else{const [x,y]=simulate();winners.push(this._apply(p[0],p[1],x,y));}
    }
    this._advance(winners,ga>gb);
  }
  _advance(winners,meWon){
    if(this.stage==='grupos'){
      this.round++; if(this.round<3)return;
      const q=this.groups.map(g=>this.rank(g)); this.stage='ko';
      this.ko=[[q[0][0],q[1][1]],[q[1][0],q[0][1]],[q[2][0],q[3][1]],[q[3][0],q[2][1]]];
      if(!this.ko.flat().includes(this.me))this.alive=false;
    } else {
      if(!meWon&&this.alive)this.alive=false;
      if(winners.length===1){this.champion=winners[0];return;}
      this.ko=winners.reduce((r,w,i)=>(i%2?r[r.length-1].push(w):r.push([w]),r),[]);
    }
    if(!this.alive)this.finish();
  }
  finish(){ // jogador eliminado: simula o resto até o campeão
    while(this.champion===null){
      const w=this.ko.map(p=>{const[x,y]=simulate();return this._apply(p[0],p[1],x,y);});
      if(w.length===1)this.champion=w[0]; else this.ko=w.reduce((r,x,i)=>(i%2?r[r.length-1].push(x):r.push([x]),r),[]);
    }
  }
}

