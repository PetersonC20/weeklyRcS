
// teacher.js — controla perguntas, lobby e fluxo do jogo (20s, placar só após rodada, respostas censuradas)
(function(){
  const {on, send, $, $all, store, toast, now} = window.QCore;

  // DOM
  const openHostBtn = $('#openHost');
  const startGameBtn = $('#startGame');
  const lobbyList = $('#lobbyList');
  const qText = $('#qText');
  const qCorrect = $('#qCorrect');
  const qTableBody = $('#qTable tbody');
  const countBadge = $('#countBadge');
  const addQBtn = $('#addQ');
  const clearAllBtn = $('#clearAll');
  const optA = $('#optA'), optB = $('#optB'), optC = $('#optC'), optD = $('#optD');

  // Estado principal
  const state = {
    players: new Map(),     // uid -> {uid, nick, score}
    qs: store.get('qs', []),
    running: false,
    round: null,            // {qid, startedAt, duration, answers: Map, correct}
    idx: 0
  };

  // ===== Banco de perguntas =====
  function renderQs(){
    qTableBody.innerHTML = '';
    state.qs.forEach((q, i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${q.text || ''}</td>
        <td>${q.opts[0] || ''}</td>
        <td>${q.opts[1] || ''}</td>
        <td>${q.opts[2] || ''}</td>
        <td>${q.opts[3] || ''}</td>
        <td><span class="censored">****</span> <button class="btn small" data-reveal="${i}">Ver</button></td>
        <td><button class="btn" data-del="${i}">Excluir</button></td>
      `;
      qTableBody.appendChild(tr);
    });
    countBadge.textContent = `${state.qs.length} pergunta${state.qs.length===1?'':'s'}`;
  }

  // Clique na tabela (revelar/excluir)
  qTableBody.addEventListener('click', (e)=>{
    const tgt = e.target;
    if(!tgt) return;
    // Excluir
    const del = tgt.dataset?.del;
    if(del != null){
      state.qs.splice(+del, 1);
      store.set('qs', state.qs);
      renderQs();
      return;
    }
    // Revelar resposta
    const rid = tgt.dataset?.reveal;
    if(rid != null){
      const q = state.qs[+rid];
      if(!q) return;
      const cell = tgt.parentElement;
      if(cell){
        cell.innerHTML = ['A','B','C','D'][q.correct];
      }
      return;
    }
  });

  // Adicionar pergunta
  addQBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    const questionText = qText.value.trim();
    const opts = [optA.value, optB.value, optC.value, optD.value].map(v=>v.trim());
    if(!questionText || opts.some(v=>!v)){
      toast('Preencha a pergunta e as 4 alternativas.');
      return;
    }
    const q = { text: questionText, opts, correct: +qCorrect.value };
    state.qs.push(q);
    store.set('qs', state.qs);
    // Limpa campos
    qText.value = ''; optA.value=''; optB.value=''; optC.value=''; optD.value='';
    renderQs();
  });

  // Limpar todas
  clearAllBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    if(confirm('Limpar todas as perguntas?')){
      state.qs = [];
      store.set('qs', state.qs);
      renderQs();
    }
  });

  renderQs();

  // ===== Lobby & sincronia =====
  function broadcastLobby(showScores){
    const list = Array.from(state.players.values()).map(p=> ({
      uid: p.uid, nick: p.nick, score: showScores ? (p.score|0) : 0
    }));
    send({type:'lobby', list, showScores});
    lobbyList.innerHTML = list.length
      ? list.map(p=>`<div class="pill">${p.nick}${showScores?' • '+(p.score|0)+' pts':''}</div>`).join('')
      : '<div class="pill" style="opacity:.7">Sem participantes ainda…</div>';
  }

  on(msg=>{
    switch(msg.type){
      case 'host_ready':
        broadcastLobby(false);
        toast('Slides conectados.');
        break;
      case 'join':
        if(state.players.has(msg.uid)) return;
        state.players.set(msg.uid, {uid: msg.uid, nick: msg.nick, score: 0});
        send({type:'accept', uid: msg.uid});
        broadcastLobby(false);
        break;
      case 'leave':
        state.players.delete(msg.uid);
        broadcastLobby(false);
        break;
      case 'answer':
        if(!state.running || !state.round) return;
        if(state.round.answers.has(msg.uid)) return;
        const tNow = now();
        const elapsed = (tNow - state.round.startedAt)/1000;
        const remaining = Math.max(0, state.round.duration - elapsed);
        const choice = msg.choice;
        const correct = (choice === state.round.correct);
        const points = correct ? Math.round(500 + 500*(remaining/state.round.duration)) : 0;
        state.round.answers.set(msg.uid, {choice, t: tNow, correct, points});
        const p = state.players.get(msg.uid);
        if(p){ p.score = (p.score|0) + points; }
        updateLive();            // não mostra pontuação agora
        break;
      case 'request_sync':
        broadcastLobby(false);
        if(state.running && state.round){
          send({type:'start', q: currentQuestion(), duration: state.round.duration, idx: state.idx});
        }
        break;
    }
  });

  // Abrir slides
  openHostBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    window.open('host.html', 'quizHost', 'width=1200,height=800');
  });

  // Iniciar jogo (20s)
  startGameBtn.addEventListener('click', async (ev)=>{
    ev.preventDefault();
    if(state.qs.length===0){ toast('Adicione ao menos 1 pergunta.'); return; }
    if(state.running){ toast('Jogo já em andamento.'); return; }
    state.running = true;
    state.idx = 0;
    // resetar pontos
    state.players.forEach(p=> p.score = 0);
    await runGame();
  });

  function currentQuestion(){ return state.qs[state.idx]; }

  
  
  async function runGame(){
    while(state.idx < state.qs.length){
      await startRound(20);
      if(state.idx < state.qs.length-1){
        await sleep(1200);
      } else {
        // última pergunta -> aguardar 5s antes do ranking
        await sleep(5000);
      }
      state.idx++;
    }
    finishGame();
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

  function startRound(seconds){
    return new Promise((resolve)=>{
      const q = currentQuestion();
      state.round = {
        qid: state.idx,
        startedAt: now(),
        duration: seconds,
        answers: new Map(),
        correct: q.correct
      };
      send({type:'start', q, duration: seconds, idx: state.idx});

      const startTs = now();
      let lastTick = 0;
      const tickInt = setInterval(()=>{
        const elapsed = Math.floor((now()-startTs)/1000);
        if(elapsed !== lastTick){
          lastTick = elapsed;
          const left = Math.max(0, seconds - elapsed);
          const pct = Math.max(0, Math.min(1, left/seconds));
          send({type:'tick', left, pct});
        }
        if(now()-startTs >= seconds*1000){
          clearInterval(tickInt);
          revealAndResolve();
        }
      }, 100);

      function revealAndResolve(){
        const counts = [0,0,0,0];
        for(const a of state.round.answers.values()) counts[a.choice]++;
        const total = Math.max(1, Array.from(state.players.values()).length);
        const perc = counts.map(c=> Math.round((c/total)*100));
        // só agora mostramos as pontuações reais no lobby/slides
        broadcastLobby(true);
        send({type:'end_question', counts, perc, correctIndex: state.round.correct});
        resolve();
      }
    });
  }

  function updateLive(){
    const counts = [0,0,0,0];
    for(const a of state.round.answers.values()) counts[a.choice]++;
    const total = Math.max(1, Array.from(state.players.values()).length);
    const perc = counts.map(c=> Math.round((c/total)*100));
    send({type:'live', counts, perc});
    broadcastLobby(false); // ainda sem pontuação
  }

  function finishGame(){
    state.running = false;
    const list = Array.from(state.players.values())
      .sort((a,b)=> (b.score|0)-(a.score|0));
    const top3 = list.slice(0,3);
    send({type:'end_game', leaderboard: list, top3});
    toast('Jogo encerrado!');
    // Reseta pontos para próximo quiz
    state.players.forEach(p=> p.score=0);
    broadcastLobby(false);
  }

  // Sync inicial
  window.addEventListener('load', ()=>{
    send({type:'request_sync'});
  });
})();
