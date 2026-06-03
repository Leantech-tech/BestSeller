const categorias = [
    { id: 'todos', nome: 'Todos os Produtos', icone: 'fas fa-house' },
    { id: 'notebooks', nome: 'Notebooks', icone: 'fas fa-laptop' },
    { id: 'smartphones', nome: 'Smartphones', icone: 'fas fa-mobile-alt' },
    { id: 'acessorios', nome: 'Acessórios', icone: 'fas fa-headphones' },
    { id: 'monitores', nome: 'Monitores', icone: 'fas fa-desktop' },
    { id: 'hardware', nome: 'Hardware', icone: 'fas fa-microchip' },
    { id: 'redes', nome: 'Redes e Wi-Fi', icone: 'fas fa-wifi' },
    { id: 'perifericos', nome: 'Periféricos', icone: 'fas fa-keyboard' },
    { id: 'gaming', nome: 'Gaming', icone: 'fas fa-gamepad' },
    { id: 'armazenamento', nome: 'Armazenamento', icone: 'fas fa-hdd' }
];

const produtos = [
    {
        id: 1,
        nome: 'Notebook Dell Inspiron 15',
        preco: 3899.90,
        precoAntigo: 4599.00,
        categoria: 'notebooks',
        imagem: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop',
        descricao: 'Notebook Dell Inspiron 15 com processador Intel Core i5, 8GB RAM, SSD 256GB e tela Full HD de 15.6". Ideal para trabalho e estudos.',
        codigo: 'NTB-DELL-001',
        estoque: 12,
        parcelas: 10,
        destaque: true
    },
    {
        id: 2,
        nome: 'MacBook Air M2',
        preco: 8999.00,
        precoAntigo: 10499.00,
        categoria: 'notebooks',
        imagem: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop',
        descricao: 'MacBook Air com chip M2, 8GB RAM unificada, SSD 256GB e tela Liquid Retina de 13.6". Design ultrafino e leve.',
        codigo: 'NTB-APL-002',
        estoque: 8,
        parcelas: 12,
        destaque: true
    },
    {
        id: 3,
        nome: 'iPhone 15 Pro Max',
        preco: 7499.00,
        precoAntigo: 8499.00,
        categoria: 'smartphones',
        imagem: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&h=400&fit=crop',
        descricao: 'iPhone 15 Pro Max com chip A17 Pro, câmera de 48MP, tela Super Retina XDR de 6.7" e acabamento em titânio.',
        codigo: 'CEL-APL-003',
        estoque: 15,
        parcelas: 12,
        destaque: true
    },
    {
        id: 4,
        nome: 'Samsung Galaxy S24 Ultra',
        preco: 6299.00,
        precoAntigo: 7499.00,
        categoria: 'smartphones',
        imagem: 'https://images.unsplash.com/photo-1610945265078-3858a0828671?w=400&h=400&fit=crop',
        descricao: 'Samsung Galaxy S24 Ultra com processador Snapdragon 8 Gen 3, câmera de 200MP, S Pen integrada e tela AMOLED de 6.8".',
        codigo: 'CEL-SAM-004',
        estoque: 20,
        parcelas: 12,
        destaque: false
    },
    {
        id: 5,
        nome: 'Headset Gamer HyperX Cloud II',
        preco: 449.90,
        precoAntigo: 599.00,
        categoria: 'acessorios',
        imagem: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        descricao: 'Headset gamer com som surround 7.1, drivers de 53mm, microfone removível com cancelamento de ruído e conforto premium.',
        codigo: 'FONE-HPX-005',
        estoque: 30,
        parcelas: 5,
        destaque: true
    },
    {
        id: 6,
        nome: 'Monitor LG UltraWide 34"',
        preco: 2199.00,
        precoAntigo: 2799.00,
        categoria: 'monitores',
        imagem: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop',
        descricao: 'Monitor UltraWide LG de 34" com resolução QHD (3440x1440), taxa de atualização de 160Hz, 1ms e painel IPS.',
        codigo: 'MON-LG-006',
        estoque: 10,
        parcelas: 10,
        destaque: true
    },
    {
        id: 7,
        nome: 'Placa de Vídeo RTX 4070',
        preco: 3899.00,
        precoAntigo: 4599.00,
        categoria: 'hardware',
        imagem: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&h=400&fit=crop',
        descricao: 'Placa de vídeo NVIDIA GeForce RTX 4070 com 12GB GDDR6X, arquitetura Ada Lovelace e suporte a DLSS 3.',
        codigo: 'GPU-RTX-007',
        estoque: 6,
        parcelas: 10,
        destaque: true
    },
    {
        id: 8,
        nome: 'SSD NVMe Kingston 1TB',
        preco: 449.90,
        precoAntigo: 599.00,
        categoria: 'armazenamento',
        imagem: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&fit=crop',
        descricao: 'SSD NVMe Kingston KC3000 de 1TB com velocidades de leitura até 7000MB/s e gravação até 6000MB/s.',
        codigo: 'SSD-KNG-008',
        estoque: 25,
        parcelas: 5,
        destaque: false
    },
    {
        id: 9,
        nome: 'Teclado Mecânico Keychron K2',
        preco: 599.00,
        precoAntigo: 749.00,
        categoria: 'perifericos',
        imagem: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop',
        descricao: 'Teclado mecânico compacto 75%, switches Gateron Brown, retroiluminação RGB e conectividade Bluetooth/USB-C.',
        codigo: 'TEC-KYC-009',
        estoque: 18,
        parcelas: 6,
        destaque: false
    },
    {
        id: 10,
        nome: 'Mouse Logitech MX Master 3S',
        preco: 499.00,
        precoAntigo: 649.00,
        categoria: 'perifericos',
        imagem: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',
        descricao: 'Mouse ergonômico premium com sensor de 8000 DPI, scroll MagSpeed, conectividade multi-dispositivo e USB-C.',
        codigo: 'MOU-LOG-010',
        estoque: 22,
        parcelas: 5,
        destaque: false
    },
    {
        id: 11,
        nome: 'Roteador Wi-Fi 6 TP-Link AX3000',
        preco: 349.90,
        precoAntigo: 499.00,
        categoria: 'redes',
        imagem: 'https://images.unsplash.com/photo-1544239334-425997f66e1e?w=400&h=400&fit=crop',
        descricao: 'Roteador Wi-Fi 6 de alta performance com velocidade combinada até 3000Mbps, 4 antenas e porta Gigabit.',
        codigo: 'WIFI-TPL-011',
        estoque: 14,
        parcelas: 4,
        destaque: false
    },
    {
        id: 12,
        nome: 'Console PlayStation 5 Slim',
        preco: 3599.00,
        precoAntigo: 4299.00,
        categoria: 'gaming',
        imagem: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=400&fit=crop',
        descricao: 'Console PlayStation 5 Slim com SSD de 1TB, suporte a ray tracing, jogos em 4K a 120fps e controle DualSense.',
        codigo: 'CON-PS5-012',
        estoque: 9,
        parcelas: 10,
        destaque: true
    }
];

const slides = [
    {
        imagem: 'images/banner1.jpg',
        titulo: 'Tecnologia de Ponta',
        subtitulo: 'Os melhores notebooks, smartphones e acessórios para você'
    },
    {
        imagem: 'images/banner2.jpg',
        titulo: 'Setup Gamer Completo',
        subtitulo: 'Eleve sua experiência de jogo com hardware de alto desempenho'
    },
    {
        imagem: 'images/banner3.jpg',
        titulo: 'Conectividade Sem Limites',
        subtitulo: 'Periféricos e dispositivos para sua produtividade e entretenimento'
    }
];

function formatarPreco(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularDesconto(preco, precoAntigo) {
    if (!precoAntigo || precoAntigo <= preco) return 0;
    return Math.round(((precoAntigo - preco) / precoAntigo) * 100);
}
