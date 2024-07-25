import { onMounted, onUnmounted } from 'vue'

export function useWebSocket() {
  const socket = new WebSocket(import.meta.env.VITE_WS_URL)

  // https://stackoverflow.com/a/23176223/1844007
  function connect() {
    socket.onopen = (e) => {
      // console.clear()
      console.info('WebSockets: Client connected', e)
      socket.send(JSON.stringify({ message: 'Client connected'} ))
    }

    // socket.onmessage = function(e) { console.log('Message:', e.data) }

    socket.onclose = (err) => {
      console.info('WebSockets: Socket is closed. Reconnect will be attempted in 1 second.', err.reason)
      setTimeout(connect, 1000)
    }

    socket.onerror = (err) => {
      console.error('Socket encountered error and is closing: ', JSON.stringify(err))
      socket.close()
    }
  }

  onMounted(connect)

  onUnmounted(() => {
    socket.onopen = (event) => {
      console.info('Closing socket, unmounting composable...')
      socket.close()
    }
  })

  return { socket, connect }
}