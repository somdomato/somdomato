# Permitir execucao como root (necessario para Docker)
settings.init.allow_root := true

# Configuração do input ao vivo
live = input.harbor("aovivo", port=8010, user="dj", password="hackme")

# Função para buscar próxima música do Next.js
def next(genre) =
  def request_function() =
    # Chama a API do Next.js via host.docker.internal (acessa o host) passando o gênero
    result = process.read.lines("curl -s http://localhost:3000/api/music?genre=#{genre}")
    json = list.hd(default="", result)
    
    # Extrair path, title, artist, id, wasRequested e isJingle do JSON
    path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
    title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
    artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
    song_id = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.id'"))
    was_requested = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .wasRequested then \"1\" else \"0\" end'"))
    is_jingle = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .isJingle then \"1\" else \"0\" end'"))
    
    # Validar se recebemos dados válidos
    if path == "" or path == "null" then
      log("[#{genre}] Nenhuma música retornada pela API - aguardando 5s")
      null()
    else
      # Log para depuracao
      log("Proxima musica [#{genre}]: #{path}")
      log("Titulo: #{title}")
      log("Artista: #{artist}")
      
      # Criar request com metadados usando annotate: no URI
      # IMPORTANTE: Não fazer URL encode - paths locais precisam estar sem encoding
      uri = "annotate:title=\"#{title}\",artist=\"#{artist}\",song_id=\"#{song_id}\",was_requested=\"#{was_requested}\",is_jingle=\"#{is_jingle}\":#{path}"
      req = request.create(uri)
      # Registrar sucesso/falha e retornar o request (ou null)
      if req != null() then
        log("Request criada [#{genre}]")
      else
        log("Falha ao criar request para #{uri}")
      end

      req
    end
  end

  # retry_delay: aguardar 5s entre tentativas se falhar
  # timeout: aguardar até 60s por uma request válida
  request.dynamic(id="next_track_#{genre}", retry_delay=5.0, timeout=60.0, request_function)
end

# Notificar API quando música começa a tocar efetivamente
def notify_started(genre, m) =
  song_id = m["song_id"]
  was_requested = m["was_requested"]
  is_jingle = m["is_jingle"]
  if song_id != "" and song_id != "null" and is_jingle != "1" then
    api_url = "http://localhost:3000/api/music/started?songId=#{song_id}&genre=#{genre}&wasRequested=#{was_requested}"
    log("[#{genre}] Notificando início: songId=#{song_id}")
    ignore(process.read.lines("curl -s -X POST '#{api_url}'"))
  else
    if is_jingle == "1" then
      log("[#{genre}] Vinheta tocando - skip notify")
    end
  end
end

# Criar AutoDJ para cada gênero
autodj_geral = next("geral")
autodj_gaucha = next("gaucha")
autodj_modao = next("modao")
autodj_arrocha = next("arrocha")
autodj_romantico = next("romantico")

# Registrar callbacks para notificar quando cada faixa começa a tocar
autodj_geral.on_track(fun (m) -> notify_started("geral", m))
autodj_gaucha.on_track(fun (m) -> notify_started("gaucha", m))
autodj_modao.on_track(fun (m) -> notify_started("modao", m))
autodj_arrocha.on_track(fun (m) -> notify_started("arrocha", m))
autodj_romantico.on_track(fun (m) -> notify_started("romantico", m))

# Cria uma fila para músicas injetadas manualmente
queue = request.queue(id="manual_queue")

# Skip handler HTTP
def skip_handler(_http_req, req) =
  log("Skip recebido via HTTP")
  
  # Pula a faixa atual em todos os mountpoints
  autodj_geral.skip()
  autodj_gaucha.skip()
  autodj_modao.skip()
  autodj_arrocha.skip()
  autodj_romantico.skip()
  
  ignore(req.status_code(200))
  ignore(req.content_type("text/plain"))
  ignore(req.html("OK"))
end

# Play handler - injeta musica especifica
# http_req = record com {data, headers, method, uri} (request info)
# req = objeto para construir a resposta HTTP
def play_handler(http_req, req) =
  log("Play especifico recebido via HTTP")

  # O body do POST está em http_req.data() (primeiro argumento), não em req.data()
  body = http_req.data()

  # Parse do JSON para pegar path, title, artist
  path = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.path'"))
  title = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.title'"))
  artist = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.artist'"))

  log("Injetando musica: #{path}")
  log("Titulo: #{title}, Artista: #{artist}")

  if path == "" or path == "null" then
    log("ERRO play_handler: path vazio ou null no body recebido")
    ignore(req.status_code(400))
    ignore(req.content_type("text/plain"))
    ignore(req.html("path invalido"))
  else
    # Cria a requisicao anotada
    uri_annotate = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
    request_obj = request.create(uri_annotate)

    if request_obj == null() then
      log("ERRO play_handler: request.create retornou null para #{uri_annotate}")
      ignore(req.status_code(500))
      ignore(req.content_type("text/plain"))
      ignore(req.html("falha ao criar request"))
    else
      log("Request criada com sucesso, adicionando na fila")
      queue.push(request_obj)
      # Pula a faixa atual do geral para a queue entrar imediatamente
      autodj_geral.skip()
      ignore(req.status_code(200))
      ignore(req.content_type("text/plain"))
      ignore(req.html("OK"))
    end
  end
end

harbor.http.register(
  port=8080,
  method="POST",
  "/skip",
  skip_handler
)

harbor.http.register(
  port=8080,
  method="POST",
  "/play",
  play_handler
)

# Criar rádio para cada gênero com prioridade: live > queue > autodj
# Nota: queue é compartilhada apenas para o Geral (onde pedidos são aceitos)
radio_geral = fallback(track_sensitive=false, [live, queue, autodj_geral])
radio_gaucha = fallback(track_sensitive=false, [autodj_gaucha])
radio_modao = fallback(track_sensitive=false, [autodj_modao])
radio_arrocha = fallback(track_sensitive=false, [autodj_arrocha])
radio_romantico = fallback(track_sensitive=false, [autodj_romantico])

# Output para Icecast - Geral
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Geral",
  description = "A mais sertaneja - Geral",
  genre = "Sertanejo",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/geral",
  encoding = "UTF-8",
  mksafe(radio_geral))

# Output para Icecast - Gaúcha
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Gaúcha",
  description = "A mais sertaneja - Gaúcha",
  genre = "Sertanejo Gaúcho",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/gaucha",
  encoding = "UTF-8",
  mksafe(radio_gaucha))

# Output para Icecast - Modão
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Modão",
  description = "A mais sertaneja - Modão",
  genre = "Modão",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/modao",
  encoding = "UTF-8",
  mksafe(radio_modao))

# Output para Icecast - Arrocha
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Arrocha",
  description = "A mais sertaneja - Arrocha",
  genre = "Arrocha",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/arrocha",
  encoding = "UTF-8",
  mksafe(radio_arrocha))

# Output para Icecast - Romântico
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Romântico",
  description = "A mais sertaneja - Romântico",
  genre = "Romântico",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/romantico",
  encoding = "UTF-8",
  mksafe(radio_romantico))