const pack = document.querySelector('.hero-art img');
const reverseLink = document.querySelector('.pack-side');
const front = { src: pack.getAttribute('src'), srcset: pack.getAttribute('srcset'), alt: pack.alt };
const flip = document.createElement('button');
flip.type = 'button';
flip.className = 'pack-side';
flip.textContent = reverseLink.textContent;
flip.setAttribute('aria-controls', 'pack-portrait');
pack.id = 'pack-portrait';

let reverse = false;
flip.addEventListener('click', () => {
  reverse = !reverse;
  if (reverse) {
    pack.removeAttribute('srcset');
    pack.src = reverseLink.href;
    pack.alt = 'Back label of the New Moon New Zealand abalone 425g tin';
  } else {
    pack.srcset = front.srcset;
    pack.src = front.src;
    pack.alt = front.alt;
  }
  flip.textContent = reverse ? 'View front label' : 'View back label';
});
reverseLink.replaceWith(flip);
