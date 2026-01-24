# Permitir execução como root (necessário para Docker)
# NOTE: Para que o comando "Tocar agora" / "Skip" funcione imediatamente,
# você precisa expor um endpoint de controle em Liquidsoap que execute
# `fetch_next_song()` e pule a faixa atual. Exemplo (pseudo):
#
#   server.register("/skip", fun () ->
#     log("Skip mágico recebido via HTTP: buscando próxima música...") ;
#     fetch_next_song() ;
#     # opcional: manipular fila/skip aqui
#   end)
#
# Alternativamente, crie um pequeno serviço que conecte com o Liquidsoap via telnet/RPC
# e exponha um endpoint HTTP que este Next.js chame (defina LIQUIDSOAP_CONTROL_URL).
# Veja documentação do Liquidsoap para "server.register"/"http server"/"telnet" para detalhes.

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
    queue.push(req)
  end
end

# Endpoint HTTP simples para controlar o Liquidsoap (skip)
# Chama fetch_next_song() para forçar a adição da próxima música imediatamente.
# Ex.: curl -X POST http://host.docker.internal:8080/skip
def skip_handler(_http_req) =
  # Marca `_http_req` como usado para evitar warning de "unused variable"
  ignore(_http_req)
  log("HTTP /skip recebido - buscando próxima música...")
  fetch_next_song()
  # Força término da request atual para que a próxima tocada seja a que acabamos de empurrar
  current = request.all()
  if current != [] then
    log("Destruindo request atual para forçar skip")
    request.destroy(~force=true, list.hd(current))
  else
    log("Nenhuma request atual encontrada para destruir")
  end
  http.response(
    content_type="text/plain",
    data="OK"
  )
end

# Registra handler HTTP (compatível com builds sem `fun` anônimas)
harbor.http.register.simple(port=8080, method="POST", "/skip", skip_handler)


# Adicionar primeira música à fila ao iniciar
fetch_next_song()

# Fonte dinâmica para buscar próxima música (compatível com esta build)
def request_function() =
  result = process.read.lines("curl -s http://host.docker.internal:3000/api/music")
  json = list.hd(default="", result)
  path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
  title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
  artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
  uri = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
  req = request.create(uri)
  log("Request criada: #{uri}")
  if req != null() then
    log("Request criada com sucesso, inserindo na fila")
    queue.push(req)
    log("Request empurrada para fila")
  else
    log("Falha ao criar request para #{uri}")
  end
end

next_source = request.dynamic(id="next_track", request_function)

# Prioridade: transmissão ao vivo > pedidos manuais > autodj automático
autodj = fallback(track_sensitive=false, [live, queue, next_source])

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
