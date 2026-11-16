CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(60) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responsaveis (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    cpf_hash VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(150),
    telefone VARCHAR(20),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS criancas (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_id INT NOT NULL REFERENCES responsaveis(id)
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    crianca_id INT NOT NULL REFERENCES criancas(id)
    responsavel_id INT NOT NULL REFERENCES responsaveis(id)
    data_consulta DATE NOT NULL,
    hora_consulta TIME NOT NULL,
    observacao TEXT,
    status VARCHAR(30) DEFAULT 'Agendado'
);

INSERT INTO usuarios (nome, email, senha_hash)VALUES
    ('Administrador', 'admin@pequenospassos.com','$2b$10$0aPZ1poQD6qApmkw/MYqF.d1k3rDZ/6ZLsKlOlOaLO3SH8k9pzIbC'),
    ('Atendente', 'atendente@pequenospassos.com','$2b$10$gg9XVw8pkviLVypXXZ8JDeqzJy22lXFnX/kK/Wdv4Tt/ZazYbHz8q');

INSERT INTO responsaveis(nome_completo, cpf_hash, email, telefone)VALUES
    ('Maria Oliveira', '$2b$10$9LpNNyJne8NaQYdAer/YPezgbwRf/iaW9Wy0YEF3IEY02SJM0HpM6','maria@email.com', '11999999999'),
    ('Joao Santos', '$2b$10$Ofyar9ni6eSFfjtlzMTS2ukx3tggSVGiaWjo.b/XA03mD1UMZc5.2','joao@email.com', '11988888888'),
    ('Ana Costa', '$2b$10$Mhl7blCVd2WyPWt3tTkR9uMw/Ng25CV2FXVCe2Va7wP24y761ykwe','ana@email.com', '11977777777');

INSERT INTO criancas(nome_completo, data_nascimento, responsavel_id)VALUES
    ('Lucas Oliveira', '2018-05-10', 1),
    ('Pedro Santos', '2019-08-15', 2),
    ('Julia Costa', '2020-03-20', 3);

INSERT INTO agendamentos(crianca_id, responsavel_id, data_consulta,hora_consulta, observacao, status) VALUES
    (1, 1, '2026-11-20', '09:00:00','Consulta de rotina', 'Agendado'),
    (2, 2, '2026-11-21', '10:30:00','Acompanhamento', 'Agendado'),
    (3, 3, '2026-11-22', '14:00:00','Retorno', 'Agendado');