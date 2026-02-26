/**
 * BACKEND_PUSH_CODE.js
 * =====================================================================
 * Código para agregar al backend (index.js en Railway) para soportar
 * Push Notifications en CuidaDiario.
 *
 * PASOS:
 * 1. En Railway shell o localmente, instalar web-push:
 *      npm install web-push
 *
 * 2. Generar claves VAPID (UNA sola vez):
 *      npx web-push generate-vapid-keys
 *    Copia las claves generadas y ponlas en las variables de entorno de Railway:
 *      VAPID_PUBLIC_KEY=<publicKey>
 *      VAPID_PRIVATE_KEY=<privateKey>
 *      VAPID_EMAIL=mailto:edensoftwarework@gmail.com
 *
 * 3. Copiar TODO el código de abajo en tu index.js (reemplazando la sección marcada)
 * =====================================================================
 */

// ========== DEPENDENCIAS (agregar al inicio de index.js) ==========
// const webPush = require('web-push');   // ← AGREGAR ESTA LÍNEA junto a los otros requires

// ========== CONFIGURACIÓN WEB-PUSH (agregar después de las constantes MP) ==========
/*
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL       = process.env.VAPID_EMAIL || 'mailto:edensoftwarework@gmail.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('✅ Web Push VAPID configurado');
} else {
    console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas. Push notifications desactivadas.');
}
*/

// ========== MIGRACIÓN: tabla push_subscriptions ==========
// Agregar dentro de runMigrations():
/*
    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id           SERIAL PRIMARY KEY,
            usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            endpoint     TEXT    NOT NULL,
            p256dh       TEXT,
            auth         TEXT,
            created_at   TIMESTAMP DEFAULT NOW(),
            UNIQUE(usuario_id, endpoint)
        )
    `);
    console.log('✅ Tabla push_subscriptions lista');
*/

// ========== ENDPOINTS DE PUSH ==========

// POST /api/push/subscribe — guardar suscripción push del usuario
/*
app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: 'Suscripción inválida' });
        }
        await pool.query(`
            INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (usuario_id, endpoint) DO UPDATE SET p256dh=$3, auth=$4
        `, [req.user.id, endpoint, keys.p256dh, keys.auth]);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error guardando push subscription:', err);
        res.status(500).json({ error: err.message });
    }
});
*/

// DELETE /api/push/unsubscribe — eliminar suscripción push del usuario
/*
app.delete('/api/push/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) {
            await pool.query(
                'DELETE FROM push_subscriptions WHERE usuario_id=$1 AND endpoint=$2',
                [req.user.id, endpoint]
            );
        } else {
            await pool.query('DELETE FROM push_subscriptions WHERE usuario_id=$1', [req.user.id]);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
*/

// GET /api/push/vapid-key — devolver clave pública VAPID al frontend
/*
app.get('/api/push/vapid-key', (req, res) => {
    if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push no configurado' });
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});
*/

// ========== HELPER: enviar push a un usuario ==========
/*
async function sendPushToUser(userId, payload) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
    try {
        const subs = await pool.query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id=$1',
            [userId]
        );
        const promises = subs.rows.map(sub => {
            const subscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            return webPush.sendNotification(subscription, JSON.stringify(payload))
                .catch(async err => {
                    // Si el endpoint ya no es válido (410 Gone), eliminar la suscripción
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await pool.query(
                            'DELETE FROM push_subscriptions WHERE endpoint=$1',
                            [sub.endpoint]
                        );
                    }
                    console.warn(`[Push] Error enviando a ${sub.endpoint.substring(0, 40)}:`, err.message);
                });
        });
        await Promise.all(promises);
    } catch (err) {
        console.error('[Push] Error en sendPushToUser:', err.message);
    }
}
*/

// ========== CHEQUEO PERIÓDICO DE RECORDATORIOS ==========
// Esta función corre cada hora en el servidor y envía push a usuarios
// con medicamentos o citas próximas. Agregar al final del index.js, antes del app.listen.
/*
function startPushReminders() {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.log('ℹ️  Push reminders desactivados (VAPID keys no configuradas)');
        return;
    }

    async function checkAndSendReminders() {
        try {
            const now = new Date();
            const nowHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            const todayStr = now.toISOString().split('T')[0];

            // ── 1. Recordatorios de medicamentos con recordatorio=true y hora próxima (±30min) ──
            const meds = await pool.query(`
                SELECT m.usuario_id, m.nombre, m.dosis, m.hora_inicio
                FROM medicamentos m
                INNER JOIN push_subscriptions ps ON ps.usuario_id = m.usuario_id
                WHERE m.recordatorio = true
                  AND m.hora_inicio IS NOT NULL
                  AND m.hora_inicio BETWEEN
                      TO_CHAR(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
                      AND TO_CHAR((NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '35 minutes'), 'HH24:MI')
            `);

            for (const med of meds.rows) {
                await sendPushToUser(med.usuario_id, {
                    title: '💊 Recordatorio de medicamento',
                    body: `${med.nombre} — ${med.dosis} a las ${med.hora_inicio}`,
                    tag: `med-${med.usuario_id}-${med.nombre}`,
                    url: '/'
                });
            }

            // ── 2. Citas de mañana con recordatorio ──
            const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
            const citas = await pool.query(`
                SELECT c.usuario_id, c.titulo, c.fecha, c.hora, c.lugar
                FROM citas c
                INNER JOIN push_subscriptions ps ON ps.usuario_id = c.usuario_id
                WHERE c.recordatorio IS NOT NULL
                  AND c.fecha = $1
            `, [tomorrowStr]);

            for (const cita of citas.rows) {
                await sendPushToUser(cita.usuario_id, {
                    title: '📅 Cita médica mañana',
                    body: `${cita.titulo}${cita.hora ? ' a las ' + cita.hora : ''}${cita.lugar ? ' en ' + cita.lugar : ''}`,
                    tag: `cita-${cita.usuario_id}-${tomorrowStr}`,
                    url: '/'
                });
            }

            // ── 3. Tareas de hoy no completadas (aviso a las 8 AM) ──
            if (now.getHours() === 8 && now.getMinutes() < 30) {
                const tareas = await pool.query(`
                    SELECT t.usuario_id, COUNT(*) as pendientes
                    FROM tareas t
                    INNER JOIN push_subscriptions ps ON ps.usuario_id = t.usuario_id
                    WHERE t.completada = false
                      AND t.fecha = $1
                    GROUP BY t.usuario_id
                `, [todayStr]);

                for (const row of tareas.rows) {
                    await sendPushToUser(row.usuario_id, {
                        title: '✓ Tareas pendientes hoy',
                        body: `Tenés ${row.pendientes} tarea${row.pendientes > 1 ? 's' : ''} pendiente${row.pendientes > 1 ? 's' : ''} para hoy`,
                        tag: `tareas-${row.usuario_id}-${todayStr}`,
                        url: '/'
                    });
                }
            }

            console.log(`[Push Reminders] Chequeo completado a las ${nowHHMM}`);
        } catch (err) {
            console.error('[Push Reminders] Error:', err.message);
        }
    }

    // Correr inmediatamente al iniciar y luego cada hora
    checkAndSendReminders();
    setInterval(checkAndSendReminders, 60 * 60 * 1000); // cada 1 hora
    console.log('✅ Push reminders iniciados (chequeo cada hora)');
}

// Llamar después del app.listen:
// startPushReminders();
*/

// ========== CÓMO INTEGRAR TODO ==========
/*
PASOS FINALES:

1. En package.json agregar: "web-push": "^3.6.x"
   Luego en Railway: el deploy automático lo instalará.

2. En Railway → Variables de entorno, agregar:
   VAPID_PUBLIC_KEY=<tu clave pública generada>
   VAPID_PRIVATE_KEY=<tu clave privada generada>
   VAPID_EMAIL=mailto:edensoftwarework@gmail.com

3. En el frontend (index.html), reemplazar el placeholder:
   const VAPID_PUBLIC_KEY = 'TU_VAPID_PUBLIC_KEY_AQUI';
   → por tu clave pública real (la misma que en VAPID_PUBLIC_KEY de Railway).

4. Deploy y listo. Los usuarios verán el botón "Activar notificaciones" en su perfil.
*/
