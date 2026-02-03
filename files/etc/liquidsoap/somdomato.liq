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
    
    # Extrair path, title e artist do JSON
    path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
    title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
    artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
    
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
      uri = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
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

# Criar AutoDJ para cada gênero
autodj_geral = next("geral")
autodj_gaucha = next("gaucha")
autodj_modao = next("modao")
autodj_arrocha = next("arrocha")
autodj_romantico = next("romantico")
autodj_forro = next("forro")

# Cria uma fila para músicas injetadas manualmente
queue = request.queue(id="manual_queue")

# Skip handler HTTP
def skip_handler(_, req) =
  log("Skip recebido via HTTP")
  
  # Pula a faixa atual em todos os mountpoints
  autodj_geral.skip()
  autodj_gaucha.skip()
  autodj_modao.skip()
  autodj_arrocha.skip()
  autodj_romantico.skip()
  autodj_forro.skip()
  
  ignore(req.status_code(200))
  ignore(req.content_type("text/plain"))
  ignore(req.html("OK"))
end

# Play handler - injeta musica especifica
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
radio_forro = fallback(track_sensitive=false, [autodj_forro])

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

# Output para Icecast - Forró
output.icecast(
  %mp3(bitrate=128, samplerate=44100, id3v2=true),
  name = "Radio Som do Mato - Forró",
  description = "A mais sertaneja - Forró",
  genre = "Forró",
  url = "https://somdomato.com",
  host = "localhost",
  port = 8000,
  password = "hackme",
  mount = "/forro",
  encoding = "UTF-8",
  mksafe(radio_forro))
