declare module 'ngrok' {
  export function connect (port: number, callback: Function): void;
}

declare module 'mime-types' {
  export function contentType (path: string): string;
}
