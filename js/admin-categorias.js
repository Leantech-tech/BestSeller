/**
 * admin-categorias.js - CRUD de Categorias
 */
const API_BASE = '';
let categoriasData = [];
let paginaAtual = 1;
const porPagina = 10;
let categoriaExcluirId = null;

function $(id) { return document.getElementById(id); }

// Menu mobile
$('menuToggle')?.addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
});

// Toast
function toast(message, type = 'success') {
    const container = $('toastContainer');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
    div.innerHTML = `<i class="fas ${icon}"></i><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

// Slugify
function slugify(text) {
    return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ============================================================
// SELETOR DE ÍCONES
// ============================================================
const ICONES_DISPONIVEIS = [
    'fa-house','fa-home','fa-building','fa-store','fa-shop',
    'fa-bath','fa-shower','fa-toilet','fa-soap','fa-pump-soap',
    'fa-snowflake','fa-wind','fa-fan','fa-temperature-half','fa-fire',
    'fa-utensils','fa-bread-slice','fa-sink','fa-blender','fa-mug-hot',
    'fa-couch','fa-chair','fa-bed','fa-award','fa-flag',
    'fa-plug','fa-bolt','fa-lightbulb','fa-power-off','fa-network-wired',
    'fa-link','fa-chain','fa-screwdriver-wrench','fa-hammer','fa-wrench',
    'fa-tools','fa-toolbox','fa-screwdriver','fa-gavel','fa-ruler',
    'fa-paint-roller','fa-paintbrush','fa-spray-can','fa-fill-drip','fa-palette',
    'fa-layer-group','fa-cubes','fa-border-all','fa-table-cells','fa-th-large',
    'fa-door-open','fa-door-closed','fa-window-maximize','fa-archway','fa-align-justify',
    'fa-faucet','fa-droplet','fa-water','fa-ship','fa-wine-bottle',
    'fa-leaf','fa-seedling','fa-tree','fa-feather','fa-plant-wilt',
    'fa-industry','fa-hammer','fa-hard-hat','fa-user-tie','fa-ruler-combined',
    'fa-paw','fa-cat','fa-dog','fa-fish','fa-dove',
    'fa-car','fa-truck','fa-truck-fast','fa-truck-moving','fa-box',
    'fa-box-open','fa-boxes-stacked','fa-warehouse','fa-dolly','fa-cart-flatbed',
    'fa-tags','fa-tag','fa-barcode','fa-receipt','fa-file-invoice',
    'fa-users','fa-user','fa-user-group','fa-people-group','fa-person',
    'fa-image','fa-images','fa-photo-film','fa-camera','fa-video',
    'fa-gear','fa-gears','fa-sliders','fa-toggle-on','fa-toggle-off',
    'fa-chart-line','fa-chart-pie','fa-chart-bar','fa-chart-area','fa-chart-column',
    'fa-money-bill','fa-money-bill-wave','fa-credit-card','fa-wallet','fa-coins',
    'fa-calendar','fa-calendar-days','fa-clock','fa-hourglass','fa-stopwatch',
    'fa-bell','fa-bullhorn','fa-envelope','fa-paper-plane','fa-comment',
    'fa-heart','fa-star','fa-thumbs-up','fa-face-smile','fa-face-grin',
    'fa-circle-info','fa-circle-question','fa-circle-exclamation','fa-triangle-exclamation','fa-ban',
    'fa-check','fa-xmark','fa-plus','fa-minus','fa-trash',
    'fa-pen','fa-pen-to-square','fa-copy','fa-paste','fa-scissors',
    'fa-magnifying-glass','fa-filter','fa-sort','fa-ellipsis-h','fa-ellipsis-vertical',
    'fa-bars','fa-list','fa-table-list','fa-border-none','fa-grip-horizontal',
    'fa-cloud','fa-sun','fa-moon','fa-cloud-rain','fa-bolt',
    'fa-music','fa-volume-high','fa-microphone','fa-headphones','fa-radio',
    'fa-gamepad','fa-puzzle-piece','fa-chess','fa-dice','fa-trophy',
    'fa-medal','fa-crown','fa-gift','fa-cake-candles','fa-balloon',
    'fa-book','fa-book-open','fa-newspaper','fa-file-lines','fa-folder',
    'fa-lock','fa-unlock','fa-key','fa-shield-halved','fa-eye',
    'fa-motorcycle','fa-bicycle','fa-bus','fa-train','fa-plane',
    'fa-globe','fa-map','fa-location-dot','fa-road','fa-signs-post',
    'fa-mobile','fa-laptop','fa-desktop','fa-tablet','fa-print',
    'fa-wifi','fa-signal','fa-battery-full','fa-plug-circle-bolt','fa-solar-panel',
    'fa-shirt','fa-vest','fa-glasses','fa-mask','fa-socks',
    'fa-utensils','fa-burger','fa-pizza-slice','fa-ice-cream','fa-cookie',
    'fa-wine-glass','fa-beer-mug-empty','fa-martini-glass','fa-whiskey-glass','fa-champagne-glasses',
    'fa-apple-whole','fa-lemon','fa-carrot','fa-pepper-hot','fa-egg',
    'fa-dumbbell','fa-person-running','fa-person-swimming','fa-basketball','fa-futbol',
    'fa-spa','fa-mosque','fa-church','fa-torii-gate','fa-place-of-worship',
    'fa-graduation-cap','fa-school','fa-university','fa-chalkboard','fa-book-open-reader',
    'fa-hospital','fa-stethoscope','fa-pills','fa-syringe','fa-heart-pulse',
    'fa-baby','fa-baby-carriage','fa-person-pregnant','fa-hands-holding-child','fa-child',
    'fa-paw','fa-kiwi-bird','fa-horse','fa-cow','fa-piggy-bank',
    'fa-dragon','fa-ghost','fa-skull','fa-spider','fa-bacterium',
    'fa-flask','fa-atom','fa-microscope','fa-dna','fa-vial',
    'fa-rocket','fa-satellite','fa-user-astronaut','fa-shuttle-space','fa-meteor'
];

// Traduções pt-BR para busca de ícones
const ICONES_TRADUCOES = {
    'fa-house': ['casa', 'residencia', 'lar', 'moradia'],
    'fa-home': ['casa', 'lar', 'inicio', 'moradia'],
    'fa-building': ['predio', 'edificio', 'empresa', 'escritorio', 'prédio', 'edifício', 'escritório'],
    'fa-store': ['loja', 'comercio', 'mercado', 'comércio'],
    'fa-shop': ['loja', 'butique', 'comercio', 'comércio'],
    'fa-bath': ['banho', 'banheira', 'hidromassagem', 'spa'],
    'fa-shower': ['chuveiro', 'banho', 'ducha'],
    'fa-toilet': ['vaso', 'banheiro', 'privada', 'toalete'],
    'fa-soap': ['sabao', 'higiene', 'limpeza', 'sabão'],
    'fa-pump-soap': ['sabonete', 'dispensador', 'higiene', 'sabão'],
    'fa-snowflake': ['floco', 'neve', 'frio', 'gelo', 'ar condicionado'],
    'fa-wind': ['vento', 'ar', 'brisa', 'ventilacao', 'ventilação'],
    'fa-fan': ['ventilador', 'ar', 'cooler', 'exaustor'],
    'fa-temperature-half': ['temperatura', 'termometro', 'clima', 'termostato', 'termômetro'],
    'fa-fire': ['fogo', 'chama', 'aquecedor', 'aquecimento'],
    'fa-utensils': ['talheres', 'cozinha', 'restaurante', 'comida', 'utensilios', 'utensílios'],
    'fa-bread-slice': ['pao', 'padaria', 'torrada', 'pão'],
    'fa-sink': ['pia', 'cozinha', 'lavatorio', 'lavatório'],
    'fa-blender': ['liquidificador', 'cozinha', 'mixer'],
    'fa-mug-hot': ['caneca', 'cafe', 'chocolate', 'café', 'xicara', 'xícara'],
    'fa-couch': ['sofa', 'estofado', 'sala', 'sofá', 'poltrona'],
    'fa-chair': ['cadeira', 'assento', 'banqueta'],
    'fa-bed': ['cama', 'quarto', 'dormitorio', 'dormitório', 'hotel'],
    'fa-award': ['premio', 'trofeu', 'conquista', 'prêmio', 'troféu', 'medalha'],
    'fa-flag': ['bandeira', 'marcador', 'sinalizacao', 'sinalização', 'pais', 'país'],
    'fa-plug': ['tomada', 'plugue', 'eletricidade', 'conector'],
    'fa-bolt': ['raio', 'energia', 'eletricidade', 'trovao', 'trovão', 'flash'],
    'fa-lightbulb': ['lampada', 'ideia', 'iluminacao', 'luz', 'lâmpada', 'iluminação'],
    'fa-power-off': ['ligar', 'desligar', 'energia', 'botao', 'botão'],
    'fa-network-wired': ['rede', 'internet', 'conexao', 'conexão', 'cabos', 'lan'],
    'fa-link': ['link', 'corrente', 'url', 'conexao', 'conexão'],
    'fa-chain': ['corrente', 'elo', 'link'],
    'fa-screwdriver-wrench': ['ferramentas', 'conserto', 'manutencao', 'manutenção', 'chave'],
    'fa-hammer': ['martelo', 'construcao', 'construção', 'ferramenta'],
    'fa-wrench': ['chave', 'ferramenta', 'ajuste', 'configuracao', 'configuração'],
    'fa-tools': ['ferramentas', 'equipamentos', 'oficina'],
    'fa-toolbox': ['caixa', 'ferramentas', 'maleta'],
    'fa-screwdriver': ['chave', 'ferramenta', 'parafuso'],
    'fa-gavel': ['martelo', 'justica', 'leilao', 'justiça', 'lei', 'juiz'],
    'fa-ruler': ['regua', 'medida', 'régua', 'comprimento', 'metrica', 'métrica'],
    'fa-paint-roller': ['rolo', 'tinta', 'pintura', 'parede'],
    'fa-paintbrush': ['pincel', 'tinta', 'arte', 'pintura'],
    'fa-spray-can': ['spray', 'tinta', 'aerosol', 'pintura'],
    'fa-fill-drip': ['tinta', 'preencher', 'cor', 'balde'],
    'fa-palette': ['paleta', 'cores', 'arte', 'pintura', 'design'],
    'fa-layer-group': ['camadas', 'pilha', 'empilhar', 'organizar'],
    'fa-cubes': ['cubos', 'blocos', 'caixas', '3d'],
    'fa-border-all': ['borda', 'tabela', 'grade', 'grid', 'celulas', 'células'],
    'fa-table-cells': ['tabela', 'celulas', 'grade', 'grid', 'células', 'planilha'],
    'fa-th-large': ['grid', 'grade', 'blocos', 'quadrados'],
    'fa-door-open': ['porta', 'aberta', 'entrada', 'acesso', 'saida', 'saída'],
    'fa-door-closed': ['porta', 'fechada', 'seguranca', 'segurança', 'trancada'],
    'fa-window-maximize': ['janela', 'maximizar', 'tela', 'expandir'],
    'fa-archway': ['arco', 'entrada', 'portal', 'monumento'],
    'fa-align-justify': ['alinhamento', 'texto', 'justificado', 'editor'],
    'fa-faucet': ['torneira', 'agua', 'hidraulica', 'hidraulico', 'hidráulica', 'hidráulico', 'banheiro'],
    'fa-droplet': ['gota', 'agua', 'tinta', 'liquido', 'líquido', 'oleo', 'óleo'],
    'fa-water': ['agua', 'liquido', 'líquido', 'onda', 'mar', 'rio'],
    'fa-ship': ['navio', 'barco', 'embarcacao', 'embarcação', 'carga', 'transporte'],
    'fa-wine-bottle': ['garrafa', 'vinho', 'bebida', 'alcool', 'álcool'],
    'fa-leaf': ['folha', 'natureza', 'planta', 'ecologia', 'verde', 'meio ambiente'],
    'fa-seedling': ['muda', 'planta', 'broto', 'natureza', 'crescimento'],
    'fa-tree': ['arvore', 'natureza', 'floresta', 'madeira', 'árvore'],
    'fa-feather': ['pena', 'leveza', 'passaro', 'pássaro', 'escrita'],
    'fa-plant-wilt': ['planta', 'murcha', 'agricultura', 'seca', 'natureza'],
    'fa-industry': ['industria', 'indústria', 'fabrica', 'fábrica', 'producao', 'produção'],
    'fa-hard-hat': ['capacete', 'seguranca', 'segurança', 'construcao', 'construção', 'obra'],
    'fa-user-tie': ['usuario', 'usuário', 'executivo', 'empresario', 'empresário', 'negocio', 'negócio'],
    'fa-ruler-combined': ['regua', 'régua', 'medida', 'esquadro', 'geometria'],
    'fa-paw': ['pata', 'animal', 'pet', 'cachorro', 'gato'],
    'fa-cat': ['gato', 'felino', 'pet', 'animal'],
    'fa-dog': ['cachorro', 'cao', 'cão', 'pet', 'animal', 'cachorro'],
    'fa-fish': ['peixe', 'mar', 'aquario', 'aquário', 'animal'],
    'fa-dove': ['pomba', 'ave', 'passaro', 'pássaro', 'paz'],
    'fa-car': ['carro', 'veiculo', 'veículo', 'auto', 'automotivo', 'transporte'],
    'fa-truck': ['caminhao', 'caminhão', 'veiculo', 'veículo', 'transporte', 'entrega'],
    'fa-truck-fast': ['caminhao', 'caminhão', 'rapido', 'rápido', 'entrega', 'frete'],
    'fa-truck-moving': ['caminhao', 'caminhão', 'mudanca', 'mudança', 'transporte'],
    'fa-box': ['caixa', 'pacote', 'embalagem', 'produto'],
    'fa-box-open': ['caixa', 'aberta', 'pacote', 'entrega', 'unboxing'],
    'fa-boxes-stacked': ['caixas', 'pilha', 'estoque', 'armazenamento'],
    'fa-warehouse': ['deposito', 'depósito', 'galpao', 'galpão', 'estoque', 'armazem', 'armazém'],
    'fa-dolly': ['carrinho', 'transporte', 'mudanca', 'mudança', 'carregar'],
    'fa-cart-flatbed': ['carrinho', 'plataforma', 'transporte', 'carga'],
    'fa-tags': ['etiquetas', 'tags', 'precos', 'preços', 'promocao', 'promoção'],
    'fa-tag': ['etiqueta', 'tag', 'preco', 'preço', 'categoria', 'label'],
    'fa-barcode': ['codigo', 'código', 'barras', 'produto', 'scan', 'escanear'],
    'fa-receipt': ['recibo', 'nota', 'comprovante', 'cupom', 'fiscal'],
    'fa-file-invoice': ['fatura', 'nota', 'fiscal', 'documento', 'boleto'],
    'fa-users': ['usuarios', 'usuários', 'pessoas', 'grupo', 'equipe', 'time'],
    'fa-user': ['usuario', 'usuário', 'pessoa', 'perfil', 'conta', 'cliente'],
    'fa-user-group': ['grupo', 'pessoas', 'equipe', 'time', 'comunidade'],
    'fa-people-group': ['grupo', 'pessoas', 'equipe', 'time', 'turma'],
    'fa-person': ['pessoa', 'usuario', 'usuário', 'homem', 'mulher', 'humano'],
    'fa-image': ['imagem', 'foto', 'figura', 'quadro', 'arte'],
    'fa-images': ['imagens', 'fotos', 'galeria', 'album', 'álbum'],
    'fa-photo-film': ['foto', 'filme', 'video', 'vídeo', 'midia', 'mídia'],
    'fa-camera': ['camera', 'câmera', 'foto', 'fotografia', 'imagem'],
    'fa-video': ['video', 'vídeo', 'camera', 'câmera', 'filme', 'gravacao', 'gravação'],
    'fa-gear': ['engrenagem', 'configuracao', 'configuração', 'ajustes', 'opcao', 'opção', 'roda dentada'],
    'fa-gears': ['engrenagens', 'configuracoes', 'configurações', 'mecanismo', 'engenharia'],
    'fa-sliders': ['controle', 'ajuste', 'filtro', 'equalizador', 'configuracao', 'configuração'],
    'fa-toggle-on': ['ligado', 'ativo', 'botao', 'botão', 'interruptor'],
    'fa-toggle-off': ['desligado', 'inativo', 'botao', 'botão', 'interruptor'],
    'fa-chart-line': ['grafico', 'gráfico', 'linha', 'estatistica', 'estatística', 'relatorio', 'relatório', 'crescimento'],
    'fa-chart-pie': ['grafico', 'gráfico', 'pizza', 'estatistica', 'estatística', 'relatorio', 'relatório'],
    'fa-chart-bar': ['grafico', 'gráfico', 'barras', 'estatistica', 'estatística', 'relatorio', 'relatório'],
    'fa-chart-area': ['grafico', 'gráfico', 'area', 'área', 'estatistica', 'estatística'],
    'fa-chart-column': ['grafico', 'gráfico', 'colunas', 'estatistica', 'estatística'],
    'fa-money-bill': ['dinheiro', 'nota', 'pagamento', 'dinheiro', 'grana', 'real'],
    'fa-money-bill-wave': ['dinheiro', 'nota', 'pagamento', 'cash', 'dinheiro'],
    'fa-credit-card': ['cartao', 'cartão', 'credito', 'crédito', 'debito', 'débito', 'pagamento'],
    'fa-wallet': ['carteira', 'dinheiro', 'pagamento', 'bolsa'],
    'fa-coins': ['moedas', 'dinheiro', 'troco', 'ouro', 'riqueza'],
    'fa-calendar': ['calendario', 'calendário', 'data', 'agenda', 'evento'],
    'fa-calendar-days': ['calendario', 'calendário', 'data', 'agenda', 'dias'],
    'fa-clock': ['relogio', 'relógio', 'hora', 'tempo', 'cronometro', 'cronômetro'],
    'fa-hourglass': ['ampulheta', 'tempo', 'espera', 'cronometro', 'cronômetro'],
    'fa-stopwatch': ['cronometro', 'cronômetro', 'tempo', 'corrida', 'esporte'],
    'fa-bell': ['sino', 'campainha', 'notificacao', 'notificação', 'alarme', 'alerta'],
    'fa-bullhorn': ['megafone', 'comunicacao', 'comunicação', 'propaganda', 'anuncio', 'anúncio'],
    'fa-envelope': ['envelope', 'email', 'e-mail', 'carta', 'correio', 'mensagem'],
    'fa-paper-plane': ['aviao', 'avião', 'enviar', 'mensagem', 'telegram'],
    'fa-comment': ['comentario', 'comentário', 'chat', 'conversa', 'balao', 'balão', 'mensagem'],
    'fa-heart': ['coracao', 'coração', 'amor', 'curtir', 'favorito', 'like'],
    'fa-star': ['estrela', 'favorito', 'avaliacao', 'avaliação', 'nota', 'classificacao', 'classificação'],
    'fa-thumbs-up': ['curtir', 'like', 'positivo', 'aprovar', 'gostei', 'bom'],
    'fa-face-smile': ['sorriso', 'feliz', 'emoji', 'alegre', 'contente'],
    'fa-face-grin': ['risada', 'sorriso', 'feliz', 'emoji', 'alegre'],
    'fa-circle-info': ['informacao', 'informação', 'ajuda', 'detalhes', 'sobre', 'i'],
    'fa-circle-question': ['duvida', 'dúvida', 'pergunta', 'ajuda', 'interrogacao', 'interrogação', '?'],
    'fa-circle-exclamation': ['exclamacao', 'exclamação', 'atencao', 'atenção', 'alerta', 'aviso', '!'],
    'fa-triangle-exclamation': ['aviso', 'alerta', 'perigo', 'atencao', 'atenção', 'erro', 'cuidado'],
    'fa-ban': ['proibido', 'bloqueado', 'negado', 'cancelar', 'restricao', 'restrição'],
    'fa-check': ['verificado', 'ok', 'confirmar', 'aprovado', 'sim', 'correto', 'certo'],
    'fa-xmark': ['fechar', 'remover', 'cancelar', 'erro', 'negado', 'x', 'incorreto'],
    'fa-plus': ['mais', 'adicionar', 'novo', 'criar', 'soma', '+'],
    'fa-minus': ['menos', 'remover', 'subtrair', 'excluir', '-'],
    'fa-trash': ['lixeira', 'excluir', 'deletar', 'remover', 'apagar'],
    'fa-pen': ['caneta', 'editar', 'escrever', 'lapis', 'lápis', 'assinatura'],
    'fa-pen-to-square': ['editar', 'escrever', 'alterar', 'modificar', 'caneta'],
    'fa-copy': ['copiar', 'duplicar', 'clone', 'documento'],
    'fa-paste': ['colar', 'transferir', 'area', 'área', 'transferencia', 'transferência'],
    'fa-scissors': ['tesoura', 'cortar', 'recortar', 'editar'],
    'fa-magnifying-glass': ['lupa', 'buscar', 'pesquisar', 'procurar', 'pesquisa', 'zoom'],
    'fa-filter': ['filtro', 'filtrar', 'refinar', 'ordenar'],
    'fa-sort': ['ordenar', 'classificar', 'organizar', 'filtro', 'ordem'],
    'fa-ellipsis-h': ['mais', 'opcoes', 'opções', 'menu', 'pontos', '...'],
    'fa-ellipsis-vertical': ['mais', 'opcoes', 'opções', 'menu', 'pontos'],
    'fa-bars': ['menu', 'hamburguer', 'hambúrguer', 'lista', 'linhas'],
    'fa-list': ['lista', 'itens', 'menu', 'enumero', 'enumerar'],
    'fa-table-list': ['tabela', 'lista', 'planilha', 'dados', 'relatorio', 'relatório'],
    'fa-border-none': ['sem borda', 'limpo', 'sem grade'],
    'fa-grip-horizontal': ['arrastar', 'mover', 'grip', 'alca', 'alça', 'ordenar'],
    'fa-cloud': ['nuvem', 'clima', 'tempo', 'nublado', 'online'],
    'fa-sun': ['sol', 'clima', 'tempo', 'ensolarado', 'dia', 'calor'],
    'fa-moon': ['lua', 'noite', 'escuro', 'sono', 'madrugada'],
    'fa-cloud-rain': ['chuva', 'temporal', 'clima', 'nublado', 'tempo'],
    'fa-bolt': ['raio', 'energia', 'eletricidade', 'trovao', 'trovão', 'flash'],
    'fa-music': ['musica', 'música', 'som', 'nota', 'melodia'],
    'fa-volume-high': ['volume', 'som', 'audio', 'áudio', 'alto', 'musica', 'música'],
    'fa-microphone': ['microfone', 'gravar', 'som', 'audio', 'áudio', 'podcast', 'voz'],
    'fa-headphones': ['fone', 'ouvido', 'headset', 'audio', 'áudio', 'musica', 'música'],
    'fa-radio': ['radio', 'rádio', 'som', 'musica', 'música', 'fm', 'am'],
    'fa-gamepad': ['controle', 'jogo', 'videogame', 'game', 'joystick'],
    'fa-puzzle-piece': ['quebra-cabeca', 'quebra-cabeça', 'peca', 'peça', 'modulo', 'módulo', 'extensao', 'extensão'],
    'fa-chess': ['xadrez', 'jogo', 'estratégia', 'peça', 'peca', 'tabuleiro'],
    'fa-dice': ['dado', 'jogo', 'azar', 'sorte', 'rolar'],
    'fa-trophy': ['trofeu', 'troféu', 'vitoria', 'vitória', 'campeao', 'campeão', 'premio', 'prêmio'],
    'fa-medal': ['medalha', 'premio', 'prêmio', 'conquista', 'olimpiada', 'olimpíada'],
    'fa-crown': ['coroa', 'rei', 'rainha', 'premium', 'vip', 'top'],
    'fa-gift': ['presente', 'brinde', 'caixa', 'surpresa', 'festa', 'natal'],
    'fa-cake-candles': ['bolo', 'aniversario', 'aniversário', 'festa', 'velas', 'celebracao', 'celebração'],
    'fa-balloon': ['balao', 'balão', 'festa', 'celebracao', 'celebração', 'aniversario', 'aniversário'],
    'fa-book': ['livro', 'leitura', 'biblioteca', 'estudo', 'aprender'],
    'fa-book-open': ['livro', 'aberto', 'leitura', 'estudo', 'manual'],
    'fa-newspaper': ['jornal', 'noticias', 'notícias', 'reportagem', 'midia', 'mídia'],
    'fa-file-lines': ['arquivo', 'documento', 'texto', 'nota', 'papel'],
    'fa-folder': ['pasta', 'diretorio', 'diretório', 'arquivo', 'organizar'],
    'fa-lock': ['cadeado', 'trancado', 'seguranca', 'segurança', 'protegido', 'senha'],
    'fa-unlock': ['destrancado', 'aberto', 'liberado', 'acesso', 'senha'],
    'fa-key': ['chave', 'senha', 'acesso', 'seguranca', 'segurança'],
    'fa-shield-halved': ['escudo', 'protecao', 'proteção', 'seguranca', 'segurança', 'antivirus', 'antivírus', 'defesa'],
    'fa-eye': ['olho', 'ver', 'visualizar', 'visao', 'visão', 'visual'],
    'fa-motorcycle': ['moto', 'motocicleta', 'motoboy', 'entrega', 'veiculo', 'veículo'],
    'fa-bicycle': ['bicicleta', 'bike', 'ciclista', 'transporte', 'veiculo', 'veículo'],
    'fa-bus': ['onibus', 'ônibus', 'transporte', 'publico', 'público', 'coletivo'],
    'fa-train': ['trem', 'metro', 'metrô', 'transporte', 'ferrovia'],
    'fa-plane': ['aviao', 'avião', 'aeroporto', 'viagem', 'turismo', 'transporte'],
    'fa-globe': ['globo', 'mundo', 'internet', 'web', 'internacional', 'terra'],
    'fa-map': ['mapa', 'localizacao', 'localização', 'gps', 'navegacao', 'navegação'],
    'fa-location-dot': ['localizacao', 'localização', 'gps', 'pin', 'marcador', 'mapa'],
    'fa-road': ['estrada', 'rua', 'rota', 'caminho', 'via', 'rodovia'],
    'fa-signs-post': ['placa', 'sinalizacao', 'sinalização', 'direcao', 'direção', 'rua'],
    'fa-mobile': ['celular', 'smartphone', 'telefone', 'mobile', 'app'],
    'fa-laptop': ['notebook', 'computador', 'laptop', 'pc', 'portatil', 'portátil'],
    'fa-desktop': ['computador', 'pc', 'desktop', 'monitor', 'tela'],
    'fa-tablet': ['tablet', 'ipad', 'dispositivo', 'touch', 'tela'],
    'fa-print': ['impressora', 'imprimir', 'papel', 'documento'],
    'fa-wifi': ['wifi', 'internet', 'rede', 'sem fio', 'wireless', 'conexao', 'conexão'],
    'fa-signal': ['sinal', 'rede', '4g', '5g', 'conexao', 'conexão', 'forca', 'força'],
    'fa-battery-full': ['bateria', 'cheia', 'energia', 'carga', 'celular'],
    'fa-plug-circle-bolt': ['tomada', 'energia', 'eletricidade', 'carregamento', 'rapido', 'rápido'],
    'fa-solar-panel': ['solar', 'painel', 'energia', 'sustentavel', 'sustentável', 'eco'],
    'fa-shirt': ['camisa', 'camiseta', 'roupa', 'vestuario', 'vestuário', 'moda'],
    'fa-vest': ['colete', 'roupa', 'vestuario', 'vestuário', 'moda', 'seguranca', 'segurança'],
    'fa-glasses': ['oculos', 'óculos', 'visual', 'moda', 'leitura'],
    'fa-mask': ['mascara', 'máscara', 'protecao', 'proteção', 'higiene', 'pandemia'],
    'fa-socks': ['meias', 'roupa', 'vestuario', 'vestuário', 'moda', 'calcado', 'calçado'],
    'fa-burger': ['hamburguer', 'hambúrguer', 'lanche', 'fast food', 'comida'],
    'fa-pizza-slice': ['pizza', 'fatia', 'comida', 'italiana'],
    'fa-ice-cream': ['sorvete', 'gelado', 'doce', 'sobremesa', 'calda'],
    'fa-cookie': ['biscoito', 'cookie', 'doce', 'bolacha', 'sobremesa'],
    'fa-wine-glass': ['vinho', 'taca', 'taça', 'bebida', 'jantar', 'alcool', 'álcool'],
    'fa-beer-mug-empty': ['cerveja', 'chopp', 'bar', 'bebida', 'caneca', 'alcool', 'álcool'],
    'fa-martini-glass': ['drink', 'coquetel', 'cocktail', 'bar', 'bebida', 'alcool', 'álcool'],
    'fa-whiskey-glass': ['whisky', 'whiskey', 'bebida', 'alcool', 'álcool', 'bar'],
    'fa-champagne-glasses': ['champagne', 'brinde', 'festa', 'celebracao', 'celebração', 'casamento'],
    'fa-apple-whole': ['maca', 'maçã', 'fruta', 'saude', 'saúde', 'alimentacao', 'alimentação'],
    'fa-lemon': ['limao', 'limão', 'fruta', 'citrico', 'cítrico', 'suco'],
    'fa-carrot': ['cenoura', 'vegetal', 'legume', 'salada', 'saudavel', 'saudável'],
    'fa-pepper-hot': ['pimenta', 'picante', 'apimentado', 'comida', 'tempero'],
    'fa-egg': ['ovo', 'galinha', 'proteina', 'proteína', 'cafe', 'café', 'manha', 'manhã'],
    'fa-dumbbell': ['halter', 'peso', 'academia', 'musculacao', 'musculação', 'fitness'],
    'fa-person-running': ['correr', 'corrida', 'atleta', 'esporte', 'exercicio', 'exercício'],
    'fa-person-swimming': ['nadar', 'natacao', 'natação', 'piscina', 'esporte', 'agua'],
    'fa-basketball': ['basquete', 'bola', 'esporte', 'cesta', 'jogo'],
    'fa-futbol': ['futebol', 'bola', 'esporte', 'campo', 'jogo', 'soccer'],
    'fa-spa': ['spa', 'relaxamento', 'bem estar', 'bem-estar', 'massagem', 'lótus', 'lotus'],
    'fa-mosque': ['mesquita', 'religiao', 'religião', 'islam', 'oração', 'oracao'],
    'fa-church': ['igreja', 'religiao', 'religião', 'crista', 'cristã', 'oração', 'oracao'],
    'fa-torii-gate': ['torii', 'japao', 'japão', 'santuario', 'santuário', 'cultura'],
    'fa-place-of-worship': ['culto', 'religiao', 'religião', 'templo', 'santuario', 'santuário', 'oração', 'oracao'],
    'fa-graduation-cap': ['formatura', 'graduacao', 'graduação', 'universidade', 'estudo', 'capelo'],
    'fa-school': ['escola', 'educacao', 'educação', 'estudo', 'crianca', 'criança'],
    'fa-university': ['universidade', 'faculdade', 'ensino', 'superior', 'instituicao', 'instituição'],
    'fa-chalkboard': ['quadro', 'aula', 'professor', 'escola', 'educacao', 'educação'],
    'fa-book-open-reader': ['leitura', 'livro', 'estudo', 'aluno', 'biblioteca'],
    'fa-hospital': ['hospital', 'saude', 'saúde', 'medico', 'médico', 'clinica', 'clínica', 'emergencia', 'emergência'],
    'fa-stethoscope': ['estetoscopio', 'medico', 'médico', 'saude', 'saúde', 'hospital', 'clinica', 'clínica'],
    'fa-pills': ['pilula', 'pílula', 'remedio', 'remédio', 'farmacia', 'farmácia', 'medicamento', 'drogas'],
    'fa-syringe': ['seringa', 'vacina', 'injeção', 'injeçao', 'medico', 'médico', 'hospital'],
    'fa-heart-pulse': ['batimento', 'coracao', 'coração', 'saude', 'saúde', 'vida', 'medico', 'médico'],
    'fa-baby': ['bebe', 'bebê', 'crianca', 'criança', 'infantil', 'recem nascido', 'recém nascido'],
    'fa-baby-carriage': ['carrinho', 'bebe', 'bebê', 'passeio', 'infantil', 'maternidade'],
    'fa-person-pregnant': ['gravida', 'grávida', 'gestante', 'maternidade', 'bebe', 'bebê'],
    'fa-hands-holding-child': ['maos', 'mãos', 'crianca', 'criança', 'protecao', 'proteção', 'familia', 'família'],
    'fa-child': ['crianca', 'criança', 'infantil', 'kid', 'menino', 'menina'],
    'fa-kiwi-bird': ['kiwi', 'ave', 'passaro', 'pássaro', 'nova zelandia', 'nova Zelândia'],
    'fa-horse': ['cavalo', 'egua', 'égua', 'animal', 'cavalgada', 'polo'],
    'fa-cow': ['vaca', 'boi', 'animal', 'fazenda', 'leite', 'pecuaria', 'pecuária'],
    'fa-piggy-bank': ['porquinho', 'poupanca', 'poupança', 'economia', 'dinheiro', 'moeda'],
    'fa-dragon': ['dragao', 'dragão', 'mito', 'fantasia', 'fogo', 'lendario', 'lendário'],
    'fa-ghost': ['fantasma', 'halloween', 'assombracao', 'assombração', 'espirito', 'espírito'],
    'fa-skull': ['caveira', 'morte', 'perigo', 'toxicidade', 'pirata', 'roqueiro'],
    'fa-spider': ['aranha', 'inseto', 'halloween', 'teia'],
    'fa-bacterium': ['bacteria', 'bactéria', 'virus', 'vírus', 'microbio', 'microrganismo', 'ciencia', 'ciência'],
    'fa-flask': ['frasco', 'laboratorio', 'laboratório', 'quimica', 'química', 'experimento', 'ciencia', 'ciência'],
    'fa-atom': ['atomo', 'átomo', 'ciencia', 'ciência', 'fisica', 'física', 'quimica', 'química'],
    'fa-microscope': ['microscopio', 'microscópio', 'laboratorio', 'laboratório', 'ciencia', 'ciência', 'biologia'],
    'fa-dna': ['dna', 'genetica', 'genética', 'ciencia', 'ciência', 'biologia', 'medicina'],
    'fa-vial': ['ampola', 'tubo', 'laboratorio', 'laboratório', 'quimica', 'química', 'amostra'],
    'fa-rocket': ['foguete', 'espaco', 'espaço', 'nave', 'lancamento', 'lançamento', 'startup'],
    'fa-satellite': ['satelite', 'satélite', 'espaco', 'espaço', 'comunicacao', 'comunicação', 'orbita', 'órbita'],
    'fa-user-astronaut': ['astronauta', 'espaco', 'espaço', 'nasa', 'cosmonauta'],
    'fa-shuttle-space': ['onibus', 'ônibus', 'espacial', 'nave', 'espaco', 'espaço', 'nasa'],
    'fa-meteor': ['meteoro', 'meteorito', 'cometa', 'espaco', 'espaço', 'astronomia']
};

const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
let iconeSelecionadoAtual = 'fas fa-tag';

function renderizarGridIcones(filtro = '') {
    const grid = $('gridIcones');
    const filtroLower = filtro.toLowerCase().trim();
    const icones = filtroLower
        ? ICONES_DISPONIVEIS.filter(i => {
            if (i.toLowerCase().includes(filtroLower)) return true;
            const traducoes = ICONES_TRADUCOES[i] || [];
            return traducoes.some(t => t.toLowerCase().includes(filtroLower));
        })
        : ICONES_DISPONIVEIS;

    grid.innerHTML = icones.map(icone => {
        const classe = 'fas ' + icone;
        const selecionado = classe === iconeSelecionadoAtual ? 'style="background:var(--cor-primaria);color:#fff;border-color:var(--cor-primaria);"' : '';
        return `<button type="button" class="btn-icon-item" onclick="selecionarIcone('${classe}')" title="${classe}" ${selecionado}>
            <i class="${classe}"></i>
        </button>`;
    }).join('');
}

window.abrirSeletorIcones = function() {
    iconeSelecionadoAtual = $('catIcone').value || 'fas fa-tag';
    $('buscaIcone').value = '';
    renderizarGridIcones();
    abrirModal('modalIcones');
};

window.filtrarIcones = function(texto) {
    renderizarGridIcones(texto);
};

window.selecionarIcone = function(classe) {
    iconeSelecionadoAtual = classe;
    $('catIcone').value = classe;
    $('previewIcone').className = classe;
    $('previewIconeNome').textContent = classe;
    fecharModal('modalIcones');
};

function atualizarPreviewIcone() {
    const classe = $('catIcone').value || 'fas fa-tag';
    $('previewIcone').className = classe;
    $('previewIconeNome').textContent = classe;
}

// Carregar categorias
async function carregarCategorias() {
    try {
        const search = $('searchCategoria').value;
        const res = await fetch(`${API_BASE}/api/categorias?${search ? 'search=' + encodeURIComponent(search) : ''}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        categoriasData = await res.json();
        paginaAtual = 1;
        renderizarTabela();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// Renderizar tabela
function renderizarTabela() {
    const tbody = $('tabelaCategorias').querySelector('tbody');
    const thead = $('tabelaCategorias').querySelector('thead tr');
    const total = categoriasData.length;
    const inicio = (paginaAtual - 1) * porPagina;
    const fim = inicio + porPagina;
    const paginaItems = categoriasData.slice(inicio, fim);

    // Ajustar header para suporte
    if (isSuporte && !thead.querySelector('.th-empresa')) {
        const th = document.createElement('th');
        th.className = 'th-empresa';
        th.textContent = 'Empresa';
        thead.insertBefore(th, thead.children[thead.children.length - 1]);
    }
    const colCount = isSuporte ? 9 : 8;

    tbody.innerHTML = paginaItems.length === 0
        ? `<tr><td colspan="${colCount}" class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhuma categoria encontrada</h3></td></tr>`
        : paginaItems.map(c => `
            <tr>
                <td>${c.id}</td>
                <td><strong>${c.nome}</strong></td>
                <td>${c.slug}</td>
                <td><i class="${c.icone || 'fas fa-tag'}" style="color:${c.cor||'#1a6fc4'}"></i></td>
                <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${c.cor||'#1a6fc4'};vertical-align:middle;margin-right:4px;"></span>${c.cor}</td>
                <td>${c.ordem}</td>
                <td>${c.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                ${isSuporte ? `<td>${c.empresa_nome || '-'}</td>` : ''}
                <td>
                    <div class="admin-table-actions">
                        <button class="btn btn-warning btn-sm btn-icon" onclick="editarCategoria(${c.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm btn-icon" onclick="confirmarExclusao(${c.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    $('infoPaginacaoCat').textContent = `Mostrando ${inicio + 1}-${Math.min(fim, total)} de ${total}`;
    renderizarPaginacao();
}

function renderizarPaginacao() {
    const totalPaginas = Math.ceil(categoriasData.length / porPagina) || 1;
    const container = $('botoesPaginacaoCat');
    let html = '';
    html += `<button onclick="mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPaginas; i++) {
        html += `<button class="${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</button>`;
    }
    html += `<button onclick="mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

window.mudarPagina = function(p) {
    const total = Math.ceil(categoriasData.length / porPagina) || 1;
    if (p < 1 || p > total) return;
    paginaAtual = p;
    renderizarTabela();
};

// Popular select de categoria pai
async function popularSelectPai() {
    try {
        const res = await fetch(`${API_BASE}/api/categorias`);
        const cats = await res.json();
        const select = $('catPaiId');
        const valAtual = select.value;
        select.innerHTML = '<option value="">-- Nenhuma --</option>' + cats
            .filter(c => c.id != ($('catId').value || 0))
            .map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        select.value = valAtual;
    } catch (e) {}
}

// Abrir modal nova
$('btnNovaCategoria').addEventListener('click', () => {
    $('formCategoria').reset();
    $('catId').value = '';
    $('catCor').value = '#1a6fc4';
    $('catAtivo').checked = true;
    $('catIcone').value = 'fas fa-tag';
    atualizarPreviewIcone();
    $('modalCategoriaTitulo').innerHTML = '<i class="fas fa-tag"></i> Nova Categoria';
    popularSelectPai();
    abrirModal('modalCategoria');
});

// Fechar modal
$('modalCategoriaClose').addEventListener('click', () => fecharModal('modalCategoria'));
$('btnCancelarCategoria').addEventListener('click', () => fecharModal('modalCategoria'));

// Gerar slug automaticamente
$('catNome').addEventListener('blur', () => {
    if (!$('catSlug').value) {
        $('catSlug').value = slugify($('catNome').value);
    }
});

// Salvar
$('btnSalvarCategoria').addEventListener('click', async () => {
    const nome = $('catNome').value.trim();
    const slug = $('catSlug').value.trim();
    if (!nome || !slug) {
        toast('Preencha os campos obrigatórios', 'error');
        return;
    }
    const dados = {
        id: $('catId').value || undefined,
        nome,
        slug,
        codigo_erp: $('catCodigoErp').value || null,
        descricao: $('catDescricao').value || null,
        icone: $('catIcone').value || null,
        cor: $('catCor').value,
        ordem: parseInt($('catOrdem').value) || 0,
        ativo: $('catAtivo').checked,
        categoria_pai_id: $('catPaiId').value || null
    };
    try {
        const url = `${API_BASE}/api/categorias${dados.id ? '/' + dados.id : ''}`;
        const res = await fetch(url, {
            method: dados.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
        toast(dados.id ? 'Categoria atualizada!' : 'Categoria criada!');
        fecharModal('modalCategoria');
        carregarCategorias();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Editar
window.editarCategoria = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/categorias/${id}`);
        if (!res.ok) throw new Error('Erro ao carregar');
        const c = await res.json();
        $('catId').value = c.id;
        $('catNome').value = c.nome;
        $('catSlug').value = c.slug;
        $('catCodigoErp').value = c.codigo_erp || '';
        $('catIcone').value = c.icone || 'fas fa-tag';
        atualizarPreviewIcone();
        $('catCor').value = c.cor || '#1a6fc4';
        $('catOrdem').value = c.ordem;
        $('catAtivo').checked = c.ativo;
        $('catDescricao').value = c.descricao || '';
        await popularSelectPai();
        $('catPaiId').value = c.categoria_pai_id || '';
        $('modalCategoriaTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
        abrirModal('modalCategoria');
    } catch (err) {
        toast(err.message, 'error');
    }
};

// Excluir
window.confirmarExclusao = function(id) {
    categoriaExcluirId = id;
    abrirModal('modalConfirmar');
};
$('btnCancelarExclusao').addEventListener('click', () => fecharModal('modalConfirmar'));
$('btnConfirmarExclusao').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/api/categorias/${categoriaExcluirId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao excluir');
        toast('Categoria excluída!');
        fecharModal('modalConfirmar');
        carregarCategorias();
    } catch (err) {
        toast(err.message, 'error');
    }
});

// Busca
$('searchCategoria').addEventListener('input', () => {
    paginaAtual = 1;
    carregarCategorias();
});

// Modal helpers
function abrirModal(id) { $(id).classList.add('active'); }
function fecharModal(id) { $(id).classList.remove('active'); }

// Inicializar
carregarCategorias();
