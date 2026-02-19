# 🔴 PROBLEMAS CRÍTICOS DEL BACKEND

## ⚠️ Problemas de Seguridad y Funcionalidad

### 1. **Falta Prefijo `/api`**
**Problema**: El frontend espera endpoints como `/api/medicamentos` pero el backend tiene `/medicamentos`

**Solución**: Agregar en el backend ANTES de las rutas:
```javascript
// Agregar prefijo /api a todas las rutas
const apiRouter = express.Router();
// ... mover todas las rutas a apiRouter ...
app.use('/api', apiRouter);
```

O cambiar en el frontend `api.js`:
```javascript
BASE_URL: 'https://tu-proyecto.railway.app', // Sin /api
```

---

### 2. **AuthMiddleware Inconsistente**
**Problema**: Algunos endpoints tienen authMiddleware, otros no. Todos deberían estar protegidos.

**Endpoints SIN protección que DEBERÍAN tenerla**:
```javascript
❌ POST /medicamentos    // Sin authMiddleware
❌ GET  /medicamentos/:id // Sin authMiddleware
❌ PUT  /medicamentos/:id // Sin authMiddleware
❌ DELETE /medicamentos/:id // Sin authMiddleware

❌ GET  /citas           // Sin authMiddleware
❌ GET  /citas/:id       // Sin authMiddleware
❌ PUT  /citas/:id       // Sin authMiddleware
❌ DELETE /citas/:id     // Sin authMiddleware

❌ POST /tareas          // Sin authMiddleware
❌ GET  /tareas          // Sin authMiddleware
❌ GET  /tareas/:id      // Sin authMiddleware
❌ DELETE /tareas/:id    // Sin authMiddleware

❌ POST /sintomas        // Sin authMiddleware
❌ GET  /sintomas        // Sin authMiddleware
❌ GET  /sintomas/:id    // Sin authMiddleware
❌ PUT  /sintomas/:id    // Sin authMiddleware
❌ DELETE /sintomas/:id  // Sin authMiddleware

❌ POST /contactos       // Sin authMiddleware
❌ GET  /contactos       // Sin authMiddleware
❌ GET  /contactos/:id   // Sin authMiddleware
❌ PUT  /contactos/:id   // Sin authMiddleware
```

**Solución**: Agregar `authMiddleware` a TODOS:
```javascript
app.post('/medicamentos', authMiddleware, async (req, res) => {
app.get('/medicamentos/:id', authMiddleware, async (req, res) => {
// etc...
```

---

### 3. **No Filtran por Usuario**
**Problema CRÍTICO**: Los endpoints devuelven TODOS los datos de TODOS los usuarios.

Por ejemplo, `GET /medicamentos` devuelve medicamentos de TODOS los usuarios, no solo del usuario autenticado.

**Solución**: Filtrar por `req.user.id` en las queries:

```javascript
// ANTES (mal):
app.get('/medicamentos', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM medicamentos');
  // ❌ Devuelve medicamentos de TODOS los usuarios
});

// DESPUÉS (bien):
app.get('/medicamentos', authMiddleware, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM medicamentos WHERE usuario_id = $1',
    [req.user.id]
  );
  // ✅ Solo medicamentos del usuario autenticado
});
```

**Aplicar a TODOS los endpoints GET**:
- `GET /medicamentos` → WHERE usuario_id = $1
- `GET /citas` → WHERE usuario_id = $1
- `GET /tareas` → WHERE usuario_id = $1
- `GET /sintomas` → WHERE usuario_id = $1
- `GET /contactos` → WHERE usuario_id = $1

---

### 4. **usuario_id en el Body**
**Problema**: Los endpoints POST esperan `usuario_id` en el body, pero esto es inseguro.

**Solución**: Obtener `usuario_id` del token:
```javascript
// ANTES (inseguro):
app.post('/medicamentos', authMiddleware, async (req, res) => {
  const { usuario_id, nombre, dosis, ... } = req.body;
  // ❌ El usuario podría enviar cualquier usuario_id

// DESPUÉS (seguro):
app.post('/medicamentos', authMiddleware, async (req, res) => {
  const { nombre, dosis, frecuencia, ... } = req.body;
  const usuario_id = req.user.id; // ✅ Del token JWT
  await pool.query(
    'INSERT INTO medicamentos (usuario_id, nombre, ...) VALUES ($1, $2, ...)',
    [usuario_id, nombre, ...]
  );
```

---

### 5. **Falta Endpoint de Registro**
**Problema**: El frontend usa `API.register()` que llama a `/auth/register` pero no existe.

**Solución**: Agregar endpoint `/register`:
```javascript
app.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    // Verificar si el email ya existe
    const existing = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, premium) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, premium',
      [nombre, email, password_hash, false]
    );

    const user = result.rows[0];
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      usuario: user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

### 6. **Falta Endpoint de Test**
**Problema**: `test-connection.html` espera `/api/test` pero no existe.

**Solución**: Agregar:
```javascript
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando' });
});
```

---

### 7. **Falta CORS**
**Problema**: Si no está configurado CORS, el frontend no podrá conectarse.

**Solución**: Agregar:
```javascript
const cors = require('cors');

app.use(cors({
  origin: '*', // O especificar dominios permitidos
  credentials: true
}));
```

---

## 🔧 CÓDIGO CORREGIDO COMPLETO

Aquí está el index.js corregido con TODOS los problemas solucionados:

```javascript
const express = require('express');
const app = express();
const pool = require('./db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta';
const cors = require('cors');

// CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// Middleware de autenticación
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token requerido' });

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

///////////////////// ENDPOINTS PÚBLICOS /////////////////////

app.get('/', (req, res) => {
  res.send('Backend funcionando para CuidaDiario!');
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando' });
});

app.get('/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

///////////////////// AUTENTICACIÓN /////////////////////

// Registro
app.post('/api/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, premium) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, premium',
      [nombre, email, password_hash, false]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, usuario: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        premium: user.premium
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

////////////////////////// MEDICAMENTOS (PROTEGIDOS) /////////////////////

app.post('/api/medicamentos', authMiddleware, async (req, res) => {
  const { nombre, dosis, frecuencia, hora_inicio, recordatorio, notas } = req.body;
  const usuario_id = req.user.id; // Del token
  try {
    const result = await pool.query(
      'INSERT INTO medicamentos (usuario_id, nombre, dosis, frecuencia, hora_inicio, recordatorio, notas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [usuario_id, nombre, dosis, frecuencia, hora_inicio, recordatorio || false, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicamentos', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medicamentos WHERE usuario_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/medicamentos/:id', authMiddleware, async (req, res) => {
  const { nombre, dosis, frecuencia, hora_inicio, recordatorio, notas } = req.body;
  try {
    const result = await pool.query(
      'UPDATE medicamentos SET nombre = $1, dosis = $2, frecuencia = $3, hora_inicio = $4, recordatorio = $5, notas = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [nombre, dosis, frecuencia, hora_inicio, recordatorio, notas, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medicamento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/medicamentos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM medicamentos WHERE id = $1 AND usuario_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medicamento no encontrado' });
    res.json({ message: 'Medicamento eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repetir el mismo patrón para CITAS, TAREAS, SÍNTOMAS y CONTACTOS
// ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
```

---

## 📋 Resumen de Cambios Necesarios

| # | Problema | Impacto | Urgencia |
|---|----------|---------|----------|
| 1 | Falta prefijo `/api` | ⚠️ Medio | Alta |
| 2 | AuthMiddleware inconsistente | 🔴 Alto | Crítica |
| 3 | No filtran por usuario | 🔴 Crítico | Crítica |
| 4 | usuario_id en body | 🔴 Alto | Alta |
| 5 | Falta endpoint /register | ⚠️ Medio | Alta |
| 6 | Falta endpoint /test | ⚠️ Bajo | Media |
| 7 | Falta CORS | 🔴 Alto | Crítica |

---

## 📄 CÓDIGO COMPLETO CORREGIDO - index.js

Aquí está el código **completo** del backend con **todas las correcciones aplicadas**:

```javascript
const express = require('express');
const app = express();
const pool = require('./db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta';
const cors = require('cors');

// ========== CONFIGURACIÓN ==========

// CORS - Permitir peticiones desde el frontend
app.use(cors({
  origin: '*', // En producción, especifica tu dominio: 'https://tu-dominio.com'
  credentials: true
}));

app.use(express.json());

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token requerido' });

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ========== ENDPOINTS PÚBLICOS ==========

app.get('/', (req, res) => {
  res.send('Backend funcionando para CuidaDiario!');
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente' });
});

app.get('/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now, status: 'Database connected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== AUTENTICACIÓN ==========

// Registro de usuarios
app.post('/api/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  
  try {
    const existing = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, premium) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, premium',
      [nombre, email, password_hash, false]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ token, usuario: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        premium: user.premium
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MEDICAMENTOS (PROTEGIDOS) ==========

app.post('/api/medicamentos', authMiddleware, async (req, res) => {
  const { nombre, dosis, frecuencia, hora_inicio, recordatorio, notas } = req.body;
  const usuario_id = req.user.id;
  
  try {
    const result = await pool.query(
      'INSERT INTO medicamentos (usuario_id, nombre, dosis, frecuencia, hora_inicio, recordatorio, notas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [usuario_id, nombre, dosis, frecuencia, hora_inicio, recordatorio || false, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicamentos', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM medicamentos WHERE usuario_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicamentos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM medicamentos WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/medicamentos/:id', authMiddleware, async (req, res) => {
  const { nombre, dosis, frecuencia, hora_inicio, recordatorio, notas } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE medicamentos SET nombre = $1, dosis = $2, frecuencia = $3, hora_inicio = $4, recordatorio = $5, notas = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [nombre, dosis, frecuencia, hora_inicio, recordatorio, notas, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/medicamentos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM medicamentos WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    res.json({ message: 'Medicamento eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CITAS (PROTEGIDOS) ==========

app.post('/api/citas', authMiddleware, async (req, res) => {
  const { tipo, titulo, fecha, hora, lugar, profesional, notas, recordatorio } = req.body;
  const usuario_id = req.user.id;
  
  try {
    const result = await pool.query(
      'INSERT INTO citas (usuario_id, tipo, titulo, fecha, hora, lugar, profesional, notas, recordatorio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [usuario_id, tipo, titulo, fecha, hora, lugar, profesional, notas, recordatorio]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/citas', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM citas WHERE usuario_id = $1 ORDER BY fecha DESC, hora DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/citas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM citas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/citas/:id', authMiddleware, async (req, res) => {
  const { tipo, titulo, fecha, hora, lugar, profesional, notas, recordatorio } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE citas SET tipo = $1, titulo = $2, fecha = $3, hora = $4, lugar = $5, profesional = $6, notas = $7, recordatorio = $8 WHERE id = $9 AND usuario_id = $10 RETURNING *',
      [tipo, titulo, fecha, hora, lugar, profesional, notas, recordatorio, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/citas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM citas WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json({ message: 'Cita eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== TAREAS (PROTEGIDOS) ==========

app.post('/api/tareas', authMiddleware, async (req, res) => {
  const { titulo, categoria, fecha, hora, frecuencia, completada } = req.body;
  const usuario_id = req.user.id;
  
  try {
    const result = await pool.query(
      'INSERT INTO tareas (usuario_id, titulo, categoria, fecha, hora, frecuencia, completada) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [usuario_id, titulo, categoria, fecha, hora, frecuencia, completada || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tareas', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tareas WHERE usuario_id = $1 ORDER BY fecha DESC, hora DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tareas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tareas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tareas/:id', authMiddleware, async (req, res) => {
  const { titulo, categoria, fecha, hora, frecuencia, completada } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE tareas SET titulo = $1, categoria = $2, fecha = $3, hora = $4, frecuencia = $5, completada = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [titulo, categoria, fecha, hora, frecuencia, completada, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tareas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tareas WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SÍNTOMAS (PROTEGIDOS) ==========

app.post('/api/sintomas', authMiddleware, async (req, res) => {
  const { nombre, intensidad, estado_animo, descripcion, fecha, hora } = req.body;
  const usuario_id = req.user.id;
  
  try {
    const result = await pool.query(
      'INSERT INTO sintomas (usuario_id, nombre, intensidad, estado_animo, descripcion, fecha, hora) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [usuario_id, nombre, intensidad, estado_animo, descripcion, fecha, hora]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sintomas', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sintomas WHERE usuario_id = $1 ORDER BY fecha DESC, hora DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sintomas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sintomas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Síntoma no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sintomas/:id', authMiddleware, async (req, res) => {
  const { nombre, intensidad, estado_animo, descripcion, fecha, hora } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE sintomas SET nombre = $1, intensidad = $2, estado_animo = $3, descripcion = $4, fecha = $5, hora = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *',
      [nombre, intensidad, estado_animo, descripcion, fecha, hora, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Síntoma no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sintomas/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM sintomas WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Síntoma no encontrado' });
    }
    res.json({ message: 'Síntoma eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CONTACTOS (PROTEGIDOS) ==========

app.post('/api/contactos', authMiddleware, async (req, res) => {
  const { nombre, categoria, especialidad, telefono, email, direccion, notas } = req.body;
  const usuario_id = req.user.id;
  
  try {
    const result = await pool.query(
      'INSERT INTO contactos (usuario_id, nombre, categoria, especialidad, telefono, email, direccion, notas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [usuario_id, nombre, categoria, especialidad, telefono, email, direccion, notas]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contactos', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 ORDER BY nombre ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contactos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contactos/:id', authMiddleware, async (req, res) => {
  const { nombre, categoria, especialidad, telefono, email, direccion, notas } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE contactos SET nombre = $1, categoria = $2, especialidad = $3, telefono = $4, email = $5, direccion = $6, notas = $7 WHERE id = $8 AND usuario_id = $9 RETURNING *',
      [nombre, categoria, especialidad, telefono, email, direccion, notas, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contactos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM contactos WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json({ message: 'Contacto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
```

---

## ✅ Pasos para Aplicar

1. **Instalar CORS** (si no lo tienes):
   ```bash
   npm install cors
   ```

2. **Reemplazar tu index.js** con el código de arriba

3. **Reiniciar el servidor**:
   ```bash
   npm start
   # o
   node index.js
   ```

4. **Configurar URL en frontend**: `js/api.js` línea 11

5. **Probar**: `tests/test-connection.html`

---

## ✅ Siguiente Paso

1. **Corregir el backend** con los cambios mencionados
2. **Actualizar el frontend** si es necesario (probablemente solo la URL base)
3. **Testear** con test-connection.html
