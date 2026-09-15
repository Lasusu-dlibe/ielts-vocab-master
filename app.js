/* ============================================================
   IELTS Vocabulary Master — Application Logic
   Features: SRS (SM-2), Flashcards, CRUD, Progress Tracking
   ============================================================ */

const App = (() => {
  // ── Constants ──
  const STORAGE_KEY = 'ielts_vocab_master';
  const ACTIVITY_KEY = 'ielts_activity_log';
  const SETTINGS_KEY = 'ielts_settings';

  const TOPICS = [
    'General', 'Education', 'Environment', 'Technology', 'Health',
    'Society', 'Government', 'Media', 'Globalization',
    'Work & Economy', 'Arts & Culture', 'Science', 'Crime'
  ];

  const TOPIC_COLORS = {
    'General': '#667eea',
    'Education': '#4facfe',
    'Environment': '#43e97b',
    'Technology': '#f093fb',
    'Health': '#fa709a',
    'Society': '#f6d365',
    'Government': '#764ba2',
    'Media': '#fda085',
    'Globalization': '#38f9d7',
    'Work & Economy': '#fee140',
    'Arts & Culture': '#a18cd1',
    'Science': '#00f2fe',
    'Crime': '#ff6b6b'
  };

  const LEARNING_TIPS = [
    '💡 Mỗi ngày chỉ cần học 10-15 từ mới. Chất lượng > Số lượng!',
    '💡 Luôn học từ trong ngữ cảnh — đừng bao giờ chỉ học từ + nghĩa đơn lẻ.',
    '💡 Collocation quan trọng hơn từ vựng "khủng". Hãy chú ý các cụm từ tự nhiên!',
    '💡 Mỗi khi học 1 từ mới, hãy tra thêm Word Family (noun/verb/adj/adv).',
    '💡 Viết ít nhất 1 câu với từ mới mỗi ngày để chuyển từ Passive → Active.',
    '💡 Đọc báo tiếng Anh (BBC, National Geographic) 15 phút/ngày = nguồn từ vựng tuyệt vời.',
    '💡 Paraphrase: Viết lại 1 câu bằng 3 cách khác nhau để luyện synonyms.',
    '💡 IELTS đánh giá: Accuracy > Range > Collocations > Word Formation.',
    '💡 Academic Word List (570 từ) là nền tảng — hãy bắt đầu từ Sublist 1!',
    '💡 Nghe TED Talks với phụ đề tiếng Anh — cách tuyệt vời để gặp từ mới trong ngữ cảnh.',
    '💡 Ôn tập Anki/Flashcard đều đặn mỗi sáng 10 phút — consistency is key!',
    '💡 Band 7+: Dùng "make a decision" thay vì "do a decision" — collocations tự nhiên!',
    '💡 Ghi chú từ mới kèm câu gốc + câu tự đặt = nhớ lâu gấp 3 lần.',
    '💡 Sử dụng quy tắc "Goldilocks": Chọn tài liệu hiểu 95-98% để học hiệu quả nhất.',
    '💡 Đặt alarm ôn tập cố định mỗi ngày — biến nó thành thói quen!'
  ];

  // ── State ──
  let words = [];
  let activityLog = {};
  let currentPage = 'dashboard';
  let reviewQueue = [];
  let reviewIndex = 0;
  let isCardFlipped = false;
  let reviewStats = { reviewed: 0, again: 0, good: 0 };
  let editingWordId = null;

  // ── Storage ──
  function loadData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      words = data ? JSON.parse(data) : [];
      const activity = localStorage.getItem(ACTIVITY_KEY);
      activityLog = activity ? JSON.parse(activity) : {};
    } catch (e) {
      console.error('Error loading data:', e);
      words = [];
      activityLog = {};
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityLog));
    } catch (e) {
      console.error('Error saving data:', e);
      showToast('Lỗi lưu dữ liệu!', 'error');
    }
  }

  // ── SRS Algorithm (SM-2 Variant) ──
  function createSRSData() {
    return {
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReview: new Date().toISOString(),
      lastReviewed: null
    };
  }

  function calculateNextReview(word, rating) {
    // rating: 0=Again, 1=Hard, 2=Good, 3=Easy
    let { interval, repetition, easeFactor } = word.srs;

    if (rating === 0) {
      // Again — reset
      repetition = 0;
      interval = 1;
    } else if (rating === 1) {
      // Hard
      if (repetition === 0) {
        interval = 1;
      } else {
        interval = Math.max(1, Math.round(interval * 1.2));
      }
      repetition = Math.max(1, repetition);
    } else if (rating === 2) {
      // Good
      if (repetition === 0) interval = 1;
      else if (repetition === 1) interval = 3;
      else interval = Math.round(interval * easeFactor);
      repetition++;
    } else if (rating === 3) {
      // Easy
      if (repetition === 0) interval = 2;
      else if (repetition === 1) interval = 4;
      else interval = Math.round(interval * easeFactor * 1.3);
      repetition++;
    }

    // Update ease factor
    easeFactor += (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      interval,
      repetition,
      easeFactor: Math.round(easeFactor * 100) / 100,
      nextReview: nextReview.toISOString(),
      lastReviewed: new Date().toISOString()
    };
  }

  function getPreviewIntervals(word) {
    const intervals = [];
    for (let r = 0; r <= 3; r++) {
      const result = calculateNextReview(word, r);
      intervals.push(result.interval);
    }
    return intervals;
  }

  function formatInterval(days) {
    if (days === 0) return 'Hôm nay';
    if (days === 1) return '1 ngày';
    if (days < 7) return `${days} ngày`;
    if (days < 30) return `${Math.round(days / 7)} tuần`;
    return `${Math.round(days / 30)} tháng`;
  }

  function getWordStatus(word) {
    if (!word.srs.lastReviewed) return 'new';
    if (word.srs.interval >= 21) return 'mastered';
    if (word.srs.repetition >= 2) return 'review';
    return 'learning';
  }

  function getDueWords() {
    const now = new Date();
    return words.filter(w => new Date(w.srs.nextReview) <= now);
  }

  // ── Unique ID ──
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // ── Navigation ──
  function navigate(pageName) {
    currentPage = pageName;

    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Update page visibility
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    // Refresh page content
    switch (pageName) {
      case 'dashboard': renderDashboard(); break;
      case 'add-word': break;
      case 'review': initReview(); break;
      case 'word-bank': renderWordBank(); break;
      case 'progress': renderProgress(); break;
    }
  }

  // ── Dashboard ──
  function renderDashboard() {
    // Greeting
    const hour = new Date().getHours();
    let greeting, emoji;
    if (hour < 12) { greeting = 'Chào buổi sáng'; emoji = '☀️'; }
    else if (hour < 18) { greeting = 'Chào buổi chiều'; emoji = '🌤️'; }
    else { greeting = 'Chào buổi tối'; emoji = '🌙'; }
    document.getElementById('dashboard-greeting').textContent = `${greeting}! ${emoji}`;

    // Stats
    const dueWords = getDueWords();
    const mastered = words.filter(w => getWordStatus(w) === 'mastered').length;
    const streak = calculateStreak();

    document.getElementById('stat-total').textContent = words.length;
    document.getElementById('stat-due').textContent = dueWords.length;
    document.getElementById('stat-mastered').textContent = mastered;
    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('sidebar-streak').textContent = streak;

    // Review badge
    const badge = document.getElementById('review-badge');
    if (dueWords.length > 0) {
      badge.textContent = dueWords.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Action review description
    document.getElementById('action-review-desc').textContent =
      dueWords.length > 0
        ? `${dueWords.length} từ cần ôn hôm nay`
        : 'Không có từ cần ôn';

    // Recent words
    renderRecentWords();

    // Topic distribution
    renderTopicBars('topic-bars');
  }

  function renderRecentWords() {
    const container = document.getElementById('recent-words-list');
    const recent = [...words].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 6);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="wordbank-empty" style="padding:var(--space-lg)">
          <p class="text-muted">Chưa có từ vựng nào. Hãy thêm từ mới!</p>
        </div>`;
      return;
    }

    container.innerHTML = recent.map(w => {
      const color = TOPIC_COLORS[w.topic] || '#667eea';
      return `
        <div class="recent-word-item" onclick="App.showWordDetail('${w.id}')">
          <div class="word-info">
            <div class="word-dot" style="background:${color}"></div>
            <div>
              <div class="word-english">${escapeHtml(w.word)}</div>
              <div class="word-meaning">${escapeHtml(w.meaning)}</div>
            </div>
          </div>
          <div class="word-topic" style="background:${color}15;color:${color}">${w.topic}</div>
        </div>`;
    }).join('');
  }

  function renderTopicBars(containerId) {
    const container = document.getElementById(containerId);
    if (words.length === 0) {
      container.innerHTML = `
        <div class="wordbank-empty" style="padding:var(--space-lg)">
          <p class="text-muted">Thêm từ vựng để xem phân bố chủ đề.</p>
        </div>`;
      return;
    }

    const topicCounts = {};
    words.forEach(w => {
      topicCounts[w.topic] = (topicCounts[w.topic] || 0) + 1;
    });

    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] || 1;

    container.innerHTML = sorted.map(([topic, count]) => {
      const color = TOPIC_COLORS[topic] || '#667eea';
      const pct = (count / maxCount * 100).toFixed(0);
      return `
        <div class="topic-bar-item">
          <div class="topic-bar-header">
            <span class="topic-name">${topic}</span>
            <span class="topic-count">${count} từ</span>
          </div>
          <div class="topic-bar-track">
            <div class="topic-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
    }).join('');
  }

  function calculateStreak() {
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      if (activityLog[key] && activityLog[key] > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  function logActivity() {
    const key = new Date().toISOString().split('T')[0];
    activityLog[key] = (activityLog[key] || 0) + 1;
    saveData();
  }

  // ── Add Word ──
  function initAddWordForm() {
    const form = document.getElementById('add-word-form');
    form.addEventListener('submit', handleAddWord);

    // Live preview
    ['input-word', 'input-pronunciation', 'input-meaning',
      'input-collocations', 'input-original-sentence',
      'input-personal-sentence', 'input-synonyms', 'input-topic'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    // Add family button
    document.getElementById('btn-add-family').addEventListener('click', addWordFamilyEntry);

    updatePreview();
  }

  function addWordFamilyEntry() {
    const list = document.getElementById('word-family-list');
    const entry = document.createElement('div');
    entry.className = 'word-family-entry';
    entry.innerHTML = `
      <input type="text" class="form-input family-word" placeholder="Từ">
      <input type="text" class="form-input family-type" placeholder="Loại">
      <input type="text" class="form-input family-meaning" placeholder="Nghĩa">
      <button type="button" class="btn-remove-family" onclick="this.parentElement.remove();App.updatePreview()">✕</button>
    `;
    list.appendChild(entry);

    // Listen for preview updates
    entry.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', updatePreview);
    });
  }

  function updatePreview() {
    const word = document.getElementById('input-word').value || 'word';
    const pron = document.getElementById('input-pronunciation').value;
    const meaning = document.getElementById('input-meaning').value || 'nghĩa tiếng Việt';
    const collocations = document.getElementById('input-collocations').value;
    const origSentence = document.getElementById('input-original-sentence').value;
    const persSentence = document.getElementById('input-personal-sentence').value;
    const synonyms = document.getElementById('input-synonyms').value;
    const topic = document.getElementById('input-topic').value;

    document.getElementById('preview-word').textContent = word;
    document.getElementById('preview-pron').textContent = pron || '';
    document.getElementById('preview-meaning').textContent = meaning;

    // Collocations
    const colSec = document.getElementById('preview-collocations-section');
    if (collocations.trim()) {
      colSec.style.display = '';
      document.getElementById('preview-collocations').textContent = collocations;
    } else {
      colSec.style.display = 'none';
    }

    // Word Family
    const famSec = document.getElementById('preview-family-section');
    const familyEntries = getWordFamilyFromForm();
    if (familyEntries.length > 0) {
      famSec.style.display = '';
      document.getElementById('preview-family').innerHTML =
        familyEntries.map(f => `${f.word} (${f.type}) — ${f.meaning}`).join('<br>');
    } else {
      famSec.style.display = 'none';
    }

    // Sentence
    const senSec = document.getElementById('preview-sentence-section');
    const sentences = [origSentence, persSentence].filter(Boolean);
    if (sentences.length > 0) {
      senSec.style.display = '';
      document.getElementById('preview-sentence').innerHTML =
        sentences.map(s => `"${escapeHtml(s)}"`).join('<br>');
    } else {
      senSec.style.display = 'none';
    }

    // Synonyms
    const synSec = document.getElementById('preview-synonyms-section');
    if (synonyms.trim()) {
      synSec.style.display = '';
      document.getElementById('preview-synonyms').innerHTML =
        synonyms.split(',').map(s => s.trim()).filter(Boolean)
          .map(s => `<span class="preview-tag">${escapeHtml(s)}</span>`).join('');
    } else {
      synSec.style.display = 'none';
    }

    // Topic
    const topSec = document.getElementById('preview-topic-section');
    if (topic) {
      topSec.style.display = '';
      const color = TOPIC_COLORS[topic] || '#667eea';
      document.getElementById('preview-topic').innerHTML =
        `<span class="preview-tag" style="background:${color}15;color:${color}">${topic}</span>`;
    } else {
      topSec.style.display = 'none';
    }
  }

  function getWordFamilyFromForm() {
    const entries = document.querySelectorAll('.word-family-entry');
    const result = [];
    entries.forEach(entry => {
      const word = entry.querySelector('.family-word').value.trim();
      const type = entry.querySelector('.family-type').value.trim();
      const meaning = entry.querySelector('.family-meaning').value.trim();
      if (word) result.push({ word, type, meaning });
    });
    return result;
  }

  function handleAddWord(e) {
    e.preventDefault();

    const wordText = document.getElementById('input-word').value.trim();
    const meaning = document.getElementById('input-meaning').value.trim();

    if (!wordText || !meaning) {
      showToast('Vui lòng nhập từ vựng và nghĩa!', 'error');
      return;
    }

    // Check duplicate
    if (words.some(w => w.word.toLowerCase() === wordText.toLowerCase() && w.id !== editingWordId)) {
      showToast(`Từ "${wordText}" đã tồn tại trong kho!`, 'error');
      return;
    }

    const wordData = {
      id: editingWordId || generateId(),
      word: wordText,
      pronunciation: document.getElementById('input-pronunciation').value.trim(),
      meaning: meaning,
      pos: document.getElementById('input-pos').value,
      collocations: document.getElementById('input-collocations').value.trim(),
      wordFamily: getWordFamilyFromForm(),
      originalSentence: document.getElementById('input-original-sentence').value.trim(),
      personalSentence: document.getElementById('input-personal-sentence').value.trim(),
      synonyms: document.getElementById('input-synonyms').value.trim(),
      topic: document.getElementById('input-topic').value || 'General',
      srs: editingWordId
        ? words.find(w => w.id === editingWordId)?.srs || createSRSData()
        : createSRSData(),
      createdAt: editingWordId
        ? words.find(w => w.id === editingWordId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };

    if (editingWordId) {
      const idx = words.findIndex(w => w.id === editingWordId);
      if (idx !== -1) words[idx] = wordData;
      editingWordId = null;
      document.getElementById('btn-save-word').innerHTML = '💾 Lưu Từ Vựng';
      showToast(`Đã cập nhật "${wordText}"!`, 'success');
    } else {
      words.push(wordData);
      logActivity();
      showToast(`Đã thêm "${wordText}" vào kho từ vựng!`, 'success');
    }

    saveData();
    resetAddForm();
    updateReviewBadge();
  }

  function resetAddForm() {
    document.getElementById('add-word-form').reset();
    document.getElementById('word-family-list').innerHTML = '';
    editingWordId = null;
    document.getElementById('btn-save-word').innerHTML = '💾 Lưu Từ Vựng';
    updatePreview();
  }

  function editWord(id) {
    const word = words.find(w => w.id === id);
    if (!word) return;

    editingWordId = id;
    navigate('add-word');

    // Fill form
    document.getElementById('input-word').value = word.word;
    document.getElementById('input-pronunciation').value = word.pronunciation || '';
    document.getElementById('input-meaning').value = word.meaning;
    document.getElementById('input-pos').value = word.pos || '';
    document.getElementById('input-collocations').value = word.collocations || '';
    document.getElementById('input-original-sentence').value = word.originalSentence || '';
    document.getElementById('input-personal-sentence').value = word.personalSentence || '';
    document.getElementById('input-synonyms').value = word.synonyms || '';
    document.getElementById('input-topic').value = word.topic || 'General';

    // Word family
    const familyList = document.getElementById('word-family-list');
    familyList.innerHTML = '';
    if (word.wordFamily && word.wordFamily.length > 0) {
      word.wordFamily.forEach(f => {
        addWordFamilyEntry();
        const entries = familyList.querySelectorAll('.word-family-entry');
        const last = entries[entries.length - 1];
        last.querySelector('.family-word').value = f.word || '';
        last.querySelector('.family-type').value = f.type || '';
        last.querySelector('.family-meaning').value = f.meaning || '';
      });
    }

    document.getElementById('btn-save-word').innerHTML = '💾 Cập Nhật Từ';
    updatePreview();
    closeModal();
  }

  function deleteWord(id) {
    const word = words.find(w => w.id === id);
    if (!word) return;

    if (confirm(`Bạn có chắc muốn xóa từ "${word.word}"?`)) {
      words = words.filter(w => w.id !== id);
      saveData();
      showToast(`Đã xóa "${word.word}"`, 'info');
      closeModal();
      if (currentPage === 'word-bank') renderWordBank();
      if (currentPage === 'dashboard') renderDashboard();
      updateReviewBadge();
    }
  }

  // ── Review / Flashcards ──
  function initReview() {
    reviewQueue = getDueWords();
    reviewIndex = 0;
    isCardFlipped = false;
    reviewStats = { reviewed: 0, again: 0, good: 0 };

    const activeEl = document.getElementById('review-active');
    const completeEl = document.getElementById('review-complete');
    const emptyEl = document.getElementById('review-empty');

    if (reviewQueue.length === 0) {
      activeEl.classList.add('hidden');
      completeEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    activeEl.classList.remove('hidden');
    completeEl.classList.add('hidden');
    emptyEl.classList.add('hidden');

    showCurrentCard();
  }

  function showCurrentCard() {
    if (reviewIndex >= reviewQueue.length) {
      finishReview();
      return;
    }

    const word = reviewQueue[reviewIndex];
    isCardFlipped = false;

    // Reset card
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');
    document.getElementById('rating-buttons').classList.add('hidden');

    // Front
    document.getElementById('card-word').textContent = word.word;
    document.getElementById('card-pronunciation').textContent = word.pronunciation || '';
    document.getElementById('card-topic').textContent = word.topic;

    // Back
    document.getElementById('back-word').textContent = word.word;
    document.getElementById('back-pronunciation').textContent = word.pronunciation || '';
    document.getElementById('back-meaning').textContent = word.meaning;

    // Collocations
    const colSec = document.getElementById('back-collocations-section');
    if (word.collocations) {
      colSec.classList.remove('hidden');
      document.getElementById('back-collocations').textContent = word.collocations;
    } else {
      colSec.classList.add('hidden');
    }

    // Word Family
    const famSec = document.getElementById('back-family-section');
    if (word.wordFamily && word.wordFamily.length > 0) {
      famSec.classList.remove('hidden');
      document.getElementById('back-family').innerHTML =
        word.wordFamily.map(f => `${f.word} (${f.type}) — ${f.meaning}`).join('<br>');
    } else {
      famSec.classList.add('hidden');
    }

    // Sentences
    const senSec = document.getElementById('back-sentence-section');
    const sentences = [word.originalSentence, word.personalSentence].filter(Boolean);
    if (sentences.length > 0) {
      senSec.classList.remove('hidden');
      document.getElementById('back-sentence').innerHTML =
        sentences.map(s => `"${escapeHtml(s)}"`).join('<br>');
    } else {
      senSec.classList.add('hidden');
    }

    // Synonyms
    const synSec = document.getElementById('back-synonyms-section');
    if (word.synonyms) {
      synSec.classList.remove('hidden');
      document.getElementById('back-synonyms').textContent = word.synonyms;
    } else {
      synSec.classList.add('hidden');
    }

    // Progress
    const total = reviewQueue.length;
    const done = reviewIndex;
    const pct = total > 0 ? (done / total * 100) : 0;
    document.getElementById('review-progress-fill').style.width = pct + '%';
    document.getElementById('review-progress-text').textContent = `${done} / ${total}`;

    // Preview intervals
    const intervals = getPreviewIntervals(word);
    document.getElementById('interval-again').textContent = formatInterval(intervals[0]);
    document.getElementById('interval-hard').textContent = formatInterval(intervals[1]);
    document.getElementById('interval-good').textContent = formatInterval(intervals[2]);
    document.getElementById('interval-easy').textContent = formatInterval(intervals[3]);
  }

  function flipCard() {
    if (isCardFlipped) return;
    isCardFlipped = true;

    document.getElementById('flashcard').classList.add('flipped');
    document.getElementById('rating-buttons').classList.remove('hidden');
  }

  function rateCard(rating) {
    if (!isCardFlipped || reviewIndex >= reviewQueue.length) return;

    const word = reviewQueue[reviewIndex];
    const wordInList = words.find(w => w.id === word.id);
    if (!wordInList) return;

    // Calculate new SRS
    wordInList.srs = calculateNextReview(wordInList, rating);
    logActivity();

    // Track stats
    reviewStats.reviewed++;
    if (rating === 0) reviewStats.again++;
    else if (rating >= 2) reviewStats.good++;

    // If "Again", add back to queue end
    if (rating === 0) {
      reviewQueue.push({ ...wordInList });
    }

    saveData();
    reviewIndex++;
    showCurrentCard();
  }

  function finishReview() {
    document.getElementById('review-active').classList.add('hidden');
    document.getElementById('review-complete').classList.remove('hidden');

    document.getElementById('summary-reviewed').textContent = reviewStats.reviewed;
    document.getElementById('summary-again').textContent = reviewStats.again;
    document.getElementById('summary-good').textContent = reviewStats.good;

    // Update badge
    updateReviewBadge();

    // Progress fill to 100
    document.getElementById('review-progress-fill').style.width = '100%';

    // Confetti!
    launchConfetti();
  }

  function updateReviewBadge() {
    const due = getDueWords().length;
    const badge = document.getElementById('review-badge');
    if (due > 0) {
      badge.textContent = due;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // ── Word Bank ──
  function renderWordBank() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const filterTopic = document.getElementById('filter-topic').value;
    const filterStatus = document.getElementById('filter-status').value;

    let filtered = [...words];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(w =>
        w.word.toLowerCase().includes(searchTerm) ||
        w.meaning.toLowerCase().includes(searchTerm) ||
        (w.synonyms && w.synonyms.toLowerCase().includes(searchTerm))
      );
    }

    // Topic filter
    if (filterTopic !== 'all') {
      filtered = filtered.filter(w => w.topic === filterTopic);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(w => getWordStatus(w) === filterStatus);
    }

    // Sort by newest first
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById('word-table-body');
    const emptyEl = document.getElementById('wordbank-empty');
    const tableContainer = document.getElementById('word-table-container');

    if (filtered.length === 0) {
      tableContainer.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    tbody.innerHTML = filtered.map(w => {
      const status = getWordStatus(w);
      const color = TOPIC_COLORS[w.topic] || '#667eea';
      const nextReview = w.srs.nextReview
        ? new Date(w.srs.nextReview).toLocaleDateString('vi-VN')
        : '—';
      const statusLabels = {
        'new': 'Mới',
        'learning': 'Đang học',
        'review': 'Ôn tập',
        'mastered': 'Đã thuộc'
      };

      return `
        <tr>
          <td class="word-cell">${escapeHtml(w.word)}</td>
          <td class="meaning-cell" title="${escapeHtml(w.meaning)}">${escapeHtml(w.meaning)}</td>
          <td>${w.pos || '—'}</td>
          <td class="topic-cell">
            <span class="topic-badge" style="background:${color}15;color:${color}">${w.topic}</span>
          </td>
          <td><span class="srs-badge ${status}">${statusLabels[status]}</span></td>
          <td style="font-size:12px;color:var(--text-muted)">${nextReview}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="App.showWordDetail('${w.id}')">👁️</button>
            <button class="btn btn-ghost btn-sm" onclick="App.editWord('${w.id}')">✏️</button>
          </td>
        </tr>`;
    }).join('');
  }

  function initWordBankFilters() {
    document.getElementById('search-input').addEventListener('input', renderWordBank);
    document.getElementById('filter-topic').addEventListener('change', renderWordBank);
    document.getElementById('filter-status').addEventListener('change', renderWordBank);
  }

  // ── Word Detail Modal ──
  function showWordDetail(id) {
    const word = words.find(w => w.id === id);
    if (!word) return;

    const status = getWordStatus(word);
    const statusLabels = { 'new': 'Mới', 'learning': 'Đang học', 'review': 'Ôn tập', 'mastered': 'Đã thuộc' };
    const color = TOPIC_COLORS[word.topic] || '#667eea';

    document.getElementById('modal-word-title').textContent = word.word;
    document.getElementById('modal-word-body').innerHTML = `
      <div style="margin-bottom:var(--space-lg)">
        <div style="font-size:32px;font-weight:800;letter-spacing:-0.5px">${escapeHtml(word.word)}</div>
        ${word.pronunciation ? `<div style="color:var(--color-accent);font-size:16px;margin-top:4px">${escapeHtml(word.pronunciation)}</div>` : ''}
        ${word.pos ? `<span class="srs-badge" style="margin-top:8px;display:inline-flex;background:rgba(255,255,255,0.05);color:var(--text-secondary)">${word.pos}</span>` : ''}
      </div>
      <div style="font-size:18px;color:var(--color-success);font-weight:600;margin-bottom:var(--space-lg);padding-bottom:var(--space-md);border-bottom:1px solid var(--border-glass)">
        ${escapeHtml(word.meaning)}
      </div>
      ${word.collocations ? `
        <div style="margin-bottom:var(--space-md)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px">Collocations</div>
          <div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(word.collocations)}</div>
        </div>` : ''}
      ${word.wordFamily && word.wordFamily.length > 0 ? `
        <div style="margin-bottom:var(--space-md)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px">Word Family</div>
          <div style="font-size:13px;color:var(--text-secondary)">
            ${word.wordFamily.map(f => `${escapeHtml(f.word)} (${escapeHtml(f.type)}) — ${escapeHtml(f.meaning)}`).join('<br>')}
          </div>
        </div>` : ''}
      ${word.originalSentence ? `
        <div style="margin-bottom:var(--space-md)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px">Câu Gốc</div>
          <div style="font-size:13px;color:var(--text-secondary);font-style:italic">"${escapeHtml(word.originalSentence)}"</div>
        </div>` : ''}
      ${word.personalSentence ? `
        <div style="margin-bottom:var(--space-md)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px">Câu Tự Đặt</div>
          <div style="font-size:13px;color:var(--text-secondary);font-style:italic">"${escapeHtml(word.personalSentence)}"</div>
        </div>` : ''}
      ${word.synonyms ? `
        <div style="margin-bottom:var(--space-md)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px">Synonyms</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${word.synonyms.split(',').map(s => s.trim()).filter(Boolean).map(s =>
              `<span class="preview-tag">${escapeHtml(s)}</span>`
            ).join('')}
          </div>
        </div>` : ''}
      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);padding-top:var(--space-md);border-top:1px solid var(--border-glass)">
        <span class="topic-badge" style="background:${color}15;color:${color};font-size:11px;padding:3px 10px;border-radius:9999px;font-weight:600">${word.topic}</span>
        <span class="srs-badge ${status}">${statusLabels[status]}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:auto">
          Interval: ${formatInterval(word.srs.interval)}
        </span>
      </div>
    `;

    document.getElementById('modal-delete-btn').onclick = () => deleteWord(id);

    const modal = document.getElementById('modal-word-detail');
    modal.classList.add('active');

    // Close on overlay click
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  function closeModal() {
    document.getElementById('modal-word-detail').classList.remove('active');
  }

  // ── Progress ──
  function renderProgress() {
    // Big stats
    const mastered = words.filter(w => getWordStatus(w) === 'mastered').length;
    const streak = calculateStreak();
    document.getElementById('progress-total').textContent = words.length;
    document.getElementById('progress-mastered').textContent = mastered;
    document.getElementById('progress-streak').textContent = streak;

    // Heatmap
    renderHeatmap();

    // Mastery levels
    renderMasteryLevels();

    // Topic bars
    renderTopicBars('progress-topic-bars');

    // Learning tip
    const tipIdx = Math.floor(Math.random() * LEARNING_TIPS.length);
    document.getElementById('learning-tip').textContent = LEARNING_TIPS[tipIdx];
  }

  function renderHeatmap() {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const count = activityLog[key] || 0;

      let level = '';
      if (count >= 15) level = 'level-4';
      else if (count >= 10) level = 'level-3';
      else if (count >= 5) level = 'level-2';
      else if (count >= 1) level = 'level-1';

      const day = document.createElement('div');
      day.className = `heatmap-day ${level}`;
      day.title = `${key}: ${count} hoạt động`;
      container.appendChild(day);
    }
  }

  function renderMasteryLevels() {
    const container = document.getElementById('mastery-levels');
    const total = words.length || 1;

    const counts = {
      new: words.filter(w => getWordStatus(w) === 'new').length,
      learning: words.filter(w => getWordStatus(w) === 'learning').length,
      review: words.filter(w => getWordStatus(w) === 'review').length,
      mastered: words.filter(w => getWordStatus(w) === 'mastered').length
    };

    const items = [
      { key: 'new', label: 'Mới', icon: '🆕', color: 'var(--color-primary)', bg: 'rgba(102,126,234,0.15)' },
      { key: 'learning', label: 'Đang học', icon: '📚', color: 'var(--color-warning)', bg: 'rgba(246,211,101,0.15)' },
      { key: 'review', label: 'Ôn tập', icon: '🔄', color: 'var(--color-accent)', bg: 'rgba(79,172,254,0.15)' },
      { key: 'mastered', label: 'Đã thuộc', icon: '✅', color: 'var(--color-success)', bg: 'rgba(67,233,123,0.15)' }
    ];

    container.innerHTML = items.map(item => {
      const pct = (counts[item.key] / total * 100).toFixed(0);
      return `
        <div class="mastery-item">
          <div class="mastery-icon" style="background:${item.bg}">${item.icon}</div>
          <div class="mastery-info">
            <div class="mastery-label">${item.label}</div>
            <div class="mastery-count">${counts[item.key]} từ</div>
          </div>
          <div class="mastery-bar">
            <div class="mastery-bar-fill" style="width:${pct}%;background:${item.color}"></div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Import / Export ──
  function exportData() {
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      words: words,
      activityLog: activityLog
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-vocab-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất dữ liệu!', 'success');
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.words && Array.isArray(data.words)) {
          const count = data.words.length;
          if (confirm(`Nhập ${count} từ vựng? Dữ liệu hiện tại sẽ được giữ nguyên, chỉ thêm từ mới.`)) {
            let added = 0;
            data.words.forEach(w => {
              if (!words.some(existing => existing.word.toLowerCase() === w.word.toLowerCase())) {
                if (!w.id) w.id = generateId();
                if (!w.srs) w.srs = createSRSData();
                if (!w.createdAt) w.createdAt = new Date().toISOString();
                words.push(w);
                added++;
              }
            });
            if (data.activityLog) {
              Object.entries(data.activityLog).forEach(([key, val]) => {
                activityLog[key] = Math.max(activityLog[key] || 0, val);
              });
            }
            saveData();
            showToast(`Đã nhập ${added} từ mới (bỏ qua ${count - added} từ trùng)!`, 'success');
            renderWordBank();
            updateReviewBadge();
          }
        } else {
          showToast('File không hợp lệ!', 'error');
        }
      } catch (err) {
        showToast('Lỗi đọc file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // ── Starter Pack ──
  function loadStarterPack() {
    if (words.some(w => w._starterPack)) {
      showToast('Starter Pack đã được tải trước đó!', 'info');
      return;
    }

    const starterWords = [
      {
        word: 'analyze', pronunciation: '/ˈæn.ə.laɪz/', meaning: 'phân tích',
        pos: 'verb', topic: 'Education',
        collocations: 'analyze data, analyze results, critically analyze',
        wordFamily: [
          { word: 'analysis', type: 'noun', meaning: 'sự phân tích' },
          { word: 'analyst', type: 'noun', meaning: 'nhà phân tích' },
          { word: 'analytical', type: 'adj', meaning: 'thuộc phân tích' }
        ],
        originalSentence: 'Scientists need to analyze the data before drawing any conclusions.',
        synonyms: 'examine, investigate, evaluate, assess',
      },
      {
        word: 'significant', pronunciation: '/sɪɡˈnɪf.ɪ.kənt/', meaning: 'quan trọng, đáng kể',
        pos: 'adjective', topic: 'General',
        collocations: 'significant impact, significant difference, statistically significant',
        wordFamily: [
          { word: 'significance', type: 'noun', meaning: 'tầm quan trọng' },
          { word: 'significantly', type: 'adv', meaning: 'một cách đáng kể' },
          { word: 'signify', type: 'verb', meaning: 'biểu thị, có nghĩa là' }
        ],
        originalSentence: 'There has been a significant increase in global temperatures over the past decade.',
        synonyms: 'important, notable, considerable, substantial',
      },
      {
        word: 'environment', pronunciation: '/ɪnˈvaɪ.rən.mənt/', meaning: 'môi trường',
        pos: 'noun', topic: 'Environment',
        collocations: 'protect the environment, natural environment, working environment',
        wordFamily: [
          { word: 'environmental', type: 'adj', meaning: 'thuộc về môi trường' },
          { word: 'environmentally', type: 'adv', meaning: 'về mặt môi trường' },
          { word: 'environmentalist', type: 'noun', meaning: 'nhà bảo vệ môi trường' }
        ],
        originalSentence: 'The government has introduced new policies to protect the environment.',
        synonyms: 'surroundings, habitat, ecosystem, setting',
      },
      {
        word: 'contribute', pronunciation: '/kənˈtrɪb.juːt/', meaning: 'đóng góp',
        pos: 'verb', topic: 'Society',
        collocations: 'contribute to, contribute significantly, contribute financially',
        wordFamily: [
          { word: 'contribution', type: 'noun', meaning: 'sự đóng góp' },
          { word: 'contributor', type: 'noun', meaning: 'người đóng góp' },
          { word: 'contributory', type: 'adj', meaning: 'có đóng góp' }
        ],
        originalSentence: 'Several factors contribute to the decline in biodiversity.',
        synonyms: 'give, provide, donate, supply',
      },
      {
        word: 'approach', pronunciation: '/əˈproʊtʃ/', meaning: 'cách tiếp cận; tiếp cận',
        pos: 'noun', topic: 'Education',
        collocations: 'different approach, adopt an approach, holistic approach',
        wordFamily: [
          { word: 'approachable', type: 'adj', meaning: 'dễ tiếp cận' }
        ],
        originalSentence: 'A new approach to language teaching has been widely adopted in schools.',
        synonyms: 'method, strategy, technique, way',
      },
      {
        word: 'sustainable', pronunciation: '/səˈsteɪ.nə.bəl/', meaning: 'bền vững',
        pos: 'adjective', topic: 'Environment',
        collocations: 'sustainable development, sustainable energy, sustainable growth',
        wordFamily: [
          { word: 'sustain', type: 'verb', meaning: 'duy trì' },
          { word: 'sustainability', type: 'noun', meaning: 'tính bền vững' },
          { word: 'sustainably', type: 'adv', meaning: 'một cách bền vững' }
        ],
        originalSentence: 'Many countries are investing heavily in sustainable energy sources.',
        synonyms: 'viable, maintainable, renewable, eco-friendly',
      },
      {
        word: 'technology', pronunciation: '/tekˈnɒl.ə.dʒi/', meaning: 'công nghệ',
        pos: 'noun', topic: 'Technology',
        collocations: 'modern technology, information technology, cutting-edge technology',
        wordFamily: [
          { word: 'technological', type: 'adj', meaning: 'thuộc công nghệ' },
          { word: 'technologically', type: 'adv', meaning: 'về mặt công nghệ' },
          { word: 'technologist', type: 'noun', meaning: 'nhà công nghệ' }
        ],
        originalSentence: 'Technology has transformed the way we communicate and access information.',
        synonyms: 'innovation, advancement, engineering',
      },
      {
        word: 'demonstrate', pronunciation: '/ˈdem.ən.streɪt/', meaning: 'chứng minh, minh họa',
        pos: 'verb', topic: 'Education',
        collocations: 'clearly demonstrate, demonstrate ability, demonstrate understanding',
        wordFamily: [
          { word: 'demonstration', type: 'noun', meaning: 'sự trình diễn' },
          { word: 'demonstrable', type: 'adj', meaning: 'có thể chứng minh' }
        ],
        originalSentence: 'The study demonstrates a clear link between exercise and mental health.',
        synonyms: 'show, prove, illustrate, exhibit',
      },
      {
        word: 'impact', pronunciation: '/ˈɪm.pækt/', meaning: 'tác động, ảnh hưởng',
        pos: 'noun', topic: 'General',
        collocations: 'have an impact, negative impact, significant impact, environmental impact',
        wordFamily: [
          { word: 'impactful', type: 'adj', meaning: 'có tác động lớn' }
        ],
        originalSentence: 'Social media has had a profound impact on how young people interact.',
        synonyms: 'effect, influence, consequence, repercussion',
      },
      {
        word: 'implement', pronunciation: '/ˈɪm.plɪ.ment/', meaning: 'thực hiện, triển khai',
        pos: 'verb', topic: 'Government',
        collocations: 'implement a policy, implement changes, fully implement',
        wordFamily: [
          { word: 'implementation', type: 'noun', meaning: 'sự thực hiện' }
        ],
        originalSentence: 'The government plans to implement stricter environmental regulations.',
        synonyms: 'execute, carry out, enforce, apply',
      },
      {
        word: 'perspective', pronunciation: '/pəˈspek.tɪv/', meaning: 'quan điểm, góc nhìn',
        pos: 'noun', topic: 'Society',
        collocations: 'different perspective, from a perspective, broader perspective',
        wordFamily: [],
        originalSentence: 'It is important to consider different perspectives before making a decision.',
        synonyms: 'viewpoint, standpoint, outlook, angle',
      },
      {
        word: 'phenomenon', pronunciation: '/fɪˈnɒm.ɪ.nən/', meaning: 'hiện tượng',
        pos: 'noun', topic: 'Science',
        collocations: 'natural phenomenon, cultural phenomenon, global phenomenon',
        wordFamily: [
          { word: 'phenomena', type: 'noun', meaning: 'các hiện tượng (số nhiều)' },
          { word: 'phenomenal', type: 'adj', meaning: 'phi thường' }
        ],
        originalSentence: 'Climate change is a global phenomenon that requires urgent action.',
        synonyms: 'occurrence, event, happening, spectacle',
      },
      {
        word: 'advocate', pronunciation: '/ˈæd.və.keɪt/', meaning: 'ủng hộ; người ủng hộ',
        pos: 'verb', topic: 'Society',
        collocations: 'advocate for, strongly advocate, advocate change',
        wordFamily: [
          { word: 'advocacy', type: 'noun', meaning: 'sự ủng hộ, vận động' },
          { word: 'advocate', type: 'noun', meaning: 'người ủng hộ' }
        ],
        originalSentence: 'Many experts advocate for a complete ban on single-use plastics.',
        synonyms: 'support, promote, champion, endorse',
      },
      {
        word: 'inevitable', pronunciation: '/ɪnˈev.ɪ.tə.bəl/', meaning: 'không thể tránh khỏi',
        pos: 'adjective', topic: 'General',
        collocations: 'inevitable consequence, seem inevitable, inevitable change',
        wordFamily: [
          { word: 'inevitably', type: 'adv', meaning: 'một cách không thể tránh khỏi' },
          { word: 'inevitability', type: 'noun', meaning: 'tính tất yếu' }
        ],
        originalSentence: 'Some degree of economic disruption is inevitable during a pandemic.',
        synonyms: 'unavoidable, inescapable, certain, bound to happen',
      },
      {
        word: 'deteriorate', pronunciation: '/dɪˈtɪə.ri.ə.reɪt/', meaning: 'xấu đi, suy giảm',
        pos: 'verb', topic: 'Health',
        collocations: 'deteriorate rapidly, health deteriorates, conditions deteriorate',
        wordFamily: [
          { word: 'deterioration', type: 'noun', meaning: 'sự suy giảm' }
        ],
        originalSentence: 'Air quality in major cities continues to deteriorate despite new regulations.',
        synonyms: 'decline, worsen, degrade, decay',
      }
    ];

    let added = 0;
    starterWords.forEach(sw => {
      if (!words.some(w => w.word.toLowerCase() === sw.word.toLowerCase())) {
        words.push({
          id: generateId(),
          ...sw,
          personalSentence: '',
          srs: createSRSData(),
          createdAt: new Date().toISOString(),
          _starterPack: true
        });
        added++;
      }
    });

    if (added > 0) {
      saveData();
      showToast(`Đã tải ${added} từ AWL Starter Pack! 🚀`, 'success');
      renderWordBank();
      updateReviewBadge();
    } else {
      showToast('Tất cả từ trong Starter Pack đã có trong kho!', 'info');
    }
  }

  // ── Toast ──
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ── Confetti ──
  function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#667eea', '#43e97b', '#f093fb', '#4facfe', '#f6d365', '#fa709a', '#38f9d7'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        if (p.opacity <= 0) return;
        alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;

        if (frame > 60) {
          p.opacity -= 0.015;
        }
      });

      frame++;
      if (alive && frame < 200) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    animate();
  }

  // ── Keyboard Shortcuts ──
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (currentPage !== 'review') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!isCardFlipped) {
          flipCard();
        }
      } else if (isCardFlipped) {
        if (e.key === '1') rateCard(0);
        else if (e.key === '2') rateCard(1);
        else if (e.key === '3') rateCard(2);
        else if (e.key === '4') rateCard(3);
      }
    });
  }

  // ── Utility ──
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Initialization ──
  function init() {
    loadData();
    initAddWordForm();
    initWordBankFilters();
    initKeyboardShortcuts();

    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });

    // Initial render
    renderDashboard();
    updateReviewBadge();

    console.log('🎓 IELTS Vocabulary Master initialized!');
    console.log(`📚 ${words.length} words loaded, ${getDueWords().length} due for review.`);
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);

  // Public API
  return {
    navigate,
    flipCard,
    rateCard,
    resetAddForm,
    showWordDetail,
    editWord,
    deleteWord,
    closeModal,
    exportData,
    importData,
    loadStarterPack,
    updatePreview
  };
})();
