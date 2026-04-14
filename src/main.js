import speechService from './services/SpeechService.js';
import StorageService from './services/StorageService.js';
import IntentEngine from './services/IntentEngine.js';

// ── Helpers ──
const el=id=>document.getElementById(id);
const now=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};

window.isEmpty = true;
window.isListening = false;

// ── Auth Logic ──
window.switchAuthTab = function(tab) {
  const tabs = el('auth-tabs').children;
  tabs[0].classList.toggle('active', tab === 'login');
  tabs[1].classList.toggle('active', tab === 'signup');
  
  el('name-grp').style.display = tab === 'signup' ? 'flex' : 'none';
  el('auth-btn').innerText = tab === 'signup' ? 'Sign Up' : 'Log In';
}

window.handleAuth = function(e) {
  e.preventDefault();
  const name = el('auth-name').value;
  const email = el('auth-email').value;
  
  // Simulated authentication
  localStorage.setItem('eduvox_auth', email);
  window.toast('✅', 'Successfully authenticated!');
  
  setTimeout(() => {
    el('auth-view').style.display = 'none';
    el('main-app').style.display = 'flex';
  }, 500);
}

window.logout = function() {
  localStorage.removeItem('eduvox_auth');
  window.toast('🚪', 'Logged out successfully');
  setTimeout(() => {
    location.reload();
  }, 800);
}

// ── Sidebar ──
window.toggleSidebar = function(){el('sidebar').classList.toggle('collapsed')}
window.generateReportCard = function() {
  const stats = StorageService.getDashboardStats();
  const mastery = stats.learningMemory.topicMastery || {};
  const topics = Object.keys(mastery);
  
  let reportHTML = `
    <div style="background:#fff; color:#000; padding:40px; border-radius:8px; font-family:'Courier New', Courier, monospace; box-shadow:0 0 20px rgba(0,0,0,0.5)">
      <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:20px; margin-bottom:20px">
        <h1 style="margin:0; font-size:24px">EDUVOX ACADEMIC REPORT</h1>
        <div style="font-size:12px">Student Learning Twin: ${StorageService.getSettings().profile.name || 'Scholar'}</div>
        <div style="font-size:10px">${new Date().toLocaleDateString()}</div>
      </div>
      
      <div style="margin-bottom:20px">
        <h3 style="border-bottom:1px solid #ddd">SUBJECT MASTERY</h3>
        ${stats.subjects.map(s => `<div style="display:flex; justify-content:space-between; margin:4px 0"><span>${s.name}</span><span>${s.progress}%</span></div>`).join('')}
      </div>

      <div style="margin-bottom:20px">
        <h3 style="border-bottom:1px solid #ddd">TOPIC PERFORMANCE</h3>
        ${topics.slice(0,5).map(t => {
          const pct = Math.round((mastery[t].correct/mastery[t].total)*100);
          return `<div style="display:flex; justify-content:space-between; margin:4px 0"><span>${t}</span><span>${pct}% Accuracy</span></div>`;
        }).join('')}
      </div>

      <div style="text-align:center; margin-top:30px; padding-top:20px; border-top:2px double #000">
        <div style="font-size:12px">PREDICTED EXAM SCORE</div>
        <div style="font-size:32px; font-weight:900">${el('predicted-score')?.innerText || '85%'}</div>
        <div style="font-size:10px; margin-top:10px">Validated by EduVox AI Engine</div>
      </div>
      
      <button class="btn-primary" style="margin-top:20px; width:100%; height:40px" onclick="this.parentElement.remove()">Close Report</button>
    </div>
  `;

  window.addMsg(reportHTML, false);
  window.toast('📋', 'Report Card Generated!');
  StorageService.logSessionEvent('Report Generated', { topic: 'All', status: navigator.onLine ? 'Online' : 'Offline' });
}

window.checkOnlineStatus = function() {
  const offlineInd = el('offline-indicator');
  if(!offlineInd) return;
  
  if (navigator.onLine) {
    offlineInd.style.display = 'none';
  } else {
    offlineInd.style.display = 'flex';
  }
}

window.addEventListener('online', window.checkOnlineStatus);
window.addEventListener('offline', window.checkOnlineStatus);
window.checkOnlineStatus();
setInterval(window.checkOnlineStatus, 5000);
el('sidebar').classList.add('collapsed');

window.addEventListener('resize',()=>{
  if(window.innerWidth<640)el('sidebar').classList.add('collapsed');
});
if(window.innerWidth<640)el('sidebar').classList.add('collapsed');

// ── View switching ──
window.switchView = function(v){
  const views = ['chat', 'dashboard', 'notes', 'settings', 'help', 'quiz-stats', 'past-chats', 'saved-topics', 'planner', 'teacher', 'autopilot'];
  const teacherEnabled = StorageService.getState().teacherMode.enabled;
  
  // Show/Hide Teacher Tab in sidebar
  if(el('nav-teacher')) el('nav-teacher').style.display = teacherEnabled ? 'flex' : 'none';
  
  views.forEach(view => {
    const elView = el(`${view}-view`);
    if(elView) {
      if(view === 'chat' || view === 'notes' || view === 'settings') {
         elView.style.display = (v === view) ? 'flex' : 'none';
      } else {
         elView.style.display = (v === view) ? 'block' : 'none';
      }
    }
  });
  
  // Highlight pills if they exist
  if(el('pill-chat')) el('pill-chat').classList.toggle('active', v === 'chat');
  if(el('pill-dash')) el('pill-dash').classList.toggle('active', v === 'dashboard');
  
  // Render logic
  if(v === 'dashboard') renderDashInfo();
  if(v === 'settings') renderSettingsInfo();
  if(v === 'notes') renderNotesInfo();
  if(v === 'quiz-stats') renderQuizStats();
  if(v === 'past-chats') renderPastChats();
  if(v === 'saved-topics') renderSavedTopics();
  if(v === 'planner') renderPlanner();
  if(v === 'teacher') renderTeacherView();
  if(v === 'autopilot') renderAutopilot();
}
window.navClick = function(item,v){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  item.classList.add('active');
  window.switchView(v);
  if(window.innerWidth <= 768) el('sidebar').classList.add('collapsed');
}

// ── Toast ──
window.toast = function(icon,msg){
  const s=el('toast-stack');
  const t=document.createElement('div');
  t.className='toast';
  t.innerHTML=`<span style="font-size:16px">${icon}</span><span>${msg}</span>`;
  s.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),250)},3000);
}

// ── Empty state ──
const CHIPS=['Explain photosynthesis','Quiz me on physics','Study plan for calculus','Summarize World War II','What is machine learning?'];
window.showEmpty = function(){
  el('msgs').innerHTML=`<div class="empty">
    <div class="empty-visual">
      <div class="empty-ring"></div>
      <div class="empty-ring2"></div>
      <div class="empty-core">🎓</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
      <div class="empty-title">Ask me anything</div>
      <div class="empty-desc">I can explain concepts, quiz you, build study plans, and summarize topics — all by voice or text.</div>
    </div>
    <div class="chips">${CHIPS.map(c=>`<div class="chip" onclick="window.pick('${c}')">${c}</div>`).join('')}</div>
  </div>`;
  window.isEmpty=true;
}
window.pick = function(t){el('txt').value=t;window.send()}

// ── Message rendering ──
window.addMsg = function(html,isUser,delay=0){
  return new Promise(res=>{
    setTimeout(()=>{
      const area=el('msgs');
      if(window.isEmpty){area.innerHTML='';window.isEmpty=false}
      area.querySelector('.empty')?.remove();
      const d=document.createElement('div');
      d.className='msg'+(isUser?' user-msg':'');
      const av=isUser
        ?'<div class="m-avatar user-av">Me</div>'
        :'<div class="m-avatar ai-av">🤖</div>';
      if(isUser)d.innerHTML=`<div class="m-body"><div class="bubble user-bub">${html}</div><div class="m-time">${now()}</div></div>${av}`;
      else d.innerHTML=`${av}<div class="m-body">${html}<div class="m-time">${now()}</div></div>`;
      area.appendChild(d);
      area.scrollTop=area.scrollHeight;

      // Save to storage
      StorageService.addChat({ role: isUser ? 'user' : 'assistant', text: html, type: 'html' });
      
      res();
    },delay);
  });
}

function showTyping(){
  const area=el('msgs');
  if(window.isEmpty){area.innerHTML='';window.isEmpty=false}
  const d=document.createElement('div');
  d.className='msg';d.id='typing';
  d.innerHTML=`<div class="m-avatar ai-av">🤖</div><div class="m-body"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  area.appendChild(d);
  area.scrollTop=area.scrollHeight;
}
function removeTyping(){el('typing')?.remove()}


// Specific UI renderers (from original logic + hooked to stats)
window.quizHTML = function(topic, sourceContent = null) {
  topic = topic || "General Knowledge";
  const settings = StorageService.getSettings();
  const diff = settings.learning.quizDiff || 'Medium';
  
  // Mixed format generator
  const q1 = { q: `Explain the core significance of ${topic} in modern systems.`, type: 'short' };
  const q2 = { q: `Which of the following describes the fundamental component of ${topic}?`, opts: ['Scale', 'Precision', 'Logic', 'Performance'], correct: 'Logic', type: 'mcq' };
  
  return `<div class="quiz-card" style="border-top-color:var(--accent2)">
    <div class="card-label" style="color:var(--accent2)">🧪 Smart Quiz: ${topic} [${diff}]</div>
    <div style="font-size:11px; color:var(--text3); margin-bottom:12px">Based on ${sourceContent ? 'your notes' : 'the system database'}</div>
    
    <div style="display:flex; flex-direction:column; gap:20px">
      <!-- MCQ Q -->
      <div>
        <div class="quiz-q">${q2.q}</div>
        <div class="opts">
          ${q2.opts.map(o => `<button class="opt" onclick="window.answerQ(this, ${o === q2.correct})">${o}</button>`).join('')}
        </div>
      </div>
      
      <!-- Short Answer Q -->
      <div style="border-top:1px dashed var(--border); padding-top:16px">
        <div class="quiz-q">${q1.q}</div>
        <textarea class="sub-add-in" style="width:100%; height:60px; font-size:12px; margin-top:8px" placeholder="Type your explanation here..."></textarea>
        <button class="btn-primary" style="margin-top:10px; width:100%" onclick="window.gradeShortAnswer(this, '${topic}')">Submit Explanation</button>
      </div>
    </div>
  </div>`;
}

window.gradeShortAnswer = function(btn, topic) {
  const val = btn.previousElementSibling.value.trim();
  if (val.length < 10) {
    window.toast('⚠️', 'Please provide a more detailed explanation.');
    return;
  }
  
  btn.disabled = true;
  btn.innerText = "Grading...";
  
  setTimeout(() => {
    btn.className = "btn-ghost";
    btn.style.borderColor = "var(--green)";
    btn.innerText = "AIGrade: 85% Match - Well Explained!";
    StorageService.addXP(30);
    window.toast('✨', 'Explanation graded! +30 XP');
    StorageService.addNotification(`Teach-back graded: ${topic}. Mastery increased!`, 'quiz');
  }, 1000);
}

window.answerQ = function(btn, correct, topicName = 'General') {
  const opts = btn.closest('.opts').querySelectorAll('.opt');
  opts.forEach(o => o.disabled = true);
  
  if (correct) {
    btn.className = 'opt correct';
    window.toast('✅', 'Correct! Well done! +10 XP');
    StorageService.addXP(10);
    StorageService.detectDoubt(topicName, false);
    StorageService.logSessionEvent('Correct Answer', { topic: topicName });
  } else {
    btn.className = 'opt wrong';
    StorageService.logSessionEvent('Wrong Answer', { topic: topicName });
    
    // Mistake Explanation Engine
    const explanation = `<strong>Conceptual Correction:</strong><br>You selected the wrong option. In <b>${topicName}</b>, the key is understanding the relationship between structure and performance. For example, confusing LIFO (Stack) with FIFO (Queue) is common. Focus on the flow of data!`;
    const expDiv = document.createElement('div');
    expDiv.className = 'bubble ai-bub';
    expDiv.style.marginTop = '12px';
    expDiv.style.borderLeft = '4px solid var(--red)';
    expDiv.innerHTML = explanation;
    btn.closest('.quiz-card').appendChild(expDiv);
    
    // AI Doubt Detection
    if (StorageService.detectDoubt(topicName, true)) {
       setTimeout(() => {
          window.showDoubtIntervention(topicName);
       }, 500);
    }
  }
  
  StorageService.trackQuiz(correct);
  renderDashInfo(); 
}

window.showDoubtIntervention = function(topic) {
  const html = `<div style="padding:20px; text-align:center; border:2px solid var(--accent); background:rgba(0,123,255,0.05); border-radius:16px">
    <div style="font-size:32px; margin-bottom:12px">🤔</div>
    <h3 style="color:var(--accent)">You seem to be struggling with ${topic}</h3>
    <p style="font-size:12px; color:var(--text3); margin-bottom:20px">I've noticed a few mistakes in a row. Would you like me to break this down in <b>ELI5 (Simple) Mode</b>?</p>
    <div style="display:flex; gap:10px; justify-content:center">
       <button class="btn-primary" onclick="window.pick('Explain ${topic} like I am 5')">Yes, simplify it</button>
       <button class="btn-ghost" onclick="this.closest('.msg').remove()">No, I'll keep trying</button>
    </div>
  </div>`;
  window.addMsg(html, false);
  speechService.speak(`It looks like you're having a hard time with ${topic}. Should I simplify the explanation for you?`);
}

window.planHTML = function(){
  const rows=[
    ['Session 1','Core concepts overview','45 min'],
    ['Session 2','Deep dive — key theorems','60 min'],
    ['Session 3','Practice set A','45 min'],
  ];
  return`<div class="plan-card">
    <div class="card-label" style="color:var(--teal)">📅 Basic Study Plan</div>
    <div class="plan-rows">${rows.map(r=>`<div class="plan-row"><span class="plan-day">${r[0]}</span><span class="plan-task">${r[1]}</span><span class="plan-dur">${r[2]}</span></div>`).join('')}</div>
  </div>`;
}

window.survivalHTML = function(){
  StorageService.addXP(50);
  const rows=[
    ['CRITICAL','Memorize main 3 formulas','20 min'],
    ['HIGH','Skim previous year questions','30 min'],
    ['QUICK','Flashcard review of terminology','10 min']
  ];
  return`<div class="plan-card" style="border-top-color:var(--red)">
    <div class="card-label" style="color:var(--red)">🔥 Exam Survival Crash Course</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Aggressive 1-hour sprint to maximize score. Stay focused!</div>
    <div class="plan-rows">${rows.map(r=>`<div class="plan-row" style="border-left-color:var(--amber)"><span class="plan-day" style="color:var(--red)">${r[0]}</span><span class="plan-task">${r[1]}</span><span class="plan-dur">${r[2]}</span></div>`).join('')}</div>
  </div>`;
}

window.passiveHTML = function(){
  StorageService.addXP(20);
  return `<div class="quiz-card" style="border-top-color:var(--blue)">
    <div class="card-label" style="color:var(--blue)">🎧 Passive Learning Mode</div>
    <div style="font-size:13px;color:var(--text);margin-bottom:12px">Sit back. I'll read the core concepts to you continuously.</div>
    <div style="display:flex;gap:10px">
      <button class="opt" style="flex:1;text-align:center;background:var(--accent);color:#fff;border:none" onclick="window.toast('▶️', 'Starting audio stream...');">Play</button>
      <button class="opt" style="flex:1;text-align:center" onclick="window.toast('⏸️', 'Audio paused.');">Pause</button>
      <button class="opt" style="flex:1;text-align:center" onclick="window.toast('⏭️', 'Skipping to next topic.');">Skip</button>
    </div>
  </div>`;
}

window.teachbackHTML = function(topic, userText = ""){
  StorageService.addXP(100);
  
  // Simulated analysis logic
  const len = userText.length;
  const wordCount = userText.split(' ').length;
  const score = Math.min(10, Math.floor(wordCount / 5) + 3);
  const isGood = score >= 7;
  
  return `<div class="sum-card" style="border-top-color:${isGood ? 'var(--green)' : 'var(--amber)'}">
    <div class="card-label" style="color:${isGood ? 'var(--green)' : 'var(--amber)'}">🎙️ Teach-Back Analysis</div>
    <div style="font-size:14px;color:var(--text);margin-bottom:8px">Topic: <strong>${topic||'Concept'}</strong></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">${isGood ? 'Excellent effort! You clearly have a grasp of the fundamentals.' : 'A decent start, but there is room for more depth in your explanation.'}</div>
    <div class="sum-items">
      <div class="sum-item">
        <div class="sum-dot" style="background:${score >= 8 ? 'var(--green)' : 'var(--amber)'}"></div>
        <span><strong>Clarity (${score}/10):</strong> ${score >= 8 ? 'Very articulate and precise.' : 'A bit brief, could use more detail.'}</span>
      </div>
      <div class="sum-item">
        <div class="sum-dot" style="background:${wordCount > 15 ? 'var(--green)' : 'var(--red)'}"></div>
        <span><strong>Completeness:</strong> ${wordCount > 15 ? 'Covers the major aspects well.' : 'Missing key context or real-world examples.'}</span>
      </div>
      <div class="sum-item">
        <div class="sum-dot" style="background:var(--accent2)"></div>
        <span><strong>Pro Tip:</strong> ${score < 8 ? 'Try explaining this to a 5-year old next time (Feynman Technique).' : 'Try connecting this to a different subject to solidify memory.'}</span>
      </div>
    </div>
    <div style="margin-top:16px; display:flex; gap:8px">
       <button class="opt" style="flex:1" onclick="window.pick('Give me hints on ${topic}')">💡 Ask for Hints</button>
       <button class="opt" style="flex:1; border-color:var(--green); color:var(--green)" onclick="window.pick('Quiz me on ${topic}')">✅ Take Quiz</button>
    </div>
    <div style="margin-top:12px;text-align:center;font-weight:bold;color:var(--green)">+100 Mastery XP</div>
  </div>`;
}

// ── Send ──
window.send = async function(){
  const input=el('txt');
  const text=input.value.trim();
  if(!text)return;
  input.value='';
  
  await window.addMsg(text,true);
  showTyping();
  
  const intent = IntentEngine.parseIntent(text);
  
  setTimeout(()=>{
    removeTyping();
    let html='';

    // Attempt tracking topic context globally
    if (intent.topic) {
      StorageService.trackTopic(intent.topic);
    }
    
    // Auto-Listen Logic callback
    const onSpeakFinish = () => {
      const settings = StorageService.getSettings();
      if(settings.voice.autoListen && !window.isListening) {
         window.toggleMic(); // Start listening again
      }
    };
    
    // Switch view if it's a dashboard request
    if(intent.type === 'dashboard') {
      window.switchView('dashboard');
      html = `<div class="bubble ai-bub">I've opened your dashboard!</div>`;
      speechService.speak("I've opened your dashboard!", onSpeakFinish);
    } 
    // Render specific widgets inside chat
    else if(intent.type === 'quiz') {
      html = window.quizHTML(intent.topic);
      speechService.speak("Okay, let's start a quick quiz on " + intent.topic, onSpeakFinish);
    } 
    else if(intent.type === 'planner') {
      html = window.planHTML();
      speechService.speak("Here is your study plan.", onSpeakFinish);
    } 
    else if(intent.type === 'survival') {
      html = window.survivalHTML();
      speechService.speak("Initializing Exam Survival Mode.", onSpeakFinish);
    }
    else if(intent.type === 'passive') {
      html = window.passiveHTML();
      speechService.speak("Initializing Passive Learning Audio Stream.", onSpeakFinish);
    }
    else if(intent.type === 'teachback') {
      html = window.teachbackHTML(intent.topic, intent.originalText);
      speechService.speak("I evaluated your explanation. Here is your grade.", onSpeakFinish);
    }
    else if(intent.type === 'notes') {
      const resp = IntentEngine.generateResponse(intent);
      html = `<div class="bubble ai-bub">${resp}</div>`;
      // Automagically save the generated notes to the notebook
      if (intent.topic) StorageService.trackTopic(intent.topic);
      StorageService.addNote({
        title: `${intent.topic || 'New'} Notes`,
        content: resp.replace(/<[^>]*>?/gm, ''),
        tags: ['auto-generated', intent.topic].filter(Boolean)
      });
      window.toast('📝', 'Notes saved to your Notebook');
      renderDashInfo();
      renderNotesInfo();
      speechService.speak(`I've generated and saved notes for ${intent.topic || 'you'}.`, onSpeakFinish);
    }
    else if(intent.type === 'mood') {
      const resp = IntentEngine.generateResponse(intent);
      html = `<div class="bubble ai-bub" style="background:rgba(255,255,255,0.1); border-color:var(--text)">${resp}</div>`;
      speechService.speak(resp.replace(/<[^>]*>?/gm, ''), onSpeakFinish); 
    }
    // Regular text response generated by our IntentEngine
    else {
      const resp = IntentEngine.generateResponse(intent);
      // Inject note saver button
      const cleanText = encodeURIComponent(resp.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...');
      html = `<div class="bubble ai-bub">${resp}
        <div style="margin-top:8px; border-top:1px dashed var(--border2); padding-top:8px; display:flex; justify-content:space-between; gap:8px">
          <button onclick="window.pick('Where is ${intent.topic || 'this topic'} used in the real world?')" style="background:transparent; border:none; color:#00bfff; font-size:11.5px; cursor:pointer;" title="See industry applications">🏭 Real-World</button>
          <button onclick="window.pick('Let me explain ${intent.topic || 'this topic'}')" style="background:transparent; border:none; color:var(--accent2); font-size:11.5px; cursor:pointer;" title="Explain this back to AI">🎙️ Teach-Back</button>
          <button onclick="window.saveNote(decodeURIComponent('${cleanText}'))" style="background:transparent; border:none; color:var(--text2); font-size:11.5px; cursor:pointer;" title="Save snippet to subject notes">📝 Save Note</button>
        </div>
      </div>`;
      
      // Synthesis backend check
      speechService.speak(resp.replace(/<[^>]*>?/gm, ''), onSpeakFinish); 
    }
    
    window.addMsg(html,false);
  }, 900+Math.random()*700);
}

// ── Mic ──
window.toggleMic = function(){
  const m=el('mic'),lb=el('listen-bar'),inp=el('txt');

  if(window.isListening){
    // Stop manually
    speechService.stopListening();
  } else {
    // Start listening
    m.classList.add('on');
    lb.classList.add('show');
    inp.placeholder='Listening… speak now';
    window.toast('🎤','Listening started');
    
    speechService.startListening(
      (final, interim) => {
        if (interim) {
          inp.value = "";
          inp.placeholder = `Listening: "${interim}..."`;
        }
        if (final) {
          inp.value = final;
          window.send();
          // We don't stop listening in continuous mode, but we reset visuals
          inp.placeholder = 'Processing your request...';
        }
      },
      (error) => {
        m.classList.remove('on');
        lb.classList.remove('show');
        inp.placeholder='Error capturing voice. Try again.';
      },
      () => {
        m.classList.remove('on');
        lb.classList.remove('show');
        inp.placeholder='Ask me anything to start learning…';
      }
    );
  }
}

// ── Dashboard logic ──
window.onAddSubject = function() {
  const inp = el('new-sub-in');
  const val = inp.value.trim();
  if(!val) return;
  StorageService.addSubject(val);
  inp.value = '';
  window.toast('✅', `Subject '${val}' added`);
  StorageService.addNotification(`New subject added: ${val}`, 'info');
  renderDashInfo();
}

window.deleteSubject = function(id) {
  StorageService.deleteSubject(id);
  window.toast('🗑️', 'Subject deleted');
  renderDashInfo();
}

window.changeActiveSubject = function(id) {
  StorageService.setActiveSubjectId(id);
  window.toast('🔄', 'Active subject changed');
  renderDashInfo();
}

function renderDashInfo() {
  const stats = StorageService.getDashboardStats();
  const acc = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers/stats.totalQuestions)*100) : 0;
  
  el('st-acc').innerText = `${acc}%`;
  el('st-qz').innerText = `${stats.totalQuestions} questions answered`;
  el('st-str').innerText = `${stats.streakCount} days`;
  el('st-top').innerText = `${stats.topics.length}`;
  
  // Rank and XP logic
  const levelNames = ['Novice', 'Apprentice', 'Scholar', 'Adept', 'Master', 'Grandmaster'];
  const lvlIdx = Math.min((stats.level === 'Beginner' ? 0 : 
                           stats.level === 'Learner' ? 1 : 
                           stats.level === 'Pro' ? 2 : 
                           stats.level === 'Master' ? 3 : 0), levelNames.length - 1);
                           
  el('st-lvl').innerText = `Level ${lvlIdx + 1} - ${levelNames[lvlIdx]}`;
  
  const xpInLevel = stats.xp % 100;
  el('st-xpbar').style.width = `${xpInLevel}%`;
  el('st-xptext').innerText = `${xpInLevel} / 100 XP to next level`;
  
  // Render Subjects
  const activeId = StorageService.getActiveSubjectId();
  const sel = el('active-subject-select');
  if(sel) {
    sel.innerHTML = `<option value="">Global (No Subject)</option>`;
    stats.subjects.forEach(s => {
      sel.innerHTML += `<option value="${s.id}" ${s.id === activeId ? 'selected' : ''}>${s.name}</option>`;
    });
  }
  
  const grid = el('subjects-grid');
  if(grid) {
    if(stats.subjects.length === 0) {
      grid.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text3); font-size: 13px; border:1px dashed var(--border); border-radius:12px; grid-column:1/-1; background:var(--bg3)">
        <div style="font-size:24px;margin-bottom:8px">📓</div>
        <div>No subjects added yet.</div>
        <button class="btn-ghost" style="color:var(--text);margin-top:8px" onclick="el('new-sub-in').focus()">Add your first subject to start tracking progress 🚀</button>
      </div>`;
    } else {
      grid.innerHTML = '';
      stats.subjects.forEach(s => {
        const hasSyllabus = s.syllabus && s.syllabus.length > 0;
        grid.innerHTML += `
        <div class="subject-card ${s.id === activeId ? 'active' : ''}" style="${s.id === activeId ? 'border-color:var(--text);background:rgba(255,255,255,0.05)' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="sc-title" onclick="window.changeActiveSubject('${s.id}')" style="cursor:pointer">${s.name}</div>
            <button class="sc-del" onclick="event.stopPropagation(); window.deleteSubject('${s.id}')">×</button>
          </div>
          
          <div class="sc-stat"><span>Mastery</span><span>${s.progress}%</span></div>
          <div class="pbar" style="margin-top:8px"><div class="pfill" style="width:${s.progress}%; background:var(--text)"></div></div>
          
          <div style="margin-top:16px; border-top:1px solid var(--border2); padding-top:12px">
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; font-weight:800; margin-bottom:8px">Syllabus Chapters</div>
            ${hasSyllabus ? `
              <div style="display:flex; flex-direction:column; gap:4px; max-height:120px; overflow-y:auto; padding-right:4px">
                ${s.syllabus.map(chap => `
                  <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text2); cursor:pointer; background:rgba(255,255,255,0.01); padding:4px 8px; border-radius:4px" onclick="event.stopPropagation()">
                    <span>${chap.name}</span>
                    <input type="checkbox" ${chap.completed ? 'checked' : ''} onchange="StorageService.toggleChapter('${s.id}', '${chap.name}'); renderDashInfo();">
                  </label>
                `).join('')}
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:8px">
                <select class="sub-add-in" style="font-size:11px; padding:6px; width:100%" onchange="if(this.value){ StorageService.importSyllabus('${s.id}', this.value); renderDashInfo(); }">
                  <option value="">+ Import Predefined Syllabus</option>
                  <option value="dbms">DBMS (Standard College)</option>
                  <option value="os">Operating Systems (Standard)</option>
                  <option value="ds">Data Structures & Algo</option>
                </select>
                <div style="font-size:10px; color:var(--text3); text-align:center">Or keep learning to build a custom syllabus.</div>
              </div>
            `}
          </div>

          ${s.progress >= 80 ? `
            <button onclick="event.stopPropagation(); window.startBossBattle('${s.name}')" class="btn-primary" style="margin-top:16px; width:100%; height:40px; background:linear-gradient(135deg, #ff4e50, #f9d423); border:none; color:#000; font-weight:800; font-size:12px; letter-spacing:1px; box-shadow:0 0 15px rgba(255,78,80,0.3)">
              🔥 BOSS BATTLE AVAILABLE
            </button>
          ` : ''}
        </div>`;
      });
    }
  }
  
  // Render Subject Progress List
  const tp = el('topic-progress');
  if(tp) {
    if(stats.subjects.length === 0) tp.innerHTML = '<div style="padding: 20px; color: var(--text3); font-size: 13px; text-align:center; background:var(--bg3); border-radius:10px">Start learning to see progress metrics.</div>';
    else {
      tp.innerHTML = '';
      stats.subjects.forEach(s => {
        tp.innerHTML += `<div class="topic-item"><div class="topic-meta"><span class="topic-name">${s.name}</span><span class="topic-pct">${s.progress}%</span></div><div class="pbar"><div class="pfill" style="width:${s.progress}%;background:var(--text)"></div></div></div>`;
      });
    }
  }

  // Render Smart Revision
  const rl = el('revision-list');
  if(rl) {
    let dueTopics = [];
    const now = Date.now();
    stats.subjects.forEach(s => {
      s.revisionDates.forEach(rd => {
        if(rd.reviewIndex < 3 && rd.nextReview[rd.reviewIndex] <= now) {
          dueTopics.push({ subj: s.name, topic: rd.topic });
        }
      });
    });

    if(dueTopics.length === 0) {
      rl.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text3); font-size: 13px; background:var(--bg3); border-radius:10px; border:1px dashed var(--border)">
        ${stats.topics.length === 0 ? 'Start learning to enable smart revision.' : 'No topics due for revision today. Relax! ☕'}
      </div>`;
    } else {
      rl.innerHTML = dueTopics.map(dt => `<div style="padding:12px; background:var(--bg3); border-left:3px solid var(--text); border-radius:8px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
        <div><strong style="color:var(--text3);font-size:10px;text-transform:uppercase;display:block;margin-bottom:2px">${dt.subj}</strong>${dt.topic}</div>
        <button onclick="window.pick('Quiz me on ${dt.topic}')" style="padding:6px 10px; background:var(--surface2); border:1px solid var(--border); color:var(--text); border-radius:6px; cursor:pointer; font-size:11px">Review</button>
      </div>`).join('');
    }
  }

  // Activity Feed
  const af = el('activity-feed');
  if(af) {
    if(stats.activityFeed.length === 0) af.innerHTML = `<div style="padding:12px; color: var(--text3); font-size: 12px; text-align:center">No recent activity. Ask a question to begin!</div>`;
    else {
      af.innerHTML = stats.activityFeed.map(a => `<div style="font-size:12px; padding:8px 12px; background:var(--bg3); border-radius:8px; border-left:2px solid var(--border)">${a.text} <span style="font-size:10px; color:var(--text3); float:right">${new Date(a.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>`).join('');
    }
  }

  // Notes Feed
  const nf = el('notes-feed');
  if(nf) {
    if(stats.notes.length === 0) nf.innerHTML = `<div style="padding:12px; color: var(--text3); font-size: 12px; text-align:center">
      No notes saved yet.
      <button class="btn-ghost" style="display:block;width:100%;margin-top:4px" onclick="window.switchView('notes'); window.openNoteEditor()">Create Note</button>
    </div>`;
    else {
      nf.innerHTML = stats.notes.slice(0, 3).map(n => {
         const subContext = n.subjectId ? (stats.subjects.find(s=>s.id === n.subjectId)?.name || 'Unknown Subject') : 'Global';
         return `<div onclick="window.switchView('notes'); window.openNoteEditor('${n.id}')" style="cursor:pointer; font-size:12px; padding:8px 12px; background:var(--bg3); border-radius:8px; border-left:2px solid var(--text)">
            <strong style="color:var(--text3); font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px">${subContext}</strong>
            ${n.title || n.content.substring(0, 30)+'...'}
         </div>`;
      }).join('');
      nf.innerHTML += `<button class="btn-ghost" style="width:100%;font-size:11px" onclick="window.switchView('notes')">View all notes →</button>`;
    }
  }

  // --- Performance Insights Section ---
  const piContent = el('performance-insights-content');
  if(piContent) {
    if (stats.subjects.length === 0) {
      piContent.innerHTML = `<div style="text-align:center; color:var(--text3); font-size:12px; grid-column:1/-1; padding:20px">Add subjects to see detailed performance analysis.</div>`;
    } else {
      // Find Strongest & Weakest based on progress/accuracy
      const sorted = [...stats.subjects].sort((a,b) => (b.progress) - (a.progress));
      const strongest = sorted[0];
      const weakest = sorted.length > 1 ? sorted[sorted.length-1] : null;

      // Find Recommendation (Topic with lowest progress or simply the one in the weakest subject)
      let recommendation = "Start a new quiz";
      if(weakest && weakest.topics.length > 0) {
        recommendation = `Revise ${weakest.topics[0]}`;
      } else if(strongest && strongest.topics.length > 0) {
        recommendation = `Master ${strongest.topics[strongest.topics.length-1]}`;
      }

      piContent.innerHTML = `
        <div style="border-right:1px solid var(--border2); padding-right:10px">
          <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:8px">Strongest</div>
          <div style="font-size:14px; font-weight:700; color:var(--green)">🏆 ${strongest.name}</div>
          <div style="font-size:11px; color:var(--text2); margin-top:4px">${strongest.progress}% Mastery achieved</div>
        </div>
        ${weakest && weakest.id !== strongest.id ? `
        <div style="border-right:1px solid var(--border2); padding-right:10px">
          <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:8px">Needs Work</div>
          <div style="font-size:14px; font-weight:700; color:var(--pink)">⚠️ ${weakest.name}</div>
          <div style="font-size:11px; color:var(--text2); margin-top:4px">Boost your accuracy from ${weakest.progress}%</div>
        </div>
        ` : ''}
        <div>
          <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:8px">Recommended</div>
          <div style="font-size:14px; font-weight:700; color:var(--accent2)">✨ ${recommendation}</div>
          <div style="font-size:11px; color:var(--text2); margin-top:4px" onclick="window.pick('${recommendation}')" class="link-hover">Start learning now →</div>
        </div>
      `;
    }
  }

  window.checkSmartTips();
  window.renderBadges(stats.badges);
  
  // Digital Twin Updates
  const twinMem = stats.learningMemory;
  const mastery = twinMem.topicMastery || {};
  const topics = Object.keys(mastery);
  
  if (topics.length > 0) {
    const sorted = topics.sort((a,b) => (mastery[b].correct/mastery[b].total) - (mastery[a].correct/mastery[a].total));
    const strong = sorted.slice(0, 2);
    const weak = sorted.reverse().slice(0, 2);
    
    if(el('twin-strong')) el('twin-strong').querySelector('.twin-val').innerText = strong.join(', ');
    if(el('twin-weak')) el('twin-weak').querySelector('.twin-val').innerText = weak.join(', ');
  }

  // Session Replay Timeline
  const sessions = stats.sessions || [];
  const timeline = el('session-timeline');
  if (timeline) {
    if (sessions.length === 0) {
      timeline.innerHTML = `<div style="position:absolute; left:7px; top:0; bottom:0; width:2px; background:var(--border2)"></div>
                            <div style="padding:10px 0; color:var(--text3); font-size:12px">No recent sessions detected. Start learning!</div>`;
    } else {
      timeline.innerHTML = `<div style="position:absolute; left:7px; top:0; bottom:0; width:2px; background:var(--border2)"></div>`;
      sessions.forEach(s => {
        const timeDiff = Math.abs(new Date() - new Date(s.time));
        const mins = Math.floor(timeDiff / 60000);
        const timeLabel = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`;
        
        timeline.innerHTML += `
          <div style="position:relative; margin-bottom:20px; padding-left:12px">
            <div style="position:absolute; left:-21px; top:4px; width:10px; height:10px; border-radius:50%; background:var(--accent2); border:2px solid var(--bg)"></div>
            <div style="font-size:12px; font-weight:700; color:var(--text)">${s.action}</div>
            <div style="font-size:10px; color:var(--text3)">${timeLabel} • ${s.details.topic || 'General'}</div>
          </div>
        `;
      });
    }
  }

  // Predicted Exam Score
  const accuracy = stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions) * 100 : 0;
  const masteryCount = Object.keys(stats.learningMemory.topicMastery || {}).length;
  const prediction = Math.min(100, Math.round(accuracy + (masteryCount * 0.5)));
  if (el('predicted-score')) {
     el('predicted-score').innerText = stats.totalQuestions > 10 ? `${prediction}%` : `--%`;
  }
}

window.seedDemoData = function() {
  const state = StorageService.getState();
  if (state.dashboardStats.subjects.length > 0) {
    window.toast('ℹ️', 'Demo data skipped (You already have data)');
    return;
  }
  
  StorageService.addSubject('DBMS');
  StorageService.addSubject('Operating Systems');
  StorageService.addNote({ title: 'SQL Joins', content: 'Inner, Left, Right, and Full joins are used to combine records from two tables.', subjectId: state.dashboardStats.subjects[0]?.id });
  StorageService.addNote({ title: 'Deadlock', content: 'A situation where two or more processes are unable to proceed because each is waiting for the other...', subjectId: state.dashboardStats.subjects[1]?.id });
  StorageService.addXP(45);
  StorageService.trackTopic('Normalization');
  
  window.toast('✨', 'Demo data loaded successfully!');
  renderDashInfo();
}

// ── Search & Notifications Logic ──
window.toggleSearch = function(open) {
  const overlay = el('search-overlay');
  overlay.style.display = open ? 'flex' : 'none';
  if (open) {
    el('global-search-in').value = '';
    el('global-search-in').focus();
    el('search-results-panel').style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.toggleSearch(false);
    el('noti-dropdown').style.display = 'none';
  }
});

document.addEventListener('click', (e) => {
  const d = el('noti-dropdown');
  const bell = e.target.closest('.hbtn'); // Approximate check for the bell btn
  if (d && d.style.display === 'flex' && !d.contains(e.target) && !bell) {
    d.style.display = 'none';
  }
});

window.globalSearch = function(q) {
  const val = q.trim().toLowerCase();
  const panel = el('search-results-panel');
  if (!val) { panel.style.display = 'none'; return; }
  
  const stats = StorageService.getDashboardStats();
  const notes = StorageService.getNotes();
  const history = StorageService.getHistory();
  
  const results = {
    subjects: stats.subjects.filter(s => s.name.toLowerCase().includes(val)),
    notes: notes.filter(n => n.title.toLowerCase().includes(val) || n.content.toLowerCase().includes(val)),
    topics: stats.topics.filter(t => t.name.toLowerCase().includes(val)),
    chats: history.filter(h => h.text.toLowerCase().includes(val))
  };

  const total = results.subjects.length + results.notes.length + results.topics.length + results.chats.length;
  
  if (total === 0) {
    panel.innerHTML = `<div class="noti-empty">No results found for "${q}"</div>`;
  } else {
    let html = "";
    if (results.subjects.length) {
      html += `<div class="search-res-group"><div class="search-res-group-title">Subjects</div>`;
      results.subjects.forEach(s => {
        html += `<div class="search-res-item" onclick="window.toggleSearch(false); window.changeActiveSubject('${s.id}'); window.switchView('dashboard')">
          <div class="search-res-icon">📚</div>
          <div class="search-res-info"><div class="search-res-title">${s.name}</div><div class="search-res-desc">View in Dashboard</div></div>
        </div>`;
      });
      html += `</div>`;
    }
    if (results.notes.length) {
      html += `<div class="search-res-group"><div class="search-res-group-title">Notes</div>`;
      results.notes.forEach(n => {
        html += `<div class="search-res-item" onclick="window.toggleSearch(false); window.switchView('notes'); window.openNoteEditor('${n.id}')">
          <div class="search-res-icon">📝</div>
          <div class="search-res-info"><div class="search-res-title">${n.title}</div><div class="search-res-desc">${n.content.substring(0, 40)}...</div></div>
        </div>`;
      });
      html += `</div>`;
    }
    if (results.topics.length) {
      html += `<div class="search-res-group"><div class="search-res-group-title">Topics</div>`;
      results.topics.forEach(t => {
        html += `<div class="search-res-item" onclick="window.toggleSearch(false); window.pick('Explain ${t.name}'); renderDashInfo();">
          <div class="search-res-icon">📖</div>
          <div class="search-res-info"><div class="search-res-title">${t.name}</div><div class="search-res-desc">Reopen explanation</div></div>
        </div>`;
      });
      html += `</div>`;
    }
    panel.innerHTML = html;
  }
  panel.style.display = 'block';
}

window.toggleNotifications = function() {
  const d = el('noti-dropdown');
  const isOpen = d.style.display === 'flex';
  d.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) { 
    // Mark all as read when opened? Or just leave it.
    // Marking specific ones as read is better.
  }
}

window.renderNotifications = function() {
  const list = StorageService.getNotifications();
  const unread = list.filter(n => !n.read).length;
  const badge = el('noti-badge');
  badge.style.display = unread > 0 ? 'block' : 'none';
  
  const container = el('noti-list');
  if (list.length === 0) {
    container.innerHTML = `<div class="noti-empty">No notifications yet</div>`;
    return;
  }
  
  container.innerHTML = list.map(n => `
    <div class="noti-item ${n.read ? '' : 'unread'}" onclick="StorageService.markNotificationRead('${n.id}')">
      <div class="search-res-icon">${n.type === 'quiz' ? '🧪' : n.type === 'streak' ? '🔥' : n.type === 'note' ? '📝' : '🔔'}</div>
      <div style="flex:1">
        <div class="noti-msg">${n.message}</div>
        <div class="noti-time">${window.timeAgo(n.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

window.clearNotifications = function() {
  StorageService.clearNotifications();
}

window.timeAgo = function(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

// Check for revisions to notify
setInterval(() => {
  const stats = StorageService.getDashboardStats();
  const now = Date.now();
  stats.subjects.forEach(s => {
    s.revisionDates.forEach(rd => {
      if(rd.reviewIndex < 3 && rd.nextReview[rd.reviewIndex] <= now && !rd.notified) {
        StorageService.addNotification(`Time to revise ${rd.topic} in ${s.name}`, 'revision');
        rd.notified = true; // prevent spam
      }
    });
  });
  StorageService.saveState({ ...StorageService.getState(), dashboardStats: stats });
}, 60000); // check every min

// ── Settings Logic ──
window.setTab = function(tabName, elNode) {
  document.querySelectorAll('.set-nav').forEach(n => n.classList.remove('active'));
  if(elNode) elNode.classList.add('active');
  
  document.querySelectorAll('.set-panel').forEach(p => p.style.display = 'none');
  const target = el('set-' + tabName);
  if(target) target.style.display = 'block';
}

function renderSettingsInfo() {
  const settings = StorageService.getSettings();
  const stats = StorageService.getDashboardStats();
  
  // Profile
  if(el('set-prof-name')) el('set-prof-name').innerText = settings.profile.name || localStorage.getItem('eduvox_auth') || 'Student';
  if(el('set-prof-rank')) el('set-prof-rank').innerText = stats.level;
  if(el('set-prof-xp')) el('set-prof-xp').innerText = stats.xp;
  if(el('set-in-name')) el('set-in-name').value = settings.profile.name;
  
  // Voice
  if(el('set-v-enable')) el('set-v-enable').checked = settings.voice.enabled;
  if(el('set-v-lang')) el('set-v-lang').value = settings.voice.lang;
  if(el('set-v-rate')) el('set-v-rate').value = settings.voice.rate.toString();
  if(el('set-v-auto')) el('set-v-auto').checked = settings.voice.autoListen;
  
  // Learning
  if(el('set-l-style')) el('set-l-style').value = settings.learning.style;
  if(el('set-l-diff')) el('set-l-diff').value = settings.learning.quizDiff;
  if(el('set-l-adapt')) el('set-l-adapt').checked = settings.learning.adaptiveQuizzes;
  if(el('set-l-teach')) el('set-l-teach').checked = settings.learning.teachBack;
  
  // Notifications
  if(el('set-n-rem')) el('set-n-rem').checked = settings.notifications.reminders;
  if(el('set-n-time')) el('set-n-time').value = settings.notifications.time;
  if(el('set-n-sp')) el('set-n-sp').checked = settings.notifications.spRevise;
  
  // Appearance
  if(el('set-a-theme')) el('set-a-theme').value = settings.appearance.theme;
  if(el('set-a-font')) el('set-a-font').value = settings.appearance.fontSize;
  applyTheme(settings.appearance.theme, settings.appearance.fontSize);
  
  // Privacy
  if(el('set-p-hist')) el('set-p-hist').checked = settings.privacy.saveHistory;
}

window.saveSetting = function(category, key, value) {
  StorageService.updateSettings(category, { [key]: value });
  if(category !== 'appearance') window.toast('✅', `Settings saved`);
}

window.saveTheme = function(val) {
  window.saveSetting('appearance', 'theme', val);
  applyTheme(val, null);
}

function applyTheme(theme, font) {
  if(theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  
  if(font) {
    document.body.style.fontSize = font==='small'?'12px':font==='large'?'16px':'14px';
  }
}

window.exportToJSON = function() {
  StorageService.exportData();
  window.toast('💾', 'Exporting data...');
}

window.promptDelete = function() {
  if(confirm("Are you absolutely sure you want to completely wipe all progress, activity, history, and settings? This cannot be undone.")) {
    StorageService.resetProgress();
    window.toast('🗑️', 'Data successfully wiped. Reloading...');
    setTimeout(() => location.reload(), 1500);
  }
}

// ── Notes Logic ──
window.activeNoteId = null;
window.notesFilterSubject = null;
window.notesSearchQuery = "";

function renderNotesInfo() {
  renderNotebooks();
  renderNotesGrid();
  // Populate subject select in editor
  const stats = StorageService.getDashboardStats();
  const sel = el('ed-subject');
  sel.innerHTML = `<option value="">Global (No Subject)</option>`;
  stats.subjects.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

function renderNotebooks() {
  const stats = StorageService.getDashboardStats();
  const container = el('notebook-list');
  container.innerHTML = `
    <div class="notebook-item ${!window.notesFilterSubject ? 'active' : ''}" onclick="window.filterNotesBySubject(null, this)">
      <span>📁</span> <span>All Notes</span>
    </div>
  `;
  stats.subjects.forEach(s => {
    container.innerHTML += `
      <div class="notebook-item ${window.notesFilterSubject === s.id ? 'active' : ''}" onclick="window.filterNotesBySubject('${s.id}', this)">
        <span>📓</span> <span>${s.name}</span>
      </div>
    `;
  });
}

window.filterNotesBySubject = function(id, node) {
  window.notesFilterSubject = id;
  document.querySelectorAll('.notebook-item').forEach(i => i.classList.remove('active'));
  node.classList.add('active');
  renderNotesGrid();
}

function renderNotesGrid() {
  const notes = StorageService.getNotes();
  const container = el('notes-grid');
  
  let filtered = notes;
  if (window.notesFilterSubject) {
    filtered = filtered.filter(n => n.subjectId === window.notesFilterSubject);
  }
  if (window.notesSearchQuery) {
    const q = window.notesSearchQuery.toLowerCase();
    filtered = filtered.filter(n => 
      n.title.toLowerCase().includes(q) || 
      n.content.toLowerCase().includes(q) || 
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="note-card" style="grid-column: 1/-1; border-style: dashed; opacity:0.6; align-items:center; justify-content:center; height: 200px" onclick="window.openNoteEditor()">
      <div style="font-size:32px">✍️</div>
      <div style="font-weight:600">No notes found</div>
      <div style="font-size:12px">Click here to write something brand new</div>
    </div>`;
    return;
  }

  // Sort: Pinned first, then date
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.dateCreated) - new Date(a.dateCreated);
  });

  container.innerHTML = filtered.map(n => `
    <div class="note-card ${n.pinned ? 'pinned' : ''}" onclick="window.openNoteEditor('${n.id}')">
      <div class="pin-btn" onclick="event.stopPropagation(); window.togglePinNote('${n.id}')">📌</div>
      <div class="note-title">${n.title}</div>
      <div class="note-preview">${n.content}</div>
      <div class="note-tags">${n.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <div class="note-footer">
        <div class="note-date">${new Date(n.dateCreated).toLocaleDateString()}</div>
        <div style="display:flex; gap:12px; align-items:center">
          <button onclick="event.stopPropagation(); window.shareNote('${n.id}')" style="background:transparent; border:none; color:var(--text3); cursor:pointer; font-size:12px" title="Share Note">🔗</button>
          <button onclick="event.stopPropagation(); window.downloadNote('${n.id}')" style="background:transparent; border:none; color:var(--text3); cursor:pointer; font-size:12px" title="Download as TXT">📥</button>
          <button onclick="event.stopPropagation(); window.startQuizFromNote('${n.id}')" style="background:transparent; border:none; color:var(--accent2); cursor:pointer; font-size:12px" title="Generate Quiz from this Note">🧪 Quiz</button>
          <div style="font-size:10px; color:var(--text3); margin-left:8px; border-left:1px solid var(--border2); padding-left:8px">${n.subjectId ? (StorageService.getDashboardStats().subjects.find(s=>s.id === n.subjectId)?.name || 'Subject') : 'Global'}</div>
        </div>
      </div>
    </div>
  `).join('');
}

window.searchNotes = function(q) {
  window.notesSearchQuery = q;
  renderNotesGrid();
}

window.togglePinNote = function(id) {
  StorageService.togglePinNote(id);
  renderNotesGrid();
}

window.openNoteEditor = function(id = null) {
  window.activeNoteId = id;
  const overlay = el('note-editor-overlay');
  overlay.style.display = 'flex';
  
  if (id) {
    const note = StorageService.getNotes().find(n => n.id === id);
    if (note) {
      el('ed-title').value = note.title;
      el('ed-content').value = note.content;
      el('ed-subject').value = note.subjectId || "";
      el('ed-tags').value = note.tags.join(', ');
      el('btn-del-note').style.display = 'block';
    }
  } else {
    el('ed-title').value = "";
    el('ed-content').value = "";
    el('ed-subject').value = StorageService.getActiveSubjectId() || "";
    el('ed-tags').value = "";
    el('btn-del-note').style.display = 'none';
  }
}

window.closeNoteEditor = function() {
  el('note-editor-overlay').style.display = 'none';
}

window.saveCurrentNote = function() {
  const data = {
    title: el('ed-title').value.trim(),
    content: el('ed-content').value.trim(),
    subjectId: el('ed-subject').value,
    tags: el('ed-tags').value.split(',').map(t => t.trim()).filter(t => t)
  };

  if (!data.content) {
    window.toast('⚠️', 'Note content cannot be empty');
    return;
  }

  if (window.activeNoteId) {
    StorageService.updateNote(window.activeNoteId, data);
    window.toast('✅', 'Note updated');
  } else {
    StorageService.addNote(data);
    window.toast('✨', 'New note saved');
    StorageService.addNotification(`Note saved: ${data.title}`, 'note');
  }

  window.closeNoteEditor();
  renderNotesInfo();
}

window.deleteActiveNote = function() {
  if (confirm("Delete this note?")) {
    StorageService.deleteNote(window.activeNoteId);
    window.closeNoteEditor();
    renderNotesInfo();
    window.toast('🗑️', 'Note deleted');
  }
}

window.shareNote = function(id) {
  const note = StorageService.getNotes().find(n => n.id === id);
  if (!note) return;
  
  const shareText = `📝 ${note.title}\n\n${note.content}\n\n— Shared from EduVox AI Study Buddy 🎓`;
  navigator.clipboard.writeText(shareText).then(() => {
    window.toast('🔗', 'Note copied to clipboard! You can now share it.');
  });
}

window.downloadNote = function(id) {
  const note = StorageService.getNotes().find(n => n.id === id);
  if (!note) return;
  
  const blobText = `TITLE: ${note.title}\nDATE: ${new Date(note.dateCreated).toLocaleString()}\nSUBJECT: ${note.subjectId || 'Global'}\nTAGS: ${note.tags.join(', ')}\n\n---\n\n${note.content}`;
  const blob = new Blob([blobText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title.replace(/\s+/g, '_')}_EduVox.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.toast('📥', 'Note downloaded successfully');
}

window.startQuizFromNote = function(id) {
  const note = StorageService.getNotes().find(n => n.id === id);
  if (!note) return;
  
  window.switchView('chat');
  window.addMsg(`Converting your note **"${note.title}"** into a practice test...`, false);
  
  setTimeout(() => {
    const html = window.quizHTML(note.title, note.content);
    window.addMsg(html, false);
    speechService.speak(`Ready! I've generated a quiz based on your notes for ${note.title}. Let's see what you remember.`);
  }, 1200);
}

window.saveNote = function(content) {
  StorageService.addNote({
    content: content,
    subjectId: StorageService.getActiveSubjectId()
  });
  window.toast('📝', 'Saved to your Notebook');
  StorageService.addNotification(`New snippet saved to notes`, 'note');
  renderDashInfo();
  renderNotesInfo();
}

// ── Onboarding Logic ──
window.currentOnboardingStep = 1;
window.totalOnboardingSteps = 5;

window.showOnboarding = function() {
  el('onboarding-modal').style.display = 'flex';
}

window.nextOnboardingStep = function() {
  if (window.currentOnboardingStep < window.totalOnboardingSteps) {
    window.currentOnboardingStep++;
    updateOnboardingUI();
  } else {
    window.skipOnboarding();
  }
}

window.skipOnboarding = function() {
  el('onboarding-modal').style.display = 'none';
  const stats = StorageService.getDashboardStats();
  stats.isFirstVisit = false;
  StorageService.saveState({ ...StorageService.getState(), dashboardStats: stats });
  window.toast('✨', 'You are all set! Let\'s start learning.');
  window.checkSmartTips();
}

function updateOnboardingUI() {
  // Update Steps
  document.querySelectorAll('.onboarding-step').forEach(step => {
    step.classList.toggle('active', parseInt(step.dataset.step) === window.currentOnboardingStep);
  });
  
  // Update Dots
  const dots = document.querySelectorAll('.onboarding-dots .dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === window.currentOnboardingStep);
  });
  
  // Update Button Text
  el('onboarding-next').innerText = window.currentOnboardingStep === window.totalOnboardingSteps ? 'Get Started' : 'Next';
}

// ── Help Assistant Logic ──
window.isHelpOpen = false;
window.toggleHelp = function() {
  window.isHelpOpen = !window.isHelpOpen;
  el('help-widget').style.display = window.isHelpOpen ? 'flex' : 'none';
}

window.helpAction = function(type) {
  let userMsg = "";
  let aiResp = "";
  
  if (type === 'start') {
    userMsg = "How to start?";
    aiResp = "To get started, try adding a subject in the dashboard or just ask me a question like 'What is photosynthesis?'";
  } else if (type === 'voice') {
    userMsg = "How to use voice?";
    aiResp = "Tap the microphone icon at the bottom of the chat to start speaking. I'll translate your voice into text automatically.";
  } else if (type === 'quiz') {
    userMsg = "How does quiz work?";
    aiResp = "Simply ask me 'Quiz me on Physics' or any topic. I'll generate questions and track your performance!";
  } else if (type === 'subject') {
    userMsg = "How to add subjects?";
    aiResp = "Go to the Dashboard and use the 'Subject Management' section to add new topics you want to track.";
  }
  
  renderHelpChat(userMsg, aiResp);
}

window.helpAsk = function() {
  const pin = el('help-in');
  const txt = pin.value.trim().toLowerCase();
  if (!txt) return;
  pin.value = '';
  
  let aiResp = "I'm not sure about that. Try asking about voice, quizzes, or subjects! Or check the Dashboard.";
  
  if (txt.includes('voice') || txt.includes('talk') || txt.includes('speak')) {
    aiResp = "Click the 🎤 icon to use voice input. Make sure to allow microphone permissions!";
  } else if (txt.includes('quiz') || txt.includes('test')) {
    aiResp = "I can generate quizzes for any topic. Just say 'Give me a quiz'!";
  } else if (txt.includes('subject') || txt.includes('add')) {
    aiResp = "Add subjects in the Dashboard to organize your study plan and notes.";
  } else if (txt.includes('xp') || txt.includes('level') || txt.includes('rank')) {
    aiResp = "You earn XP by taking quizzes and studying. Level up to become a Grandmaster!";
  } else if (txt.includes('note')) {
    aiResp = "You can save any of my explanations as a note by clicking the 📝 icon after my response.";
  }
  
  renderHelpChat(txt, aiResp);
}

function renderHelpChat(user, ai) {
  const container = el('help-messages');
  const uDiv = document.createElement('div');
  uDiv.className = 'help-msg user';
  uDiv.innerText = user;
  container.appendChild(uDiv);
  
  setTimeout(() => {
    const aDiv = document.createElement('div');
    aDiv.className = 'help-msg ai';
    aDiv.innerText = ai;
    container.appendChild(aDiv);
    container.scrollTop = container.scrollHeight;
  }, 400);
}

// ── Smart Tips Logic ──
window.checkSmartTips = function() {
  const stats = StorageService.getDashboardStats();
  const banner = el('tip-banner');
  const text = el('tip-text');
  
  let tip = "";
  
  if (stats.subjects.length === 0) {
    tip = "Add your first subject to start tracking progress. 📚";
  } else if (stats.totalQuestions === 0) {
    tip = "Try a quiz to test your knowledge! 🧪";
  } else if (stats.streakCount === 0) {
    tip = "Start your learning streak today and beat your goals! 🔥";
  } else if (stats.totalQuestions > 5 && (stats.correctAnswers / stats.totalQuestions) < 0.6) {
    tip = "Revise your weak topics for better exam performance. 📝";
  } else if (stats.xp < 100) {
    tip = "Keep learning to reach the 'Learner' level! ✨";
  } else {
    // Advanced suggestions
    const weakSub = stats.subjects.find(s => s.progress < 50);
    if(weakSub) {
      tip = `Time to focus on ${weakSub.name}! Let's try a quiz. 🚀`;
    } else {
      tip = "You're doing great! Why not learn a new topic today? 🧠";
    }
  }
  
  if (tip) {
    text.innerText = tip;
    banner.style.display = 'flex';
    setTimeout(() => { banner.style.display = 'none'; }, 8000);
  } else {
    banner.style.display = 'none';
  }
}

// ── New Page Renderers ──
window.renderQuizStats = function() {
  const container = el('quiz-stats-content');
  const app = window.appData;
  const stats = app.stats;
  const quizzes = app.quizzes || [];
  
  if (quizzes.length === 0 && stats.totalQuestions === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:var(--text3)">
        <div style="font-size:48px; margin-bottom:16px">🧪</div>
        <div style="font-size:18px; font-weight:600; color:var(--text)">Take your first quiz to see stats</div>
        <div style="font-size:13px; margin-top:8px">Ask the assistant "Quiz me on..." to begin!</div>
      </div>`;
    return;
  }

  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const avgScore = quizzes.length > 0 ? Math.round(accuracy) : 0; // Simplified average

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:32px">
      <div class="dash-box" style="text-align:center">
        <div style="font-size:28px; font-weight:800; color:var(--accent2)">${accuracy}%</div>
        <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:1px">Accuracy</div>
      </div>
      <div class="dash-box" style="text-align:center">
        <div style="font-size:28px; font-weight:800; color:var(--teal)">${stats.totalQuestions}</div>
        <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:1px">Questions</div>
      </div>
      <div class="dash-box" style="text-align:center">
        <div style="font-size:28px; font-weight:800; color:var(--pink)">${quizzes.length}</div>
        <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:1px">Quizzes</div>
      </div>
      <div class="dash-box" style="text-align:center">
        <div style="font-size:28px; font-weight:800; color:var(--amber)">${stats.correctAnswers}</div>
        <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:1px">Correct</div>
      </div>
    </div>

    <div class="dash-box">
      <h3 style="margin-bottom:20px; font-family:var(--font-head)">Recent Quiz History</h3>
      ${quizzes.length === 0 ? '<div style="color:var(--text3); text-align:center; padding:20px">No recent history.</div>' : `
        <div style="display:flex; flex-direction:column; gap:8px">
          ${quizzes.slice().reverse().map(q => {
            const sub = app.subjects.find(s => s.id === q.subjectId);
            const score = Math.round((q.correctAnswers / q.totalQuestions) * 100);
            return `
              <div style="background:var(--bg3); padding:16px; border-radius:12px; display:flex; justify-content:space-between; align-items:center">
                <div>
                  <div style="font-weight:700; font-size:14px">${q.topic || 'General'}</div>
                  <div style="font-size:11px; color:var(--text3)">${sub ? sub.name : 'Uncategorized'} • ${new Date(q.date).toLocaleDateString()}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800; font-size:18px; color:${score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)'}">${q.correctAnswers}/${q.totalQuestions}</div>
                  <div style="font-size:10px; color:var(--text3)">Score: ${score}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

window.renderPastChats = function() {
  const container = el('past-chats-list');
  const chats = window.appData.chats || [];
  
  if (chats.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:var(--text3)">
        <div style="font-size:48px; margin-bottom:16px">🕰️</div>
        <div style="font-size:18px; font-weight:600; color:var(--text)">No chats yet. Start learning!</div>
        <div style="font-size:13px; margin-top:8px">Your conversations will be saved here automatically.</div>
      </div>`;
    return;
  }
  
  // Create conversation pairs
  const pairs = [];
  for (let i = 0; i < chats.length; i++) {
    if (chats[i].role === 'user') {
      pairs.push({
        id: chats[i].id,
        user: chats[i].text,
        ai: (chats[i+1] && chats[i+1].role === 'assistant') ? chats[i+1].text : 'No response recorded.',
        aiId: (chats[i+1] && chats[i+1].role === 'assistant') ? chats[i+1].id : null,
        timestamp: chats[i].timestamp
      });
      if (chats[i+1] && chats[i+1].role === 'assistant') i++; 
    }
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px">
      ${pairs.slice().reverse().map(p => `
        <div class="dash-box" style="padding:0; border:1px solid var(--border); overflow:hidden">
          <div style="padding:16px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border2); display:flex; justify-content:space-between; align-items:center">
             <div style="font-size:11px; color:var(--text3); font-weight:700; text-transform:uppercase; letter-spacing:1px">Interaction • ${new Date(p.timestamp).toLocaleString()}</div>
             <button onclick="StorageService.deleteChat('${p.id}'); if('${p.aiId}') StorageService.deleteChat('${p.aiId}');" 
               style="background:transparent; border:none; color:var(--red); cursor:pointer; font-size:12px; font-weight:700">Delete</button>
          </div>
          <div style="padding:20px; display:flex; flex-direction:column; gap:16px">
            <div style="display:flex; gap:12px; align-items:flex-start">
               <div style="background:var(--accent); color:#000; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800">YOU</div>
               <div style="font-size:14px; color:var(--text)">${p.user}</div>
            </div>
            <div style="display:flex; gap:12px; align-items:flex-start; padding-left:20px; border-left:2px solid var(--border2)">
               <div style="background:var(--bg3); color:var(--accent2); border:1px solid var(--accent2); padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800">AI</div>
               <div style="font-size:14px; color:var(--text2); line-height:1.6">${p.ai}</div>
            </div>
          </div>
          <div style="padding:12px 20px; background:rgba(255,255,255,0.02); text-align:right">
             <button class="btn-ghost" style="padding:6px 12px; font-size:11px" onclick="window.switchView('chat')">Reopen Chat View</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.renderSavedTopics = function() {
  const container = el('saved-topics-list');
  const topics = window.appData.topics;
  const subjects = window.appData.subjects;
  
  if (!topics || topics.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text3)">
        <div style="font-size:48px; margin-bottom:16px">📚</div>
        <div style="font-size:18px; font-weight:600; color:var(--text)">Start learning to save topics 🚀</div>
        <div style="font-size:13px; margin-top:8px">Ask the assistant to explain something to see it here.</div>
      </div>`;
    return;
  }
  
  // Grouping by subject
  const grouped = {};
  topics.forEach(t => {
    const sub = subjects.find(s => s.id === t.subjectId);
    const subName = sub ? sub.name : 'General Topics';
    if (!grouped[subName]) grouped[subName] = [];
    grouped[subName].push(t);
  });

  container.innerHTML = Object.keys(grouped).map(subName => `
    <div style="grid-column: 1/-1; margin-top: 24px">
      <h3 style="font-family:var(--font-head); font-size:18px; color:var(--accent2); margin-bottom:12px; border-bottom:1px solid var(--border2); padding-bottom:8px">${subName}</h3>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px">
        ${grouped[subName].map(t => `
          <div class="dash-box" style="padding:16px; position:relative; overflow:hidden; transition:transform 0.2s">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
              <span style="font-size:24px">📖</span>
              <button onclick="event.stopPropagation(); StorageService.deleteTopic('${t.name}', ${t.subjectId ? `'${t.subjectId}'` : 'null'})" 
                style="background:transparent; border:none; color:var(--text3); cursor:pointer; font-size:16px" title="Remove topic">×</button>
            </div>
            <div style="cursor:pointer" onclick="window.pick('Explain ${t.name}')">
              <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:4px">${t.name}</div>
              <div style="font-size:11px; color:var(--text3)">Added on ${new Date(t.date).toLocaleDateString()}</div>
              <div style="display:flex; gap:6px; margin-top:12px">
                <span style="font-size:10px; padding:2px 8px; background:var(--bg3); border-radius:4px; color:var(--teal)">Revision Ready</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── Initialization ──
if (localStorage.getItem('eduvox_auth')) {
  el('auth-view').style.display = 'none';
  el('main-app').style.display = 'flex';
  
  // Use global appData for checking first visit if needed, 
  // though StorageService methods are still preferred for complex logic.
  const stats = StorageService.getDashboardStats(); 
  window.renderNotifications();
  if (stats.isFirstVisit) {
    window.showOnboarding();
  } else {
    window.checkSmartTips();
  }
}

const history = window.appData.chats;
if(history && history.length > 0) {
  window.isEmpty = false;
  history.forEach(h => {
     const area=el('msgs');
     const d=document.createElement('div');
     const isUser = h.role === 'user';
     d.className='msg'+(isUser?' user-msg':'');
     d.style.animation = 'none';d.style.opacity = '1';
     const av=isUser?'<div class="m-avatar user-av">Me</div>':'<div class="m-avatar ai-av">🤖</div>';
     
     if(isUser)d.innerHTML=`<div class="m-body"><div class="bubble user-bub">${h.text}</div><div class="m-time">${now()}</div></div>${av}`;
     else d.innerHTML=`${av}<div class="m-body">${h.text}<div class="m-time">${now()}</div></div>`;
     area.appendChild(d);
  });
} else {
  window.showEmpty();
  setTimeout(()=>window.addMsg(`<div class="bubble ai-bub">Hi! I'm <strong style="color:var(--accent2)">EduVox</strong> 🎓 — your AI study buddy.<br><br>I can explain concepts, quiz you, build study plans, and summarize any topic. Try typing or tap the mic to speak.<br><br><em style="color:var(--text3)">What are you studying today?</em></div>`,false), 600);
}


window.renderPlanner = function() {
  const container = el('study-planner-content');
  const stats = StorageService.getDashboardStats();
  const plan = stats.studyPlan;
  
  if (!plan) {
    // Show Setup Form
    container.innerHTML = `
      <div class="dash-box" style="max-width:600px; margin: 0 auto">
        <h3 style="margin-bottom:20px">Configure Your Study Plan</h3>
        <div style="display:flex; flex-direction:column; gap:16px">
          <div>
            <label style="display:block; font-size:12px; color:var(--text3); margin-bottom:8px">Exam Date</label>
            <input type="date" id="exam-date" class="sub-add-in" style="width:100%">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text3); margin-bottom:8px">Daily Study Hours</label>
            <input type="number" id="daily-hours" value="2" min="1" max="12" class="sub-add-in" style="width:100%">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text3); margin-bottom:8px">Select Subjects</label>
            <div id="planner-subjects" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:8px">
               ${stats.subjects.length === 0 ? '<div style="color:var(--text3); font-size:11px">Add subjects in dashboard first.</div>' : 
                 stats.subjects.map(s => `<label style="display:flex; gap:8px; align-items:center; font-size:13px; cursor:pointer">
                   <input type="checkbox" value="${s.id}" checked> ${s.name}
                 </label>`).join('')}
            </div>
          </div>
          <button class="btn-primary" style="margin-top:10px" onclick="window.generateStudyPlan()">✨ Generate AI Plan</button>
        </div>
      </div>`;
    return;
  }

  // Show Active Plan
  const days = plan.days || [];
  const completedCount = days.filter(d => d.completed).length;
  const progressPercent = Math.round((completedCount / days.length) * 100);
  const daysLeft = Math.ceil((new Date(plan.examDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px">
      <div style="display:flex; justify-content:space-between; align-items:flex-end">
        <div style="flex:1; margin-right:40px">
           <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px; font-weight:700">
             <span style="color:var(--text3)">TOTAL COMPLETION</span>
             <span style="color:var(--accent2)">${progressPercent}%</span>
           </div>
           <div class="xp-bar" style="height:12px; background:rgba(255,111,0,0.1)">
             <div class="xp-fill" style="width:${progressPercent}%; background:var(--accent2); box-shadow:0 0 15px var(--accent2)"></div>
           </div>
        </div>
        <div class="dash-box" style="padding:16px 24px; text-align:center">
          <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:4px">Countdown</div>
          <div style="font-size:20px; font-weight:800; color:var(--red)">${daysLeft}d</div>
        </div>
        <button class="btn-ghost" style="margin-left:16px" onclick="window.deleteStudyPlan()">Reset</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px">
        ${days.map((d, i) => {
          const isDone = d.completed;
          return `
            <div class="dash-box" style="border-top:4px solid ${d.type === 'revision' ? 'var(--amber)' : d.type === 'quiz' ? 'var(--teal)' : 'var(--blue)'}; opacity:${isDone ? '0.5' : '1'}; transition:opacity 0.3s">
              <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div style="font-size:11px; font-weight:700; color:var(--text3)">DAY ${i + 1} • ${d.type.toUpperCase()}</div>
                <input type="checkbox" ${isDone ? 'checked' : ''} onclick="window.toggleTask(${i})" style="cursor:pointer; width:18px; height:18px; accent-color:var(--accent2)">
              </div>
              <div style="margin-top:16px">
                <div style="font-size:15px; font-weight:800; color:${isDone ? 'var(--text3)' : '#fff'}">${d.subject}</div>
                <div style="font-size:12px; color:var(--text3); margin-top:4px; text-decoration:${isDone ? 'line-through' : 'none'}">${d.topic}</div>
              </div>
              <div style="margin-top:16px; font-size:11px; border-top:1px solid var(--border2); padding-top:12px; display:flex; justify-content:space-between; color:var(--text3)">
                <span>${plan.hoursPerDay} hours</span>
                ${isDone ? '<span style="color:var(--green); font-weight:700">COMPLETED</span>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.toggleTask = function(index) {
  const state = StorageService.getState();
  const plan = state.dashboardStats.studyPlan;
  if(!plan || !plan.days[index]) return;
  
  plan.days[index].completed = !plan.days[index].completed;
  
  if (plan.days[index].completed) {
    StorageService.addXP(30);
    window.toast('✅', 'Task completed! +30 XP');
    StorageService.addNotification(`Task completed: ${plan.days[index].topic}`, 'info');
  }

  StorageService.saveState(state);
  window.renderPlanner();
}

window.generateStudyPlan = function() {
  const dateVal = el('exam-date').value;
  if (!dateVal) { window.toast('⚠️', 'Please select an exam date'); return; }
  
  const dailyHours = el('daily-hours').value;
  const checkboxes = document.querySelectorAll('#planner-subjects input:checked');
  const subjectIds = Array.from(checkboxes).map(cb => cb.value);
  
  if (subjectIds.length === 0) { window.toast('⚠️', 'Select at least one subject'); return; }
  
  const stats = StorageService.getDashboardStats();
  const subjects = stats.subjects.filter(s => subjectIds.includes(s.id));
  
  const daysTotal = Math.ceil((new Date(dateVal) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysTotal <= 0) { window.toast('⚠️', 'Exam date must be in the future'); return; }

  const planDays = [];
  let dayCounter = 0;
  
  // Simple distribution logic:
  // Each subject gets days proportional to its remaining topics or just equal distribution
  while(dayCounter < daysTotal) {
    const sub = subjects[dayCounter % subjects.length];
    const type = (dayCounter + 1) % 4 === 0 ? 'revision' : (dayCounter + 1) % 6 === 0 ? 'quiz' : 'study';
    
    // Assign a topic from the subject (mock topic if none exists)
    const topic = sub.topics[Math.floor(dayCounter / subjects.length)] || `Chapter ${Math.floor(dayCounter / subjects.length) + 1}`;

    planDays.push({
      date: new Date(Date.now() + dayCounter * 24 * 60 * 60 * 1000).toISOString(),
      subject: sub.name,
      subjectId: sub.id,
      topic: topic,
      type: type,
      completed: false
    });
    dayCounter++;
  }

  const newPlan = {
    examDate: dateVal,
    hoursPerDay: dailyHours,
    days: planDays,
    createdAt: new Date().toISOString()
  };

  const state = StorageService.getState();
  state.dashboardStats.studyPlan = newPlan;
  StorageService.saveState(state);
  window.toast('✨', 'AI Study Plan Generated!');
  window.renderPlanner();
}

window.deleteStudyPlan = function() {
  if (confirm("Reset your study plan? This cannot be undone.")) {
    const state = StorageService.getState();
    state.dashboardStats.studyPlan = null;
    StorageService.saveState(state);
    window.renderPlanner();
  }
}

window.renderTeacherView = function() {
  const container = el('teacher-content');
  const teacherMode = StorageService.getState().teacherMode;
  const classrooms = teacherMode.classrooms || [];
  
  if (classrooms.length === 0) {
    container.innerHTML = `
      <div class="dash-box" style="text-align:center; padding:40px">
        <div style="font-size:48px; margin-bottom:16px">🏫</div>
        <h3 style="margin-bottom:8px">Welcome to Teacher Central</h3>
        <p style="color:var(--text3); font-size:14px; margin-bottom:24px">You haven't created any classrooms yet. Start by creating one to manage your students.</p>
        <div style="display:flex; justify-content:center; gap:10px">
           <input type="text" id="new-class-in" class="sub-add-in" placeholder="Class Name (e.g. Physics 101)">
           <button class="btn-primary" onclick="window.onAddClassroom()">Create Class</button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
       <h3 style="font-family:var(--font-head)">Active Classrooms</h3>
       <button class="btn-ghost" onclick="el('add-class-modal').style.display='flex'">+ New Class</button>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px">
      ${classrooms.map(c => `
        <div class="dash-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
            <div style="font-size:18px; font-weight:800">${c.name}</div>
            <div style="background:var(--bg3); padding:4px 8px; border-radius:4px; font-size:11px; color:var(--text3)">${c.students.length} Students</div>
          </div>
          
          <div style="margin-bottom:20px">
            <h4 style="font-size:12px; color:var(--text3); text-transform:uppercase; margin-bottom:10px">Student Analytics</h4>
            ${c.students.length === 0 ? `
              <div style="font-size:12px; color:var(--text3); padding:10px; background:var(--bg3); border-radius:8px">No students enrolled yet.</div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:8px">
                ${c.students.map(s => `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:8px">
                    <div style="font-size:13px">${s.name}</div>
                    <div style="font-size:12px; color:var(--green); font-weight:700">${s.attendance}% Participation</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          
          <div style="border-top:1px solid var(--border2); padding-top:16px; display:flex; gap:10px">
            <button class="btn-ghost" style="flex:1; font-size:11px" onclick="window.seedMockStudent('${c.id}')">Add Mock Student</button>
            <button class="btn-primary" style="flex:1; font-size:11px">Post Assignment</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.onAddClassroom = function() {
  const inp = el('new-class-in');
  const val = inp.value.trim();
  if(!val) return;
  StorageService.addClassroom(val);
  window.toast('🏫', `Classroom '${val}' created`);
  window.renderTeacherView();
}

window.seedMockStudent = function(classId) {
  const names = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Prince'];
  const name = names[Math.floor(Math.random() * names.length)];
  StorageService.addStudentToClass(classId, { name: name, email: name.toLowerCase().replace(' ', '.') + '@school.edu' });
  window.toast('👤', `Mock student '${name}' added`);
  window.renderTeacherView();
}

window.showXPPopup = function(amount) {
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.innerHTML = `+${amount} XP`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1500);
}

window.renderBadges = function(badges = []) {
  const grid = el('badge-grid');
  if(!grid) return;
  
  if (!badges || badges.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text3); font-size:12px">Keep pushing to unlock your first badge! 🏆</div>`;
    return;
  }

  grid.innerHTML = badges.map(b => `
    <div class="badge-item">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-date">Earned ${new Date(b.date).toLocaleDateString()}</div>
    </div>
  `).join('');
}

window.startBossBattle = function(subject) {
  window.switchView('chat');
  window.addMsg(`<div style="text-align:center; padding:24px; background:linear-gradient(180deg, rgba(255,100,0,0.1), transparent); border-radius:16px; border:1px solid #ff4e50">
      <div style="font-size:32px; margin-bottom:12px">⚔️</div>
      <h2 style="font-family:var(--font-head); color:#ff4e50; text-transform:uppercase; letter-spacing:2px">Boss Battle Initiated</h2>
      <p style="font-size:13px; color:var(--text3)">Total mastery of <b>${subject}</b> detected. Defeat the final challenge to earn the Conqueror badge!</p>
  </div>`, false);

  setTimeout(() => {
    const html = window.bossQuizHTML(subject);
    window.addMsg(html, false);
    speechService.speak(`Warning! High-difficulty challenge detected. You have 60 seconds to defeat the ${subject} boss. Good luck, scholar.`);
    
    // Start countdown
    let timeLeft = 60;
    const interval = setInterval(() => {
      const timerEl = el('boss-timer');
      if (!timerEl) {
          clearInterval(interval);
          return;
      }
      timeLeft--;
      timerEl.innerText = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(interval);
        window.toast('💀', 'Time Up! Boss escaped.');
      }
    }, 1000);
  }, 2000);
}

window.bossQuizHTML = function(topic) {
  return `<div class="quiz-card" style="border:2px solid #ff4e50; box-shadow:0 0 30px rgba(255,78,80,0.2)">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
      <div style="font-size:12px; font-weight:800; color:#ff4e50">🔥 BOSS: ${topic.toUpperCase()} ELITE</div>
      <div id="boss-timer" style="background:#ff4e50; color:#000; padding:4px 10px; border-radius:100px; font-weight:900; font-size:13px">60s</div>
    </div>
    
    <div style="margin-bottom:20px">
      <div style="font-size:10px; color:var(--text3); margin-bottom:4px">BOSS HEALTH</div>
      <div style="height:12px; background:rgba(255,255,255,0.05); border-radius:100px; overflow:hidden; border:1px solid #ff4e50">
        <div id="boss-hp" style="width:100%; height:100%; background:linear-gradient(90deg, #ff4e50, #f9d423); transition: width 0.5s ease"></div>
      </div>
    </div>

    <div id="boss-q-container">
      <div class="quiz-q" style="font-size:15px; border-bottom:1px solid var(--border2); padding-bottom:12px">Which architectural constraint ensures sub-millisecond data consistency in highly concurrent "${topic}" distributed clusters?</div>
      <div class="opts">
        <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">Eventually Consistent Replication</button>
        <button class="opt" onclick="window.hitBoss(this, true, '${topic}')">ACID Isolation Level level 4 (Serializable)</button>
        <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">Optimistic Concurrency Control</button>
        <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">Read-Committed Snapshot Isolation</button>
      </div>
    </div>
  </div>`;
}

window.bossHits = 0;
window.hitBoss = function(btn, correct, topic) {
  if (correct) {
    window.bossHits++;
    btn.className = "opt correct";
    const hp = 100 - (window.bossHits * 34);
    if(el('boss-hp')) el('boss-hp').style.width = `${Math.max(0, hp)}%`;
    window.toast('⚔️', 'CRITICAL HIT!');
    
    if (window.bossHits >= 3) {
      setTimeout(() => {
        el('boss-q-container').innerHTML = `<div style="text-align:center; padding:20px">
           <div style="font-size:48px; margin-bottom:12px">💎</div>
           <h3 style="color:var(--green)">BOSS DEFEATED!</h3>
           <p style="font-size:12px; color:var(--text2)">You have mastered ${topic}.</p>
           <div style="font-size:14px; color:var(--accent2); margin-top:10px; font-weight:800">+100 XP & CONQUEROR BADGE!</div>
        </div>`;
        StorageService.addXP(100);
        window.toast('🏆', 'NEW BADGE: Conqueror!');
        StorageService.addNotification(`Defeated the ${topic} Boss! Mastery Documented.`, 'success');
        window.bossHits = 0;
      }, 500);
    } else {
      setTimeout(() => {
        el('boss-q-container').innerHTML = `<div class="quiz-q" style="font-size:14px; border-bottom:1px solid var(--border2); padding-bottom:12px">Advanced Challenge ${window.bossHits+1}: How do we optimize the buffer pool for large-scale ${topic} workloads?</div>
        <div class="opts">
          <button class="opt" onclick="window.hitBoss(this, true, '${topic}')">LRU-K Eviction Strategy</button>
          <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">First-In-First-Out (FIFO)</button>
          <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">Random Selection</button>
          <button class="opt" onclick="window.hitBoss(this, false, '${topic}')">Static Capacity Padding</button>
        </div>`;
      }, 800);
    }
  } else {
    btn.className = "opt wrong";
    window.toast('💥', 'The Boss counter-attacks! HP Restored.');
    if(el('boss-hp')) el('boss-hp').style.width = `100%`;
    window.bossHits = 0;
  }
}

window.renderAutopilot = function() {
  const stats = StorageService.getDashboardStats();
  const sel = el('auto-subj');
  if (sel) {
    sel.innerHTML = stats.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (!sel.innerHTML) sel.innerHTML = `<option value="">No subjects found</option>`;
  }
}

window.autopilotSession = {
  active: false,
  subjectName: '',
  duration: 0,
  step: 0, 
}

window.launchAutopilot = function() {
  const subId = el('auto-subj').value;
  const dur = el('auto-dur').value;
  const sub = StorageService.getState().dashboardStats.subjects.find(s => s.id === subId);
  
  if (!sub) {
    window.toast('⚠️', 'Please select a subject first.');
    return;
  }

  window.autopilotSession = {
    active: true,
    subjectName: sub.name,
    duration: dur,
    step: 0
  };

  window.switchView('chat');
  window.addMsg(`<div style="text-align:center; padding:20px; border:2px solid var(--accent2); background:rgba(255,100,0,0.05); border-radius:16px">
     <div style="font-size:32px; margin-bottom:8px">🚀</div>
     <h3 style="color:var(--accent2)">Autopilot Session Started</h3>
     <p style="font-size:12px; color:var(--text3)">Target: <b>${sub.name}</b> • Length: <b>${dur} mins</b></p>
  </div>`, false);

  setTimeout(() => {
    window.autopilotNextStep();
  }, 1500);
}

window.autopilotNextStep = function() {
  const session = window.autopilotSession;
  if (!session.active) return;

  session.step++;

  if (session.step === 1) {
    const resp = IntentEngine.generateResponse({ type: 'explain', topic: session.subjectName, level: 'intermediate' });
    window.addMsg(`<div style="border-left:4px solid var(--accent2); padding-left:12px"><h4>Phase 1: Knowledge Transfer</h4>${resp}</div>`, false);
    speechService.speak(`Starting phase one. Explaining ${session.subjectName}. Please listen carefully.`, () => {
       setTimeout(() => { if(session.active) window.autopilotNextStep(); }, 12000); 
    });
  } 
  else if (session.step === 2) {
    window.addMsg(`<div style="border-left:4px solid var(--green); padding-left:12px"><h4>Phase 2: Active Recall</h4>Now, in your own words, explain the main concept of ${session.subjectName}. I am listening...</div>`, false);
    speechService.speak(`Phase two. Active recall. Now, explain ${session.subjectName} back to me. I'm listening.`, () => {
       window.toggleMic(); 
       setTimeout(() => { if(session.active) window.autopilotNextStep(); }, 15000); 
    });
  }
  else if (session.step === 3) {
    const html = window.quizHTML(session.subjectName);
    window.addMsg(`<div style="border-left:4px solid var(--accent); padding-left:12px"><h4>Phase 3: Formal Evaluation</h4>Let's test your understanding with a quick quiz.</div>${html}`, false);
    speechService.speak(`Final phase. Formal evaluation. Let's start the quiz.`, () => {
       setTimeout(() => { if(session.active) window.autopilotNextStep(); }, 20000); 
    });
  }
  else {
    window.autopilotSession.active = false;
    window.addMsg(`<div class="sum-card" style="border-top-color:var(--green)">
      <div class="card-label">✅ Session Complete</div>
      <div style="font-size:14px; font-weight:800; margin-bottom:10px">Well done, scholar!</div>
      <div style="font-size:12px; color:var(--text3)">
        Session Topic: ${session.subjectName}<br>
        Mastery Gained: +5%<br>
        XP Earned: +80 XP
      </div>
      <button class="btn-primary" style="margin-top:12px; width:100%" onclick="window.switchView('dashboard')">Back to Dashboard</button>
    </div>`, false);
    speechService.speak(`Congratulations. Your study session for ${session.subjectName} is complete. You earned 80 experience points. See you next time!`);
    StorageService.addXP(80);
    window.confetti();
  }
}
