// Keep this check identical to the pre-module SW_GUARD in scripts/build_pomelo_v8.py.
export function hasUnsavedInput() {
  if (document.querySelector('[data-dirty="true"]')) return true;
  return Array.from(document.querySelectorAll('form input, form textarea, form select')).some(function (field) {
    if (field.type === 'checkbox' || field.type === 'radio') return field.checked !== field.defaultChecked;
    if (field.tagName === 'SELECT') {
      var options = Array.from(field.options);
      if (field.multiple) return options.some(function (option) { return option.selected !== option.defaultSelected; });
      var initial = -1;
      options.forEach(function (option, index) { if (option.defaultSelected) initial = index; });
      if (initial < 0) initial = options.findIndex(function (option) {
        return !option.disabled && !(option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled);
      });
      return field.selectedIndex !== initial;
    }
    return field.value !== field.defaultValue;
  });
}
