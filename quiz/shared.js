/* Read-only public quiz landing. No account, votes, finish calls or app points. */
(async () => {
  'use strict';
  const root = document.getElementById('quiz-player');
  const note = document.getElementById('shared-note');
  const title = document.getElementById('shared-title');
  if (!root || !note || !title) return;
  const params = new URLSearchParams(location.search);
  const rawId = params.get('id') || '';
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) {
    note.textContent = 'クイズのリンクを確認してください。';
    return;
  }
  note.textContent = 'クイズを読み込んでいます…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://djgafiowdldqtearqtdd.supabase.co/functions/v1/region-quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', id }), signal: controller.signal,
      credentials: 'omit', cache: 'no-store'
    });
    if (response.status === 404) {
      note.textContent = 'このクイズは現在公開されていないか、削除されています。';
      return;
    }
    if (!response.ok) throw new Error('unavailable');
    const result = await response.json();
    const quiz = result && result.quiz;
    const payload = quiz && quiz.payload;
    if (!result.ok || !quiz || Number(quiz.id) !== id || !payload
        || typeof quiz.title !== 'string' || Array.from(quiz.title).length > 100
        || !Array.isArray(payload.questions) || payload.questions.length < 1 || payload.questions.length > 20) {
      throw new Error('invalid quiz');
    }
    let questions = payload.questions;
    let name = quiz.title;
    const part = params.get('part');
    if (quiz.official === true && questions.length === 20 && ['1', '2'].includes(part)) {
      questions = questions.slice((Number(part) - 1) * 10, Number(part) * 10);
      name += part === '1' ? '①' : '②';
    }
    const rawQuestions = params.get('questions');
    if (rawQuestions !== null) {
      if (!quiz.official || !/^[1-9]\d?(,[1-9]\d?){0,19}$/.test(rawQuestions)) throw new Error('invalid selection');
      const indices = rawQuestions.split(',').map(Number);
      if (new Set(indices).size !== indices.length || indices.some(i => i > payload.questions.length)) throw new Error('invalid selection');
      questions = indices.map(i => payload.questions[i - 1]);
      const day = params.get('date') || '';
      name = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day} 今日のご当地クイズ` : `${quiz.title} 選択問題`;
    }
    const originalCount = questions.length;
    const choices = questions.filter(q => q && q.type === 'choice').map(q => {
      if (typeof q.choice_text !== 'string' || !q.choice_text.trim() || q.choice_text.length > 240
          || !Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6
          || !q.choices.every(c => typeof c === 'string' && c.trim() && c.length <= 120)
          || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.choices.length) {
        throw new Error('invalid question');
      }
      return { question: q.choice_text, choices: q.choices, correct: q.correct_index };
    });
    title.textContent = name;
    document.title = `${name} | 日本地図 都市パズル`;
    if (!choices.length) {
      note.textContent = 'このクイズは地図から答える問題です。アプリの「ご当地クイズ」でタイトルを探して遊べます。';
      return;
    }
    note.textContent = `共有されたクイズの${originalCount}問中、選択式の${choices.length}問で遊べます。地図の問題はアプリでどうぞ。Web版の結果はアプリの記録・ランキング・対抗戦に反映されません。`;
    const description = typeof payload.description === 'string' && Array.from(payload.description).length <= 200 ? payload.description : '';
    const difficulty = Number.isInteger(quiz.difficulty) && quiz.difficulty >= 1 && quiz.difficulty <= 5 ? quiz.difficulty : 1;
    const data = { prefCode: String(quiz.pref_code || ''), prefName: String(payload.area_name || ''),
      shared: true, sets: [{ difficulty, label: '共有クイズ', title: name, description, questions: choices }] };
    const source = document.createElement('script');
    source.id = 'quiz-data';
    source.type = 'application/json';
    source.textContent = JSON.stringify(data);
    document.body.append(source);
    const player = document.createElement('script');
    player.src = '/quiz/quiz.js?v=20261025-shared';
    player.onerror = () => { note.textContent = 'クイズを読み込めませんでした。時間をおいて、もう一度お試しください。'; };
    document.body.append(player);
  } catch (_error) {
    note.textContent = 'クイズを読み込めませんでした。通信を確認して、もう一度お試しください。';
  } finally {
    clearTimeout(timeout);
  }
})();
