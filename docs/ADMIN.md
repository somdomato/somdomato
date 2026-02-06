# Dashboard de Administração

## Configuração

1. Adicione a senha de administrador no arquivo `.env`:

```env
ADMIN_PASSWORD=sua_senha_aqui
```

2. Certifique-se de que as dependências estão instaladas:

```bash
pnpm install
```

3. Execute as migrações do banco de dados:

```bash
pnpm run push
```

## Acesso

Acesse o dashboard em: `http://localhost:3000/admin`

## Funcionalidades

### Gerenciamento de Músicas

- **Visualizar**: Tabela paginada com todas as músicas
- **Editar**: 
  - Nome do arquivo (renomeia o arquivo físico)
  - Tags ID3 (título e artista)
  - Rotação (inativo, leve, normal, pesado)
  - Horários permitidos (madrugada, manhã, tarde, noite)
- **Deletar**: Remove música do banco e do sistema de arquivos

### Sistema de Rotação

- **Inativo**: Música não toca automaticamente (apenas por pedidos)
- **Leve**: Música toca menos na rotação automática
- **Normal**: Frequência padrão
- **Pesado**: Música toca mais frequentemente

### Gerenciamento de Pedidos

Acesse em: `http://localhost:3000/admin/requests`

- **Visualizar**: Lista paginada de todos os pedidos
- **Adicionar**: Adiciona nova música à fila
- **Reordenar**: Move pedidos para cima ou para baixo na fila
- **Deletar**: Remove pedido da fila

## Estrutura do Banco de Dados

### Tabela `songs`

- `rotation`: Campo que define a frequência de reprodução
  - `inativo`: Não toca automaticamente
  - `leve`: Peso baixo na rotação
  - `normal`: Peso médio (padrão)
  - `pesado`: Peso alto na rotação

### Tabela `requests`

- `order`: Ordem do pedido na fila
- `songId`: ID da música pedida
- `createdAt`: Data de criação

## Segurança

- Autenticação via senha plana (armazenada em `.env`)
- Senha é mantida no sessionStorage do navegador
- Todas as actions verificam a senha antes de executar operações

## Tecnologias

- Next.js 16 (App Router)
- Server Actions
- Drizzle ORM
- node-id3 para edição de tags
- TailwindCSS
- Lucide React (ícones)
- Sonner (toasts)

## Integração do Sistema de Rotação

Para usar o sistema de rotação em sua aplicação, importe o helper:

```typescript
import { selectRandomSong, getNextSongToPlay } from "@/lib/rotation";

// Selecionar uma música aleatória baseada no peso
const song = await selectRandomSong();

// Selecionar próxima música (excluindo a atual)
const nextSong = await getNextSongToPlay(currentSongId);
```

O sistema automaticamente:
- Exclui músicas marcadas como "inativo"
- Respeita os horários permitidos (timeSlots)
- Pondera a seleção baseado no peso de rotação
- Evita repetir a música atual
