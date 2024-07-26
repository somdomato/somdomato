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

export function timeDiffMinutes(dateStr: string) {
  const now = Math.floor((+new Date()) / 1000)
  const dateStrUTC = new Date(`${dateStr}Z`) // Adicionando 'Z' no final para garantir que seja interpretada como UTC
  const past = Math.floor(new Date(dateStrUTC).getTime() / 1000)
  const diff = now - past
  const minutes = Math.floor(diff / 60)
  return minutes
}

export function dateToUnix(dateStr: string) {
  return Math.floor(new Date(dateStr).getTime() / 1000)
}

export function unixToDate(unix: number) {
  return new Date(unix * 1000)
}

export function newDate(unix: number) {
  new Date().toISOString().replace('T', ' ').substring(0, 19)
}


