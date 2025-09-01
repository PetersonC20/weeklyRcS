
// core.js — utilidades e canal de broadcast compartilhado
(function(){
  const bc = new BroadcastChannel('quiz');
  const listeners = new Set();

  function on(fn){ listeners.add(fn); }
  function off(fn){ listeners.delete(fn); }
  bc.onmessage = (ev)=>{ for(const fn of listeners) fn(ev.data||{}); };

  function send(msg){
    try { bc.postMessage(msg); } catch(e){ console.error(e); }
  }

  function uid(){
    return 'p_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
  }

  function now(){ return Date.now(); }

  // pequenos helpers
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  // armazenamento simples
  const store = {
    get(k, d){ try{ return JSON.parse(localStorage.getItem(k))??d; }catch(e){ return d; } },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); }
  };

  // toast padrão
  function toast(txt){
    let t = document.querySelector('.toast');
    if(!t){
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = txt;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 2000);
  }

  // Expor no escopo global
  window.QCore = { bc, on, off, send, uid, now, $, $all, store, toast };
})();
