# Especificação Técnica do Aplicativo: EcoComunidade ADS

## 1. Visão Geral e Objetivo
O **EcoComunidade** é uma aplicação web e mobile focada em economia circular, geolocalização e descarte sustentável de resíduos para o bairro. O sistema visa resolver o descarte irregular de óleo de cozinha e entulho, além de promover um mural comunitário para doação e troca de móveis e sobras de obras.

### Público-Alvo e Diretrizes Principais de UX
* **Público Prioritário:** Idosos e moradores com baixo letramento digital.
* **Princípios de Interface:**
  * Design minimalista e alto contraste.
  * Botões grandes, textos curtos e ícones intuitivos (Nielsen Norman UX Guidelines).
  * Ausência de cadastros burocráticos ou formulários extensos.
  * Navegação direta por abas ou menu inferior simplificado.

---

## 2. Escopo Funcional (Módulos)

### Módulo A: Mapa de Coleta e Ecopontos (Geolocalização)
* **Visualização:** Mapa interativo leve (ex: Leaflet.js / OpenStreetMap) identificando a localização atual do usuário.
* **Filtros Simplificados:**
  * Coleta de Óleo de Cozinha.
  * Ecopontos de Entulho e Restos de Obras.
  * Pontos Parceiros (Comércios Locais / Cooperativas).
* **Detalhes do Ponto:** Cartão simples ao clicar contendo Nome, Endereço, Horário de Funcionamento e Botão "Como Chegar".

### Módulo B: Mural Comunitário de Trocas e Doações
* **Catálogo/Feed:** Lista visual em formato de cards simples contendo foto, título, bairro/rua e categoria.
* **Categorias:**
  * Móveis Usados.
  * Sobras de Obras / Materiais de Construção.
  * Outros / Utilidades.
* **Ação de Publicação:**
  * Formulário direto: Foto (upload/câmera), Título curto, Descrição simples, Categoria e Telefone/WhatsApp para contato direto.
* **Contato:** Botão direto "Chamar no WhatsApp" para negociação entre vizinhos sem intermediários.

### Módulo C: Guia Educativo Rápido
* **Instruções Curtas:** Dicas visuais sobre como armazenar o óleo de cozinha descartado e como separar sobras de entulho.

---

## 3. Arquitetura e Stack Tecnológica Recomendada

* **Linguagem Preferencial:** **TypeScript (`.ts` / `.tsx`)** obrigatoriamente para garantia de tipagem estática, manutenção do código e redução de erros em tempo de execução.
* **Frontend:** React ou Next.js em TypeScript (`.tsx`), utilizando componentes funcionais e Tailwind CSS para a estilização ágil e responsiva.
* **Mapas e Geolocalização:** Leaflet.js / React-Leaflet com suporte a tipos em TypeScript (`@types/leaflet`).
* **Backend / API:** Node.js com Express em TypeScript (`.ts`) ou integração serverless / Supabase com geração automática de tipos.
* **Banco de Dados:** PostgreSQL, SQLite ou Supabase (coleta anonimizada em conformidade com a LGPD para projetos acadêmicos).

---

## 4. Estrutura de Dados (Tipos TypeScript e Exemplo JSON)

### Tipagem em TypeScript (`types.ts`)
```typescript
export interface PontoColeta {
  id: string;
  nome: string;
  tipo: 'Oleos' | 'Entulho' | 'Ambos';
  latitude: number;
  longitude: number;
  horario: string;
  endereco: string;
}

export interface ItemMural {
  id: string;
  titulo: string;
  categoria: 'Moveis' | 'SobrasDeObras' | 'Outros';
  descricao: string;
  fotoUrl?: string;
  contatoWhatsapp: string;
  dataCriacao: string;
}
{
  "ponto_coleta": {
    "id": "ponto_01",
    "nome": "Ecoponto Bairro Central",
    "tipo": "Ambos",
    "latitude": -23.305,
    "longitude": -45.966,
    "horario": "Seg a Sex: 08h às 17h",
    "endereco": "Rua Exemplo, 123"
  },
  "item_mural": {
    "id": "item_101",
    "titulo": "Sacos de Cimento / Sobras de Piso",
    "categoria": "SobrasDeObras",
    "descricao": "Sobrou da reforma, em bom estado para doação.",
    "fotoUrl": "[https://link-da-imagem.com/piso.jpg](https://link-da-imagem.com/piso.jpg)",
    "contatoWhatsapp": "5512999999999",
    "dataCriacao": "2026-10-18"
  }
}
5. Requisitos Não Funcionais

    Performance: Carregamento ultra-rápido otimizado para conexões móveis fracas (3G/4G).

    Acessibilidade: Fontes legíveis (tamanho mínimo 16px para textos de corpo, 20px+ para botões), suporte a leitores de tela e botões com área de toque ampla.

    Privacidade: Sem retenção desnecessária de dados pessoais (LGPD).