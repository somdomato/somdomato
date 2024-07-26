import NodeID3 from 'node-id3'

export async function getTags(filename: string) {
  const file = Bun.file(filename)
  const buffer = await file.arrayBuffer()
  // const buffer = Buffer.from(arrbuf);

  const data = {
    title: "Teste",
    artist: "Teste",
    //album: "TVアニメ「メイドインアビス」オリジナルサウンドトラック",
    //APIC: "./example/mia_cover.jpg",
    //TRCK: "27"
  }

  const success = NodeID3.write(data, filename) // Returns true/Error
  const tags = NodeID3.read(filename)
  
  if (!success || !tags) return { message: 'Erro ao processar arquivo', ok: false }
  else return { message: 'Sucesso ao processar arquivo', tags, ok: true } 
}