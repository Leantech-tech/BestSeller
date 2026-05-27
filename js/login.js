function gerarSenhaDoDia() {
    const hoje = new Date();
    const diaSemana = String(hoje.getDay() + 1).padStart(2, '0'); // 01=domingo, 02=segunda... 07=sábado
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${diaSemana}${ano}${mes}${dia}`;
}

function formatarData(data) {
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = diasSemana[data.getDay()];
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${diaSemana}, ${dia}/${mes}/${ano}`;
}

async function fazerLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value.trim();
    const erroEl = document.getElementById('login-erro');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');

    emailInput.classList.remove('erro');
    senhaInput.classList.remove('erro');
    erroEl.classList.remove('ativo');

    if (!email) {
        erroEl.textContent = 'Preencha o e-mail.';
        erroEl.classList.add('ativo');
        emailInput.classList.add('erro');
        return false;
    }

    if (!senha) {
        erroEl.textContent = 'Preencha a senha.';
        erroEl.classList.add('ativo');
        senhaInput.classList.add('erro');
        return false;
    }

    // Login do suporte: senha do dia
    if (email === 'suporte') {
        const senhaCorreta = gerarSenhaDoDia();
        if (senha !== senhaCorreta) {
            erroEl.textContent = 'Senha incorreta.';
            erroEl.classList.add('ativo');
            senhaInput.classList.add('erro');
            return false;
        }
        // Suporte: salvar perfil e nao vincular a nenhuma empresa
        localStorage.setItem('araca_admin_usuario', 'suporte');
        loginBemSucedido();
        return false;
    }

    // Login de usuário cadastrado: verificar no banco
    console.log('🔐 Tentando login com email:', email);
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const json = await res.json();
        console.log('📡 Resposta da API:', res.status, json);
        if (!res.ok) {
            erroEl.textContent = json.error || 'E-mail ou senha incorretos.';
            erroEl.classList.add('ativo');
            senhaInput.classList.add('erro');
            return false;
        }
        if (json.usuario) {
            salvarEmpresaLogada(json.usuario, json.usuario.email || json.usuario.nome);
        }
        loginBemSucedido();
    } catch (err) {
        console.error(err);
        erroEl.textContent = 'Erro ao verificar credenciais.';
        erroEl.classList.add('ativo');
    }
    return false;
}

function salvarEmpresaLogada(dados, usuarioEmail) {
    const empresa = {
        id: dados.empresa_id || dados.id || 1,
        nome_fantasia: dados.nome_fantasia || dados.nome || 'TechShop',
        razao_social: dados.razao_social || '',
        logo_url: dados.logo_url || '',
        cor_primaria: dados.cor_primaria || '#1a6fc4',
        cor_secundaria: dados.cor_secundaria || '#0d9488',
        slug: dados.slug || ''
    };
    localStorage.setItem('araca_empresa_logada', JSON.stringify(empresa));
    if (usuarioEmail) {
        localStorage.setItem('araca_admin_usuario', usuarioEmail);
    }
}

function loginBemSucedido() {
    localStorage.setItem('araca_admin_logado', 'true');
    localStorage.setItem('araca_admin_login_data', new Date().toISOString());
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') || 'admin.html';
    window.location.href = redirect;
}

function verificarLogin() {
    const logado = localStorage.getItem('araca_admin_logado') === 'true';
    if (!logado) {
        window.location.href = 'login.html';
    }
}

function fazerLogout() {
    localStorage.removeItem('araca_admin_logado');
    localStorage.removeItem('araca_admin_login_data');
    localStorage.removeItem('araca_empresa_logada');
    localStorage.removeItem('araca_admin_usuario');
    window.location.href = 'login.html';
}

// Verificação de data para debug
document.addEventListener('DOMContentLoaded', () => {
    console.log('Data atual:', formatarData(new Date()));
});
