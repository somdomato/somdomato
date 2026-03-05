# Testando Radio Som do Mato com Docker

Este setup Docker permite testar o sistema de rádio localmente.

## Pré-requisitos

1. Docker e Docker Compose instalados
2. Next.js rodando em `localhost:3000`
3. Músicas na pasta definida em `.env` ou variável de ambiente `MUSIC_PATH`

## Configuração

### 1. Configurar MUSIC_PATH

O caminho das músicas pode ser configurado de duas formas:

**Opção A: Via .env (no diretório docker/)**
```bash
# Crie ou edite o arquivo .env no diretório docker/
echo "MUSIC_PATH=/caminho/para/suas/musicas" > .env
```

**Opção B: Via variável de ambiente**
```bash
# Linux/macOS
export MUSIC_PATH=/home/usuario/music/sdm

# Windows PowerShell
$env:MUSIC_PATH = "C:\Users\usuario\Music\sdm"

# Windows CMD
set MUSIC_PATH=C:\Users\usuario\Music\sdm
```

### Exemplos de caminhos:

- **Linux**: `MUSIC_PATH=/home/lucas/music/sdm`
- **macOS**: `MUSIC_PATH=/Users/lucas/Music/sdm`
- **Windows**: `MUSIC_PATH=C:\Users\Lucas\Music\sdm` ou `MUSIC_PATH=/c/Users/Lucas/Music/sdm` (Git Bash)

### 2. Ajustar permissões (Linux/macOS, se necessário)

```bash
chmod +x files/etc/liquidsoap/somdomato-docker.liq
```

## Usar

### Iniciar os serviços

```bash
# Iniciar Next.js primeiro
pnpm dev

# Em outro terminal, iniciar Icecast + Liquidsoap + Nginx
cd docker
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Acessar

- **Stream de áudio (via nginx)**: http://localhost:8080/geral
- **Stream de áudio (direto)**: http://localhost:8000/geral
- **Todas as estações**: `/geral`, `/gaucha`, `/modao`, `/arrocha`, `/romantico`, `/forro`
- **Admin Icecast**: http://localhost:8000/admin/
  - User: `admin`
  - Password: `hackmeagain`
- **Status Icecast**: http://localhost:8000/status.xsl

### Comandos úteis

```bash
# Parar serviços
docker-compose down

# Rebuildar após mudanças
docker-compose up -d --build

# Ver logs do Liquidsoap
docker-compose logs -f liquidsoap

# Ver logs do Icecast
docker-compose logs -f icecast

# Ver logs do Nginx
docker-compose logs -f nginx

# Reiniciar apenas o Liquidsoap
docker-compose restart liquidsoap
```

## Estrutura

```
├── docker-compose.yml          # Orquestração dos containers
├── Dockerfile.liquidsoap        # Image do Liquidsoap
├── nginx.dev.conf               # Configuração do Nginx (proxy reverso)
├── .env                         # Variáveis de ambiente (opcional)
├── files/
│   ├── etc/
│   │   ├── icecast/
│   │   │   └── icecast.xml     # Config do Icecast
│   │   └── liquidsoap/
│   │       └── somdomato-docker.liq  # Script do Liquidsoap (usa host.docker.internal)
```

## Diferenças do script de produção

O `somdomato-docker.liq` tem duas diferenças principais:

1. **API do Next.js**: `http://host.docker.internal:3000/api/music` (acessa o host)
2. **Host Icecast**: `host = "icecast"` (usa o nome do serviço Docker)

## Troubleshooting

### Liquidsoap não consegue conectar ao Next.js

Verifique se o Next.js está rodando:
```bash
curl http://localhost:3000/api/music
```

### Músicas não encontradas

Verifique o caminho no `.env`:
```bash
cat .env | grep MUSIC_PATH
ls -la /home/lucas/music/sdm
```

### Icecast não conecta

```bash
# Ver logs
docker-compose logs icecast

# Testar porta
curl http://localhost:8000
```

### Rebuildar tudo do zero

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Transmissão ao vivo (Harbor)

Para transmitir ao vivo, conecte-se em:
- **URL**: `http://localhost:8010/aovivo`
- **User**: `dj`
- **Password**: `hackme`
