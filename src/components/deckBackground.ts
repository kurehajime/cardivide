import type { CSSProperties } from 'react'
import { THEME_DECK_IDS, type ThemeDeckId } from '../game'

// Fixed gradgen radial exports. No generator or network request runs in the game.
const DECK_BACKGROUNDS = {
  // https://gradgen.lolipop-now.app/?seed=1902398277&method=radial&n=12&palette=random (index 0)
  [THEME_DECK_IDS.RED_TOTAL_ASSAULT]: {
    color: '#f121cd',
    image: `
      radial-gradient(ellipse 89% 68% at 14% 65%, #9ffad9, transparent 70%),
      radial-gradient(ellipse 56% 57% at -2% 38%, #ed138c, transparent 70%),
      radial-gradient(ellipse 49% 75% at 30% 44%, #f121cd, transparent 70%),
      radial-gradient(ellipse 59% 67% at 2% 43%, #ed138c, transparent 70%),
      radial-gradient(ellipse 89% 88% at 45% 87%, #f121cd, transparent 70%),
      radial-gradient(ellipse 70% 89% at -3% 55%, #ed138c, transparent 70%),
      radial-gradient(ellipse 79% 85% at 70% 66%, #15cc12, transparent 70%),
      radial-gradient(ellipse 78% 79% at 46% 14%, #9ffad9, transparent 70%),
      radial-gradient(ellipse 50% 64% at 32% 46%, #9ffad9, transparent 70%),
      radial-gradient(ellipse 45% 63% at 70% 63%, #f121cd, transparent 70%),
      radial-gradient(ellipse 79% 66% at 66% 76%, #15cc12, transparent 70%),
      radial-gradient(ellipse 78% 79% at -31% 22%, #15cc12, transparent 70%)
    `,
  },
  // https://gradgen.lolipop-now.app/?seed=1902398277&method=radial&n=12&palette=random (index 10)
  [THEME_DECK_IDS.GREEN_FORTRESS_CYCLE]: {
    color: '#16e762',
    image: `
      radial-gradient(ellipse 77% 76% at -8% 29%, #16e762, transparent 70%),
      radial-gradient(ellipse 80% 88% at -36% 63%, #16e762, transparent 70%),
      radial-gradient(ellipse 85% 68% at 34% 15%, #51f61d, transparent 70%),
      radial-gradient(ellipse 88% 54% at -16% 68%, #aa13dc, transparent 70%),
      radial-gradient(ellipse 54% 87% at 25% 55%, #ef869f, transparent 70%),
      radial-gradient(ellipse 58% 75% at 73% 56%, #ef869f, transparent 70%),
      radial-gradient(ellipse 65% 64% at 13% 85%, #51f61d, transparent 70%),
      radial-gradient(ellipse 45% 66% at 16% 32%, #51f61d, transparent 70%),
      radial-gradient(ellipse 72% 73% at 34% 18%, #aa13dc, transparent 70%),
      radial-gradient(ellipse 81% 49% at 22% 81%, #ef869f, transparent 70%),
      radial-gradient(ellipse 85% 72% at -23% 87%, #aa13dc, transparent 70%),
      radial-gradient(ellipse 61% 69% at 59% 53%, #16e762, transparent 70%)
    `,
  },
  // https://gradgen.lolipop-now.app/?seed=1902398277&method=radial&n=12&palette=random (index 5)
  [THEME_DECK_IDS.BLUE_MOBILE_INTERCEPT]: {
    color: '#16a8f9',
    image: `
      radial-gradient(ellipse 71% 82% at -16% 73%, #0fee23, transparent 70%),
      radial-gradient(ellipse 89% 46% at -19% 42%, #e51b9a, transparent 70%),
      radial-gradient(ellipse 45% 88% at 9% 66%, #fbb3ac, transparent 70%),
      radial-gradient(ellipse 49% 66% at 54% 22%, #16a8f9, transparent 70%),
      radial-gradient(ellipse 60% 56% at -11% 64%, #0fee23, transparent 70%),
      radial-gradient(ellipse 63% 79% at 46% 51%, #0fee23, transparent 70%),
      radial-gradient(ellipse 50% 56% at 22% 65%, #e51b9a, transparent 70%),
      radial-gradient(ellipse 85% 79% at -20% 70%, #fbb3ac, transparent 70%),
      radial-gradient(ellipse 66% 64% at 15% 46%, #16a8f9, transparent 70%),
      radial-gradient(ellipse 46% 52% at 16% 14%, #fbb3ac, transparent 70%),
      radial-gradient(ellipse 85% 54% at 23% 24%, #16a8f9, transparent 70%),
      radial-gradient(ellipse 76% 67% at 66% 13%, #e51b9a, transparent 70%)
    `,
  },
  // https://gradgen.lolipop-now.app/?seed=1902398277&method=radial&n=12&palette=random (index 4)
  [THEME_DECK_IDS.RED_BLUE_SKIRMISH]: {
    color: '#e92184',
    image: `
      radial-gradient(ellipse 76% 51% at 76% 50%, #c4fb0b, transparent 70%),
      radial-gradient(ellipse 89% 69% at 18% 90%, #2fe6dc, transparent 70%),
      radial-gradient(ellipse 59% 74% at 13% 77%, #abc7f4, transparent 70%),
      radial-gradient(ellipse 86% 67% at 27% 13%, #2fe6dc, transparent 70%),
      radial-gradient(ellipse 80% 50% at 50% 18%, #abc7f4, transparent 70%),
      radial-gradient(ellipse 52% 87% at 13% 56%, #e92184, transparent 70%),
      radial-gradient(ellipse 67% 65% at 37% 32%, #2fe6dc, transparent 70%),
      radial-gradient(ellipse 59% 66% at 45% 27%, #c4fb0b, transparent 70%),
      radial-gradient(ellipse 66% 74% at 37% 63%, #abc7f4, transparent 70%),
      radial-gradient(ellipse 57% 52% at 11% 45%, #e92184, transparent 70%),
      radial-gradient(ellipse 77% 70% at -10% 67%, #e92184, transparent 70%),
      radial-gradient(ellipse 66% 61% at 35% 11%, #c4fb0b, transparent 70%)
    `,
  },
  // https://gradgen.lolipop-now.app/?seed=1650025380&method=radial&n=12&palette=random (index 4)
  [THEME_DECK_IDS.GREEN_RED_FRONTLINE]: {
    color: '#f393af',
    image: `
      radial-gradient(ellipse 51% 79% at 33% 55%, #7de136, transparent 70%),
      radial-gradient(ellipse 79% 89% at 55% 15%, #ae25f0, transparent 70%),
      radial-gradient(ellipse 55% 66% at 36% 85%, #13e923, transparent 70%),
      radial-gradient(ellipse 86% 51% at 20% 31%, #7de136, transparent 70%),
      radial-gradient(ellipse 48% 75% at 11% 34%, #13e923, transparent 70%),
      radial-gradient(ellipse 69% 56% at 47% 89%, #f393af, transparent 70%),
      radial-gradient(ellipse 76% 57% at 19% 10%, #13e923, transparent 70%),
      radial-gradient(ellipse 58% 54% at 33% 42%, #ae25f0, transparent 70%),
      radial-gradient(ellipse 86% 50% at 4% 67%, #f393af, transparent 70%),
      radial-gradient(ellipse 81% 87% at 15% 39%, #ae25f0, transparent 70%),
      radial-gradient(ellipse 67% 76% at 55% 49%, #f393af, transparent 70%),
      radial-gradient(ellipse 58% 63% at 33% 76%, #7de136, transparent 70%)
    `,
  },
  // https://gradgen.lolipop-now.app/?seed=1650025380&method=radial&n=12&palette=random (index 1)
  [THEME_DECK_IDS.BLUE_GREEN_INTERCEPT]: {
    color: '#06e0f4',
    image: `
      radial-gradient(ellipse 51% 51% at 45% 45%, #06e0f4, transparent 70%),
      radial-gradient(ellipse 61% 58% at 25% 75%, #2feb88, transparent 70%),
      radial-gradient(ellipse 87% 76% at -4% 67%, #eca5be, transparent 70%),
      radial-gradient(ellipse 53% 45% at 67% 11%, #2feb88, transparent 70%),
      radial-gradient(ellipse 64% 77% at 59% 52%, #06e0f4, transparent 70%),
      radial-gradient(ellipse 88% 86% at 11% 28%, #eca5be, transparent 70%),
      radial-gradient(ellipse 69% 75% at 51% 37%, #f81af8, transparent 70%),
      radial-gradient(ellipse 46% 79% at 47% 36%, #f81af8, transparent 70%),
      radial-gradient(ellipse 48% 64% at 44% 72%, #06e0f4, transparent 70%),
      radial-gradient(ellipse 46% 48% at 55% 83%, #2feb88, transparent 70%),
      radial-gradient(ellipse 65% 70% at 33% 38%, #eca5be, transparent 70%),
      radial-gradient(ellipse 53% 62% at 55% 80%, #f81af8, transparent 70%)
    `,
  },
} satisfies Record<ThemeDeckId, { color: string; image: string }>

export const getDeckBackgroundStyle = (deckId: ThemeDeckId): CSSProperties => {
  const background = DECK_BACKGROUNDS[deckId]
  return {
    '--table-background-color': background.color,
    '--table-background-image': background.image,
  } as CSSProperties
}
