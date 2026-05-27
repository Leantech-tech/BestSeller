(function carregarDadosEmpresa() {
    try {
        // Suporte: nao carregar dados de empresa especifica
        const usuario = localStorage.getItem('araca_admin_usuario');
        if (usuario === 'suporte') return;

        const raw = localStorage.getItem('araca_empresa_logada');
        if (!raw) return;
        const empresa = JSON.parse(raw);
        if (!empresa) return;

        // Substituir logo no header
        const logoContainers = document.querySelectorAll('.logo-brand-text');
        logoContainers.forEach(container => {
            if (empresa.logo_url) {
                container.innerHTML = `<img src="${empresa.logo_url}" alt="${empresa.nome_fantasia}" style="max-height:40px; max-width:140px; object-fit:contain; display:block;">`;
            } else {
                container.innerHTML = `<span class="logo-fallback-titulo">${empresa.nome_fantasia}</span>`;
            }
        });

        // Aplicar cores da empresa (opcional)
        if (empresa.cor_primaria) {
            document.documentElement.style.setProperty('--cor-primaria', empresa.cor_primaria);
        }
        if (empresa.cor_secundaria) {
            document.documentElement.style.setProperty('--cor-secundaria', empresa.cor_secundaria);
        }
    } catch (e) {
        console.warn('Erro ao carregar dados da empresa:', e);
    }
})();

// Verificar acesso ao menu Empresas (visivel apenas para suporte)
(function verificarAcessoEmpresas() {
    try {
        const usuario = localStorage.getItem('araca_admin_usuario');
        const isSuporte = usuario === 'suporte';

        // Ocultar links do menu Empresas se NAO for suporte
        if (!isSuporte) {
            const linksEmpresas = document.querySelectorAll('a[href="admin-empresas.html"]');
            linksEmpresas.forEach(link => {
                const li = link.closest('li');
                if (li) li.style.display = 'none';
                else link.style.display = 'none';
            });
        }

        // Se estiver na pagina admin-empresas.html e nao for suporte, redirecionar
        if (window.location.pathname.includes('admin-empresas.html') && !isSuporte) {
            window.location.href = 'admin.html';
        }
    } catch (e) {
        console.warn('Erro ao verificar acesso:', e);
    }
})();

// Suporte: nao mostrar logo/cores de empresa especifica
(function ajustarParaSuporte() {
    try {
        const usuario = localStorage.getItem('araca_admin_usuario');
        if (usuario !== 'suporte') return;

        // Ocultar logo da empresa no header (suporte nao tem empresa vinculada)
        const logoContainers = document.querySelectorAll('.logo-brand-text');
        logoContainers.forEach(container => {
            container.style.display = 'none';
        });

        // Ocultar logo da empresa no footer
        const footerLogos = document.querySelectorAll('.footer-logo-container, .footer-logo-titulo, .footer-logo-sub');
        footerLogos.forEach(el => {
            el.style.display = 'none';
        });

        // Ocultar info da empresa no footer
        const footerInfoEmpresa = document.querySelectorAll('.footer-info-empresa');
        footerInfoEmpresa.forEach(el => {
            el.style.display = 'none';
        });

        // Resetar cores para padrao
        document.documentElement.style.removeProperty('--cor-primaria');
        document.documentElement.style.removeProperty('--cor-secundaria');
    } catch (e) {
        console.warn('Erro ao ajustar para suporte:', e);
    }
})();
