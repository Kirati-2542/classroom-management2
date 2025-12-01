// Polyfill for node:stream/web
// Using native browser streams
export const ReadableStream = window.ReadableStream;
export const WritableStream = window.WritableStream;
export const TransformStream = window.TransformStream;
export const TextEncoderStream = window.TextEncoderStream;
export const TextDecoderStream = window.TextDecoderStream;
