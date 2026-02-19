# 📋 Guía de Migración Frontend → API

## ✅ Completado

- ✅ **api.js**: Cliente API completo con manejo de tokens JWT
- ✅ **login.html**: Interfaz de login/registro
- ✅ **index.html**: Verificación de autenticación y botón de logout
- ✅ **storage.js**: Todos los métodos CRUD ahora usan la API

## 🔧 Cambios Necesarios en app.js

Todas las funciones que llaman a `Storage` ahora necesitan `async/await` porque los métodos de Storage ahora son asíncronos.

### Funciones que necesitan convertirse a async:

```javascript
// Dashboard
async function loadDashboard()
async function updateDashboardStats()
async function updateUpcomingActivities()

// Medicamentos
async function loadMedicamentos()
async function editMedicamento(id)
async function deleteMedicamento(id)
async function saveMedicamento(event)

// Citas
async function loadCitas()
async function renderCalendar()
async function editCita(id)
async function deleteCita(id)
async function saveCita(event)

// Tareas
async function loadTareas()
async function editTarea(id)
async function deleteTarea(id)
async function saveTarea(event)
async function toggleTarea(id)

// Síntomas
async function loadSintomas()
async function editSintoma(id)
async function deleteSintoma(id)
async function saveSintoma(event)

// Contactos
async function loadContactos()
async function editContacto(id)
async function deleteContacto(id)
async function saveContacto(event)

// Reportes
async function loadReportes()
```

### Patrón de Conversión

**ANTES:**
```javascript
function loadMedicamentos() {
    const medicamentos = Storage.getMedicamentos();
    // ... render ...
}
```

**DESPUÉS:**
```javascript
async function loadMedicamentos() {
    const medicamentos = await Storage.getMedicamentos();
    // ... render ...
}
```

### Llamadas a funciones async

Cuando llamas una función async, también necesitas await:

**ANTES:**
```javascript
function navigateToSection(sectionId) {
    switch(sectionId) {
        case 'medicamentos':
            loadMedicamentos(); // ❌ NO funciona ahora
            break;
    }
}
```

**DESPUÉS:**
```javascript
async function navigateToSection(sectionId) {
    switch(sectionId) {
        case 'medicamentos':
            await loadMedicamentos(); // ✅ Correcto
            break;
    }
}
```

### Manejo de errores

Envuelve las operaciones en try/catch para mostrar errores al usuario:

```javascript
async function deleteMedicamento(id) {
    if (!confirm('¿Seguro que deseas eliminar este medicamento?')) return;
    
    try {
        await Storage.deleteMedicamento(id);
        await loadMedicamentos(); // Recargar lista
        showNotification('Medicamento eliminado correctamente', 'success');
    } catch (error) {
        // Storage.deleteMedicamento ya muestra un alert, pero puedes personalizar
        console.error('Error al eliminar:', error);
    }
}
```

### Estados de carga

Para mejorar la UX, agrega indicadores de carga:

```javascript
async function loadMedicamentos() {
    const container = document.getElementById('medicamentosList');
    container.innerHTML = '<p class="loading">Cargando medicamentos...</p>';
    
    try {
        const medicamentos = await Storage.getMedicamentos();
        // ... render medicamentos ...
    } catch (error) {
        container.innerHTML = '<p class="error">Error al cargar medicamentos</p>';
    }
}
```

## 🔧 Cambios Necesarios en reports.js

El archivo `reports.js` también necesita async/await:

```javascript
async function generateReport() {
    const data = await Storage.exportData();
    // ... procesar reporte ...
}
```

## ⚙️ Configuración del Backend

En `api.js`, línea 6, configura la URL de tu backend en Railway:

```javascript
// CAMBIAR ESTO:
BASE_URL: 'http://localhost:3000/api',

// POR ESTO (tu URL de Railway):
BASE_URL: 'https://tu-app.railway.app/api',
```

## 🧪 Testing

### 1. Probar Login
1. Abrir `login.html`
2. Registrar un nuevo usuario
3. Verificar que redirige a `index.html`

### 2. Probar CRUD de Medicamentos
1. Agregar un medicamento
2. Editar el medicamento
3. Eliminar el medicamento
4. Verificar que todos los cambios se guardan en el backend

### 3. Probar Logout
1. Hacer clic en el botón "Cerrar sesión"
2. Verificar que redirige a `login.html`
3. Intentar acceder a `index.html` directamente → debe redirigir a login

## 📝 Métodos de Storage que NO cambiaron

Estos métodos siguen siendo síncronos (usan localStorage):

- `Storage.getPremiumStatus()`
- `Storage.setPremiumStatus(status)`
- `Storage.getSettings()`
- `Storage.saveSettings(settings)`
- `Storage.isWelcomeShown()`
- `Storage.setWelcomeShown()`
- `Storage.getHistorialMedicamentos()`
- `Storage.addHistorialMedicamento(registro)`
- `Storage.getSignosVitales()`
- `Storage.addSignoVital(signo)`
- `Storage.deleteSignoVital(id)`

## 🚀 Próximos Pasos

1. [ ] Actualizar app.js con async/await
2. [ ] Actualizar reports.js con async/await
3. [ ] Configurar BASE_URL en api.js
4. [ ] Probar login/registro
5. [ ] Probar CRUD completo de todas las entidades
6. [ ] Agregar indicadores de carga (spinners)
7. [ ] Mejorar manejo de errores (toasts/notificaciones)
8. [ ] Configurar CORS en el backend si es necesario

## 🐛 Problemas Comunes

### "TypeError: Cannot read property 'then' of undefined"
- **Causa**: Olvidaste poner `await` antes de una llamada a Storage
- **Solución**: Agrega `await` y asegúrate de que la función contenedora sea `async`

### "NetworkError"/"Failed to fetch"
- **Causa**: BASE_URL incorrecta o backend no está corriendo
- **Solución**: Verifica que el backend esté corriendo y la URL sea correcta

### "401 Unauthorized"
- **Causa**: Token JWT expiró o no existe
- **Solución**: Cierra sesión y vuelve a iniciar sesión

### Datos no se actualizan en tiempo real
- **Causa**: No estás recargando la lista después de crear/actualizar/eliminar
- **Solución**: Llama a `await loadXxx()` después de cada operación

## 💡 Tips

- Usa las DevTools del navegador (F12) → Console para ver errores
- Usa la pestaña Network para ver las peticiones HTTP
- Verifica que el token JWT se esté enviando en el header `Authorization`
- Si algo no funciona, revisa el backend (logs de Railway)
