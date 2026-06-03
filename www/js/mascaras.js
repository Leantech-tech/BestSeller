/**
 * mascaras.js - Biblioteca vanilla JS para máscaras de input
 */

const Mascaras = {
    apenasNumeros(str) {
        return String(str || '').replace(/\D/g, '');
    },

    cpf(valor) {
        let v = this.apenasNumeros(valor).slice(0, 11);
        return v.replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },

    cnpj(valor) {
        let v = this.apenasNumeros(valor).slice(0, 14);
        return v.replace(/(\d{2})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1/$2')
                .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },

    cpfCnpj(valor) {
        let v = this.apenasNumeros(valor);
        return v.length <= 11 ? this.cpf(v) : this.cnpj(v);
    },

    telefone(valor) {
        let v = this.apenasNumeros(valor).slice(0, 11);
        if (v.length > 10) {
            return v.replace(/(\d{2})(\d)/, '($1) $2')
                    .replace(/(\d{5})(\d)/, '$1-$2')
                    .replace(/(-\d{4})\d+?$/, '$1');
        }
        return v.replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2')
                .replace(/(-\d{4})\d+?$/, '$1');
    },

    celular(valor) {
        return this.telefone(valor);
    },

    cep(valor) {
        let v = this.apenasNumeros(valor).slice(0, 8);
        return v.replace(/(\d{5})(\d)/, '$1-$2');
    },

    ncm(valor) {
        let v = this.apenasNumeros(valor).slice(0, 8);
        return v.replace(/(\d{4})(\d)/, '$1.$2')
                .replace(/(\d{2})(\d{1,2})$/, '$1.$2');
    },

    ean(valor) {
        return this.apenasNumeros(valor).slice(0, 14);
    },

    moeda(valor) {
        let v = this.apenasNumeros(valor);
        if (!v) return '';
        v = v.replace(/^0+/, '') || '0';
        while (v.length < 3) v = '0' + v;
        let int = v.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        let dec = v.slice(-2);
        return 'R$ ' + (int || '0') + ',' + dec;
    },

    desformatarMoeda(valor) {
        let v = this.apenasNumeros(valor);
        if (!v) return '0';
        while (v.length < 3) v = '0' + v;
        return v.slice(0, -2) + '.' + v.slice(-2);
    },

    percentual(valor) {
        let v = this.apenasNumeros(valor);
        if (!v) return '';
        v = v.replace(/^0+/, '') || '0';
        while (v.length < 3) v = '0' + v;
        let int = v.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        let dec = v.slice(-2);
        return (int || '0') + ',' + dec + '%';
    },

    desformatarPercentual(valor) {
        return this.desformatarMoeda(valor);
    },

    numero(valor) {
        return this.apenasNumeros(valor);
    },

    decimal(valor) {
        return valor.replace(/[^\d,]/g, '').replace(/(,.*),/g, '$1');
    },

    aplicar(input, tipo) {
        if (!input) return;
        const handler = (e) => {
            let val = e.target.value;
            switch (tipo) {
                case 'cpf': val = this.cpf(val); break;
                case 'cnpj': val = this.cnpj(val); break;
                case 'cpf_cnpj': val = this.cpfCnpj(val); break;
                case 'telefone': val = this.telefone(val); break;
                case 'celular': val = this.telefone(val); break;
                case 'cep': val = this.cep(val); break;
                case 'ncm': val = this.ncm(val); break;
                case 'ean': val = this.ean(val); break;
                case 'moeda': val = this.moeda(val); break;
                case 'percentual': val = this.percentual(val); break;
                case 'numero': val = this.numero(val); break;
                case 'decimal': val = this.decimal(val); break;
            }
            if (e.target.value !== val) e.target.value = val;
        };
        input.addEventListener('input', handler);
        input.addEventListener('blur', handler);
        handler({ target: input });
    },

    aplicarTudo(root = document) {
        root.querySelectorAll('[data-mask]').forEach(el => {
            this.aplicar(el, el.dataset.mask);
        });
    }
};

window.Mascaras = Mascaras;
