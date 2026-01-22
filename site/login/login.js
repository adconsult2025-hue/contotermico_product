document.getElementById('btn-login')?.addEventListener('click', () => {
  if (!window.netlifyIdentity) return;
  window.netlifyIdentity.open();
});
