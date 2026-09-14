import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const pages = ['index.html', 'catalog.html'];
const failures = [];
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

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

function hasAttribute(tag, attribute) {
  return new RegExp(`\\s${attribute}(?=\\s|=|>)`, 'i').test(tag);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(path) {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => resolve(entry.parentPath, entry.name));
}

async function checkUtf8File(path) {
  try {
    const content = utf8Decoder.decode(await readFile(path));
    check(!content.includes('\uFFFD'), `${path}: найден символ замены U+FFFD.`);
    return content;
  } catch {
    failures.push(`${path}: файл не является корректным UTF-8.`);
    return '';
  }
}

check(await exists(dist), 'Отсутствует каталог dist.');
check(await exists(resolve(dist, 'assets')), 'Отсутствует каталог dist/assets.');
if (await exists(resolve(dist, 'assets'))) {
  check((await readdir(resolve(dist, 'assets'))).length > 0, 'Каталог dist/assets пуст.');
}

const sourceTextFiles = [
  ...await filesUnder(resolve(root, 'src')),
  ...await filesUnder(resolve(root, 'scripts')),
  resolve(root, 'README.md'),
  resolve(root, 'Cascade-Design-Roadmap.md'),
];
const sourceContents = new Map();
for (const path of sourceTextFiles) sourceContents.set(path, await checkUtf8File(path));

const baseCss = sourceContents.get(resolve(root, 'src/styles/base.css')) || '';
const tokensCss = sourceContents.get(resolve(root, 'src/styles/tokens.css')) || '';
const layoutCss = sourceContents.get(resolve(root, 'src/styles/layout.css')) || '';
const responsiveCss = sourceContents.get(resolve(root, 'src/styles/responsive.css')) || '';
check(/@import\s+url\(['"]\.\/tokens\.css['"]\)/.test(baseCss), 'base.css: tokens.css не подключён через единую CSS-точку входа.');
check(/@import\s+url\(['"]\.\/layout\.css['"]\)/.test(baseCss), 'base.css: layout.css не подключён через единую CSS-точку входа.');
check(/@import\s+url\(['"]\.\/responsive\.css['"]\)/.test(baseCss), 'base.css: responsive.css не подключён после layout.css.');
check(baseCss.indexOf("./responsive.css") > baseCss.indexOf("./layout.css"), 'base.css: responsive.css должен следовать после layout.css.');
check(tokensCss.includes('--layout-columns: 4') && tokensCss.includes('--layout-container-max: 90rem'), 'tokens.css: отсутствуют канонические layout-токены CP-1.3A.');
check(layoutCss.includes('.layout-container') && layoutCss.includes('.layout-grid'), 'layout.css: отсутствуют канонические layout-примитивы CP-1.3A.');
check(responsiveCss.includes('@media (min-width: 67.5rem)'), 'responsive.css: отсутствует breakpoint навигации 67.5rem.');

for (const [path, content] of sourceContents) {
  if (/\.html$/i.test(path)) check(!/\sstyle\s*=\s*["']/i.test(content), `${path}: найден запрещённый inline style.`);
  if (/\.css$/i.test(path)) {
    check(!/(?:^|})\s*(?:html|body)(?:\s*,\s*(?:html|body))*\s*\{[^}]*(?:overflow-x\s*:\s*(?:hidden|clip)|\bzoom\s*:|transform\s*:\s*scale|width\s*:\s*\d)/ims.test(content), `${path}: найден запрещённый глобальный overflow-x/zoom/width/transform-хак.`);
  }
}

const builtCssPaths = (await filesUnder(resolve(dist, 'assets'))).filter((path) => path.endsWith('.css'));
check(builtCssPaths.length > 0, 'В dist/assets отсутствует собранный CSS.');
const builtCss = (await Promise.all(builtCssPaths.map((path) => readFile(path, 'utf8')))).join('\n');
for (const marker of ['--layout-columns', '--layout-page-gutter', '--layout-container-max', '.layout-container', '.layout-grid']) {
  check(builtCss.includes(marker), `Собранный CSS не содержит ${marker}.`);
}

const demoNoticeSource = await checkUtf8File(resolve(root, 'src/scripts/components/demo-notice.js'));
check(demoNoticeSource.includes('Раздел „${name}“ пока не входит в демонстрационный макет.'), 'demo-notice.js: текст уведомления повреждён или изменён.');

const scriptRoot = resolve(root, 'src/scripts');
for (const entry of await readdir(scriptRoot, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const source = await readFile(resolve(entry.parentPath, entry.name), 'utf8');
  check(!/\b(?:alert|fetch)\s*\(/i.test(source), `${entry.name}: найден запрещённый alert() или fetch().`);
  check(!/XMLHttpRequest/i.test(source), `${entry.name}: найден запрещённый XMLHttpRequest.`);
  check(!/\.innerHTML\s*=/i.test(source), `${entry.name}: найдено динамическое присваивание innerHTML.`);
  check(!/\b(?:WebSocket|EventSource)\s*\(|navigator\.sendBeacon\s*\(/i.test(source), `${entry.name}: найден запрещённый сетевой API.`);
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
  check(!html.includes('\uFFFD'), `${page}: найден символ замены U+FFFD.`);
  check(!/{{{?[\s\S]*?}}}?/.test(html), `${page}: остался необработанный Handlebars-маркер.`);
  check(/<meta\b[^>]*\bname=["']viewport["'][^>]*\bcontent=["'][^"']*width=device-width[^"']*["']/i.test(html), `${page}: отсутствует корректный viewport meta.`);
  const shellTags = ['header', 'main', 'footer'].map((tag) => html.match(new RegExp(`<${tag}\\b[^>]*>`, 'i'))?.[0] || '');
  check(shellTags.every((tag) => !/(?:^|\s)layout-container(?:\s|$)/.test(attributeValue(tag, 'class') || '')), `${page}: полноширинные header, main и footer не должны иметь layout-container.`);
  const containerTags = openingTagsWithAttribute(html, 'class').filter((tag) => /(?:^|\s)layout-container(?:\s|$)/.test(attributeValue(tag, 'class') || ''));
  const expectedContainerCount = page === 'index.html' ? 13 : 8;
  check(containerTags.length === expectedContainerCount, `${page}: ожидалось внутренних layout-container: ${expectedContainerCount}, найдено ${containerTags.length}.`);
  check(/<header\b[^>]*>\s*<div\b[^>]*class=["'][^"']*\bheader-inner\b[^"']*\blayout-container\b[^"']*["']/i.test(html), `${page}: основная строка header не помещена во внутренний layout-container.`);
  check(/<footer\b[^>]*>\s*<div\b[^>]*class=["'][^"']*\blayout-container\b[^"']*["']/i.test(html), `${page}: содержимое footer не помещено во внутренний layout-container.`);
  for (const tag of ['header', 'main', 'footer', 'h1']) {
    check(occurrences(html, tag) === 1, `${page}: ожидался ровно один <${tag}>, найдено ${occurrences(html, tag)}.`);
  }

  const ids = attributes(html, 'id');
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(duplicates.length === 0, `${page}: повторяющиеся id: ${duplicates.join(', ')}.`);
  check(!/javascript\s*:\s*void\s*\(\s*0\s*\)/i.test(html), `${page}: найден javascript:void(0).`);
  check(!/\b(?:alert|fetch)\s*\(/i.test(html), `${page}: найден запрещённый alert() или fetch().`);
  check(!/XMLHttpRequest/i.test(html), `${page}: найден запрещённый XMLHttpRequest.`);
  check(!/\.innerHTML\s*=/i.test(html), `${page}: найдено динамическое присваивание innerHTML.`);
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
  check((html.match(/<nav\b[^>]*data-mega-menu-panel[^>]*>\s*<div\b[^>]*\blayout-container\b/gi) || []).length === 4, `${page}: каждая панель мегаменю должна иметь внутренний layout-container.`);

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

  const demoNotices = openingTagsWithAttribute(html, 'data-demo-notice');
  check(demoNotices.length === 1, `${page}: ожидалось одно уведомление data-demo-notice, найдено ${demoNotices.length}.`);
  if (demoNotices.length === 1) {
    check(Boolean(attributeValue(demoNotices[0], 'id')), `${page}: уведомление не имеет id.`);
    check(hasAttribute(demoNotices[0], 'hidden'), `${page}: уведомление должно быть изначально скрыто.`);
  }
  const noticeMessages = openingTagsWithAttribute(html, 'data-demo-notice-message');
  check(noticeMessages.length === 1, `${page}: отсутствует единственная область сообщения уведомления.`);
  check(noticeMessages.length === 1 && (attributeValue(noticeMessages[0], 'role') === 'status' || attributeValue(noticeMessages[0], 'aria-live') === 'polite'), `${page}: сообщение уведомления не является status/live-регионом.`);
  const noticeCloseButtons = openingTagsWithAttribute(html, 'data-demo-notice-close');
  check(noticeCloseButtons.length === 1 && /^<button\b/i.test(noticeCloseButtons[0]) && attributeValue(noticeCloseButtons[0], 'type') === 'button', `${page}: закрытие уведомления должно быть единственной кнопкой type="button".`);
  const placeholderLinks = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']#not-implemented["'][^>]*>/gi)];
  check(placeholderLinks.length > 0, `${page}: отсутствуют ссылки-заглушки #not-implemented.`);

  const estimateForms = openingTagsWithAttribute(html, 'data-estimate-form');
  const expectedFormCount = page === 'index.html' ? 2 : 1;
  check(estimateForms.length === expectedFormCount, `${page}: ожидалось форм расчёта: ${expectedFormCount}, найдено ${estimateForms.length}.`);
  check(estimateForms.every((form) => /^<form\b/i.test(form)), `${page}: data-estimate-form должен находиться на form.`);
  check(estimateForms.every((form) => attributeValue(form, 'data-form-state') === 'idle'), `${page}: формы должны начинаться в состоянии idle.`);
  check(estimateForms.every((form) => !attributeValue(form, 'action')), `${page}: у демонстрационной формы не должно быть внешнего action.`);

  const formFields = ['name', 'phone', 'brief', 'consent'];
  for (const name of formFields) {
    const inputs = [...html.matchAll(new RegExp(`<input\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'gi'))].map((match) => match[0]);
    check(inputs.length === expectedFormCount, `${page}: поле ${name} должно встречаться в каждой форме.`);
    for (const input of inputs) {
      const inputId = attributeValue(input, 'id');
      check(Boolean(inputId), `${page}: поле ${name} не имеет id.`);
      check(new RegExp(`<label\\b[^>]*\\bfor=["']${inputId}["']`, 'i').test(html), `${page}: поле ${inputId || name} не связано с label.`);
      check(Boolean(attributeValue(input, 'aria-describedby')), `${page}: поле ${inputId || name} не имеет aria-describedby.`);
      if (name !== 'brief') check(hasAttribute(input, 'required'), `${page}: обязательное поле ${inputId || name} не имеет required.`);
    }
  }

  check(openingTagsWithAttribute(html, 'data-field-error').length === expectedFormCount * 3, `${page}: у каждой формы должны быть три области ошибок полей.`);
  check(openingTagsWithAttribute(html, 'data-form-status').length === expectedFormCount, `${page}: у каждой формы должна быть общая область ошибок.`);
  check(openingTagsWithAttribute(html, 'data-estimate-success').length === expectedFormCount, `${page}: у каждой формы должен быть success-status.`);
  const submitButtons = openingTagsWithAttribute(html, 'data-estimate-submit');
  const retryButtons = openingTagsWithAttribute(html, 'data-estimate-retry');
  check(submitButtons.length === expectedFormCount && submitButtons.every((button) => attributeValue(button, 'type') === 'submit'), `${page}: кнопки отправки должны иметь type="submit".`);
  check(retryButtons.length === expectedFormCount && retryButtons.every((button) => attributeValue(button, 'type') === 'button'), `${page}: кнопки повторной отправки должны иметь type="button".`);

  if (page === 'index.html') {
    for (const section of expectedSections) {
      check(html.includes(`data-section="${section}"`), `${page}: отсутствует обязательная секция ${section}.`);
      check(new RegExp(`<section\\b[^>]*data-section=["']${section}["'][^>]*>\\s*<div\\b[^>]*\\blayout-container\\b`, 'i').test(html), `${page}: секция ${section} не имеет непосредственного внутреннего layout-container.`);
    }
    const sliders = openingTagsWithAttribute(html, 'data-projects-slider');
    const sliderViewports = openingTagsWithAttribute(html, 'data-projects-slider-viewport');
    const sliderGroups = openingTagsWithAttribute(html, 'data-projects-slider-group');
    const projectCards = [...html.matchAll(/<article\b[^>]*\bproject-card\b[^>]*>/gi)];
    check(sliders.length === 1, `${page}: ожидался один слайдер объектов, найдено ${sliders.length}.`);
    check(sliderViewports.length === 1 && Boolean(attributeValue(sliderViewports[0], 'id')), `${page}: отсутствует единственный viewport с id.`);
    check(sliderGroups.length === 3, `${page}: ожидалось три группы объектов, найдено ${sliderGroups.length}.`);
    check(projectCards.length === 6, `${page}: ожидалось шесть карточек объектов, найдено ${projectCards.length}.`);
    const groupContents = [...html.matchAll(/<li\b[^>]*\bdata-projects-slider-group\b[^>]*>[\s\S]*?<\/ul>\s*<\/li>/gi)].map((match) => match[0]);
    check(groupContents.length === 3 && groupContents.every((group) => [...group.matchAll(/<article\b[^>]*\bproject-card\b[^>]*>/gi)].length === 2), `${page}: каждая группа слайдера должна содержать две карточки.`);
    const expectedProjects = [
      'Складской комплекс Ozon (1 500 м)',
      'Жилой комплекс «Новый квартал»',
      'Нефтеперерабатывающий завод «КИНЕФ»',
      'Скоростная автотрасса М-11 «Нева»',
      'Спортивный кластер «Арена-Север»',
      'Трансформаторная подстанция ПС 330 кВ',
    ];
    const projectTitles = [...html.matchAll(/<article\b[^>]*\bproject-card\b[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/gi)].map((match) => match[1].trim());
    check(JSON.stringify(projectTitles) === JSON.stringify(expectedProjects), `${page}: нарушен порядок или состав объектов слайдера.`);
    const groupIds = sliderGroups.map((group) => attributeValue(group, 'id'));
    check(groupIds.every(Boolean) && new Set(groupIds).size === 3, `${page}: группы слайдера должны иметь уникальные id.`);
    check(sliderGroups.filter((group) => !hasAttribute(group, 'hidden') && attributeValue(group, 'aria-hidden') === 'false').length === 1, `${page}: изначально должна быть видима одна группа.`);
    check(sliderGroups.filter((group) => hasAttribute(group, 'hidden') && attributeValue(group, 'aria-hidden') === 'true').length === 2, `${page}: две начальные группы должны иметь согласованные hidden и aria-hidden.`);
    const previousButtons = openingTagsWithAttribute(html, 'data-projects-slider-previous');
    const nextButtons = openingTagsWithAttribute(html, 'data-projects-slider-next');
    const viewportId = attributeValue(sliderViewports[0] || '', 'id');
    check(previousButtons.length === 1 && hasAttribute(previousButtons[0], 'disabled') && attributeValue(previousButtons[0], 'aria-controls') === viewportId, `${page}: начальное состояние или aria-controls кнопки «Назад» некорректны.`);
    check(nextButtons.length === 1 && !hasAttribute(nextButtons[0], 'disabled') && attributeValue(nextButtons[0], 'aria-controls') === viewportId, `${page}: начальное состояние или aria-controls кнопки «Вперёд» некорректны.`);
    const sliderLiveRegions = openingTagsWithAttribute(html, 'aria-live').filter((tag) => attributeValue(tag, 'aria-live') === 'polite');
    check(sliderLiveRegions.length >= 2, `${page}: отсутствует polite live-регион счётчика слайдера.`);
  } else {
    for (const section of ['catalog-intro', 'catalog-categories']) {
      check(new RegExp(`<section\\b[^>]*data-section=["']${section}["'][^>]*>\\s*<div\\b[^>]*\\blayout-container\\b`, 'i').test(html), `${page}: секция ${section} не имеет непосредственного внутреннего layout-container.`);
    }
    const cardTitles = [...html.matchAll(/<article\b[^>]*\bcategory-card\b[^>]*>[\s\S]*?<h2>([^<]+)<\/h2>/gi)]
      .map((match) => match[1].trim());
    check(cardTitles.length === 12, `${page}: ожидалось 12 карточек Каталога, найдено ${cardTitles.length}.`);
    check(JSON.stringify(cardTitles) === JSON.stringify(expectedCards), `${page}: нарушен порядок или состав карточек Каталога.`);
  }
}

for (const path of await filesUnder(dist)) {
  const content = await checkUtf8File(path);
  if (path.endsWith('.js')) {
    check(content.includes('Раздел „') && content.includes('“ пока не входит в демонстрационный макет.'), `${path}: собранное сообщение demo-notice повреждено или отсутствует.`);
  }
}

if (failures.length) {
  console.error(`Проверка сборки завершилась с ошибками (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Проверка сборки пройдена: обе страницы, структура, контент и локальные относительные ресурсы корректны.');
