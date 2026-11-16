
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db.js';
import { verificarLogin } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_secreta_pequenos_passos',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

app.get('/login', (req, res) => {
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [email]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }

        const usuarioEncontrado = resultado.rows[0];

        if (!(await bcrypt.compare(senha, usuarioEncontrado.senha_hash))) {
            return res.status(401).render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }

        req.session.regenerate((erro) => {
            if (erro) {
                console.error(erro);
                return res.status(500).send('Erro ao realizar login.');
            }

            req.session.usuario = {
                id: usuarioEncontrado.id,
                nome: usuarioEncontrado.nome,
                email: usuarioEncontrado.email
            };

            res.redirect('/dashboard');
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao realizar login.');
    }
});


// LOGOUT

app.post('/logout', verificarLogin, (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


// DASHBOARD

app.get('/dashboard', verificarLogin, (req, res) => {
    res.render('dashboard', {
        usuario: req.session.usuario
    });
});


// RESPONSAVEIS - LISTAR E PESQUISAR

app.get('/responsaveis', verificarLogin, async (req, res) => {
    const busca = req.query.busca || '';

    try {
        const resultado = await pool.query(
            'SELECT * FROM responsaveis ORDER BY nome_completo ASC'
        );

        let responsaveis = resultado.rows;

        if (busca) {
            const encontrados = [];

            for (const responsavel of resultado.rows) {
                const nomeBate = responsavel.nome_completo
                    .toLowerCase()
                    .includes(busca.toLowerCase());

                const cpf = String(busca).replace(/\D/g, '');

                let cpfBate = false;

                if (cpf.length === 11) {
                    cpfBate = await bcrypt.compare(
                        cpf,
                        responsavel.cpf_hash
                    );
                }

                if (nomeBate || cpfBate) {
                    encontrados.push(responsavel);
                }
            }

            responsaveis = encontrados;
        }

        res.render('responsaveis', {
            responsaveis: responsaveis,
            busca: busca
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao buscar responsáveis.');
    }
});


// RESPONSAVEIS - CADASTRAR

app.get('/responsaveis/novo', verificarLogin, (req, res) => {
    res.render('novo-responsavel', { erro: null });
});

app.post('/responsaveis/novo', verificarLogin, async (req, res) => {
    const { nome_completo, email, telefone } = req.body;
    const cpf = String(req.body.cpf || '').replace(/\D/g, '');

    try {
        if (!nome_completo || cpf.length !== 11) {
            return res.status(400).render('novo-responsavel', {
                erro: 'Informe o nome e um CPF válido.'
            });
        }

        const resultado = await pool.query(
            'SELECT cpf_hash FROM responsaveis'
        );

        for (const responsavel of resultado.rows) {
            const cpfExiste = await bcrypt.compare(
                cpf,
                responsavel.cpf_hash
            );

            if (cpfExiste) {
                return res.status(400).render('novo-responsavel', {
                    erro: 'Este CPF já está cadastrado.'
                });
            }
        }

        const cpfHash = await bcrypt.hash(cpf, 10);

        await pool.query(
            `INSERT INTO responsaveis
            (nome_completo, cpf_hash, email, telefone)
            VALUES ($1, $2, $3, $4)`,
            [nome_completo, cpfHash, email, telefone]
        );

        res.redirect('/responsaveis');

    } catch (erro) {
        console.error(erro);
        res.status(400).render('novo-responsavel', {
            erro: 'Não foi possível cadastrar o responsável.'
        });
    }
});


// RESPONSAVEIS - EDITAR

app.get('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM responsaveis WHERE id = $1',
            [id]
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

app.post('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;
    const { nome_completo, email, telefone } = req.body;

    try {
        await pool.query(
            `UPDATE responsaveis
             SET nome_completo = $1,
                 email = $2,
                 telefone = $3
             WHERE id = $4`,
            [nome_completo, email, telefone, id]
        );

        res.redirect('/responsaveis');

    } catch (erro) {
        console.error(erro);
        res.status(400).send('Não foi possível editar o responsável.');
    }
});


// CRIANCAS - LISTAR

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
             ORDER BY c.nome_completo ASC`
        );

        res.render('criancas', {
            criancas: resultado.rows
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao buscar crianças.');
    }
});


// CRIANCAS - CADASTRAR

app.get('/criancas/novo', verificarLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM responsaveis ORDER BY nome_completo ASC'
        );

        res.render('nova-crianca', {
            responsaveis: resultado.rows
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar formulário de crianças.');
    }
});

app.post('/criancas/novo', verificarLogin, async (req, res) => {
    const { nome_completo, data_nascimento, responsavel_id } = req.body;

    try {
        await pool.query(
            `INSERT INTO criancas
            (nome_completo, data_nascimento, responsavel_id)
            VALUES ($1, $2, $3)`,
            [nome_completo, data_nascimento, responsavel_id]
        );

        res.redirect('/criancas');

    } catch (erro) {
        console.error(erro);
        res.status(400).send('Não foi possível cadastrar a criança.');
    }
});


// CRIANCAS - EDITAR

app.get('/criancas/editar/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const criancaResultado = await pool.query(
            'SELECT * FROM criancas WHERE id = $1',
            [id]
        );

        if (criancaResultado.rows.length === 0) {
            return res.status(404).send('Criança não encontrada.');
        }

        const responsaveisResultado = await pool.query(
            'SELECT * FROM responsaveis ORDER BY nome_completo ASC'
        );

        res.render('editar-crianca', {
            crianca: criancaResultado.rows[0],
            responsaveis: responsaveisResultado.rows
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar criança.');
    }
});

app.post('/criancas/editar/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;
    const { nome_completo, data_nascimento, responsavel_id } = req.body;

    try {
        await pool.query(
            `UPDATE criancas
             SET nome_completo = $1,
                 data_nascimento = $2,
                 responsavel_id = $3
             WHERE id = $4`,
            [nome_completo, data_nascimento, responsavel_id, id]
        );

        res.redirect('/criancas');

    } catch (erro) {
        console.error(erro);
        res.status(400).send('Não foi possível editar a criança.');
    }
});


// AGENDAMENTOS - LISTAR

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
             ORDER BY a.data_consulta ASC, a.hora_consulta ASC`
        );

        res.render('agendamentos', {
            agendamentos: resultado.rows
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao buscar agendamentos.');
    }
});


// AGENDAMENTOS - REMARCAR

app.post('/agendamentos/editar/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;
    const { data_consulta, hora_consulta } = req.body;

    try {
        await pool.query(
            `UPDATE agendamentos
             SET data_consulta = $1,
                 hora_consulta = $2
             WHERE id = $3`,
            [data_consulta, hora_consulta, id]
        );

        res.redirect('/agendamentos');

    } catch (erro) {
        console.error(erro);
        res.status(400).send('Não foi possível remarcar o agendamento.');
    }
});


// ROTA INICIAL

app.get('/', verificarLogin, (req, res) => {
    res.redirect('/dashboard');
});


// PAGINA NAO ENCONTRADA

app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});


// INICIAR SERVIDOR

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
