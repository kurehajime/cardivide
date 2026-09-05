import { describe, expect, it } from 'vitest'
import { CARD_DEFINITION_IDS, CARD_LIST } from './cards'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('card definition ids', () => {
  it('uses one unique UUID v4 for every card definition', () => {
    const registeredIds = Object.values(CARD_DEFINITION_IDS)
    const actualIds = CARD_LIST.map(({ definitionId }) => definitionId)

    expect(registeredIds).toHaveLength(39)
    expect(new Set(registeredIds).size).toBe(registeredIds.length)
    expect(registeredIds.every((definitionId) => UUID_V4_PATTERN.test(definitionId))).toBe(true)
    expect(actualIds.toSorted()).toEqual(registeredIds.toSorted())
  })
})
