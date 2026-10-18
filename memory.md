# Memória do projeto — EcoComunidade ADS

## Objetivo
Aplicativo web/mobile comunitário de economia circular e descarte sustentável. O foco inicial é ajudar moradores do bairro a descartar óleo de cozinha e entulho corretamente e facilitar a doação/troca de móveis e sobras de obras.

## Usuários e experiência
- Público prioritário: idosos e pessoas com baixo letramento digital.
- Priorizar interface minimalista, alto contraste, botões grandes, textos curtos e ícones claros.
- Evitar cadastros burocráticos e formulários extensos; manter navegação direta e simples.

## Funcionalidades previstas
1. **Mapa de coleta e ecopontos:** mostrar pontos de óleo, entulho/restos de obras e parceiros locais; apresentar nome, endereço, horário e ação “Como chegar”.
2. **Mural de trocas e doações:** cards com foto, título, localização aproximada e categoria; permitir publicar item com descrição simples e contato por WhatsApp.
3. **Guia educativo:** instruções breves e visuais sobre armazenamento de óleo usado e separação de resíduos de obra.

## Privacidade e segurança
- Tratar dados de localização e contato com cuidado e coletar apenas o necessário.
- Considerar LGPD; o projeto prevê coleta anonimizada quando aplicável.
- Não incluir dados pessoais reais ou credenciais em exemplos e dados de demonstração.

## Estado técnico conhecido
- Ainda não há stack tecnológica definida. A especificação sugere HTML/CSS/JavaScript (incluindo React ou Vue), Leaflet/OpenStreetMap e backend Node.js ou Python, com SQLite, PostgreSQL ou Firebase/Supabase como possibilidades.
- Confirmar a estrutura e as tecnologias existentes no repositório antes de implementar; tratar as opções acima como sugestões, não como decisões.

## Diretrizes para próximas alterações
- Manter o escopo centrado na comunidade e no descarte/reuso sustentável.
- Preferir fluxos simples, acessíveis e mobile-first.
- Não inventar locais, horários de coleta ou regras municipais; usar fontes confiáveis ou marcar dados fictícios claramente.
