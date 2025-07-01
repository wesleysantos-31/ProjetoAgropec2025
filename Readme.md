# 🚜 Projeto AGROPEC 2025 - Aplicativo Web Interativo
Este é um aplicativo web completo e interativo, desenvolvido para a feira AGROPEC 2025. O sistema serve como um guia digital para os visitantes do evento e uma poderosa ferramenta de gerenciamento de conteúdo para os organizadores, utilizando o Firebase como backend para dados em tempo real.

# 🚀 Principais Funcionalidades
O sistema é dividido em duas grandes áreas, com funcionalidades específicas para cada tipo de usuário.

### 🧍 Para Visitantes

* **Painel Principal Dinâmico:** A página inicial apresenta um resumo...
* **Agenda Completa do Evento:**
  
  * Listagem de todas as palestras...
  * Ferramenta para filtrar eventos...

### 🧍 Para Visitantes
* **Painel Principal Dinâmico:** A página inicial apresenta um resumo do evento com um carrossel de imagens, as 3 notícias mais recentes, o próximo evento da agenda e cartões de informações gerais.

Agenda Completa do Evento:

Listagem de todas as palestras, workshops e demonstrações.

Ferramenta para filtrar eventos por data e tipo.

Funcionalidade "Adicionar ao Calendário", que permite baixar um arquivo .ics para importar o evento no calendário pessoal do usuário.

Gráfico que visualiza a quantidade de eventos por dia.

Guia de Expositores:

Galeria com todos os expositores, exibidos em ordem alfabética, com logo, nome, categoria e descrição.

Campo de busca para encontrar expositores por nome ou palavra-chave.

Gráfico de pizza que mostra a distribuição de expositores por categoria.

Mapa Interativo (Desktop e Mobile):

Visualização de um mapa vetorial (.svg) da feira.

Estandes marcados como pontos interativos que, ao serem clicados/tocados, abrem um modal com as informações do expositor.

Suporte completo a gestos de toque em dispositivos móveis, incluindo arrastar (pan) e pinça para zoom.

Animação de "pulso" nos pontos do mapa para chamar a atenção do usuário.

Página de Notícias e Sobre:

Uma seção de arquivo com todas as notícias do evento, em ordem cronológica.

Página "Sobre" com informações institucionais do evento.

Autenticação Anônima: Permite que visitantes acessem o conteúdo sem a necessidade de criar uma conta.

⚙️ Para Administradores (Painel do Organizador)
Acesso Restrito: Autenticação com e-mail e senha para acessar o painel de gerenciamento. As seções de administração são completamente ocultas para usuários não autorizados.

Gerenciamento de Conteúdo (Interface com Abas):

Notícias: Criação, edição e exclusão de notícias em tempo real.

Eventos: Gerenciamento completo da agenda, com formulários para adicionar, editar e remover palestras e outros tipos de eventos.

Expositores: Adição, edição e remoção das informações de cada expositor.

Informações Gerais: Controle total sobre os cartões de "Informações Gerais" exibidos na página inicial.

Gerenciamento de Estandes no Mapa:

Um mapa interativo exclusivo para administradores, com cursor em formato de mira (crosshair).

Funcionalidade de clicar em qualquer ponto do mapa para obter as coordenadas (X, Y) exatas de uma nova estande.

Formulário para cadastrar novas estandes, associando um ID e um ocupante (expositor) às coordenadas selecionadas no mapa.

Listagem e gerenciamento (editar/excluir) de todas as estandes já cadastradas.

🛠️ Tecnologias Utilizadas
Backend:

Firebase Authentication: Para autenticação de administradores (e-mail/senha) e visitantes (anônima).

Firestore Database: Como banco de dados NoSQL em tempo real para todo o conteúdo dinâmico.

Frontend:

JavaScript (Vanilla JS): Projeto construído com JavaScript puro e moderno (Módulos ES6), sem frameworks.

CSS: Estilização com Tailwind CSS e um arquivo CSS personalizado (style.css).

HTML5 Semântico.

Bibliotecas:

Chart.js: Para a criação dos gráficos de visualização de dados.

Flatpickr: Para os seletores de data e hora amigáveis nos formulários de administração.

🔑 Credenciais para Teste (Administrador)
Para acessar o painel de gerenciamento e testar as funcionalidades de administrador, utilize as seguintes credenciais na tela de login:

📬 E-mail: contadeteste@gmail.com

🔑 Senha: contadeteste123
