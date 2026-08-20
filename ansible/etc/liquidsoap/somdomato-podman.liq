# Dev/Podman: o AutoDJ e os pedidos são alimentados pelo backend Go (não
# mais Next.js), via /internal/music e /internal/music/started, protegidos
# por X-Internal-Token (ver api/internal/httpserver/internal_radio.go).
#
# A API roda nativa no host (via `make air`), não em container — por isso
# aponta pra host.containers.internal (porta 3001, a app real por trás do
# proxy do air em :3000; ver .air.toml) em vez de um hostname de serviço.
settings.init.allow_root := true

api_base = "http://host.containers.internal:3001"
internal_token = environment.get("RADIO_INTERNAL_TOKEN")

live = input.harbor("aovivo", port=8010, user="dj", password="hackme-dev-only")

def next(genre) =
  def request_function() =
    api_url = "#{api_base}/internal/music?genre=#{genre}"
    result = process.read.lines(
      "curl -s -H 'X-Internal-Token: #{internal_token}' '#{api_url}'"
    )
    json = list.hd(default="", result)

    path = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.path'"))
    title = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.title'"))
    artist = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.artist'"))
    song_id = list.hd(default="", process.read.lines("echo '#{json}' | jq -r '.id'"))
    was_requested = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .wasRequested then \"1\" else \"0\" end'"))
    is_jingle = list.hd(default="0", process.read.lines("echo '#{json}' | jq -r 'if .isJingle then \"1\" else \"0\" end'"))

    if path == "" or path == "null" then
      log("[#{genre}] Nenhuma música retornada pela API - aguardando 5s")
      null()
    else
      uri = "annotate:title=\"#{title}\",artist=\"#{artist}\",song_id=\"#{song_id}\",was_requested=\"#{was_requested}\",is_jingle=\"#{is_jingle}\":#{path}"
      req = request.create(uri)
      req
    end
  end

  request.dynamic(id="next_#{genre}", retry_delay=5.0, timeout=60.0, request_function)
end

def notify_started(genre, m) =
  song_id = m["song_id"]
  was_requested = m["was_requested"]
  is_jingle = m["is_jingle"]
  if song_id != "" and song_id != "null" and is_jingle != "1" then
    api_url = "#{api_base}/internal/music/started?songId=#{song_id}&genre=#{genre}&wasRequested=#{was_requested}"
    log("[#{genre}] Notificando início: songId=#{song_id}")
    ignore(process.read.lines(
      "curl -s -X POST -H 'X-Internal-Token: #{internal_token}' '#{api_url}'"
    ))
  end
end

autodj_geral = next("geral")
autodj_gaucha = next("gaucha")
autodj_modao = next("modao")
autodj_arrocha = next("arrocha")
autodj_romantico = next("romantico")

autodj_geral.on_track(fun (m) -> notify_started("geral", m))
autodj_gaucha.on_track(fun (m) -> notify_started("gaucha", m))
autodj_modao.on_track(fun (m) -> notify_started("modao", m))
autodj_arrocha.on_track(fun (m) -> notify_started("arrocha", m))
autodj_romantico.on_track(fun (m) -> notify_started("romantico", m))

queue = request.queue(id="manual_queue")

def skip_handler(_, req) =
  autodj_geral.skip()
  ignore(req.status_code(200))
  ignore(req.content_type("text/plain"))
  ignore(req.html("OK"))
end

harbor.http.register(port=8081, method="POST", "/skip", skip_handler)

radio_geral = fallback(track_sensitive=false, [live, queue, autodj_geral])
radio_gaucha = mksafe(autodj_gaucha)
radio_modao = mksafe(autodj_modao)
radio_arrocha = mksafe(autodj_arrocha)
radio_romantico = mksafe(autodj_romantico)

output.icecast(%mp3(bitrate=128, samplerate=44100, id3v2=true),
  name="Som do Mato - Geral", genre="Sertanejo",
  host="icecast", port=8000, password="hackme-dev-only", mount="/geral",
  encoding="UTF-8", mksafe(radio_geral))

output.icecast(%mp3(bitrate=128, samplerate=44100, id3v2=true),
  name="Som do Mato - Gaúcha", genre="Gaúcha",
  host="icecast", port=8000, password="hackme-dev-only", mount="/gaucha",
  encoding="UTF-8", radio_gaucha)

output.icecast(%mp3(bitrate=128, samplerate=44100, id3v2=true),
  name="Som do Mato - Modão", genre="Modão",
  host="icecast", port=8000, password="hackme-dev-only", mount="/modao",
  encoding="UTF-8", radio_modao)

output.icecast(%mp3(bitrate=128, samplerate=44100, id3v2=true),
  name="Som do Mato - Arrocha", genre="Arrocha",
  host="icecast", port=8000, password="hackme-dev-only", mount="/arrocha",
  encoding="UTF-8", radio_arrocha)

output.icecast(%mp3(bitrate=128, samplerate=44100, id3v2=true),
  name="Som do Mato - Romântico", genre="Romântico",
  host="icecast", port=8000, password="hackme-dev-only", mount="/romantico",
  encoding="UTF-8", radio_romantico)
