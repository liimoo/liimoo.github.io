/* Generated pages share this player. Source: tools/web_quiz/quiz.js in JapanMap. */
(() => {
  'use strict';
  const root = document.getElementById('quiz-player');
  const source = document.getElementById('quiz-data');
  if (!root || !source) return;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(text, onClick, className = 'button') {
    const element = node('button', text, className);
    element.type = 'button';
    element.addEventListener('click', onClick);
    return element;
  }

  function validData(data) {
    return data && typeof data.prefCode === 'string' && typeof data.prefName === 'string'
      && Array.isArray(data.sets) && data.sets.length > 0 && data.sets.every(set =>
        Number.isInteger(set.difficulty) && set.difficulty >= 1 && set.difficulty <= 5
        && typeof set.label === 'string' && typeof set.title === 'string'
        && Array.isArray(set.questions) && set.questions.length > 0
        && set.questions.every(q => typeof q.question === 'string' && q.question.length > 0
          && Array.isArray(q.choices) && q.choices.length >= 2
          && q.choices.every(choice => typeof choice === 'string' && choice.length > 0)
          && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.choices.length));
  }

  let data;
  try {
    data = JSON.parse(source.textContent);
    if (!validData(data)) throw new Error('Invalid quiz data');
  } catch (error) {
    root.hidden = false;
    root.className = 'card quiz-player';
    root.append(node('p', 'クイズを読み込めませんでした。下の問題と答えをご利用ください。'));
    console.error('Quiz data could not be loaded.', error);
    return;
  }

  let selected = 0;
  let state = { phase: 'select', index: 0, answers: [] };
  root.hidden = false;
  root.className = 'card quiz-player';
  root.setAttribute('aria-label', `${data.prefName}のクイズ`);

  function heading(text) {
    const title = node('h2', text, 'quiz-title');
    title.tabIndex = -1;
    return title;
  }

  function show(children, focusTarget) {
    root.replaceChildren(...children);
    if (focusTarget) {
      root.scrollIntoView({ block: 'start', behavior: 'instant' });
      focusTarget.focus({ preventScroll: true });
    }
  }

  function track(name, score) {
    if (typeof window.gtag !== 'function') return;
    const set = data.sets[selected];
    const properties = { pref_code: data.prefCode, difficulty: set.difficulty,
      total_questions: set.questions.length };
    if (score !== undefined) properties.score = score;
    try { window.gtag('event', name, properties); }
    catch (error) { console.warn('Quiz analytics unavailable.', error); }
  }

  function chooseDifficulty(moveFocus = false) {
    state = { phase: 'select', index: 0, answers: [] };
    const title = heading('難易度を選んで挑戦');
    const options = node('div', undefined, 'quiz-levels');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', '難易度');
    data.sets.forEach((set, index) => {
      const choice = button('', () => {
        selected = index;
        chooseDifficulty();
        root.querySelectorAll('.quiz-level')[index].focus({ preventScroll: true });
      }, 'quiz-level');
      choice.setAttribute('aria-pressed', String(index === selected));
      choice.append(node('span', set.label), node('small', `${set.questions.length}問`));
      options.append(choice);
    });
    const set = data.sets[selected];
    show([node('p', 'あなたのご当地力を試そう', 'eyebrow'), title,
      node('p', '選択肢を選ぶだけ。時間制限はありません。', 'muted'), options,
      node('p', `${set.title}・全${set.questions.length}問`, 'quiz-set-summary'),
      button('クイズを始める', start)], moveFocus ? title : null);
  }

  function start() {
    state = { phase: 'question', index: 0, answers: [] };
    track('quiz_start');
    showQuestion();
  }

  function shuffledChoices(question) {
    // Sort random keys on a fresh array; canonical question/answer data stays unchanged.
    return question.choices.map((text, index) => ({ text, index, key: Math.random() }))
      .sort((a, b) => a.key - b.key);
  }

  function showQuestion() {
    const set = data.sets[selected];
    const question = set.questions[state.index];
    const title = heading(question.question);
    const progress = node('progress');
    progress.max = set.questions.length;
    progress.value = state.index;
    progress.setAttribute('aria-label', '回答済みの問題数');
    const choices = node('div', undefined, 'quiz-choices');
    const feedback = node('p', '', 'quiz-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    const next = button(state.index + 1 === set.questions.length ? '結果を見る' : '次の問題', () => {
      if (state.phase !== 'answered') return;
      if (state.index + 1 === set.questions.length) finish();
      else {
        state = { ...state, phase: 'question', index: state.index + 1 };
        showQuestion();
      }
    });
    next.disabled = true;
    shuffledChoices(question).forEach(choice => {
      const answer = button(choice.text, () => {
        if (state.phase !== 'question') return;
        state = { ...state, phase: 'answered', answers: [...state.answers, choice.index] };
        choices.querySelectorAll('button').forEach(item => {
          item.disabled = true;
          if (Number(item.dataset.choice) === question.correct) item.classList.add('is-correct');
        });
        const correct = choice.index === question.correct;
        if (!correct) answer.classList.add('is-wrong');
        feedback.textContent = correct ? '正解！' : `おしい！ 正解は「${question.choices[question.correct]}」です。`;
        feedback.classList.add(correct ? 'is-correct' : 'is-wrong');
        progress.value = state.index + 1;
        next.disabled = false;
        // The selected button becomes disabled; move focus to the available next action.
        next.focus({ preventScroll: true });
      }, 'quiz-choice');
      answer.dataset.choice = String(choice.index);
      choices.append(answer);
    });
    const actions = node('div', undefined, 'quiz-actions');
    actions.append(next, button('難易度を選び直す', () => chooseDifficulty(true), 'button secondary'));
    show([node('p', `${set.label} · ${state.index + 1} / ${set.questions.length}問`, 'eyebrow'),
      progress, title, choices, feedback, actions], title);
  }

  function finish() {
    if (state.phase !== 'answered') return;
    state = { ...state, phase: 'complete' };
    const set = data.sets[selected];
    const mistakes = set.questions.filter((q, index) => state.answers[index] !== q.correct);
    const score = set.questions.length - mistakes.length;
    const perfect = mistakes.length === 0;
    track('quiz_complete', score);
    const title = heading(perfect ? '全問正解！' : 'クイズクリア！');
    const medal = node('div', '★', 'quiz-medal');
    medal.setAttribute('aria-hidden', 'true');
    const result = node('div', undefined, 'quiz-result');
    const total = node('p', `${score} / ${set.questions.length}`, 'quiz-score');
    total.setAttribute('aria-label', `${set.questions.length}問中${score}問正解`);
    const actions = node('div', undefined, 'quiz-actions');
    actions.append(button('もう一度挑戦', start),
      button('難易度を選び直す', () => chooseDifficulty(true), 'button secondary'));
    result.append(medal, title, total, node('p', '問正解', 'muted'),
      node('p', perfect ? 'すばらしい！ 次の難易度にも挑戦してみよう。' : '答えを覚えて、もう一度チャレンジ！'), actions);
    const promo = document.getElementById('quiz-result-promo');
    if (promo instanceof HTMLTemplateElement) result.append(promo.content.cloneNode(true));
    if (mistakes.length) {
      const review = node('div', undefined, 'quiz-review');
      review.append(node('h3', 'まちがえた問題を復習'));
      const list = node('ol');
      mistakes.forEach(q => {
        const item = node('li');
        item.append(node('p', q.question), node('strong', `正解：${q.choices[q.correct]}`));
        list.append(item);
      });
      review.append(list);
      result.append(review);
    }
    show([result], title);
  }

  chooseDifficulty();
})();
