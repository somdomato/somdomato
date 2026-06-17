- Em /admin/estatisticas mostre um relatório completo de TODAS as visitas em tempo real(usando socket.io) quantas sessões ativas e não ativas, logue informações como: IP, Agente, Browser, Sistema Operacional, Dispositivo, Local(cidade, estado, país), o geoip2 da maxmind está configurado no nginx em /geoip altere os arquivos do ansible para que o geoip passe essas informações ao next.js. Permita definir um tempo para manter o log das visitas através de um drop down com: 

- Para sempre, 
- Dez anos
- Cinco anos
- Um ano
- Seis meses
- Um mês
- Uma semana
- Um dia
- Doze horas
- Seis horas
- Uma hora

Essa expiração NÃO vale para a contagem de cliques e visitas nas páginas! Apenas para os usuários e suas informações.
Planeje tudo muito bem, e me pergunte se tiver dúvidas.

- Dependendo das condições e conectividade do cliente o som da rádio trava um pouco(talvez buffering incorreto do Icecast2 + Liquidsoap?), você consegue alterar para uma experiência melhor? Documente
  todas as alterações em um arquivo CHANGELOG.md (como estavam e como ficaram).

- Em /artistas quando eu clico em um artista crie uma rota separada para o artista com /artistas/[nome_sanitizado_do_artista]

- Quando eu renomear um artista e na página do artista não houverem mais músicas volte automaticamente para /artistas

- No modal de pedir música, se eu rolar para baixo ou para cima, a página por "trás" do modal rola, como evitar?

- Em /admin na aba músicas ao clicar na rotação mude ela para a próxima rotação automaticamente

- Em /admin na aba músicas mostre a música que está tocando separada das outras