/* CT UI – filled state per input/select/textarea
   Aggiunge/rimuove la classe .is-filled sul contenitore .ct-field
*/
(function(){
  function isFilled(el){
    if(!el) return false;
    const v = (el.value ?? '').toString().trim();
    return v.length > 0;
  }
  function refreshField(el){
    const field = el.closest('.ct-field');
    if(!field) return;
    field.classList.toggle('is-filled', isFilled(el));
  }
  function bind(root){
    const controls = root.querySelectorAll('.ct-field input, .ct-field select, .ct-field textarea');
    controls.forEach(el => {
      refreshField(el);
      el.addEventListener('input', () => refreshField(el));
      el.addEventListener('change', () => refreshField(el));
      el.addEventListener('blur', () => refreshField(el));
    });
  }
  document.addEventListener('DOMContentLoaded', () => bind(document));
})();
