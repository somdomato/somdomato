# Som do Mato - Guia de Início Rápido

## Setup Desenvolvimento

### 1. Clone e Instale Dependências

```bash
git clone [repo-url]
cd somdomato
pnpm install
```

### 2. Configure o Ambiente

O arquivo `.env` já vem configurado para desenvolvimento.
Ajuste apenas o caminho das músicas se necessário:

```bash
# Editar .env e ajustar MUSIC_PATH
nano .env
```

### 3. Inicie o Ambiente

Execute o script helper que inicia todos os containers:

```bash
./scripts/dev.sh
```

Isso iniciará:
- Nginx (proxy reverso) na porta 8080
- Icecast (streaming) na porta 8000
- Liquidsoap (AutoDJ)

### 4. Inicie o Next.js

Em outro terminal:

```bash
pnpm dev
```

### 5. Acesse a Aplicação

Abra http://localhost:3000 no navegador.

## Principais Mudanças (Simplificação)

### ✅ Configurações Centralizadas

Tudo em um lugar: `src/config.ts`

```typescript
import { RADIO_CONFIG, GENRES, buildStreamUrl } from "@/config";
```

### ✅ Player Simplificado

- Busca metadados diretamente do Icecast via API `/api/metadata?genre=<genero>`
- Polling a cada 10 segundos
- Troca de gênero inicia playback automaticamente
- Remove dependência exclusiva do Socket.io para metadados

### ✅ Contextos Limpos

**AudioContext**: Apenas controle de playback e estado da música
**GenreContext**: Apenas gerenciamento de gênero selecionado

### ✅ Nginx Dev Container

Socket.io agora funciona corretamente em desenvolvimento via proxy.

## Estrutura de URLs

| Ambiente | Next.js | Nginx | Icecast | Streams |
|----------|---------|-------|---------|---------|
| **Dev** | :3000 | :8080 | :8000 | http://localhost:8080/geral |
| **Prod** | :3000 | :443 | :8000 | https://radio.somdomato.com/geral |

## Comandos Úteis

```bash
# Parar containers
cd podman && podman compose down

# Reiniciar um serviço específico
podman restart somdomato-liquidsoap

# Ver logs
podman logs -f somdomato-nginx
podman logs -f somdomato-icecast
podman logs -f somdomato-liquidsoap

# Rebuild containers
cd podman && podman compose up -d --build
```

## Testar Funcionalidades

### 1. Player de Áudio
- ✓ Play/Pause funcionando
- ✓ Metadados mostram música do gênero atual
- ✓ Trocar gênero inicia playback automaticamente
- ✓ Reload do stream funciona

### 2. Pedidos
- ✓ Modal de pedidos abre
- ✓ Busca músicas funciona
- ✓ Aviso ao pedir fora do "Geral"
- ✓ Troca automática para "Geral" ao confirmar

### 3. Blocos da Home
- ✓ "Últimas" mostra histórico do gênero atual
- ✓ "Top 10" mostra mais tocadas
- ✓ "Próximas" mostra pedidos (só no Geral)

## Variáveis de Ambiente

### Desenvolvimento (`.env`)

```env
NEXT_PUBLIC_RADIO_SOURCE=http://localhost:8080
NEXT_PUBLIC_RADIO_METADATA=http://localhost:8080/json
LIQUIDSOAP_CONTROL_URL=http://localhost:8081  # ⚠️ Porta 8081 em dev!
```

### Produção (`.env.production`)

```env
NEXT_PUBLIC_RADIO_SOURCE=https://radio.somdomato.com
NEXT_PUBLIC_RADIO_METADATA=https://radio.somdomato.com/json
LIQUIDSOAP_CONTROL_URL=http://localhost:8080  # ✅ Porta 8080 em prod!
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<64_caracteres_hex>  # ⚠️ Obrigatório!
```

**Importante**: Ver [docs/PORTAS.md](docs/PORTAS.md) para entender as diferenças.

### Chave de Criptografia (Produção)

O Next.js 15+ requer `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` em produção. Esta chave é **gerada automaticamente** pelo script de deploy, mas você pode gerá-la manualmente:

```bash
# Gerar e mostrar no terminal
./scripts/generate-encryption-key.sh

# Gerar e adicionar automaticamente ao .env
./scripts/generate-encryption-key.sh --update-env

# Ou via openssl direto
openssl rand -hex 32
```

A chave deve ter 64 caracteres hexadecimais (32 bytes).

**⚠️ Importante:**
- Usar a mesma chave em todos os deploys
- Não compartilhar publicamente
- Mudança de chave requer rebuild

## Solução de Problemas

### Socket.io retorna 400 Bad Request

**Solução**: Acesse sempre via http://localhost:3000 (app), nunca :8080 diretamente.

### Música não troca ao mudar gênero

**Debug**:
```bash
# Testar stream
curl -I http://localhost:8080/gaucha

# Verificar metadados
curl http://localhost:8080/json | jq '.icestats.source'
```

### Metadados não atualizam

Verificar se o polling está ativo no Player (console do navegador).

## Documentação Adicional

- [Desenvolvimento Detalhado](docs/DESENVOLVIMENTO.md)
- [Deploy](docs/DEPLOY-RADIO.md)
- [Sistema de Pedidos](docs/PEDIDOS.md)
- [Admin](docs/ADMIN.md)

## Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -m 'Adiciona nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Abra um Pull Request

## Licença

[Sua licença aqui]
