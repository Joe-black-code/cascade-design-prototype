import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const pages = ['index.html', 'catalog.html'];
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function occurrences(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}(?:\\s|>)`, 'gi'))].length;
}

function attributes(html, attribute) {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function openingTagsWithAttribute(html, attribute) {
  const pattern = new RegExp(`<[^/!][^>]*\\s${attribute}(?:\\s*=\\s*["'][^"']*["'])?(?=\\s|>)[^>]*>`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function attributeValue(tag, attribute) {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

check(await exists(dist), 'Отсутствует каталог dist.');
check(await exists(resolve(dist, 'assets')), 'Отсутствует каталог dist/assets.');
if (await exists(resolve(dist, 'assets'))) {
  check((await readdir(resolve(dist, 'assets'))).length > 0, 'Каталог dist/assets пуст.');
}

const expectedSections = ['hero', 'products', 'solutions', 'partner-programs', 'projects', 'production', 'estimate'];
const expectedCards = [
  '3D сетка Гиттер',
  '2D сетка СПОРТ',
  'Сетка сварная в рулонах',
  'Сетка Рабица',
  'Ворота и калитки',
  'Столбы для забора',
  'Винтовые сваи',
  'Крепёж и комплектующие',
  'Проволока',
  'Защита периметра',
  'Защита от БПЛА и дронов',
  'Расчёт партии по смете',
];

for (const page of pages) {
  const pagePath = resolve(dist, page);
  if (!(await exists(pagePath))) {
    failures.push(`Отсутствует dist/${page}.`);
    continue;
  }

  const html = await readFile(pagePath, 'utf8');
  check(!/{{{?[\s\S]*?}}}?/.test(html), `${page}: остался необработанный Handlebars-маркер.`);
  for (const tag of ['header', 'main', 'footer', 'h1']) {
    check(occurrences(html, tag) === 1, `${page}: ожидался ровно один <${tag}>, найдено ${occurrences(html, tag)}.`);
  }

  const ids = attributes(html, 'id');
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(duplicates.length === 0, `${page}: повторяющиеся id: ${duplicates.join(', ')}.`);
  check(!/javascript\s*:\s*void\s*\(\s*0\s*\)/i.test(html), `${page}: найден javascript:void(0).`);
  check(!/(?:src|href)\s*=\s*["']data:/i.test(html), `${page}: найден встроенный base64/data-ресурс.`);
  const imageUrls = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1]);
  check(imageUrls.every((url) => !/^(?:https?:)?\/\//i.test(url)), `${page}: найдено внешнее изображение.`);

  const resourceUrls = [...attributes(html, 'src'), ...attributes(html, 'href')]
    .filter((url) => /\.(?:css|js|mjs|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)(?:[?#].*)?$/i.test(url));
  for (const url of resourceUrls) {
    check(!/^(?:https?:)?\/\//i.test(url), `${page}: найден внешний ресурс ${url}.`);
    check(!url.startsWith('/'), `${page}: корневой путь не пригоден для вложенного размещения: ${url}.`);
    if (!/^(?:https?:)?\/\//i.test(url) && !url.startsWith('/')) {
      const cleanUrl = decodeURIComponent(url.split(/[?#]/, 1)[0]);
      check(await exists(resolve(dirname(pagePath), cleanUrl)), `${page}: локальный ресурс не существует: ${url}.`);
    }
  }

  const internalPageLinks = attributes(html, 'href').filter((url) => /(?:index|catalog)\.html(?:[?#].*)?$/.test(url));
  check(internalPageLinks.every((url) => !url.startsWith('/')), `${page}: переход между страницами использует корневой URL.`);

  const modalTags = openingTagsWithAttribute(html, 'data-modal');
  check(modalTags.length === 1, `${page}: ожидался один контейнер data-modal, найдено ${modalTags.length}.`);
  const modalId = modalTags.length === 1 ? attributeValue(modalTags[0], 'id') : undefined;
  check(Boolean(modalId), `${page}: контейнер data-modal не имеет id.`);
  check(modalTags.length === 1 && modalTags[0].includes('data-modal-backdrop'), `${page}: отсутствует data-modal-backdrop.`);
  check(modalTags.length === 1 && attributeValue(modalTags[0], 'aria-hidden') === 'true', `${page}: закрытая модалка должна иметь aria-hidden="true".`);
  check(openingTagsWithAttribute(html, 'data-modal-dialog').length === 1, `${page}: отсутствует единственный data-modal-dialog.`);

  const closeTags = openingTagsWithAttribute(html, 'data-modal-close');
  check(closeTags.length === 1, `${page}: ожидалась одна кнопка data-modal-close, найдено ${closeTags.length}.`);
  check(closeTags.length === 1 && /^<button\b/i.test(closeTags[0]) && attributeValue(closeTags[0], 'type') === 'button', `${page}: data-modal-close должен быть button с type="button".`);

  const triggerTags = openingTagsWithAttribute(html, 'data-modal-open');
  check(triggerTags.length > 0, `${page}: отсутствуют триггеры data-modal-open.`);
  for (const trigger of triggerTags) {
    const targetId = attributeValue(trigger, 'data-modal-open');
    check(Boolean(targetId) && ids.includes(targetId), `${page}: триггер ссылается на отсутствующий id ${targetId || '(пусто)'}.`);
    check(attributeValue(trigger, 'aria-controls') === targetId, `${page}: aria-controls триггера не совпадает с data-modal-open.`);
    check(attributeValue(trigger, 'aria-haspopup') === 'dialog', `${page}: триггер не имеет aria-haspopup="dialog".`);
  }

  const megaMenuTriggers = openingTagsWithAttribute(html, 'data-mega-menu-trigger');
  const megaMenuPanels = openingTagsWithAttribute(html, 'data-mega-menu-panel');
  check(megaMenuTriggers.length === 4, `${page}: ожидалось четыре кнопки мегаменю, найдено ${megaMenuTriggers.length}.`);
  check(megaMenuPanels.length === 4, `${page}: ожидалось четыре панели мегаменю, найдено ${megaMenuPanels.length}.`);

  const panelIds = megaMenuPanels.map((panel) => attributeValue(panel, 'id'));
  check(panelIds.every(Boolean) && new Set(panelIds).size === 4, `${page}: панели мегаменю должны иметь четыре уникальных id.`);
  for (const trigger of megaMenuTriggers) {
    const triggerId = attributeValue(trigger, 'id');
    const controlledId = attributeValue(trigger, 'aria-controls');
    const panel = megaMenuPanels.find((candidate) => attributeValue(candidate, 'id') === controlledId);
    check(/^<button\b/i.test(trigger) && attributeValue(trigger, 'type') === 'button', `${page}: триггер мегаменю должен быть button с type="button".`);
    check(Boolean(triggerId), `${page}: триггер мегаменю не имеет id.`);
    check(attributeValue(trigger, 'aria-expanded') === 'false', `${page}: триггер мегаменю должен начинаться с aria-expanded="false".`);
    check(Boolean(panel), `${page}: aria-controls триггера указывает на отсутствующую панель ${controlledId || '(пусто)'}.`);
    if (panel) {
      check(attributeValue(panel, 'aria-labelledby') === triggerId, `${page}: aria-labelledby панели ${controlledId} не указывает на её триггер.`);
      check(attributeValue(panel, 'aria-hidden') === 'true' && /\shidden(?:\s|>)/i.test(panel), `${page}: панель ${controlledId} должна начинаться с согласованными hidden и aria-hidden="true".`);
    }
  }
  check(!/\brole\s*=\s*["'](?:menu|menuitem|menubar)["']/i.test(html), `${page}: найден запрещённый ARIA menu/menubar role.`);

  const mobileToggles = openingTagsWithAttribute(html, 'data-mobile-navigation-toggle');
  const mobileContainers = openingTagsWithAttribute(html, 'data-mobile-navigation');
  check(mobileToggles.length === 1, `${page}: ожидалась одна кнопка открытия мобильной навигации, найдено ${mobileToggles.length}.`);
  check(mobileContainers.length === 1, `${page}: ожидался один контейнер мобильной навигации, найдено ${mobileContainers.length}.`);
  const mobileId = mobileContainers.length === 1 ? attributeValue(mobileContainers[0], 'id') : undefined;
  if (mobileToggles.length === 1) {
    check(/^<button\b/i.test(mobileToggles[0]) && attributeValue(mobileToggles[0], 'type') === 'button', `${page}: триггер мобильной навигации должен быть button с type="button".`);
    check(attributeValue(mobileToggles[0], 'aria-expanded') === 'false', `${page}: триггер мобильной навигации должен начинаться с aria-expanded="false".`);
    check(attributeValue(mobileToggles[0], 'aria-controls') === mobileId, `${page}: aria-controls триггера мобильной навигации не совпадает с id контейнера.`);
  }
  if (mobileContainers.length === 1) {
    check(Boolean(mobileId), `${page}: контейнер мобильной навигации не имеет id.`);
    check(mobileContainers[0].includes('data-mobile-navigation-backdrop'), `${page}: контейнер не обозначен как backdrop мобильной навигации.`);
    check(attributeValue(mobileContainers[0], 'aria-hidden') === 'true' && /\shidden(?:\s|>)/i.test(mobileContainers[0]), `${page}: мобильная навигация должна начинаться с согласованными hidden и aria-hidden="true".`);
  }
  check(openingTagsWithAttribute(html, 'data-mobile-navigation-panel').length === 1, `${page}: отсутствует единственная внутренняя панель мобильной навигации.`);
  check(openingTagsWithAttribute(html, 'data-mobile-navigation-close').length === 1, `${page}: отсутствует единственная кнопка закрытия мобильной навигации.`);
  check(openingTagsWithAttribute(html, 'data-mobile-navigation-root').length === 1, `${page}: отсутствует корневой уровень мобильной навигации.`);

  const mobileTriggers = openingTagsWithAttribute(html, 'data-mobile-navigation-trigger');
  const mobileLevels = openingTagsWithAttribute(html, 'data-mobile-navigation-level');
  const mobileBackButtons = openingTagsWithAttribute(html, 'data-mobile-navigation-back');
  check(mobileTriggers.length === 4, `${page}: ожидалось четыре кнопки вложенных разделов, найдено ${mobileTriggers.length}.`);
  check(mobileLevels.length === 4, `${page}: ожидалось четыре вложенные панели, найдено ${mobileLevels.length}.`);
  check(mobileBackButtons.length === 4, `${page}: ожидалось четыре кнопки «Назад», найдено ${mobileBackButtons.length}.`);
  const mobileLevelIds = mobileLevels.map((level) => attributeValue(level, 'id'));
  check(mobileLevelIds.every(Boolean) && new Set(mobileLevelIds).size === 4, `${page}: вложенные панели должны иметь четыре уникальных id.`);
  for (const trigger of mobileTriggers) {
    const controlledId = attributeValue(trigger, 'aria-controls');
    const level = mobileLevels.find((candidate) => attributeValue(candidate, 'id') === controlledId);
    check(/^<button\b/i.test(trigger) && attributeValue(trigger, 'type') === 'button', `${page}: переход во вложенный раздел должен быть button с type="button".`);
    check(attributeValue(trigger, 'aria-expanded') === 'false', `${page}: кнопка вложенного раздела должна начинаться с aria-expanded="false".`);
    check(Boolean(level), `${page}: кнопка мобильного раздела ссылается на отсутствующую панель ${controlledId || '(пусто)'}.`);
    if (level) {
      check(attributeValue(level, 'aria-labelledby') === attributeValue(trigger, 'id'), `${page}: панель ${controlledId} не связана со своей кнопкой.`);
      check(attributeValue(level, 'aria-hidden') === 'true' && /\shidden(?:\s|>)/i.test(level), `${page}: панель ${controlledId} должна начинаться с согласованными hidden и aria-hidden="true".`);
    }
  }
  for (const backButton of mobileBackButtons) {
    check(/^<button\b/i.test(backButton) && attributeValue(backButton, 'type') === 'button', `${page}: элемент «Назад» должен быть button с type="button".`);
  }
  check(!/<div\b[^>]*\bdata-mobile-navigation-(?:toggle|close|trigger|back)\b/i.test(html), `${page}: найден интерактивный div мобильной навигации вместо button.`);

  const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>/gi)].map((match) => match[0]);
  check(scriptTags.some((tag) => {
    const src = attributeValue(tag, 'src');
    return src && !/^(?:https?:)?\/\//i.test(src) && !src.startsWith('/') && /\.js(?:[?#].*)?$/i.test(src);
  }), `${page}: собранный JavaScript не подключён локально.`);

  if (page === 'index.html') {
    for (const section of expectedSections) {
      check(html.includes(`data-section="${section}"`), `${page}: отсутствует обязательная секция ${section}.`);
    }
  } else {
    const cardTitles = [...html.matchAll(/<article\b[^>]*\bcategory-card\b[^>]*>[\s\S]*?<h2>([^<]+)<\/h2>/gi)]
      .map((match) => match[1].trim());
    check(cardTitles.length === 12, `${page}: ожидалось 12 карточек Каталога, найдено ${cardTitles.length}.`);
    check(JSON.stringify(cardTitles) === JSON.stringify(expectedCards), `${page}: нарушен порядок или состав карточек Каталога.`);
  }
}

if (failures.length) {
  console.error(`Проверка сборки завершилась с ошибками (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Проверка сборки пройдена: обе страницы, структура, контент и локальные относительные ресурсы корректны.');
