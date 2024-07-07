#!/usr/bin/env liquidsoap

#%include "log.liq"
#%include "requests.liq"

songs = playlist("/media/songs")
jingles = playlist("/media/jingles")

def next()
  uri = list.hd(process.read.lines("./next-song"))
  request.create(uri)
end
s = request.dynamic(next)

main = fallback(track_sensitive=false, [s, songs])
radio = fallback([delay(1800., jingles), music])

output.icecast(%mp3, 
  name="Radio Som do Mato",
  genre="Geral",
  description="O melhor do sertanejo!",
  url="https://somdomato.com",
  host="localhost", 
  port=8000, 
  password="hackme", 
  mount="geral", 
  mpgeral)







