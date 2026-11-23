/** Whether the person turned the look off for this session with /lunar. */
export type LookIsOff = boolean

declare module 'claude-code' {
  interface PluginState {
    nightfall: { isOff: LookIsOff }
  }
}
