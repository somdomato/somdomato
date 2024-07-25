// import { reactive } from 'vue'
// import { io, Socket } from 'socket.io-client'

// export const state = reactive({
//   connected: false,
//   fooEvents: [],
//   barEvents: []
// })

// // "undefined" means the URL will be computed from the `window.location` object
// const URL = import.meta.env.NODE_ENV === "production" ? undefined : 'ws://localhost:3333'

// export const socket = io(URL as string)

// // export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL as string)

// socket.on("connect", () => {
//   state.connected = true
// })

// socket.on("disconnect", () => {
//   state.connected = false
// })

// // socket.on("foo", (...args: string[]) => {
// //   state.fooEvents.push(args);
// // })

// // socket.on("bar", (...args) => {
// //   state.barEvents.push(args);
// // });