import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Public Sans variable font (weights 100-900), same family the site ships.
// The woff2 lives in public/fonts (SIL Open Font License, see OFL.txt there).
export const fontsLoaded = loadFont({
  family: 'Public Sans',
  url: staticFile('fonts/public-sans-latin-wght-normal.woff2'),
  weight: '100 900',
  style: 'normal',
});
