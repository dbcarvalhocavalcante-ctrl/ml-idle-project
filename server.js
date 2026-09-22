
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, "data.json");
const PUBLIC = path.join(__dirname, "public");

const ranks = [
  {name:"Guerreiro", subs:["III","II","I"], mult:.90},
  {name:"Elite", subs:["III","II","I"], mult:1.00},
  {name:"Mestre", subs:["IV","III","II","I"], mult:1.12},
  {name:"Grande Mestre", subs:["V","IV","III","II","I"], mult:1.25},
  {name:"Épico", subs:["V","IV","III","II","I"], mult:1.40},
  {name:"Lenda", subs:["V","IV","III","II","I"], mult:1.60},
  {name:"Mítico", subs:[""], mult:1.85}
];
const captureChance = [0.75,0.68,0.60,0.55,0.50,0.35,0.20];

const seeds = [
  {id:"gusion",name:"Gusion",role:"Assassino",icon:"🗡️",base:62,rank:6,sub:0},
  {id:"miya",name:"Miya",role:"Atirador",icon:"🏹",base:57,rank:5,sub:2},
  {id:"tigreal",name:"Tigreal",role:"Tanque",icon:"🛡️",base:54,rank:5,sub:4},
  {id:"eudora",name:"Eudora",role:"Mago",icon:"⚡",base:51,rank:4,sub:3},
  {id:"alucard",name:"Alucard",role:"Lutador",icon:"⚔️",base:56,rank:4,sub:4},
  {id:"layla",name:"Layla",role:"Atirador",icon:"🔫",base:45,rank:3,sub:2},
  {id:"balmond",name:"Balmond",role:"Lutador",icon:"🪓",base:48,rank:2,sub:1},
  {id:"nana",name:"Nana",role:"Mago",icon:"🐾",base:46,rank:3,sub:3}
];
const routes=[
  {id:1,name:"Floresta Inicial",enemy:"Lunox Beast",lvl:1,m:1},
  {id:2,name:"Ruínas Antigas",enemy:"Stone Golem",lvl:8,m:1.55},
  {id:3,name:"Vale Sombrio",enemy:"Shadow Fiend",lvl:18,m:2.35},
  {id:4,name:"Templo Celestial",enemy:"Celestial Guard",lvl:30,m:3.5},
  {id:5,name:"Abismo",enemy:"Abyss Lord",lvl:50,m:5.5}
];

function db(){ if(!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({users:{},guilds:{},chat:[],trades:[],battles:[]},null,2)); return JSON.parse(fs.readFileSync(DB));}
function saveDB(x){fs.writeFileSync(DB,JSON.stringify(x,null,2))}
function id(){return crypto.randomBytes(8).toString("hex")}
function hash(p){return crypto.createHash("sha256").update(p).digest("hex")}
function uid(){return id()}
function iv(){return 55+Math.floor(Math.random()*46)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function rankName(h){const r=ranks[h.rank]; return r.name+(r.sub!==undefined && r.subs[h.sub] ? " "+r.subs[h.sub] : "")}
function power(u){
  const bonus=(1+(u.up.weapon||0)*.12+(u.up.speed||0)*.05);
  return Math.floor(u.heroes.reduce((a,h)=>a+h.base*h.level*ranks[h.rank].mult*(.75+h.iv/400)*(1+(u.gems||0)*.05),0)*bonus);
}
function publicUser(u){return {id:u.id,name:u.name,power:power(u),heroes:u.heroes.map(h=>({id:h.uid,name:h.name,role:h.role,icon:h.icon,rank:rankName(h),iv:h.iv,level:h.level,power:Math.floor(h.base*h.level*ranks[h.rank].mult*(.75+h.iv/400))})),guild:u.guild||null, wins:u.wins||0, losses:u.losses||0}}
function starter(){
  const heroes=seeds.slice(0,5).map(h=>({...clone(h),uid:uid(),iv:iv(),level:1}));
  return {gold:250,gems:0,route:1,kills:0,heroes,boxes:[],up:{weapon:0,armor:0,speed:0},wins:0,losses:0,last:Date.now(),guild:null};
}
function auth(req){
  const token=(req.headers.authorization||"").replace("Bearer ","");
  const d=db(); const u=Object.values(d.users).find(x=>x.token===token);
  return u;
}
function body(req){return new Promise((res,rej)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{res(s?JSON.parse(s):{})}catch(e){rej(e)}})})}
function send(res,status,obj){res.writeHead(status,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});res.end(JSON.stringify(obj))}
function file(res,p){fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);return res.end("404")}res.writeHead(200,{"Content-Type":p.endsWith(".html")?"text/html":p.endsWith(".js")?"application/javascript":"text/css"});res.end(b)})}

async function api(req,res){
  const url=new URL(req.url,"http://localhost");
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization"});return res.end()}
  try{
    if(url.pathname==="/api/register" && req.method==="POST"){
      const b=await body(req); const d=db();
      if(!b.name||!b.password||b.password.length<4)return send(res,400,{error:"Nome e senha obrigatórios (senha mínima: 4)."});
      if(Object.values(d.users).some(u=>u.name.toLowerCase()===b.name.toLowerCase()))return send(res,409,{error:"Nome já existe."});
      const u={id:id(),name:b.name.trim().slice(0,20),password:hash(b.password),token:id(),...starter()};
      d.users[u.id]=u;saveDB(d);return send(res,200,{token:u.token,user:publicUser(u),state:u});
    }
    if(url.pathname==="/api/login" && req.method==="POST"){
      const b=await body(req);const d=db();const u=Object.values(d.users).find(x=>x.name.toLowerCase()===String(b.name).toLowerCase()&&x.password===hash(String(b.password)));
      if(!u)return send(res,401,{error:"Login inválido."});u.token=id();saveDB(d);return send(res,200,{token:u.token,user:publicUser(u),state:u});
    }
    const u=auth(req); if(!u)return send(res,401,{error:"Não autenticado."});
    const d=db();

    if(url.pathname==="/api/state"&&req.method==="GET"){
      const now=Date.now(), sec=Math.min(8*3600,Math.max(0,(now-u.last)/1000));
      if(sec>2){u.gold+=Math.floor(power(u)*sec*.22);u.last=now;saveDB(d)}
      return send(res,200,{state:u,user:publicUser(u)});
    }
    if(url.pathname==="/api/save"&&req.method==="POST"){
      const b=await body(req); if(b.state){Object.assign(u,b.state);u.id=u.id||id();u.name=u.name||"Player";u.password=u.password||hash("x");u.token=u.token||id();u.last=Date.now();saveDB(d)}
      return send(res,200,{ok:true,user:publicUser(u),state:u});
    }
    if(url.pathname==="/api/hunt"&&req.method==="POST"){
      const r=routes[u.route-1]||routes[0];const lead=u.heroes[0];
      const dmg=Math.max(1,Math.floor(power(u)*.08)); const hp=r.lvl*120;
      let kills=Math.max(1,Math.floor(dmg/hp));
      const gold=Math.floor(kills*(18*u.route+power(u)*.008)*r.m);
      u.kills+=kills;u.gold+=gold;u.last=Date.now();
      let capture=null;
      if(Math.random()<Math.min(.45,.12+kills*.01)){
        const cand=clone(seeds[Math.floor(Math.random()*seeds.length)]);cand.uid=uid();cand.iv=iv();cand.level=1;
        if(Math.random()<captureChance[cand.rank]){u.boxes.push(cand);capture={hero:cand,chance:captureChance[cand.rank],success:true}}
        else capture={hero:cand,chance:captureChance[cand.rank],success:false};
      }
      saveDB(d);return send(res,200,{state:u,capture,gold,kills});
    }
    if(url.pathname==="/api/use-capture"&&req.method==="POST"){
      const b=await body(req);const idx=Number(b.index);if(!u.boxes[idx])return send(res,400,{error:"Captura inexistente."});
      const slot=Math.max(0,Math.min(u.heroes.length-1,Number(b.slot)||0));const old=u.heroes[slot],nw=u.boxes.splice(idx,1)[0];u.boxes.push(old);u.heroes[slot]=nw;saveDB(d);return send(res,200,{state:u});
    }
    if(url.pathname==="/api/pvp"&&req.method==="POST"){
      const b=await body(req);const target=d.users[b.targetId];
      if(!target||target.id===u.id)return send(res,400,{error:"Alvo inválido."});
      const a=power(u),z=power(target);const win=a>=z ? Math.random()<.75 : Math.random()<.25;
      if(win){u.wins=(u.wins||0)+1;u.gold+=Math.floor(100+z*.05)}else{u.losses=(u.losses||0)+1}
      target.last=Date.now();d.battles.unshift({id:id(),at:Date.now(),attacker:u.name,defender:target.name,win,ap:a,dp:z});
      d.battles=d.battles.slice(0,1000);saveDB(d);
      return send(res,200,{win,attacker:publicUser(u),defender:publicUser(target)});
    }
    if(url.pathname==="/api/ranking"&&req.method==="GET"){
      return send(res,200,{players:Object.values(d.users).map(publicUser).sort((a,b)=>b.power-a.power).slice(0,100),battles:d.battles.slice(0,30)});
    }
    if(url.pathname==="/api/profile"&&req.method==="GET"){
      const target=d.users[url.searchParams.get("id")]; if(!target)return send(res,404,{error:"Jogador não encontrado."}); return send(res,200,{user:publicUser(target)});
    }
    if(url.pathname==="/api/friend"&&req.method==="POST"){
      const b=await body(req);const t=d.users[b.targetId];if(!t)return send(res,404,{error:"Jogador não encontrado."});
      u.friends=u.friends||[];if(!u.friends.includes(t.id))u.friends.push(t.id);saveDB(d);return send(res,200,{ok:true});
    }
    if(url.pathname==="/api/trade"&&req.method==="POST"){
      const b=await body(req);const t=d.users[b.targetId];if(!t)return send(res,404,{error:"Jogador não encontrado."});
      const h=u.boxes.find(x=>x.uid===b.heroUid);if(!h)return send(res,400,{error:"Herói não está no Box."});
      const tr={id:id(),from:u.id,to:t.id,hero:h,status:"pending",created:Date.now()};d.trades.push(tr);saveDB(d);return send(res,200,{trade:tr});
    }
    if(url.pathname==="/api/trades"&&req.method==="GET"){
      return send(res,200,{trades:d.trades.filter(x=>x.from===u.id||x.to===u.id).map(x=>({...x,fromName:d.users[x.from]?.name,toName:d.users[x.to]?.name}))});
    }
    if(url.pathname==="/api/trade/accept"&&req.method==="POST"){
      const b=await body(req);const tr=d.trades.find(x=>x.id===b.tradeId&&x.to===u.id&&x.status==="pending");if(!tr)return send(res,400,{error:"Troca inválida."});
      const from=d.users[tr.from];const idx=from.boxes.findIndex(x=>x.uid===tr.hero.uid);if(idx<0)return send(res,400,{error:"Herói não está mais disponível."});
      const hero=from.boxes.splice(idx,1)[0];u.boxes.push(hero);tr.status="accepted";saveDB(d);return send(res,200,{ok:true,state:u});
    }
    if(url.pathname==="/api/guild/create"&&req.method==="POST"){
      const b=await body(req);if(u.guild)return send(res,400,{error:"Você já está em uma guilda."});
      const g={id:id(),name:String(b.name||"Guilda").slice(0,24),owner:u.id,members:[u.id]};d.guilds[g.id]=g;u.guild=g.id;saveDB(d);return send(res,200,{guild:g});
    }
    if(url.pathname==="/api/guild/join"&&req.method==="POST"){
      const b=await body(req);const g=d.guilds[b.guildId];if(!g)return send(res,404,{error:"Guilda não encontrada."});if(u.guild)return send(res,400,{error:"Você já está em uma guilda."});
      g.members.push(u.id);u.guild=g.id;saveDB(d);return send(res,200,{guild:g});
    }
    if(url.pathname==="/api/guilds"&&req.method==="GET"){
      return send(res,200,{guilds:Object.values(d.guilds).map(g=>({id:g.id,name:g.name,members:g.members.length,power:g.members.reduce((a,id)=>a+(d.users[id]?power(d.users[id]):0),0)})).sort((a,b)=>b.power-a.power)});
    }
    if(url.pathname==="/api/chat"&&req.method==="GET")return send(res,200,{messages:d.chat.slice(-80)});
    if(url.pathname==="/api/chat"&&req.method==="POST"){
      const b=await body(req);const msg={id:id(),user:u.name,text:String(b.text||"").slice(0,240),at:Date.now()};d.chat.push(msg);d.chat=d.chat.slice(-500);saveDB(d);return send(res,200,{message:msg});
    }
    return send(res,404,{error:"Rota não encontrada."});
  }catch(e){console.error(e);return send(res,500,{error:"Erro interno do servidor."})}
}

const server=http.createServer((req,res)=>{
  if(req.url.startsWith("/api/")) return api(req,res);
  let p=path.join(PUBLIC,req.url===" /"?"index.html":(req.url==="/"?"index.html":req.url));
  if(!p.startsWith(PUBLIC))return res.writeHead(403).end();
  if(!path.extname(p))p=path.join(PUBLIC,"index.html");
  file(res,p);
});
server.listen(PORT,()=>console.log(`ML Idle Project V0.6 em http://localhost:${PORT}`));
