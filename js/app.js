// ─── Image helper ────────────────────────────────────────────────────────────
// Converts a local file path with Hebrew/spaces into a safe URL src
function imgSrc(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

// Returns inline style string for the card/header image area
function cardBgStyle(recipe) {
  if (recipe.image) {
    return `background-image:url('${imgSrc(recipe.image)}');background-size:cover;background-position:center;`;
  }
  return `background:${recipe.gradient};`;
}

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  view: 'dailyMenu',                                               // 'dailyMenu' | 'main' | 'diary'
  menuSelection: { type: 'mealTime', value: getMealTypeByTime() }, // current filter
  plan: null,                                                      // null | 1 | 2 | 3
  sideMenuOpen: false,
  diaryDate: todayKey(),
};

let lunchSelections = new Set(); // IDs selected in the lunch multi-select view

// ─── Menu config ──────────────────────────────────────────────────────────────

const MENU_TIME_ITEMS = [
  { type: 'mealTime', value: MEAL_TYPES.BREAKFAST, label: 'ארוחות בוקר',   emoji: '🌅' },
  { type: 'mealTime', value: MEAL_TYPES.LUNCH,     label: 'ארוחות צהריים', emoji: '☀️' },
  { type: 'mealTime', value: MEAL_TYPES.DINNER,    label: 'ארוחות ערב',    emoji: '🌙' },
];

const MENU_SOURCE_ITEMS = [
  { type: 'source', value: 'shake',    label: 'שייקים',       emoji: '🥤' },
  { type: 'source', value: 'salad',    label: 'סלטים',        emoji: '🥗' },
  { type: 'source', value: 'sandwich', label: 'כריכים',       emoji: '🥪' },
  { type: 'source', value: 'stew',     label: 'תבשילים',      emoji: '🍲' },
  { type: 'source', value: 'light',    label: 'ארוחות קלות',  emoji: '🥞' },
];

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  document.getElementById('app').innerHTML =
    state.view === 'diary' ? renderDiaryView() : renderMainView();
  bindEvents();
}

// ─── Daily Menu View ──────────────────────────────────────────────────────────

function renderDailyCard(r) {
  return `
    <article class="daily-card"
             data-action="open-recipe" data-recipe-id="${r.id}"
             role="button" tabindex="0">
      <div class="daily-card__image" style="${cardBgStyle(r)}">
        ${r.image ? '' : `<span class="daily-card__emoji">${r.emoji}</span>`}
      </div>
      <div class="daily-card__info">
        <h3 class="daily-card__name">${r.name}</h3>
        <div class="daily-card__tags">
          ${r.plans.map(p =>
            `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
          ).join('')}
        </div>
      </div>
      <span class="daily-card__arrow">›</span>
    </article>`;
}

function renderDailyLunchSlot(lunch) {
  const find = id => id ? recipes.find(r => r.id === id) : null;

  if (lunch.type === 'main') {
    const main     = find(lunch.mainId);
    const addition = find(lunch.additionId);
    if (!main) return '';

    const additionBlock = addition ? `
      <span class="daily-slot__sublabel">תוספת</span>
      ${renderDailyCard(addition)}
      <button class="daily-action-btn daily-action-btn--replace"
              data-action="replace-daily-lunch-part" data-part="addition">
        ↕ החלף תוספת
      </button>` : `
      <button class="daily-want-addition-btn" data-action="daily-want-addition">
        🍽️ רוצה תוספת?
      </button>`;

    return `
      <div class="daily-slot">
        <span class="daily-slot__label">☀️ צהריים</span>
        ${renderDailyCard(main)}
        ${additionBlock}
        <div class="daily-slot__actions">
          <button class="daily-action-btn daily-action-btn--check"
                  data-action="add-daily-lunch">
            + הוסף ליומן אכילה
          </button>
          <button class="daily-action-btn daily-action-btn--replace"
                  data-action="replace-daily-lunch-part" data-part="main">
            ↕ החלף ארוחה
          </button>
        </div>
      </div>`;
  }

  // type === 'base-addition'
  const base     = find(lunch.baseId);
  const addition = find(lunch.additionId);

  return `
    <div class="daily-slot">
      <span class="daily-slot__label">☀️ צהריים</span>
      ${base ? `
        <span class="daily-slot__sublabel">בסיס</span>
        ${renderDailyCard(base)}
        <button class="daily-action-btn daily-action-btn--replace"
                data-action="replace-daily-lunch-part" data-part="base">
          ↕ החלף
        </button>` : ''}
      ${addition ? `
        <span class="daily-slot__sublabel">תוספת</span>
        ${renderDailyCard(addition)}
        <button class="daily-action-btn daily-action-btn--replace"
                data-action="replace-daily-lunch-part" data-part="addition">
          ↕ החלף
        </button>` : ''}
      <div class="daily-slot__actions">
        <button class="daily-action-btn daily-action-btn--check"
                data-action="add-daily-lunch">
          + הוסף ליומן אכילה
        </button>
        <button class="daily-action-btn daily-action-btn--replace"
                data-action="replace-daily-lunch-whole">
          ↕ החלף ארוחה
        </button>
      </div>
    </div>`;
}

function getDayGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'בוקר טוב ☀️';
  if (h >= 12 && h < 17) return 'צהריים טובים 🌿';
  if (h >= 17 && h < 21) return 'ערב טוב 🌙';
  return 'לילה טוב ✨';
}

function renderDailyMenuContent() {
  const menu = getDailyMenu(state.plan);

  const renderSimpleSlot = (key, label, emoji, recipeId) => {
    const r = recipes.find(r => r.id === recipeId);
    if (!r) return '';
    const alreadyAdded = isInDiaryToday(r.id, key);
    return `
      <div class="daily-slot">
        <span class="daily-slot__label">${emoji} ${label}</span>
        ${renderDailyCard(r)}
        <div class="daily-slot__actions">
          <button class="daily-action-btn daily-action-btn--check ${alreadyAdded ? 'daily-action-btn--done' : ''}"
                  data-action="add-daily-meal"
                  data-slot="${key}"
                  data-recipe-id="${r.id}"
                  ${alreadyAdded ? 'disabled' : ''}>
            ${alreadyAdded ? '✓ נוסף ליומן' : '+ הוסף ליומן אכילה'}
          </button>
          <button class="daily-action-btn daily-action-btn--replace"
                  data-action="replace-daily-meal"
                  data-slot="${key}">
            ↕ החלף ארוחה
          </button>
        </div>
      </div>`;
  };

  const slots = [
    renderSimpleSlot('breakfast', 'בוקר', '🌅', menu.breakfast),
    renderDailyLunchSlot(menu.lunch),
    renderSimpleSlot('dinner', 'ערב', '🌙', menu.dinner),
  ].join('');

  return `
    <div class="daily-menu fade-in">
      <div class="daily-menu__header">
        <p class="daily-menu__greeting">${getDayGreeting()}</p>
        <p class="daily-menu__date">${new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 class="daily-menu__title">תפריט היום</h2>
        <p class="daily-menu__subtitle">הארוחות המומלצות שלך להיום</p>
      </div>
      <div class="daily-menu__slots">${slots}</div>
      <button class="daily-menu__refresh" data-action="refresh-daily-menu">🔀 ערבב מחדש</button>
    </div>`;
}

const SLOT_GRADIENTS = {
  breakfast: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  lunch:     'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  dinner:    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

function openReplaceModal(slotKey) {
  const slotMeta   = DIARY_SLOTS.find(s => s.key === slotKey);
  const mealType   = slotKey;
  const categories = getVisibleCategories(mealType, state.plan);
  const individuals = getIndividualRecipes(mealType, state.plan);

  const renderPickerCatCard = cat => {
    const count = getCategoryRecipes(cat.id, mealType, state.plan).length;
    const imgStyle = cat.image
      ? `background-image:url('${imgSrc(cat.image)}');background-size:cover;background-position:center;`
      : `background:${cat.gradient};`;
    return `
      <article class="recipe-card category-card"
               data-action="picker-open-category" data-category="${cat.id}"
               role="button" tabindex="0">
        <div class="recipe-card__image" style="${imgStyle}">
          ${cat.image ? '' : `<span class="recipe-card__emoji">${cat.emoji}</span>`}
        </div>
        <div class="recipe-card__info">
          <h3 class="recipe-card__name">${cat.label}</h3>
          <p class="category-card__count">${count} אפשרויות</p>
        </div>
        <span class="category-card__arrow">›</span>
      </article>`;
  };

  const renderPickerRecipeCard = r => `
    <article class="recipe-card"
             data-action="picker-pick-recipe" data-recipe-id="${r.id}"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${cardBgStyle(r)}">
        ${r.image ? '' : `<span class="recipe-card__emoji">${r.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${r.name}</h3>
        <div class="recipe-card__tags">
          ${r.plans.map(p =>
            `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
          ).join('')}
        </div>
      </div>
    </article>`;

  const cards = [
    ...categories.map(renderPickerCatCard),
    ...individuals.map(renderPickerRecipeCard),
  ].join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--picker">
      <div class="modal__header" style="background:${SLOT_GRADIENTS[slotKey]}">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        <span class="modal__emoji">${slotMeta.emoji}</span>
        <h2 class="modal__title">בחר ארוחת ${slotMeta.label}</h2>
        <p class="modal__subtitle">${state.plan ? PLAN_CONFIG[state.plan].name : 'כל התכניות'}</p>
      </div>
      <div class="modal__body modal__body--grid">
        <div class="recipes-grid">${cards}</div>
      </div>
    </div>`;

  mountModal(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'picker-open-category') {
      openCategoryPickerModal(el.dataset.category, mealType, slotKey, overlay);
      return;
    }
    if (el.dataset.action === 'picker-pick-recipe') {
      const recipeId = el.closest('[data-recipe-id]').dataset.recipeId;
      updateDailyMenuSlot(state.plan, slotKey, recipeId);
      closeModal(overlay, () => render());
    }
  });
}

function openLunchPartPicker(part) {
  const PART_META = {
    main:     { title: 'בחר ארוחה עיקרית', emoji: '🍲', gradient: SLOT_GRADIENTS.lunch, ids: LUNCH_SECTION_IDS.main },
    base:     { title: 'בחר בסיס',          emoji: '🍚', gradient: SLOT_GRADIENTS.lunch, ids: LUNCH_SECTION_IDS.base },
    addition: { title: 'בחר תוספת',         emoji: '🥦', gradient: SLOT_GRADIENTS.lunch, ids: LUNCH_SECTION_IDS.addition },
  };
  const meta = PART_META[part];
  const planOk = r => r && (state.plan === null || r.plans.includes(state.plan));
  const items = meta.ids.map(id => recipes.find(r => r.id === id)).filter(planOk);

  // For main: offer a "switch to base + addition" card at the top
  const hasBaseSwitch = part === 'main';

  // For addition: also offer salad category
  const hasSalad = part === 'addition';
  const saladCat = CATEGORY_CONFIG.salad;

  const renderCard = r => `
    <article class="recipe-card"
             data-action="lunch-part-pick" data-recipe-id="${r.id}"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${cardBgStyle(r)}">
        ${r.image ? '' : `<span class="recipe-card__emoji">${r.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${r.name}</h3>
        <div class="recipe-card__tags">
          ${r.plans.map(p =>
            `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
          ).join('')}
        </div>
      </div>
    </article>`;

  const baseSwitchCard = hasBaseSwitch ? `
    <article class="recipe-card category-card"
             data-action="lunch-switch-to-base"
             role="button" tabindex="0"
             style="border: 2px dashed var(--primary);">
      <div class="recipe-card__image" style="background:linear-gradient(135deg,#d4fc79 0%,#5ea832 100%)">
        <span class="recipe-card__emoji">🍚</span>
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">בסיס + תוספת</h3>
        <p class="category-card__count">אורז, קינואה, גריסים + תוספת</p>
      </div>
      <span class="category-card__arrow">›</span>
    </article>` : '';

  const saladCard = hasSalad ? `
    <article class="recipe-card category-card"
             data-action="lunch-part-pick-salad"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${saladCat.image ? `background-image:url('${imgSrc(saladCat.image)}');background-size:cover;background-position:center;` : `background:${saladCat.gradient};`}">
        ${saladCat.image ? '' : `<span class="recipe-card__emoji">${saladCat.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${saladCat.label}</h3>
        <p class="category-card__count">${getCategoryRecipes('salad', MEAL_TYPES.LUNCH, state.plan).length} אפשרויות</p>
      </div>
      <span class="category-card__arrow">›</span>
    </article>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--picker">
      <div class="modal__header" style="background:${meta.gradient}">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        <span class="modal__emoji">${meta.emoji}</span>
        <h2 class="modal__title">${meta.title}</h2>
        <p class="modal__subtitle">${state.plan ? PLAN_CONFIG[state.plan].name : 'כל התכניות'}</p>
      </div>
      <div class="modal__body modal__body--grid">
        <div class="recipes-grid">${baseSwitchCard}${items.map(renderCard).join('')}${saladCard}</div>
      </div>
    </div>`;

  mountModal(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'lunch-switch-to-base') {
      switchLunchToBaseAddition(state.plan);
      closeModal(overlay, () => render());
    }
    if (el.dataset.action === 'lunch-part-pick') {
      const recipeId = el.closest('[data-recipe-id]').dataset.recipeId;
      updateDailyMenuLunchPart(state.plan, part, recipeId);
      closeModal(overlay, () => render());
    }
    if (el.dataset.action === 'lunch-part-pick-salad') {
      openLunchPartSaladPicker(part, overlay);
    }
  });
}

function openLunchMainPicker() {
  const planOk = r => r && (state.plan === null || r.plans.includes(state.plan));
  const items = LUNCH_SECTION_IDS.main
    .map(id => recipes.find(r => r.id === id))
    .filter(planOk);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--picker">
      <div class="modal__header" style="background:linear-gradient(135deg,#f6d365 0%,#fda085 100%)">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        <span class="modal__emoji">🍲</span>
        <h2 class="modal__title">מרקים ותבשילים</h2>
        <p class="modal__subtitle">${state.plan ? PLAN_CONFIG[state.plan].name : 'כל התכניות'}</p>
      </div>
      <div class="modal__body modal__body--grid">
        <div class="recipes-grid">
          ${items.map(r => `
            <article class="recipe-card"
                     data-action="lunch-main-pick" data-recipe-id="${r.id}"
                     role="button" tabindex="0">
              <div class="recipe-card__image" style="${cardBgStyle(r)}">
                ${r.image ? '' : `<span class="recipe-card__emoji">${r.emoji}</span>`}
              </div>
              <div class="recipe-card__info">
                <h3 class="recipe-card__name">${r.name}</h3>
                <div class="recipe-card__tags">
                  ${r.plans.map(p =>
                    `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
                  ).join('')}
                </div>
              </div>
            </article>`).join('')}
        </div>
      </div>
    </div>`;

  mountModal(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'lunch-main-pick') {
      const recipeId = el.closest('[data-recipe-id]').dataset.recipeId;
      switchLunchToMain(state.plan, recipeId);
      closeModal(overlay, () => render());
    }
  });
}

function openLunchPartSaladPicker(part, parentOverlay) {
  const salads = getCategoryRecipes('salad', MEAL_TYPES.LUNCH, state.plan);
  const cat = CATEGORY_CONFIG.salad;

  const catOverlay = document.createElement('div');
  catOverlay.className = 'modal-overlay';
  catOverlay.innerHTML = `
    <div class="modal modal--list">
      <div class="modal__header" style="background:${cat.gradient}">
        <button class="modal__close" data-action="close-cat-picker" aria-label="חזרה">←</button>
        <span class="modal__emoji">${cat.emoji}</span>
        <h2 class="modal__title">${cat.label}</h2>
        <p class="modal__subtitle">${salads.length} אפשרויות</p>
      </div>
      <div class="modal__body modal__body--list">
        ${salads.map(r => `
          <div class="list-item" data-action="lunch-salad-pick" data-recipe-id="${r.id}">
            <div class="list-item__icon" style="${cardBgStyle(r)}">${r.image ? '' : r.emoji}</div>
            <div class="list-item__text">
              <h4 class="list-item__name">${r.name}</h4>
            </div>
            <span class="list-item__arrow">›</span>
          </div>`).join('')}
      </div>
    </div>`;

  mountModal(catOverlay);
  catOverlay.addEventListener('click', e => {
    if (e.target === catOverlay) { closeModal(catOverlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-cat-picker') { closeModal(catOverlay); return; }
    if (el.dataset.action === 'lunch-salad-pick') {
      const recipeId = el.closest('[data-recipe-id]').dataset.recipeId;
      updateDailyMenuLunchPart(state.plan, part, recipeId);
      closeModal(catOverlay, () => closeModal(parentOverlay, () => render()));
    }
  });
}

function openCategoryPickerModal(categoryId, mealType, slotKey, parentOverlay) {
  const cat   = CATEGORY_CONFIG[categoryId];
  const items = getCategoryRecipes(categoryId, mealType, state.plan);

  const catOverlay = document.createElement('div');
  catOverlay.className = 'modal-overlay';
  catOverlay.innerHTML = `
    <div class="modal modal--list">
      <div class="modal__header" style="background:${cat.gradient}">
        <button class="modal__close" data-action="close-cat-picker" aria-label="חזרה">←</button>
        <span class="modal__emoji">${cat.emoji}</span>
        <h2 class="modal__title">${cat.label}</h2>
        <p class="modal__subtitle">${items.length} אפשרויות</p>
      </div>
      <div class="modal__body modal__body--list">
        ${items.map(r => `
          <div class="list-item" data-action="cat-pick-recipe" data-recipe-id="${r.id}">
            <div class="list-item__icon" style="${cardBgStyle(r)}">${r.image ? '' : r.emoji}</div>
            <div class="list-item__text">
              <h4 class="list-item__name">${r.name}</h4>
              <div class="list-item__tags">
                ${r.plans.map(p =>
                  `<span class="tag tag--sm" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
                ).join('')}
              </div>
            </div>
            <span class="list-item__arrow">›</span>
          </div>`).join('')}
      </div>
    </div>`;

  mountModal(catOverlay);
  catOverlay.addEventListener('click', e => {
    if (e.target === catOverlay) { closeModal(catOverlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-cat-picker') { closeModal(catOverlay); return; }
    if (el.dataset.action === 'cat-pick-recipe') {
      const recipeId = el.closest('[data-recipe-id]').dataset.recipeId;
      updateDailyMenuSlot(state.plan, slotKey, recipeId);
      closeModal(catOverlay, () => closeModal(parentOverlay, () => render()));
    }
  });
}

// ─── Main View ────────────────────────────────────────────────────────────────

function renderMainView() {
  return `
    ${renderSideMenu()}
    ${renderSideOverlay()}

    <header class="main-header">
      <div class="main-header__brand">
        <button class="hamburger-btn" data-action="open-menu" aria-label="תפריט">
          <span></span><span></span><span></span>
        </button>
        <div class="brand-bar">
          <img class="brand-bar__icon" src="icons/icon-512.png" alt="דרך הבריאה">
          <div class="brand-bar__text">
            <span class="brand-bar__name">דרך הבריאה</span>
            <span class="brand-bar__slogan">שגרה · ניקוי · ניקוי עמוק</span>
          </div>
        </div>
        <button class="diary-btn" data-action="open-diary" aria-label="יומן אכילה" title="יומן אכילה">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="9" y1="7" x2="15" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
            <line x1="9" y1="15" x2="13" y2="15"/>
          </svg>
        </button>
      </div>
      <div class="main-header__nav">
        <div class="plan-chips">${renderPlanChips()}</div>
      </div>
    </header>

    <main class="main-content">
      ${state.view === 'dailyMenu' ? renderDailyMenuContent() : renderGrid()}
    </main>
  `;
}

function renderSideOverlay() {
  return `<div class="side-overlay ${state.sideMenuOpen ? 'side-overlay--open' : ''}"
               data-action="close-menu"></div>`;
}

function renderSideMenu() {
  const sel = state.menuSelection;

  const isMain = state.view === 'main';
  const timeItems = MENU_TIME_ITEMS.map(item => `
    <button class="menu-item ${isMain && sel.type === item.type && sel.value === item.value ? 'menu-item--active' : ''}"
            data-action="menu-select" data-type="${item.type}" data-value="${item.value}">
      <span class="menu-item__emoji">${item.emoji}</span>
      <span>${item.label}</span>
    </button>`).join('');

  const sourceItems = MENU_SOURCE_ITEMS.map(item => `
    <button class="menu-item ${isMain && sel.type === item.type && sel.value === item.value ? 'menu-item--active' : ''}"
            data-action="menu-select" data-type="${item.type}" data-value="${item.value}">
      <span class="menu-item__emoji">${item.emoji}</span>
      <span>${item.label}</span>
    </button>`).join('');

  return `
    <nav class="side-menu ${state.sideMenuOpen ? 'side-menu--open' : ''}">
      <div class="side-menu__header">
        <h2>תפריט</h2>
        <button class="side-menu__close" data-action="close-menu" aria-label="סגור">✕</button>
      </div>

      <div class="side-menu__section">
        <button class="menu-item ${state.view === 'dailyMenu' ? 'menu-item--active' : ''}"
                data-action="open-daily-menu">
          <span class="menu-item__emoji">🌿</span>
          <span>תפריט יומי</span>
        </button>
      </div>

      <div class="side-menu__divider"></div>

      <div class="side-menu__section">
        <p class="side-menu__section-title">לפי זמן ביום</p>
        ${timeItems}
      </div>

      <div class="side-menu__divider"></div>

      <div class="side-menu__section">
        <p class="side-menu__section-title">לפי סוג ארוחה</p>
        ${sourceItems}
      </div>

      <div class="side-menu__divider"></div>

      <button class="menu-item menu-item--diary" data-action="open-diary">
        <span class="menu-item__emoji">📓</span>
        <span>יומן אכילה</span>
      </button>
    </nav>`;
}

function renderPlanChips() {
  return [
    { value: null, label: 'הכל' },
    { value: 1,    label: 'Balance' },
    { value: 2,    label: 'Clean' },
    { value: 3,    label: 'Reset' },
  ].map(({ value, label }) => {
    const active = state.plan === value;
    const cfg = value !== null ? PLAN_CONFIG[value] : null;
    const style = (cfg && active)
      ? `style="background:${cfg.color};border-color:${cfg.color};color:#fff"`
      : '';
    return `<button class="plan-chip ${active ? 'plan-chip--active' : ''}" ${style}
                    data-action="set-plan" data-plan="${value === null ? '' : value}">
              ${label}
            </button>`;
  }).join('');
}

function currentSelectionLabel() {
  const { type, value } = state.menuSelection;
  if (type === 'mealTime') {
    return MENU_TIME_ITEMS.find(i => i.value === value)?.label || '';
  }
  return MENU_SOURCE_ITEMS.find(i => i.value === value)?.label || '';
}

// ─── Meal Greeting ────────────────────────────────────────────────────────────

const MEAL_GREETINGS = {
  [MEAL_TYPES.BREAKFAST]: {
    icon: '✨',
    title: 'בוקר טוב',
    lines: ['התחלה נקייה יוצרת יום אחר לגמרי', 'עם מה בא לך להזין את הגוף שלך עכשיו?'],
  },
  [MEAL_TYPES.LUNCH]: {
    icon: '🌿',
    title: 'ארוחת צהריים',
    lines: ['הגוף צריך הזנה אמיתית באמצע היום.', 'מה יתאים לך עכשיו?'],
  },
  [MEAL_TYPES.DINNER]: {
    icon: '✨',
    title: 'ארוחת ערב',
    lines: ['משהו קל, רגוע ומאזן לסיום היום.', 'מה נכון לך עכשיו?'],
  },
};

function renderMealGreeting(mealType) {
  const g = MEAL_GREETINGS[mealType];
  if (!g) return '';
  return `
    <div class="meal-greeting">
      <p class="meal-greeting__icon">${g.icon}</p>
      <h2 class="meal-greeting__title">${g.title}</h2>
      ${g.lines.map(l => `<p class="meal-greeting__line">${l}</p>`).join('')}
    </div>`;
}

// ─── Lunch Multi-Select ───────────────────────────────────────────────────────

function renderLunchMultiSelect() {
  const planOk = r => state.plan === null || r.plans.includes(state.plan);
  const getSection = ids => ids
    .map(id => recipes.find(r => r.id === id))
    .filter(r => r && planOk(r));

  const mainItems = getSection(LUNCH_SECTION_IDS.main);
  const baseItems = getSection(LUNCH_SECTION_IDS.base);
  const addItems  = getSection(LUNCH_SECTION_IDS.addition);

  const selectedSaladId = [...lunchSelections].find(id => id.startsWith('sl'));
  const selectedSalad   = selectedSaladId ? recipes.find(r => r.id === selectedSaladId) : null;
  const count = lunchSelections.size;

  const renderLunchCard = r => {
    const selected = lunchSelections.has(r.id);
    return `
      <article class="recipe-card ${selected ? 'recipe-card--lunch-selected' : ''}"
               data-action="open-recipe" data-recipe-id="${r.id}"
               role="button" tabindex="0">
        <div class="recipe-card__image" style="${cardBgStyle(r)}">
          ${r.image ? '' : `<span class="recipe-card__emoji">${r.emoji}</span>`}
        </div>
        <div class="recipe-card__info">
          <h3 class="recipe-card__name">${r.name}</h3>
          <div class="recipe-card__tags">
            ${r.plans.map(p =>
              `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
            ).join('')}
          </div>
        </div>
        <div class="recipe-card__check-bar ${selected ? 'recipe-card__check-bar--on' : ''}"
             data-action="toggle-lunch-item" data-recipe-id="${r.id}">
          ${selected ? '✓ נבחר' : '+ בחר'}
        </div>
      </article>`;
  };

  const saladCat = CATEGORY_CONFIG.salad;
  const saladCard = `
    <article class="recipe-card ${selectedSalad ? 'recipe-card--lunch-selected' : ''}"
             data-action="open-lunch-salad-picker"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${saladCat.image ? `background-image:url('${imgSrc(saladCat.image)}');background-size:cover;background-position:center;` : `background:${saladCat.gradient};`}">
        ${saladCat.image ? '' : `<span class="recipe-card__emoji">${saladCat.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${selectedSalad ? selectedSalad.name : saladCat.label}</h3>
        <p class="category-card__count">לבחירה מהסלטים ›</p>
      </div>
      <div class="recipe-card__check-bar ${selectedSalad ? 'recipe-card__check-bar--on' : ''}"
           data-action="open-lunch-salad-picker">
        ${selectedSalad ? '✓ נבחר' : '+ בחר סלט'}
      </div>
    </article>`;

  const renderSection = (emoji, title, items, extra = '') => `
    <div class="grid-section">
      <div class="grid-section__header">
        <h3 class="grid-section__title">${emoji} ${title}</h3>
      </div>
      <div class="recipes-grid">${items.map(renderLunchCard).join('')}${extra}</div>
    </div>`;

  return `
    ${renderMealGreeting(MEAL_TYPES.LUNCH)}
    <div class="lunch-sections">
      ${renderSection('🍲', 'מרקים ותבשילים', mainItems)}
      ${renderSection('🍚', 'בסיס', baseItems)}
      ${renderSection('🥦', 'תוספות', addItems, saladCard)}
    </div>
    ${count > 0 ? `
    <div class="lunch-sticky-bar">
      <button class="lunch-add-btn" data-action="add-lunch-selections">
        הוסף ליומן אכילה (${count})
      </button>
    </div>` : ''}
  `;
}

function openLunchSaladPicker() {
  const salads = getCategoryRecipes('salad', MEAL_TYPES.LUNCH, state.plan);
  const cat = CATEGORY_CONFIG.salad;
  const selectedId = [...lunchSelections].find(id => id.startsWith('sl'));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--list">
      <div class="modal__header" style="background:${cat.gradient}">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        <span class="modal__emoji">${cat.emoji}</span>
        <h2 class="modal__title">${cat.label}</h2>
        <p class="modal__subtitle">${salads.length} אפשרויות</p>
      </div>
      <div class="modal__body modal__body--list">
        ${salads.map(r => `
          <div class="list-item ${r.id === selectedId ? 'list-item--selected' : ''}"
               data-action="pick-lunch-salad" data-recipe-id="${r.id}">
            <div class="list-item__icon" style="${cardBgStyle(r)}">${r.image ? '' : r.emoji}</div>
            <div class="list-item__text">
              <h4 class="list-item__name">${r.name}</h4>
            </div>
            <span class="list-item__arrow">${r.id === selectedId ? '✓' : '›'}</span>
          </div>`).join('')}
      </div>
    </div>`;

  mountModal(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'pick-lunch-salad') {
      const id = el.closest('[data-recipe-id]').dataset.recipeId;
      if (selectedId) lunchSelections.delete(selectedId);
      lunchSelections.add(id);
      closeModal(overlay, () => render());
    }
  });
}

// ─── Grid Rendering ───────────────────────────────────────────────────────────

function renderGrid() {
  const { type, value } = state.menuSelection;

  if (type === 'mealTime') {
    const categories = getVisibleCategories(value, state.plan);
    const individuals = getIndividualRecipes(value, state.plan);
    if (categories.length + individuals.length === 0) return renderEmptyState();

    if (value === MEAL_TYPES.LUNCH) {
      return renderLunchMultiSelect();
    }

    const cards = [...categories.map(renderCategoryCard), ...individuals.map(renderRecipeCard)].join('');
    return `${renderMealGreeting(value)}<div class="recipes-grid">${cards}</div>`;

  } else {
    const items = getRecipesBySource(value, state.plan);
    if (items.length === 0) return renderEmptyState();

    if (value === 'stew') {
      const mainRecipes = items.filter(r => !r.isComplement);
      const sideRecipes = items.filter(r =>  r.isComplement);
      return renderSplitGrid([], mainRecipes, [], sideRecipes);
    }

    return `<div class="recipes-grid">${items.map(renderRecipeCard).join('')}</div>`;
  }
}

function renderSplitGrid(mainCategories, mainRecipes, sideCategories, sideRecipes) {
  const mainCards = [
    ...mainCategories.map(renderCategoryCard),
    ...mainRecipes.map(renderRecipeCard),
  ].join('');
  const sideCards = [
    ...sideCategories.map(renderCategoryCard),
    ...sideRecipes.map(renderRecipeCard),
  ].join('');

  return `
    <div class="grid-section">
      <div class="grid-section__header">
        <h3 class="grid-section__title">ארוחות עיקריות</h3>
        <p class="grid-section__subtitle">ארוחות בריאות מזינות ומשביעות</p>
      </div>
      <div class="recipes-grid">${mainCards}</div>
    </div>
    ${sideCards ? `
    <div class="grid-section">
      <div class="grid-section__header">
        <h3 class="grid-section__title">מנות משלימות</h3>
        <p class="grid-section__subtitle">שלבי, הוסיפי, ובני את הארוחה שמתאימה לך</p>
      </div>
      <div class="recipes-grid">${sideCards}</div>
    </div>` : ''}
  `;
}

function renderEmptyState() {
  return `<div class="empty-state">
    <span class="empty-state__icon">🌿</span>
    <p>אין ארוחות לסינון הזה</p>
  </div>`;
}

// ─── Card Renderers ───────────────────────────────────────────────────────────

function renderCategoryCard(cat) {
  const count = getCategoryRecipes(cat.id, state.menuSelection.value, state.plan).length;
  const imgStyle = cat.image
    ? `background-image:url('${imgSrc(cat.image)}');background-size:cover;background-position:center;`
    : `background:${cat.gradient};`;
  return `
    <article class="recipe-card category-card"
             data-action="open-category" data-category="${cat.id}"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${imgStyle}">
        ${cat.image ? '' : `<span class="recipe-card__emoji">${cat.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${cat.label}</h3>
        <p class="category-card__count">${count} אפשרויות</p>
      </div>
      <span class="category-card__arrow">›</span>
    </article>`;
}

function renderRecipeCard(recipe) {
  return `
    <article class="recipe-card"
             data-action="open-recipe" data-recipe-id="${recipe.id}"
             role="button" tabindex="0">
      <div class="recipe-card__image" style="${cardBgStyle(recipe)}">
        ${recipe.image ? '' : `<span class="recipe-card__emoji">${recipe.emoji}</span>`}
      </div>
      <div class="recipe-card__info">
        <h3 class="recipe-card__name">${recipe.name}</h3>
        <div class="recipe-card__tags">
          ${recipe.plans.map(p =>
            `<span class="tag" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
          ).join('')}
        </div>
      </div>
    </article>`;
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function openCategoryModal(categoryId) {
  const cat = CATEGORY_CONFIG[categoryId];
  const mealType = state.menuSelection.type === 'mealTime'
    ? state.menuSelection.value
    : MEAL_TYPES.BREAKFAST; // fallback (shouldn't happen)
  const items = getCategoryRecipes(categoryId, mealType, state.plan);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--list">
      <div class="modal__header" style="background:${cat.gradient}">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        <span class="modal__emoji">${cat.emoji}</span>
        <h2 class="modal__title">${cat.label}</h2>
        <p class="modal__subtitle">${items.length} אפשרויות${state.plan ? ` · ${PLAN_CONFIG[state.plan].name}` : ''}</p>
      </div>
      <div class="modal__body modal__body--list">
        ${items.map(recipe => `
          <div class="list-item" data-action="open-recipe-from-list" data-recipe-id="${recipe.id}">
            <div class="list-item__icon" style="${cardBgStyle(recipe)}">${recipe.image ? '' : recipe.emoji}</div>
            <div class="list-item__text">
              <h4 class="list-item__name">${recipe.name}</h4>
              <div class="list-item__tags">
                ${recipe.plans.map(p =>
                  `<span class="tag tag--sm" style="background:${PLAN_CONFIG[p].bg};color:${PLAN_CONFIG[p].color}">${PLAN_CONFIG[p].name}</span>`
                ).join('')}
              </div>
            </div>
            <span class="list-item__arrow">›</span>
          </div>`).join('')}
      </div>
    </div>`;

  mountModal(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'open-recipe-from-list') {
      const r = recipes.find(r => r.id === el.dataset.recipeId);
      if (r) closeModal(overlay, () => openRecipeModal(r));
    }
  });
}

// ─── Recipe Modal ─────────────────────────────────────────────────────────────

function openRecipeModal(recipe) {
  const currentSlot = mealTypeToSlot(getMealTypeByTime());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('data-recipe-id', recipe.id);

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__header ${recipe.image ? 'modal__header--photo' : ''}"
           style="${recipe.image
             ? `background-image:url('${imgSrc(recipe.image)}');background-size:cover;background-position:center;`
             : `background:${recipe.gradient};`}">
        <button class="modal__close" data-action="close-modal" aria-label="סגור">✕</button>
        ${recipe.image ? '' : `<span class="modal__emoji">${recipe.emoji}</span>`}
        <h2 class="modal__title">${recipe.name}</h2>
        <div class="modal__tags">
          ${recipe.plans.map(p =>
            `<span class="tag tag--glass">${PLAN_CONFIG[p].name} · ${PLAN_CONFIG[p].subtitle}</span>`
          ).join('')}
        </div>
        ${(recipe.sides && recipe.sides.length > 0) ? `
        <button class="sides-btn" data-action="open-sides">🍽️ מה ליד?</button>` : ''}
      </div>
      <div class="modal__body">
        ${recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : ''}
        <section class="recipe-section">
          <h3 class="recipe-section__title">🛒 מרכיבים</h3>
          <ul class="ingredient-list">
            ${recipe.ingredientsList.map(i => `<li>${i}</li>`).join('')}
          </ul>
        </section>
        <section class="recipe-section">
          <h3 class="recipe-section__title">👨‍🍳 הכנה</h3>
          <ol class="step-list">
            ${recipe.instructions.map(s => `<li>${s}</li>`).join('')}
          </ol>
        </section>

        <section class="recipe-section diary-add-section">
          <h3 class="recipe-section__title">📅 הוסף ליומן</h3>
          <div class="diary-slot-picker">
            ${DIARY_SLOTS.map(slot => `
              <button class="diary-slot-btn ${slot.key === currentSlot ? 'diary-slot-btn--current' : ''}"
                      data-action="add-to-diary"
                      data-slot="${slot.key}"
                      data-recipe-id="${recipe.id}">
                ${slot.emoji} ${slot.label}
              </button>`).join('')}
          </div>
        </section>
      </div>
    </div>`;

  mountModal(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(overlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-modal') { closeModal(overlay); return; }
    if (el.dataset.action === 'open-sides') { openSidesModal(recipe, overlay); return; }
    if (el.dataset.action === 'add-to-diary') {
      const r = recipes.find(r => r.id === el.dataset.recipeId);
      const slot = el.dataset.slot;
      if (r) {
        addToDiary(r, slot);
        const label = DIARY_SLOTS.find(s => s.key === slot).label;
        showToast(`✓ נוסף ל${label}!`);
        // Mark button as added
        overlay.querySelectorAll('.diary-slot-btn').forEach(b => b.classList.remove('diary-slot-btn--added'));
        el.classList.add('diary-slot-btn--added');
        el.textContent = `✓ ${el.textContent.trim()}`;
      }
    }
  });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closeModal(overlay); document.removeEventListener('keydown', onEsc); }
  });
}

// ─── Sides Modal ──────────────────────────────────────────────────────────────

function openSidesModal(parentRecipe, parentOverlay) {
  const sideRecipes = (parentRecipe.sides || [])
    .map(id => recipes.find(r => r.id === id))
    .filter(Boolean);

  if (sideRecipes.length === 0) return;

  const sidesOverlay = document.createElement('div');
  sidesOverlay.className = 'modal-overlay';

  sidesOverlay.innerHTML = `
    <div class="modal">
      <div class="modal__header modal__header--sides">
        <button class="modal__close" data-action="close-sides" aria-label="חזרה">←</button>
        <span class="modal__emoji">🍽️</span>
        <h2 class="modal__title">מה ליד?</h2>
        <p class="modal__subtitle">תוספות מומלצות ל${parentRecipe.name}</p>
      </div>
      <div class="modal__body modal__body--list">
        ${sideRecipes.map(r => `
          <div class="list-item" data-action="open-side-recipe" data-recipe-id="${r.id}">
            <div class="list-item__icon" style="${cardBgStyle(r)}"></div>
            <span class="list-item__name">${r.name}</span>
            <span class="list-item__arrow">›</span>
          </div>`).join('')}
      </div>
    </div>`;

  sidesOverlay.addEventListener('click', e => {
    if (e.target === sidesOverlay) { closeModal(sidesOverlay); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'close-sides') { closeModal(sidesOverlay); return; }
    if (el.dataset.action === 'open-side-recipe') {
      const id = el.closest('[data-recipe-id]').dataset.recipeId;
      const r = recipes.find(x => x.id === id);
      if (!r) return;
      closeModal(sidesOverlay, () => closeModal(parentOverlay, () => openRecipeModal(r)));
    }
  });

  mountModal(sidesOverlay);
}

function mealTypeToSlot(mealType) {
  if (mealType === MEAL_TYPES.BREAKFAST) return 'breakfast';
  if (mealType === MEAL_TYPES.LUNCH)     return 'lunch';
  return 'dinner';
}

// ─── Diary View ───────────────────────────────────────────────────────────────

function renderDiaryView() {
  const diary  = getDiary();
  const entries = diary[state.diaryDate] || [];
  const isToday = state.diaryDate === todayKey();

  const slotSections = DIARY_SLOTS.map(slot => {
    const slotEntries = entries
      .map((e, globalIdx) => ({ ...e, globalIdx }))
      .filter(e => e.mealSlot === slot.key);
    if (slotEntries.length === 0) return '';

    return `
      <div class="diary-slot-section">
        <h3 class="diary-slot-title">${slot.emoji} ${slot.label}</h3>
        ${slotEntries.map(entry => `
          <div class="diary-entry">
            <span class="diary-entry__emoji">${entry.emoji}</span>
            <div class="diary-entry__text">
              <span class="diary-entry__name">${entry.name}</span>
              <span class="diary-entry__time">${entry.time}</span>
            </div>
            <button class="diary-entry__remove" data-action="remove-diary-entry"
                    data-idx="${entry.globalIdx}" aria-label="הסר">✕</button>
          </div>`).join('')}
      </div>`;
  }).join('');

  const hasEntries = entries.length > 0;

  return `
    <div class="diary-view fade-in">
      <header class="diary-header">
        <button class="btn-back" data-action="close-diary">← חזרה</button>
        <h2 class="diary-header__title">יומן אכילה</h2>
      </header>

      <div class="diary-nav">
        <button class="diary-nav__btn" data-action="diary-prev">‹</button>
        <label class="diary-nav__date-label">
          <span class="diary-nav__date-text">${formatDateHebrew(state.diaryDate)}</span>
          <input type="date" class="diary-date-input" value="${state.diaryDate}" max="${todayKey()}">
        </label>
        <button class="diary-nav__btn" data-action="diary-next" ${isToday ? 'disabled' : ''}>›</button>
      </div>

      <div class="diary-content">
        ${hasEntries
          ? slotSections
          : `<div class="empty-state">
               <span class="empty-state__icon">📋</span>
               <p>לא נרשמו ארוחות ב${formatDateHebrew(state.diaryDate)}</p>
               <p class="empty-state__hint">לחץ "הוסף ליומן" בתוך מתכון כדי לשמור</p>
             </div>`}
      </div>
    </div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2200);
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function mountModal(overlay) {
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
}

function closeModal(overlay, callback) {
  overlay.classList.remove('modal-overlay--visible');
  overlay.addEventListener('transitionend', () => {
    overlay.remove();
    if (callback) callback();
  }, { once: true });
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('app').addEventListener('click', handleAppClick);
  document.getElementById('app').addEventListener('change', e => {
    if (e.target.classList.contains('diary-date-input')) {
      const val = e.target.value;
      if (val && val <= todayKey()) {
        state.diaryDate = val;
        render();
      }
    }
  });
}

function handleAppClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {

    // ── Side menu ──
    case 'open-menu':
      state.sideMenuOpen = true;
      render();
      break;

    case 'close-menu':
      state.sideMenuOpen = false;
      render();
      break;

    case 'menu-select':
      if (!(el.dataset.type === 'mealTime' && el.dataset.value === MEAL_TYPES.LUNCH)) {
        lunchSelections.clear();
      }
      state.menuSelection = { type: el.dataset.type, value: el.dataset.value };
      state.view = 'main';
      state.sideMenuOpen = false;
      render();
      break;

    case 'open-daily-menu':
      state.view = 'dailyMenu';
      state.sideMenuOpen = false;
      render();
      break;

    case 'refresh-daily-menu':
      clearDailyMenu(state.plan);
      render();
      break;

    case 'add-daily-meal': {
      const r = recipes.find(r => r.id === el.dataset.recipeId);
      const slot = el.dataset.slot;
      if (r && !isInDiaryToday(r.id, slot)) {
        addToDiary(r, slot);
        const label = DIARY_SLOTS.find(s => s.key === slot).label;
        showToast(`✓ נוסף לארוחת ${label}!`);
        render();
      }
      break;
    }

    case 'replace-daily-meal':
      openReplaceModal(el.dataset.slot);
      break;

    // ── Daily menu lunch ──
    case 'add-daily-lunch': {
      const lunch = getDailyMenu(state.plan).lunch;
      const ids = lunch.type === 'main'
        ? [lunch.mainId, lunch.additionId].filter(Boolean)
        : [lunch.baseId, lunch.additionId].filter(Boolean);
      ids.forEach(id => {
        const r = recipes.find(r => r.id === id);
        if (r) addToDiary(r, 'lunch');
      });
      showToast(`✓ נוסף לארוחת צהריים!`);
      render();
      break;
    }

    case 'replace-daily-lunch-part':
      openLunchPartPicker(el.dataset.part);
      break;

    case 'replace-daily-lunch-whole':
      openLunchMainPicker();
      break;

    case 'daily-want-addition':
      openLunchPartPicker('addition');
      break;

    // ── Lunch multi-select ──
    case 'toggle-lunch-item': {
      const id = el.dataset.recipeId;
      if (lunchSelections.has(id)) lunchSelections.delete(id);
      else lunchSelections.add(id);
      render();
      break;
    }

    case 'open-lunch-salad-picker':
      openLunchSaladPicker();
      break;

    case 'add-lunch-selections': {
      const addCount = lunchSelections.size;
      for (const id of lunchSelections) {
        const r = recipes.find(r => r.id === id);
        if (r) addToDiary(r, 'lunch');
      }
      lunchSelections.clear();
      showToast(`✓ ${addCount} פריטים נוספו לצהריים!`);
      render();
      break;
    }

    // ── Plan filter ──
    case 'set-plan': {
      const v = el.dataset.plan;
      lunchSelections.clear();
      state.plan = v === '' ? null : parseInt(v);
      render();
      break;
    }

    // ── Recipe & Category ──
    case 'open-category':
      openCategoryModal(el.dataset.category);
      break;

    case 'open-recipe': {
      const r = recipes.find(r => r.id === el.dataset.recipeId);
      if (r) openRecipeModal(r);
      break;
    }

    // ── Diary navigation ──
    case 'open-diary':
      state.view = 'diary';
      state.diaryDate = todayKey();
      state.sideMenuOpen = false;
      render();
      break;

    case 'close-diary':
      state.view = 'dailyMenu';
      render();
      break;

    case 'diary-prev':
      state.diaryDate = offsetDateKey(state.diaryDate, -1);
      render();
      break;

    case 'diary-next':
      if (state.diaryDate < todayKey()) {
        state.diaryDate = offsetDateKey(state.diaryDate, 1);
        render();
      }
      break;

    case 'remove-diary-entry': {
      const idx = parseInt(el.dataset.idx);
      removeFromDiary(state.diaryDate, idx);
      render();
      break;
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

render();
