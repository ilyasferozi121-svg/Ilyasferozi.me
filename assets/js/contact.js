(() => {
  'use strict';
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const status = document.querySelector('#contact-status');
  const button = document.querySelector('#contact-submit');
  const label = button.querySelector('.submit-label');
  const name = form.elements.namedItem('name');
  const message = form.elements.namedItem('message');
  const controls = [...form.querySelectorAll('input:not([type="hidden"]), textarea:not([name="h-captcha-response"]), button')];
  let sending = false;

  function showStatus(text, state) {
    status.textContent = text;
    status.className = `form-status is-${state}`;
    status.hidden = false;
  }

  function setSending(busy) {
    sending = busy;
    form.setAttribute('aria-busy', String(busy));
    controls.forEach(control => { control.disabled = busy; });
    label.textContent = busy ? 'Sending…' : 'Send message';
  }

  function resetCaptcha() {
    const response = form.querySelector('[name="h-captcha-response"]');
    if (response) response.value = '';
    if (typeof window.hcaptcha?.reset === 'function') {
      try { window.hcaptcha.reset(); } catch { /* The token is already cleared if the widget is unavailable. */ }
    }
  }

  [name, message].forEach(field => field.addEventListener('input', () => field.setCustomValidity('')));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    name.setCustomValidity(name.value.trim() ? '' : 'Please enter your name.');
    message.setCustomValidity(message.value.trim() ? '' : 'Please enter your message.');
    if (!form.reportValidity()) return;
    if (form.elements.namedItem('botcheck').checked) return;
    const captchaResponse = form.querySelector('[name="h-captcha-response"]');
    if (!captchaResponse?.value.trim()) {
      showStatus('Please complete the human verification before sending. If it doesn’t load, refresh this page or email [private email removed] directly.', 'error');
      return;
    }

    const payload = Object.fromEntries(new FormData(form));
    payload.name = payload.name.trim();
    payload.email = payload.email.trim();
    payload.message = payload.message.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    setSending(true);
    showStatus('Sending your message…', 'pending');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) throw new Error('Message was not accepted.');
      form.reset();
      showStatus('Thank you—your message has been sent. I appreciate you getting in touch.', 'success');
    } catch {
      showStatus('We couldn’t confirm that your message was sent. Your text is still here—please complete the verification again and retry, or email [private email removed] directly.', 'error');
    } finally {
      clearTimeout(timeout);
      resetCaptcha();
      setSending(false);
    }
  });
  button.disabled = false;
})();
