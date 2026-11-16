
import bcrypt from 'bcrypt';
import pool from './db.js';

// Função para cadastrar um novo responsável
export async function cadastrarResponsavel(nome_completo, cpf, email, telefone) {
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
        throw new Error('CPF inválido!');
    }
    const resultado = await pool.query(
        'SELECT cpf_hash FROM responsaveis'
    );
    for (const responsavel of resultado.rows) {
        const cpfExiste = await bcrypt.compare(
            cpfLimpo,
            responsavel.cpf_hash
        );
        if (cpfExiste) {
            throw new Error('Este CPF já está cadastrado!');
        }
    }
    const cpfHash = await bcrypt.hash(cpfLimpo, 10);
    await pool.query(
        `INSERT INTO responsaveis (nome_completo, cpf_hash, email, telefone) VALUES ($1, $2, $3, $4)`,
        [
            nome_completo.trim(),
            cpfHash,
            email?.trim() || null,
            telefone?.trim() || null
        ]
    );
}
