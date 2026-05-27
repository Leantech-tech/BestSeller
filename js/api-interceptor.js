// Ocultar logo da empresa imediatamente se for suporte (antes de renderizar)
(function() {
    const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
    if (isSuporte) {
        const style = document.createElement('style');
        style.textContent = '.logo-brand-text, .footer-logo-container, .footer-logo-titulo, .footer-logo-sub, .footer-info-empresa { display: none !important; }';
        document.head.appendChild(style);
    }
})();

// Interceptor global para enviar empresa_id em todas as requisicoes
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        options = options || {};
        if (!options.headers) {
            options.headers = {};
        }
        
        const isSuporte = localStorage.getItem('araca_admin_usuario') === 'suporte';
        
        if (isSuporte) {
            // Suporte: enviar header especial, nao vincular a empresa
            if (options.headers instanceof Headers) {
                options.headers.set('x-admin-perfil', 'suporte');
            } else {
                options.headers['x-admin-perfil'] = 'suporte';
            }
        } else {
            const empresaRaw = localStorage.getItem('araca_empresa_logada');
            const empresaId = empresaRaw ? JSON.parse(empresaRaw).id || '1' : '1';
            
            if (options.headers instanceof Headers) {
                options.headers.set('x-empresa-id', String(empresaId));
            } else {
                options.headers['x-empresa-id'] = String(empresaId);
            }
        }
        
        return originalFetch(url, options);
    };
})();
