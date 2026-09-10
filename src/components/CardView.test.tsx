import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CARD_DEFINITION_IDS, CARD_LIST } from '../game/cards'
import CardView from './CardView'

const foilIds = [
  CARD_DEFINITION_IDS.EXHAUSTED_VOLCANO_DRAGON,
  CARD_DEFINITION_IDS.DEEP_TIDE_INTERCEPTOR,
  CARD_DEFINITION_IDS.FOREST_CAGE_BEASTMASTER,
  CARD_DEFINITION_IDS.LIFE_CYCLE,
  CARD_DEFINITION_IDS.MEPHISTOPHELES,
]

describe('card foil', () => {
  it('matches the five foil cards specified in the design', () => {
    expect(CARD_LIST.filter((card) => card.foil).map((card) => card.definitionId).sort())
      .toEqual([...foilIds].sort())
  })

  it.each(CARD_LIST)('keeps $name artwork and only adds foil to designated fronts', (card) => {
    const html = renderToStaticMarkup(<CardView card={card} />)
    expect(html).toContain('card-face-art-image')
    expect(html).toContain('card-surface')
    expect(html.includes('card-reflection')).toBe(card.foil !== true)
    expect(html.includes('card-foil-rainbow')).toBe(card.foil === true)
    expect(html.includes('card-foil-glare')).toBe(card.foil === true)
  })

  it('never reveals foil on hidden cards or empty slots', () => {
    const card = CARD_LIST.find((candidate) => candidate.foil)!
    expect(renderToStaticMarkup(<CardView card={card} faceDown />)).not.toContain('card-foil')
    expect(renderToStaticMarkup(<CardView card={null} />)).not.toContain('card-foil')
    expect(renderToStaticMarkup(<CardView card={card} faceDown />)).not.toContain('card-surface')
    expect(renderToStaticMarkup(<CardView card={null} />)).not.toContain('card-reflection')
  })
})
