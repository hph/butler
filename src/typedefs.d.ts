type NgrokCallback = (err: any, address: string) => void;

declare module 'ngrok' {
  export function connect (port: number, callback: NgrokCallback): void;
}

declare module 'mime-types' {
  export function contentType (path: string): string | false;
}
