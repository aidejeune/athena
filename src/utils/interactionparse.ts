export class ParsingError extends Error {
  isParsing: true;

  constructor(message?: string) {
    super(message);
    this.isParsing = true;
  }
}
