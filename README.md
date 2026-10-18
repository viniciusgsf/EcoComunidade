# EcoComunidade — execução local

## Neon

O projeto está ligado ao Neon `muddy-base-02874853`, branch `production`. O CLI criou `.env.local` com a URL do banco; mantenha esse arquivo fora do Git.

## Instalar e executar

1. Instale as dependências do backend na raiz: `npm install`.
2. Crie um segredo de moderação longo e aleatório e adicione `MODERATOR_TOKEN=...` ao arquivo `.env.local`. Não compartilhe nem versione esse segredo.
3. Rode `npm run build` para verificar a sintaxe.
4. Rode `npm start` e abra `http://localhost:3000`.

Na primeira inicialização, o backend cria as tabelas `listings`, `listing_reports`, `app_users`, `auth_sessions` e `collection_points`. Os anúncios começam como `pending` e só aparecem publicamente após aprovação.

## Contas e moderação

Contas comuns recebem o papel `member`. O papel `moderator` é atribuído somente no banco por um administrador; não há opção de autoelevação no cadastro. Moderadores conectados veem **Moderação** no menu e podem aprovar/rejeitar anúncios, remover um anúncio denunciado ou arquivar a denúncia. A API também verifica o papel da sessão, além de ocultar o controle na interface.

Para promover manualmente outra conta, faça uma alteração administrativa controlada usando o e-mail conhecido da pessoa. Não promova contas apenas com base em nome de exibição; nomes podem coincidir. A conta de Vinicius Guilherme foi localizada sem ambiguidade pelo nome de exibição e promovida nesta instância.

## Pontos de coleta por proximidade

Na tela “Pontos de coleta”, a pessoa escolhe **Usar minha localização**. O navegador pede permissão e o frontend usa uma posição única para calcular a distância em linha reta (Haversine) e ordenar os locais confirmados do mais próximo ao mais distante. As coordenadas do visitante não são enviadas ao servidor nem guardadas; o acesso é opcional. Filtros disponíveis: óleo de cozinha, entulho e recicláveis. O botão “Como chegar” abre o Google Maps com o destino do ponto.

O endpoint `GET /api/collection-points` retorna exclusivamente registros com `verified = TRUE` e `active = TRUE`. Não há locais fictícios inseridos. Antes de publicar um ponto, um responsável deve confirmar nome, endereço, materiais aceitos, horário e coordenadas e só então marcar o registro como verificado. A estrutura está na tabela `collection_points`.

Os primeiros pontos adicionados são PEVs em São José dos Campos, Caçapava e Jacareí, com links para as fontes municipais em cada cartão. Jacareí informa que os LEVs estavam em obras em agosto de 2026, portanto esses registros ficam inativos até uma confirmação de reabertura. Endereços sem uma coordenada OSM confiável continuam listados, mas não recebem estimativa de distância. As distâncias são em linha reta e as coordenadas cartográficas têm atribuição do OpenStreetMap.

Para repetir o carregamento idempotente dos pontos iniciais, rode `npm run seed:collection-points`.

## Moderação e verificação ponta a ponta

Com o servidor ativo e `MODERATOR_TOKEN` definido, rode `npm run test:e2e`. O teste verifica a conexão Neon, criação de anúncio pendente, aprovação autenticada, listagem pública, denúncia e remoção do registro de teste.

A fila da interface está disponível pelo item **Moderação**, visível apenas para contas com papel `moderator`. As rotas `GET /api/moderation/listings` e `GET /api/moderation/reports` verificam o papel na sessão. Para aprovar ou rejeitar via API, envie `PATCH /api/moderation/listings/:id` com `{"status":"approved"}` ou `{"status":"rejected"}`. A exclusão é `DELETE /api/moderation/listings/:id` e o arquivamento de denúncias é `DELETE /api/moderation/reports/:id`. O token local segue como fallback para testes/manutenção.

## Limites atuais

- O cadastro usa autenticação própria com sessões no banco; ainda não tem verificação de e-mail nem recuperação de senha.
- A publicação exige sessão, e anúncios passam por revisão; isso reduz risco, mas não prova que o objeto existe.
- As fotos pequenas são guardadas como dados no Postgres. Para uso maior, adote armazenamento de objetos.
- O token de moderação continua disponível somente como fallback local para testes/manutenção; não o exponha no frontend nem em logs.
