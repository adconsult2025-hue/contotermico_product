const who = document.getElementById('who');

async function loadUser() {
  if (!window.TERMO_SUPABASE) return;
  const session = await window.TERMO_SUPABASE.getSession();
  if (who) {
    who.textContent = session?.user?.email || '';
  }
}

document.getElementById('logout')?.addEventListener('click', async () => {
  await window.TERMO_SUPABASE.signOut();
  window.location.href = '/login/';
});

loadUser();
