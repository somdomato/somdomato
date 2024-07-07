#!/usr/bin/env liquidsoap

# %include "log.liq"
#Log to stdout
settings.log.stdout.set(false)
settings.log.level.set(2)
settings.log.file.path.set("/var/log/liquidsoap.log")

def next(g)
  def request_function() =
    uri = list.hd(process.read.lines("SONGS_PATH=/media/songs /usr/share/liquidsoap/.bun/bin/bun /var/www/somdomato/backend/src/engine.ts #{g}"))
    request.create(uri)
  end
  request.dynamic(request_function)
end

geral = next('geral')
modao = next('modao')
uni = next('uni')
love = next('love')
gaucha = next('gaucha')

# mpgeral = fallback([geral, emerg])
# mpmodao = fallback([modao, emerg])
# mpuni = fallback([uni, emerg])
# mplove = fallback([love, emerg])
# mpgaucha = fallback([gaucha, emerg])

mpgeral = mksafe(geral)
mpmodao = mksafe(modao)
mpuni = mksafe(uni)
mplove = mksafe(love)
mpgaucha = mksafe(gaucha)

output.icecast(%mp3, 
  name='Radio Som do Mato',
  genre='Geral',
  description='O melhor do sertanejo!',
  url='https://somdomato.com',
  host='localhost', 
  port=8000, 
  password='hackme', 
  mount='geral', 
  mpgeral)

output.icecast(%mp3, 
  name='Radio Som do Mato - Modao',
  genre='Modao',
  description='O melhor do modao!',
  url='https://somdomato.com',
  host='localhost', 
  port=8002, 
  password='hackme', 
  mount='modao', 
  mpmodao)

output.icecast(%mp3, 
  name='Radio Som do Mato - Sertanejo Universitario',
  genre='Universitario',
  description='O melhor do sertanejo universitário!',
  url='https://somdomato.com',
  host='localhost', 
  port=8004, 
  password='hackme', 
  mount='universitario', 
  mpuni)

output.icecast(%mp3, 
  name='Radio Som do Mato - Sertanejo Romantico',
  genre='Romantico',
  description='O melhor do sertanejo romantico!',
  url='https://somdomato.com',
  host='localhost', 
  port=8006, 
  password='hackme', 
  mount='romantico', 
  mplove)

output.icecast(%mp3, 
  name='Radio Som do Mato - Gaucha',
  genre='Gaucha',
  description='O melhor da musica gaucha!',
  url='https://somdomato.com',
  host='localhost', 
  port=8008, 
  password='hackme', 
  mount='gaucha', 
  mpgaucha)
