<template>
    <div class="app" :class="currentTheme">
      <header class="app-header">
        <h1>US Capitals Matching Game</h1>
         <button @click="toggleTheme" class="theme-toggle" :title="'Switch to ' + (currentTheme === 'dark' ? 'light' : 'dark') + ' mode'">
           {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
         </button>
      </header>
      <main class="app-main">
          <div class="main-layout-wrapper">
  
              <div class="quiz-content-area">
                  <div class="activity-container">
  
                      <div v-if="quizState === 'notStarted'" class="start-quiz-container">
                          <div class="instructions">
                              <h2>Welcome!</h2>
                              <p class="instruction-intro">Test your knowledge of US state capitals.</p>
                              <ul>
                                  <li>You will be shown a capital city.</li>
                                  <li>Select the correct state from the 4 options provided.</li>
                                  <li>You have 10 questions to answer.</li>
                                  <li>Scoring: Max 10 points per question, -1 point per second. 0 points if wrong or time reaches 10s.</li>
                              </ul>
                          </div>
                          <div class="start-controls">
                               <p class="username-prompt">Enter your username to begin:</p>
                              <div v-if="!usernameEntered" class="username-entry">
                                  <label for="usernameInput" class="sr-only">Username</label>
                                  <input
                                      id="usernameInput" type="text" v-model.trim="username"
                                      placeholder="Enter your username" class="username-input" @keyup.enter="submitUsername"
                                  />
                                  <button @click="submitUsername" class="confirm-username-button" :disabled="!username" >
                                      Confirm Username
                                  </button>
                              </div>
                              <p v-if="usernameEntered" class="username-confirmed">
                                  Ready, <strong>{{ username }}</strong>!
                              </p>
                              <button @click="startQuiz" class="start-button" :disabled="!usernameEntered" >
                                  Start Quiz
                              </button>
                          </div>
                      </div>
  
                      <div v-else class="quiz-area">
                          <p v-if="username" class="current-user">{{ username }}</p>
                          <h2 v-if="quizState === 'inProgress'">Match the capital city to its corresponding state:</h2>
                          <transition name="fade" mode="out-in">
                              <div v-if="quizState === 'inProgress'" class="question-container" :key="currentQuestionIndex">
                                  <div class="question-header">
                                      <p class="question-counter">Question {{ currentQuestionIndex + 1 }} of {{ questions.length }}</p>
                                      <p class="timer">Time: {{ elapsedTime }}s</p>
                                  </div>
                                  <h3>{{ currentQuestion.capital }}</h3>
                                  <div class="options-container">
                                      <button
                                      v-for="(option, index) in currentQuestion.options"
                                      :key="index"
                                      @click="selectAnswer(option)"
                                      class="option-button"
                                      :disabled="isTransitioning" >
                                      {{ option }}
                                      </button>
                                  </div>
                              </div>
                              <div v-else-if="quizState === 'finished'" class="results-container">
                                  <h2>Quiz Results for {{ username }}</h2>
                                  <ul class="results-list">
                                      <li v-for="(result, index) in results" :key="index" :class="{ correct: result.isCorrect, incorrect: !result.isCorrect }">
                                          <div class="result-line-1">
                                              <span class="result-question">{{ index + 1 }}. {{ result.question }}</span>
                                              <span class="result-details">
                                                  <span class="result-time">({{ result.timeTaken !== undefined ? result.timeTaken : 'N/A' }}s)</span>
                                                  <span class="result-score">Score: {{ result.questionScore !== undefined ? result.questionScore : 'N/A' }}</span>
                                              </span>
                                          </div>
                                          <span class="result-answer">
                                              Your answer: {{ result.userAnswer }}
                                              <span v-if="!result.isCorrect" class="correct-answer-text"> (Correct: {{ result.correctAnswer }})</span>
                                              <span v-else class="correct-indicator"> ✔️</span>
                                          </span>
                                          <p v-if="!result.isCorrect && result.fact" class="result-fact">{{ result.fact }}</p>
                                      </li>
                                  </ul>
                                  <p class="final-score">Total Score: {{ totalScore }}</p>
                                  <button @click="resetQuiz" class="reset-button">Play Again</button>
                              </div>
                          </transition>
                      </div>
  
                  </div>
              </div>
  
               <aside class="leaderboard" v-if="quizState === 'finished'">
                  <h3>Leaderboard</h3>
                  <div v-if="leaderboardLoading" class="loading-message">Loading...</div>
                  <div v-else-if="leaderboardScores.length === 0" class="no-scores-message">No scores yet!</div>
                  <ul v-else class="leaderboard-list">
                       <li v-for="(scoreEntry, index) in leaderboardScores"
                          :key="scoreEntry.id || index"
                          class="leaderboard-item"
                          :class="{ 'current-user-score': scoreEntry.id === currentAttemptId }"
                      >
                         <span>{{ index + 1 }}. {{ scoreEntry.name }}</span>
                         <span>{{ scoreEntry.score }}</span>
                      </li>
                  </ul>
              </aside>
  
          </div> </main>
      <footer class="app-footer">
         <p>&copy; {{ new Date().getFullYear() }} Steven Maxwell</p>
      </footer>
    </div>
  </template>
  
  <script>
  import statesData from '@/data/info.json';
  import { db } from '@/firebase/index.js';
  import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
  
  export default {
    data() {
      return {
        statesInfo: [],
        quizState: 'notStarted',
        username: '',
        usernameEntered: false,
        isTransitioning: false,
        questions: [],
        currentQuestionIndex: 0,
        currentQuestion: {},
        results: [],
        questionStartTime: 0,
        elapsedTime: 0,
        timerIntervalId: null,
        leaderboardScores: [],
        leaderboardListenerUnsubscribe: null,
        leaderboardLoading: true,
        currentAttemptId: null,
        // --- ADDED: Theme state ---
        currentTheme: 'dark', // Default to dark
      };
    },
    computed: {
      totalScore() {
        return this.results.reduce((sum, result) => sum + (result.questionScore || 0), 0);
      }
    },
    mounted() {
      this.statesInfo = statesData;
  
      // --- Load theme preference from localStorage ---
      const savedTheme = localStorage.getItem('quizTheme');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          this.currentTheme = savedTheme;
           console.log("Loaded saved theme:", this.currentTheme);
      } else {
           console.log("No saved theme found, using default:", this.currentTheme);
      }
      // --- End Load Theme ---
  
      this.listenForLeaderboardUpdates();
    },
    beforeUnmount() {
        if (this.timerIntervalId) { clearInterval(this.timerIntervalId); }
        if (this.leaderboardListenerUnsubscribe) {
            console.log("Unsubscribing from leaderboard listener.");
            this.leaderboardListenerUnsubscribe();
        }
    },
    methods: {
      // --- Theme Toggle Method ---
      toggleTheme() {
          this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
          localStorage.setItem('quizTheme', this.currentTheme);
          console.log("Theme toggled to:", this.currentTheme);
      },
      // --- End Theme Toggle Method ---
  
      listenForLeaderboardUpdates() {
          this.leaderboardLoading = true;
          console.log("Setting up leaderboard listener...");
          try {
              const scoresCollectionRef = collection(db, 'scores');
              const scoresQuery = query(
                  scoresCollectionRef, orderBy('score', 'desc'), limit(20)
              );
              this.leaderboardListenerUnsubscribe = onSnapshot(scoresQuery, (snapshot) => {
                  const scores = [];
                  snapshot.forEach((doc) => {
                      const data = doc.data();
                      if (data.name && typeof data.score === 'number') {
                         scores.push({ id: doc.id, ...data });
                      } else { console.warn("Skipping invalid leaderboard entry:", doc.id); }
                  });
                  this.leaderboardScores = scores;
                  this.leaderboardLoading = false;
              }, (error) => {
                  console.error("Error listening to leaderboard scores:", error);
                  this.leaderboardLoading = false;
              });
          } catch (error) {
               console.error("Error setting up leaderboard query:", error);
               this.leaderboardLoading = false;
          }
      },
      submitUsername() {
          if (this.username && this.username.trim()) {
               this.username = this.username.trim(); this.usernameEntered = true;
          } else { this.username = ''; alert("Please enter a valid username."); }
      },
      startQuiz() {
          if (!this.usernameEntered || !this.username) { alert("Please confirm username first."); return; }
          this.currentAttemptId = null;
          this.generateQuestions();
          if (this.questions && this.questions.length > 0) {
              this.currentQuestionIndex = 0; this.results = []; this.currentQuestion = this.questions[0];
              this.isTransitioning = false; this.quizState = 'inProgress';
              this.$nextTick(() => { this.startQuestionTimer(); });
          } else { alert("Error: Could not load questions."); }
      },
      startQuestionTimer() {
          if (this.timerIntervalId) { clearInterval(this.timerIntervalId); } this.elapsedTime = 0; this.questionStartTime = Date.now();
          this.timerIntervalId = setInterval(() => { this.elapsedTime = Math.floor((Date.now() - this.questionStartTime) / 1000); }, 1000);
      },
      stopQuestionTimer() {
          let duration = 0; if (this.timerIntervalId) { clearInterval(this.timerIntervalId); this.timerIntervalId = null; duration = Math.max(0, Math.floor((Date.now() - this.questionStartTime) / 1000)); } this.elapsedTime = 0; return duration;
      },
      generateQuestions() {
          try { const n = 10; if (!this.statesInfo || this.statesInfo.length === 0) { this.questions = []; this.currentQuestion = {}; return; } const a = [...this.statesInfo]; const s = []; const c = Math.min(n, a.length); for (let i = 0; i < c; i++) { if (a.length === 0) break; const r = Math.floor(Math.random() * a.length); s.push(a.splice(r, 1)[0]); } this.questions = s.map((ci) => ({ capital: ci.capital, correctState: ci.state, options: [...this.getRandomIncorrectStates(ci.state, 3), ci.state].sort(() => Math.random() - 0.5), fact: ci.fact })); if (this.questions.length === 0) { console.error("No questions generated."); } } catch (e) { console.error("Error generating questions:", e); this.questions = []; this.currentQuestion = {}; }
      },
      getRandomIncorrectStates(correctState, count) {
         if (!this.statesInfo || this.statesInfo.length <= 1) { return []; } const i = []; const a = this.statesInfo.map(si => si.state); const p = a.filter(s => s !== correctState); const n = Math.min(count, p.length); while (i.length < n) { if(p.length === 0) break; const x = Math.floor(Math.random() * p.length); i.push(p.splice(x, 1)[0]); } return i;
      },
       selectAnswer(selectedAnswer) {
        if (this.isTransitioning || this.quizState !== 'inProgress') return; const durationTaken = this.stopQuestionTimer(); this.isTransitioning = true; const fadeDuration = 300; setTimeout(() => { if (this.currentQuestionIndex < this.questions.length && this.questions[this.currentQuestionIndex]) { const cq = this.questions[this.currentQuestionIndex]; const isCorrect = selectedAnswer === cq.correctState; let score = isCorrect ? Math.max(0, 10 - durationTaken) : 0;
        this.results.push({ question: cq.capital, correctAnswer: cq.correctState, userAnswer: selectedAnswer, isCorrect: isCorrect, fact: cq.fact, timeTaken: durationTaken, questionScore: score });
        this.currentQuestionIndex++; if (this.currentQuestionIndex < this.questions.length) { this.currentQuestion = this.questions[this.currentQuestionIndex]; this.startQuestionTimer(); } else { console.log(`Quiz finished for ${this.username}. Results:`, this.results); this.quizState = 'finished'; this.saveScoreToFirestore(); } } else { console.error("Error processing answer for index:", this.currentQuestionIndex); } this.$nextTick(() => { this.isTransitioning = false; }); }, fadeDuration);
       },
       async saveScoreToFirestore() {
          if (!this.username || this.results.length === 0 || this.quizState !== 'finished') { console.warn("Conditions not met for saving score."); return; }
          this.currentAttemptId = null;
          console.log(`Attempting to save score for ${this.username}...`);
          const scoreData = { name: this.username, score: this.totalScore, timestamp: new Date() };
          try {
              const scoresCollectionRef = collection(db, 'scores');
              const docRef = await addDoc(scoresCollectionRef, scoreData);
              console.log("Score saved successfully to Firestore with ID:", docRef.id);
              this.currentAttemptId = docRef.id;
          } catch (error) {
              console.error("Error saving score to Firestore:", error);
              alert("Sorry, there was an error saving your score.");
          }
      },
       resetQuiz() {
          console.log("Resetting quiz..."); if (this.timerIntervalId) { clearInterval(this.timerIntervalId); this.timerIntervalId = null; } this.currentQuestionIndex = 0; this.questions = []; this.results = []; this.currentQuestion = {}; this.isTransitioning = false; this.questionStartTime = 0; this.elapsedTime = 0; this.username = ''; this.usernameEntered = false; this.quizState = 'notStarted'; this.currentAttemptId = null;
      }
    },
  };
  </script>
  
  <style>
  /* Import Google Font */
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
  
  /* Basic Reset & Font Setup */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  
  /* --- THEME VARIABLES --- */
  :root { /* Default to dark theme variables */
      --bg-primary: #1c1c1e;
      --bg-secondary: #2c2c2e;
      --bg-tertiary: #3a3a3c;
      --bg-instructions: #1c1c1e;
      --text-primary: #e0e0e0;
      --text-secondary: #b0b0b0;
      --text-muted: #8e8e93;
      --text-inverted: #1c1c1e; /* For text on accent background */
      --text-heading: #f5f5f7;
      --accent-primary: #87ceeb; /* Light Sky Blue */
      --accent-secondary: #5eaaa8; /* Tealish */
      --accent-primary-hover-bg: #a0d9ef;
      --accent-secondary-hover-bg: #70bdb9; /* Teal hover */
      --border-primary: #3a3a3c;
      --border-secondary: #555;
      --border-accent: var(--accent-primary);
      --shadow-color: rgba(0, 0, 0, 0.2);
      --correct-color: #34c759;
      --incorrect-color: #ff3b30;
      --incorrect-text-color: #ff9a8d;
      --highlight-bg: rgba(135, 206, 235, 0.1);
      --glow-color: rgba(135, 206, 235, 0.3);
      --reset-border-color: var(--incorrect-color);
      --reset-text-color: var(--incorrect-text-color);
      --reset-hover-bg: rgba(255, 59, 48, 0.15);
      --reset-hover-color: #ff4d4d;
      --theme-toggle-hover-bg: rgba(128, 128, 128, 0.2);
  }
  
  .app.light { /* Light theme overrides */
      --bg-primary: #f4f7f6;
      --bg-secondary: #ffffff;
      --bg-tertiary: #e9ecef;
      --bg-instructions: #f8f9fa; /* Lighter instruction background */
      --text-primary: #212529; /* Darker primary text */
      --text-secondary: #495057; /* Darker secondary text */
      --text-muted: #6c757d;
      --text-inverted: #ffffff;
      --text-heading: #2c3e50; /* Dark blue-grey headings */
      --accent-primary: #007bff; /* Standard Bootstrap blue */
      --accent-secondary: #17a2b8; /* Cyan/Info */
      --accent-primary-hover-bg: #0056b3;
      --accent-secondary-hover-bg: #117a8b;
      --border-primary: #dee2e6; /* Lighter borders */
      --border-secondary: #ced4da;
      --border-accent: var(--accent-primary);
      --shadow-color: rgba(0, 0, 0, 0.1);
      --correct-color: #28a745;
      --incorrect-color: #dc3545;
      --incorrect-text-color: #721c24; /* Dark red on light */
      --highlight-bg: rgba(0, 123, 255, 0.1); /* Light blue highlight */
      --glow-color: rgba(0, 123, 255, 0.2);
      --reset-border-color: var(--incorrect-color);
      --reset-text-color: var(--incorrect-color);
      --reset-hover-bg: rgba(220, 53, 69, 0.08);
      --reset-hover-color: #b21f2d;
      --theme-toggle-hover-bg: rgba(0, 0, 0, 0.1);
  }
  /* --- END THEME VARIABLES --- */
  
  .app {
      font-family: 'Poppins', sans-serif; min-height: 100vh; display: flex;
      flex-direction: column; background-color: var(--bg-primary); color: var(--text-primary);
      transition: background-color 0.3s ease, color 0.3s ease;
  }
  
  /* Header Styling */
  .app-header {
      background-color: var(--bg-secondary); color: var(--text-heading); padding: 1rem 1.5rem;
      text-align: center; border-bottom: 1px solid var(--border-primary); width: 100%;
      flex-shrink: 0; display: flex; justify-content: center; /* Center H1 by default */ align-items: center;
      position: relative; /* Needed for absolute positioning of toggle */
      transition: background-color 0.3s ease, border-color 0.3s ease;
  }
  /* Center H1 explicitly, allow toggle button to be positioned absolutely */
  .app-header h1 { font-weight: 600; font-size: 1.75rem; margin: 0; padding: 0; /* Remove previous padding */ }
  
  /* Theme Toggle Button */
  .theme-toggle {
      background: none; border: none; color: var(--text-secondary); /* Use secondary text color */
      font-size: 1.5rem; cursor: pointer; padding: 0.5rem; line-height: 1;
      border-radius: 50%; transition: background-color 0.2s ease, color 0.3s ease;
      width: 44px; /* Slightly larger */ height: 44px;
      display: flex; align-items: center; justify-content: center;
      position: absolute; /* Position top right */
      top: 50%;
      right: 1.5rem;
      transform: translateY(-50%);
  }
  .theme-toggle:hover {
      background-color: var(--theme-toggle-hover-bg);
  }
  
  /* Main Layout */
  .app-main { flex-grow: 1; display: flex; justify-content: center; width: 100%; padding: 3rem 1rem; overflow-y: auto; align-items: stretch; }
  .main-layout-wrapper { display: flex; flex-wrap: wrap; gap: 2rem; width: 100%; max-width: 1200px; margin: 0 auto; align-items: stretch; }
  
  /* Quiz Content Area */
  .quiz-content-area { flex-grow: 1; flex-basis: 60%; min-width: 300px; display: flex; }
  .activity-container { background-color: var(--bg-secondary); border-radius: 12px; padding: 2rem; border: 1px solid var(--border-primary); width: 100%; text-align: center; box-shadow: 0 4px 15px var(--shadow-color); min-height: 300px; display: flex; flex-direction: column; flex-grow: 1; justify-content: flex-start; transition: background-color 0.3s ease, border-color 0.3s ease; }
  .quiz-area > h2 { color: var(--text-heading); margin-bottom: 1rem; font-weight: 600; font-size: 1.4rem; flex-shrink: 0; text-align: center;}
  
  /* Leaderboard Styles */
  .leaderboard { flex-grow: 1; flex-basis: 30%; min-width: 250px; max-width: 350px; background-color: var(--bg-secondary); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border-primary); box-shadow: 0 4px 15px var(--shadow-color); align-self: flex-start; max-height: calc(100vh - 6rem - 4rem - 3rem); display: flex; flex-direction: column; transition: background-color 0.3s ease, border-color 0.3s ease; }
  .leaderboard h3 { color: var(--text-heading); font-weight: 600; font-size: 1.3rem; text-align: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-primary); padding-bottom: 0.8rem; flex-shrink: 0; }
  .leaderboard-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; scrollbar-width: thin; scrollbar-color: var(--text-muted) var(--bg-secondary); }
  .leaderboard-list::-webkit-scrollbar { width: 8px; }
  .leaderboard-list::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
  .leaderboard-list::-webkit-scrollbar-thumb { background-color: var(--text-muted); border-radius: 4px; border: 2px solid var(--bg-secondary); }
  .leaderboard-item { display: flex; justify-content: space-between; align-items: baseline; padding: 0.6rem 0.3rem; border-bottom: 1px solid var(--border-primary); font-size: 0.95rem; gap: 1em; border-radius: 4px; transition: background-color 0.2s ease; }
  .leaderboard-item:last-child { border-bottom: none; }
  .leaderboard-item span:first-child { color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .leaderboard-item span:last-child { color: var(--accent-primary); font-weight: 600; flex-shrink: 0; }
  .leaderboard-item.current-user-score { background-color: var(--highlight-bg); }
  .leaderboard-item.current-user-score span:first-child,
  .leaderboard-item.current-user-score span:last-child { font-weight: 700; }
  .loading-message, .no-scores-message { text-align: center; color: var(--text-muted); padding: 2rem 0; font-style: italic; flex-grow: 1; display: flex; align-items: center; justify-content: center; }
  
  /* Start Quiz View Styles */
  .start-quiz-container { padding: 1rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%; flex-grow: 1; justify-content: space-around; }
  .start-controls { display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%; max-width: 500px; margin-top: 1rem; }
  .start-controls > p.username-prompt { color: var(--text-secondary); font-size: 1.05rem; margin-bottom: 0.5rem; }
  
  /* Instructions Styles */
  .instructions { background-color: var(--bg-instructions); border: 1px solid var(--border-primary); border-radius: 8px; padding: 1.5rem 2rem; margin-bottom: 1rem; text-align: left; max-width: 90%; flex-shrink: 0; color: var(--text-secondary); transition: background-color 0.3s ease, border-color 0.3s ease; }
  .instructions h2 { font-size: 1.5rem; color: var(--accent-primary); margin-bottom: 1rem; text-align: center; font-weight: 600; }
  .instructions p.instruction-intro { text-align: center; margin-bottom: 1.5rem; font-size: 1.05rem; color: var(--text-primary); }
  .instructions ul { list-style: none; padding-left: 0.5rem; font-size: 1rem; }
  .instructions li { margin-bottom: 0.75rem; line-height: 1.6; position: relative; padding-left: 25px; color: var(--text-secondary); }
  .instructions li::before { content: '★'; color: var(--accent-secondary); position: absolute; left: 0; top: 2px; font-weight: bold; font-size: 0.9em; }
  
  .username-entry { display: flex; justify-content: center; align-items: center; gap: 0.8rem; margin-bottom: 1rem; flex-wrap: wrap; width: 100%; }
  .username-input { padding: 0.6rem 1rem; border-radius: 20px; border: 1px solid var(--border-secondary); background-color: var(--bg-tertiary); color: var(--text-primary); font-size: 1rem; min-width: 180px; flex-grow: 1; text-align: center; transition: background-color 0.3s ease, border-color 0.3s ease; }
  .username-input::placeholder { color: var(--text-muted); }
  .username-input:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 8px var(--glow-color); }
  .confirm-username-button { padding: 0.6rem 1.2rem; border-radius: 20px; border: 1px solid var(--border-accent); background-color: var(--bg-tertiary); color: var(--accent-primary); font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease-in-out; white-space: nowrap; }
  .confirm-username-button:hover:not(:disabled) { background-color: var(--bg-secondary); border-color: var(--accent-primary-hover-bg); color: var(--accent-primary-hover-bg); }
  .confirm-username-button:disabled { opacity: 0.5; cursor: not-allowed; border-color: var(--border-secondary); color: var(--text-muted); }
  .username-confirmed { color: var(--accent-primary); font-size: 1rem; margin-bottom: 1rem; font-weight: 500; }
  .username-confirmed strong { color: var(--text-primary); font-style: normal; font-weight: 600; }
  .start-button { background-color: var(--accent-primary); color: var(--text-inverted); border: none; padding: 0.8rem 2.5rem; border-radius: 25px; cursor: pointer; font-size: 1.2rem; font-weight: 600; transition: all 0.25s ease-in-out; box-shadow: 0 4px 10px var(--glow-color); }
  .start-button:disabled { opacity: 0.5; cursor: not-allowed; background-color: var(--bg-tertiary); color: var(--text-muted); box-shadow: none; transform: none; }
  .start-button:hover:not(:disabled) { background-color: var(--accent-primary-hover-bg); transform: translateY(-2px); box-shadow: 0 6px 15px var(--glow-color); }
  .start-button:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 5px var(--glow-color); }
  
  /* In-Quiz / Results Styles */
  .current-user { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 0.5rem; text-align: left; padding-left: 0; font-style: normal; font-weight: 500; height: 1.1em; flex-shrink: 0; }
  .quiz-area { width: 100%; display: flex; flex-direction: column; flex-grow: 1; }
  .question-container { margin-top: 0.5rem; padding: 2rem; background-color: var(--bg-instructions); border-radius: 8px; border: 1px solid var(--border-primary); min-height: 250px; display: flex; flex-direction: column; flex-grow: 1; transition: background-color 0.3s ease, border-color 0.3s ease;}
  .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; height: 1.2em; flex-shrink: 0; }
  .question-container h3 { margin-bottom: 2rem; margin-top: 1rem; font-size: 2rem; color: var(--accent-secondary); font-weight: 600; word-wrap: break-word; flex-grow: 1; display: flex; align-items: center; justify-content: center; }
  .options-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2rem; margin-top: 1rem; flex-shrink: 0; }
  .option-button { background-color: var(--bg-tertiary); color: var(--accent-primary); border: 2px solid var(--border-accent); padding: 1rem 1.2rem; border-radius: 25px; cursor: pointer; font-size: 1.1rem; font-weight: 500; transition: all 0.25s ease-in-out; text-align: center; }
  .option-button:disabled { cursor: not-allowed; opacity: 0.6; transform: none; box-shadow: none; }
  .option-button:hover:not(:disabled) { background-color: var(--accent-primary); color: var(--text-inverted); border-color: var(--accent-primary); transform: translateY(-3px); box-shadow: 0 0 15px var(--glow-color); }
  .option-button:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .question-counter { font-size: 1rem; color: var(--text-muted); font-weight: 500; text-align: left; }
  .timer { font-size: 1rem; color: var(--accent-primary); font-weight: 500; text-align: right; }
  .fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
  .fade-enter-from, .fade-leave-to { opacity: 0; }
  .results-container { margin-top: 0.5rem; padding: 2.5rem; background-color: var(--bg-instructions); border-radius: 8px; border: 1px solid var(--border-primary); text-align: center; color: var(--text-primary); flex-grow: 1; display: flex; flex-direction: column; transition: background-color 0.3s ease, border-color 0.3s ease;}
  .results-container h2 { color: var(--text-heading); margin-bottom: 1.5rem; font-size: 1.6rem; flex-shrink: 0; }
  .results-list { list-style: none; padding: 0; margin-top: 1.5rem; text-align: left; overflow-y: auto; flex-grow: 1; }
  .results-list li { background-color: var(--bg-tertiary); padding: 1rem 1.2rem; border-radius: 6px; margin-bottom: 1rem; border-left: 5px solid; display: flex; flex-direction: column; gap: 0.5rem; transition: background-color 0.3s ease; }
  .result-line-1 { display: flex; justify-content: space-between; align-items: baseline; width: 100%; gap: 1em; }
  .result-details { display: flex; gap: 0.8em; align-items: baseline; white-space: nowrap; flex-shrink: 0; }
  .result-score { font-size: 0.9rem; color: var(--text-heading); font-weight: 500; }
  .results-list li.correct { border-left-color: var(--correct-color); }
  .results-list li.correct .correct-indicator { color: var(--correct-color); font-weight: bold; margin-left: 0.5em; }
  .results-list li.incorrect { border-left-color: var(--incorrect-color); }
  .results-list li.incorrect .correct-answer-text { color: var(--incorrect-text-color); font-style: italic; margin-left: 0.2em; }
  .result-question { font-weight: 600; color: var(--text-heading); font-size: 1.05rem; }
  .result-time { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
  .result-answer { font-size: 0.95rem; color: var(--text-secondary); padding-left: 5px; }
  .result-fact { font-size: 0.85rem; color: var(--accent-primary); font-style: italic; margin-top: 0.4rem; padding-left: 5px; text-align: left; }
  .final-score { margin-top: 1.5rem; font-size: 1.6rem; font-weight: 600; color: var(--text-heading); flex-shrink: 0; }
  .reset-button { background-color: transparent; color: var(--reset-text-color); border: 2px solid var(--reset-border-color); padding: 0.6rem 2rem; border-radius: 25px; cursor: pointer; font-size: 1rem; font-weight: 500; transition: all 0.25s ease-in-out; margin-top: 1.5rem; flex-shrink: 0; }
  .reset-button:hover { background-color: var(--reset-hover-bg); color: var(--reset-hover-color); border-color: var(--reset-hover-color); transform: translateY(-1px); }
  .reset-button:active { background-color: rgba(255, 59, 48, 0.25); /* Consider variable */ transform: translateY(0); }
  
  /* Footer Styling */
  .app-footer { background-color: var(--bg-secondary); color: var(--text-muted); padding: 1rem; width: 100%; text-align: center; margin-top: auto; border-top: 1px solid var(--border-primary); font-size: 0.9rem; flex-shrink: 0; transition: background-color 0.3s ease, border-color 0.3s ease; }
  .app-footer p { margin: 0; }
  
  /* Accessibility helper */
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
  
  /* Responsive Adjustments */
  @media (max-width: 992px) {
      .app-main { align-items: flex-start; }
      .main-layout-wrapper { flex-direction: column; align-items: center; max-width: 850px; gap: 1.5rem; }
      .quiz-content-area { flex: none; width: 100%; max-width: 850px; order: 1; }
      .leaderboard { order: 2; flex: none; width: 100%; max-width: 650px; max-height: 40vh; align-self: center; }
      .activity-container { padding: 2rem; flex-grow: 0; }
  }
  @media (max-width: 600px) {
      .app-main { padding: 1rem 0.5rem; }
      .activity-container { padding: 1.5rem 1rem; width: 95%; max-width: none; }
      .app-header h1 { font-size: 1.5rem; padding-left: 40px; padding-right: 40px; /* Ensure space for toggle */}
      .theme-toggle { right: 0.5rem; width: 36px; height: 36px; font-size: 1.2rem;} /* Adjust toggle size/pos */
      .question-container h3 { font-size: 1.6rem; }
      .question-container { padding: 1.5rem; min-height: 200px; }
      .question-header { margin-bottom: 1rem; }
      .option-button { padding: 0.7rem 0.8rem; font-size: 0.9rem; }
      .username-entry { flex-direction: column; width: 100%; gap: 0.8rem; }
      .username-input { min-width: initial; width: 90%; max-width: none; }
      .confirm-username-button { width: 70%; max-width: 200px; }
      .start-button { font-size: 1.1rem; padding: 0.7rem 2rem; }
      .current-user { padding-left: 0; font-size: 0.9rem; }
      .results-container { padding: 1.5rem; }
      .results-list li { padding: 0.8rem 1rem; }
      .final-score { font-size: 1.3rem; margin-top: 1.5rem; }
      .result-question { font-size: 1rem; }
      .result-answer { font-size: 0.9rem; }
      .result-details { gap: 0.5em; }
      .result-score, .result-time { font-size: 0.8rem; }
      .reset-button { padding: 0.5rem 1.5rem; font-size: 0.9rem; margin-top: 1rem; }
      .leaderboard { padding: 1rem; max-width: 100%; }
      .leaderboard h3 { font-size: 1.2rem; }
      .leaderboard-item { font-size: 0.9rem; padding: 0.5rem 0.2rem; }
      .result-fact { font-size: 0.8rem; }
      .instructions { padding: 1rem 1.2rem; margin-bottom: 1rem; max-width: 100%; }
      .instructions h2 { font-size: 1.3rem;}
      .instructions ul { font-size: 0.9rem; }
      .instructions li { line-height: 1.5; margin-bottom: 0.6rem; }
  }
  
  </style>