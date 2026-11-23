import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, ThemeStyle } from 'claude-code'

import { makeColors } from './make-colors.js'
import { moonPhase, moonPhaseName, scene } from './scene.js'

// Midnight navy with gold in dark mode, and moonstone gray-blue in light mode.
const { theme, problems } = makeColors({
  label: 'Lunar',
  roles: { accent: '#c8a040', danger: '#dc4c4c', success: '#3aa38a', warning: '#dd7a2a', pro: '#8f7be0' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e6e9f2',
        'surface-1': '#eef0f7',
        'surface-2': '#f6f7fb',
        'text-primary': '#161b30',
        'text-secondary': '#3a4260',
        'text-muted': '#555d7c',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b1022',
        'surface-1': '#111730',
        'surface-2': '#171e3c',
        'surface-3': '#1d2547',
        'text-primary': '#e8ecf8',
        'text-secondary': '#bcc5de',
        'text-muted': '#98a2c2',
      },
    },
  },
})

const SCENE_NAME = 'lunar-sky'

const STYLE: ThemeStyle = {
  Text: { fontSize: 15, lineHeight: 24 },
  Heading: { fontFamily: ['serif'], fontWeight: 'semibold', letterSpacing: 0.4 },
  UserMessage: {
    color: '#f6efd2',
    backgroundColor: '#2a2f74',
    fill: { gradient: { angle: 135, stops: ['#1c2a63', '#3b3486'] } },
    borderColor: '#c9a961',
    borderWidth: 1,
    radius: [18, 18, 4, 18],
    paddingX: 16,
    paddingY: 10,
    shadow: { y: 4, blur: 14, color: '#0a0f2a66' },
  },
  ToolUse: { backgroundColor: 'surface-1', borderColor: 'border', radius: 10, paddingX: 10 },
}

const BASE: ThemeSetArgs = { colors: theme, backdrop: { scene: SCENE_NAME } }
const LOOK: ThemeSetArgs = { ...BASE, style: STYLE }

// The context gauge: a row of ten stars above the message box, one lit for each tenth of the
// context window in use, with the percentage beside them.
const GAUGE_STARS = 10

async function contextPercent($: EngineInterface): Promise<number> {
  return Math.max(0, Math.min(100, Math.round((await $.session.usage()).context.percent ?? 0)))
}

// The percentage the gauge last drew, so it is drawn again only when the figure changes.
let drawnPercent = -1

async function redrawIfContextChanged($: EngineInterface): Promise<void> {
  if ((await contextPercent($)) !== drawnPercent) {
    $.ui.invalidate('ui.render')
  }
}

// A redraw of the gauge asks for the backdrop again too. Handing back the same drawing keeps
// the app from swapping the scene, which would show as a blink, so the scene is made anew
// only when it is this old: often enough to keep the moon's phase current.
const SCENE_MAX_AGE_MS = 3 * 60 * 60 * 1000
let drawnScene: { at: number; source: string; alt: string } | undefined

const COMMAND = 'lunar'

// Held by the session, so the choice survives a reload of the mod and ends with the session.
const isOff = atom({ plugin: 'nightfall', key: 'isOff' } as const, false)

async function applyLook($: EngineInterface): Promise<void> {
  try {
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.log(`lunar: ${set.reason}`)
    }
  } catch (error) {
    // A build that refuses the style refuses the whole set, so set the rest alone.
    $.ui.log(`lunar: ${String(error)}`)
    await $.theme.set(BASE)
  }
}

export const register: Register = on => {
  on('command.run', { command: COMMAND }, async ($, e) => {
    const word = e.args.trim().toLowerCase()

    if (word !== '' && word !== 'on' && word !== 'off') {
      return { text: 'Use /lunar to switch the look, or /lunar off and /lunar on.' }
    }

    const turnOff = word === '' ? !(await read($, isOff)) : word === 'off'

    await update($, isOff, () => turnOff)

    if (turnOff) {
      await $.theme.clear()

      return { text: 'The lunar look is off for this session. /lunar on brings it back.' }
    }

    await applyLook($)

    return { text: 'The lunar look is on.' }
  })

  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    await $.command.register({
      name: COMMAND,
      description: 'Turn the lunar look off or on for this session: /lunar, /lunar off, /lunar on',
    })

    if (!(await read($, isOff))) {
      await applyLook($)
    }

    // The stars move by themselves, so the scene is drawn anew only to keep the moon current.
    $.clock.every(SCENE_MAX_AGE_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  // The context in use changes when a turn ends and when the conversation is compacted.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    await redrawIfContextChanged($)

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)

    // The new figure arrives with the next response, so the next turn's end picks it up.
    await redrawIfContextChanged($)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isOff))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const percent = await contextPercent($)
    const lit = Math.min(GAUGE_STARS, Math.floor((percent / 100) * GAUGE_STARS))
    // The last two stars light in the error color, so a nearly full context stands out.
    const calm = Math.min(lit, GAUGE_STARS - 2)

    drawnPercent = percent

    return (
      <Box>
        <Text color="warning">{'✦ '.repeat(calm)}</Text>
        <Text color="error">{'✦ '.repeat(lit - calm)}</Text>
        <Text dimColor>{'✧ '.repeat(GAUGE_STARS - lit)}</Text>
        <Text dimColor tabular>
          {' '}
          {percent}% of context used
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const now = Date.now()

    if (drawnScene === undefined || now - drawnScene.at >= SCENE_MAX_AGE_MS - 60_000) {
      drawnScene = {
        at: now,
        source: scene(now),
        alt: `The moon as it is tonight, a ${moonPhaseName(moonPhase(now))}, over the real northern stars and constellations`,
      }
    }

    return <Svg source={drawnScene.source} alt={drawnScene.alt} isInteractive />
  })
}
