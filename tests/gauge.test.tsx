import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'nightfall',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the gauge row draws above the message box', async ($, on) => {
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 64000, percent: 32 }, rateLimits: [] },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ type: 'Text', text: /of context used/ })

    expect(row?.text).toMatch(/% of context used/)
    await ui.unmount()
  }
})
