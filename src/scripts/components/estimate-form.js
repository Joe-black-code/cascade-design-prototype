const initializedForms = new WeakSet();
const SUBMIT_DELAY = 700;
const PHONE_PATTERN = /^[+\d\s()-]+$/;

function initEstimateForm(form) {
  if (initializedForms.has(form)) return;

  const fields = {
    name: form.elements.namedItem('name'),
    phone: form.elements.namedItem('phone'),
    consent: form.elements.namedItem('consent'),
  };
  const fileInput = form.elements.namedItem('brief');
  const fileName = form.querySelector('[data-file-name]');
  const fileClear = form.querySelector('[data-file-clear]');
  const fieldsRegion = form.querySelector('[data-estimate-form-fields]');
  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-estimate-submit]');
  const success = form.querySelector('[data-estimate-success]');
  const retryButton = form.querySelector('[data-estimate-retry]');

  if (Object.values(fields).some((field) => !field) || !fileInput || !fileName || !fileClear || !fieldsRegion || !status || !submitButton || !success || !retryButton) return;

  let submitTimer = null;

  function errorFor(name) {
    return form.querySelector(`[data-field-error="${name}"]`);
  }

  function isValid(name) {
    if (name === 'name') return fields.name.value.trim().length > 0;
    if (name === 'consent') return fields.consent.checked;
    const value = fields.phone.value.trim();
    const digitCount = (value.match(/\d/g) || []).length;
    return PHONE_PATTERN.test(value) && digitCount >= 7 && digitCount <= 15;
  }

  function setFieldError(name, hasError) {
    const field = fields[name];
    const error = errorFor(name);
    if (hasError) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    error.hidden = !hasError;
  }

  function clearTimer() {
    if (submitTimer === null) return;
    window.clearTimeout(submitTimer);
    submitTimer = null;
  }

  function clearErrors() {
    Object.keys(fields).forEach((name) => setFieldError(name, false));
    status.hidden = true;
    status.textContent = '';
  }

  function resetForm({ focusFirst = true } = {}) {
    clearTimer();
    form.reset();
    clearErrors();
    fileName.textContent = 'Файл не выбран.';
    fileClear.hidden = true;
    fieldsRegion.hidden = false;
    success.hidden = true;
    submitButton.disabled = false;
    form.dataset.formState = 'idle';
    if (focusFirst) fields.name.focus();
  }

  function validateField(name) {
    const valid = isValid(name);
    setFieldError(name, !valid);
    return valid;
  }

  Object.entries(fields).forEach(([name, field]) => {
    const eventName = field.type === 'checkbox' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      if (isValid(name)) setFieldError(name, false);
    });
  });

  fileInput.addEventListener('change', () => {
    fileName.textContent = fileInput.files[0]?.name || 'Файл не выбран.';
    fileClear.hidden = fileInput.files.length === 0;
  });

  fileClear.addEventListener('click', () => {
    fileInput.value = '';
    fileName.textContent = 'Файл не выбран.';
    fileClear.hidden = true;
    fileInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.dataset.formState === 'submitting') return;

    const invalidNames = Object.keys(fields).filter((name) => !validateField(name));
    if (invalidNames.length > 0) {
      form.dataset.formState = 'invalid';
      status.textContent = 'Проверьте отмеченные поля формы.';
      status.hidden = false;
      fields[invalidNames[0]].focus();
      return;
    }

    clearErrors();
    form.dataset.formState = 'submitting';
    submitButton.disabled = true;
    status.textContent = 'Отправляем запрос…';
    status.hidden = false;

    submitTimer = window.setTimeout(() => {
      submitTimer = null;
      form.dataset.formState = 'success';
      fieldsRegion.hidden = true;
      success.hidden = false;
      if (!form.closest('[data-modal][hidden]')) success.focus();
    }, SUBMIT_DELAY);
  });

  retryButton.addEventListener('click', () => resetForm());
  form.closest('[data-modal]')?.addEventListener('cascade:modal-opened', () => {
    if (form.dataset.formState === 'success') resetForm({ focusFirst: false });
  });

  initializedForms.add(form);
}

export function initEstimateForms() {
  document.querySelectorAll('[data-estimate-form]').forEach(initEstimateForm);
}
