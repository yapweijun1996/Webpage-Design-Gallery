// Keep this check identical to the pre-module SW_GUARD in scripts/build_pomelo_v8.py.
// Track controls inside and outside forms. Use data-unsaved="ignore" only for
// automatically persisted and restored state; data-unsaved="track" overrides it.
export function hasUnsavedInput() {
  return Array.from(document.querySelectorAll('[data-dirty="true"], input, textarea, select')).some(function (field) {
    var rule = field.closest('[data-unsaved]');
    if (rule && rule.getAttribute('data-unsaved') === 'ignore') return false;
    if (field.getAttribute('data-dirty') === 'true') return true;
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
