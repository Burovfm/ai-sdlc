/* AI-native SDLC · «Проверка»: полная карта документации, полные конспекты, пробелы. */
(function () {
  var C = [];
  var L = function () { return Array.prototype.slice.call(arguments).join('\n'); };

  C.push({
    id: 'library',
    part: 'Проверка',
    title: 'Карта документации и полные конспекты',
    lede: 'Все 38 страниц ветки AI Native SDLC и учебный проект Exolve: что где лежит и в каком разделе навигатора это разобрано. Плюс полные конспекты в markdown, честный список пробелов и противоречий документации.',
    minutes: 10,
    tags: ['источники', 'полнота'],
    blocks: [
      { t: 'note', kind: 'info', title: 'Зачем этот раздел', x: 'Так видно, что ничего не потеряно: каждая страница дерева имеет место в навигаторе. Если тема нужна в исходной формулировке — открывай полный конспект или первоисточник по ссылке.' },

      { t: 'h2', x: 'Полные конспекты (markdown)' },
      { t: 'p', x: 'Рядом с сайтом лежат исходные конспекты по веткам — с таблицами, командами и ссылками на pageId. Открываются в браузере как текст (или скачиваются).' },
      { t: 'table', head: ['Файл', 'Что внутри', 'Объём'], rows: [
        ['[methodology.md](content/methodology.md)', 'Методика: части 0–7, приложения A–G, принципы, стадии, метрики', '~1000 строк'],
        ['[openspec.md](content/openspec.md)', 'SDD, установка, change-цикл, команды, stores', '~500 строк'],
        ['[foundations.md](content/foundations.md)', 'Foundations + манифест: правила, сервисы, настройки', '~280 строк'],
        ['[harness.md](content/harness.md)', 'Агентный харнесс: 13 страниц серии, контекст, MCP, skills, евалы, память', '~700 строк'],
        ['[roles.md](content/roles.md)', 'Плейбуки продукта, QE, инженера + установка OpenCode/OpenSpec', '~400 строк'],
        ['[training/AGENTS.md](training/AGENTS.md)', 'Правила учебного проекта (8 правил для агента)', '14 строк'],
        ['[training/lk-context/README.md](training/lk-context/README.md)', 'Оглавление учебного LK-контекста: 27 разделов, 72 страницы', '85 строк']
      ] },
      { t: 'note', kind: 'warn', title: 'Первоисточник главнее', x: 'Сайт и конспекты — переработка. Первоисточник — Confluence: [AI Native SDLC](https://wiki.office.msk.mtt/display/SSD/AI+Native+SDLC). При расхождении правы wiki.' },

      { t: 'h2', x: 'Учебный проект: полная копия внутри сайта' },
      { t: 'p', x: 'Папка `ai-sdlc-training` внедрена целиком: рядом с сайтом лежит её полная копия — `training/AGENTS.md`, `training/lk-context/README.md` и **все 72 страницы** в `training/lk-context/pages/`. Её можно открыть как проект в OpenCode или читать страницы из каталога.' },
      { t: 'table', head: ['Что', 'Где в сайте', 'Раздел навигатора'], rows: [
        ['Правила проекта', '[training/AGENTS.md](training/AGENTS.md)', '«Учебный проект AI-native SDLC»'],
        ['Оглавление LK', '[training/lk-context/README.md](training/lk-context/README.md)', '«Каталог LK-контекста»'],
        ['72 страницы описания ЛК', '[training/lk-context/pages/](training/lk-context/pages/)', 'каталог + домен ЛК'],
        ['Четыре упражнения', '—', '«Практика на LK-контексте»']
      ] },

      { t: 'h2', x: 'Что почитать: внешние источники из документации' },
      { t: 'p', x: 'Документация ссылается на первоисточники идей — полезно, если хочется глубже. Foundations помечает русскоязычные материалы как «ru».' },
      { t: 'acc', items: [
        { q: 'Агенты, workflow и харнесс', blocks: [
          { t: 'ul', cls: 'clean', items: [
            '[Building Effective Agents (Anthropic)](https://www.anthropic.com/engineering/building-effective-agents) — различие workflow и агента, правило выбора.',
            '[ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629) — первоисточник цикла «рассуждение + действие».',
            '[SWE-agent](https://arxiv.org/abs/2405.15793) — зависимость результата от интерфейса «агент — компьютер».',
            '[Harness Engineering (OpenAI)](https://openai.com/index/harness-engineering/) — качество агента определяется средой.',
            '[Компоненты кодинг-агента (Raschka, ru)](https://habr.com/ru/articles/1021168/) — шесть компонентов харнесса.',
            '[AI agentic workflow: harness, tools, skills, MCP и память](https://dev.to/naimulkarim/ai-agentic-workflow-explained-a-quick-tour-of-harness-tools-skills-mcp-and-memory-n8g) — обзор понятий на одной схеме.'
          ] }
        ] },
        { q: 'Промпты, план и спека', blocks: [
          { t: 'ul', cls: 'clean', items: [
            '[Руководство по промптингу (Яндекс Облако, ru)](https://yandex.cloud/ru/blog/gpt-prompting-guide) · [Prompt Engineering Guide (ru)](https://www.promptingguide.ai/ru) · [Prompt engineering (OpenAI)](https://developers.openai.com/api/docs/guides/prompt-engineering)',
            '[Plan mode в Claude](https://medium.com/@nuno.roberto/claude-plan-mode-thinking-deeply-before-touching-code-e0b1b2e48c90) — подумать, прежде чем трогать код.',
            '[OpenSpec: разработка от спецификации (ru)](https://vibecoderz.ru/notes/openspec-spec-driven-development-guide)'
          ] }
        ] },
        { q: 'Контекст, MCP, skills', blocks: [
          { t: 'ul', cls: 'clean', items: [
            '[Системные промпты и CLAUDE.md как основа context engineering](https://www.garagelabstech.com/blog/system-prompts-claude-md-foundation-of-context-engineering) · [Память агента в markdown-файлах](https://dev.to/imaginex/ai-agent-memory-management-when-markdown-files-are-all-you-need-5ekk)',
            '[Анонс Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) · [MCP: обзор и практика (ru)](https://habr.com/ru/articles/890740/) · [Как писать инструменты для агентов](https://www.anthropic.com/engineering/writing-tools-for-agents)',
            '[Руководство по Claude Skills (ru)](https://fkonovalov.github.io/claude-skills-guide-ru/) · [The Complete Guide to Building Skills](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) · [MCP и skills: как они дополняют друг друга](https://aiskill.market/blog/mcp-skills-complementary-layers-ai-stack)',
            '[Agent Skills — стандарт формата](https://agentskills.io/home) · [Каталог skills.sh](https://www.skills.sh) · [Vercel: agents.md outperforms skills](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)',
            '[Команды агентов в Claude Code (ru)](https://code.claude.com/docs/ru/agent-teams) · [Как Anthropic строили мультиагентную систему](https://www.anthropic.com/engineering/multi-agent-research-system)'
          ] }
        ] },
        { q: 'Внутренние репозитории', blocks: [
          { t: 'ul', cls: 'clean', items: [
            '[qa-agents](https://git.rnd.mtt/oliwio/tests/qa-agents) — агент QA+SDET и скиллы.',
            '[mcp_servers](https://git.rnd.mtt/oliwio/tests/mcp_servers) — внутренние MCP-серверы QA Core.',
            '[mattpocock/skills](https://github.com/mattpocock/skills) — handoff, writing-great-skills.',
            '[Публичная документация Media API](https://docs.exolve.ru/docs/ru/api-reference/media-api/) — для учебного сервиса QE.'
          ] }
        ] }
      ] },

      { t: 'h2', x: 'Карта страниц: где что разобрано' },
      { t: 'table', cls: 'tight', head: ['Страница', 'pageId', 'Раздел навигатора'], rows: [
        ['AI Native SDLC (корень)', '296463296', 'навигационная, содержания нет'],
        ['Целевая методика AI-native SDLC', '296463931', 'why · context · sdd · pipeline · governance'],
        ['Часть 0. Executive summary', '296463937', 'why'],
        ['Часть 1. Главные принципы', '296463934', 'why'],
        ['Часть 2. Целевая операционная модель', '296463938', 'context · pipeline · basics'],
        ['Часть 3. SDD как ядро методики', '296463939', 'sdd · sdd-deep · interop'],
        ['Часть 4. Стадии (plays)', '296463940', 'pipeline'],
        ['Часть 5. Governance, безопасность, ответственность', '296463941', 'governance'],
        ['Часть 6. Измерение', '296463942', 'governance'],
        ['Часть 7. Управление изменениями и переход людей', '296463943', 'change'],
        ['Приложения A–G', '296463944', 'appendix · context · glossary'],
        ['Манифест: работа с AI на личных учётках', '296463506', 'rules'],
        ['Foundations: первый шаг с LLM и агентами', '296463511', 'basics · tools · skills-deep'],
        ['Playbooks по ролям (корень)', '296463533', 'пустая страница-контейнер'],
        ['Продукт: PO, PM, бизнес-аналитик', '296463512', 'role-product · roles'],
        ['Системный аналитик', '296463513', 'analyst · analyst-work · analyst-skills'],
        ['Quality Engineer (QA, AQA, SDET)', '296463514', 'role-qe'],
        ['Инженер (разработка)', '296463515', 'role-engineer'],
        ['Установка OpenCode и OpenSpec', '296463516', 'practice'],
        ['OpenSpec (корень раздела)', '296462655', 'sdd · sdd-deep'],
        ['SDD: что это и зачем', '296462663', 'sdd'],
        ['Установка и инициализация OpenSpec', '296462664', 'sdd'],
        ['Change: артефакты и цикл', '296462869', 'sdd'],
        ['Команды /opsx-*', '296462659', 'sdd · sdd-deep'],
        ['Stores (beta)', '296462666', 'sdd-deep'],
        ['Агентный харнесс (корень серии)', '296454170', 'basics · tools'],
        ['AI-агент: из чего состоит', '296454195', 'basics'],
        ['Харнесс: обвязка вокруг модели', '296454201', 'basics'],
        ['Контекст: что видит модель', '296456309', 'basics · context'],
        ['MCP: подключение к внешним системам', '296454228', 'tools'],
        ['CLI-инструменты и сравнение с MCP', '296454229', 'tools'],
        ['Skills: инструкции для агента', '296454207', 'tools · skills-deep'],
        ['Skills: как писать и улучшать', '296454213', 'skills-deep'],
        ['Skills: где брать и как подключать', '296454237', 'skills-deep'],
        ['Евалы: как проверять работу агента', '296456310', 'tools'],
        ['Декомпозиция: как резать большую задачу', '296456326', 'tools'],
        ['Память: как переносить работу между сессиями', '296456327', 'tools'],
        ['Спека: источник истины для задачи', '296456325', 'sdd · appendix']
      ] },
      { t: 'p', x: 'Плюс вложения: `ai-sdlc-training.zip` (учебный проект: `lk-context/` и `AGENTS.md`) — используется в разделе «Практика».' },

      { t: 'h2', x: 'Пробелы и противоречия документации' },
      { t: 'p', x: 'Это не пробелы конспекта — это состояние самих страниц. Полезно знать, чтобы не выдавать черновик за стандарт.' },
      { t: 'acc', items: [
        { q: 'Пробелы (чего в документе нет)', blocks: [
          { t: 'ul', items: [
            '**Часть 0** — только «что предлагается» и охват: нет целей, ожидаемых эффектов, сроков и волн адопшна.',
            '**Часть 5** — самая тонкая: нет уровней автономии как шкалы, нет отдельного описания approvals/секретов/периметра, нет владельцев governance-артефактов и сроков.',
            '**Часть 7** — нет волн внедрения, плана обучения, чемпионов, рисков и коммуникации; только enablement и «фаза погружения — квартал параллельно Фазе 0».',
            '**Фаза 0** упоминается ~15 раз, но её состав и сроки нигде не определены.',
            'Много TBD: синхронизация git → Jira, механизм раскатки шаблонов и принудительный аппрув код-оунера, режимы автономии dev/staging, формулы метрик, содержание DoD-уровней.',
            'В плейбуках роль «отметка о прохождении чекпоинта» — плейсхолдер «добавить форму».'
          ] }
        ] },
        { q: 'Противоречия (о чём стоит спросить владельца)', blocks: [
          { t: 'ul', items: [
            '**explore/propose в репозитории сервиса:** §3.2 говорит «заново не выполняются», §4.0 и §4.2 описывают полный цикл explore → propose → apply.',
            '**Сколько гейтов на стадии Plan:** §3.5/§4.0 — Гейт 1 как приёмка бизнес-требований, §4.1 — продукт утверждает `intent.md` на Гейте 1.',
            '**«proto — истина» vs «спека первична»:** принцип 6 и §3.4 против антипаттерна в §4.2; частично снимается оговоркой в приложении G.4 (proto — контракт, спека — поведение).',
            '**Гейт 2 утверждает `tasks` до Build, а на Build `tasks` меняется** без гейта — только «чекпоинт плана, не гейт».',
            '**Триггер Гейта 1 «изменение proto»** (§3.6) против §3.11, где обратно совместимое изменение внутреннего proto → только Гейт 2.',
            'Термин «путь **transform**» введён в §2.6 без определения.'
          ] }
        ] },
        { q: 'Пустые страницы-контейнеры', blocks: [
          { t: 'p', x: 'Корень «AI Native SDLC» и «Playbooks по ролям» содержат только заголовки — это навигационные узлы. Их содержание раскрыто дочерними страницами.' }
        ] }
      ] },
      { t: 'note', kind: 'tip', title: 'Как читать первоисточник', x: 'Начинай с [корневой страницы](https://wiki.office.msk.mtt/display/SSD/AI+Native+SDLC) → «Целевая методика» (части 0–7) → плейбук своей роли → Foundations/манифест. Помни, что это **целевая модель**: адопшн поэтапный, а пометка «калибруется в Фазе 0» означает «решение ещё не принято».' }
    ],
    quiz: [
      {
        q: 'Сколько страниц в ветке AI Native SDLC (без вложений)?',
        options: ['17', '26', '38', '50'],
        answer: 2,
        explain: '38 страниц: 1 корневая + 10 страниц методики (родитель, части 0–7, приложения) + 2 (манифест, Foundations) + 6 плейбуков + 6 OpenSpec + 13 харнесса.'
      },
      {
        q: 'Что делать, если документация противоречит себе?',
        options: [
          'Выбрать удобный вариант',
          'Зафиксировать противоречие и уточнить у владельца документа; в спорных местах смотреть первоисточник',
          'Игнорировать',
          'Дописать свою версию'
        ],
        answer: 1,
        explain: 'В документе есть известные противоречия (explore/propose, число гейтов, proto vs спека). Их честно перечисляют и уточняют, а не сглаживают.'
      }
    ],
    checklist: {
      title: 'Чек-лист: полнота',
      sub: 'Проверь, что карта документации тебе понятна.',
      items: [
        'Знаю, где лежат полные конспекты и первоисточник',
        'Могу найти нужную страницу по карте',
        'Знаю известные пробелы и противоречия документации',
        'Понимаю, что «калибруется в Фазе 0» = решение ещё не принято'
      ]
    },
    checkpoint: {
      title: 'Чекпоинт: документация пройдена целиком',
      text: 'Все страницы ветки имеют место в навигаторе, а пробелы и противоречия зафиксированы.'
    }
  });

  window.CHAPTERS = (window.CHAPTERS || []).concat(C);
})();
