#!/usr/bin/env liquidsoap

# %include "log.liq"

#Log to stdout
settings.log.stdout.set(false)
settings.log.level.set(4)
settings.log.file.path.set("/var/log/liquidsoap.log")

emerg = single("/media/songs/vinhetas/060723 RADIO SOM DO MATO - VINHETAO HUMBERTO E RONALDO.mp3")

def cross(g)
  crossfade(fade_out=3., fade_in=3., duration=5., g)
end

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

geral = fallback([cross(geral), emerg])
modao = fallback([cross(modao), emerg])
uni = fallback([cross(uni), emerg])
love = fallback([cross(love), emerg])
gaucha = fallback([cross(gaucha), emerg])

output.icecast(%mp3, 
  name='Radio Som do Mato',
  genre='Geral',
  description='O melhor do sertanejo!',
  url='https://somdomato.com',
  host="localhost", 
  port=8000, 
  password="hackme", 
  mount="geral", 
  geral)

output.icecast(%mp3, 
  name='Radio Som do Mato - Modao',
  genre='Modao',
  description='O melhor do modao!',
  url='https://somdomato.com',
  host="localhost", 
  port=8002, 
  password="hackme", 
  mount="modao", 
  modao)

output.icecast(%mp3, 
  name='Radio Som do Mato - Universitario',
  genre='Universitario',
  description='O melhor do sertanejo universitário!',
  url='https://somdomato.com',
  host="localhost", 
  port=8004, 
  password="hackme", 
  mount="universitario", 
  uni)

output.icecast(%mp3, 
  name='Radio Som do Mato - Romanticas',
  genre='Romantico',
  description='O melhor do sertanejo romantico!',
  url='https://somdomato.com',
  host="localhost", 
  port=8006, 
  password="hackme", 
  mount="romantico", 
  love)

output.icecast(%mp3, 
  name='Radio Som do Mato - Gaucha',
  genre='Gaucha',
  description='O melhor da musica gaucha!',
  url='https://somdomato.com',
  host="localhost", 
  port=8008, 
  password="hackme", 
  mount="gaucha", 
  gaucha)
