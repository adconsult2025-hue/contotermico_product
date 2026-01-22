const u = window.netlifyIdentity?.currentUser?.();
const who = document.getElementById('who');
if (who) {
  who.textContent = u?.email || '';
}

document.getElementById('logout')?.addEventListener('click', () => {
  window.netlifyIdentity.logout();
});
