const who = document.getElementById('who');

async function loadUser() {
  if (!window.getSession) return;
  const { data } = await window.getSession();
  if (who) {
    who.textContent = data?.session?.user?.email || '';
  }
}

document.getElementById('logout')?.addEventListener('click', async () => {
  await window.signOut?.();
  window.location.href = '/login/';
});

loadUser();
