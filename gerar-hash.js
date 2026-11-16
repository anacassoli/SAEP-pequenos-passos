
import bcrypt from 'bcrypt';

// Dados para gerar os hashes
const cpfPlana = '33333333333';
const senha1 = '123456';
const senha2 = '123457';

const saltRounds = 10;

// Gera o hash do CPF
async function gerarHashCPF() {
    try {
        const hash = await bcrypt.hash(cpfPlana, saltRounds);

        console.log('====================================================');
        console.log(`CPF Original: ${cpfPlana}`);
        console.log(`Hash do CPF: ${hash}`);
        console.log('====================================================');

        return hash;
    } catch (erro) {
        console.error('Erro ao gerar hash do CPF:', erro);
    }
}

// Gera o hash da primeira senha
async function gerarHashSenha1() {
    try {
        const hash = await bcrypt.hash(senha1, saltRounds);

        console.log('====================================================');
        console.log(`Senha Original: ${senha1}`);
        console.log(`Hash da senha: ${hash}`);
        console.log('====================================================');

        return hash;
    } catch (erro) {
        console.error('Erro ao gerar hash da senha:', erro);
    }
}

// Gera o hash da segunda senha
async function gerarHashSenha2() {
    try {
        const hash = await bcrypt.hash(senha2, saltRounds);

        console.log('====================================================');
        console.log(`Senha Original: ${senha2}`);
        console.log(`Hash da senha: ${hash}`);
        console.log('====================================================');

        return hash;
    } catch (erro) {
        console.error('Erro ao gerar hash da senha:', erro);
    }
}

// Executa as funcoes
async function gerarHashes() {
    await gerarHashCPF();
    await gerarHashSenha1();
    await gerarHashSenha2();
}

gerarHashes();
