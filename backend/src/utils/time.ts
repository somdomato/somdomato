export function timeDiff(time1: number, time2: number) {
  let delta = Math.abs(time2 - time1) / 1000
  const days = Math.floor(delta / 86400)
  delta -= days * 86400

  const hours = Math.floor(delta / 3600) % 24
  delta -= hours * 3600

  const minutes = Math.floor(delta / 60) % 60
  delta -= minutes * 60

  const seconds = delta % 60 // in theory the modulus is not required

  return `${days}d, ${hours}h, ${minutes}m, ${seconds.toFixed(3)}s`
}