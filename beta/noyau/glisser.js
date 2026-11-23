/* LIFE PANEL v5 · noyau/glisser.js
   Le glisser-déposer, repris du prototype : un seul moteur pour la souris, le stylet et le doigt.
   - [data-glisser="type"] : un élément qu'on peut glisser (une ligne de tableau, une carte…), avec data-id ;
   - souris : le glisser démarre après 4 px ; doigt : appui long (320 ms), puis glisser (un glisser simple fait défiler) ;
   - [data-depot="types acceptés"] : une zone où l'on peut déposer (un onglet de section, une catégorie, un jour…) ;
   - glisserType(type, {depot(c) → false si refusé, debut(c), fin(c, ok)}) ; c.cible = la zone, c.d = les data-* de l'élément.
   Échap annule ; le bord de l'écran fait défiler. Chaque glisser doit aussi exister sous forme de bouton (téléphone, clavier). */

const TYPES = {};
const g = {attente:null, ctx:null, bloquerClic:false};
export const glisserType = (type, spec) => { TYPES[type] = spec; };
export const enGlisse = () => !!g.ctx;

document.addEventListener('pointerdown', e => {
  if((e.pointerType === 'mouse' && e.button !== 0) || g.ctx) return;
  const el = e.target.closest && e.target.closest('[data-glisser]'); if(!el) return;
  const spec = TYPES[el.dataset.glisser]; if(!spec) return;
  if(e.target.closest('button, a, input, textarea, select, label')) return;
  const tactile = e.pointerType !== 'mouse';
  const a = {el, spec, type:el.dataset.glisser, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, id:e.pointerId, tactile, minuteur:null};
  g.attente = a;
  if(tactile) a.minuteur = setTimeout(() => { if(g.attente === a) demarrer(a); }, 320);
}, {passive:true});
document.addEventListener('pointermove', e => {
  const a = g.attente;
  if(a && !g.ctx){
    a.x = e.clientX; a.y = e.clientY;
    const d = Math.hypot(a.x - a.x0, a.y - a.y0);
    if(a.tactile){ if(d > 10){ clearTimeout(a.minuteur); g.attente = null; } return; }   /* le doigt bouge avant l'appui long : il fait défiler */
    if(d > 4) demarrer(a);
    return;
  }
  const c = g.ctx; if(!c || e.pointerId !== c.id) return;
  c.x = e.clientX; c.y = e.clientY; placer(c); survoler(c);
}, {passive:true});
function finPointeur(e){
  const a = g.attente; if(a){ clearTimeout(a.minuteur); g.attente = null; }
  const c = g.ctx; if(!c || (e.pointerId !== undefined && e.pointerId !== c.id)) return;
  terminer(c, e.type !== 'pointercancel');
}
document.addEventListener('pointerup', finPointeur);
document.addEventListener('pointercancel', finPointeur);
document.addEventListener('touchmove', e => { if(g.ctx) e.preventDefault(); }, {passive:false});
document.addEventListener('click', e => { if(g.bloquerClic){ e.preventDefault(); e.stopPropagation(); g.bloquerClic = false; } }, true);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && g.ctx){ e.preventDefault(); e.stopPropagation(); terminer(g.ctx, false); } }, true);
document.addEventListener('contextmenu', e => { if(g.ctx || (g.attente && g.attente.tactile)) e.preventDefault(); });
document.addEventListener('dragstart', e => { if(e.target.closest && e.target.closest('[data-glisser]')) e.preventDefault(); });

function demarrer(a){
  g.attente = null;
  const r = a.el.getBoundingClientRect();
  const c = {type:a.type, spec:a.spec, el:a.el, id:a.id, x:a.x, y:a.y, dx:Math.min(a.x0 - r.left, 260), dy:a.y0 - r.top, cible:null, d:{...a.el.dataset}, tactile:a.tactile};
  /* Le fantôme : le texte de l'élément dans une petite étiquette qui suit le pointeur (une ligne de tableau ne se clone pas bien) */
  const f = document.createElement('div');
  f.className = 'fantome'; f.setAttribute('aria-hidden', 'true');
  f.textContent = (a.spec.etiquette ? a.spec.etiquette(c) : (a.el.innerText || '').split('\n').filter(Boolean)[0] || '').slice(0, 80);
  document.body.appendChild(f); c.fantome = f;
  a.el.classList.add('glisse-source'); document.body.classList.add('en-glisse');
  document.querySelectorAll('[data-depot]').forEach(z => { if(z.dataset.depot.split(' ').includes(a.type)) z.classList.add('depot-possible'); });
  g.ctx = c;
  if(a.tactile && navigator.vibrate) try { navigator.vibrate(12); } catch(x){}
  if(a.spec.debut) try { a.spec.debut(c); } catch(x){ console.error(x); }
  placer(c); survoler(c);
  c.raf = requestAnimationFrame(defiler);
}
const placer = c => { c.fantome.style.transform = `translate(${c.x + 14}px, ${c.y + 10}px)`; };
/* La zone de dépôt sous le pointeur, si elle accepte ce type */
function survoler(c){
  c.fantome.hidden = true;
  const el = document.elementFromPoint(c.x, c.y);
  c.fantome.hidden = false;
  const z = el && el.closest('[data-depot]');
  document.querySelectorAll('.cible-active').forEach(x => { if(x !== z) x.classList.remove('cible-active'); });
  if(!z || !z.dataset.depot.split(' ').includes(c.type)){ c.cible = null; return; }
  z.classList.add('cible-active'); c.cible = z;
}
function defiler(){
  const c = g.ctx; if(!c) return;
  const v = (d, m) => Math.ceil((1 - d / m) * 16);
  if(c.y < 70) window.scrollBy(0, -v(Math.max(0, c.y - 10), 60));
  else if(c.y > innerHeight - 70) window.scrollBy(0, v(Math.max(0, innerHeight - c.y - 10), 60));
  c.raf = requestAnimationFrame(defiler);
}
function terminer(c, deposer){
  g.ctx = null; cancelAnimationFrame(c.raf);
  let ok = false;
  try { if(deposer && c.cible && c.spec.depot) ok = c.spec.depot(c) !== false; } catch(e){ console.error(e); }
  c.fantome.remove(); c.el.classList.remove('glisse-source'); document.body.classList.remove('en-glisse');
  document.querySelectorAll('.cible-active, .depot-possible').forEach(x => x.classList.remove('cible-active', 'depot-possible'));
  if(c.spec.fin) try { c.spec.fin(c, ok); } catch(e){ console.error(e); }
  g.bloquerClic = true; setTimeout(() => { g.bloquerClic = false; }, 0);
}
