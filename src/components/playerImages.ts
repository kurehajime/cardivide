import redTotalAssault from '../assets/players/060d14bb-5e7c-4150-ab19-11168b56c622.webp'
import redBlueSkirmish from '../assets/players/17937130-b84a-45da-a9a2-1d5179ea2303.webp'
import blueGreenIntercept from '../assets/players/4c513ec7-edc2-4a5a-b965-52a770260cc7.webp'
import greenFortressCycle from '../assets/players/61d4a505-c40a-47a9-b012-83d4dbe54689.webp'
import greenRedFrontline from '../assets/players/6a6d5a62-6c24-4a09-b9b7-ae4dea011be6.webp'
import blueMobileIntercept from '../assets/players/7a07f81f-d165-493a-ae8f-92f66b8a1c5a.webp'
import { THEME_DECK_IDS, type ThemeDeckId } from '../game'

export const PLAYER_IMAGE_BY_DECK_ID = {
  [THEME_DECK_IDS.RED_BLUE_SKIRMISH]: redBlueSkirmish,
  [THEME_DECK_IDS.BLUE_GREEN_INTERCEPT]: blueGreenIntercept,
  [THEME_DECK_IDS.GREEN_RED_FRONTLINE]: greenRedFrontline,
  [THEME_DECK_IDS.RED_TOTAL_ASSAULT]: redTotalAssault,
  [THEME_DECK_IDS.BLUE_MOBILE_INTERCEPT]: blueMobileIntercept,
  [THEME_DECK_IDS.GREEN_FORTRESS_CYCLE]: greenFortressCycle,
} satisfies Record<ThemeDeckId, string>
