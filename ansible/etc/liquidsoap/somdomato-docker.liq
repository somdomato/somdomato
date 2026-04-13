# Permitir execucao como root (necessario para Docker)
settings.init.allow_root := true

# Configuração do input ao vivo
live = input.harbor("aovivo", port=8010, user="dj", password="hackme")

# Função para buscar próxima música do Next.js para um gênero específico
def next(genre) =
  def request_function() =
    # Chama a API do Next.js via rede Docker interna
    api_url = "http://nextjs:3000/api/music?genre=#{genre}"
    result = process.read.lines("curl -s '#{api_url}'")
    json = list.hd(default="", result)
    
    # Extrair path, title, artist, id, wasRequested e isJingle do JSON
    path_raw = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
    title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
    artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
    song_id = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.id'"))
    was_requested = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .wasRequested then \"1\" else \"0\" end'"))
    is_jingle = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .isJingle then \"1\" else \"0\" end'"))
    
    # Validar se recebemos dados válidos
    if path_raw == "" or path_raw == "null" then
      log("[#{genre}] Nenhuma música retornada pela API - aguardando 5s")
      # Retornar null e aguardar antes de tentar novamente
      null()
    else
      # Converter path do host para path do container
      # No Docker, músicas estão em /var/music/sdm, mas API retorna /home/lucas/music/sdm
      path = string.replace(pattern="/home/lucas/music/sdm", (fun (_) -> "/var/music/sdm"), path_raw)
      
      # Log para depuracao
      log("[#{genre}] Path original: #{path_raw}")
      log("[#{genre}] Path container: #{path}")
      log("[#{genre}] Titulo: #{title}")
      log("[#{genre}] Artista: #{artist}")
      
      # Criar request com metadados usando annotate: no URI
      # IMPORTANTE: Não fazer URL encode - paths locais precisam estar sem encoding
      uri = "annotate:title=\"#{title}\",artist=\"#{artist}\",song_id=\"#{song_id}\",was_requested=\"#{was_requested}\",is_jingle=\"#{is_jingle}\":#{path}"
      req = request.create(uri)
      
      # Registrar sucesso/falha e retornar o request (ou null)
      if req != null() then
        log("[#{genre}] Request criada com sucesso")
      else
        log("[#{genre}] Falha ao criar request - arquivo pode não existir")
      end

      req
    end
  end

  # retry_delay: aguardar 5s entre tentativas se falhar
  # timeout: aguardar até 60s por uma request válida
  request.dynamic(id="next_#{genre}", retry_delay=5.0, timeout=60.0, request_function)
end

# Notificar API quando música começa a tocar efetivamente
def notify_started(genre, m) =
  song_id = m["song_id"]
  was_requested = m["was_requested"]
  is_jingle = m["is_jingle"]
  if song_id != "" and song_id != "null" and is_jingle != "1" then
    api_url = "http://nextjs:3000/api/music/started?songId=#{song_id}&genre=#{genre}&wasRequested=#{was_requested}"
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
autodj_forro = next("forro")

# Registrar callbacks para notificar quando cada faixa começa a tocar
autodj_geral.on_track(fun (m) -> notify_started("geral", m))
autodj_gaucha.on_track(fun (m) -> notify_started("gaucha", m))
autodj_modao.on_track(fun (m) -> notify_started("modao", m))
autodj_arrocha.on_track(fun (m) -> notify_started("arrocha", m))
autodj_romantico.on_track(fun (m) -> notify_started("romantico", m))
autodj_forro.on_track(fun (m) -> notify_started("forro", m))

# Cria uma fila para músicas injetadas manualmente (apenas para geral)
queue = request.queue(id="manual_queue")

# Skip handler HTTP (apenas para geral)
def skip_handler(_, req) =
  log("Skip recebido via HTTP")
  
  # Pula a faixa atual no geral
  autodj_geral.skip()
  
  ignore(req.status_code(200))
  ignore(req.content_type("text/plain"))
  ignore(req.html("OK"))
end

# Play handler - injeta musica especifica (apenas para geral)
def play_handler(_, req) =
  log("Play especifico recebido via HTTP")
  
  # Extrai dados do request
  body = req.data("")
  
  # Parse do JSON para pegar path, title, artist
  path = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.path'"))
  title = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.title'"))
  artist = list.hd(default="", process.read.lines("echo '#{body}' | jq -r '.artist'"))
  
  log("Injetando musica: #{path}")
  log("Titulo: #{title}, Artista: #{artist}")
  
  # Cria a requisicao anotada
  uri_annotate = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
  request_obj = request.create(uri_annotate)
  
  # Adiciona na fila manual
  queue.push(request_obj)
  
  # Pula a musica atual para tocar a injetada imediatamente
  autodj_geral.skip()
  
  ignore(req.status_code(200))
  ignore(req.content_type("text/plain"))
  ignore(req.html("OK"))
end

# Harbor HTTP em porta 8081 (desenvolvimento Docker)
# Em produção, o arquivo somdomato.liq usa porta 8080
harbor.http.register(
  port=8081,
  method="POST",
  "/skip",
  skip_handler
)

harbor.http.register(
  port=8081,
  method="POST",
  "/play",
  play_handler
)

# Criar streams separados para cada gênero
# Geral: aceita live, queue e autodj
radio_geral = fallback(track_sensitive=false, [live, queue, autodj_geral])

# Outros: apenas autodj (sem live e sem queue)
radio_gaucha = mksafe(autodj_gaucha)
radio_modao = mksafe(autodj_modao)
radio_arrocha = mksafe(autodj_arrocha)
radio_romantico = mksafe(autodj_romantico)
radio_forro = mksafe(autodj_forro)

# Output para Icecast - Geral
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Geral",
  description = "Rádio geral com pedidos",
  genre = "Sertanejo",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/geral",
  encoding = "UTF-8",
  mksafe(radio_geral))

# Output para Icecast - Gaúcha
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Gaúcha",
  description = "Sertanejo gaúcho",
  genre = "Gaúcha",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/gaucha",
  encoding = "UTF-8",
  radio_gaucha)

# Output para Icecast - Modão
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Modão",
  description = "Modão tradicional",
  genre = "Modão",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/modao",
  encoding = "UTF-8",
  radio_modao)

# Output para Icecast - Arrocha
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Arrocha",
  description = "Arrocha e romantic",
  genre = "Arrocha",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/arrocha",
  encoding = "UTF-8",
  radio_arrocha)

# Output para Icecast - Romântico
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Romântico",
  description = "Músicas românticas",
  genre = "Romântico",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/romantico",
  encoding = "UTF-8",
  radio_romantico)

# Output para Icecast - Forró
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Som do Mato - Forró",
  description = "Forró e derivados",
  genre = "Forró",
  url = "https://somdomato.com",
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "/forro",
  encoding = "UTF-8",
  radio_forro)
