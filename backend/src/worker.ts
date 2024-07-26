// declare var self: Worker;
// prevents TS errors
declare var self: Window & typeof globalThis

self.onmessage = (event: MessageEvent) => {
  console.log(event.data)
  postMessage("world")
}