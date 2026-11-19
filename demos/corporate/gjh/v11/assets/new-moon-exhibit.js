export const newMoonExhibit = {
  'newmoon-heritage': {
    brand: 'New Moon', tagline: 'It began with abalone', kind: 'Brand history',
    image: 'assets/new-moon-nz-425g-front.jpg', alt: 'New Moon New Zealand Abalone 425g front packshot',
    story: 'Goh Joo Hin introduced New Moon as its first house brand in 1959, starting with abalone. The range later expanded to bird’s nest, chicken essence, rice, sauces and other groceries.',
    action: 'brand-story'
  },
  'newmoon-tasting': {
    brand: 'New Moon', tagline: 'Three ways to serve abalone', kind: 'Serving ideas',
    image: 'assets/new-moon-brand-cover.jpg', alt: 'New Moon serving presentation',
    story: 'New Moon shows New Zealand abalone served in steamboat, in soup and as part of a chilled dish.',
    action: 'brand-story'
  }
};

export function heritagePanel(photo) {
  const panel = document.createElement('canvas');
  panel.width = 512;
  panel.height = 512;
  const ink = panel.getContext('2d');
  ink.scale(2/3, 2/3);
  ink.fillStyle = '#fff7e6';
  ink.fillRect(0, 0, 768, 768);
  ink.fillStyle = '#233d79';
  ink.textAlign = 'center';
  ink.font = '600 52px Georgia, serif';
  ink.fillText('1959', 384, 105);
  ink.font = '700 63px system-ui, sans-serif';
  ink.fillText('IT BEGAN WITH', 384, 192);
  ink.fillText('ABALONE', 384, 260);
  ink.drawImage(photo, 192, 295, 384, 384);
  ink.fillStyle = '#233d79';
  ink.fillRect(0, 688, 768, 80);
  ink.fillStyle = '#fff7e6';
  ink.font = '600 28px system-ui, sans-serif';
  ink.fillText('ABOUT NEW MOON', 384, 738);
  return panel;
}
