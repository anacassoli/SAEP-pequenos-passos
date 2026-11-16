import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db.js';
import { verificarLogin } from './middleware/auth.js';
import { cadastrarResponsavel } from './novo-responsavel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_secreta_pequenos_passos',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60
    }
}));
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

// Página inicial
app.get('/', (req, res) => {
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// Login
app.get('/login', (req, res) => {
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.render('login', { erro: null });
});
app.post('/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    try {
        const resultado = await pool.query(
            'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1',
            [email]
        );
        if (resultado.rows.length === 0) {
            return res.status(401).render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }
        const usuario = resultado.rows[0];
        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha_hash
        );
        if (!senhaCorreta) {
            return res.status(401).render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }
        req.session.regenerate((erro) => {
            if (erro) {
                console.error(erro);
                return res.status(500).send('Erro ao iniciar a sessão.');
            }
            req.session.usuario = {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            };
            res.redirect('/dashboard');
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao realizar login.');
    }
});

// Logout
app.post('/logout', verificarLogin, (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Dashboard
app.get('/dashboard', verificarLogin, (req, res) => {
    res.render('dashboard', {
        usuario: req.session.usuario
    });
});
// Responsáveis
app.get('/responsaveis', verificarLogin, async (req, res) => {
 const busca = String(req.query.busca || '').trim();
    try {
        const resultado = await pool.query(
            `SELECT id, nome_completo, cpf_hash, email, telefone
             FROM responsaveis
             ORDER BY nome_completo`
        );
        let responsaveis = resultado.rows;
        if (busca) {
            const termo = busca.toLocaleLowerCase('pt-BR');
            const cpf = busca.replace(/\D/g, '');
            const encontrados = await Promise.all(
                resultado.rows.map(async (responsavel) => {
                    const nomeBate = responsavel.nome_completo
                        .toLocaleLowerCase('pt-BR')
                        .includes(termo);
                    let cpfBate = false;
                    if (cpf.length === 11) {
                        cpfBate = await bcrypt.compare(
                            cpf,
                            responsavel.cpf_hash
                        );
                    }
                    return nomeBate || cpfBate ? responsavel : null;
                })
            );
            responsaveis = encontrados.filter(Boolean);
        }
        res.render('responsaveis', {
            responsaveis,
            busca
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar os responsáveis.');
    }
});

// Formulário de novo responsável
app.get('/responsaveis/novo', verificarLogin, (req, res) => {
    res.render('novo-responsavel');
});

// Cadastrar responsável
app.post('/responsaveis/novo', verificarLogin, async (req, res) => {
    const { nome_completo, cpf, email, telefone } = req.body;
    try {
        if (!nome_completo?.trim() || !cpf) {
            return res.status(400).send(
                'Informe o nome e o CPF.'
            );
        }
        await cadastrarResponsavel(
            nome_completo,
            cpf,
            email,
            telefone
        );
        res.redirect('/responsaveis');
    } catch (erro) {
        console.error(erro);
        if (
            erro.message === 'CPF inválido' ||
            erro.message === 'Este CPF já está cadastrado!'
        ) {
            return res.status(400).send(erro.message);
        }
        res.status(500).send('Erro ao cadastrar responsável.');
    }
});

// Formulário de edição de responsável
app.get('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome_completo, email, telefone
             FROM responsaveis
             WHERE id = $1`,
            [req.params.id]
        );
        if (resultado.rows.length === 0) {
            return res.status(404).send('Responsável não encontrado.');
        }
        res.render('editar-responsavel', {
            responsavel: resultado.rows[0]
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar responsável.');
    }
});

// Editar responsável
app.post('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    const { nome_completo, email, telefone } = req.body;
    try {
        if (!nome_completo?.trim()) {
            return res.status(400).send('Informe o nome completo.');
        }
        const resultado = await pool.query(
            `UPDATE responsaveis
             SET nome_completo = $1,
                 email = $2,
                 telefone = $3
             WHERE id = $4`,
            [
                nome_completo.trim(),
                email?.trim() || null,
                telefone?.trim() || null,
                req.params.id
            ]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).send('Responsável não encontrado.');
        }
        res.redirect('/responsaveis');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao editar responsável.');
    }
});

// Crianças
app.get('/criancas', verificarLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT c.id,
                    c.nome_completo,
                    to_char(c.data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                    r.nome_completo AS nome_responsavel
             FROM criancas c
             INNER JOIN responsaveis r
             ON c.responsavel_id = r.id
             ORDER BY c.nome_completo`
        );
        res.render('criancas', {
            criancas: resultado.rows
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar as crianças.');
    }
});

// Formulário de nova criança
app.get('/criancas/novo', verificarLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT id, nome_completo FROM responsaveis ORDER BY nome_completo'
        );
        res.render('nova-crianca', {
            responsaveis: resultado.rows
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar responsáveis.');
    }
});

// Cadastrar criança
app.post('/criancas/novo', verificarLogin, async (req, res) => {
    const { nome_completo, data_nascimento, responsavel_id } = req.body;
    try {
        if (!nome_completo?.trim() || !data_nascimento || !responsavel_id) {
            return res.status(400).send('Preencha todos os campos.');
        }
        await pool.query(
            `INSERT INTO criancas
            (nome_completo, data_nascimento, responsavel_id)
            VALUES ($1, $2, $3)`,
            [nome_completo.trim(), data_nascimento, responsavel_id]
        );
        res.redirect('/criancas');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao cadastrar criança.');
    }
});

// Formulário de edição de criança
app.get('/criancas/editar/:id', verificarLogin, async (req, res) => {
    try {
        const crianca = await pool.query(
            `SELECT id, nome_completo,
                    to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                    responsavel_id
             FROM criancas
             WHERE id = $1`,
            [req.params.id]
        );
        if (crianca.rows.length === 0) {
            return res.status(404).send('Criança não encontrada.');
        }
        const responsaveis = await pool.query(
            'SELECT id, nome_completo FROM responsaveis ORDER BY nome_completo'
        );
        res.render('editar-crianca', {
            crianca: crianca.rows[0],
            responsaveis: responsaveis.rows
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar criança.');
    }
});

// Editar criança
app.post('/criancas/editar/:id', verificarLogin, async (req, res) => {
    const { nome_completo, data_nascimento, responsavel_id } = req.body;
    try {
        if (!nome_completo?.trim() || !data_nascimento || !responsavel_id) {
            return res.status(400).send('Preencha todos os campos.');
        }
        const resultado = await pool.query(
            `UPDATE criancas
             SET nome_completo = $1,
                 data_nascimento = $2,
                 responsavel_id = $3
             WHERE id = $4`,
            [
                nome_completo.trim(),
                data_nascimento,
                responsavel_id,
                req.params.id
            ]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).send('Criança não encontrada.');
        }
        res.redirect('/criancas');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao editar criança.');
    }
});

// Agendamentos
app.get('/agendamentos', verificarLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT a.id,
                    c.nome_completo AS nome_crianca,
                    r.nome_completo AS nome_responsavel,
                    to_char(a.data_consulta, 'DD/MM/YYYY') AS data_consulta,
                    to_char(a.hora_consulta, 'HH24:MI') AS hora_consulta,
                    a.observacao,
                    a.status
             FROM agendamentos a
             INNER JOIN criancas c
             ON a.crianca_id = c.id
             INNER JOIN responsaveis r
             ON a.responsavel_id = r.id
             ORDER BY a.data_consulta, a.hora_consulta`
        );
        res.render('agendamentos', {
            agendamentos: resultado.rows
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar agendamentos.');
    }
});

// Alterar data e horário do agendamento
app.post('/agendamentos/editar/:id', verificarLogin, async (req, res) => {
    const { data_consulta, hora_consulta } = req.body;
    try {
        if (!data_consulta || !hora_consulta) {
            return res.status(400).send('Informe a nova data e horário.');
        }
        const resultado = await pool.query(
            `UPDATE agendamentos
             SET data_consulta = $1,
                 hora_consulta = $2
             WHERE id = $3`,
            [data_consulta, hora_consulta, req.params.id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).send('Agendamento não encontrado.');
        }
        res.redirect('/agendamentos');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao editar agendamento.');
    }
});

// Página não encontrada
app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Pequenos Passos disponível em http://localhost:${PORT}`);
});
