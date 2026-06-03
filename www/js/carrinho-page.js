document.addEventListener('DOMContentLoaded', () => {
    carrinho.renderizarPagina();

    // Busca
    const input = document.querySelector('.busca-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const termo = input.value.trim();
                if (termo) {
                    window.location.href = `index.html?busca=${encodeURIComponent(termo)}`;
                }
            }
        });
    }
});
