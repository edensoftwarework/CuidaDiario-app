# 📁 Estructura del Proyecto - CuidaDiario

## 📂 Organización de Carpetas

```
RutinaFamiliar-app/
│
├── 📄 index.html                 # Página principal de la aplicación
├── 📄 login.html                 # Página de login y registro
├── 📄 README.md                  # README original del proyecto
│
├── 📁 css/
│   └── styles.css                # Estilos globales de la aplicación
│
├── 📁 js/
│   ├── api.js                    # Cliente API (⚠️ configurar URL aquí)
│   ├── storage.js                # Capa de almacenamiento (API calls)
│   ├── app.js                    # Lógica principal de la aplicación
│   ├── reports.js                # Sistema de reportes
│   ├── payments.js               # Sistema de pagos y premium
│   └── notifications.js          # Sistema de notificaciones
│
├── 📁 pages/
│   ├── about.html                # Página "Sobre Nosotros"
│   ├── privacy.html              # Política de privacidad
│   └── terms.html                # Términos y condiciones
│
├── 📁 docs/
│   ├── START_HERE.md             # 🎯 Resumen ejecutivo (EMPIEZA AQUÍ)
│   ├── CHECKLIST.md              # Lista de verificación completa
│   ├── MIGRATION_GUIDE.md        # Guía técnica de migración
│   ├── README_FRONTEND.md        # Documentación completa del frontend
│   └── BACKEND_ISSUES.md         # ⚠️ Problemas críticos del backend
│
├── 📁 tests/
│   ├── test-connection.html      # 🔧 Test de conexión al backend
│   └── SUCCESS.html              # Página de resumen visual
│
└── 📁 backups/
    ├── app-old-backup.js         # Backup del app.js original
    └── storage-old-backup.js     # Backup del storage.js original
```

---

## 🎯 Archivos Importantes

### Para Empezar
1. **docs/START_HERE.md** - Lee esto primero
2. **tests/test-connection.html** - Prueba la conexión al backend
3. **js/api.js** - ⚠️ **CONFIGURAR URL DEL BACKEND AQUÍ** (línea 10)

### Para Usar la App
1. **login.html** - Iniciar sesión o registrarse
2. **index.html** - Aplicación principal (requiere login)

### Para Desarrollo
1. **docs/BACKEND_ISSUES.md** - ⚠️ **Problemas críticos que debes corregir**
2. **docs/MIGRATION_GUIDE.md** - Guía técnica completa
3. **docs/CHECKLIST.md** - Lista de tareas

---

## 🚀 Inicio Rápido

### 1. Configurar Backend
```javascript
// Abrir: js/api.js (línea 10)
BASE_URL: 'https://tu-proyecto.railway.app',
```

### 2. Iniciar Servidor Local
```powershell
# Opción 1: Python
python -m http.server 8000

# Opción 2: Node.js
npx http-server -p 8000

# Opción 3: VS Code Live Server
# Click derecho en index.html → Open with Live Server
```

### 3. Probar Conexión
```
Abrir: http://localhost:8000/tests/test-connection.html
```

### 4. Usar la App
```
Abrir: http://localhost:8000/login.html
Registrar usuario
Explorar la aplicación
```

---

## ⚠️ IMPORTANTE: Problemas del Backend

El backend tiene **7 problemas críticos** que debes corregir:

1. ❌ Falta prefijo `/api` en las rutas
2. ❌ AuthMiddleware inconsistente (no todos los endpoints están protegidos)
3. ❌ No filtran por usuario (devuelven datos de TODOS los usuarios)
4. ❌ Aceptan `usuario_id` en el body (inseguro)
5. ❌ Falta endpoint `/api/register`
6. ❌ Falta endpoint `/api/test`
7. ❌ Falta configuración CORS

**📖 Lee [docs/BACKEND_ISSUES.md](docs/BACKEND_ISSUES.md) para soluciones detalladas**

---

## 📝 Cambios en esta Reorganización

### Movidos a `css/`
- `styles.css`

### Movidos a `js/`
- `api.js`
- `app.js`
- `storage.js`
- `reports.js`
- `payments.js`
- `notifications.js`

### Movidos a `pages/`
- `about.html`
- `privacy.html`
- `terms.html`

### Movidos a `docs/`
- `START_HERE.md`
- `CHECKLIST.md`
- `MIGRATION_GUIDE.md`
- `README_FRONTEND.md`
- `BACKEND_ISSUES.md`

### Movidos a `tests/`
- `test-connection.html`
- `SUCCESS.html`

### Movidos a `backups/`
- `app-old-backup.js`
- `storage-old-backup.js`

### Actualizadas todas las rutas en:
- `index.html`
- `login.html`
- `about.html`
- `privacy.html`
- `terms.html`
- `test-connection.html`
- `SUCCESS.html`

---

## ✅ Estado del Proyecto

```
FRONTEND: ✅ Organizado y funcional
BACKEND:  ⚠️ Necesita correcciones (ver BACKEND_ISSUES.md)
TESTING:  ⏳ Pendiente
```

---

## 📞 Siguiente Paso

1. **Leer**: [docs/BACKEND_ISSUES.md](docs/BACKEND_ISSUES.md)
2. **Corregir**: Backend según las indicaciones
3. **Configurar**: URL en `js/api.js`
4. **Probar**: [tests/test-connection.html](tests/test-connection.html)

---

by **EDEN SoftWork** 🚀
