// ─── Time ─────────────────────────────────────────────────────────────────────

function getMealTypeByTime() {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return MEAL_TYPES.BREAKFAST;
  if (h >= 11 && h < 17) return MEAL_TYPES.LUNCH;
  return MEAL_TYPES.DINNER;
}

// ─── Source ───────────────────────────────────────────────────────────────────
// Derived from recipe ID prefix — no need to store separately in data.js

function getRecipeSource(recipe) {
  if (recipe.id.startsWith('sh')) return 'shake';
  if (recipe.id.startsWith('sw')) return 'sandwich';
  if (recipe.id.startsWith('sl')) return 'salad';
  if (recipe.id.startsWith('lu')) return 'stew';
  return 'light'; // br* and di*
}

// ─── Filtering: by Meal Time ──────────────────────────────────────────────────

function getIndividualRecipes(mealType, plan) {
  return recipes.filter(r =>
    r.category === null &&
    r.mealTypes.includes(mealType) &&
    (plan === null || r.plans.includes(plan))
  );
}

function getCategoryRecipes(categoryId, mealType, plan) {
  return recipes.filter(r =>
    r.category === categoryId &&
    r.mealTypes.includes(mealType) &&
    (plan === null || r.plans.includes(plan))
  );
}

function getVisibleCategories(mealType, plan) {
  return Object.values(CATEGORY_CONFIG).filter(cat => {
    if (!cat.mealTypes.includes(mealType)) return false;
    return getCategoryRecipes(cat.id, mealType, plan).length > 0;
  });
}

// ─── Filtering: by Source ─────────────────────────────────────────────────────

function getRecipesBySource(source, plan) {
  return recipes.filter(r =>
    getRecipeSource(r) === source &&
    (plan === null || r.plans.includes(plan))
  );
}

// ─── Daily Menu ───────────────────────────────────────────────────────────────

function generateDailyLunch(plan) {
  const planOk = r => r && (plan === null || r.plans.includes(plan));
  const pickFrom = ids => {
    const pool = ids.map(id => recipes.find(r => r.id === id)).filter(planOk);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  };
  // Randomly choose type A (main dish) or type B (base + addition)
  if (Math.random() < 0.5) {
    return { type: 'main', mainId: pickFrom(LUNCH_SECTION_IDS.main), additionId: null };
  }
  return { type: 'base-addition', baseId: pickFrom(LUNCH_SECTION_IDS.base), additionId: pickFrom(LUNCH_SECTION_IDS.addition) };
}

function generateDailyMenu(plan) {
  const pick = (type) => {
    let pool = recipes.filter(r =>
      r.mealTypes.includes(type) && (plan === null || r.plans.includes(plan))
    );
    // Clean (2) and Reset (3): breakfast = shakes only
    if (type === MEAL_TYPES.BREAKFAST && (plan === 2 || plan === 3)) {
      pool = pool.filter(r => r.id.startsWith('sh'));
    }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  };
  return {
    breakfast: pick(MEAL_TYPES.BREAKFAST),
    lunch:     generateDailyLunch(plan),
    dinner:    pick(MEAL_TYPES.DINNER),
  };
}

function dailyMenuKey(plan) {
  return `dailyMenu_${todayKey()}_plan${plan ?? 0}`;
}

function isBreakfastValid(recipeId, plan) {
  if (plan !== 2 && plan !== 3) return true;
  return recipeId && recipeId.startsWith('sh');
}

function getDailyMenu(plan) {
  try {
    const stored = localStorage.getItem(dailyMenuKey(plan));
    if (stored) {
      const menu = JSON.parse(stored);
      // Migrate: if lunch is still a plain string, regenerate
      if (typeof menu.lunch === 'string') {
        const fresh = generateDailyMenu(plan);
        localStorage.setItem(dailyMenuKey(plan), JSON.stringify(fresh));
        return fresh;
      }
      if (!isBreakfastValid(menu.breakfast, plan)) {
        const fresh = generateDailyMenu(plan);
        localStorage.setItem(dailyMenuKey(plan), JSON.stringify(fresh));
        return fresh;
      }
      return menu;
    }
  } catch {}
  const menu = generateDailyMenu(plan);
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
  return menu;
}

function clearDailyMenu(plan) {
  localStorage.removeItem(dailyMenuKey(plan));
}

function updateDailyMenuSlot(plan, slotKey, recipeId) {
  const menu = getDailyMenu(plan);
  menu[slotKey] = recipeId;
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
}

// Update a specific part of the lunch object in the daily menu
function updateDailyMenuLunchPart(plan, part, recipeId) {
  const menu = getDailyMenu(plan);
  const key = part === 'main' ? 'mainId' : part === 'base' ? 'baseId' : 'additionId';
  menu.lunch[key] = recipeId;
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
}

// Set the lunch addition when user picks "רוצה תוספת?"
function addLunchAddition(plan, recipeId) {
  const menu = getDailyMenu(plan);
  menu.lunch.additionId = recipeId;
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
}

// Switch lunch from Type B (base + addition) to Type A (main)
function switchLunchToMain(plan, recipeId) {
  const menu = getDailyMenu(plan);
  menu.lunch = { type: 'main', mainId: recipeId, additionId: null };
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
}

// Switch lunch from Type A (main) to Type B (base + addition)
function switchLunchToBaseAddition(plan) {
  const menu = getDailyMenu(plan);
  const planOk = r => r && (plan === null || r.plans.includes(plan));
  const pickFrom = ids => {
    const pool = ids.map(id => recipes.find(r => r.id === id)).filter(planOk);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  };
  menu.lunch = {
    type: 'base-addition',
    baseId:     pickFrom(LUNCH_SECTION_IDS.base),
    additionId: pickFrom(LUNCH_SECTION_IDS.addition),
  };
  localStorage.setItem(dailyMenuKey(plan), JSON.stringify(menu));
}

function isInDiaryToday(recipeId, mealSlot) {
  const entries = getDiary()[todayKey()] || [];
  return entries.some(e => e.recipeId === recipeId && e.mealSlot === mealSlot);
}

// ─── Diary ────────────────────────────────────────────────────────────────────

const DIARY_SLOTS = [
  { key: 'breakfast', label: 'בוקר',   emoji: '🌅' },
  { key: 'lunch',     label: 'צהריים', emoji: '☀️' },
  { key: 'dinner',    label: 'ערב',    emoji: '🌙' },
  { key: 'snack',     label: 'ביניים', emoji: '🍎' },
];

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function offsetDateKey(key, days) {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateHebrew(key) {
  const today = todayKey();
  const yesterday = offsetDateKey(today, -1);
  if (key === today)     return 'היום';
  if (key === yesterday) return 'אתמול';
  const d = new Date(key + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getDiary() {
  try { return JSON.parse(localStorage.getItem('foodDiary') || '{}'); }
  catch { return {}; }
}

function saveDiary(diary) {
  localStorage.setItem('foodDiary', JSON.stringify(diary));
}

function addToDiary(recipe, mealSlot) {
  const diary = getDiary();
  const key = todayKey();
  if (!diary[key]) diary[key] = [];
  diary[key].push({
    recipeId: recipe.id,
    name:     recipe.name,
    emoji:    recipe.emoji,
    mealSlot,
    time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
  });
  saveDiary(diary);
}

function removeFromDiary(dateKey, index) {
  const diary = getDiary();
  if (!diary[dateKey]) return;
  diary[dateKey].splice(index, 1);
  if (diary[dateKey].length === 0) delete diary[dateKey];
  saveDiary(diary);
}
