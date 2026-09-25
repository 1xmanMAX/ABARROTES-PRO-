/** Error de regla de negocio: el mensaje está listo para mostrarse al usuario. */
export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
