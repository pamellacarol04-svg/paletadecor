'use strict';
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = value => /^#[0-9a-f]{6}$/i.test(value);
const initial = ['#EAD8D5','#D8C9E8','#D6E2D5','#E8DCC9','#A78F98'];
const styles = ['Pastel','Terrosa','Vibrante','Neutra','Romântica','Elegante','Minimalista','Vintage','Monocromática'];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem('atelier.'+key)) ?? fallback; } catch { return fallback; } };
function persist(key, value) {
  try { localStorage.setItem('atelier.'+key, JSON.stringify(value)); return true; }
  catch { notice('O navegador não conseguiu salvar.'); return false; }
}
let collection = read('collection', []);
let folders = read('folders', []);
let activeFolder = '';
let onlyFavorites = false;
let search = '', sort = 'original';
let gen = {name:'Paleta do ateliê',colors:initial.map(hex=>({hex,locked:false})),style:'Pastel'};
let undo = [], redo = [];
let extraction = {src:'',colors:[],count:5};
const notionRoles = ['Fundo','Destaque','Títulos','Texto','Elementos decorativos','Complementar'];
const brandRoles = ['Primária','Secundária','Destaque','Fundo','Superfície','Texto','Neutra'];
const notionTemplate = {font:'Cormorant Garamond',fontSize:44,titleSize:42,angle:110,share:50,name:'Meu espaço de estudos',theme:'Medical Student',cover:'Gradiente',width:1500,height:600,colors:['#FAF6F4','#D8C9E8','#654E63','#403936','#D6E2D5','#EAD8D5']};
const legacyNotion = read('notion',null);
let notionProjects = read('notion-projects',legacyNotion
  ?{active:'original',items:[{id:'original',draft:{...notionTemplate,...legacyNotion}}]}
  :{active:null,items:[]});
let notion = structuredClone(notionProjects.items.find(item=>item.id===notionProjects.active)?.draft??notionProjects.draft??notionTemplate);

const brandTemplate = {name:'Maison Amélie',segment:'Estúdio criativo',style:'Elegante',personality:'Acolhedora',favorite:'#A78F98',avoid:'#FF0000',font:'Editorial',colors:['#684D5B','#EAD8D5','#D8C9E8','#FAF6F4','#E8DCC9','#403936','#A78F98']};
const legacyBrand = read('brand',null);
let brandProjects = read('brand-projects',legacyBrand?{active:'original',items:[{id:'original',draft:legacyBrand}]}:{active:null,items:[]});
let activeBrandId = brandProjects.active;
let brand = structuredClone(brandProjects.items.find(item=>item.id===activeBrandId)?.draft??brandTemplate);
let brandBaseline = JSON.stringify(brand);

const notionThemes = ['Study Aesthetic','Medical Student','Cozy Workspace','Pink Workspace','Lavender Dreams','Sage Green','Neutral Workspace','Academic Planner','Minimal Dashboard','Soft Productivity','Vintage Notes','Romantic Academia'];
const notionFonts = ['Cormorant Garamond','DM Sans','Instrument Serif','Playfair Display','Lora','Inter','Georgia','Courier New'];

const themeControl = document.querySelector('#site-tone');
const savedTone = read('tone','lavanda');
themeControl.value = Array.from(themeControl.options).some(option=>option.value===savedTone) ? savedTone : 'lavanda';
document.documentElement.dataset.tone = themeControl.value;
themeControl.addEventListener('change',()=>{
  document.documentElement.dataset.tone = themeControl.value;
  persist('tone',themeControl.value);
});
const fontPairs = {Editorial:['Cormorant Garamond','DM Sans'],Minimalista:['DM Sans','DM Sans'],Clássica:['Georgia','DM Sans']};
const rgb = h => h.slice(1).match(/../g).map(x=>parseInt(x,16));
function hsl(h,s,l) {
  const a=s*Math.min(l,1-l);
  return '#'+[0,8,4].map(n=>{
    const k=(n+h/30)%12;
    return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');
  }).join('').toUpperCase();
}
function toHsl(color) {
  const [r,g,b]=rgb(color).map(v=>v/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2;
  const h=d===0?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return [h*60,d===0?0:d/(1-Math.abs(2*l-1)),l];
}
function luminance(c){ return rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0); }
function contrast(a,b){const levels=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (levels[0]+.05)/(levels[1]+.05);}
const ink = c => contrast(c,'#241B20')>=contrast(c,'#FFFFFF')?'#241B20':'#FFFFFF';
const css = (color,key='swatch') => '--'+key+':'+color;
const variants = {
  Pastel:[.32,.82,19], Terrosa:[.33,.62,13], Vibrante:[.76,.53,28], Neutra:[.12,.72,10], Romântica:[.39,.78,9],
  Elegante:[.26,.67,17], Minimalista:[.17,.78,7], Vintage:[.28,.64,22], Monocromática:[.43,.63,0]
};
function generate(count,style,base=Math.random()*360){
  const [s,l,step]=variants[style] ?? variants.Pastel;
  return Array.from({length:count},(_,i)=>hsl((base+360+i*step+(step?Math.random()*8:0))%360,s,Math.min(.96,Math.max(.19,l+((i%5)-2)*.065+(Math.random()-.5)*.065))));
}
const route = ()=>location.hash.slice(1).split('?')[0]||'inicio';
const opts=(values,current)=>values.map(v=>'<option'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('');
const btn=(label,action,value='',kind='')=>'<button type="button" class="'+kind+'" data-action="'+action+'" data-value="'+esc(value)+'">'+label+'</button>';
const link=(label,path,kind='')=>'<a class="btn '+kind+'" href="#'+path+'">'+label+'</a>';
const intro=(title,sub)=>'<section class="intro"><p class="eyebrow">Color Atelier</p><h1>'+title+'</h1><p>'+sub+'</p></section>';
const stripes=(colors,interactive=true)=>'<div class="stripes">'+colors.map(c=>interactive?'<button type="button" data-action="copy" data-value="'+c+'" style="'+css(c)+'" title="Copiar '+c+'" aria-label="Copiar '+c+'"></button>':'<span style="'+css(c)+'"></span>').join('')+'</div>';
function card(p) {
  const favorite=p.favorite;
  return '<article class="card">'+stripes(p.colors)+'<h3>'+esc(p.name)+'</h3><p>'+esc([p.style,p.family,p.kind,p.colors.length+' cores'].filter(Boolean).join(' · '))+'</p><p class="card-hex">'+p.colors.join(' · ')+'</p><div class="actions">'+
    btn(favorite?'♥':'♡','favorite',p.id)+btn('Copiar','copy',p.colors.join(' '))+btn('Editar','open',p.id)+btn('Renomear','rename',p.id)+btn('Duplicar','duplicate',p.id)+btn('Excluir','delete',p.id)+(folders.length?'<select aria-label="Coleção de '+esc(p.name)+'" data-folder-id="'+esc(p.id)+'">'+opts(['Sem coleção',...folders],p.folder||'Sem coleção')+'</select>':'')+'</div></article>';
}
function home(){
  return '<section class="hero"><div><div class="eyebrow">Estúdio digital de cores</div><h1>Toda ideia merece uma <em>paleta especial.</em></h1><p>Descubra combinações de cores, organize suas inspirações e dê forma às suas ideias no Notion e na sua marca.</p><div class="actions">'+link('Criar minha paleta','gerador','primary')+link('Minha biblioteca','biblioteca')+'</div></div><div class="hero-art" aria-hidden="true"><span class="spark">✧</span><span class="spark small">✦</span><div class="art-card"><div class="art-inner">'+stripes(initial,false)+'<strong>Jardim de Seda</strong></div></div></div></section>'+
    '<section class="section"><div class="section-head"><h2>Estúdios criativos</h2></div><div class="studio-links"><a class="studio-link" href="#notion"><span>↗</span><h3>Notion Studio</h3><p>Experimente cores no seu espaço e crie uma capa.</p></a><a class="studio-link" href="#brand"><span>↗</span><h3>Brand Studio</h3><p>Crie a paleta da marca e teste suas aplicações.</p></a></div></section>'+
    (collection.length?'<section class="section"><div class="section-head"><h2>Paletas recentes</h2><a href="#biblioteca">Ver todas</a></div><div class="grid">'+collection.slice(-3).reverse().map(card).join('')+'</div></section>':'')+
    '<section class="section toolbar">'+link('Harmonias','harmonias')+link('Extrair cores de imagem','extrair')+link('Ferramentas de cor','ferramentas')+'</section>';
}
function libraryCards(){
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const items=collection.filter(p=>
    (!query||[p.name,p.style,p.family,p.theme,...p.colors].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(query))&&
    (!activeFolder||p.folder===activeFolder)&&(!onlyFavorites||p.favorite));
  if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  if(sort==='favorites')items.sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite));
  if(sort==='recent')items.reverse();
  if(!collection.length)return '<div class="empty"><p>Você ainda não tem paletas salvas.</p>'+link('Criar uma paleta','gerador','primary')+'</div>';
  return items.length?'<p class="small-note">'+items.length+' '+(items.length===1?'paleta':'paletas')+'</p><div class="grid">'+items.map(card).join('')+'</div>':'<p class="empty">Nenhuma paleta encontrada.</p>';
}
function browse(){
  return intro('Minha biblioteca','Acesse suas paletas, favoritas e coleções deste navegador.')+
    '<div class="toolbar"><input id="search" type="search" placeholder="Buscar nome, cor ou HEX" aria-label="Buscar paletas" value="'+esc(search)+'">'+
    '<select id="folder" aria-label="Filtrar por coleção"><option value="">Todas as coleções</option>'+opts(folders,activeFolder)+'</select><label><input type="checkbox" id="favorites" '+(onlyFavorites?'checked':'')+'> Favoritas</label>'+
    '<select id="sort" aria-label="Ordenar paletas"><option value="original">Ordem original</option><option value="name" '+(sort==='name'?'selected':'')+'>Nome</option><option value="favorites" '+(sort==='favorites'?'selected':'')+'>Favoritas primeiro</option><option value="recent" '+(sort==='recent'?'selected':'')+'>Mais recentes</option></select>'+
    btn('Criar coleção','folder-new')+btn('Exportar backup','backup')+'<label class="btn">Importar JSON <input type="file" id="import" accept=".json,application/json" style="max-width:175px"></label></div><div id="results">'+libraryCards()+'</div>';
}
function generator(){
  return intro('Gerador de paletas','Gere combinações harmoniosas, bloqueie suas cores favoritas e edite cada amostra.')+
    '<div class="toolbar"><input id="palette-name" aria-label="Nome da paleta" value="'+esc(gen.name)+'" maxlength="80"><select id="gen-style" aria-label="Estilo da paleta">'+opts(styles,gen.style)+'</select>'+btn('Gerar paleta','generate','','primary')+btn('Adicionar cor','add')+btn('Desfazer','undo')+btn('Refazer','redo')+'</div>'+
    '<div class="swatches">'+gen.colors.map((c,i)=>'<div class="swatch" style="'+css(c.hex)+';--foreground:'+ink(c.hex)+'" draggable="true" data-index="'+i+'"><input type="color" data-gen-color="'+i+'" aria-label="Editar cor '+(i+1)+'" value="'+c.hex+'">'+btn(c.hex,'copy',c.hex,'copy')+btn(c.locked?'Desbloquear':'Bloquear','lock',i)+'<div class="actions">'+btn('←','move-left',i)+btn('→','move-right',i)+btn('×','remove',i)+'</div></div>').join('')+'</div>'+
    '<div class="toolbar"><select id="color-format" aria-label="Formato para copiar">'+opts(['HEX','RGB','HSL'],'HEX')+'</select>'+btn('Copiar paleta','copy-gen')+btn('Salvar paleta','save-gen','','primary')+btn('Compartilhar link','share')+
    '<select id="gen-export" aria-label="Formato de exportação">'+opts(['PNG','SVG','PDF','JSON','CSS','Tailwind','HEX'],'PNG')+'</select>'+btn('Exportar','export-gen')+btn('Usar no Notion Studio','send-notion')+btn('Usar no Brand Studio','send-brand')+'</div>'+
    '<p class="small-note">Use Espaço para gerar. Arraste as amostras ou use as setas para mudar a ordem.</p>';
}
function field(label,key,value,type='text'){
  return '<label>'+label+(Array.isArray(type)?'<select data-field="'+key+'">'+opts(type,value)+'</select>':'<input type="'+type+'" data-field="'+key+'" value="'+esc(value)+'" '+(type==='number'?'min="200" max="3000"':'maxlength="100"')+'>')+'</label>';
}
function brandProjectPanel(){
  const project = brandProjects.items.find(item=>item.id===activeBrandId);
  return '<fieldset class="appearance brand-projects"><legend>Projetos de marca</legend>'+
    '<label>Projetos salvos <select id="brand-project" aria-label="Projetos de marca salvos"><option value="">Selecione um projeto</option>'+
    brandProjects.items.map(({id,draft})=>'<option value="'+esc(id)+'" '+(id===activeBrandId?'selected':'')+'>'+esc(draft.name||'Marca sem nome')+'</option>').join('')+'</select></label>'+
    '<div class="actions">'+btn('Novo projeto','project-new')+(project?btn('Duplicar projeto','project-duplicate')+btn('Excluir projeto','project-delete'):'')+'</div></fieldset>';
}
function canLeaveBrand(){
  return JSON.stringify(brand)===brandBaseline||confirm('Descartar as alterações ainda não salvas neste projeto?');
}
function switchBrand(projectId,draft){
  activeBrandId=projectId;
  brand=structuredClone(draft);
  brandBaseline=JSON.stringify(brand);
  render();
}
function storeBrandProjects(active,items){
  const next={active,items};
  if(!persist('brand-projects',next))return false;
  brandProjects=next;
  return true;
}
function saveBrandProject(duplicate=false){
  const projectId=duplicate||!activeBrandId?id():activeBrandId;
  const draft=structuredClone(brand);
  draft.name=draft.name.trim()||'Marca sem nome';
  if(duplicate)draft.name=(draft.name.slice(0,92)+' (cópia)');
  const item={id:projectId,draft};
  const items=brandProjects.items.some(p=>p.id===projectId)
    ?brandProjects.items.map(p=>p.id===projectId?item:p)
    :[...brandProjects.items,item];
  if(storeBrandProjects(projectId,items)){
    switchBrand(projectId,draft);
    notice(duplicate?'Projeto duplicado.':'Projeto salvo neste navegador.');
  }
}
function notionProjectPanel(){
  const {active,items}=notionProjects;
  return '<fieldset class="appearance brand-projects"><legend>Projetos do Notion</legend>'+
    '<label>Projetos salvos <select id="notion-project"><option value="">Selecione um projeto</option>'+
    items.map(({id,draft})=>'<option value="'+esc(id)+'" '+(id===active?'selected':'')+'>'+esc(draft.name||'Página sem título')+'</option>').join('')+'</select></label>'+
    '<div class="actions">'+btn('Novo projeto','notion-new')+btn('Salvar projeto','notion-project-save')+
    (active?btn('Duplicar projeto','notion-duplicate')+btn('Excluir projeto','notion-delete'):'')+'</div>'+
    '<p class="small-note">As alterações ficam salvas neste navegador.</p></fieldset>';
}
function writeNotion(active,items,draft){
  const next={active,items,draft:active?null:structuredClone(draft)};
  if(!persist('notion-projects',next))return false;
  notionProjects=next;
  return true;
}
function saveNotionDraft(){
  const {active,items}=notionProjects;
  const updated=active?items.map(item=>item.id===active?{id:active,draft:structuredClone(notion)}:item):items;
  return writeNotion(active,updated,notion);
}
function openNotion(active,items,draft){
  if(!writeNotion(active,items,draft))return;
  notion=structuredClone(draft);
  render();
  return true;
}
function saveNotionProject(duplicate=false){
  const active=duplicate||!notionProjects.active?id():notionProjects.active;
  const draft=structuredClone(notion);
  draft.name=draft.name.trim()||'Página sem título';
  if(duplicate)draft.name=draft.name.slice(0,92)+' (cópia)';
  const item={id:active,draft};
  const items=notionProjects.items.some(project=>project.id===active)
    ?notionProjects.items.map(project=>project.id===active?item:project)
    :[...notionProjects.items,item];
  if(openNotion(active,items,draft))notice(duplicate?'Projeto duplicado.':'Projeto salvo.');
}
function studio(isBrand){
  const s=isBrand?brand:notion, roles=isBrand?brandRoles:notionRoles;
  return intro(isBrand?'Brand Studio':'Notion Studio',isBrand?'Defina as cores da sua marca, teste a tipografia e baixe um mini brand book.':'Planeje as cores do seu espaço e crie uma capa personalizada.')+
  '<div class="studio"><section class="panel">'+(isBrand?brandProjectPanel():notionProjectPanel())+'<div class="form-grid">'+
  (isBrand?field('Nome da marca','name',s.name)+field('Segmento','segment',s.segment)+field('Estilo','style',s.style,styles)+field('Personalidade','personality',s.personality,['Acolhedora','Sofisticada','Criativa','Serena','Ousada'])+field('Cor favorita','favorite',s.favorite,'color')+field('Cor a evitar','avoid',s.avoid,'color')+field('Tipografia','font',s.font,Object.keys(fontPairs)):
    field('Título da página e da capa','name',s.name)+field('Inspiração','theme',s.theme,notionThemes)+field('Estilo da capa','cover',s.cover,['Sólida','Gradiente','Geométrica','Padrão'])+field('Largura da capa em px','width',s.width,'number')+field('Altura da capa em px','height',s.height,'number'))+
  '</div>'+(!isBrand?notionAppearance():'')+'<div class="toolbar">'+btn('Gerar cores',isBrand?'generate-brand':'generate-notion','','primary')+btn('Copiar HEX','copy',s.colors.join(' '))+btn('Salvar paleta',isBrand?'save-brand':'save-notion')+'</div>'+
  roles.map((name,i)=>'<div class="role"><input type="color" aria-label="'+name+'" data-role="'+i+'" value="'+s.colors[i]+'"><span>'+name+'</span>'+btn(s.colors[i],'copy',s.colors[i])+'</div>').join('')+
  '<div class="toolbar section">'+(isBrand?btn('Salvar projeto','project-save')+btn('Baixar guia PNG','guide-png')+btn('Baixar guia PDF','guide-pdf'):btn('Baixar capa PNG','cover-png')+btn('Baixar paleta PNG','notion-png'))+'</div>'+
  (isBrand?'<p class="small-note">Seus projetos salvos ficam disponíveis neste navegador.</p>':'<p class="small-note">Prévia visual. Use o PNG como capa. As cores dos componentes nativos seguem as opções do Notion.</p>')+
  '</section><div id="preview">'+(isBrand?brandPreview():notionPreview())+'</div></div>';
}
function notionAppearance(){
  return '<fieldset class="appearance"><legend>Tipografia</legend><div class="form-grid">'+
    field('Fonte dos títulos','font',notion.font,notionFonts)+
    '<label>Tamanho na capa (px)<input type="number" data-field="fontSize" min="12" max="160" value="'+notion.fontSize+'"></label><label>Tamanho na página (px)<input type="number" data-field="titleSize" min="12" max="100" value="'+notion.titleSize+'"></label></div></fieldset>'+
    '<fieldset class="appearance" id="gradient-options" '+(notion.cover==='Gradiente'?'':'hidden')+'><legend>Gradiente da capa</legend>'+
    '<label>Ângulo <output id="angle-value">'+notion.angle+'°</output><input type="range" data-field="angle" min="0" max="360" value="'+notion.angle+'"></label>'+
    '<label>Distribuição das cores <output id="share-value">Destaque '+notion.share+'% · Complementar '+(100-notion.share)+'%</output><input type="range" data-field="share" min="0" max="100" value="'+notion.share+'"></label></fieldset>';
}
function coverStops(s){
  const [,a,,,,b]=s.colors;
  const share=s.share/100;
  if(share===0||share===1){const solid=share===0?b:a;return [[0,solid],[1,solid]];}
  const transition=Math.min(.35,share,1-share);
  return [[0,a],[share-transition,a],[share+transition,b],[1,b]];
}
function coverBg(s){
  const [,a,,,,b]=s.colors;
  return {Sólida:a,Gradiente:'linear-gradient('+s.angle+'deg in srgb, '+coverStops(s).map(([point,color])=>color+' '+point*100+'%').join(', ')+')',Geométrica:'linear-gradient(138deg,'+a+' 56%,'+b+' 56%)',Padrão:'repeating-linear-gradient(135deg,'+a+' 0 24px,'+b+' 24px 26px)'}[s.cover];
}
function notionPreview(){
  const [bg,cover,title,text,detail,surface]=notion.colors;
  return '<section aria-label="Prévia do Notion" class="preview" style="--bg:'+bg+';--cover:'+coverBg(notion)+';--notion-font:'+notion.font+';--notion-size:'+notion.fontSize+'px;--notion-title-size:'+notion.titleSize+'px;--cover-ink:'+ink(cover)+';--title:'+title+';--text:'+text+';--detail:'+detail+';--detail-ink:'+ink(detail)+';--surface:'+surface+';--surface-ink:'+ink(surface)+'"><div class="cover">'+esc(notion.name)+'</div><div class="document"><div class="notion-icon" aria-hidden="true">✦</div><h2>'+esc(notion.name||'Minha página')+'</h2><p>Planejamento e anotações da semana</p><div class="callout">✧ Reserve um tempo para revisar suas prioridades.</div><hr><h3>Esta semana</h3><label><input type="checkbox"> Revisar anotações</label><br><label><input type="checkbox"> Planejar a próxima sessão</label><table><thead><tr><th>Atividade</th><th>Status</th></tr></thead><tbody><tr><td>Revisão de conteúdos</td><td><span class="tag">Em andamento</span></td></tr><tr><td>Organizar materiais</td><td><span class="tag">Planejado</span></td></tr></tbody></table></div></section>';
}
function brandPreview(){
  const [primary,secondary,highlight,bg,surface,text,neutral]=brand.colors;
  const name=esc(brand.name||'Minha marca'), segment=esc(brand.segment);
  return '<div class="preview" style="--bg:'+bg+';--text:'+text+';--surface:'+surface+';--primary:'+primary+';--primary-ink:'+ink(primary)+';--secondary:'+secondary+';--secondary-ink:'+ink(secondary)+';--highlight:'+highlight+';--highlight-ink:'+ink(highlight)+';--neutral:'+neutral+';--brand-font:'+fontPairs[brand.font][0]+',serif"><div class="brand-show"><section class="brand-web"><small>Site</small><h2>'+name+'</h2><p>'+segment+'</p><span class="mock-button">Conheça a marca</span></section><section class="brand-card"><small>Cartão de visita</small><strong>'+name+'</strong><span>'+segment+'</span></section><section class="brand-post"><small>Redes sociais</small><strong>'+name+'</strong><span>'+esc(brand.personality)+'</span></section><section class="brand-letter"><small>Papel timbrado</small><strong>'+name+'</strong></section></div></div><p class="small-note">Contraste do texto sobre o fundo · '+contrast(bg,text).toFixed(2)+':1 · '+(contrast(bg,text)>=4.5?'Atende AA para texto comum':'Abaixo de AA para texto comum')+'</p>';
}
const harmonyOffsets={'Complementar':[0,180],'Análoga':[-30,0,30],'Triádica':[0,120,240],'Tetrádica':[0,90,180,270],'Complementar dividida':[0,150,210],'Monocromática':[0,0,0,0,0]};
const harmony={base:'#A78F98',type:'Análoga',s:null,l:null};
const toolsState={a:'#403936',b:'#F8F4F0',mode:'Linear',angle:100,
  stops:[{color:'#D8C9E8',at:0},{color:'#EAD8D5',at:100}],converter:'#A78F98',format:'HEX',scale:'#A78F98'};
function harmonyColors(){const [h,s,l]=toHsl(harmony.base);return harmonyOffsets[harmony.type].map((offset,i)=>hsl((h+offset+360)%360,harmony.s??s,harmony.type==='Monocromática'?Math.max(.05,Math.min(.95,(harmony.l??l)+(i-2)*.16)):harmony.l??l));}
function harmonies(){return intro('Harmonias cromáticas','Escolha uma cor-base e explore suas relações no círculo cromático.')+'<div class="tool-grid"><section class="panel"><div class="wheel" role="img" aria-label="Círculo cromático"></div><div class="toolbar"><label>Cor-base <input type="color" id="h-base" value="'+harmony.base+'"></label><select id="h-type" aria-label="Tipo de harmonia">'+opts(Object.keys(harmonyOffsets),harmony.type)+'</select></div><label>Saturação <input id="h-sat" type="range" min="0" max="100" value="'+Math.round((harmony.s??toHsl(harmony.base)[1])*100)+'"></label><br><label>Luminosidade <input id="h-light" type="range" min="5" max="95" value="'+Math.round((harmony.l??toHsl(harmony.base)[2])*100)+'"></label></section><section class="panel" id="h-result">'+harmonyResult()+'</section></div>';}
function harmonyResult(){const c=harmonyColors();return stripes(c)+'<p>'+c.join(' · ')+'</p><div class="actions">'+btn('Copiar HEX','copy',c.join(' '))+btn('Abrir no gerador','open-harmony','','primary')+'</div>';}
function extract(){return intro('Extrair cores de imagem','Selecione uma imagem JPG, PNG ou WebP e obtenha uma paleta a partir das cores predominantes.')+'<section class="panel"><div class="toolbar"><input type="file" id="image-input" aria-label="Escolher imagem" accept="image/jpeg,image/png,image/webp"><label>Número de cores <select id="image-count">'+opts(['3','4','5','6','7','8','9','10'],String(extraction.count))+'</select></label></div>'+(extraction.src?'<p class="small-note">Clique na imagem para adicionar a cor de um ponto.</p><img class="extract-img" id="image-preview" src="'+esc(extraction.src)+'" alt="Imagem selecionada para extrair cores">':'')+'<div id="image-result">'+imageResult()+'</div></section>';}
function imageResult(){return extraction.colors.length?stripes(extraction.colors)+'<p>'+extraction.colors.join(' · ')+'</p><div class="actions">'+btn('Abrir no gerador','open-image','','primary')+btn('Usar no Notion Studio','image-notion')+btn('Usar no Brand Studio','image-brand')+'</div>':'';}
function formatColor(c,type){const [h,s,l]=toHsl(c);return type==='RGB'?'rgb('+rgb(c).join(', ')+')':type==='HSL'?'hsl('+Math.round(h)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%)':c;}
function rgbHex(values){
  return '#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function parseColor(value,format){
  const raw=value.trim();
  if(format==='HEX'){
    let code=raw.replace(/^#/,'');
    if(/^[a-f0-9]{3}$/i.test(code))code=[...code].map(c=>c+c).join('');
    return hex('#'+code)?('#'+code).toUpperCase():null;
  }
  const wrapped=raw.match(/^([a-z]+)\(([^()]*)\)$/i);
  if(wrapped&&wrapped[1].toUpperCase()!==format)return null;
  const values=(wrapped?.[2]??raw).trim().split(/[,\s]+/);
  if(values.length!==3)return null;
  const numbers=values.map((v,i)=>{
    const match=v.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(%|deg|°)?$/);
    if(!match|| (format==='RGB'&&match[2]) || (format!=='RGB'&&(i===0?match[2]==='%':match[2]&&match[2]!=='%')))return NaN;
    return Number(match[1]);
  });
  if(!numbers.every(Number.isFinite))return null;
  if(format==='RGB')return numbers.every(n=>n>=0&&n<=255)?rgbHex(numbers):null;
  const [h,s,v]=numbers;
  if(s<0||s>100||v<0||v>100)return null;
  const hue=((h%360)+360)%360;
  if(format==='HSL')return hsl(hue,s/100,v/100);
  const light=v/100*(1-s/200);
  const sat=light===0||light===1?0:(v/100-light)/Math.min(light,1-light);
  return hsl(hue,sat,light);
}
function colorCode(color,format){
  if(format!=='HSV')return formatColor(color,format);
  const [h,s,l]=toHsl(color),v=l+s*Math.min(l,1-l);
  return 'hsv('+Math.round(h)+'°, '+Math.round((v===0?0:2*(1-l/v))*100)+'%, '+Math.round(v*100)+'%)';
}
function sortedStops(){return toolsState.stops.slice().sort((a,b)=>a.at-b.at);}
function grad(){
  const {mode,angle}=toolsState;
  return (mode==='Linear'?'linear-gradient('+angle+'deg in srgb, ':'radial-gradient(circle in srgb, ')+
    sortedStops().map(({color,at})=>color+' '+at+'%').join(', ')+')';
}
function converterResult(){
  const color=toolsState.converter;
  return '<div class="converter-sample" style="background:'+color+'"></div><div class="actions">'+
    ['HEX','RGB','HSL','HSV'].map(type=>{const v=colorCode(color,type);return btn(esc(v),'copy',v);}).join('')+'</div>';
}
function contrastResult(){
  const {a,b}=toolsState, ratio=contrast(a,b);
  const best=contrast('#000000',b)>=contrast('#FFFFFF',b)?'#000000':'#FFFFFF';
  const summary=ratio>=4.5?'Tem contraste suficiente para texto comum.':ratio>=3
    ?'Tem contraste suficiente apenas para texto grande.':'Tem contraste insuficiente até para texto grande.';
  const result=min=>ratio>=min?'Atende':'Abaixo do mínimo';
  return '<p class="callout" style="background:'+b+';color:'+a+'">Prévia de texto · '+ratio.toFixed(2).replace('.',',')+':1</p>'+
    '<p><strong>'+summary+'</strong></p>'+
    (ratio<4.5?'<p class="small-note">Para texto comum neste fundo, use '+(best==='#000000'?'preto':'branco')+' ('+best+'). Contraste de '+contrast(best,b).toFixed(2).replace('.',',')+':1.</p>':'')+
    '<details class="contrast-details"><summary>Como interpretar o contraste</summary>'+
    '<p>O número mede a diferença de luminosidade entre o texto e o fundo. Quanto maior, mais fácil distinguir o texto.</p>'+
    '<p>AA é o nível de acessibilidade mais usado. AAA exige mais contraste. Texto grande tem pelo menos 24 px, ou cerca de 19 px em negrito.</p>'+
    '<table><thead><tr><th scope="col">Nível</th><th scope="col">Texto comum</th><th scope="col">Texto grande</th></tr></thead>'+
    '<tbody><tr><th scope="row">AA</th><td>'+result(4.5)+' (mín. 4,5:1)</td><td>'+result(3)+' (mín. 3:1)</td></tr>'+
    '<tr><th scope="row">AAA</th><td>'+result(7)+' (mín. 7:1)</td><td>'+result(4.5)+' (mín. 4,5:1)</td></tr></tbody></table></details>';
}
const scaleLabels=[50,100,200,300,400,500,600,700,800,900,950];
function scaleColors(base,target){
  const channels=rgb(base);
  return scaleLabels.map((_,i)=>{
    const amount=.95*i/(scaleLabels.length-1);
    return pixelHex(channels.map(channel=>channel+(target-channel)*amount));
  });
}
function scaleGroup(title,base,target,labels,prefix){
  const scale=scaleColors(base,target);
  const samples=scale.map((color,i)=>{
    const label=i===0?labels[i]+' · Base':labels[i];
    return '<button type="button" data-action="copy" data-value="'+color+'" style="background:'+color+';color:'+ink(color)+'" title="Copiar '+color+'" aria-label="Copiar tom '+label+', '+color+'"><span>'+label+'</span><span>'+color+'</span></button>';
  }).join('');
  return '<section class="scale-group"><h3>'+title+'</h3><div class="scale-colors">'+samples+'</div><div class="actions">'+
    btn('Copiar todos os HEX','copy',scale.join(', '),'primary')+
    btn('Copiar escala CSS','copy',scale.map((color,i)=>prefix+labels[i]+': '+color+';').join('\n'))+'</div></section>';
}
function scaleResult(){
  const {scale}=toolsState;
  return scaleGroup('Clareando',scale,255,scaleLabels.slice().reverse(),'--tom-')+
    scaleGroup('Escurecendo',scale,0,scaleLabels,'--tom-escuro-');
}
function gradientRows(){
  return toolsState.stops.map(({color,at},i)=>'<div class="gradient-stop"><label>Cor '+(i+1)+' <input type="color" data-stop-color="'+i+'" value="'+color+'"></label>'+
    '<label>Posição (%) <input type="number" min="0" max="100" data-stop-at="'+i+'" value="'+at+'"></label>'+
    (toolsState.stops.length>2?btn('Remover','stop-remove',i):'')+'</div>').join('');
}
function gradientResult(){return '<div class="cover" style="--cover:'+grad()+'"></div><div class="actions">'+btn('Copiar CSS','copy',grad())+btn('Baixar PNG','gradient-png')+'</div>';}
const gradientPalette={start:'#D8C9E8',end:'#EAD8D5',count:5};
function interpolateColors(start,end,count){
  const first=rgb(start), last=rgb(end);
  return Array.from({length:count},(_,i)=>{
    const fraction=i/(count-1);
    return pixelHex(first.map((channel,j)=>channel+(last[j]-channel)*fraction));
  });
}
function gradientPaletteColors(){
  const {start,end,count}=gradientPalette;
  return interpolateColors(start,end,count);
}
function gradientPaletteResult(){
  const colors=gradientPaletteColors();
  return '<div class="gradient-palette-samples">'+colors.map(color=>
    '<button type="button" data-action="copy" data-value="'+color+'" style="background:'+color+';color:'+ink(color)+'" aria-label="Copiar '+color+'">'+color+'</button>'
  ).join('')+'</div><div class="actions">'+btn('Copiar todos os HEX','copy',colors.join(', '),'primary')+
    btn('Abrir no gerador','open-gradient-palette')+'</div>';
}
function gradientPalettePanel(){
  return '<section class="panel gradient-palette-panel"><h2>Paleta em gradiente</h2><p>Escolha duas cores para gerar os tons intermediários.</p>'+
    '<div class="toolbar"><label>Cor inicial <input type="color" data-palette-gradient="start" value="'+gradientPalette.start+'"></label>'+
    '<label>Cor final <input type="color" data-palette-gradient="end" value="'+gradientPalette.end+'"></label>'+
    '<label>Número de cores <select data-palette-gradient="count">'+opts(['2','3','4','5','6','7','8','9','10'],String(gradientPalette.count))+'</select></label></div>'+
    '<div id="gradient-palette-result">'+gradientPaletteResult()+'</div></section>';
}
function colorTools(){
  const {a,b,mode,angle,format,scale}=toolsState;
  return intro('Ferramentas de cor','Confira contraste, converta códigos e crie escalas e gradientes.')+
    '<div class="toolbar">'+link('Harmonias','harmonias')+link('Extrair cores de imagem','extrair')+'</div>'+
    '<div class="tool-grid"><section class="panel"><h2>Conversor</h2><div class="toolbar"><select id="converter-format" aria-label="Formato de entrada">'+opts(['HEX','RGB','HSL','HSV'],format)+'</select>'+
    '<input id="converter-input" aria-label="Código da cor" aria-describedby="converter-status" spellcheck="false" value="'+esc(colorCode(toolsState.converter,format))+'"></div><p id="converter-status" class="small-note" aria-live="polite"></p><div id="converter-result">'+converterResult()+'</div></section>'+
    '<section class="panel"><h2>Contraste</h2><div class="toolbar"><label>Texto <input type="color" id="t-a" value="'+a+'"></label><label>Fundo <input type="color" id="t-b" value="'+b+'"></label></div><div id="contrast-result">'+contrastResult()+'</div></section>'+
    '<section class="panel"><h2>Escala de cor</h2><label>Cor-base <input type="color" id="scale-base" value="'+scale+'"></label><div id="scale-result">'+scaleResult()+'</div></section>'+
    '<section class="panel"><h2>Gradiente</h2><div class="toolbar"><label>Tipo <select id="t-mode">'+opts(['Linear','Radial'],mode)+'</select></label>'+
    '<label id="angle-control" '+(mode==='Radial'?'hidden':'')+'>Ângulo <output id="gradient-angle">'+angle+'°</output> <input type="range" id="t-angle" min="0" max="360" value="'+angle+'"></label></div>'+
    '<div id="gradient-stops">'+gradientRows()+'</div><div class="toolbar">'+(toolsState.stops.length<8?btn('Adicionar cor','stop-add'):'')+'</div><div id="gradient-result">'+gradientResult()+'</div></section>'+gradientPalettePanel()+'</div>';
}
const pages={inicio:home,gerador:generator,biblioteca:browse,colecoes:browse,notion:()=>studio(false),brand:()=>studio(true),harmonias:harmonies,extrair:extract,ferramentas:colorTools};
function render(){
  app.innerHTML=(pages[route()]||home)();
  document.querySelectorAll('.top a').forEach(a=>a.hash==='#'+route()?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  if(route()==='gerador'){
    const disabled={undo:!undo.length,redo:!redo.length,add:gen.colors.length===10,remove:gen.colors.length===2};
    Object.entries(disabled).forEach(([action,on])=>app.querySelectorAll('[data-action="'+action+'"]').forEach(b=>b.disabled=on));
    app.querySelector('.swatch:first-child [data-action="move-left"]').disabled=true;
    app.querySelector('.swatch:last-child [data-action="move-right"]').disabled=true;
  }
}
let noticeTimer;
function notice(text){toast.textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>toast.textContent='',2300);}
async function copy(text){
  try {await navigator.clipboard.writeText(text);notice('Copiado.');}
  catch {window.prompt('Copie o conteúdo abaixo',text);}
}
function id(){return 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function save(p,feedback=true){
  const index=collection.findIndex(item=>item.id===p.id);
  const next=collection.slice();
  if(index===-1)next.push(p);else next[index]={...next[index],...p};
  if(!persist('collection',next))return false;
  collection=next;
  if(feedback)notice('Paleta salva.');
  return true;
}
function change(fn){undo.push(structuredClone(gen));if(undo.length>80)undo.shift();redo=[];fn();render();}
function move(from,to){if(from===to||to<0||to>=gen.colors.length)return;change(()=>gen.colors.splice(to,0,gen.colors.splice(from,1)[0]));}
function setGen(colors,name){
  change(()=>{gen.name=name;gen.colors=colors.map(hex=>({hex,locked:false}));});
  if(route()!=='gerador') location.hash='gerador';
}
function sendStudio(colors,target){
  const s=target==='brand'?brand:notion;
  s.colors=s.colors.map((c,i)=>colors[i]??c);
  if(target==='notion')saveNotionDraft();
  if(route()===target)render();else location.hash=target;
}
function download(data,name,type){
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function png(c,name){c.toBlob(blob=>blob?download(blob,name+'.png','image/png'):notice('Não foi possível exportar.'),'image/png');}
function pdf(c,name){
  const data=Uint8Array.from(atob(c.toDataURL('image/jpeg',.94).split(',')[1]),c=>c.charCodeAt(0));
  const enc=new TextEncoder(), parts=[], offsets=[0];let size=0;
  const add=v=>{const bytes=typeof v==='string'?enc.encode(v):v;parts.push(bytes);size+=bytes.length;};
  const obj=(n,...chunks)=>{offsets[n]=size;add(n+' 0 obj\n');chunks.forEach(add);add('\nendobj\n');};
  const w=600,h=Math.round(w*c.height/c.width);
  add('%PDF-1.4\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im 4 0 R >> >> /Contents 5 0 R >>');
  obj(4,'<< /Type /XObject /Subtype /Image /Width '+c.width+' /Height '+c.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+data.length+' >>\nstream\n',data,'\nendstream');
  const stream='q '+w+' 0 0 '+h+' 0 0 cm /Im Do Q\n';
  obj(5,'<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  const xref=size;
  add('xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  download(new Blob(parts,{type:'application/pdf'}),name+'.pdf','application/pdf');
}
function paletteCanvas(name,colors){
  const c=canvas(1200,540),ctx=c.getContext('2d');
  ctx.fillStyle='#FAF7F3';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#403936';
  ctx.font='24px sans-serif';ctx.fillText('COLOR ATELIER',65,71);ctx.font='64px Georgia';ctx.fillText(name,65,151,1070);
  const width=1070/colors.length;
  colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(65+i*width,202,width+1,220);ctx.fillStyle=ink(color);ctx.font='20px monospace';ctx.fillText(color,73+i*width,396,width-15);});
  return c;
}
function guide(){
  const c=canvas(1240,1400),ctx=c.getContext('2d'),[primary,secondary,highlight,bg,surface,text,neutral]=brand.colors;
  const label=(value,x,y,size=24,color=text,font='DM Sans')=>{ctx.fillStyle=color;ctx.font=size+'px "'+font+'"';ctx.fillText(value,x,y,1100-x);};
  ctx.fillStyle=bg;ctx.fillRect(0,0,1240,1400);
  label('COLOR ATELIER · GUIA DE MARCA',65,72);
  label(brand.name||'Minha marca',65,167,77,text,fontPairs[brand.font][0]);
  label(brand.segment+' · '+brand.personality,65,218,25);
  brand.colors.forEach((color,i)=>{const y=270+i*77;ctx.fillStyle=color;ctx.fillRect(65,y,115,55);label(brandRoles[i],205,y+33,26);label([color,formatColor(color,'RGB'),formatColor(color,'HSL')].join('   ·   '),420,y+33,22);});
  label('Tipografia · '+fontPairs[brand.font].join(' + '),65,855,28);
  const ratio=contrast(bg,text);
  label('Contraste do texto sobre o fundo · '+ratio.toFixed(2)+':1',65,905,26);
  label(ratio>=4.5?'Atende AA para texto comum.':'Ajuste o texto ou fundo até obter pelo menos 4,5:1.',65,948,24);
  [[primary,'Cartão de visita',65],[secondary,'Redes sociais',630]].forEach(([color,title,x])=>{
    ctx.fillStyle=color;ctx.fillRect(x,1010,540,250);label(title,x+27,1060,22,ink(color));label(brand.name,x+27,1155,42,ink(color),fontPairs[brand.font][0]);
  });
  [highlight,surface,neutral].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(65+i*370,1310,370,27);});
  return c;
}
async function exportCover(){
  const c=canvas(notion.width,notion.height),ctx=c.getContext('2d'),[,a,,,,b]=notion.colors;
  ctx.fillStyle=a;ctx.fillRect(0,0,c.width,c.height);
  if(notion.cover==='Gradiente'){
    const radians=notion.angle*Math.PI/180, x=Math.sin(radians), y=-Math.cos(radians);
    const extent=(Math.abs(x)*c.width+Math.abs(y)*c.height)/2;
    const gradient=ctx.createLinearGradient(c.width/2-x*extent,c.height/2-y*extent,c.width/2+x*extent,c.height/2+y*extent);
    coverStops(notion).forEach(([point,color])=>gradient.addColorStop(point,color));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,c.width,c.height);
  }
  if(notion.cover==='Geométrica'){ctx.fillStyle=b;ctx.beginPath();ctx.moveTo(c.width*.72,0);ctx.lineTo(c.width,0);ctx.lineTo(c.width,c.height);ctx.lineTo(c.width*.42,c.height);ctx.closePath();ctx.fill();}
  if(notion.cover==='Padrão'){ctx.strokeStyle=b;ctx.lineWidth=2;for(let x=-c.height;x<c.width;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+c.height,c.height);ctx.stroke();}}
  ctx.fillStyle=ink(a);ctx.textAlign='center';ctx.textBaseline='middle';const font='600 '+notion.fontSize+'px "'+notion.font+'"';
  try {await document.fonts.load(font);} catch {}
  ctx.font=font;ctx.fillText(notion.name,c.width/2,c.height/2,c.width*.82);png(c,'capa-notion');
}
function exportGen(type){
  const colors=gen.colors.map(c=>c.hex), name=gen.name||'Minha paleta', file='color-atelier-paleta';
  if(type==='PNG'||type==='PDF'){const c=paletteCanvas(name,colors);return type==='PNG'?png(c,file):pdf(c,file);}
  if(type==='SVG'){
    const width=900/colors.length;
    const blocks=colors.map((c,i)=>'<rect x="'+i*width+'" y="80" width="'+(width+1)+'" height="180" fill="'+c+'"/><text x="'+(i*width+8)+'" y="238" fill="'+ink(c)+'" font-size="15" font-family="monospace">'+c+'</text>').join('');
    return download('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 260"><title>'+esc(name)+'</title><rect width="900" height="80" fill="#FAF7F3"/><text x="26" y="51" fill="#403936" font-size="32" font-family="Georgia">'+esc(name)+'</text>'+blocks+'</svg>',file+'.svg','image/svg+xml');
  }
  if(type==='JSON')return download(JSON.stringify({name,colors},null,2),file+'.json','application/json');
  if(type==='CSS')return download(':root {\n'+colors.map((c,i)=>'  --palette-'+(i+1)+': '+c+';').join('\n')+'\n}',file+'.css','text/css');
  if(type==='Tailwind')return download('@theme {\n'+colors.map((c,i)=>'  --color-atelier-'+(i+1)+': '+c+';').join('\n')+'\n}',file+'-tailwind.css','text/css');
  download(colors.join('\n'),file+'.txt','text/plain');
}
async function extractColors(){
  const src=extraction.src;if(!src)return;
  try{
    const img=new Image();img.src=src;await img.decode();if(extraction.src!==src)return;
    const c=canvas(90,90),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,90,90);
    const data=ctx.getImageData(0,0,90,90).data,bins=new Map();
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]<128)continue;
      const [r,g,b]=data.subarray(i,i+3),key=[r>>5,g>>5,b>>5].join(',');
      const bin=bins.get(key)||[0,0,0,0];bin[0]+=r;bin[1]+=g;bin[2]+=b;bin[3]++;bins.set(key,bin);
    }
    extraction.colors=[...bins.values()].sort((a,b)=>b[3]-a[3]).slice(0,extraction.count).map(([r,g,b,n])=>pixelHex([r/n,g/n,b/n]));
    if(route()==='extrair')document.querySelector('#image-result').innerHTML=imageResult();
    if(!extraction.colors.length)notice('A imagem não tem cores opacas suficientes.');
  }catch{notice('Não foi possível ler esta imagem.');}
}
const pixelHex = values => '#'+Array.from(values,v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
function saveStudio(s,kind){save({id:id(),name:s.name||kind,colors:s.colors.slice(),kind});}
const actions={
  copy,
  generate:()=>change(()=>{const fresh=generate(gen.colors.length,gen.style);gen.colors=gen.colors.map((c,i)=>c.locked?c:{hex:fresh[i],locked:false});}),
  add:()=>{if(gen.colors.length<10)change(()=>gen.colors.push({hex:generate(1,gen.style)[0],locked:false}));},
  lock:i=>change(()=>gen.colors[i].locked=!gen.colors[i].locked),
  remove:i=>{if(gen.colors.length>2)change(()=>gen.colors.splice(i,1));},
  'move-left':i=>move(Number(i),Number(i)-1),'move-right':i=>move(Number(i),Number(i)+1),
  undo:()=>{if(undo.length){redo.push(structuredClone(gen));gen=undo.pop();render();}},
  redo:()=>{if(redo.length){undo.push(structuredClone(gen));gen=redo.pop();render();}},
  'copy-gen':()=>copy(gen.colors.map(c=>formatColor(c.hex,document.querySelector('#color-format').value)).join(' · ')),
  'save-gen':()=>save({id:id(),name:gen.name||'Minha paleta',colors:gen.colors.map(c=>c.hex),style:gen.style}),
  'export-gen':()=>exportGen(document.querySelector('#gen-export').value),
  share:()=>{const u=new URL(location.href);u.hash='gerador?'+new URLSearchParams({cores:gen.colors.map(c=>c.hex.slice(1)).join(','),nome:gen.name});copy(u.href);},
  'send-notion':()=>sendStudio(gen.colors.map(c=>c.hex),'notion'),
  'send-brand':()=>sendStudio(gen.colors.map(c=>c.hex),'brand'),
  open:i=>{const p=find(i);if(p)setGen(p.colors,p.name);},
  favorite:i=>{const p=find(i);if(p&&save({...p,favorite:!p.favorite},false)){render();notice(p.favorite?'Favorito removido.':'Paleta favoritada.');}},
  rename:i=>{const p=find(i),name=prompt('Novo nome',p.name)?.trim().slice(0,100);if(name&&save({...p,name}))render();},
  duplicate:i=>{const p=find(i);if(save({...p,id:id(),name:p.name+' (cópia)',favorite:false}))render();},
  delete:i=>{if(confirm('Excluir esta paleta da sua biblioteca?')){const next=collection.filter(p=>p.id!==i);if(persist('collection',next)){collection=next;render();notice('Paleta excluída.');}}},
  'folder-new':()=>{const name=prompt('Nome da coleção')?.trim().slice(0,70);if(name&&name!=='Sem coleção'&&!folders.includes(name)){const next=[...folders,name];if(persist('folders',next)){folders=next;render();notice('Coleção criada.');}}},
  backup:()=>download(JSON.stringify({collection,folders},null,2),'color-atelier-backup.json','application/json'),
  'generate-notion':()=>{
    const base=[262,275,30,338,263,112,42,218,195,146,35,327][notionThemes.indexOf(notion.theme)];
    notion.colors=[hsl(base,.25,.96),hsl(base,.40,.83),hsl(base,.24,.31),hsl(base,.16,.22),hsl((base+48)%360,.31,.84),hsl((base+335)%360,.35,.90)];saveNotionDraft();render();
  },
  'generate-brand':()=>{
    const [h]=toHsl(brand.favorite),[avoid]=toHsl(brand.avoid);
    const offsets={Acolhedora:24,Sofisticada:12,Criativa:116,Serena:48,Ousada:174};
    const [s]=variants[brand.style],base=(h+offsets[brand.personality])%360;
    const hue=(x)=>{const d=Math.abs(x-avoid);return Math.min(d,360-d)<17?(x+36)%360:x;};
    const shades=[.38,.79,.75,.96,.87,.22,.68];
    brand.colors=shades.map((l,i)=>hsl(hue((base+(i-2)*17+360)%360),i===5?.18:s,l));
    if(brand.favorite.toLowerCase()!==brand.avoid.toLowerCase())brand.colors[2]=brand.favorite;
    render();
  },
  'save-notion':()=>saveStudio(notion,'Notion Studio'),'save-brand':()=>saveStudio(brand,'Brand Studio'),
  'project-save':()=>saveBrandProject(),
  'project-duplicate':()=>saveBrandProject(true),
  'project-new':()=>{
    if(!canLeaveBrand())return;
    if(storeBrandProjects(null,brandProjects.items))switchBrand(null,{...brandTemplate,name:'',segment:''});
  },
  'project-delete':()=>{
    const project=brandProjects.items.find(item=>item.id===activeBrandId);
    if(!project||!confirm('Excluir o projeto “'+project.draft.name+'”?'))return;
    if(storeBrandProjects(null,brandProjects.items.filter(item=>item.id!==project.id))){
      switchBrand(null,{...brandTemplate,name:'',segment:''});
      notice('Projeto excluído.');
    }
  },
  'guide-png':()=>png(guide(),'mini-brand-book'),'guide-pdf':()=>pdf(guide(),'mini-brand-book'),
  'notion-project-save':()=>saveNotionProject(),
  'notion-duplicate':()=>saveNotionProject(true),
  'notion-new':()=>{
    if(!notionProjects.active&&JSON.stringify(notion)!==JSON.stringify(notionTemplate)&&!confirm('Substituir o rascunho atual? Para guardar uma cópia, escolha Salvar projeto.'))return;
    openNotion(null,notionProjects.items,notionTemplate);
  },
  'notion-delete':()=>{
    const {active,items}=notionProjects;
    if(active&&confirm('Excluir o projeto “'+notion.name+'”?')&&openNotion(null,items.filter(item=>item.id!==active),notionTemplate))notice('Projeto excluído.');
  },
  'cover-png':exportCover,'notion-png':()=>png(paletteCanvas(notion.name,notion.colors),'paleta-notion'),
  'open-gradient-palette':()=>setGen(gradientPaletteColors(),'Paleta em gradiente'),
  'open-harmony':()=>setGen(harmonyColors(),'Harmonia '+harmony.type),
  'open-image':()=>setGen(extraction.colors.length===1?[extraction.colors[0],ink(extraction.colors[0])]:extraction.colors,'Cores da imagem'),
  'image-notion':()=>sendStudio(extraction.colors,'notion'),'image-brand':()=>sendStudio(extraction.colors,'brand'),
  'stop-add':()=>{
    if(toolsState.stops.length>=8)return;
    const ordered=sortedStops();
    const widest=ordered.slice(1).map((stop,i)=>({left:ordered[i],right:stop})).reduce((a,b)=>b.right.at-b.left.at>a.right.at-a.left.at?b:a);
    const middle=rgb(widest.left.color).map((v,i)=>(v+rgb(widest.right.color)[i])/2);
    toolsState.stops.push({color:rgbHex(middle),at:Math.round((widest.left.at+widest.right.at)/2)});
    toolsState.stops=sortedStops();
    render();
  },
  'stop-remove':i=>{if(toolsState.stops.length>2){toolsState.stops.splice(i,1);render();}},
  'gradient-png':()=>{
    const c=canvas(1200,600),ctx=c.getContext('2d');
    const radians=toolsState.angle*Math.PI/180,x=Math.sin(radians),y=-Math.cos(radians);
    const extent=(Math.abs(x)*c.width+Math.abs(y)*c.height)/2;
    const g=toolsState.mode==='Linear'
      ?ctx.createLinearGradient(600-x*extent,300-y*extent,600+x*extent,300+y*extent)
      :ctx.createRadialGradient(600,300,0,600,300,Math.hypot(600,300));
    sortedStops().forEach(({color,at})=>g.addColorStop(at/100,color));
    ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);png(c,'gradiente');
  }
};
function find(i){return collection.find(p=>p.id===i);}
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(b){actions[b.dataset.action]?.(b.dataset.value);return;}
  if(e.target.id==='image-preview'){
    const img=e.target, rect=img.getBoundingClientRect(), c=canvas(1,1),ctx=c.getContext('2d');
    const x=Math.floor((e.clientX-rect.left)*img.naturalWidth/rect.width),y=Math.floor((e.clientY-rect.top)*img.naturalHeight/rect.height);
    ctx.drawImage(img,x,y,1,1,0,0,1,1);const rgba=ctx.getImageData(0,0,1,1).data;if(rgba[3]===0)return;
    const color=pixelHex(rgba.slice(0,3));
    extraction.colors=[color,...extraction.colors.filter(c=>c!==color)].slice(0,extraction.count);
    document.querySelector('#image-result').innerHTML=imageResult();
  }
});
app.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='search'){search=t.value;document.querySelector('#results').innerHTML=libraryCards();}
  if(t.id==='palette-name')gen.name=t.value;
  if(t.matches('[data-field]')){
    const isBrand=route()==='brand',s=isBrand?brand:notion,key=t.dataset.field;
    if(t.type==='number'||t.type==='range'){if(t.validity.valid&&t.value)s[key]=Number(t.value);}
    else s[key]=t.value;
    if(!isBrand){
      saveNotionDraft();
      const selected=document.querySelector('#notion-project').selectedOptions[0];
      if(key==='name'&&notionProjects.active)selected.textContent=notion.name||'Página sem título';
      document.querySelector('#gradient-options').hidden=notion.cover!=='Gradiente';
      document.querySelector('#angle-value').textContent=notion.angle+'°';
      document.querySelector('#share-value').textContent='Destaque '+notion.share+'% · Complementar '+(100-notion.share)+'%';
    }
    document.querySelector('#preview').innerHTML=isBrand?brandPreview():notionPreview();
  }
  if(t.matches('[data-role]')){
    const isBrand=route()==='brand',s=isBrand?brand:notion;
    const code=t.value.toUpperCase();
    s.colors[t.dataset.role]=code;
    const copyButton=t.closest('.role').querySelector('button');
    copyButton.textContent=code;
    copyButton.dataset.value=code;
    app.querySelector('[data-action="copy"]').dataset.value=s.colors.join(' ');
    if(!isBrand)saveNotionDraft();
    document.querySelector('#preview').innerHTML=isBrand?brandPreview():notionPreview();
  }
  if(t.matches('[data-palette-gradient]')){
    const key=t.dataset.paletteGradient;
    gradientPalette[key]=key==='count'?Number(t.value):t.value.toUpperCase();
    document.querySelector('#gradient-palette-result').innerHTML=gradientPaletteResult();
  }
  const hKeys={'h-base':'base','h-type':'type','h-sat':'s','h-light':'l'};
  if(hKeys[t.id]){harmony[hKeys[t.id]]=t.type==='range'?Number(t.value)/100:t.value;document.querySelector('#h-result').innerHTML=harmonyResult();}
  if(t.id==='converter-format'){
    toolsState.format=t.value;
    const input=document.querySelector('#converter-input');
    input.value=colorCode(toolsState.converter,t.value);
    input.removeAttribute('aria-invalid');
    document.querySelector('#converter-status').textContent='';
  }
  if(t.id==='converter-input'){
    const color=parseColor(t.value,toolsState.format);
    document.querySelector('#converter-status').textContent=color?'':'Confira o formato e os valores do código.';
    if(color){
      t.removeAttribute('aria-invalid');
      toolsState.converter=color;
      document.querySelector('#converter-result').innerHTML=converterResult();
    }else t.setAttribute('aria-invalid','true');
  }
  if(t.id==='t-a'||t.id==='t-b'){
    toolsState[t.id==='t-a'?'a':'b']=t.value;
    document.querySelector('#contrast-result').innerHTML=contrastResult();
  }
  if(t.id==='scale-base'){
    toolsState.scale=t.value;
    document.querySelector('#scale-result').innerHTML=scaleResult();
  }
  const {stopColor,stopAt}=t.dataset;
  if(t.id==='t-mode'||t.id==='t-angle'||stopColor!==undefined||stopAt!==undefined){
    if(t.id==='t-mode'){
      toolsState.mode=t.value;
      document.querySelector('#angle-control').hidden=t.value==='Radial';
    }
    if(t.id==='t-angle'){
      toolsState.angle=Number(t.value);
      document.querySelector('#gradient-angle').textContent=t.value+'°';
    }
    if(stopColor!==undefined)toolsState.stops[stopColor].color=t.value;
    if(stopAt!==undefined&&t.validity.valid&&t.value!=='')toolsState.stops[stopAt].at=Number(t.value);
    document.querySelector('#gradient-result').innerHTML=gradientResult();
  }
});
app.addEventListener('focusout',e=>{
  const t=e.target;
  if(t.dataset.stopAt!==undefined)t.value=toolsState.stops[t.dataset.stopAt].at;
  if(['fontSize','titleSize'].includes(t.dataset.field))t.value=notion[t.dataset.field];
});
app.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='notion-project'){
    const project=notionProjects.items.find(item=>item.id===t.value);
    const discard=!notionProjects.active&&JSON.stringify(notion)!==JSON.stringify(notionTemplate);
    if(!project||(discard&&!confirm('Abrir outro projeto e substituir o rascunho atual?'))||!openNotion(project.id,notionProjects.items,project.draft)){
      t.value=notionProjects.active??'';
    }
  }
  if(t.id==='brand-project'){
    const project=brandProjects.items.find(item=>item.id===t.value);
    if(!project||!canLeaveBrand()||!storeBrandProjects(project.id,brandProjects.items)){
      t.value=activeBrandId??'';
      return;
    }
    switchBrand(project.id,project.draft);
  }
  if(t.matches('[data-gen-color]'))change(()=>gen.colors[t.dataset.genColor].hex=t.value.toUpperCase());
  if(t.id==='gen-style')gen.style=t.value;
  if(t.id==='sort')sort=t.value;
  if(t.id==='folder')activeFolder=t.value;
  if(t.id==='favorites')onlyFavorites=t.checked;
  if(['sort','folder','favorites'].includes(t.id))document.querySelector('#results').innerHTML=libraryCards();
  if(t.dataset.folderId){const p=find(t.dataset.folderId);save({...p,folder:t.value==='Sem coleção'?'':t.value},false);if(activeFolder)render();}
  if(t.id==='image-count'){extraction.count=Number(t.value);await extractColors();}
  if(t.id==='image-input'&&t.files[0]){
    if(extraction.src)URL.revokeObjectURL(extraction.src);
    extraction.src=URL.createObjectURL(t.files[0]);extraction.colors=[];render();await extractColors();
  }
  if(t.id==='import'&&t.files[0]){
    try{
      const backup=JSON.parse(await t.files[0].text());
      if(!Array.isArray(backup.collection)||!Array.isArray(backup.folders))throw Error();
      const extra=backup.collection.map(p=>{
        if(typeof p.name!=='string'||!Array.isArray(p.colors)||p.colors.length<2||p.colors.length>10||!p.colors.every(c=>typeof c==='string'&&hex(c)))throw Error();
        return {id:id(),name:p.name.slice(0,100),colors:p.colors.map(c=>c.toUpperCase()),favorite:!!p.favorite,folder:typeof p.folder==='string'?p.folder.slice(0,70):''};
      });
      const nextFolders=[...new Set([...folders,...backup.folders.filter(f=>typeof f==='string'&&f.trim()&&f!=='Sem coleção').map(f=>f.slice(0,70))])];
      if(persist('folders',nextFolders)){folders=nextFolders;const next=[...collection,...extra];if(persist('collection',next)){collection=next;notice('Backup importado.');}}
    }catch{notice('Arquivo de backup inválido.');}
    render();
  }
});
app.addEventListener('dragstart',e=>{const s=e.target.closest('.swatch');if(s)e.dataTransfer.setData('text/plain',s.dataset.index);});
app.addEventListener('dragover',e=>{if(e.target.closest('.swatch'))e.preventDefault();});
app.addEventListener('drop',e=>{const s=e.target.closest('.swatch'),source=e.dataTransfer.getData('text/plain');if(s&&/^\d+$/.test(source)&&Number(source)<gen.colors.length){e.preventDefault();move(Number(source),Number(s.dataset.index));}});
document.addEventListener('keydown',e=>{
  if(route()!=='gerador'||e.target.matches('input,select,textarea,[contenteditable]'))return;
  const k=e.key.toLowerCase(),s=e.target.closest('.swatch');
  if(k==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();actions[e.shiftKey?'redo':'undo']();}
  if(e.key===' '&&!e.target.closest('button,a')&&!e.repeat){e.preventDefault();actions.generate();}
  if(s&&!e.ctrlKey&&!e.metaKey&&!e.repeat&&k==='l')actions.lock(s.dataset.index);
  if(s&&!e.ctrlKey&&!e.metaKey&&!e.repeat&&k==='c')copy(gen.colors[s.dataset.index].hex);
});
function navigate(){
  search='';sort='original';activeFolder='';onlyFavorites=false;
  const query=new URLSearchParams(location.hash.split('?')[1]);
  if(route()==='gerador'&&query.has('cores')){
    const colors=query.get('cores').split(',').map(c=>('#'+c).toUpperCase());
    if(colors.length>=2&&colors.length<=10&&colors.every(hex)){gen={name:(query.get('nome')||'Paleta compartilhada').slice(0,80),style:'Pastel',colors:colors.map(hex=>({hex,locked:false}))};undo=[];redo=[];}
  }
  render();window.scrollTo(0,0);
}
window.addEventListener('hashchange',navigate);
navigate();
