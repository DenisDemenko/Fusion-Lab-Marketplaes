import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('romanises Ukrainian titles into readable URLs', () => {
    expect(slugify('Курс Fusion для мебелярів')).toBe(
      'kurs-fusion-dlia-mebeliariv',
    );
    expect(slugify('ЧПУ-обробка у Fusion 360')).toBe(
      'chpu-obrobka-u-fusion-360',
    );
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(slugify('  Міні-курс: 3D-друк керамікою!  ')).toBe(
      'mini-kurs-3d-druk-keramikoiu',
    );
  });

  it('never returns an empty slug', () => {
    // Two listings titled "!!!" would collide on an empty slug, so a
    // title that transliterates away still gets something unique.
    expect(slugify('!!! ???')).toMatch(/^item-/);
  });

  it('adds a numeric suffix until the slug is free', async () => {
    const taken = new Set(['kurs-fusion', 'kurs-fusion-2']);

    await expect(
      uniqueSlug('Курс Fusion', (candidate) =>
        Promise.resolve(taken.has(candidate)),
      ),
    ).resolves.toBe('kurs-fusion-3');
  });
});
