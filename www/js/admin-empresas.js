const API_BASE = '';
let empresasData = [];
let empresaEditando = null;

async function carregarEmpresas() {
    try {
        const res = await fetch(`${API_BASE}/api/empresas`);
        if (!res.ok) throw new Error('Falha ao carregar');
        empresasData = await res.json();
        renderizarTabela();
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao carregar empresas', 'error');
    }
}

function renderizarTabela() {
    const tbody = document.querySelector('#tabelaEmpresas tbody');
    const termo = document.getElementById('searchEmpresa')?.value.toLowerCase() || '';

    let filtradas = empresasData;
    if (termo) {
        filtradas = empresasData.filter(e =>
            (e.nome_fantasia || '').toLowerCase().includes(termo) ||
            (e.razao_social || '').toLowerCase().includes(termo) ||
            (e.cnpj || '').toLowerCase().includes(termo) ||
            (e.email || '').toLowerCase().includes(termo) ||
            (e.cidade || '').toLowerCase().includes(termo)
        );
    }

    document.getElementById('infoPaginacao').textContent = `Mostrando ${filtradas.length} de ${empresasData.length}`;

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--cor-texto-muted);">Nenhuma empresa encontrada</td></tr>`;
        return;
    }

    tbody.innerHTML = filtradas.map(e => {
        const statusClass = e.status === 'ativo' ? 'badge-success' : e.status === 'inativo' ? 'badge-danger' : 'badge-warning';
        const statusText = e.status === 'ativo' ? 'Ativo' : e.status === 'inativo' ? 'Inativo' : 'Suspenso';
        return `
            <tr>
                <td>${e.id}</td>
                <td><strong>${escapeHtml(e.nome_fantasia || '-')}</strong></td>
                <td>${escapeHtml(e.razao_social || '-')}</td>
                <td>${formatarCnpj(e.cnpj) || '-'}</td>
                <td>${escapeHtml(e.cidade || '-')} / ${escapeHtml(e.estado || '-')}</td>
                <td>${escapeHtml(e.email || '-')}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-primary" onclick="editarEmpresa(${e.id})" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="excluirEmpresa(${e.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatarCnpj(cnpj) {
    if (!cnpj) return '';
    const nums = cnpj.replace(/\D/g, '');
    if (nums.length === 14) {
        return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
}

function abrirModal(id = null) {
    empresaEditando = id;
    document.getElementById('modalTitulo').innerHTML = id ? '<i class="fas fa-edit"></i> Editar Empresa' : '<i class="fas fa-building"></i> Nova Empresa';
    document.getElementById('formEmpresa').reset();
    document.getElementById('empresaId').value = '';
    document.getElementById('logoFile').value = '';
    document.getElementById('logoPreview').style.display = 'none';
    document.getElementById('logoPreview').src = '';
    document.getElementById('logoUrl').value = '';

    if (id) {
        const e = empresasData.find(x => x.id == id);
        if (e) preencherFormulario(e);
    }

    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalEmpresa').classList.add('active');
}

function preencherFormulario(e) {
    document.getElementById('empresaId').value = e.id;
    document.getElementById('razaoSocial').value = e.razao_social || '';
    document.getElementById('nomeFantasia').value = e.nome_fantasia || '';
    document.getElementById('cnpj').value = e.cnpj || '';
    document.getElementById('ie').value = e.ie || '';
    document.getElementById('im').value = e.im || '';
    document.getElementById('email').value = e.email || '';
    document.getElementById('telefone').value = e.telefone || '';
    document.getElementById('whatsapp').value = e.whatsapp || '';
    document.getElementById('cep').value = e.cep || '';
    document.getElementById('logradouro').value = e.logradouro || '';
    document.getElementById('numero').value = e.numero || '';
    document.getElementById('complemento').value = e.complemento || '';
    document.getElementById('bairro').value = e.bairro || '';
    document.getElementById('cidade').value = e.cidade || '';
    document.getElementById('estado').value = e.estado || '';
    document.getElementById('logoUrl').value = e.logo_url || '';
    if (e.logo_url) {
        document.getElementById('logoPreview').src = e.logo_url;
        document.getElementById('logoPreview').style.display = 'block';
    } else {
        document.getElementById('logoPreview').style.display = 'none';
    }
    document.getElementById('corPrimaria').value = e.cor_primaria || '#1a6fc4';
    document.getElementById('corSecundaria').value = e.cor_secundaria || '#0d9488';
    document.getElementById('responsavelNome').value = e.responsavel_nome || '';
    document.getElementById('responsavelEmail').value = e.responsavel_email || '';
    document.getElementById('responsavelCpf').value = e.responsavel_cpf || '';
    document.getElementById('responsavelTelefone').value = e.responsavel_telefone || '';
    document.getElementById('status').value = e.status || 'ativo';
    document.getElementById('trial').checked = e.trial || false;
}

function fecharModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('modalEmpresa').classList.remove('active');
    empresaEditando = null;
}

async function salvarEmpresa() {
    const id = document.getElementById('empresaId').value;

    // Upload de logo se houver arquivo
    let logoUrl = document.getElementById('logoUrl').value || null;
    const logoFile = document.getElementById('logoFile').files[0];
    if (logoFile) {
        try {
            const fd = new FormData();
            fd.append('imagem', logoFile);
            const upRes = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: fd });
            const upJson = await upRes.json();
            if (!upRes.ok) throw new Error(upJson.error || 'Erro no upload');
            logoUrl = upJson.url;
        } catch (upErr) {
            mostrarToast(upErr.message, 'error');
            return;
        }
    }

    const dados = {
        razao_social: document.getElementById('razaoSocial').value.trim(),
        nome_fantasia: document.getElementById('nomeFantasia').value.trim(),
        cnpj: document.getElementById('cnpj').value.trim(),
        ie: document.getElementById('ie').value.trim(),
        im: document.getElementById('im').value.trim(),
        email: document.getElementById('email').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        cep: document.getElementById('cep').value.trim(),
        logradouro: document.getElementById('logradouro').value.trim(),
        numero: document.getElementById('numero').value.trim(),
        complemento: document.getElementById('complemento').value.trim(),
        bairro: document.getElementById('bairro').value.trim(),
        cidade: document.getElementById('cidade').value.trim(),
        estado: document.getElementById('estado').value.trim().toUpperCase(),
        logo_url: logoUrl,
        cor_primaria: document.getElementById('corPrimaria').value,
        cor_secundaria: document.getElementById('corSecundaria').value,
        responsavel_nome: document.getElementById('responsavelNome').value.trim(),
        responsavel_email: document.getElementById('responsavelEmail').value.trim(),
        responsavel_cpf: document.getElementById('responsavelCpf').value.trim(),
        responsavel_telefone: document.getElementById('responsavelTelefone').value.trim(),
        status: document.getElementById('status').value,
        trial: document.getElementById('trial').checked
    };

    if (!dados.razao_social || !dados.nome_fantasia) {
        mostrarToast('Preencha Razão Social e Nome Fantasia', 'error');
        return;
    }

    try {
        const url = id ? `${API_BASE}/api/empresas/${id}` : `${API_BASE}/api/empresas`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) throw new Error('Falha ao salvar');

        mostrarToast(id ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!', 'success');
        fecharModal();
        carregarEmpresas();
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao salvar empresa', 'error');
    }
}

async function editarEmpresa(id) {
    try {
        const res = await fetch(`${API_BASE}/api/empresas/${id}`);
        if (!res.ok) throw new Error('Erro ao carregar empresa');
        const empresa = await res.json();
        abrirModalComDados(empresa);
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao carregar dados da empresa', 'error');
    }
}

function abrirModalComDados(empresa) {
    empresaEditando = empresa.id;
    document.getElementById('modalTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Empresa';
    document.getElementById('formEmpresa').reset();
    preencherFormulario(empresa);
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalEmpresa').classList.add('active');
}

async function excluirEmpresa(id) {
    const e = empresasData.find(x => x.id === id);
    if (!confirm(`Tem certeza que deseja excluir "${e?.nome_fantasia || 'esta empresa'}"?`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/empresas/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Falha ao excluir');
        mostrarToast('Empresa excluída com sucesso!', 'success');
        carregarEmpresas();
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao excluir empresa', 'error');
    }
}

function mostrarToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${mensagem}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Máscara de telefone: aceita fixo e celular
function mascaraTelefone(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
        v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 6) {
        v = v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 2) {
        v = v.replace(/(\d{2})(\d+)/, '($1) $2');
    }
    e.target.value = v;
}

// Busca CEP via backend (proxy ViaCEP)
async function buscarCep(cep) {
    const nums = cep.replace(/\D/g, '');
    if (nums.length !== 8) {
        mostrarToast('Digite um CEP válido com 8 dígitos', 'error');
        return;
    }
    try {
        mostrarToast('Buscando CEP...', 'success');
        const res = await fetch(`${API_BASE}/api/cep/${nums}`);
        const data = await res.json();
        if (data.erro) {
            mostrarToast('CEP não encontrado', 'error');
            return;
        }
        document.getElementById('logradouro').value = data.logradouro || '';
        document.getElementById('bairro').value = data.bairro || '';
        document.getElementById('cidade').value = data.localidade || '';
        document.getElementById('estado').value = (data.uf || '').toUpperCase();
        mostrarToast('Endereço preenchido automaticamente', 'success');
    } catch (err) {
        console.error('Erro busca CEP:', err);
        mostrarToast('Erro ao buscar CEP. Tente digitar manualmente.', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarEmpresas();

    document.getElementById('btnNovaEmpresa').addEventListener('click', () => abrirModal());

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) fecharModal();
    });

    document.getElementById('searchEmpresa').addEventListener('input', () => renderizarTabela());

    // Preview do logo
    document.getElementById('logoFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                document.getElementById('logoPreview').src = ev.target.result;
                document.getElementById('logoPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Máscaras
    document.getElementById('cnpj').addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4');
        else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
        else if (v.length > 2) v = v.replace(/(\d{2})(\d{3})/, '$1.$2');
        e.target.value = v;
    });

    document.getElementById('cep').addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        e.target.value = v;
        // Buscar automaticamente quando completar 8 digitos
        if (v.replace(/\D/g, '').length === 8) {
            buscarCep(v);
        }
    });

    document.getElementById('cep').addEventListener('blur', function(e) {
        buscarCep(e.target.value);
    });

    // Botao buscar CEP
    document.getElementById('btnBuscarCep').addEventListener('click', function() {
        const cep = document.getElementById('cep').value;
        buscarCep(cep);
    });

    document.getElementById('telefone').addEventListener('input', mascaraTelefone);
    document.getElementById('whatsapp').addEventListener('input', mascaraTelefone);
    document.getElementById('responsavelTelefone').addEventListener('input', mascaraTelefone);

    document.getElementById('responsavelCpf').addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{3})/, '$1.$2');
        e.target.value = v;
    });
});
