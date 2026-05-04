function handleSubmit(event) {
  event.preventDefault();
  const status = document.getElementById('form-status');
  status.textContent = 'Thanks! Your message has been received. We will reply within one business day.';
  event.target.reset();
}
