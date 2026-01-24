#!/usr/bin/env liquidsoap

# Permitir execução como root (necessário para Docker)
settings.init.allow_root := true

# Configuração do input ao vivo
live = input.harbor("aovivo", port=8010, user="dj", password="hackme")

# Criar fila de requisições
queue = request.queue(id="queue")

# Função para buscar próxima música do Next.js
def fetch_next_song() =
  # Chama a API do Next.js via host.docker.internal (acessa o host)
  result = process.read.lines("curl -s http://host.docker.internal:3000/api/music")
  json = list.hd(default="", result)
  
  # Extrair path, title e artist do JSON
  path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
  title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
  artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
  
  # Log para depuração
  log("Próxima música: #{path}")
  log("Título: #{title}")
  log("Artista: #{artist}")
  
  # Criar request com metadados usando annotate: no URI
  uri = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
  req = request.create(uri)
  
  # Adicionar à fila se o request foi criado com sucesso
  if req != null() then
    request.push(req, queue)
  end
end

# Adicionar primeira música à fila ao iniciar
fetch_next_song()

# Hook para adicionar próxima música quando uma terminar
def on_track_end(~elapsed, ~remaining, ~on_last) =
  if remaining <= 5.0 then
    log("Buscando próxima música...")
    fetch_next_song()
  end
end

autodj = queue
autodj = on_end(delay=5.0, on_track_end, autodj)

# Mapear metadados para sobrescrever os que vêm do arquivo
autodj = map_metadata(fun (m) ->
  # Se não tiver title/artist anotado, deixa o que veio do arquivo
  m
, autodj)

# Prioridade: transmissão ao vivo > autodj
radio = fallback(track_sensitive=false, [live, autodj])

# Output para Icecast com metadados habilitados
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato",
  description = "A mais sertaneja!",
  genre = "Sertanejo",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/geral.mp3",
  encoding = "UTF-8",
  mksafe(radio))
