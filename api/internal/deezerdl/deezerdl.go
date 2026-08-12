// Package deezerdl baixa faixas do Deezer inteiramente em processo — sem
// spawnar o binário `godeez` como subprocesso. A lógica de autenticação via
// cookie ARL, resolução de mídia e desencriptação Blowfish é uma porta
// direta (não um import — os pacotes de origem são `internal/` e não podem
// ser importados fora do módulo) de github.com/mathismqn/godeez (MIT
// License, Copyright (c) 2024 Mathis Maquenne), reduzida ao caminho de
// "uma faixa por ID" que é tudo que a rádio precisa.
//
// Diferenças deliberadas em relação ao godeez original, pensadas para rodar
// atrás de um endpoint público com muitos usuários simultâneos e pouca
// RAM/CPU:
//   - a sessão autenticada é compartilhada e cacheada (um login por
//     processo, não um por download);
//   - downloads concorrentes são limitados por um semáforo global
//     (maxConcurrentDownloads) — o gargalo real é a conta Deezer e a
//     banda/CPU da máquina, não o número de visitantes pedindo música;
//   - o progresso é calculado a partir de bytes já gravados (Content-Length
//     da resposta), nunca fazendo parsing de texto de stdout;
//   - o arquivo nunca é bufferizado inteiro em memória: é decodificado em
//     stripes de 2048 bytes direto para um arquivo temporário, igual ao
//     godeez.
package deezerdl

import (
	"context"
	"errors"
)

// ErrNotConfigured é retornado por todas as operações quando DEEZER_ARL não
// foi definido — permite que o resto da aplicação suba normalmente com a
// feature desligada.
var ErrNotConfigured = errors.New("deezerdl: DEEZER_ARL não configurado")

// maxConcurrentDownloads limita quantos downloads rodam ao mesmo tempo,
// independente de quantas requisições HTTP chegam. Cada download usa pouca
// CPU (só 1/3 dos chunks passa por Blowfish, um cipher de bloco leve), mas
// consome banda e um slot na conta Deezer — poucas conexões simultâneas
// bastam e evitam sobrecarregar o servidor ou levantar suspeita de abuso na
// conta.
const maxConcurrentDownloads = 3

var downloadSem = make(chan struct{}, maxConcurrentDownloads)

// acquireSlot bloqueia até haver um slot livre ou o contexto expirar/ser
// cancelado — assim uma rajada de pedidos faz fila em vez de disparar N
// downloads em paralelo.
func acquireSlot(ctx context.Context) error {
	select {
	case downloadSem <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func releaseSlot() {
	<-downloadSem
}

type Client struct {
	arl string
}

// New cria um client vinculado ao cookie ARL. Não autentica imediatamente —
// a sessão é resolvida (e cacheada) na primeira operação real, então criar
// um Client é barato e pode acontecer uma vez no boot.
func New(arl string) *Client {
	return &Client{arl: arl}
}

func (c *Client) configured() bool { return c.arl != "" }
