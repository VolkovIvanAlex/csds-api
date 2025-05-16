export class Exception extends Error {
  constructor(
    message: string,
    public readonly cause: Error | string = 'unknown',
  ) {
    super(message);
    this.name = 'Exception';
  }
}

export class AuthException extends Exception {
  constructor(message: string, cause?: Error | string) {
    super(message, cause);
    this.name = 'AuthException';
  }
}

export class GoogleAuthException extends AuthException {
  constructor(message: string, cause?: Error | string) {
    super(message, cause);
    this.name = 'GoogleAuthException';
  }
}

export class ServerException extends Exception {
  constructor(message: string, cause?: Error | string) {
    super(message, cause);
    this.name = 'ServerException';
  }
}
