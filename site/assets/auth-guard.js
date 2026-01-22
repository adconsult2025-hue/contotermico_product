(async () => {
  const session = await window.TERMO_SUPABASE.getSession();
  if (!session) {
    window.location.href = '/login/';
  }
})();
