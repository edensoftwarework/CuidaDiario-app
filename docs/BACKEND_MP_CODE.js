/**
 * BACKEND_MP_CODE.js
 * ==================
 * Pegá este código en tu index.js de Railway,
 * ANTES de la sección "// ========== INICIAR SERVIDOR =========="
 *
 * Variable de entorno requerida en Railway:
 *
 *   SANDBOX (pruebas):
 *     MP_ACCESS_TOKEN = TEST-xxxxxxxxxxxxxxxxxxxx  (token que empieza con TEST-)
 *
 *   PRODUCCIÓN:
 *     MP_ACCESS_TOKEN = APP_USR-xxxxxxxxxxxxxxxxxxxx  (token que empieza con APP_USR-)
 *
 * Cómo obtener el token de producción:
 *   1. Ir a mercadopago.com.ar/developers/panel/app
 *   2. Seleccionar tu aplicación
 *   3. Credenciales de producción → Access Token
 */

// ========== MERCADOPAGO ==========

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Helper para llamadas a la API de MercadoPago (compatible con Node 16+)
function mpRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
            hostname: 'api.mercadopago.com',
            path,
            method,
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// POST /api/create-subscription — crea una suscripción MP para el usuario autenticado
app.post('/api/create-subscription', authMiddleware, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT nombre, email FROM usuarios WHERE id=$1', [req.user.id]);
        if (userResult.rows.length === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const user = userResult.rows[0];

        const payload = {
            reason: 'CuidaDiario Premium',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 3500,
                currency_id: 'ARS'
            },
            back_url: 'https://cuidadiario.edensoftwork.com/pages/premium-success.html',
            payer_email: user.email,
            external_reference: String(req.user.id)
        };

        const mp = await mpRequest('/preapproval', 'POST', payload);

        if (mp.status !== 200 && mp.status !== 201) {
            console.error('Error MP create-subscription:', mp.body);
            return res.status(400).json({ error: mp.body?.message || 'Error al crear suscripción en MercadoPago' });
        }

        res.json({ init_point: mp.body.init_point, preapproval_id: mp.body.id });
    } catch (err) {
        console.error('Error create-subscription:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/webhook/mercadopago — recibe notificaciones de MercadoPago (IPN / Webhooks)
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;

        // MercadoPago envía type: "subscription_preapproval" cuando cambia el estado
        if (type === 'subscription_preapproval' && data?.id) {
            const mp = await mpRequest(`/preapproval/${data.id}`);

            if (mp.status === 200) {
                const preapproval = mp.body;
                const userId = parseInt(preapproval.external_reference);
                if (userId && !isNaN(userId)) {
                    // "authorized" = activo, "paused" / "cancelled" = inactivo
                    const isPremium = preapproval.status === 'authorized';
                    await pool.query('UPDATE usuarios SET premium=$1 WHERE id=$2', [isPremium, userId]);
                    console.log(`[MP Webhook] Usuario ${userId} → premium: ${isPremium} (estado: ${preapproval.status})`);
                }
            }
        }

        // Siempre responder 200 para evitar reintentos innecesarios de MP
        res.sendStatus(200);
    } catch (err) {
        console.error('[MP Webhook] Error:', err.message);
        res.sendStatus(200);
    }
});

// GET /api/me — obtener datos actuales del usuario autenticado (usado por premium-success.html)
app.get('/api/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, email, premium FROM usuarios WHERE id=$1',
            [req.user.id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ usuario: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/profile — actualizar nombre, email y/o contraseña del usuario autenticado
app.put('/api/profile', authMiddleware, async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        if (!nombre || !email)
            return res.status(400).json({ error: 'Nombre y email son requeridos' });

        // Verificar que el email no esté en uso por otro usuario
        const existing = await pool.query(
            'SELECT id FROM usuarios WHERE email=$1 AND id!=$2',
            [email, req.user.id]
        );
        if (existing.rows.length > 0)
            return res.status(400).json({ error: 'El email ya está en uso por otra cuenta' });

        let result;
        if (password) {
            const bcrypt = require('bcrypt');
            const password_hash = await bcrypt.hash(password, 10);
            result = await pool.query(
                'UPDATE usuarios SET nombre=$1, email=$2, password_hash=$3 WHERE id=$4 RETURNING id, nombre, email, premium',
                [nombre, email, password_hash, req.user.id]
            );
        } else {
            result = await pool.query(
                'UPDATE usuarios SET nombre=$1, email=$2 WHERE id=$3 RETURNING id, nombre, email, premium',
                [nombre, email, req.user.id]
            );
        }

        res.json({ mensaje: 'Perfil actualizado', usuario: result.rows[0] });
    } catch (err) {
        console.error('Error actualizando perfil:', err);
        res.status(500).json({ error: err.message });
    }
});
