async function handleSubmit(event) {
  event.preventDefault();
  const status = document.getElementById('form-status');
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const contactEndpoint = window.location.protocol === 'file:'
    ? 'http://localhost:5500/api/contact'
    : '/api/contact';
  const formData = new FormData(form);
  const name = formData.get('name');
  const email = formData.get('email');
  const message = formData.get('message');

  status.textContent = 'Sending your message...';
  submitButton.disabled = true;

  try {
    const response = await fetch(contactEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, message }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Something went wrong. Please try again.');
    }

    status.textContent = 'Thanks. Your message has been sent.';
    form.reset();
  } catch (error) {
    status.textContent = error.message === 'Failed to fetch'
      ? 'Cannot reach the message server. Start it with node server.js, then open http://localhost:5500.'
      : error.message;
  } finally {
    submitButton.disabled = false;
  }
}
