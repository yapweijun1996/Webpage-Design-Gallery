// Exhibit order as seen from the cookline's standing point, facing the hood.
const cooklineSamples = [
  {
    position:'Left', name:'Oyster Sauce 510 g',
    story:'The regular sauce lists oyster extract. The left bottle is an unprinted shape study. The image shows a prepared MILI dish.',
    source:'https://www.gjheshop.com/product/mili-oyster-sauce-510g/'
  },
  {
    position:'Centre', name:'Vegetarian Oyster Sauce 510 g',
    story:'The vegetarian sauce lists mushroom extract. The centre bottle is an unprinted shape study. The image shows a prepared MILI dish.',
    source:'https://www.gjheshop.com/product/mili-vegetarian-oyster-sauce-510g/'
  },
  {
    position:'Right', name:'Vegetarian Mock Duck 280 g',
    story:'The right-hand tin is an unprinted study of the tall can and its rolled rims. Its dimensions are estimated. The image shows a prepared MILI dish.',
    source:'https://www.gjheshop.com/product/mili-vegetarian-mock-duck-280g/'
  }
];

export const miliCooklineLabels = cooklineSamples.map(sample => `${sample.position} · ${sample.name}`);

export const miliExhibit = {
  'mili-sauce-story': {
    brand:'MILI', tagline:'Two sauces at the cookline', kind:'Pantry exhibit',
    image:'assets/mili-brand-cover.jpg',
    alt:'Official MILI brand cover showing a prepared meal',
    story:'Goh Joo Hin introduced its MILI house brand in 1981. At the cookline, compare two 510 g sauces: MILI Oyster Sauce lists oyster extract, while Vegetarian Oyster Sauce lists mushroom extract. MILI also lists a 280 g Vegetarian Mock Duck tin in its pantry range.',
    source:'https://www.gjheshop.com/product-category/sauce/',
    sourceLabel:'View the official sauce catalogue',
    samples:cooklineSamples, action:'brand-story'
  }
};
