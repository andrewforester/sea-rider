// Interface language. The Russian text in the code is the key; other languages map it to their own text,
// gettext style, so a missing translation falls back to Russian. A plain script that runs before both
// renderers: window.tr(text, vars) translates, window.setLang(code) switches and re-labels the page.
// The choice comes from ?lang=, then the saved choice, then the browser language: Russian for a
// Russian browser, Ukrainian for everyone else.
(() => {
  const LANGS = ['uk', 'ru']; // the switch shows them in this order
  const NAMES = { ru: 'Рус', uk: 'Укр' };
  const UK = {
    // page
    'Эгейский берег — гидроцикл и сокровища': 'Егейський берег — гідроцикл і скарби',
    'Эгейский берег': 'Егейський берег',
    'гидроцикл и сокровища ⭐': 'гідроцикл і скарби ⭐',
    'Загрузка…': 'Завантаження…',
    'запуск…': 'запуск…',
    'клик — захват мыши · H — настройки моря · L — язык': 'клік — захоплення миші · H — налаштування моря · L — мова',
    'Остров готов — нажми любую клавишу или коснись экрана': 'Острів готовий — натисни будь-яку клавішу або торкнися екрана',
    'Остров готов — коснись экрана, чтобы играть': 'Острів готовий — торкнися екрана, щоб грати',
    'Гидроцикл · ': 'Гідроцикл · ',
    // loading
    'Готовим море…': 'Готуємо море…',
    'Строим остров и скалы…': 'Будуємо острів і скелі…',
    'Солнце и тени…': 'Сонце і тіні…',
    'Спускаем гидроцикл на воду…': 'Спускаємо гідроцикл на воду…',
    'Подводный мир загружается…': 'Підводний світ завантажується…',
    'Подводный мир: шейдеры…': 'Підводний світ: шейдери…',
    'Подводный мир: лепим дно…': 'Підводний світ: ліпимо дно…',
    'Подводный мир: каньоны…': 'Підводний світ: каньйони…',
    'Подводный мир: растут водоросли…': 'Підводний світ: ростуть водорості…',
    'Подводный мир: корабль и скаты…': 'Підводний світ: корабель і скати…',
    'Подводный мир готов': 'Підводний світ готовий',
    'Подводный мир не запустился: ': 'Підводний світ не запустився: ',
    // messages
    'Гидроцикл далеко — плыви к стрелке': 'Гідроцикл далеко — пливи до стрілки',
    'Ты на берегу! Ищи сокровища ✨': 'Ти на березі! Шукай скарби ✨',
    'Посмотри вниз и плыви — нырнёшь. Плыви к берегу — выйдешь на сушу': 'Подивись униз і пливи — пірнеш. Пливи до берега — вийдеш на сушу',
    'Поехали!': 'Поїхали!',
    'Подводный мир ещё загружается…': 'Підводний світ ще завантажується…',
    'Здесь слишком мелко, чтобы нырнуть': 'Тут занадто мілко, щоб пірнути',
    'Вынырнул!': 'Виринув!',
    'Все сокровища найдены! Ура! 🎉': 'Усі скарби знайдено! Ура! 🎉',
    'Сокровище! ⭐': 'Скарб! ⭐',
    'Бум! Осторожно, камни': 'Бум! Обережно, каміння',
    'Бум! Осторожно, лодка': 'Бум! Обережно, човен',
    'Ты вышел на берег! Ищи сокровища ✨': 'Ти вийшов на берег! Шукай скарби ✨',
    'Плывёшь': 'Пливеш',
    'Сундучок с золотом! 💰': 'Скринька із золотом! 💰',
    'Звёздочка! ⭐': 'Зірочка! ⭐',
    // hints, touch
    '<b>{v}</b> км/ч · джойстик — газ и руль': '<b>{v}</b> км/год · джойстик — газ і кермо',
    'Жми <b>Сесть</b>': 'Тисни <b>Сісти</b>',
    'Джойстик — плыть · смотри вниз и плыви — нырнёшь': 'Джойстик — плисти · дивись униз і пливи — пірнеш',
    'Джойстик — идти · справа — осмотреться': 'Джойстик — іти · праворуч — роздивитися',
    'Веди пальцем — смотреть и плыть · два пальца — быстрее · плыви вверх — вынырнешь': 'Веди пальцем — дивитися і плисти · два пальці — швидше · пливи вгору — виринеш',
    // hints, keyboard
    '<b>{v}</b> км/ч &nbsp;·&nbsp; W газ · S тормоз · A/D руль · Shift турбо · мышь — камера · Пробел — спрыгнуть':
      '<b>{v}</b> км/год &nbsp;·&nbsp; W газ · S гальмо · A/D кермо · Shift турбо · миша — камера · Пробіл — зістрибнути',
    '<b>Пробел</b> — сесть на гидроцикл': '<b>Пробіл</b> — сісти на гідроцикл',
    'W — плыть · A/D — поворот · посмотри вниз и плыви — нырнёшь · к берегу — выйдешь на сушу': 'W — плисти · A/D — поворот · подивись униз і пливи — пірнеш · до берега — вийдеш на сушу',
    'W — идти · A/D — поворот · Shift — бежать · Пробел — прыжок · заходи в воду — поплывёшь': 'W — іти · A/D — поворот · Shift — бігти · Пробіл — стрибок · заходь у воду — попливеш',
    'WASD — плыть · мышь — куда плыть · Shift быстрее · плыви вверх к свету — вынырнешь': 'WASD — плисти · миша — куди плисти · Shift швидше · пливи вгору до світла — виринеш',
    // touch buttons
    'Спрыгнуть': 'Зістрибнути', 'Турбо': 'Турбо', 'Сесть': 'Сісти', 'Прыжок': 'Стрибок', 'Нырнуть': 'Пірнути',
    'Бег': 'Біг', 'Быстрее': 'Швидше',
  };
  const DICT = { ru: null, uk: UK };

  const pick = () => {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem('lang'); if (LANGS.includes(s)) return s; } catch (_) { /* storage blocked */ }
    return /^ru\b/i.test(navigator.language || '') ? 'ru' : 'uk';
  };
  let lang = pick();

  window.tr = (text, vars) => {
    let s = (DICT[lang] && DICT[lang][text]) || text;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  };
  window.getLang = () => lang;

  // elements with data-i18n get their text from the key (their Russian text, kept on first use);
  // data-i18n-attr="name" puts it into that attribute instead (the jet ski tag's CSS prefix)
  const relabel = () => {
    document.documentElement.lang = lang;
    document.title = window.tr('Эгейский берег — гидроцикл и сокровища');
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const key = el.dataset.i18n || (el.dataset.i18n = el.textContent);
      const attr = el.dataset.i18nAttr;
      if (attr) el.setAttribute(attr, window.tr(key)); else el.textContent = window.tr(key);
    }
    const sw = document.getElementById('lang');
    if (sw) for (const b of sw.children) b.classList.toggle('on', b.dataset.lang === lang);
    for (const f of hooks) f(lang);
  };
  const hooks = [];
  window.onLang = (f) => hooks.push(f);
  window.setLang = (l) => {
    if (!LANGS.includes(l)) return;
    lang = l;
    try { localStorage.setItem('lang', l); } catch (_) { /* storage blocked */ }
    relabel();
  };
  window.nextLang = () => window.setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);

  // the switch: one button per language, top right under the treasure count
  const init = () => {
    const sw = document.getElementById('lang');
    if (sw) {
      for (const l of LANGS) {
        const b = document.createElement('button');
        b.dataset.lang = l; b.textContent = NAMES[l]; b.tabIndex = -1;
        // no focus (Space would press it) and no click through to the game (pointer lock, start)
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
        b.addEventListener('click', (e) => { e.stopPropagation(); window.setLang(l); });
        sw.appendChild(b);
      }
    }
    relabel();
  };
  init(); // the script sits after the page's elements, so they exist
})();
