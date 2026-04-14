const STORAGE_KEY = 'eduvox_state';

const SYLLABUS_LIBRARY = {
  'dbms': {
    name: 'Database Management Systems',
    chapters: ['Introduction', 'ER Model', 'Relational Algebra', 'SQL', 'Normalization', 'Indexing', 'Transactions']
  },
  'os': {
    name: 'Operating Systems',
    chapters: ['OS Overview', 'Process Management', 'CPU Scheduling', 'Deadlocks', 'Memory Management', 'Virtual Memory', 'File Systems']
  },
  'ds': {
    name: 'Data Structures',
    chapters: ['Arrays & Lists', 'Stacks & Queues', 'Trees', 'Binary Search Trees', 'Heaps', 'Hashing', 'Graphs']
  }
};

const defaultState = {
  chatHistory: [],
  activeSubjectId: null,
  dashboardStats: {
    xp: 0,
    level: "Beginner",
    correctAnswers: 0,
    totalQuestions: 0,
    quizzes: [],
    topics: [],
    streakCount: 0,
    lastStudyDate: "",
    subjects: [], 
    activityFeed: [], 
    notes: [], 
    notifications: [],
    isFirstVisit: true,
    badges: [],
    studyPlan: null,
    learningMemory: {
        activityHours: {}, 
        subjectTrends: {},
        sessionLogs: [], 
        interactionPatterns: { notes: 0, quizzes: 0 },
        topicMastery: {},
        doubtTriggers: { consecutiveErrors: 0, confusedTopics: [] }
    },
    sessions: [], // [{ timestamp: text, action: text, details: obj }]
  },
  settings: {
    profile: { name: '' },
    voice: { enabled: true, rate: 1.0, autoListen: false, lang: 'en-US' },
    learning: { style: 'adaptive', quizDiff: 'medium', adaptiveQuizzes: true, teachBack: true },
    notifications: { reminders: false, streakAlerts: true, time: '18:00', spRevise: true },
    appearance: { theme: 'dark', fontSize: 'medium' },
    privacy: { saveHistory: true, saveVoice: false }
  },
  teacherMode: {
    enabled: false,
    classrooms: []
  }
};

class StorageService {
  static getState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultState,
          ...parsed,
          dashboardStats: { ...defaultState.dashboardStats, ...(parsed.dashboardStats || {}) },
          settings: {
            ...defaultState.settings,
            ...(parsed.settings || {}),
            profile: { ...defaultState.settings.profile, ...(parsed.settings?.profile || {}) },
            voice: { ...defaultState.settings.voice, ...(parsed.settings?.voice || {}) },
            learning: { ...defaultState.settings.learning, ...(parsed.settings?.learning || {}) },
            notifications: { ...defaultState.settings.notifications, ...(parsed.settings?.notifications || {}) },
            appearance: { ...defaultState.settings.appearance, ...(parsed.settings?.appearance || {}) },
            privacy: { ...defaultState.settings.privacy, ...(parsed.settings?.privacy || {}) }
          }
        };
      }
    } catch (e) {
      console.error(e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  static saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    this.syncAppData();
  }

  // --- Global App Data Synchronization (AppState) ---
  static syncAppData() {
    const state = this.getState();
    window.appData = {
      subjects: state.dashboardStats.subjects,
      topics: state.dashboardStats.topics,
      notes: state.dashboardStats.notes,
      quizzes: state.dashboardStats.quizzes || [],
      chats: state.chatHistory,
      notifications: state.dashboardStats.notifications || [],
      stats: {
        totalQuestions: state.dashboardStats.totalQuestions,
        correctAnswers: state.dashboardStats.correctAnswers,
        quizzesTaken: (state.dashboardStats.quizzes || []).length,
        streak: state.dashboardStats.streakCount,
        xp: state.dashboardStats.xp
      }
    };
  }

  // --- Actions ---
  static addSubject(name) {
    const state = this.getState();
    const newSub = {
      id: Date.now().toString(),
      name,
      topics: [],
      quizzes: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      syllabus: []
    };
    state.dashboardStats.subjects.push(newSub);
    this.saveState(state);
    this.logActivity(`Created subject: ${name}`);
    return newSub;
  }

  static importSyllabus(subjectId, key) {
    const state = this.getState();
    const sub = state.dashboardStats.subjects.find(s => s.id === subjectId);
    const syl = SYLLABUS_LIBRARY[key];
    if (sub && syl) {
      sub.syllabus = syl.chapters.map(name => ({ name, completed: false }));
      this.saveState(state);
    }
  }

  static toggleChapter(subjectId, chapName) {
    const state = this.getState();
    const sub = state.dashboardStats.subjects.find(s => s.id === subjectId);
    if (sub && sub.syllabus) {
      const chap = sub.syllabus.find(c => c.name === chapName);
      if (chap) {
        chap.completed = !chap.completed;
        
        // Recalculate progress
        const done = sub.syllabus.filter(c => c.completed).length;
        sub.progress = Math.round((done / sub.syllabus.length) * 100);
        
        if (chap.completed) {
           this.addXP(20);
           this.addNotification(`Chapter completed: ${chapName}`, 'success');
        }
        
        this.saveState(state);
      }
    }
  }

  static deleteSubject(id) {
    const state = this.getState();
    state.dashboardStats.subjects = state.dashboardStats.subjects.filter(s => s.id !== id);
    if (state.activeSubjectId === id) state.activeSubjectId = null;
    this.saveState(state);
  }

  static addTopic(subjectId, topicName) {
    const state = this.getState();
    const sub = state.dashboardStats.subjects.find(s => s.id === subjectId || s.name === subjectId);
    if (sub) {
      const existing = state.dashboardStats.topics.find(t => t.name === topicName && t.subjectId === sub.id);
      if (!existing) {
        const newTopic = { name: topicName, date: new Date().toISOString(), subjectId: sub.id };
        state.dashboardStats.topics.push(newTopic);
        if(!sub.topics.includes(topicName)) sub.topics.push(topicName);
        this.saveState(state);
        this.logActivity(`Learned ${topicName} in ${sub.name}`);
      }
    }
  }

  static recordActivityHour() {
    const state = this.getState();
    const hour = new Date().getHours().toString();
    const memory = state.dashboardStats.learningMemory;
    if (!memory.activityHours) memory.activityHours = {};
    memory.activityHours[hour] = (memory.activityHours[hour] || 0) + 1;
    this.saveState(state);
  }

  static recordInteraction(type) {
    const state = this.getState();
    const mem = state.dashboardStats.learningMemory;
    if (!mem.interactionPatterns) mem.interactionPatterns = { notes: 0, quizzes: 0 };
    mem.interactionPatterns[type]++;
    this.saveState(state);
  }

  static recordSession(duration) {
    const state = this.getState();
    const mem = state.dashboardStats.learningMemory;
    if (!mem.sessionLogs) mem.sessionLogs = [];
    mem.sessionLogs.push({ date: new Date().toISOString(), duration });
    this.saveState(state);
  }

  static logSessionEvent(action, details = {}) {
    const state = this.getState();
    if (!state.dashboardStats.sessions) state.dashboardStats.sessions = [];
    state.dashboardStats.sessions.unshift({
      time: new Date().toISOString(),
      action,
      details
    });
    if (state.dashboardStats.sessions.length > 50) state.dashboardStats.sessions.pop();
    this.saveState(state);
  }

  static detectDoubt(topic, isError) {
    const state = this.getState();
    const mem = state.dashboardStats.learningMemory;
    if (!mem.doubtTriggers) mem.doubtTriggers = { consecutiveErrors: 0, confusedTopics: [] };
    
    if (isError) {
      mem.doubtTriggers.consecutiveErrors++;
      if (topic && !mem.doubtTriggers.confusedTopics.includes(topic)) mem.doubtTriggers.confusedTopics.push(topic);
    } else {
      mem.doubtTriggers.consecutiveErrors = 0;
    }
    
    this.saveState(state);
    return mem.doubtTriggers.consecutiveErrors >= 3;
  }

  static getLearningInsights() {
    const state = this.getState();
    const hours = state.dashboardStats.learningMemory.activityHours || {};
    const hourKeys = Object.keys(hours);
    
    let peakHour = null;
    let maxCount = -1;
    hourKeys.forEach(h => {
      if (hours[h] > maxCount) {
        maxCount = hours[h];
        peakHour = h;
      }
    });

    const peakTimeLabel = peakHour ? (parseInt(peakHour) >= 18 || parseInt(peakHour) <= 4 ? 'Night 🌙' : 'Day ☀️') : 'your schedule';
    const strongSub = state.dashboardStats.subjects.sort((a,b) => b.progress - a.progress)[0];
    const weakSub = state.dashboardStats.subjects.sort((a,b) => a.progress - b.progress)[0];

    return {
      peakTime: peakTimeLabel,
      peakHour: peakHour,
      strongSubject: strongSub?.name || 'various topics',
      weakSubject: weakSub?.name || 'new concepts'
    };
  }

  static trackTopic(topicName) {
    const state = this.getState();
    const activeSubId = state.activeSubjectId;
    this.recordActivityHour();
    if (activeSubId) {
      this.addTopic(activeSubId, topicName);
    } else {
      const existing = state.dashboardStats.topics.find(t => t.name === topicName && !t.subjectId);
      if (!existing) {
        state.dashboardStats.topics.push({ name: topicName, date: new Date().toISOString(), subjectId: null });
        this.saveState(state);
        this.logActivity(`Learned ${topicName}`);
      }
    }
  }

  static deleteTopic(name, subjectId = null) {
    const state = this.getState();
    state.dashboardStats.topics = state.dashboardStats.topics.filter(t => !(t.name === name && t.subjectId === subjectId));
    this.saveState(state);
    if(window.renderSavedTopics) window.renderSavedTopics();
  }

  static addNote(noteData) {
    const state = this.getState();
    this.recordActivityHour();
    this.recordInteraction('notes');
    const newNote = {
      id: Date.now().toString(),
      title: noteData.title || (noteData.content.substring(0, 20) + '...'),
      content: noteData.content,
      subjectId: noteData.subjectId || state.activeSubjectId,
      dateCreated: new Date().toISOString(),
      tags: noteData.tags || [],
      pinned: false
    };
    state.dashboardStats.notes.unshift(newNote);
    this.saveState(state);
    return newNote;
  }

  static addQuizResult(quiz) {
    const state = this.getState();
    this.recordActivityHour();
    this.recordInteraction('quizzes');
    
    if (!state.dashboardStats.quizzes) state.dashboardStats.quizzes = [];
    state.dashboardStats.quizzes.push({ ...quiz, date: new Date().toISOString() });
    state.dashboardStats.totalQuestions += quiz.totalQuestions || 0;
    state.dashboardStats.correctAnswers += quiz.correctAnswers || 0;
    
    // Track Topic Mastery
    const mem = state.dashboardStats.learningMemory;
    if (!mem.topicMastery) mem.topicMastery = {};
    if (quiz.topic) {
      if (!mem.topicMastery[quiz.topic]) mem.topicMastery[quiz.topic] = { correct: 0, total: 0 };
      mem.topicMastery[quiz.topic].correct += quiz.correctAnswers || 0;
      mem.topicMastery[quiz.topic].total += quiz.totalQuestions || 0;
    }

    if (quiz.subjectId) {
      const sub = state.dashboardStats.subjects.find(s => s.id === quiz.subjectId || s.name === quiz.subjectId);
      if (sub) {
        sub.totalQuestions += quiz.totalQuestions || 0;
        sub.correctAnswers += quiz.correctAnswers || 0;
        sub.progress = Math.round((sub.correctAnswers / (sub.totalQuestions || 1)) * 100);
      }
    }
    
    this.addXP((quiz.correctAnswers || 0) * 10);
    this.saveState(state);
  }

  static trackQuiz(correct, topic = 'General') {
    // Legacy support for answering a single question card
    this.addQuizResult({
      topic: topic,
      subjectId: this.getState().activeSubjectId,
      totalQuestions: 1,
      correctAnswers: correct ? 1 : 0
    });
  }

  static addChat(chat) {
    const state = this.getState();
    state.chatHistory.push({ ...chat, id: Date.now() + Math.random().toString(), timestamp: Date.now() });
    if (state.chatHistory.length > 100) state.chatHistory.shift();
    this.saveState(state);
  }

  static deleteChat(id) {
    const state = this.getState();
    state.chatHistory = state.chatHistory.filter(c => c.id !== id);
    this.saveState(state);
    if(window.renderPastChats) window.renderPastChats();
  }

  static addNotification(msg, type = 'info') {
    const state = this.getState();
    if (!state.dashboardStats.notifications) state.dashboardStats.notifications = [];
    const n = { id: Date.now().toString(), message: msg, type, timestamp: Date.now(), read: false };
    state.dashboardStats.notifications.unshift(n);
    this.saveState(state);
    if (window.renderNotifications) window.renderNotifications();
    return n;
  }

  static updateStats(data) {
    const state = this.getState();
    state.dashboardStats = { ...state.dashboardStats, ...data };
    this.saveState(state);
  }

  // --- Getters ---
  static getHistory() { return this.getState().chatHistory; }
  static getDashboardStats() { return this.getState().dashboardStats; }
  static getActiveSubjectId() { return this.getState().activeSubjectId; }
  static getNotes() { return this.getState().dashboardStats.notes; }
  static getNotifications() { return this.getState().dashboardStats.notifications || []; }
  static getSettings() { return this.getState().settings; }

  // --- Setters ---
  static setActiveSubjectId(id) {
    const state = this.getState();
    state.activeSubjectId = id;
    this.saveState(state);
  }

  static addXP(amount) {
    const state = this.getState();
    const stats = state.dashboardStats;
    
    // Streak Bonus: +5% XP per streak day (up to 50%)
    const bonus = Math.floor(amount * Math.min(0.5, (stats.streakCount * 0.05)));
    const totalToAdd = amount + bonus;
    
    stats.xp += totalToAdd;
    const xp = stats.xp;
    stats.level = xp >= 1000 ? "Grandmaster" : xp >= 600 ? "Master" : xp >= 300 ? "Pro" : xp >= 100 ? "Learner" : "Beginner";
    this.saveState(state);
    
    this.checkBadges();

    // Trigger XP UI Animation (handled in main.js via event or global call)
    if(window.showXPPopup) window.showXPPopup(totalToAdd);
  }

  static checkBadges() {
    const state = this.getState();
    const stats = state.dashboardStats;
    const currentBadges = stats.badges || [];
    let unlocked = false;

    const addBadge = (id, name, icon) => {
      if(!currentBadges.find(b => b.id === id)) {
        currentBadges.push({ id, name, icon, date: new Date().toISOString() });
        this.addNotification(`🏆 New Badge Unlocked: ${name}!`, 'info');
        unlocked = true;
      }
    };

    // Logic: Quiz Master (5 quizzes)
    if (stats.quizzes.length >= 5) addBadge('quiz_master', 'Quiz Master', '🧪');
    
    // Logic: Consistent Learner (3 day streak)
    if (stats.streakCount >= 3) addBadge('consistent', 'Consistent Learner', '🔥');

    if (unlocked) {
      stats.badges = currentBadges;
      this.saveState(state);
      if (window.renderDashInfo) window.renderDashInfo();
    }
  }

  static markNotificationRead(id) {
    const state = this.getState();
    const n = state.dashboardStats.notifications?.find(ni => ni.id === id);
    if(n) { n.read = true; this.saveState(state); }
  }

  static clearNotifications() {
    const state = this.getState();
    state.dashboardStats.notifications = [];
    this.saveState(state);
  }

  static updateSettings(category, obj) {
    const state = this.getState();
    if(state.settings[category]) {
      state.settings[category] = { ...state.settings[category], ...obj };
      this.saveState(state);
    }
  }

  // --- Maintenance ---
  static logActivity(text) {
    const state = this.getState();
    state.dashboardStats.activityFeed.unshift({ text, date: new Date().toISOString() });
    if(state.dashboardStats.activityFeed.length > 20) state.dashboardStats.activityFeed.pop();
    this.saveState(state);
  }

  static exportData() {
    const blob = new Blob([JSON.stringify(this.getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eduvox-data.json`;
    a.click();
  }

  static resetProgress() {
    const auth = localStorage.getItem('eduvox_auth');
    localStorage.removeItem(STORAGE_KEY);
    if(auth) localStorage.setItem('eduvox_auth', auth);
    this.syncAppData();
  }

  static toggleTeacherMode(val) {
    const state = this.getState();
    state.teacherMode.enabled = val;
    this.saveState(state);
    if (window.switchView) window.switchView('dashboard');
  }

  static addClassroom(name) {
    const state = this.getState();
    const newClass = {
      id: 'class_' + Date.now(),
      name: name,
      students: [],
      assignments: [],
      createdAt: new Date().toISOString()
    };
    state.teacherMode.classrooms.push(newClass);
    this.saveState(state);
  }

  static addStudentToClass(classId, student) {
    const state = this.getState();
    const cls = state.teacherMode.classrooms.find(c => c.id === classId);
    if (cls) {
      cls.students.push({
        id: 'std_' + Date.now() + Math.random(),
        name: student.name,
        email: student.email,
        scores: [],
        attendance: 100
      });
      this.saveState(state);
    }
  }
}

// Initial hydration
StorageService.syncAppData();

export default StorageService;
