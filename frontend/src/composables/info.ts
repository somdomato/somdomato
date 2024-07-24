// async function multiSongName() {
//   const { icestats: { source } } = await (await fetch(`${streamUrl}/json`)).json()
//   const result = source.find((item: Song) => item.genre.toLocaleLowerCase() === song.genre)
//   song.title = !result ? song.setTitle('Rádio Som do Mato') : result.title.normalize("NFD")  
// }

// async function songName() {
//   const { icestats: { source: { title } } } = await (await fetch(`${streamUrl}/json`)).json()
//   if (!title || title === '' || title === 'undefined') {
//     song.setTitle('Rádio Som do Mato')
//   } else {
//     song.setTitle(title.normalize('NFD'))
//   }
// }