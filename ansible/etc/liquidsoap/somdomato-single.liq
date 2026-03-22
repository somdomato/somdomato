# Configuração do input ao vivo
live = input.harbor("aovivo", port=8010, user="dj", password="hackme")

# Função para buscar próxima música do Next.js
def next()
  def request_function() =
    result = process.read.lines("curl -s http://localhost:3000/api/music")
    json = list.hd(default="", result)
    path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
    title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
    artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
    song_id = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.id'"))
    was_requested = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .wasRequested then \"1\" else \"0\" end'"))
    
    log("Próxima música: #{path}")
    log("Título: #{title}")
    log("Artista: #{artist}")
    
    uri = "annotate:title=\"#{title}\",artist=\"#{artist}\",song_id=\"#{song_id}\",was_requested=\"#{was_requested}\":#{path}"
    request.create(uri)
  end
  
  request.dynamic(id="next_track", request_function)
end

# Notificar API quando música começa a tocar efetivamente
def notify_started(m) =
  song_id = m["song_id"]
  was_requested = m["was_requested"]
  if song_id != "" and song_id != "null" then
    api_url = "http://localhost:3000/api/music/started?songId=#{song_id}&genre=geral&wasRequested=#{was_requested}"
    log("Notificando início: songId=#{song_id}")
    ignore(process.read.lines("curl -s -X POST '#{api_url}'"))
  end
end

# Cria a fonte de música automática
autodj = next()
autodj.on_track(fun (m) -> notify_started(m))

# Cria uma fila para músicas injetadas manualmente
queue = request.queue(id="manual_queue")

# Skip handler HTTP
def skip_handler(_, _) =
  log("Skip recebido via HTTP")
  
  # Pula a faixa atual
  autodj.skip()
  
  print("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nOK")
end

# Play handler - injeta música específica
def play_handler(_, request) =
  log("Play específico recebido via HTTP")
  
  # Extrai o body da requisição
  data = request.data
  
  # Parse do JSON para pegar path, title, artist
  # Assumindo que o body vem como JSON: {"path":"/path/to/song.mp3","title":"...","artist":"..."}
  path = list.hd(default="", process.read.lines("echo '#{data}' | jq -r '.path'"))
  title = list.hd(default="", process.read.lines("echo '#{data}' | jq -r '.title'"))
  artist = list.hd(default="", process.read.lines("echo '#{data}' | jq -r '.artist'"))
  
  log("Injetando música: #{path}")
  log("Título: #{title}, Artista: #{artist}")
  
  # Cria a requisição anotada
  uri = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
  req = request.create(uri)
  
  # Adiciona na fila manual
  queue.push(req)
  
  # Pula a música atual para tocar a injetada imediatamente
  autodj.skip()
  
  print("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nOK")
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

# Prioridade: transmissão ao vivo > fila manual > autodj
radio = fallback(track_sensitive=false, [live, queue, autodj])

# Garante que a fonte seja infallible
radio = mksafe(radio)

# Output para Icecast
output.icecast(
  %mp3(bitrate=128, samplerate=44100),
  host="localhost",
  port=8000,
  password="hackme",
  mount="/geral.mp3",
  name="Radio Som do Mato",
  description="A mais sertaneja!",
  genre="Sertanejo",
  url="https://somdomato.com",
  encoding="UTF-8",
  radio
)