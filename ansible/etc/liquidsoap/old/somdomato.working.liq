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
    
    log("Próxima música: #{path}")
    log("Título: #{title}")
    log("Artista: #{artist}")
    
    uri = "annotate:title=\"#{title}\",artist=\"#{artist}\":#{path}"
    request.create(uri)
  end
  
  request.dynamic(id="next_track", request_function)
end

# Cria a fonte de música automática
autodj = next()

# Skip handler HTTP
def skip_handler(_, _) =
  log("Skip recebido via HTTP")
  
  # Pula a faixa atual do autodj
  autodj.skip()
  
  print("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nOK")
end

harbor.http.register(
  port=8080,
  method="POST",
  "/skip",
  skip_handler
)

# Prioridade: transmissão ao vivo > autodj
radio = fallback(track_sensitive=false, [live, autodj])

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