// pt-AO text for the component reference in the transport guide (docs/transport.html).
// Keyed by ComponentDoc.id; `lead` and `note` translate the English `lead` and
// `populateNote` of docs/src/components.ts. Code, prop names and prop descriptions
// stay in English. Pre-AO90 orthography, like the rest of the guide.

export const COMPONENT_PT: Record<string, { lead: string; note?: string }> = {
  "c-datatable": {
    lead: "Uma tabela ordenável, pesquisável e paginada, com selecção, acções por linha, exportação (CSV/XLS/XLSX), cabeçalho fixo, densidade e estado de carregamento.",
    note: "Popula-a com um array simples + uma `rowKey`. As colunas mapeiam por `key`; usa `value` para ordenar/exportar e `render` para células próprias. Passa um accessor `() => rows()` para a tornar reactiva.",
  },
  "c-tablelist": {
    lead: "O irmão mais leve do dataTable: uma lista sem paginação, com ordenação, selecção, exportação, carregamento e densidade opcionais — ideal para painéis compactos.",
    note: "A mesma forma do dataTable — colunas + linhas + rowKey — mas sem paginação. Acrescenta `sortable` por coluna para ordenar com um clique.",
  },
  "c-calendar": {
    lead: "Um calendário mensal inteligente: correcto em UTC, localizado com Intl, com um motor de feriados embutido e extensível (conhece os feriados de Angola) e pontos de eventos.",
    note: "Os eventos são um array simples de { date, title, tone? }. Os feriados vêm do motor offline (holidaysFor) ou do teu próprio fornecedor — sem rede.",
  },
  "c-searchfilter": {
    lead: "Uma barra de pesquisa e filtros ao estilo Odoo: chips de facetas ao escrever, menus de Filtros e Agrupar por, e o atalho Ctrl/⌘+K para lhe dar foco.",
    note: "O onChange entrega-te { facets, filters, groupBy }. Filtra as linhas com o helper puro `matchFacets` (OU dentro de um campo, E entre campos).",
  },
  "c-metrics": {
    lead: "Tiles de KPI ricos com valor, seta de variação, sparkline em linha e clique opcional — numa grelha responsiva.",
  },
  "c-gantt": {
    lead: "Uma linha do tempo compacta de tarefas com barras de % e progresso, desenhada em SVG seguro para CSP.",
  },
  "c-planner": {
    lead: "Uma grelha de agenda semanal: uma calha de horas + 7 colunas de dias com blocos de eventos posicionados.",
  },
  "c-select2": {
    lead: "Uma combobox com filtro ao escrever e selecção simples ou múltipla (ao estilo select2), segura para CSP.",
  },
  "c-button": {
    lead: "Um botão com variantes (primary · default · ghost · subtle · danger), a escala de tamanhos xs→xxl, estado de carregamento e ícones.",
  },
  "c-field": {
    lead: "Um input com rótulo e ligação de dica/erro (a11y), construído sobre o input base. E ainda select, switch, checkbox e radioGroup.",
  },
  "c-rating": {
    lead: "Uma classificação por estrelas acessível — interactiva ou só de leitura, com meias-estrelas opcionais e a escala de tamanhos.",
  },
  "c-map": {
    lead: "Um mapa-mundo SVG autónomo (sem tiles externos) que marca pontos por longitude/latitude — seguro para CSP.",
  },
  "c-carousel": {
    lead: "Um carrossel de slides com setas, pontos, teclado e reprodução automática opcional.",
  },
  "c-buttongroup": {
    lead: "Um grupo horizontal de botões com as bordas unidas, para acções segmentadas como um intervalo de datas.",
    note: "O argumento é um array simples de templates de botão; o estilo do grupo une as bordas.",
  },
  "c-badge": {
    lead: "Uma etiqueta de estado compacta e quadrada — a contraparte quadrada da pill arredondada.",
    note: "badge(label, tone) recebe argumentos posicionais — não um objecto de opções.",
  },
  "c-input": {
    lead: "Um input de texto simples e estilizado, ligado a um accessor de valor e a um callback onInput.",
    note: "Controlado: passa um signal para value e escreve-o de volta no onInput.",
  },
  "c-textarea": {
    lead: "Um input de texto com várias linhas — as mesmas opções do input, mais o número de linhas.",
    note: "O textarea aceita todas as opções do input excepto type, e acrescenta rows.",
  },
  "c-select": {
    lead: "Um <select> nativo estilizado, com teclado e acessibilidade de graça.",
    note: "options é um array de { value, label, disabled? }; placeholder acrescenta uma primeira opção desactivada.",
  },
  "c-switch": {
    lead: "Um interruptor (role=switch) cujo estado vive em aria-checked, lido pelo CSS.",
    note: "Controlado: checked é um accessor booleano e o onChange recebe o booleano seguinte.",
  },
  "c-checkbox": {
    lead: "Uma checkbox estilizada, ligada a um accessor checked e a um callback onChange.",
    note: "Usa ariaLabel em vez de label quando não há texto visível.",
  },
  "c-radio": {
    lead: "Um grupo de rádio de escolha única, ligado a um accessor de valor e a um callback onChange.",
    note: "options é um array de { value, label, disabled? }; value guarda a opção seleccionada.",
  },
  "c-tagsinput": {
    lead: "Um campo de tokens: escreve e carrega em Enter (ou vírgula) para acrescentar uma tag; Backspace remove a última.",
    note: "Controlado via value + onChange; o separador por omissão é a vírgula (Enter confirma sempre).",
  },
  "c-pill": {
    lead: "Uma pill de estado arredondada — a contraparte arredondada do badge quadrado.",
    note: "pill(label, tone) recebe argumentos posicionais — não um objecto de opções.",
  },
  "c-card": {
    lead: "Uma superfície com título opcional e conteúdo arbitrário.",
    note: "body é qualquer TemplateResult (ou um accessor reactivo); title é opcional.",
  },
  "c-appshell": {
    lead: "Uma estrutura de dashboard: navegação lateral escura mais uma barra de topo (pesquisa e utilizador) sobre o conteúdo.",
    note: "Responsivo: abaixo de ~860px a barra lateral passa a uma gaveta deslizante, aberta por um botão hamburger.",
  },
  "c-statcard": {
    lead: "Um tile de KPI com rótulo, valor e uma variação opcional com tom.",
    note: "value e delta podem ser accessors reactivos; tone dá a cor à variação.",
  },
  "c-statgrid": {
    lead: "Uma grelha responsiva de tiles de KPI, construída a partir de um array de opções de statCard.",
    note: "O argumento é um array simples de opções de statCard; a grelha dispõe-nos de forma responsiva.",
  },
  "c-alert": {
    lead: "Um aviso para estado ou explicação em linha, colorido pelo tom.",
    note: "Sem onDismiss o aviso não se fecha; o tom neg usa role=\"alert\".",
  },
  "c-modal": {
    lead: "Um diálogo centrado sobre um fundo, fechado com Esc ou um clique no fundo.",
    note: "open é um Maybe<boolean> — passa um signal para o diálogo reagir; fica escondido enquanto for false.",
  },
  "c-tooltip": {
    lead: "Uma dica que aparece ao passar o rato e ao receber foco, revelada só com CSS, sem estilos inline.",
    note: "A dica liga-se via aria-describedby; aparece tanto ao passar o rato como com o foco do teclado.",
  },
  "c-skeleton": {
    lead: "Um marcador cintilante para conteúdo que ainda está a carregar.",
    note: "lines só se aplica a kind=\"line\" (por omissão 3); todas as variantes são aria-hidden.",
  },
  "c-spinner": {
    lead: "Um pequeno indicador de carregamento indeterminado, com rótulo acessível.",
    note: "O rótulo é um argumento posicional, não um objecto de opções; por omissão é \"Loading\".",
  },
  "c-progress": {
    lead: "Uma barra de progresso determinada, construída sobre o elemento nativo <progress>.",
    note: "A percentagem mostrada é value/max arredondado; value pode ser um signal para actualizações ao vivo.",
  },
  "c-meter": {
    lead: "Um medidor de uso fino em linha, cuja largura de preenchimento é um atributo SVG seguro para CSP.",
    note: "value é limitado a 0..1; o preenchimento usa um atributo width do SVG, por isso passa o style-src.",
  },
  "c-topprogress": {
    lead: "Uma barra de progresso fina no topo da página para mudanças de rota, determinada ou indeterminada.",
    note: "Sem value a barra mostra um brilho indeterminado; done esconde-a.",
  },
  "c-emptystate": {
    lead: "Um marcador mostrado quando uma lista ou vista não tem conteúdo, com uma acção opcional.",
    note: "action é opcional; omite-a para um estado vazio só com mensagem.",
  },
  "c-tabs": {
    lead: "Uma barra de separadores sublinhados (role=tablist) cujo separador activo é lido de forma reactiva.",
    note: "Tanto active como a contagem por separador aceitam um accessor reactivo, por isso as actualizações renderizam no sítio.",
  },
  "c-segmented": {
    lead: "Um controlo de selecção única em grupo de pills, ao estilo iOS.",
  },
  "c-breadcrumb": {
    lead: "Um trilho de navegação em que cada elemento, excepto o último, pode ser um botão.",
    note: "O argumento é posicional: passa o array de elementos directamente, não um objecto de opções.",
  },
  "c-navpanel": {
    lead: "Um painel de navegação lateral agrupado, com ícones, rótulos e badges opcionais.",
  },
  "c-avatar": {
    lead: "Um avatar de utilizador que mostra uma imagem da mesma origem, ou as iniciais quando não há imagem.",
    note: "name passa a ser o texto alt da imagem ou o rótulo acessível do badge de iniciais.",
  },
  "c-divider": {
    lead: "Um separador horizontal, opcionalmente com um rótulo centrado.",
    note: "O rótulo é um argumento posicional, não um objecto de opções.",
  },
  "c-stack": {
    lead: "Um contentor flex, vertical por omissão, com controlo de espaçamento, alinhamento e quebra de linha.",
  },
  "c-grid": {
    lead: "Uma grelha CSS com número fixo de colunas, ou uma grelha auto-fit responsiva quando minCol está definido.",
    note: "minCol tem precedência sobre cols e passa a grelha para o modo auto-fit.",
  },
  "c-space": {
    lead: "Um espaçador de tamanho fixo, útil para separar itens em linha ou empilhados.",
    note: "O tamanho é um argumento posicional, não um objecto de opções.",
  },
  "c-splitter": {
    lead: "Dois painéis redimensionáveis unidos por um divisor arrastável e operável pelo teclado.",
    note: "A proporção vive num signal interno e segue uma propriedade CSS personalizada — sem estilos inline, sem listeners no document.",
  },
  "c-drawer": {
    lead: "Um painel deslizante sobre um fundo, controlado por um accessor open e fechado com Escape, um clique no fundo ou o botão de fechar do cabeçalho.",
    note: "open é um Maybe<boolean> — passa um accessor de signal para controlar a visibilidade de forma reactiva.",
  },
  "c-dropdown": {
    lead: "Um botão que abre um menu de acções navegável pelo teclado, que fecha ao seleccionar, com Escape ou quando o foco sai.",
  },
  "c-accordion": {
    lead: "Um conjunto de secções recolhíveis com estado de abertura próprio, uma de cada vez por omissão ou várias, reportando os ids abertos via onToggle.",
  },
  "c-stepper": {
    lead: "Um indicador de passos numerados (assistente): os passos antes do activo estão feitos, o activo é o actual e os restantes vêm a seguir.",
    note: "active é um Maybe<string | number> — um id ou um índice a partir de 0.",
  },
  "c-timeline": {
    lead: "Uma linha do tempo vertical de eventos — cada entrada é um ponto colorido pelo tom num carril, com título, hora opcional e corpo. Só conteúdo, sem estado.",
    note: "timeline recebe os itens como um único argumento posicional, não um objecto de opções.",
  },
  "c-popover": {
    lead: "Um painel flutuante ancorado a um botão (role=dialog) que abre com um clique e fecha com um segundo clique, Escape ou quando o foco sai.",
  },
  "c-popconfirm": {
    lead: "Um popover que pede confirmação antes de uma acção (normalmente destrutiva), com botões Cancelar / Confirmar e Escape para cancelar.",
  },
  "c-contextmenu": {
    lead: "Envolve uma região com um menu de clique direito aberto junto ao ponteiro, navegável pelo teclado e que fecha ao seleccionar, com Escape ou quando o foco sai.",
  },
  "c-pagination": {
    lead: "Um paginador autónomo: anterior/seguinte, botões numerados com reticências, um rótulo de intervalo opcional e um select de linhas por página. Controlado via page a partir de 0 + onPage.",
    note: "page e onPage contam ambos a partir de 0; pageCount é derivado de total/pageSize quando omitido.",
  },
  "c-datepicker": {
    lead: "Um selector de datas com grelha mensal, navegação anterior/seguinte e dias alcançáveis pelo teclado, localizável via monthNames/weekdayNames.",
    note: "Controlado: passa um signal para value e guarda a string ISO no onChange.",
  },
  "c-daterange": {
    lead: "Um selector de intervalos ao estilo Odoo: clica num dia de início e depois num dia de fim, com o intervalo entre eles realçado.",
    note: "As strings ISO comparam-se cronologicamente, por isso o teste de pertença ao intervalo dispensa contas com Date.",
  },
  "c-timer": {
    lead: "Uma contagem decrescente ou um cronómetro com mostrador mm:ss; o intervalo é desligado no cleanup, por isso pára quando o host é desmontado.",
    note: "Não há dados a fornecer — o timer é autónomo; escolhe só o modo, os segundos e se mostra os controlos.",
  },
  "c-slider": {
    lead: "Um input de intervalo estilizado cuja parte preenchida vem de uma propriedade CSS personalizada sincronizada por uma ref reactiva — sem estilo inline.",
  },
  "c-numberinput": {
    lead: "Um campo numérico ladeado por botões − e + que avançam e limitam a [min, max]; cada botão desactiva-se no seu limite.",
  },
  "c-timepicker": {
    lead: "Um selector de horas: um botão abre uma lista de horários HH:MM; o valor confirmado é sempre uma string \"HH:MM\" de 24h.",
  },
  "c-exportmenu": {
    lead: "Um botão com menu que exporta as linhas actuais para CSV, .xls ou um .xlsx verdadeiro — passa as colunas e um accessor de linhas sobre a vista actual.",
    note: "Genérico sobre o tipo de linha T; uma função value na coluna substitui a leitura por omissão row[key].",
  },
  "c-virtuallist": {
    lead: "Virtualização de listas: renderiza só as linhas dentro e perto da área visível, por isso uma lista de 100 mil linhas mantém meia dúzia de nós no DOM (altura de linha fixa).",
    note: "Usa-o em contexto de componente — o onMount liga o listener de scroll. Dá-lhe uma altura limitada pela opção height, não com CSS inline.",
  },
  "c-sparkline": {
    lead: "Um gráfico de tendência minúsculo em SVG puro — uma polilinha reactiva para tendências de KPI em linha; para gráficos completos usa @dxjs/charts.",
  },
  "c-metric": {
    lead: "Um tile de KPI rico: um valor com variação e seta pelo tom, uma tendência sparkline opcional, um ícone, uma dica e um invólucro clicável opcional.",
  },
  "c-image": {
    lead: "Uma imagem responsiva e com carregamento preguiçoso num <figure>, que troca para uma classe de marcador quando o carregamento falha.",
    note: "src tem de ser da mesma origem ou um URI data:; um carregamento falhado revela um marcador por classe, sem estilos inline.",
  },
  "c-video": {
    lead: "Um <video> da mesma origem num <figure>, com poster e controlos activos por omissão.",
    note: "Com uma CSP estrita o src do media tem de ser da mesma origem; um poster data: renderiza sempre.",
  },
  "c-desclist": {
    lead: "Um <dl> semântico de chave/valor, disposto numa grelha responsiva de uma, duas ou três colunas.",
    note: "Cada valor de DescItem pode ser texto simples, um template ou um accessor reactivo; define span para uma linha ocupar todas as colunas.",
  },
  "c-tree": {
    lead: "Uma vista em árvore hierárquica, navegável pelo teclado, em que os pais expandem/recolhem e as folhas seleccionam.",
    note: "Um TreeNode com um array children não vazio passa a ser pai; a selecção é controlada, por isso guarda-a num signal.",
  },
  "c-kanban": {
    lead: "Um quadro de colunas controlado, cujos cartões se movem por arrastar-e-largar ou por botões de seta alcançáveis pelo teclado.",
    note: "O componente renderiza e reporta os movimentos via onMove; quem o usa altera o seu próprio signal de colunas para os aplicar.",
  },
  "c-taskpanel": {
    lead: "Uma calha lateral de tarefas com contagem ao vivo, checkboxes de conclusão, badges de prioridade e barras de progresso.",
    note: "Passa uma lista simples de tasks ou secções agrupadas (groups tem precedência); a contagem do cabeçalho soma o que tiver sido dado.",
  },
  "c-commandpalette": {
    lead: "Um modal ⌘K que filtra comandos agrupados por rótulo/palavras-chave e executa o activo com Enter.",
    note: "Renderiza-o uma vez (escondido até abrir), controla o open a partir de fora e limpa-o no onClose; cada CommandItem traz o seu próprio onRun.",
  },
  "c-icon": {
    lead: "Um ícone de traço seguro para CSP, do conjunto embutido de 24×24, dimensionado em píxeis e colorido por currentColor.",
    note: "Os nomes vêm da união fixa IconName (ver iconNames); a cor é currentColor, por isso define uma color de CSS num antecessor.",
  },
  "c-fileupload": {
    lead: "Uma zona de arrastar-e-largar mais uma lista de ficheiros controlada, com tamanho, progresso e estado.",
    note: "O selector abre sem JavaScript (um <input> escondido); tu és dono da lista de itens e avanças o estado/progresso de cada ficheiro.",
  },
  "c-bottomsheet": {
    lead: "Um painel móvel que desliza a partir do fundo sobre um fundo escurecido, e fecha com Escape ou um clique no fundo.",
    note: "O deslizar é uma transformação CSS activada por classe (sem estilos inline); controla open a partir de um signal e limpa-o no onClose.",
  },
  "c-actionsheet": {
    lead: "Uma pilha de acções de toque grandes no fundo do ecrã, mais uma linha de cancelar, com semântica menu/menuitem.",
    note: "Seleccionar uma acção dispara o seu onSelect e fecha; Escape, o fundo e a linha de cancelar chamam o onClose.",
  },
  "c-tabbar": {
    lead: "Uma barra de navegação fixa no fundo, com separadores de ícone sobre rótulo e uma bolha de badge opcional.",
    note: "Cada TabBarItem precisa de um nome de ícone; a selecção é controlada, por isso guarda o id activo num signal e actualiza-o no onSelect.",
  },
  "c-fab": {
    lead: "Um botão de acção flutuante que dispara onClick ou abre um speed-dial vertical de acções.",
    note: "label é obrigatório porque o botão principal só tem ícone; passa actions para o transformar num menu speed-dial.",
  },
  "c-swipeactions": {
    lead: "Uma linha de lista que revela botões de acção ao ser arrastada para a esquerda, operável por ponteiro e teclado.",
    note: "As acções são sempre botões verdadeiros, por isso a linha continua utilizável sem ecrã táctil; clicar num dispara onSelect e fecha.",
  },
  "c-pulltorefresh": {
    lead: "Um contentor que actualiza quando é puxado para baixo a partir do topo, com um botão de actualizar verdadeiro para quem usa o teclado.",
    note: "Passar o PULL_THRESHOLD ao largar (ou clicar no botão indicador) chama onRefresh; devolve uma Promise para controlar o estado ocupado.",
  },
  "c-pickerwheel": {
    lead: "Um selector em roda vertical que centra a linha escolhida; uma listbox focável com navegação pelas setas.",
    note: "Cada WheelOption é { value, label }; value é controlado, por isso guarda-o num signal e actualiza-o no onChange.",
  },
};
