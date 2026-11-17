const form = document.getElementById('brief-form');
const result = document.getElementById('brief-result');
const brief = document.getElementById('brief-text');
const status = document.getElementById('brief-status');
const topics = {
  assortment: 'Which product ranges would you suggest for a retail assortment?',
  availability: 'Which lines are currently available to retail buyers, and how can I check lead times?',
  partnership: 'Who can I speak with about a retail partnership and the next steps for a buyer?'
};

form.addEventListener('submit', event => {
  event.preventDefault();
  const category = form.querySelector('input[name="category"]:checked').labels[0].textContent.trim();
  brief.value = 'Hello Goh Joo Hin, I am a retail buyer interested in ' + category.toLowerCase() + '. ' + topics[form.elements.topic.value];
  result.hidden = false;
  brief.focus();
  status.textContent = 'Your brief is ready to copy.';
});

form.addEventListener('change', () => {
  if (result.hidden) return;
  result.hidden = true;
  brief.value = '';
  status.textContent = 'Your choices have changed. Prepare your brief again.';
});

document.getElementById('select-brief').addEventListener('click', () => {
  brief.focus();
  brief.select();
  status.textContent = 'Brief selected. Use your device’s copy command.';
});

document.getElementById('brief-app').hidden = false;
document.getElementById('brief-fallback').hidden = true;
