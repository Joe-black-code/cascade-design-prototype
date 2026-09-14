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
