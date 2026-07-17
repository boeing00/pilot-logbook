/**
 * Polyfill for `Promise.withResolvers` (ES2024). pdf.js and tesseract.js rely
 * on it, but it is only available in newer browsers (Chrome 119+, Safari 17.4+,
 * Firefox 121+). This keeps the app working on slightly older browsers.
 */
type WithResolvers = <T>() => {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const target = Promise as unknown as { withResolvers?: WithResolvers }

if (typeof target.withResolvers !== 'function') {
  target.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}
