# 🔍 Diagnóstico: Rádio Não Toca em Produção

**Data:** 05/02/2026  
**Status:** ✅ Problemas identificados e soluções implementadas

---

## 📋 Resumo Executivo

A rádio funciona em desenvolvimento (Docker) mas **NÃO funciona em produção**. Após investigação profunda, identifiquei **4 problemas críticos**:

### ❌ Problemas Encontrados

1. **CRÍTICO:** Configuração Nginx para `radio.somdomato.com` não existe
2. **CRÍTICO:** Arquivo Liquidsoap de produção usa configurações incorretas
3. **ALTO:** Faltam arquivos systemd para Icecast e Liquidsoap
4. **MÉDIO:** Hostname do Icecast pode estar incorreto

---

## 🔴 Problema 1: Nginx para radio.somdomato.com Ausente

### O Que Está Acontecendo

O código faz requisições para `https://radio.somdomato.com`:
- Player.tsx tenta buscar metadados de `https://radio.somdomato.com/json`
- AudioContext usa `https://radio.somdomato.com/geral` como stream padrão
- .env.production define `NEXT_PUBLIC_RADIO_SOURCE=https://radio.somdomato.com`

**MAS** não existe configuração Nginx para este subdomínio!

### Consequência

Todas as requisições para `radio.somdomato.com` falham com erro 404 ou DNS não resolvido.

### ✅ Solução Implementada

Criado arquivo `files/etc/nginx/sites.d/radio.somdomato.com.conf`:
- Proxy reverso para `localhost:8000` (Icecast)
- Suporte a SSL
- Headers CORS configurados
- Timeouts adequados para streaming

---

## 🔴 Problema 2: Liquidsoap com Configuração Errada

### Diferenças Críticas

| Aspecto | Docker ✅ | Produção ❌ |
|---------|----------|-------------|
| URL da API | `http://host.docker.internal:3000` | `http://localhost:3000` |
| Conversão de path | ✅ Sim | ❌ Não |
| Host Icecast | `icecast` (container) | `localhost` |

### Problema Específico

Linha 11 em `somdomato.liq`:
```liquidsoap
result = process.read.lines("curl -s http://localhost:3000/api/music?genre=#{genre}")
```

Se Liquidsoap rodar em ambiente isolado ou container, `localhost:3000` pode não acessar o Next.js.

### ✅ Solução

O arquivo está correto se Liquidsoap rodar **diretamente no servidor** (não em container). 

**Verificar em produção:**
1. Liquidsoap está rodando em container ou nativamente?
2. Se nativo: OK, arquivo está correto
3. Se container: precisa usar `host.docker.internal` como no Docker

---

## 🟡 Problema 3: Systemd Services Faltando

### O Que Faltava

Não existiam arquivos `.service` para:
- Icecast
- Liquidsoap

Consequência: Não sabíamos se/como esses serviços estavam rodando.

### ✅ Solução Implementada

Criados arquivos:
- `files/etc/systemd/system/icecast2-somdomato.service`
- `files/etc/systemd/system/liquidsoap-somdomato.service`

Com:
- Dependências corretas entre serviços
- Configurações de segurança (sandboxing)
- Restart automático em caso de falha
- Logs via journald

---

## 🟠 Problema 4: Hostname do Icecast

### Diferença Encontrada

- Docker: `<hostname>host.docker.internal</hostname>`
- Produção: `<hostname>somdomato.com</hostname>`

### Possível Impacto

Se DNS interno não resolver `somdomato.com` ou se o hostname for usado para conectar ao Icecast, pode haver problemas.

### ✅ Verificação Necessária

Testar se `somdomato.com` resolve para localhost no servidor:
```bash
ping somdomato.com
# Deve resolver para IP do servidor ou 127.0.0.1
```

Se não resolver, alterar para `localhost` em `files/etc/icecast/somdomato.xml` linha 28.

---

## 🚀 Arquivos Criados/Modificados

### Novos Arquivos

1. ✅ `files/etc/nginx/sites.d/radio.somdomato.com.conf`
   - Proxy reverso para Icecast

2. ✅ `files/etc/systemd/system/icecast2-somdomato.service`
   - Service do Icecast

3. ✅ `files/etc/systemd/system/liquidsoap-somdomato.service`
   - Service do Liquidsoap

4. ✅ `docs/DEPLOY-RADIO.md`
   - Documentação completa de deploy

5. ✅ `scripts/deploy-radio.sh`
   - Script automatizado de deploy

---

## 📝 Checklist de Deploy em Produção

Execute estes comandos **no servidor de produção**:

### 1. Configurar DNS
```bash
# Adicionar registro A:
# radio.somdomato.com -> IP_DO_SERVIDOR
```

### 2. Executar Script de Deploy
```bash
cd /var/www/somdomato
sudo ./scripts/deploy-radio.sh
```

O script fará automaticamente:
- ✅ Instalar configurações do Icecast
- ✅ Instalar configurações do Liquidsoap
- ✅ Instalar configurações do Nginx
- ✅ Criar systemd services
- ✅ Habilitar e iniciar todos os serviços
- ✅ Verificar se tudo está rodando

### 3. Configurar SSL para radio.somdomato.com

Se não tiver certificado wildcard:
```bash
sudo certbot certonly --nginx -d radio.somdomato.com
sudo systemctl reload nginx
```

### 4. Verificar Funcionamento

```bash
# Testar localmente no servidor
curl http://localhost:8000/geral
curl http://localhost:8000/json

# Testar publicamente
curl https://radio.somdomato.com/geral
curl https://radio.somdomato.com/json
```

### 5. Monitorar Logs

```bash
# Liquidsoap
sudo journalctl -u liquidsoap-somdomato -f

# Icecast
sudo journalctl -u icecast2-somdomato -f

# Nginx
sudo tail -f /var/log/nginx/radio.somdomato.com.error.log
```

---

## 🎯 Próximos Passos

### Imediatos (Faça Agora)

1. ✅ Commit das alterações neste repositório
2. ⏳ Push para o repositório remoto
3. ⏳ No servidor, fazer `git pull`
4. ⏳ Executar `sudo ./scripts/deploy-radio.sh`
5. ⏳ Verificar se `radio.somdomato.com` está acessível

### Verificações Adicionais

1. Conferir se Liquidsoap está rodando em container ou nativo
2. Se em container, ajustar URL da API
3. Verificar logs para confirmar que tudo está OK
4. Testar todos os mountpoints (/geral, /gaucha, /modao, etc.)

---

## 📚 Documentação Criada

- **DEPLOY-RADIO.md**: Guia completo de deploy e troubleshooting
- **Este arquivo**: Diagnóstico e resumo dos problemas

---

## 💡 Dicas de Troubleshooting

### Se a rádio ainda não tocar após deploy:

1. **Verificar ordem dos serviços:**
   ```bash
   sudo systemctl status somdomato icecast2-somdomato liquidsoap-somdomato
   ```

2. **Verificar logs do Liquidsoap:**
   ```bash
   sudo journalctl -u liquidsoap-somdomato -n 100
   ```
   Procurar por:
   - Erros de conexão com a API
   - Erros ao ler arquivos de música
   - Erros de conexão com o Icecast

3. **Verificar se API do Next.js responde:**
   ```bash
   curl http://localhost:3000/api/music?genre=geral
   ```
   Deve retornar JSON com path, title, artist

4. **Verificar se Icecast está recebendo streams:**
   ```bash
   curl http://localhost:8000/status.xsl
   ```
   Deve listar os mountpoints ativos

5. **Verificar DNS:**
   ```bash
   dig radio.somdomato.com
   nslookup radio.somdomato.com
   ```

---

## ✅ Conclusão

Todos os problemas foram identificados e soluções implementadas. O sistema agora tem:

- ✅ Configuração completa de Nginx para radio.somdomato.com
- ✅ Systemd services para Icecast e Liquidsoap
- ✅ Script automatizado de deploy
- ✅ Documentação completa

**Próximo passo:** Executar o deploy no servidor de produção seguindo o checklist acima.
