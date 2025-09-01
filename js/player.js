
// player.js — cliente do participante
(function(){
  const {on, send, $, $all, uid, toast} = window.QCore;

  // Estado local do jogador
  let me = {
    uid: localStorage.getItem('my_uid') || uid(),
    nick: ''
  };
  localStorage.setItem('my_uid', me.uid);

  // DOM
  const joinCard = $('#joinCard');
  const gameCard = $('#gameCard');
  const finalCard = $('#finalCard');
  const joinBtn = $('#joinBtn');
  const nickInput = $('#nick');
  const qTxt = $('#qTxt');
  const opts = $('#opts');
  const timer = $('#timer');
  const tLeft = $('#tLeft');
  const fill = timer.querySelector('.fill');
  const status = $('#status');
  const podium = $('#podium');

  function show(el){ el.hidden = false; el.style.display=''; }
  function hide(el){ el.hidden = true; el.style.display='none'; }

  joinBtn.addEventListener('click', ()=>{
    me.nick = nickInput.value.trim();
    if(!me.nick){ toast('Digite seu nome.'); return; }
    send({type:'join', uid: me.uid, nick: me.nick});
  });

  on(msg=>{
    switch(msg.type){
      case 'accept':
        if(msg.uid === me.uid){
          toast('Entrou no lobby!');
          hide(joinCard); show(gameCard);
        }
        break;
      case 'start':
        renderQuestion(msg.q);
        status.style.display='none';
        break;
      case 'tick':
        tLeft.textContent = msg.left;
        timer.style.setProperty('--pct', msg.pct*100);
        fill.style.background = `conic-gradient(var(--accent) calc(${msg.pct*100}% ), transparent 0)`;
        break;
      case 'end_question':
        reveal(msg.correctIndex);
        status.style.display='block';
        break;
      case 'end_game':
        hide(gameCard); show(finalCard);
        renderPodium(msg.top3||[]);
        break;
    }
  });

  function renderQuestion(q){
    qTxt.textContent = q.text;
    opts.innerHTML = '';
    opts.hidden = false;
    const tags = ['A','B','C','D'];
    q.opts.forEach((txt, i)=>{
      const item = document.createElement('div');
      item.className = `opt ${['a','b','c','d'][i]}`;
      item.innerHTML = `<div class="tag">${tags[i]}</div><div class="txt">${txt}</div><div class="bar"></div>`;
      item.addEventListener('click', ()=>{
        // impedir múltiplos
        if(opts.dataset.lock==='1') return;
        opts.dataset.lock='1';
        send({type:'answer', uid: me.uid, choice: i});
        status.textContent = 'Resposta enviada!';
        status.className = 'pill';
        status.style.opacity = '.9';
        status.style.display='block';
      });
      opts.appendChild(item);
    });
    // desbloqueia
    opts.dataset.lock = '0';
  }

  function reveal(correctIndex){
    const cards = $all('.opt', opts);
    cards.forEach((c, i)=>{
      c.classList.add('revealed');
      if(i===correctIndex) c.classList.add('correct'); else c.classList.add('wrong');
    });
  }

  function renderPodium(top3){
    podium.innerHTML = '';
    const medal = ['gold','silver','bronze'];
    top3.forEach((p, i)=>{
      const d = document.createElement('div');
      d.className = `cup ${medal[i]||''}`;
      d.innerHTML = `<div style="font-weight:700">${i===0?'🏆 1º':'#'+(i+1)}</div><div style="font-size:1.1rem;margin-top:6px">${p.nick||'—'}</div><div style="opacity:.8">${p.score|0} pts</div>`;
      podium.appendChild(d);
    });
  }

  // Antes de sair/fechar
  window.addEventListener('beforeunload', ()=>{
    send({type:'leave', uid: me.uid});
  });
})();
