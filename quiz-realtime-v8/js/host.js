
// host.js — apresentação em tempo real (slides/resultado)
(function(){
  const {on, send, $, $all} = window.QCore;

  const meta = $('#meta');
  const qTxt = $('#qTxt');
  const opts = $('#opts');
  const timer = $('#timer');
  const tLeft = $('#tLeft');
  const fill = timer.querySelector('.fill');
  const lobby = $('#lobby');
  const leader = $('#leader');
  const podium = $('#podium');
  const playersDiv = $('#players');

  function show(el){ el.hidden = false; el.style.display=''; }
  function hide(el){ el.hidden = true; el.style.display='none'; }

  window.addEventListener('load', ()=>{
    send({type:'host_ready'});
  });

  on(msg=>{
    switch(msg.type){
      case 'lobby':
        const list = msg.list||[];
        playersDiv.innerHTML = list.map(p=>`<div class="pill">${p.nick}${msg.showScores? ' • '+(p.score|0)+' pts':''}</div>`).join('');
        break;
      case 'start':
        renderQuestion(msg.q);
        hide(leader); show(lobby);
        meta.textContent = `Pergunta ${msg.idx+1} — Responda agora!`;
        break;
      case 'tick':
        tLeft.textContent = msg.left;
        timer.style.setProperty('--pct', msg.pct*100);
        fill.style.background = `conic-gradient(var(--accent) calc(${msg.pct*100}% ), transparent 0)`;
        break;
      case 'live':
        updateBars(msg.perc || []);
        break;
      case 'end_question':
        reveal(msg.correctIndex);
        meta.textContent = `Tempo encerrado — resposta correta: ${['A','B','C','D'][msg.correctIndex]}`;
        updateBars(msg.perc||[]);
        break;
      case 'end_game':
        renderPodium(msg.top3||[]);
        hide(lobby); show(leader);
        meta.textContent = 'Fim do jogo — Top 3';
        qTxt.textContent = '';
        opts.innerHTML = '';
        break;
    }
  });

  function renderQuestion(q){
    qTxt.textContent = q.text;
    opts.innerHTML = '';
    show(opts);
    show(timer);
    const tags = ['A','B','C','D'];
    q.opts.forEach((txt, i)=>{
      const item = document.createElement('div');
      item.className = `opt ${['a','b','c','d'][i]}`;
      item.innerHTML = `<div class="tag">${tags[i]}</div><div class="txt">${txt}</div><div class="bar"></div>`;
      opts.appendChild(item);
    });
  }

  function updateBars(perc){
    const cards = $all('.opt', opts);
    cards.forEach((c,i)=>{
      const bar = c.querySelector('.bar');
      const p = perc[i]||0;
      bar.style.transform = `scaleX(${Math.min(1, p/100)})`;
      bar.style.transitionDuration = '400ms';
      bar.style.background = 'rgba(255,255,255,.12)';
      c.style.borderColor = 'var(--accent)';
      let tag = c.querySelector('.pct');
      if(!tag){
        tag = document.createElement('div');
        tag.className = 'pct';
        tag.style.position='absolute'; tag.style.right='10px'; tag.style.top='10px'; tag.style.opacity='.85'; tag.style.fontWeight='700';
        c.appendChild(tag);
      }
      tag.textContent = p + '%';
    });
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
})();
