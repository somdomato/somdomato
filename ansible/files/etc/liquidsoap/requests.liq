is_left = 90.

def get_request(g) =
  uri = list.hd(default="", process.read.lines("engine.sh #{g}"))
  print("Uri: #{uri}")
  [request.create(uri)]
end

req = request.dynamic.list(get_request)

def queue(remaining, _) =
  log("Queueing with #{remaining} seconds remaining")

  if not req.fetch() then
    log("Fetching next query failed")
  end
end

req = source.on_end(delay=is_left , req, queue)