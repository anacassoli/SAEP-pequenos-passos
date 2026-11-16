
import bcrypt from 'bcrypt';
import pool from './db.js';

// Função para cadastrar um novo responsável
export async function cadastrarResponsavel(nome_completo, cpf, email, telefone) {

    // Remove pontos e traços do CPF
    const cpfLimpo = String(cpf).replace(/\D/g, '');

    // Verifica se o CPF possui 11 números
    if (cpfLimpo.length !== 11) {
        throw new Error('CPF inválido!');
    }

    // Busca os CPFs cadastrados
    const resultado = await pool.query(
        'SELECT cpf_hash FROM responsaveis'
    );

    // Verifica se o CPF já está cadastrado
    for (const responsavel of resultado.rows) {
        const cpfExiste = await bcrypt.compare(
            cpfLimpo,
            responsavel.cpf_hash
        );

        if (cpfExiste) {
            throw new Error('Este CPF já está cadastrado!');
        }
    }

    // Criptografa o CPF
    const cpfHash = await bcrypt.hash(cpfLimpo, 10);

    // Insere o responsável no banco de dados
    await pool.query(
        `INSERT INTO responsaveis
        (nome_completo, cpf_hash, email, telefone)
        VALUES ($1, $2, $3, $4)`,
        [
            nome_completo.trim(),
            cpfHash,
            email?.trim() || null,
            telefone?.trim() || null
        ]
    );
}
