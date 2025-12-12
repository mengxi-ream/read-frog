export class ConfigVersionTooNewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigVersionTooNewError'
  }
}
