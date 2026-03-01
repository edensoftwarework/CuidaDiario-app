/**
 * app.js - Lógica principal de CuidaDiario
 * by EDEN SoftWork
 * 
 * Este archivo maneja toda la lógica de la interfaz y coordinación entre módulos
 */

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // Recargar estado premium desde el backend (captura cancelaciones via webhook)
    await API.refreshUser();

    // Verificar en background si la suscripción MP fue cancelada
    // (garantiza que el estado sea correcto en cada apertura de la app)
    _syncMPCancellation();

    // Inicializar estado de la app
    updatePremiumStatus();
    setupNavigation();
    setupEventListeners();

    // Cargar selector de pacientes (solo premium)
    await loadPacienteSelector();
    
    // Cargar datos iniciales
    await loadDashboard();
    loadAllSections();
    
    // Mostrar banner de bienvenida si es la primera vez
    showWelcomeBannerIfNeeded();
    
    // Configurar fecha de hoy en inputs
    setDefaultDates();
    
    // Inicializar banner de cookies
    initCookieBanner();

    // Inicializar calendario
    initCalendar();

    // Registrar Service Worker y configurar Push Notifications (PWA)
    initPWA();

    // Re-sincronizar suscripción push con backend en cada login
    // Garantiza que si la suscripción nunca se guardó (fallo de red, token expirado, etc.) quede registrada
    resyncPushSubscription();

    // Mostrar banner de notificaciones push si el usuario nunca lo activó
    // (solo si está autenticado y el navegador soporta push)
    if (API.isAuthenticated() && 'serviceWorker' in navigator && 'PushManager' in window) {
        const pushBannerShown = localStorage.getItem('cuidadiario_push_banner_shown');
        if (!pushBannerShown && Notification.permission === 'default') {
            // Esperar a que initPWA intente el request automático (2s), luego mostrar banner si no se activó
            setTimeout(async () => {
                if (Notification.permission === 'default') {
                    showPushBanner();
                }
            }, 5000);
        }
    }

    // Aplicar traducciones según idioma guardado
    if (window.I18n) I18n.apply();

    // Procesar token de invitación de co-cuidador (?share=TOKEN)
    processShareInviteToken();

    // Mostrar onboarding solo la primera vez
    setTimeout(showOnboarding, 800);

    // Detectar retorno desde MercadoPago (vía flag o query param)
    checkMercadoPagoReturn();
}

// Detecta si el usuario acaba de volver de pagar en MercadoPago y activa premium si corresponde
async function checkMercadoPagoReturn() {
    const urlParams   = new URLSearchParams(window.location.search);
    const mpPending   = localStorage.getItem('cuidadiario_mp_pending');
    const mpActivated = urlParams.get('mp_activated') === '1'; // redirigido desde premium-success.html

    if (!mpPending && !mpActivated) return; // No venía de pagar

    localStorage.removeItem('cuidadiario_mp_pending');
    // Limpiar query params de la URL sin recargar
    window.history.replaceState({}, '', window.location.pathname);

    if (!API.isAuthenticated()) return;

    showToast('⏳ Verificando tu suscripción con MercadoPago...', 'info', 4000);

    // Reintentar hasta 10 veces (25 segundos) para dar tiempo al webhook
    let attempts = 0;
    async function tryVerify() {
        attempts++;
        try {
            const token = API.getToken();
            const res   = await fetch(`${API.BASE_URL}/api/verify-subscription`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.premium) {
                showToast('&#127881; ¡Premium activado! Bienvenido.', 'success', 6000);
                await API.refreshUser();
                updatePremiumStatus();
                await loadPacienteSelector();
                await loadDashboard();
                showPremiumWelcomeModal();
                return;
            }
        } catch (e) { /* continuar reintentando */ }
        if (attempts < 10) setTimeout(tryVerify, 2500);
    }
    setTimeout(tryVerify, 1500); // pequeño delay inicial
}

// Verifica en background si el usuario premium canceló su suscripción en MP.
// IMPORTANTE: Solo corre si el usuario YA ES PREMIUM en localStorage.
// Nunca activa premium — la activación la maneja checkMercadoPagoReturn.
// Esto evita el bug donde un co-cuidador (no premium) se volvía premium
// por una anomalía de la API de MP que devolvía suscripciones ajenas.
async function _syncMPCancellation() {
    if (!API.isAuthenticated()) return;
    const user = API.getUser();
    // ← GUARD CRÍTICO: solo verificar si el usuario ya tiene premium en localStorage
    if (!user || !user.premium) {
        setTimeout(_syncMPCancellation, 30 * 60 * 1000);
        return;
    }
    try {
        const token = API.getToken();
        const res = await fetch(`${API.BASE_URL}/api/verify-subscription`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            setTimeout(_syncMPCancellation, 30 * 60 * 1000);
            return;
        }
        const data = await res.json();
        // Solo actuar si el backend confirma que la suscripción fue cancelada/pausada/expirada
        if (data.premium === false &&
            ['cancelled', 'paused', 'expired'].includes(data.status)) {
            user.premium = false;
            API.setUser(user);
            localStorage.removeItem('cuidadiario_premium_welcomed');
            updatePremiumStatus();
            await loadDashboard();
            showToast('🔔 Tu suscripción Premium fue cancelada o expiró.', 'info', 7000);
        }
    } catch { /* sin conexión: ignorar */ }
    // Repetir cada 30 minutos mientras la página esté abierta
    setTimeout(_syncMPCancellation, 30 * 60 * 1000);
}

// ========== NAVEGADOR DE SECCIONES (flechas) ==========
const SECTIONS_ORDER  = ['dashboard','medicamentos','citas','sintomas','tareas','contactos','reportes'];
const SECTIONS_LABELS = {
    dashboard:   'Inicio',
    medicamentos:'Medicamentos',
    citas:       'Citas',
    sintomas:    'Síntomas',
    tareas:      'Tareas',
    contactos:   'Contactos',
    reportes:    'Reportes'
};

function updateSectionNav(sectionId) {
    const label   = document.getElementById('sectionNavLabel');
    const prevBtn = document.getElementById('prevSectionBtn');
    const nextBtn = document.getElementById('nextSectionBtn');
    if (!label || !prevBtn || !nextBtn) return;
    const idx = SECTIONS_ORDER.indexOf(sectionId);
    label.textContent  = SECTIONS_LABELS[sectionId] || sectionId;
    prevBtn.disabled   = idx <= 0;
    nextBtn.disabled   = idx >= SECTIONS_ORDER.length - 1;
}

function navigatePrevSection() {
    const active = document.querySelector('.section.active');
    if (!active) return;
    const idx = SECTIONS_ORDER.indexOf(active.id);
    if (idx > 0) navigateToSection(SECTIONS_ORDER[idx - 1]);
}

function navigateNextSection() {
    const active = document.querySelector('.section.active');
    if (!active) return;
    const idx = SECTIONS_ORDER.indexOf(active.id);
    if (idx < SECTIONS_ORDER.length - 1) navigateToSection(SECTIONS_ORDER[idx + 1]);
}

// ========== NAVEGACIÓN ==========
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('data-section')) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');
                navigateToSection(sectionId);
                
                // Cerrar menú móvil
                if (window.innerWidth <= 968) {
                    navMenu.classList.remove('active');
                }
            }
        });
    });
    
    // Toggle menú móvil
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
}

async function navigateToSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Actualizar navegación activa
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Actualizar contenido según la sección
    switch(sectionId) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'medicamentos':
            await loadMedicamentos();
            break;
        case 'citas':
            await loadCitas();
            break;
        case 'sintomas':
            await loadSintomas();
            break;
        case 'tareas':
            await loadTareas();
            break;
        case 'contactos':
            await loadContactos();
            break;
        case 'reportes':
            loadReportes();
            break;
    }
    updateSectionNav(sectionId);
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    await updateDashboardStats();
    await updateAlertsContainer();
    await updateUpcomingActivities();
}

async function updateDashboardStats() {
    const stats = await Storage.getStats();
    const _now = new Date();
    const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
    
    document.getElementById('dashMedCount').textContent = stats.medicamentos;
    
    // Citas próximas (esta semana) — comparar strings para evitar desfase UTC
    const citas = await Storage.getCitas();
    const weekFromNow = new Date(_now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = `${weekFromNow.getFullYear()}-${String(weekFromNow.getMonth()+1).padStart(2,'0')}-${String(weekFromNow.getDate()).padStart(2,'0')}`;
    const citasProximas = citas.filter(c => {
        const citaDateStr = (c.fecha || '').substring(0, 10);
        return citaDateStr >= today && citaDateStr <= weekFromNowStr;
    });
    document.getElementById('dashCitasCount').textContent = citasProximas.length;
    
    // Tareas de hoy pendientes
    const tareas = await Storage.getTareas();
    const tareasPendientes = tareas.filter(t => 
        !t.completada && (t.fecha || '').substring(0, 10) === today
    );
    document.getElementById('dashTareasCount').textContent = tareasPendientes.length;
    
    // Registros este mes
    const thisMonth = new Date().toISOString().substring(0, 7);
    const sintomas = await Storage.getSintomas();
    const historialData = await Storage.getHistorialMedicamentos();
    const registrosMes = historialData.filter(h => 
        (h.fecha || '').startsWith(thisMonth)
    ).length + sintomas.filter(s => 
        (s.fecha || '').startsWith(thisMonth)
    ).length;
    document.getElementById('dashRegistrosCount').textContent = registrosMes;
}

async function updateAlertsContainer() {
    const container = document.getElementById('alertsContainer');
    
    // Verificar que Notifications esté disponible
    if (typeof window.Notifications === 'undefined' || !window.Notifications) {
        container.innerHTML = '';
        return;
    }
    
    const alerts = await window.Notifications.getUrgentAlerts();
    
    if (alerts.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.type}">
            <div class="alert-icon">${alert.icon}</div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.message}</p>
            </div>
        </div>
    `).join('');
}

async function updateUpcomingActivities() {
    const list = document.getElementById('upcomingList');
    try {
        const activities = [];
        const now = new Date();
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        
        const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
        const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth()+1).padStart(2,'0')}-${String(tomorrowDate.getDate()).padStart(2,'0')}`;

        function formatActivityDate(fechaPart) {
            if (fechaPart === todayStr) return 'Hoy';
            if (fechaPart === tomorrowStr) return 'Mañana';
            const d = new Date(`${fechaPart}T00:00`);
            return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        }

        // Mapa de pacientes para mostrar a quién corresponde cada actividad
        const pMapUpcoming = !Storage.currentPacienteId ? await getPacienteNombreMap() : null;

        // Agregar citas próximas (próximos 7 días)
        const citas = await Storage.getCitas();
        citas.forEach(cita => {
            const fechaPart = String(cita.fecha || '').substring(0, 10);
            if (!fechaPart) return;
            // Si no tiene hora, usar 23:59 para que muestre todo el día
            const horaPart = cita.hora ? String(cita.hora).substring(0, 5) : '23:59';
            const citaDate = new Date(`${fechaPart}T${horaPart}`);
            if (isNaN(citaDate)) return;
            if (citaDate > now && citaDate <= weekFromNow) {
                activities.push({
                    time: cita.hora ? String(cita.hora).substring(0, 5) : 'Sin hora',
                    dateDisplay: formatActivityDate(fechaPart),
                    title: cita.titulo,
                    subtitle: `Cita - ${cita.lugar || 'Sin ubicación'}`,
                    type: 'cita',
                    date: citaDate,
                    pacienteId: String(cita.paciente_id || '')
                });
            }
        });
        
        // Agregar tareas próximas (próximos 7 días)
        const _t = now;
        const todayLocal = `${_t.getFullYear()}-${String(_t.getMonth()+1).padStart(2,'0')}-${String(_t.getDate()).padStart(2,'0')}`;
        const tareasAll = await Storage.getTareas();
        tareasAll.filter(t => {
            const tf = String(t.fecha || '').substring(0, 10);
            return !t.completada && tf >= todayLocal && new Date(`${tf}T00:00`) <= weekFromNow;
        }).forEach(tarea => {
            const tf = String(tarea.fecha || '').substring(0, 10);
            const th = tarea.hora ? String(tarea.hora).substring(0, 5) : '00:00';
            activities.push({
                time: tarea.hora ? th : 'Sin hora',
                dateDisplay: formatActivityDate(tf),
                title: tarea.titulo,
                subtitle: `Tarea - ${tarea.categoria || 'General'}`,
                type: 'tarea',
                date: new Date(`${tf}T${th}`),
                pacienteId: String(tarea.paciente_id || '')
            });
        });
        
        // Ordenar por fecha y hora
        activities.sort((a, b) => a.date - b.date);
        
        if (activities.length === 0) {
            list.innerHTML = '<p class="empty-state">No hay actividades próximas programadas</p>';
            return;
        }
        
        list.innerHTML = activities.map(act => {
            const pacienteNombre = pMapUpcoming ? (pMapUpcoming[act.pacienteId] || 'Sin paciente') : null;
            return `
            <div class="upcoming-item">
                <div class="upcoming-time">
                    <div class="upcoming-date-label">${act.dateDisplay}</div>
                    <div>${act.time}</div>
                </div>
                <div class="upcoming-content">
                    ${pacienteNombre ? `<span class="upcoming-patient-badge">👤 ${pacienteNombre}</span>` : ''}
                    <h4>${act.title}</h4>
                    <p>${act.subtitle}</p>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('Error cargando actividades próximas:', err);
        list.innerHTML = '<p class="empty-state">No hay actividades próximas programadas</p>';
    }
}

// ========== HELPER: CO-CUIDADOR ==========
// Devuelve true si el paciente actualmente seleccionado fue compartido por otro usuario.
// En ese caso se omiten los límites free para lectura.
async function isViewingSharedPatient() {
    try {
        const id = Storage.currentPacienteId;
        if (!id) return false;
        const pacientes = await Storage.getPacientes();
        const p = pacientes.find(p => String(p.id) === String(id));
        return !!(p && p.es_compartido);
    } catch (e) {
        return false;
    }
}

// Muestra un toast de solo lectura y retorna true si el paciente es compartido.
// Usar como guard al inicio de cualquier función de escritura.
async function blockIfSharedPatient() {
    if (await isViewingSharedPatient()) {
        showToast('\uD83D\uDC41\uFE0F Solo tenés permisos de lectura sobre este paciente.', 'info');
        return true;
    }
    return false;
}

// ========== HELPERS: AGRUPAR POR PACIENTE ==========
// Devuelve un mapa { pacienteId -> nombre } con todos los pacientes del usuario.
async function getPacienteNombreMap() {
    const pacientes = await Storage.getPacientes();
    const map = {};
    pacientes.forEach(p => { map[String(p.id)] = p.nombre; });
    return map;
}

// Renderiza items agrupados por paciente cuando pMap es válido (no null).
// renderFn(item) debe devolver el HTML del item.
function renderWithPatientGroups(items, renderFn, pMap) {
    if (!pMap) return items.map(renderFn).join('');
    const sorted = [...items].sort((a, b) => (a.paciente_id || 0) - (b.paciente_id || 0));
    let lastPid = null;
    return sorted.map(item => {
        const pid = String(item.paciente_id || '');
        let hdr = '';
        if (pid !== lastPid) {
            lastPid = pid;
            hdr = `<div class="patient-group-header"><span class="patient-group-name">\uD83D\uDC64 ${pMap[pid] || 'Sin paciente asignado'}</span></div>`;
        }
        return hdr + renderFn(item);
    }).join('');
}

// ========== MEDICAMENTOS ==========
let editingMedicamentoId = null;

async function loadMedicamentos() {
    const medicamentos = await Storage.getMedicamentos();
    const container = document.getElementById('medicamentosList');
    const limits = await Storage.checkLimits();
    if (await isViewingSharedPatient()) limits.premium = true;
    
    // Mostrar warning si alcanzó el límite
    const warning = document.getElementById('medLimitWarning');
    if (limits.medicamentos.exceeded) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }

    // Mostrar banner de datos bloqueados si bajó de premium y tiene más de 3
    const lockedBanner = document.getElementById('medLockedBanner');
    if (lockedBanner) {
        if (!limits.premium && limits.medicamentos.locked > 0) {
            lockedBanner.style.display = 'block';
            lockedBanner.innerHTML = `
                <span class="locked-icon">🔒</span>
                Tienes <strong>${limits.medicamentos.locked}</strong> medicamento${limits.medicamentos.locked > 1 ? 's' : ''} bloqueado${limits.medicamentos.locked > 1 ? 's' : ''}.
                <a href="#" onclick="showPremiumModal(); return false;">Vuelve a Premium</a> para acceder a todos tus datos.
            `;
        } else {
            lockedBanner.style.display = 'none';
        }
    }
    
    if (medicamentos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay medicamentos registrados. Haz clic en "Agregar Medicamento" para comenzar.</p>';
        return;
    }

    // Si es free y tiene más del límite, mostrar solo los primeros 3
    const visibles = (!limits.premium && medicamentos.length > limits.medicamentos.max)
        ? medicamentos.slice(0, limits.medicamentos.max)
        : medicamentos;

    const pMap = !Storage.currentPacienteId ? await getPacienteNombreMap() : null;
    container.innerHTML = renderWithPatientGroups(visibles, med => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${med.nombre}</h3>
                    <p class="item-subtitle">${med.dosis}</p>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-registrar-toma" onclick="registrarTomaMedicamento('${med.id}')" title="Registrar toma">✓ Toma</button>
                    <button class="btn-icon" onclick="editMedicamento('${med.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="deleteMedicamento('${med.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="item-details">
                <div class="item-detail">
                    <span class="detail-icon">⏰</span>
                    <span>${formatFrecuenciaMed(med)}</span>
                </div>
                ${(med.hora_inicio || med.horaInicio) ? `
                <div class="item-detail">
                    <span class="detail-icon">🕐</span>
                    <span>Inicio: ${med.hora_inicio || med.horaInicio}</span>
                </div>
                ` : ''}
                ${med.notas ? `
                <div class="item-detail">
                    <span class="detail-icon">📝</span>
                    <span>${med.notas}</span>
                </div>
                ` : ''}
                <div class="item-detail">
                    <span class="item-badge ${med.recordatorio ? 'badge-active' : 'badge-pending'}">
                        ${med.recordatorio ? '🔔 Recordatorio activado' : '🔕 Sin recordatorio'}
                    </span>
                </div>
            </div>
        </div>`, pMap);
    
    // Cargar historial
    await loadHistorialMedicamentos();
}

async function loadHistorialMedicamentos() {
    let isPremium = Storage.getPremiumStatus();
    if (!isPremium && await isViewingSharedPatient()) isPremium = true;
    const LIMIT_FREE = 5;
    const LIMIT_PREMIUM = 50;

    document.getElementById('medHistorial').style.display = 'block';
    const historialData = await Storage.getHistorialMedicamentos();
    const historial = historialData.slice(0, isPremium ? LIMIT_PREMIUM : LIMIT_FREE);
    const container = document.getElementById('medHistorialList');

    if (historial.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay registros de administración</p>';
        return;
    }

    container.innerHTML = historial.map(h => `
        <div class="historial-item">
            <div class="historial-info">
                <strong>${h.medicamento_nombre || h.medicamentoNombre || '—'}</strong> - ${h.dosis || ''}
                ${h.notas ? `<br><small>${h.notas}</small>` : ''}
            </div>
            <div class="historial-fecha">${formatDate(h.fecha)}</div>
            <button class="btn-icon btn-historial-delete" onclick="deleteHistorialEntry(${h.id})" title="Eliminar registro">🗑️</button>
        </div>
    `).join('');

    // Si es free y hay más registros de los que se muestran, avisar
    if (!isPremium && historialData.length > LIMIT_FREE) {
        container.innerHTML += `
            <div class="locked-data-banner" style="margin-top:10px;" onclick="showPremiumModal()">
                🔒 Hay ${historialData.length - LIMIT_FREE} registros más. <span style="text-decoration:underline;cursor:pointer;">Hazte Premium</span> para ver el historial completo.
            </div>`;
    }
}

function formatFrecuenciaMed(med) {
    const map = {
        'cada-4h': 'Cada 4 horas',
        'cada-6h': 'Cada 6 horas',
        'cada-8h': 'Cada 8 horas',
        'cada-12h': 'Cada 12 horas',
        'diaria': 'Diaria',
        'custom': 'Horarios personalizados'
    };
    return map[med.frecuencia] || med.frecuencia;
}

async function openMedicamentoModal() {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    const limits = await Storage.checkLimits();
    if (!limits.premium && limits.medicamentos.exceeded) {
        showPremiumModal();
        return;
    }
    
    editingMedicamentoId = null;
    document.getElementById('medicamentoModalTitle').textContent = 'Agregar Medicamento';
    document.getElementById('medicamentoForm').reset();
    document.getElementById('medId').value = '';
    document.getElementById('customHorariosGroup').style.display = 'none';
    document.getElementById('medicamentoModal').classList.add('active');
}

function closeMedicamentoModal() {
    document.getElementById('medicamentoModal').classList.remove('active');
    editingMedicamentoId = null;
}

async function editMedicamento(id) {
    const medicamentos = await Storage.getMedicamentos();
    const medicamento = medicamentos.find(m => String(m.id) === String(id));
    if (!medicamento) return;
    
    editingMedicamentoId = id;
    document.getElementById('medicamentoModalTitle').textContent = 'Editar Medicamento';
    document.getElementById('medId').value = id;
    document.getElementById('medNombre').value = medicamento.nombre;
    document.getElementById('medDosis').value = medicamento.dosis;
    document.getElementById('medFrecuencia').value = medicamento.frecuencia;
    document.getElementById('medHoraInicio').value = medicamento.hora_inicio || medicamento.horaInicio || '';
    document.getElementById('medNotas').value = medicamento.notas || '';
    document.getElementById('medRecordatorio').checked = medicamento.recordatorio || false;
    
    if (medicamento.frecuencia === 'custom') {
        document.getElementById('customHorariosGroup').style.display = 'block';
        document.getElementById('medHorariosCustom').value = medicamento.horarios_custom || medicamento.horariosCustom || '';
    }
    
    document.getElementById('medicamentoModal').classList.add('active');
}

async function deleteMedicamento(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este medicamento?')) {
        await Storage.deleteMedicamento(id);
        showToast('🗑️ Medicamento eliminado', 'success');
        await loadMedicamentos();
        await loadDashboard();
    }
}

async function saveMedicamento(event) {
    event.preventDefault();
    
    const medicamento = {
        nombre: document.getElementById('medNombre').value,
        dosis: document.getElementById('medDosis').value,
        frecuencia: document.getElementById('medFrecuencia').value,
        horaInicio: document.getElementById('medHoraInicio').value,
        notas: document.getElementById('medNotas').value,
        recordatorio: document.getElementById('medRecordatorio').checked
    };
    
    if (medicamento.frecuencia === 'custom') {
        medicamento.horariosCustom = document.getElementById('medHorariosCustom').value;
    }
    
    const id = document.getElementById('medId').value;
    
    if (id) {
        await Storage.updateMedicamento(id, medicamento);
    } else {
        await Storage.addMedicamento(medicamento);
    }
    
    closeMedicamentoModal();
    showToast(id ? '✓ Medicamento actualizado' : '✓ Medicamento guardado', 'success');
    await loadMedicamentos();
    await loadDashboard();
}

async function registrarTomaMedicamento(id) {
    const medicamentos = await Storage.getMedicamentos();
    const medicamento = medicamentos.find(m => String(m.id) === String(id));
    if (!medicamento) return;
    
    // Confirmar antes de registrar
    if (!confirm(`✅ ¿Registrar toma de "${medicamento.nombre}"?\n${medicamento.dosis}`)) return;
    
    await Storage.addHistorialMedicamento({
        medicamentoId: id,
        medicamentoNombre: medicamento.nombre,
        dosis: medicamento.dosis,
        notas: ''
    });
    
    showToast(`✓ Toma registrada: ${medicamento.nombre} — ${medicamento.dosis}`, 'success');
    await loadMedicamentos();
    await loadDashboard();
}

async function deleteHistorialEntry(id) {
    if (!confirm('¿Eliminar este registro del historial?')) return;
    try {
        await Storage.deleteHistorialMedicamento(id);
        showToast('Registro eliminado', 'success');
        await loadHistorialMedicamentos();
    } catch (err) {
        showToast('No se pudo eliminar el registro', 'error');
    }
}

// Event listener para cambio de frecuencia
document.addEventListener('DOMContentLoaded', () => {
    const frecSelect = document.getElementById('medFrecuencia');
    if (frecSelect) {
        frecSelect.addEventListener('change', (e) => {
            const customGroup = document.getElementById('customHorariosGroup');
            if (e.target.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });
    }
});

// ========== CITAS ==========
let currentMonth = new Date();
let editingCitaId = null;

async function loadCitas() {
    const limits = await Storage.checkLimits();
    if (await isViewingSharedPatient()) limits.premium = true;
    const warning = document.getElementById('citasLimitWarning');
    if (warning) {
        warning.style.display = (!limits.premium && limits.citas.exceeded) ? 'block' : 'none';
    }

    // Banner de datos bloqueados
    const lockedBanner = document.getElementById('citasLockedBanner');
    if (lockedBanner) {
        if (!limits.premium && limits.citas.locked > 0) {
            lockedBanner.style.display = 'block';
            lockedBanner.innerHTML = `
                <span class="locked-icon">🔒</span>
                Tienes <strong>${limits.citas.locked}</strong> cita${limits.citas.locked > 1 ? 's' : ''} bloqueada${limits.citas.locked > 1 ? 's' : ''}.
                <a href="#" onclick="showPremiumModal(); return false;">Vuelve a Premium</a> para acceder a todas.
            `;
        } else {
            lockedBanner.style.display = 'none';
        }
    }
    await renderCalendar();
    await renderCitasList();
}

function initCalendar() {
    const today = new Date();
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
}

async function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthTitle = document.getElementById('calendarMonth');
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    monthTitle.textContent = currentMonth.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    
    // Días de la semana
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    let html = daysOfWeek.map(day => `<div class="calendar-day-header">${day}</div>`).join('');
    
    // Primer día del mes y días totales
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Obtener citas del mes
    const citas = await Storage.getCitas();
    const citasByDate = {};
    citas.forEach(cita => {
        citasByDate[cita.fecha] = (citasByDate[cita.fecha] || 0) + 1;
    });
    
    const today = new Date().toISOString().split('T')[0];
    
    // Días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasEvent = citasByDate[dateStr] > 0;
        const isToday = dateStr === today;
        
        html += `<div class="calendar-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}" onclick="selectCalendarDate('${dateStr}')">${day}</div>`;
    }
    
    // Días del mes siguiente
    const remainingDays = 42 - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    calendarGrid.innerHTML = html;
}

async function previousMonth() {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    await renderCalendar();
}

async function nextMonth() {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    await renderCalendar();
}

function selectCalendarDate(dateStr) {
    openCitaModal();
    document.getElementById('citaFecha').value = dateStr;
}

async function renderCitasList(filter = 'todas') {
    const allCitas = await Storage.getCitas();
    const limits = await Storage.checkLimits();
    if (await isViewingSharedPatient()) limits.premium = true;
    // Si es free y tiene más del límite, mostrar solo las primeras
    const citas = (!limits.premium && allCitas.length > limits.citas.max)
        ? allCitas.slice(0, limits.citas.max)
        : allCitas;
    const container = document.getElementById('citasList');
    const now = new Date();
    
    let filtered = citas;
    
    if (filter === 'proximas') {
        filtered = citas.filter(c => new Date(c.fecha) >= now);
    } else if (filter === 'pasadas') {
        filtered = citas.filter(c => new Date(c.fecha) < now);
    }
    
    // Ordenar por fecha
    filtered.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay citas programadas</p>';
        return;
    }

    const pMap = !Storage.currentPacienteId ? await getPacienteNombreMap() : null;
    container.innerHTML = renderWithPatientGroups(filtered, cita => {
        const citaDate = new Date(cita.fecha);
        const isPast = citaDate < now;
        const gcalBtn = limits.premium
            ? `<button class="btn-icon btn-gcal" onclick="addCitaToGoogleCalendar('${encodeURIComponent(cita.titulo)}','${cita.fecha}','${cita.hora || ''}','${encodeURIComponent(cita.lugar || '')}','${encodeURIComponent(cita.notas || '')}')" title="Agregar a Google Calendar">📅 Google Cal</button>`
            : '';
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <h3 class="item-title">${cita.titulo}</h3>
                        <p class="item-subtitle">${formatDate(cita.fecha)} - ${cita.hora}</p>
                    </div>
                    <div class="item-actions">
                        ${gcalBtn}
                        <button class="btn-icon" onclick="editCita('${cita.id}')" title="Editar">✏️</button>
                        <button class="btn-icon" onclick="deleteCita('${cita.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <div class="item-details">
                    <div class="item-detail">
                        <span class="item-badge badge-${isPast ? 'completed' : 'active'}">${formatTipoCita(cita.tipo)}</span>
                    </div>
                    ${cita.lugar ? `
                    <div class="item-detail">
                        <span class="detail-icon">📍</span>
                        <span>${cita.lugar}</span>
                    </div>
                    ` : ''}
                    ${cita.profesional ? `
                    <div class="item-detail">
                        <span class="detail-icon">👨‍⚕️</span>
                        <span>${cita.profesional}</span>
                    </div>
                    ` : ''}
                    ${cita.notas ? `
                    <div class="item-detail">
                        <span class="detail-icon">📝</span>
                        <span>${cita.notas}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }, pMap);
}

async function filterCitas(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = (typeof event !== 'undefined' && event?.target) ? event.target : null;
    if (activeBtn) activeBtn.classList.add('active');
    await renderCitasList(filter);
}

function formatTipoCita(tipo) {
    const map = {
        'consulta': 'Consulta',
        'estudio': 'Estudio',
        'terapia': 'Terapia',
        'control': 'Control',
        'otro': 'Otro'
    };
    return map[tipo] || tipo;
}

async function openCitaModal() {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    editingCitaId = null;
    document.getElementById('citaModalTitle').textContent = 'Agregar Cita';
    document.getElementById('citaForm').reset();
    document.getElementById('citaId').value = '';
    document.getElementById('citaModal').classList.add('active');
}

function closeCitaModal() {
    document.getElementById('citaModal').classList.remove('active');
    editingCitaId = null;
}

async function editCita(id) {
    const citas = await Storage.getCitas();
    const cita = citas.find(c => String(c.id) === String(id));
    if (!cita) return;
    
    editingCitaId = id;
    document.getElementById('citaModalTitle').textContent = 'Editar Cita';
    document.getElementById('citaId').value = id;
    document.getElementById('citaTipo').value = cita.tipo;
    document.getElementById('citaTitulo').value = cita.titulo;
    document.getElementById('citaFecha').value = cita.fecha;
    document.getElementById('citaHora').value = cita.hora;
    document.getElementById('citaLugar').value = cita.lugar || '';
    document.getElementById('citaProfesional').value = cita.profesional || '';
    document.getElementById('citaNotas').value = cita.notas || '';
    document.getElementById('citaRecordatorio').value = cita.recordatorio || '0';
    
    document.getElementById('citaModal').classList.add('active');
}

async function deleteCita(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta cita?')) {
        await Storage.deleteCita(id);
        showToast('🗑️ Cita eliminada', 'success');
        await loadCitas();
        await loadDashboard();
    }
}

async function saveCita(event) {
    event.preventDefault();
    
    const cita = {
        tipo: document.getElementById('citaTipo').value,
        titulo: document.getElementById('citaTitulo').value,
        fecha: document.getElementById('citaFecha').value,
        hora: document.getElementById('citaHora').value,
        lugar: document.getElementById('citaLugar').value,
        profesional: document.getElementById('citaProfesional').value,
        notas: document.getElementById('citaNotas').value,
        recordatorio: document.getElementById('citaRecordatorio').value
    };
    
    const id = document.getElementById('citaId').value;
    
    if (id) {
        await Storage.updateCita(id, cita);
    } else {
        const limits = await Storage.checkLimits();
        if (!limits.premium && limits.citas.exceeded) {
            closeCitaModal();
            showPremiumModal();
            return;
        }
        await Storage.addCita(cita);
    }
    
    closeCitaModal();
    showToast(id ? '✓ Cita actualizada' : '✓ Cita guardada', 'success');
    await loadCitas();
    await loadDashboard();
}

// ========== SÍNTOMAS Y SIGNOS VITALES ==========
async function loadSintomas() {
    let isPremium = Storage.getPremiumStatus();
    if (!isPremium && await isViewingSharedPatient()) isPremium = true;
    const premiumBlock = document.getElementById('sintomasPremiumBlock');
    const content = document.getElementById('sintomasContent');
    const addBtn = document.querySelector('#sintomas .section-header .btn-primary');

    if (!isPremium) {
        if (premiumBlock) premiumBlock.style.display = 'flex';
        if (content) content.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';
        return;
    }

    if (premiumBlock) premiumBlock.style.display = 'none';
    if (content) content.style.display = 'block';
    if (addBtn) addBtn.style.display = '';

    await renderSintomasList();
    await updateSignosVitales();
}

async function renderSintomasList() {
    const sintomas = await Storage.getSintomas();
    const sintomasRecientes = sintomas.slice(-30).reverse();
    const container = document.getElementById('sintomasList');
    
    if (sintomas.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay síntomas registrados</p>';
        return;
    }
    
    container.innerHTML = sintomasRecientes.map(s => {
        const intensidadClass = s.intensidad > 7 ? 'badge-urgent' : s.intensidad > 4 ? 'badge-pending' : 'badge-active';
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <h3 class="item-title">${s.tipo || 'Síntoma sin especificar'}</h3>
                        <p class="item-subtitle">${formatDateTime(s.fecha)}</p>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon" onclick="deleteSintoma('${s.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <div class="item-details">
                    <div class="item-detail">
                        <span class="item-badge ${intensidadClass}">Intensidad: ${s.intensidad}/10</span>
                    </div>
                    ${s.estadoAnimo ? `
                    <div class="item-detail">
                        <span class="detail-icon">${getEstadoAnimoEmoji(s.estadoAnimo)}</span>
                        <span>${formatEstadoAnimo(s.estadoAnimo)}</span>
                    </div>
                    ` : ''}
                    ${s.descripcion ? `
                    <div class="item-detail">
                        <span class="detail-icon">📝</span>
                        <span>${s.descripcion}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function updateSignosVitales() {
    const signos = await Storage.getSignosVitales();
    
    // Actualizar últimos valores
    const tipos = ['presion', 'glucosa', 'temperatura', 'peso'];
    tipos.forEach(tipo => {
        const signosTipo = signos.filter(s => s.tipo === tipo).sort((a, b) => 
            new Date(b.fecha) - new Date(a.fecha)
        );
        
        if (signosTipo.length > 0) {
            const ultimo = signosTipo[0];
            const valueElement = document.getElementById(`${tipo}Value`);
            if (valueElement) {
                valueElement.textContent = formatSignoValue(ultimo);
            }
        }
    });
    
    // Renderizar historial
    renderSignosHistorial(signos);
}

function renderSignosHistorial(signos) {
    const container = document.getElementById('signosHistorialList');
    const ordenados = signos.slice(-20).reverse();
    
    if (ordenados.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay signos vitales registrados</p>';
        return;
    }
    
    container.innerHTML = ordenados.map(s => `
        <div class="historial-item">
            <div class="historial-info">
                <strong>${formatSignoTipo(s.tipo)}</strong>: ${formatSignoValue(s)}
                ${s.notas ? `<br><small>${s.notas}</small>` : ''}
            </div>
            <div class="historial-fecha">${formatDateTime(s.fecha)}</div>
        </div>
    `).join('');
}

function formatSignoTipo(tipo) {
    const map = {
        'presion': 'Presión Arterial',
        'glucosa': 'Glucosa',
        'temperatura': 'Temperatura',
        'peso': 'Peso'
    };
    return map[tipo] || tipo;
}

function formatSignoValue(signo) {
    switch (signo.tipo) {
        case 'presion':
            return `${signo.sistolica}/${signo.diastolica} mmHg`;
        case 'glucosa':
            return `${signo.valor} mg/dL`;
        case 'temperatura':
            return `${signo.valor} °C`;
        case 'peso':
            return `${signo.valor} kg`;
        default:
            return signo.valor || '--';
    }
}

function getEstadoAnimoEmoji(estado) {
    const map = {
        'excelente': '😊',
        'bien': '🙂',
        'regular': '😐',
        'mal': '😟',
        'muy-mal': '😢'
    };
    return map[estado] || '😐';
}

function formatEstadoAnimo(estado) {
    const map = {
        'excelente': 'Excelente',
        'bien': 'Bien',
        'regular': 'Regular',
        'mal': 'Mal',
        'muy-mal': 'Muy mal'
    };
    return map[estado] || estado;
}

function switchSintomaTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = (typeof event !== 'undefined' && event?.target) ? event.target : null;
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    if (tab === 'registros') {
        document.getElementById('sintomas-registros').classList.add('active');
    } else if (tab === 'signos') {
        document.getElementById('sintomas-signos').classList.add('active');
    }
}

async function openSintomaModal() {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    document.getElementById('sintomaForm').reset();
    document.getElementById('sintomaFecha').value = getCurrentDateTime();
    document.getElementById('sintomaModal').classList.add('active');
    
    // Actualizar valor del slider
    document.getElementById('sintomaIntensidad').addEventListener('input', (e) => {
        document.getElementById('intensidadValue').textContent = e.target.value;
    });
}

function closeSintomaModal() {
    document.getElementById('sintomaModal').classList.remove('active');
}

async function saveSintoma(event) {
    event.preventDefault();
    
    const sintoma = {
        fecha: document.getElementById('sintomaFecha').value,
        tipo: document.getElementById('sintomaTipo').value,
        intensidad: parseInt(document.getElementById('sintomaIntensidad').value),
        estadoAnimo: document.getElementById('sintomaEstadoAnimo').value,
        descripcion: document.getElementById('sintomaDescripcion').value
    };
    
    await Storage.addSintoma(sintoma);
    closeSintomaModal();
    await loadSintomas();
}

async function deleteSintoma(id) {
    if (confirm('¿Eliminar este síntoma?')) {
        await Storage.deleteSintoma(id);
        await loadSintomas();
    }
}

// Signo vital modal
let currentSignoTipo = null;

async function registrarSigno(tipo) {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    currentSignoTipo = tipo;
    document.getElementById('signoTipo').value = tipo;
    document.getElementById('signoModalTitle').textContent = `Registrar ${formatSignoTipo(tipo)}`;
    document.getElementById('signoFecha').value = getCurrentDateTime();
    
    // Generar inputs según el tipo
    const inputsContainer = document.getElementById('signoInputs');
    
    switch (tipo) {
        case 'presion':
            inputsContainer.innerHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label for="signoSistolica">Sistólica (mmHg) *</label>
                        <input type="number" id="signoSistolica" required min="50" max="250">
                    </div>
                    <div class="form-group">
                        <label for="signoDiastolica">Diastólica (mmHg) *</label>
                        <input type="number" id="signoDiastolica" required min="30" max="150">
                    </div>
                </div>
            `;
            break;
        case 'glucosa':
            inputsContainer.innerHTML = `
                <div class="form-group">
                    <label for="signoValor">Glucosa (mg/dL) *</label>
                    <input type="number" id="signoValor" required min="20" max="600">
                </div>
            `;
            break;
        case 'temperatura':
            inputsContainer.innerHTML = `
                <div class="form-group">
                    <label for="signoValor">Temperatura (°C) *</label>
                    <input type="number" step="0.1" id="signoValor" required min="30" max="45">
                </div>
            `;
            break;
        case 'peso':
            inputsContainer.innerHTML = `
                <div class="form-group">
                    <label for="signoValor">Peso (kg) *</label>
                    <input type="number" step="0.1" id="signoValor" required min="10" max="300">
                </div>
            `;
            break;
    }
    
    document.getElementById('signoModal').classList.add('active');
}

function closeSignoModal() {
    document.getElementById('signoModal').classList.remove('active');
    currentSignoTipo = null;
}

async function saveSigno(event) {
    event.preventDefault();
    
    const tipo = document.getElementById('signoTipo').value;
    const signo = {
        tipo: tipo,
        fecha: document.getElementById('signoFecha').value,
        notas: document.getElementById('signoNotas').value
    };
    
    if (tipo === 'presion') {
        signo.sistolica = parseInt(document.getElementById('signoSistolica').value);
        signo.diastolica = parseInt(document.getElementById('signoDiastolica').value);
    } else {
        signo.valor = parseFloat(document.getElementById('signoValor').value);
    }
    
    await Storage.addSignoVital(signo);
    closeSignoModal();
    await loadSintomas();
}

// ========== TAREAS ==========
let editingTareaId = null;

async function loadTareas(filter = 'todas') {
    const tareas = await Storage.getTareas();
    const container = document.getElementById('tareasList');
    const limits = await Storage.checkLimits();
    if (await isViewingSharedPatient()) limits.premium = true;
    
    // Mostrar warning si alcanzó el límite
    const warning = document.getElementById('tareasLimitWarning');
    if (limits.tareas.exceeded) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }

    // Banner de datos bloqueados
    const lockedBanner = document.getElementById('tareasLockedBanner');
    if (lockedBanner) {
        if (!limits.premium && limits.tareas.locked > 0) {
            lockedBanner.style.display = 'block';
            lockedBanner.innerHTML = `
                <span class="locked-icon">🔒</span>
                Tienes <strong>${limits.tareas.locked}</strong> tarea${limits.tareas.locked > 1 ? 's' : ''} bloqueada${limits.tareas.locked > 1 ? 's' : ''}.
                <a href="#" onclick="showPremiumModal(); return false;">Vuelve a Premium</a> para acceder a todas.
            `;
        } else {
            lockedBanner.style.display = 'none';
        }
    }
    
    // Si es free y tiene más del límite, trabajar solo con las primeras
    const tareasBase = (!limits.premium && tareas.length > limits.tareas.max)
        ? tareas.slice(0, limits.tareas.max)
        : tareas;

    let filtered = tareasBase;
    const today = new Date().toISOString().split('T')[0];
    
    if (filter === 'hoy') {
        filtered = tareasBase.filter(t => t.fecha === today);
    } else if (filter === 'pendientes') {
        filtered = tareasBase.filter(t => !t.completada);
    } else if (filter === 'completadas') {
        filtered = tareasBase.filter(t => t.completada);
    }
    
    // Ordenar por fecha y hora
    filtered.sort((a, b) => {
        const dateA = new Date(`${a.fecha}T${a.hora || '00:00'}`);
        const dateB = new Date(`${b.fecha}T${b.hora || '00:00'}`);
        return dateA - dateB;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay tareas registradas</p>';
        return;
    }
    
    const pMap = !Storage.currentPacienteId ? await getPacienteNombreMap() : null;
    container.innerHTML = renderWithPatientGroups(filtered, tarea => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${tarea.titulo}</h3>
                    <p class="item-subtitle">${formatDate(tarea.fecha)}${tarea.hora ? ` - ${tarea.hora}` : ''}</p>
                </div>
                <div class="item-actions">
                    ${limits.premium ? `<button class="btn-icon btn-gcal" onclick="addTareaToGoogleCalendar('${encodeURIComponent(tarea.titulo)}','${tarea.fecha}','${tarea.hora || ''}','${encodeURIComponent(tarea.descripcion || '')}')" title="Agregar a Google Calendar">📅 Google Cal</button>` : ''}
                    <button class="btn-icon" onclick="toggleTareaCompletada('${tarea.id}')" title="${tarea.completada ? 'Marcar pendiente' : 'Completar'}">
                        ${tarea.completada ? '↩️' : '✓'}
                    </button>
                    <button class="btn-icon" onclick="editTarea('${tarea.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="deleteTarea('${tarea.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="item-details">
                <div class="item-detail">
                    <span class="item-badge badge-${tarea.completada ? 'completed' : 'active'}">${formatCategoriaTarea(tarea.categoria)}</span>
                    ${tarea.completada ? '<span class="item-badge badge-completed">Completada</span>' : ''}
                </div>
                <div class="item-detail">
                    <span class="detail-icon">🔄</span>
                    <span>${formatFrecuenciaTarea(tarea.frecuencia)}</span>
                </div>
                ${tarea.descripcion ? `
                <div class="item-detail">
                    <span class="detail-icon">📝</span>
                    <span>${tarea.descripcion}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `, pMap);
}

function formatCategoriaTarea(categoria) {
    const map = {
        'alimentacion': '🍽️ Alimentación',
        'higiene': '🧼 Higiene',
        'ejercicio': '🏃 Ejercicio',
        'medicacion': '💊 Medicación',
        'social': '👥 Social',
        'otro': 'Otro'
    };
    return map[categoria] || categoria;
}

function formatFrecuenciaTarea(frecuencia) {
    const map = {
        'unica': 'Única vez',
        'diaria': 'Diaria',
        'semanal': 'Semanal',
        'mensual': 'Mensual'
    };
    return map[frecuencia] || frecuencia;
}

// ========== GOOGLE CALENDAR (PREMIUM) ==========
// Crea un enlace de Google Calendar y lo abre en una nueva pestaña.
// Requiere plan Premium — los botones solo se renderizan para usuarios premium.
function addCitaToGoogleCalendar(encodedTitulo, fecha, hora, encodedLugar, encodedNotas) {
    const titulo = decodeURIComponent(encodedTitulo);
    const lugar  = decodeURIComponent(encodedLugar);
    const notas  = decodeURIComponent(encodedNotas);
    let startDt, endDt;
    if (hora && hora.length >= 5) {
        const [h, m] = hora.split(':').map(Number);
        // La hora está en Argentina (UTC-3): construir fecha con offset explícito
        // y convertir a UTC con Z suffix para que Google Calendar lo interprete siempre correcto
        const startDate = new Date(`${fecha}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-03:00`);
        const endDate   = new Date(startDate.getTime() + 60 * 60 * 1000);
        const fmtUTC    = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        startDt = fmtUTC(startDate);
        endDt   = fmtUTC(endDate);
    } else {
        const d = fecha.replace(/-/g, '');
        startDt = endDt = d;
    }
    const details = [lugar && `Lugar: ${lugar}`, notas].filter(Boolean).join('\n');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(titulo)}` +
        `&dates=${startDt}/${endDt}` +
        (details ? `&details=${encodeURIComponent(details)}` : '');
    window.open(url, '_blank', 'noopener');
}

function addTareaToGoogleCalendar(encodedTitulo, fecha, hora, encodedDesc) {
    const titulo = decodeURIComponent(encodedTitulo);
    const desc   = decodeURIComponent(encodedDesc);
    let startDt, endDt;
    if (hora && hora.length >= 5) {
        const [h, m] = hora.split(':').map(Number);
        const startDate = new Date(`${fecha}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-03:00`);
        const endDate   = new Date(startDate.getTime() + 60 * 60 * 1000);
        const fmtUTC    = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        startDt = fmtUTC(startDate);
        endDt   = fmtUTC(endDate);
    } else {
        const d = fecha.replace(/-/g, '');
        startDt = endDt = d;
    }
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent('✓ ' + titulo)}` +
        `&dates=${startDt}/${endDt}` +
        (desc ? `&details=${encodeURIComponent(desc)}` : '');
    window.open(url, '_blank', 'noopener');
}

// ========== CO-CUIDADOR: GESTIÓN DE ACCESO COMPARTIDO (PREMIUM) ==========

/**
 * Abre el panel de co-cuidadores de un paciente dentro de gestionPacientesModal.
 * @param {number} pacienteId
 * @param {string} pacienteNombre
 */
async function openSharePanel(pacienteId, pacienteNombre) {
    const container = document.getElementById('pacientesListContainer');
    container.innerHTML = `
        <div style="padding:8px 0;">
            <button onclick="loadPacientesList()" style="background:none;border:none;color:var(--primary,#667eea);cursor:pointer;font-size:0.9rem;padding:0 0 12px;font-weight:600;">← Volver</button>
            <h4 style="margin:0 0 14px;">👥 Co-cuidadores de <strong>${pacienteNombre}</strong></h4>
            <p style="color:#777;font-size:0.82rem;margin-bottom:14px;">Los co-cuidadores pueden ver medicamentos, citas, tareas y más. No pueden eliminar datos.</p>
            <div id="sharesList"><p style="color:#aaa;font-size:0.9rem;">Cargando...</p></div>
            <div style="border-top:1px solid #eee;padding-top:14px;margin-top:14px;">
                <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:8px;">Invitar familiar por email</label>
                <div style="display:flex;gap:8px;">
                    <input type="email" id="shareInviteEmail" placeholder="email@ejemplo.com"
                        style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;">
                    <button class="btn-primary" onclick="sendShareInvite(${pacienteId}, '${pacienteNombre.replace(/'/g, "\\'")}')"
                        style="white-space:nowrap;padding:8px 16px;">Invitar</button>
                </div>
            </div>
        </div>
    `;
    await _reloadSharesList(pacienteId, pacienteNombre);
}

async function _reloadSharesList(pacienteId, pacienteNombre) {
    const sl = document.getElementById('sharesList');
    if (!sl) return;
    try {
        const shares = await API.listShares(pacienteId);
        if (!shares.length) {
            sl.innerHTML = '<p style="color:#aaa;font-size:0.9rem;margin:0 0 14px;">Ningún co-cuidador agregado aún.</p>';
        } else {
            sl.innerHTML = `<div style="margin-bottom:14px;">${shares.map(s => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f3f3;">
                    <div>
                        <span style="font-size:0.9rem;font-weight:500;">${s.invitado_email}</span>
                        <span style="font-size:0.78rem;margin-left:8px;color:${s.aceptado ? '#4CAF50' : '#FF9800'};">
                            ${s.aceptado ? '✓ Activo' : '⏳ Invitación pendiente'}
                        </span>
                    </div>
                    <button class="btn-icon" onclick="revokeShare(${s.id}, ${pacienteId}, '${pacienteNombre.replace(/'/g, "\\'")}')"
                        title="Revocar acceso" style="color:#e53935;">🗑️</button>
                </div>
            `).join('')}</div>`;
        }
    } catch (e) {
        if (sl) sl.innerHTML = `<p style="color:#e53935;font-size:0.9rem;">Error: ${e.message}</p>`;
    }
}

async function sendShareInvite(pacienteId, pacienteNombre) {
    const emailInput = document.getElementById('shareInviteEmail');
    const email = emailInput?.value?.trim();
    if (!email || !email.includes('@')) {
        showToast('Ingresá un email válido', 'error');
        return;
    }
    try {
        await API.inviteShare(pacienteId, email);
        showToast(`✅ Invitación enviada a ${email}`, 'success');
        if (emailInput) emailInput.value = '';
        await _reloadSharesList(pacienteId, pacienteNombre);
    } catch (e) {
        showToast(e.message || 'Error al enviar invitación', 'error');
    }
}

async function revokeShare(shareId, pacienteId, pacienteNombre) {
    if (!confirm('¿Revocar el acceso de este co-cuidador?')) return;
    try {
        await API.deleteShare(shareId);
        showToast('Acceso revocado correctamente', 'success');
        await _reloadSharesList(pacienteId, pacienteNombre);
    } catch (e) {
        showToast(e.message || 'Error al revocar acceso', 'error');
    }
}

// Procesar token de invitación de co-cuidador al cargar la app (?share=TOKEN)
async function processShareInviteToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (!token) return;
    // Limpiar URL inmediatamente
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!API.isAuthenticated()) {
        showToast('Iniciá sesión para aceptar la invitación de co-cuidador', 'info', 6000);
        return;
    }
    try {
        const result = await API.acceptShare(token);
        showToast(`✅ ${result.mensaje || '¡Invitación aceptada!'} Paciente: ${result.paciente}`, 'success', 7000);
        await loadPacienteSelector();
    } catch (e) {
        showToast(e.message || 'Error al aceptar la invitación', 'error');
    }
}

async function filterTareas(filter) {
    await loadTareas(filter);
}

async function openTareaModal() {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    const limits = await Storage.checkLimits();
    if (!limits.premium && limits.tareas.exceeded) {
        showPremiumModal();
        return;
    }
    
    editingTareaId = null;
    document.getElementById('tareaModalTitle').textContent = 'Agregar Tarea';
    document.getElementById('tareaForm').reset();
    document.getElementById('tareaId').value = '';
    document.getElementById('tareaFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('tareaRecurrenteGroup').style.display = 'none';
    document.getElementById('tareaModal').classList.add('active');
}

function closeTareaModal() {
    document.getElementById('tareaModal').classList.remove('active');
    editingTareaId = null;
}

async function editTarea(id) {
    const tareas = await Storage.getTareas();
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (!tarea) return;
    
    editingTareaId = id;
    document.getElementById('tareaModalTitle').textContent = 'Editar Tarea';
    document.getElementById('tareaId').value = id;
    document.getElementById('tareaTitulo').value = tarea.titulo;
    document.getElementById('tareaCategoria').value = tarea.categoria;
    document.getElementById('tareaFrecuencia').value = tarea.frecuencia;
    document.getElementById('tareaFecha').value = tarea.fecha;
    document.getElementById('tareaHora').value = tarea.hora || '';
    document.getElementById('tareaDescripcion').value = tarea.descripcion || '';
    document.getElementById('tareaRecordatorio').checked = tarea.recordatorio || false;
    
    if (tarea.frecuencia !== 'unica') {
        document.getElementById('tareaRecurrenteGroup').style.display = 'block';
        document.getElementById('tareaHastaFecha').value = tarea.hastaFecha || '';
    }
    
    document.getElementById('tareaModal').classList.add('active');
}

async function deleteTarea(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
        await Storage.deleteTarea(id);
        showToast('🗑️ Tarea eliminada', 'success');
        await loadTareas();
        await loadDashboard();
    }
}

async function toggleTareaCompletada(id) {
    const tareas = await Storage.getTareas();
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (tarea) {
        await Storage.updateTarea(id, { completada: !tarea.completada });
        await loadTareas();
        await loadDashboard();
    }
}

function updateTareaFechas() {
    const frecuencia = document.getElementById('tareaFrecuencia').value;
    const recurrenteGroup = document.getElementById('tareaRecurrenteGroup');
    
    if (frecuencia === 'unica') {
        recurrenteGroup.style.display = 'none';
    } else {
        recurrenteGroup.style.display = 'block';
    }
}

async function saveTarea(event) {
    event.preventDefault();
    
    const hora = document.getElementById('tareaHora').value;
    
    const tarea = {
        titulo: document.getElementById('tareaTitulo').value,
        categoria: document.getElementById('tareaCategoria').value,
        frecuencia: document.getElementById('tareaFrecuencia').value,
        fecha: document.getElementById('tareaFecha').value,
        hora: hora || null,
        descripcion: document.getElementById('tareaDescripcion').value,
        recordatorio: document.getElementById('tareaRecordatorio').checked
    };
    
    if (tarea.frecuencia !== 'unica') {
        tarea.hastaFecha = document.getElementById('tareaHastaFecha').value;
    }
    
    const id = document.getElementById('tareaId').value;
    
    if (id) {
        await Storage.updateTarea(id, tarea);
    } else {
        await Storage.addTarea(tarea);
    }
    
    closeTareaModal();
    showToast(id ? '✓ Tarea actualizada' : '✓ Tarea guardada', 'success');
    await loadTareas();
    await loadDashboard();
}

// ========== CONTACTOS ==========
let editingContactoId = null;

async function loadContactos(filter = 'todos') {
    const contactos = await Storage.getContactos();
    const container = document.getElementById('contactosList');
    const limits = await Storage.checkLimits();
    let isPremium = Storage.getPremiumStatus();
    if (!isPremium && await isViewingSharedPatient()) { limits.premium = true; isPremium = true; }
    
    const warningDiv = document.getElementById('contactosPremiumWarning');
    if (!isPremium && limits.contactos.exceeded) {
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }

    // Mostrar banner de datos bloqueados si bajó de premium y tiene más de 2
    const lockedBanner = document.getElementById('contactosLockedBanner');
    if (lockedBanner) {
        if (!limits.premium && limits.contactos.locked > 0) {
            lockedBanner.style.display = 'block';
            lockedBanner.innerHTML = `
                <span class="locked-icon">🔒</span>
                Tenés <strong>${limits.contactos.locked}</strong> contacto${limits.contactos.locked > 1 ? 's' : ''} bloqueado${limits.contactos.locked > 1 ? 's' : ''}.
                <a href="#" onclick="showPremiumModal(); return false;">Volvé a Premium</a> para acceder a todos.
            `;
        } else {
            lockedBanner.style.display = 'none';
        }
    }
    
    // Visibles: free → solo primeros 2; premium → todos
    const visibles = (!limits.premium && contactos.length > limits.contactos.max)
        ? contactos.slice(0, limits.contactos.max)
        : contactos;

    // Los tabs del HTML usan plural ('medicos','familiares'), la BD usa singular ('medico','familiar')
    const TAB_MAP = { medicos: 'medico', familiares: 'familiar', emergencia: 'emergencia', farmacia: 'farmacia', otro: 'otro' };
    const dbCategory = TAB_MAP[filter] || filter;

    let filtered = visibles;
    if (filter !== 'todos') {
        filtered = visibles.filter(c => c.categoria === dbCategory);
    }
    
    // Ordenar alfabéticamente
    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay contactos registrados</p>';
        return;
    }
    
    container.innerHTML = filtered.map(contacto => `
        <div class="contacto-card">
            <div class="contacto-header">
                <div class="contacto-info">
                    <h4>${contacto.nombre}</h4>
                    <p class="contacto-categoria">${formatCategoriaContacto(contacto.categoria)}</p>
                    ${contacto.especialidad ? `<p class="contacto-categoria">${contacto.especialidad}</p>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editContacto('${contacto.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="deleteContacto('${contacto.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="contacto-details">
                <div class="contacto-detail">
                    <span class="detail-icon">📞</span>
                    <a href="tel:${contacto.telefono}">${contacto.telefono}</a>
                </div>
                ${contacto.email ? `
                <div class="contacto-detail">
                    <span class="detail-icon">📧</span>
                    <a href="mailto:${contacto.email}">${contacto.email}</a>
                </div>
                ` : ''}
                ${contacto.direccion ? `
                <div class="contacto-detail">
                    <span class="detail-icon">📍</span>
                    <span>${contacto.direccion}</span>
                </div>
                ` : ''}
                ${contacto.notas ? `
                <div class="contacto-detail">
                    <span class="detail-icon">📝</span>
                    <span>${contacto.notas}</span>
                </div>
                ` : ''}
            </div>
            <button class="btn-call" onclick="window.location.href='tel:${contacto.telefono}'">
                📞 Llamar
            </button>
        </div>
    `).join('');
}

function formatCategoriaContacto(categoria) {
    const map = {
        'medico': '👨‍⚕️ Médico',
        'emergencia': '🚨 Emergencia',
        'familiar': '👨‍👩‍👧‍👦 Familiar',
        'farmacia': '💊 Farmacia',
        'otro': 'Otro'
    };
    return map[categoria] || categoria;
}

async function switchContactoTab(tab) {
    await loadContactos(tab);
}

async function openContactoModal() {
    if (!requirePaciente()) return;
    if (await blockIfSharedPatient()) return;
    const limits = await Storage.checkLimits();
    if (!limits.premium && limits.contactos.exceeded) {
        showPremiumModal();
        return;
    }
    
    editingContactoId = null;
    document.getElementById('contactoModalTitle').textContent = 'Agregar Contacto';
    document.getElementById('contactoForm').reset();
    document.getElementById('contactoId').value = '';
    document.getElementById('contactoModal').classList.add('active');
}

function closeContactoModal() {
    document.getElementById('contactoModal').classList.remove('active');
    editingContactoId = null;
}

async function editContacto(id) {
    const contactos = await Storage.getContactos();
    const contacto = contactos.find(c => String(c.id) === String(id));
    if (!contacto) return;
    
    editingContactoId = id;
    document.getElementById('contactoModalTitle').textContent = 'Editar Contacto';
    document.getElementById('contactoId').value = id;
    document.getElementById('contactoNombre').value = contacto.nombre;
    document.getElementById('contactoCategoria').value = contacto.categoria;
    document.getElementById('contactoEspecialidad').value = contacto.especialidad || '';
    document.getElementById('contactoTelefono').value = contacto.telefono;
    document.getElementById('contactoEmail').value = contacto.email || '';
    document.getElementById('contactoDireccion').value = contacto.direccion || '';
    document.getElementById('contactoNotas').value = contacto.notas || '';
    
    document.getElementById('contactoModal').classList.add('active');
}

async function deleteContacto(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este contacto?')) {
        await Storage.deleteContacto(id);
        await loadContactos();
    }
}

async function saveContacto(event) {
    event.preventDefault();
    
    const contacto = {
        nombre: document.getElementById('contactoNombre').value,
        categoria: document.getElementById('contactoCategoria').value,
        especialidad: document.getElementById('contactoEspecialidad').value,
        telefono: document.getElementById('contactoTelefono').value,
        email: document.getElementById('contactoEmail').value,
        direccion: document.getElementById('contactoDireccion').value,
        notas: document.getElementById('contactoNotas').value
    };
    
    const id = document.getElementById('contactoId').value;
    
    if (id) {
        await Storage.updateContacto(id, contacto);
    } else {
        await Storage.addContacto(contacto);
    }
    
    closeContactoModal();
    await loadContactos();
}

// ========== REPORTES ==========
async function loadReportes() {
    const isPremium = Storage.getPremiumStatus();
    const premiumBlock = document.getElementById('reportesPremiumBlock');
    const contentDiv = document.getElementById('reportesContent');
    
    if (!isPremium) {
        if (premiumBlock) premiumBlock.style.display = 'flex';
        if (contentDiv) contentDiv.style.display = 'none';
    } else {
        if (premiumBlock) premiumBlock.style.display = 'none';
        if (contentDiv) contentDiv.style.display = 'block';
        
        // Configurar fechas por defecto
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        document.getElementById('reporteDesde').value = lastMonth.toISOString().split('T')[0];
        document.getElementById('reporteHasta').value = today.toISOString().split('T')[0];
    }
}

function confirmarBorrarDatos() {
    const confirmText = 'BORRAR TODO';
    const userInput = prompt(`Esta acción eliminará permanentemente todos tus datos.\n\nEscribe "${confirmText}" para confirmar:`);
    
    if (userInput === confirmText) {
        Storage.clearAll();
        alert('Todos los datos han sido eliminados');
        location.reload();
    } else if (userInput !== null) {
        alert('Cancelado - Los datos no fueron eliminados');
    }
}

// ========== PREMIUM ==========
function showPremiumWelcomeModal() {
    // Se muestra una única vez por suscripción activa.
    // Si el usuario cancela y vuelve a suscribirse, se vuelve a mostrar.
    if (localStorage.getItem('cuidadiario_premium_welcomed')) return;
    localStorage.setItem('cuidadiario_premium_welcomed', '1');

    const modal = document.createElement('div');
    modal.id = 'premiumWelcomeModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:8px;">&#127881;</div>
            <h2 style="color:#5a3e00;margin:0 0 6px;font-size:1.4rem;">&#161;Bienvenido a Premium!</h2>
            <p style="color:#777;font-size:0.93rem;margin-bottom:18px;">Ahora tenés acceso a todas las funciones avanzadas de CuidaDiario.</p>
            <div style="background:#fffbf0;border:1px solid #ffe08a;border-radius:12px;padding:16px 18px;text-align:left;margin-bottom:20px;">
                <div style="font-weight:700;color:#5a3e00;margin-bottom:12px;font-size:0.95rem;">&#10024; Tus beneficios activos:</div>
                <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;">
                    <li style="font-size:0.9rem;">&#128101; <strong>Co-cuidadores</strong> — invitá familiares a ver los datos<br>
                        <span style="font-size:0.8rem;color:#999;">Gestión de Pacientes → botón &#128101;</span></li>
                    <li style="font-size:0.9rem;">&#128202; <strong>Reportes avanzados</strong> — exportá historial en PDF<br>
                        <span style="font-size:0.8rem;color:#999;">Sección &quot;Reportes&quot; en el menú</span></li>
                    <li style="font-size:0.9rem;">&#128197; <strong>Google Calendar</strong> — sincronizá citas y tareas<br>
                        <span style="font-size:0.8rem;color:#999;">En cada cita y tarea → botón &#128197; Google Cal</span></li>
                    <li style="font-size:0.9rem;">&#128138; <strong>Sin límites</strong> — medicamentos, citas, tareas y síntomas ilimitados</li>
                    <li style="font-size:0.9rem;">&#128100; <strong>Múltiples pacientes</strong> — gestioná toda tu familia desde una cuenta</li>
                </ul>
            </div>
            <button class="btn-primary" onclick="document.getElementById('premiumWelcomeModal').remove()"
                style="width:100%;padding:14px;font-size:1rem;border-radius:10px;">
                &#128640; &#161;Empezar a usar Premium!
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updatePremiumStatus() {
    const isPremium = Storage.getPremiumStatus();
    const btnPremium = document.getElementById('btnPremium');
    const premiumStatus = document.getElementById('premiumStatus');
    const premiumText = document.getElementById('premiumText');
    
    if (isPremium) {
        premiumStatus.style.display = 'block';
        premiumStatus.innerHTML = `
            <span class="premium-badge">✓ Usuario Premium</span>
            <span style="font-size:0.82em;margin-left:12px;color:#5a3e00;">
                Para cancelar: <a href="https://www.mercadopago.com.ar/subscriptions" target="_blank" style="color:#7a4e00;font-weight:700;text-decoration:underline;">MercadoPago → Mis suscripciones</a>
            </span>
        `;
        premiumText.textContent = '✓ Premium';
        btnPremium.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
        btnPremium.style.color = 'white';
        btnPremium.title = 'Ya eres usuario Premium';
    } else {
        premiumStatus.style.display = 'none';
        premiumText.textContent = 'Premium';
        btnPremium.style.background = '';
        btnPremium.style.color = '';
        btnPremium.title = 'Obtener Premium';
    }
}

// ========== GUARDIA DE PACIENTE ==========
// Bloquea cualquier acción si el usuario no tiene un paciente creado/seleccionado.
// Retorna true si puede continuar, false si debe crear un paciente primero.
function requirePaciente() {
    if (Storage.currentPacienteId) return true;
    // Verificar si hay pacientes: si los hay, es el caso "todos los pacientes" seleccionado
    Storage.getPacientes().then(pacientes => {
        const propios = (pacientes || []).filter(p => !p.es_compartido);
        if (propios.length > 0) {
            // Premium con "todos" seleccionado → pedir que elija uno
            openPickPacienteModal();
        } else {
            showToast('Primero creá un paciente para poder registrar datos. \u{1F464}', 'warning', 4000);
            setTimeout(() => openGestionPacientesModal(), 300);
        }
    });
    return false;
}

async function openPickPacienteModal() {
    const pacientes = (await Storage.getPacientes()).filter(p => !p.es_compartido);
    const list = document.getElementById('pickPacienteList');
    list.innerHTML = pacientes.map(p => `
        <button class="btn-pick-paciente" onclick="pickPacienteAndClose(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')">\u{1F464} ${p.nombre}${p.relacion ? ` <em style="font-weight:400;opacity:.75">(${p.relacion})</em>` : ''}</button>
    `).join('');
    document.getElementById('pickPacienteModal').classList.add('active');
}

async function pickPacienteAndClose(id, nombre) {
    document.getElementById('pickPacienteModal').classList.remove('active');
    await selectPaciente(String(id));
    showToast(`Ahora ves a ${nombre}. Podés agregar el registro.`, 'info', 3500);
}

function closePickPacienteModal() {
    document.getElementById('pickPacienteModal').classList.remove('active');
}

function showPremiumModal() {
    document.getElementById('premiumModal').classList.add('active');
}

function closePremiumModal() {
    document.getElementById('premiumModal').classList.remove('active');
}

// ========== TOASTS ==========
function showToast(message, type = 'success', duration = 3500) {
    const icons = { success: '\u2705', error: '\u274c', warning: '\u26a0\ufe0f', info: '\u2139\ufe0f' };
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '\u2139\ufe0f'}</span>
        <span class="toast-body">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    toast.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}
window.showToast = showToast;

// ========== COOKIES ==========
function initCookieBanner() {
    const accepted = localStorage.getItem('cuidadiario_cookies_accepted');
    if (!accepted) {
        const banner = document.getElementById('cookieBanner');
        if (banner) banner.style.display = 'flex';
    }
}

function acceptCookies() {
    localStorage.setItem('cuidadiario_cookies_accepted', '1');
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.style.display = 'none';
}
window.acceptCookies = acceptCookies;

// ========== UTILIDADES ==========
function formatDate(dateStr) {
    if (!dateStr) return '';
    // Parsear como fecha local (no UTC) para evitar desfase de zona horaria
    const [year, month, day] = String(dateStr).substring(0, 10).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('es', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCurrentDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    
    // Configurar fechas por defecto si existen los elementos
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value && input.id !== 'tareaHastaFecha' && input.id !== 'reporteDesde' && input.id !== 'reporteHasta') {
            input.value = today;
        }
    });
}

function showWelcomeBannerIfNeeded() {
    const shown = Storage.get(Storage.KEYS.WELCOME_SHOWN);
    if (!shown) {
        const banner = document.getElementById('welcomeBanner');
        if (banner) {
            banner.style.display = 'block';
        }
        // Usuario nuevo: mostrar invitación a instalar la app después de 5 segundos
        setTimeout(() => showA2HSWelcome(), 5000);
    }
}

// Muestra banner de bienvenida invitando a instalar la app (solo usuarios nuevos)
function showA2HSWelcome() {
    if (document.getElementById('a2hsBanner')) return;
    // Si ya está instalada como PWA, no mostrar
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;

    const banner = document.createElement('div');
    banner.id = 'a2hsBanner';
    banner.innerHTML = `
        <div style="font-size:1.8rem;margin-bottom:6px;">📲</div>
        <strong style="font-size:1rem;">¡Bienvenido/a a CuidaDiario!</strong>
        <p style="margin:8px 0 14px;font-size:0.85rem;opacity:0.9;line-height:1.4;">
            Para recibir notificaciones y acceder más rápido, instalá la app en tu celular.
        </p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button onclick="triggerA2HS();cerrarA2HSBanner()" style="background:#fff;color:#667eea;border:none;padding:8px 18px;border-radius:20px;font-weight:700;cursor:pointer;font-size:0.85rem;">
                Instalar app
            </button>
            <button onclick="cerrarA2HSBanner()" style="background:none;border:1px solid rgba(255,255,255,0.5);color:rgba(255,255,255,0.9);padding:8px 14px;border-radius:20px;cursor:pointer;font-size:0.85rem;">
                Ahora no
            </button>
        </div>
    `;
    banner.style.cssText = `
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        background:linear-gradient(135deg,#667eea,#764ba2);
        color:#fff; padding:20px 22px; border-radius:16px;
        font-size:0.9rem; max-width:320px; width:90%;
        z-index:9999; text-align:center;
        box-shadow:0 6px 32px rgba(102,126,234,0.4);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(banner);
}

function cerrarA2HSBanner() {
    const b = document.getElementById('a2hsBanner');
    if (b) b.remove();
}
window.cerrarA2HSBanner = cerrarA2HSBanner;

// ========== ONBOARDING (PRIMER USO) ==========
const ONBOARDING_KEY = 'cuidadiario_onboarding_done';
const ONBOARDING_STEPS = 4;
let _onbStep = 1;

function showOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    const modal = document.getElementById('onboardingModal');
    if (!modal) return;
    _onbStep = 1;
    // Reset: show step 1, hide others
    for (let i = 1; i <= ONBOARDING_STEPS; i++) {
        const el = document.getElementById(`onbStep${i}`);
        if (el) el.style.display = i === 1 ? 'block' : 'none';
    }
    const bar = document.getElementById('onbProgressBar');
    if (bar) bar.style.width = `${(1 / ONBOARDING_STEPS) * 100}%`;
    modal.classList.add('active');
}

function onboardingNext() {
    if (_onbStep >= ONBOARDING_STEPS) { skipOnboarding(); return; }
    const cur = document.getElementById(`onbStep${_onbStep}`);
    if (cur) cur.style.display = 'none';
    _onbStep++;
    const next = document.getElementById(`onbStep${_onbStep}`);
    if (next) next.style.display = 'block';
    const bar = document.getElementById('onbProgressBar');
    if (bar) bar.style.width = `${(_onbStep / ONBOARDING_STEPS) * 100}%`;
}

function skipOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.remove('active');
    localStorage.setItem(ONBOARDING_KEY, '1');
}

window.showOnboarding  = showOnboarding;
window.onboardingNext  = onboardingNext;
window.skipOnboarding  = skipOnboarding;

function closeWelcomeBanner() {
    document.getElementById('welcomeBanner').style.display = 'none';
    Storage.set(Storage.KEYS.WELCOME_SHOWN, true);
}

// ========== MODALES DE DASHBOARD ==========
async function openDashboardModal(type) {
    const modal = document.getElementById('dashboardDetailModal');
    const title = document.getElementById('dashDetailTitle');
    const body = document.getElementById('dashDetailBody');

    const icons = { medicamentos: '💊', citas: '📅', tareas: '✓', registros: '📝' };
    const names = { medicamentos: 'Medicamentos activos', citas: 'Citas esta semana', tareas: 'Tareas pendientes hoy', registros: 'Registros este mes' };
    title.textContent = `${icons[type] || ''} ${names[type] || type}`;
    body.innerHTML = '<p style="color:var(--text-secondary);">Cargando...</p>';
    modal.classList.add('active');

    try {
        const _now = new Date();
        const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
        const thisMonth = today.substring(0, 7);

        // Badge de paciente — solo se muestra cuando se ven todos los pacientes
        const pMap = !Storage.currentPacienteId ? await getPacienteNombreMap() : null;
        const patientTag = (item) => {
            if (!pMap) return '';
            const nombre = pMap[String(item.paciente_id || '')] || 'Sin paciente';
            return `<span style="display:inline-block;background:var(--primary-light,#e3f0fb);color:var(--primary,#2196F3);border-radius:12px;padding:1px 9px;font-size:0.72rem;margin-bottom:4px;">👤 ${nombre}</span><br>`;
        };

        if (type === 'medicamentos') {
            const meds = await Storage.getMedicamentos();
            if (!meds.length) { body.innerHTML = '<p class="empty-state">Sin medicamentos registrados</p>'; return; }
            body.innerHTML = meds.map(m => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                    ${patientTag(m)}
                    <strong>💊 ${m.nombre}</strong> — <span style="color:var(--text-secondary);">${m.dosis}</span>
                    <br><small style="color:var(--text-secondary);">${formatFrecuenciaMed(m)}</small>
                </div>`).join('');

        } else if (type === 'citas') {
            const citas = await Storage.getCitas();
            const weekLater = new Date(_now); weekLater.setDate(weekLater.getDate() + 7);
            const weekLaterStr = `${weekLater.getFullYear()}-${String(weekLater.getMonth()+1).padStart(2,'0')}-${String(weekLater.getDate()).padStart(2,'0')}`;
            const proximas = citas.filter(c => {
                const d = (c.fecha || '').substring(0, 10);
                return d >= today && d <= weekLaterStr;
            });
            if (!proximas.length) { body.innerHTML = '<p class="empty-state">Sin citas esta semana</p>'; return; }
            body.innerHTML = proximas.map(c => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                    ${patientTag(c)}
                    <strong>📅 ${c.titulo || c.medico || 'Cita'}</strong>
                    <br><small style="color:var(--text-secondary);">${formatDate(c.fecha)}${c.hora ? ' a las ' + c.hora : ''}${c.lugar ? ' — ' + c.lugar : ''}</small>
                </div>`).join('');

        } else if (type === 'tareas') {
            const tareas = await Storage.getTareas();
            const pendientes = tareas.filter(t => !t.completada && (t.fecha || '').substring(0, 10) === today);
            if (!pendientes.length) { body.innerHTML = '<p class="empty-state">Sin tareas pendientes hoy 🎉</p>'; return; }
            body.innerHTML = pendientes.map(t => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                    ${patientTag(t)}
                    <strong>✓ ${t.titulo || t.nombre}</strong>
                    ${t.descripcion ? `<br><small style="color:var(--text-secondary);">${t.descripcion}</small>` : ''}
                </div>`).join('');

        } else if (type === 'registros') {
            const historial = await Storage.getHistorialMedicamentos();
            const sintomas = await Storage.getSintomas();
            const regMes = [
                ...historial.filter(h => (h.fecha || '').startsWith(thisMonth)).map(h => ({ tipo: '💊', texto: `${h.medicamento_nombre || h.medicamentoNombre} — ${h.dosis}`, fecha: h.fecha, paciente_id: h.paciente_id })),
                ...sintomas.filter(s => (s.fecha || '').startsWith(thisMonth)).map(s => ({ tipo: '🩺', texto: s.descripcion || s.tipo, fecha: s.fecha, paciente_id: s.paciente_id }))
            ].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
            if (!regMes.length) { body.innerHTML = '<p class="empty-state">Sin registros este mes</p>'; return; }
            body.innerHTML = regMes.map(r => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                    ${patientTag(r)}
                    <strong>${r.tipo} ${r.texto}</strong>
                    <br><small style="color:var(--text-secondary);">${formatDate(r.fecha)}</small>
                </div>`).join('');
        }
    } catch (err) {
        body.innerHTML = '<p class="empty-state">Error al cargar los datos</p>';
    }
}

function setupEventListeners() {
    // Event listener para botón premium en header
    const btnPremium = document.getElementById('btnPremium');
    if (btnPremium) {
        btnPremium.addEventListener('click', showPremiumModal);
    }

    // Interceptar botón Atrás en móvil para mostrar confirmación
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        history.pushState(null, '', location.href);
        window.addEventListener('popstate', () => {
            history.pushState(null, '', location.href);
            document.getElementById('exitConfirmModal').classList.add('active');
        });
    }
    
    // Cerrar modales al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Cerrar menú de configuración al hacer clic fuera de él
    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('settingsWrap');
        if (wrap && !wrap.contains(e.target)) {
            const menu = document.getElementById('settingsMenu');
            const btn  = document.getElementById('settingsBtn');
            if (menu) menu.style.display = 'none';
            if (btn)  btn.classList.remove('open');
        }
    });
}

async function loadAllSections() {
    // Pre-cargar datos de todas las secciones
    await loadMedicamentos();
    await loadCitas();
    await loadSintomas();
    await loadTareas();
    await loadContactos();
    loadReportes();
}

// ========== GESTIÓN DE PACIENTES ==========

async function loadPacienteSelector() {
    const bar = document.getElementById('patientSelectorBar');
    const contentDiv = document.getElementById('patientSelectorContent');
    if (!bar || !contentDiv) return;
    bar.style.display = 'flex';

    const isPremium = Storage.getPremiumStatus();
    try {
        const pacientes = await Storage.getPacientes();

        if (isPremium) {
            // Usuario Premium: restaurar paciente de la sesión anterior o auto-seleccionar si hay uno solo
            if (!Storage.currentPacienteId) {
                const saved = localStorage.getItem('cuidadiario_selected_paciente');
                if (saved && pacientes.find(p => String(p.id) === saved)) {
                    Storage.currentPacienteId = parseInt(saved);
                } else if (pacientes.length === 1) {
                    Storage.currentPacienteId = pacientes[0].id;
                    localStorage.setItem('cuidadiario_selected_paciente', String(pacientes[0].id));
                }
            }
            const currentId = Storage.currentPacienteId;
            const options = pacientes.map(p =>
                `<option value="${p.id}" ${String(p.id) === String(currentId) ? 'selected' : ''}>${p.nombre}${p.relacion ? ` (${p.relacion})` : ''}</option>`
            ).join('');
            contentDiv.innerHTML = `
                <div class="patient-selector-left">
                    <span class="patient-selector-label">&#128100; Viendo:</span>
                    <select id="pacienteSelector" onchange="selectPaciente(this.value)" class="patient-dropdown">
                        <option value="" ${!currentId ? 'selected' : ''}>Todos los pacientes</option>
                        ${options}
                    </select>
                </div>
                <button class="btn-manage-patients" onclick="openGestionPacientesModal()">
                    &#9881;&#65039; Gestionar Pacientes
                </button>
            `;
        } else {
            // Usuario Free
            const hasShared = pacientes.some(p => p.es_compartido);
            if (hasShared) {
                // Free con pacientes compartidos: mostrar selector completo para poder navegar
                if (!Storage.currentPacienteId) {
                    const saved = localStorage.getItem('cuidadiario_selected_paciente');
                    if (saved && pacientes.find(p => String(p.id) === saved)) {
                        Storage.currentPacienteId = parseInt(saved);
                    } else {
                        const firstOwn = pacientes.find(p => !p.es_compartido) || pacientes[0];
                        if (firstOwn) {
                            Storage.currentPacienteId = firstOwn.id;
                            localStorage.setItem('cuidadiario_selected_paciente', String(firstOwn.id));
                        }
                    }
                }
                const currentId = Storage.currentPacienteId;
                const options = pacientes.map(p =>
                    `<option value="${p.id}" ${String(p.id) === String(currentId) ? 'selected' : ''}>${p.nombre}${p.relacion ? ` (${p.relacion})` : ''}${p.es_compartido ? ' &#128101;' : ''}</option>`
                ).join('');
                contentDiv.innerHTML = `
                    <div class="patient-selector-left">
                        <span class="patient-selector-label">&#128100; Viendo:</span>
                        <select id="pacienteSelector" onchange="selectPaciente(this.value)" class="patient-dropdown">
                            ${options}
                        </select>
                    </div>
                    <button class="btn-manage-patients" onclick="openGestionPacientesModal()">
                        &#9881;&#65039; Ver Pacientes
                    </button>
                `;
            } else {
                // Usuario Free sin compartidos: comportamiento original
                const paciente = pacientes[0] || null;
                if (paciente) {
                    Storage.currentPacienteId = paciente.id;
                    localStorage.setItem('cuidadiario_selected_paciente', String(paciente.id));
                    contentDiv.innerHTML = `
                        <div class="patient-selector-left">
                            <span class="patient-selector-label">&#128100; Paciente:</span>
                            <span class="patient-name-free">${paciente.nombre}${paciente.relacion ? ` <span class="paciente-relacion-inline">(${paciente.relacion})</span>` : ''}</span>
                            <button class="btn-edit-patient-free" onclick="openGestionPacientesModal()" title="Editar nombre del paciente">&#9998;</button>
                        </div>
                        <button class="btn-manage-patients btn-add-patient-locked" onclick="showPremiumModal()">
                            &#128274; Agregar otro paciente
                        </button>
                    `;
                } else {
                    contentDiv.innerHTML = `
                        <div class="patient-selector-left">
                            <span class="patient-selector-label">&#128100; Paciente:</span>
                            <span class="patient-name-unset">Sin nombre asignado</span>
                        </div>
                        <button class="btn-manage-patients btn-name-patient-cta" onclick="openGestionPacientesModal()">
                            &#128393; Nombrar a mi paciente
                        </button>
                    `;
                }
            }
        }
    } catch (err) {
        console.error('Error cargando selector de pacientes:', err);
    }
}

async function selectPaciente(value) {
    Storage.currentPacienteId = value ? parseInt(value) : null;
    // Persistir selección para restaurarla al recargar la página
    if (value) {
        localStorage.setItem('cuidadiario_selected_paciente', value);
    } else {
        localStorage.removeItem('cuidadiario_selected_paciente');
    }
    const activeSection = document.querySelector('.section.active');
    if (activeSection) await navigateToSection(activeSection.id);
    await loadDashboard();
}

async function openGestionPacientesModal() {
    const modal = document.getElementById('gestionPacientesModal');
    const isPremium = Storage.getPremiumStatus();
    const titleEl = modal.querySelector('.modal-header h3');
    if (titleEl) {
        titleEl.innerHTML = isPremium ? '&#128100; Gestión de Pacientes' : '&#128100; Mi Paciente';
    }
    modal.classList.add('active');
    await loadPacientesList();
}

function closeGestionPacientesModal() {
    document.getElementById('gestionPacientesModal').classList.remove('active');
}

async function loadPacientesList() {
    const container = document.getElementById('pacientesListContainer');
    const formContainer = document.getElementById('pacienteFormContainer');
    formContainer.style.display = 'none';
    container.style.display = 'block';
    const isPremium = Storage.getPremiumStatus();
    try {
        const pacientes = await Storage.getPacientes();
        let html = '';
        if (pacientes.length === 0) {
            html = '<p class="empty-state" style="padding: 20px 0;">No tienes pacientes registrados aún.</p>';
        } else {
            html = '<div class="pacientes-list">' + pacientes.map(p => `
                <div class="paciente-item">
                    <div class="paciente-info">
                        <div class="paciente-avatar">&#128100;</div>
                        <div class="paciente-details">
                            <strong>${p.nombre}</strong>
                            ${p.relacion ? `<span class="paciente-relacion">${p.relacion}</span>` : ''}
                            ${p.fecha_nacimiento ? `<span class="paciente-fecha">${formatDate(p.fecha_nacimiento)}</span>` : ''}
                            ${p.es_compartido ? `<span class="paciente-compartido-badge">&#128101; Co-cuidador &mdash; ${p.compartido_por || 'otro usuario'}</span>` : ''}
                        </div>
                    </div>
                    <div class="item-actions">
                        ${!p.es_compartido ? `<button class="btn-icon" onclick="editPaciente(${p.id})" title="Editar">&#9999;&#65039;</button>` : ''}
                        ${isPremium && !p.es_compartido ? `<button class="btn-icon" onclick="openSharePanel(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Co-cuidadores">&#128101;</button>` : ''}
                        ${isPremium && !p.es_compartido ? `<button class="btn-icon" onclick="deletePaciente(${p.id})" title="Eliminar">&#128465;&#65039;</button>` : ''}
                    </div>
                </div>
            `).join('') + '</div>';
        }

        if (isPremium) {
            html += `<div style="padding: 16px 0 4px; text-align: center;">
                <button class="btn-primary" onclick="openPacienteForm()">+ Agregar Paciente</button>
            </div>`;
        } else if (pacientes.length === 0) {
            // Free sin paciente: invitar a crear el primero
            html += `<div style="padding: 16px 0 4px; text-align: center;">
                <button class="btn-primary" onclick="openPacienteForm()">+ Nombrar mi paciente</button>
            </div>`;
        } else {
            // Free con 1 paciente: mostrar upgrade prompt
            html += `<div class="free-patient-upgrade">
                <button class="btn-upgrade-patients" onclick="closeGestionPacientesModal(); showPremiumModal();">
                    &#128274; Agregar otro paciente &mdash; Premium
                </button>
                <p class="free-limit-note">La versión gratuita incluye solo 1 paciente.</p>
            </div>`;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p class="empty-state">Error al cargar pacientes</p>';
    }
}

function openPacienteForm(paciente = null) {
    const isPremium = Storage.getPremiumStatus();
    document.getElementById('pacientesListContainer').style.display = 'none';
    let title;
    if (paciente) {
        title = isPremium ? 'Editar Paciente' : 'Editar nombre del paciente';
    } else {
        title = isPremium ? 'Agregar Paciente' : 'Nombrar mi paciente';
    }
    document.getElementById('pacienteFormTitle').textContent = title;
    document.getElementById('pacienteForm').reset();
    document.getElementById('pacienteId').value = '';
    if (paciente) {
        document.getElementById('pacienteId').value = paciente.id;
        document.getElementById('pacienteNombre').value = paciente.nombre || '';
        document.getElementById('pacienteRelacion').value = paciente.relacion || '';
        document.getElementById('pacienteFechaNacimiento').value =
            paciente.fecha_nacimiento ? String(paciente.fecha_nacimiento).substring(0, 10) : '';
        document.getElementById('pacienteNotas').value = paciente.notas || '';
    }
    document.getElementById('pacienteFormContainer').style.display = 'block';
}

function closePacienteForm() {
    document.getElementById('pacienteFormContainer').style.display = 'none';
    document.getElementById('pacientesListContainer').style.display = 'block';
}

async function editPaciente(id) {
    const pacientes = await Storage.getPacientes();
    const paciente = pacientes.find(p => p.id === id);
    if (!paciente) return;
    if (paciente.es_compartido) {
        showToast('No podés editar pacientes compartidos por otro usuario.', 'warning');
        return;
    }
    openPacienteForm(paciente);
}

async function deletePaciente(id) {
    if (!confirm('¿Eliminar este paciente? Se perderá el vínculo con sus registros.')) return;
    try {
        await Storage.deletePaciente(id);
        if (Storage.currentPacienteId === id) {
            Storage.currentPacienteId = null;
            const sel = document.getElementById('pacienteSelector');
            if (sel) sel.value = '';
        }
        await loadPacienteSelector();
        await loadPacientesList();
        await loadDashboard();
    } catch (err) {
        // Error shown by storage
    }
}

async function savePaciente(event) {
    event.preventDefault();
    const id = document.getElementById('pacienteId').value;
    const data = {
        nombre: document.getElementById('pacienteNombre').value.trim(),
        relacion: document.getElementById('pacienteRelacion').value || null,
        fecha_nacimiento: document.getElementById('pacienteFechaNacimiento').value || null,
        notas: document.getElementById('pacienteNotas').value.trim() || null
    };
    try {
        if (id) {
            await Storage.updatePaciente(id, data);
        } else {
            const newPaciente = await Storage.addPaciente(data);
            // Asignar currentPacienteId de inmediato para que los registros siguientes
            // lleven el paciente_id correcto, sin depender de que loadPacienteSelector
            // lo haga después (evita la condición de carrera).
            if (newPaciente && newPaciente.id) {
                Storage.currentPacienteId = newPaciente.id;
                localStorage.setItem('cuidadiario_selected_paciente', String(newPaciente.id));
            }
        }
        await loadPacienteSelector();
        await loadPacientesList();
    } catch (err) {
        // Error shown by storage
    }
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
// Estas funciones deben estar disponibles desde HTML
window.navigateToSection = navigateToSection;
window.openMedicamentoModal = openMedicamentoModal;
window.closeMedicamentoModal = closeMedicamentoModal;
window.editMedicamento = editMedicamento;
window.deleteMedicamento = deleteMedicamento;
window.saveMedicamento = saveMedicamento;
window.registrarTomaMedicamento = registrarTomaMedicamento;
window.openCitaModal = openCitaModal;
window.closeCitaModal = closeCitaModal;
window.editCita = editCita;
window.deleteCita = deleteCita;
window.saveCita = saveCita;
window.filterCitas = filterCitas;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.selectCalendarDate = selectCalendarDate;
window.openSintomaModal = openSintomaModal;
window.closeSintomaModal = closeSintomaModal;
window.saveSintoma = saveSintoma;
window.deleteSintoma = deleteSintoma;
window.switchSintomaTab = switchSintomaTab;
window.registrarSigno = registrarSigno;
window.closeSignoModal = closeSignoModal;
window.saveSigno = saveSigno;
window.openTareaModal = openTareaModal;
window.closeTareaModal = closeTareaModal;
window.editTarea = editTarea;
window.deleteTarea = deleteTarea;
window.toggleTareaCompletada = toggleTareaCompletada;
window.saveTarea = saveTarea;
window.filterTareas = filterTareas;
window.updateTareaFechas = updateTareaFechas;
window.openContactoModal = openContactoModal;
window.closeContactoModal = closeContactoModal;
window.editContacto = editContacto;
window.deleteContacto = deleteContacto;
window.saveContacto = saveContacto;
window.switchContactoTab = switchContactoTab;
window.showPremiumModal = showPremiumModal;
window.closePremiumModal = closePremiumModal;
window.showPremiumWelcomeModal = showPremiumWelcomeModal;
window.confirmarBorrarDatos = confirmarBorrarDatos;
window.closeWelcomeBanner = closeWelcomeBanner;
window.updatePremiumStatus = updatePremiumStatus;
window.loadPacienteSelector = loadPacienteSelector;
window.selectPaciente = selectPaciente;
window.openGestionPacientesModal = openGestionPacientesModal;
window.closeGestionPacientesModal = closeGestionPacientesModal;
window.openPacienteForm = openPacienteForm;
window.closePacienteForm = closePacienteForm;
window.savePaciente = savePaciente;
window.editPaciente = editPaciente;
window.deletePaciente = deletePaciente;
// Co-cuidador
window.openSharePanel = openSharePanel;
window.sendShareInvite = sendShareInvite;
window.revokeShare = revokeShare;
window.processShareInviteToken = processShareInviteToken;
// Google Calendar
window.addCitaToGoogleCalendar = addCitaToGoogleCalendar;
window.addTareaToGoogleCalendar = addTareaToGoogleCalendar;

// ========== PERFIL DE USUARIO ==========

function openProfileModal() {
    const user = API.getUser();
    if (!user) return;
    document.getElementById('profileNombre').value = user.nombre || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profilePassword').value = '';
    document.getElementById('profilePasswordConfirm').value = '';
    const tzSelect = document.getElementById('profileTimezone');
    if (tzSelect) tzSelect.value = user.timezone || 'America/Argentina/Buenos_Aires';
    const premiumInfo = document.getElementById('profilePremiumInfo');
    if (premiumInfo) premiumInfo.style.display = Storage.getPremiumStatus() ? 'block' : 'none';
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

async function saveProfile(e) {
    e.preventDefault();
    const nombre = document.getElementById('profileNombre').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const password = document.getElementById('profilePassword').value;
    const passwordConfirm = document.getElementById('profilePasswordConfirm').value;

    if (password && password !== passwordConfirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    if (password && password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    const btn = document.getElementById('profileSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const payload = { nombre, email };
        if (password) payload.password = password;
        const tzSelect = document.getElementById('profileTimezone');
        if (tzSelect) payload.timezone = tzSelect.value;
        const data = await API.updateProfile(payload);
        // Actualizar localStorage con nuevos datos
        const updated = data.usuario || { nombre, email, premium: Storage.getPremiumStatus() };
        API.setUser({ ...API.getUser(), ...updated });
        // Actualizar saludo en el header
        const greeting = document.getElementById('userGreeting');
        if (greeting) greeting.textContent = `Hola, ${updated.nombre} ▾`;
        showToast('✅ Perfil actualizado correctamente', 'success');
        closeProfileModal();
    } catch (err) {
        showToast(err.message || 'Error al actualizar el perfil', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
    }
}

window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfile = saveProfile;
window.openDashboardModal = openDashboardModal;
window.deleteHistorialEntry = deleteHistorialEntry;

// ========== PUSH NOTIFICATIONS (PWA) ==========

// Re-sincronizar suscripción push con el backend en cada inicio de sesión.
// Si la primera suscripción falló (sin red, token expirado, etc.), se reintenta aquí.
async function resyncPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!API.isAuthenticated()) return;
    if (Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            // Siempre re-guardar: el backend hace ON CONFLICT UPDATE, no hay duplicados
            API.savePushSubscription(existing.toJSON())
                .then(() => console.log('[Push] Suscripción re-sincronizada con backend ✅'))
                .catch(e => console.warn('[Push] Resync fallido (se reintenta en próximo login):', e.message));
        } else {
            // Permiso concedido pero sin suscripción activa → recrear automáticamente
            await _autoSubscribePush(reg);
        }
    } catch (e) {
        console.warn('[Push] Error en resync:', e.message);
    }
}

// Enviar una notificación push de prueba para verificar que todo funciona
async function sendTestPush() {
    const btn = document.getElementById('testPushBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando...'; }
    try {
        const result = await API.testPush();
        showToast(`✅ Enviada a ${result.devices} dispositivo(s) — esperá unos segundos`, 'success');
    } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('suscripción') || msg.includes('404') || msg.includes('no hay')) {
            showToast('⚠️ Este dispositivo no está suscrito. Activá las notificaciones primero.', 'warning');
        } else if (msg.includes('vapid') || msg.includes('503') || msg.includes('configurad')) {
            showToast('❌ Servidor sin VAPID configurado — seguí los pasos en setup-vapid.js', 'error');
        } else {
            showToast('Error al enviar prueba: ' + (err.message || err), 'error');
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🧪 Enviar notificación de prueba'; }
    }
}

// Convierte la clave VAPID base64url a Uint8Array (requerido por pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Verifica el estado actual de las notificaciones y actualiza el botón en el perfil
async function updatePushToggleUI() {
    const btn = document.getElementById('pushToggleBtn');
    const section = document.getElementById('pushNotifSection');
    if (!btn || !section) return;

    // iOS sin instalación: Web Push no funciona en Safari sin instalar la PWA (límite de Apple)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true ||
                         window.matchMedia('(display-mode: standalone)').matches;
    const iosWarning = document.getElementById('iosNoPushWarning');
    if (isIOS && !isStandalone) {
        if (iosWarning) iosWarning.style.display = 'block';
        section.style.display = 'none';
        return;
    }
    if (iosWarning) iosWarning.style.display = 'none';

    // Si el navegador no soporta push, ocultar la sección
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        section.style.display = 'none';
        return;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        const permission = Notification.permission;
        const testBtn = document.getElementById('testPushBtn');

        if (subscription && permission === 'granted') {
            btn.textContent = '🔔 Notificaciones activadas — Desactivar';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-push-active');
            if (testBtn) testBtn.style.display = 'block';
        } else if (permission === 'denied') {
            btn.textContent = '🔕 Permiso denegado en el navegador';
            btn.disabled = true;
            btn.style.opacity = '0.6';
            if (testBtn) testBtn.style.display = 'none';
        } else {
            btn.textContent = '🔔 Activar notificaciones push';
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-push-active');
            btn.disabled = false;
            btn.style.opacity = '';
            if (testBtn) testBtn.style.display = 'none';
        }
    } catch (err) {
        console.warn('[Push] Error verificando estado:', err);
    }
}

// Toggle principal: suscribir o desuscribir
async function togglePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Tu navegador no soporta notificaciones push', 'error');
        return;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();

        if (existing) {
            // Ya está suscrito → desuscribir
            await existing.unsubscribe();
            try { await API.deletePushSubscription(existing.endpoint); } catch (e) { /* OK */ }
            showToast('🔕 Notificaciones desactivadas', 'info');
            await updatePushToggleUI();
            return;
        }

        // Pedir permiso
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Permiso denegado. Habilitalo en ajustes del navegador.', 'error');
            await updatePushToggleUI();
            return;
        }

        // Obtener VAPID public key del backend
        let vapidKey;
        try {
            const data = await API.getPushVapidKey();
            vapidKey = data.publicKey;
        } catch (e) {
            // Fallback: usar la clave configurada localmente
            vapidKey = window.VAPID_PUBLIC_KEY || null;
        }

        if (!vapidKey) {
            showToast('El servicio de notificaciones no está configurado aún.', 'error');
            return;
        }

        // Suscribir al usuario
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });

        // Enviar suscripción al backend
        await API.savePushSubscription(subscription.toJSON());

        showToast('✅ Notificaciones push activadas', 'success');
        await updatePushToggleUI();

    } catch (err) {
        console.error('[Push] Error en toggle:', err);
        showToast('Error al configurar notificaciones: ' + err.message, 'error');
    }
}

// Inicializar PWA: registrar SW y activar push automáticamente
async function initPWA() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[SW] Registrado:', reg.scope);

        // Escuchar mensajes del SW (ej: pushsubscriptionchange, offline queue)
        navigator.serviceWorker.addEventListener('message', async (event) => {
            if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
                try {
                    await API.savePushSubscription(event.data.subscription);
                    console.log('[Push] Suscripción actualizada en backend');
                } catch (e) { /* OK */ }
            }
            // Guardar solicitud offline en localStorage para reintento posterior
            if (event.data?.type === 'OFFLINE_REQUEST_QUEUED' && event.data.request) {
                try {
                    const queue = JSON.parse(localStorage.getItem('cuidadiario_offline_queue') || '[]');
                    queue.push(event.data.request);
                    localStorage.setItem('cuidadiario_offline_queue', JSON.stringify(queue));
                    console.log('[Offline] Solicitud encolada:', event.data.request.method, event.data.request.url);
                } catch (e) { /* OK */ }
            }
            // Procesar cola cuando el SW indica que hay conexión
            if (event.data?.type === 'PROCESS_OFFLINE_QUEUE') {
                processOfflineQueue();
            }
        });

        // Si ya hay suscripción activa → sincronizar con el backend y listo
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === 'granted') {
            API.savePushSubscription(existing.toJSON()).catch(() => {});
            await updatePushToggleUI();
            return;
        }

        // Permiso ya concedido pero sin suscripción → re-suscribir automáticamente
        if (Notification.permission === 'granted' && !existing) {
            await _autoSubscribePush(reg);
            return;
        }

        // Permiso aún no solicitado → pedirlo automáticamente al usuario
        if (Notification.permission === 'default') {
            setTimeout(async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const r = await navigator.serviceWorker.ready;
                        const ok = await _autoSubscribePush(r);
                        if (ok) showToast('🔔 Notificaciones push activadas', 'success');
                    }
                    await updatePushToggleUI();
                } catch (e) { /* OK si el browser bloquea sin gesto del usuario */ }
            }, 2000);
        }

    } catch (err) {
        console.warn('[SW] No se pudo registrar:', err.message);
    }
}

// Helper: suscribir al push sin interacción del usuario (después de obtener permiso)
async function _autoSubscribePush(reg) {
    try {
        let vapidKey;
        try {
            const data = await API.getPushVapidKey();
            vapidKey = data.publicKey;
        } catch (e) {
            vapidKey = window.VAPID_PUBLIC_KEY || null;
        }
        if (!vapidKey) return false;
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        await API.savePushSubscription(subscription.toJSON());
        console.log('[Push] Suscripción activada automáticamente');
        await updatePushToggleUI();
        return true;
    } catch (err) {
        console.warn('[Push] Error al auto-suscribir:', err.message);
        return false;
    }
}

// ===== ADD TO HOME SCREEN (A2HS / PWA install) =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateA2HSButton();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateA2HSButton();
    showToast('✅ CuidaDiario instalada en tu pantalla de inicio', 'success');
});

// Actualizar el botón de instalación según el estado actual de la PWA
function updateA2HSButton() {
    const btn = document.getElementById('a2hsBtn');
    if (!btn) return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        btn.textContent = '✅ App ya instalada';
        btn.disabled = true;
        btn.style.opacity = '0.6';
    } else if (deferredInstallPrompt) {
        btn.textContent = '📲 Agregar a pantalla de inicio';
        btn.disabled = false;
        btn.style.opacity = '';
    } else {
        btn.textContent = '📲 Cómo instalar la app';
        btn.disabled = false;
        btn.style.opacity = '';
    }
}

// Disparar el prompt de instalación o mostrar instrucciones manuales según plataforma
async function triggerA2HS() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') deferredInstallPrompt = null;
        updateA2HSButton();
    } else {
        const ua = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(ua)) {
            showToast('En Safari: tocá el ícono compartir ↑ → "Añadir a pantalla de inicio"', 'info');
        } else if (/android/.test(ua)) {
            showToast('En Chrome: tocá el menú ⋮ → "Agregar a pantalla de inicio" o "Instalar app"', 'info');
        } else {
            showToast('En Chrome/Edge: tocá el ícono ⊕ en la barra de direcciones para instalar', 'info');
        }
    }
}

// Mostrar banner sutil invitando a activar notificaciones (fallback manual)
function showPushBanner() {
    if (document.getElementById('pushBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'pushBanner';
    banner.innerHTML = `
        <span>🔔 ¿Querés recibir recordatorios aunque tengas la app cerrada?</span>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
            <button onclick="activarPushDesdeBanner()" style="background:#4CAF50;color:#fff;border:none;padding:6px 16px;border-radius:20px;font-weight:600;cursor:pointer;font-size:0.85rem;">Activar</button>
            <button onclick="cerrarPushBanner()" style="background:none;border:1px solid rgba(255,255,255,0.4);color:rgba(255,255,255,0.85);padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.85rem;">Ahora no</button>
        </div>
    `;
    banner.style.cssText = `
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        background:rgba(30,30,30,0.96); color:#fff;
        padding:14px 20px; border-radius:14px;
        font-size:0.88rem; max-width:340px; width:90%;
        z-index:9999; text-align:center;
        box-shadow:0 4px 24px rgba(0,0,0,0.4);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(banner);
    localStorage.setItem('cuidadiario_push_banner_shown', '1');
}

async function activarPushDesdeBanner() {
    cerrarPushBanner();
    await togglePushNotifications();
}

function cerrarPushBanner() {
    const b = document.getElementById('pushBanner');
    if (b) b.remove();
}

window.togglePushNotifications = togglePushNotifications;
window.activarPushDesdeBanner = activarPushDesdeBanner;
window.cerrarPushBanner = cerrarPushBanner;
window.updatePushToggleUI = updatePushToggleUI;
window.triggerA2HS = triggerA2HS;
window.updateA2HSButton = updateA2HSButton;
window.sendTestPush = sendTestPush;
window.resyncPushSubscription = resyncPushSubscription;

// ========== MODO OFFLINE: COLA DE SINCRONIZACIÓN ==========

/**
 * Procesa la cola de solicitudes que fallaron por falta de conexión.
 * Se llama cuando el navegador vuelve a estar online.
 */
async function processOfflineQueue() {
    if (!navigator.onLine) return;
    const raw = localStorage.getItem('cuidadiario_offline_queue');
    if (!raw) return;
    let queue;
    try { queue = JSON.parse(raw); } catch { queue = []; }
    if (!queue.length) return;

    console.log(`[Offline] Procesando ${queue.length} solicitud(es) encolada(s)...`);
    const failed = [];
    for (const req of queue) {
        try {
            const init = { method: req.method, headers: req.headers };
            if (req.body) init.body = req.body;
            const response = await fetch(req.url, init);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            console.log(`[Offline] Reintento OK: ${req.method} ${req.url}`);
        } catch (e) {
            console.warn(`[Offline] Reintento fallido: ${req.method} ${req.url}`, e.message);
            failed.push(req);
        }
    }
    if (failed.length) {
        localStorage.setItem('cuidadiario_offline_queue', JSON.stringify(failed));
        showToast(`${failed.length} cambio(s) pendientes no se pudieron sincronizar.`, 'warning', 5000);
    } else {
        localStorage.removeItem('cuidadiario_offline_queue');
        // Recargar datos para mostrar lo que se sincronizó
        loadDashboard().catch(() => {});
        showToast('✅ Datos sincronizados correctamente', 'success', 3000);
    }
}

// Banner de estado offline/online
function initOfflineDetection() {
    const showBanner = (msg, color) => {
        let banner = document.getElementById('offlineStatusBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'offlineStatusBanner';
            banner.style.cssText = `
                position:fixed; top:0; left:0; right:0; z-index:10000;
                padding:8px 16px; text-align:center; font-size:0.85rem;
                font-weight:600; transition:background 0.3s;
            `;
            document.body.prepend(banner);
        }
        banner.style.background = color;
        banner.style.color = '#fff';
        banner.textContent = msg;
        banner.style.display = 'block';
    };
    const hideBanner = () => {
        const b = document.getElementById('offlineStatusBanner');
        if (b) b.style.display = 'none';
    };

    window.addEventListener('offline', () => {
        showBanner('📵 Sin conexión — mostrando datos guardados', '#e53935');
    });
    window.addEventListener('online', () => {
        showBanner('✅ Conexión restaurada', '#43a047');
        setTimeout(hideBanner, 3000);
        processOfflineQueue();
    });

    // Estado inicial
    if (!navigator.onLine) {
        showBanner('📵 Sin conexión — mostrando datos guardados', '#e53935');
    }
}

// Inicializar detección offline al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfflineDetection);
} else {
    initOfflineDetection();
}



function toggleSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const btn  = document.getElementById('settingsBtn');
    if (!menu) return;
    const willOpen = menu.style.display === 'none';
    menu.style.display = willOpen ? 'block' : 'none';
    if (btn) btn.classList.toggle('open', willOpen);
}

function closeSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    const btn  = document.getElementById('settingsBtn');
    if (menu) menu.style.display = 'none';
    if (btn)  btn.classList.remove('open');
}

/**
 * Abre el modal de configuración correspondiente al tipo indicado.
 * type: 'account' | 'notif' | 'install' | 'lang'
 */
function openSettingsModal(type) {
    closeSettingsMenu();
    switch (type) {
        case 'account':
            openProfileModal();
            break;
        case 'notif': {
            const m = document.getElementById('settingsNotifModal');
            if (m) {
                m.classList.add('active');
                updatePushToggleUI();
            }
            break;
        }
        case 'install': {
            const m = document.getElementById('settingsInstallModal');
            if (m) {
                m.classList.add('active');
                updateA2HSButton();
            }
            break;
        }
        case 'lang':
            _openLangModal();
            break;
    }
}

function _openLangModal() {
    const modal = document.getElementById('settingsLangModal');
    if (!modal) return;
    modal.classList.add('active');
    const lang = (window.I18n?.lang) || localStorage.getItem('cuidadiario_lang') || 'es';
    const esBtn = document.getElementById('langEsBtn');
    const enBtn = document.getElementById('langEnBtn');
    const desc  = document.getElementById('langCurrentDesc');
    if (esBtn) esBtn.classList.toggle('active-lang', lang === 'es');
    if (enBtn) enBtn.classList.toggle('active-lang', lang === 'en');
    if (desc)  desc.textContent = lang === 'es'
        ? 'Idioma actual: Español 🇦🇷'
        : 'Current language: English 🇬🇧';
}

function selectLanguage(lang) {
    if (window.I18n) I18n.setLanguage(lang);
    _openLangModal(); // refresca estado activo de botones
    // Cerrar el modal después de un breve momento
    setTimeout(() => {
        const modal = document.getElementById('settingsLangModal');
        if (modal) modal.classList.remove('active');
    }, 700);
    showToast(lang === 'es' ? '🇦🇷 Idioma: Español' : '🇬🇧 Language: English', 'success');
}

window.toggleSettingsMenu   = toggleSettingsMenu;
window.closeSettingsMenu    = closeSettingsMenu;
window.openSettingsModal    = openSettingsModal;
window.selectLanguage       = selectLanguage;
window.navigatePrevSection  = navigatePrevSection;
window.navigateNextSection  = navigateNextSection;
