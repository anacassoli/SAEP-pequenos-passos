import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'SAEP_pequenos_passos',
    password: 'senai',
    port: 5432,
});

export default pool;