/**
 * BACKEND_MP_CODE.js
 * ==================
 * Pegá este código en tu index.js de Railway,
 * ANTES de la sección "// ========== INICIAR SERVIDOR =========="
 *
 * También agregá estas variables de entorno en Railway:
 *   MP_ACCESS_TOKEN = TEST-2169653944930562-022412-694c4aa1355c2f010d1d313463a1dc43-340181145
 *   MP_PLAN_ID      = 7d77b92de140451383e4588766e9e4ba
 */

// ========== MERCADOPAGO ==========

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PLAN_ID      = process.env.MP_PLAN_ID;

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
            preapproval_plan_id: MP_PLAN_ID,
            reason: 'CuidaDiario Premium',
            external_reference: String(req.user.id),
            payer_email: user.email,
            back_url: 'https://cuidadiario.com.ar/pages/premium-success.html'
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
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
