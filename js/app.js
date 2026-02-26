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
                    date: citaDate
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
                date: new Date(`${tf}T${th}`)
            });
        });
        
        // Ordenar por fecha y hora
        activities.sort((a, b) => a.date - b.date);
        
        if (activities.length === 0) {
            list.innerHTML = '<p class="empty-state">No hay actividades próximas programadas</p>';
            return;
        }
        
        list.innerHTML = activities.map(act => `
            <div class="upcoming-item">
                <div class="upcoming-time">
                    <div class="upcoming-date-label">${act.dateDisplay}</div>
                    <div>${act.time}</div>
                </div>
                <div class="upcoming-content">
                    <h4>${act.title}</h4>
                    <p>${act.subtitle}</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error cargando actividades próximas:', err);
        list.innerHTML = '<p class="empty-state">No hay actividades próximas programadas</p>';
    }
}

// ========== MEDICAMENTOS ==========
let editingMedicamentoId = null;

async function loadMedicamentos() {
    const medicamentos = await Storage.getMedicamentos();
    const container = document.getElementById('medicamentosList');
    const limits = await Storage.checkLimits();
    
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

    container.innerHTML = visibles.map(med => `
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
        </div>
    `).join('');
    
    // Cargar historial
    await loadHistorialMedicamentos();
}

async function loadHistorialMedicamentos() {
    const isPremium = Storage.getPremiumStatus();
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
    
    container.innerHTML = filtered.map(cita => {
        const citaDate = new Date(cita.fecha);
        const isPast = citaDate < now;
        
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <h3 class="item-title">${cita.titulo}</h3>
                        <p class="item-subtitle">${formatDate(cita.fecha)} - ${cita.hora}</p>
                    </div>
                    <div class="item-actions">
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
    }).join('');
}

async function filterCitas(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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

function openCitaModal() {
    if (!requirePaciente()) return;
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
    await loadCitas();
    await loadDashboard();
}

// ========== SÍNTOMAS Y SIGNOS VITALES ==========
async function loadSintomas() {
    const isPremium = Storage.getPremiumStatus();
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
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    
    if (tab === 'registros') {
        document.getElementById('sintomas-registros').classList.add('active');
    } else if (tab === 'signos') {
        document.getElementById('sintomas-signos').classList.add('active');
    } else if (tab === 'graficas') {
        if (!Storage.getPremiumStatus()) {
            showPremiumModal();
            return;
        }
        document.getElementById('sintomas-graficas').classList.add('active');
        renderGraficas();
    }
}

function renderGraficas() {
    // Implementación simplificada de gráficas
    const container = document.getElementById('chartContainer');
    const signos = Storage.getSignosVitales();
    
    if (signos.length < 3) {
        container.innerHTML = '<p class="info-message">Necesitas al menos 3 registros para generar gráficas</p>';
        return;
    }
    
    container.innerHTML = '<p class="info-message">Las gráficas visuales se pueden implementar con bibliotecas como Chart.js. Por ahora, revisa el historial de signos vitales en la pestaña anterior.</p>';
}

function openSintomaModal() {
    if (!requirePaciente()) return;
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

function registrarSigno(tipo) {
    if (!requirePaciente()) return;
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
        filtered = tareas.filter(t => t.fecha === today);
    } else if (filter === 'pendientes') {
        filtered = tareas.filter(t => !t.completada);
    } else if (filter === 'completadas') {
        filtered = tareas.filter(t => t.completada);
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
    
    container.innerHTML = filtered.map(tarea => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${tarea.titulo}</h3>
                    <p class="item-subtitle">${formatDate(tarea.fecha)}${tarea.hora ? ` - ${tarea.hora}` : ''}</p>
                </div>
                <div class="item-actions">
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
    `).join('');
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

async function filterTareas(filter) {
    await loadTareas(filter);
}

async function openTareaModal() {
    if (!requirePaciente()) return;
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
    await loadTareas();
    await loadDashboard();
}

// ========== CONTACTOS ==========
let editingContactoId = null;

async function loadContactos(filter = 'todos') {
    const contactos = await Storage.getContactos();
    const container = document.getElementById('contactosList');
    const limits = await Storage.checkLimits();
    const isPremium = Storage.getPremiumStatus();
    
    const warningDiv = document.getElementById('contactosPremiumWarning');
    if (!isPremium && limits.contactos.count >= 3) {
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }
    
    let filtered = contactos;
    if (filter !== 'todos') {
        filtered = contactos.filter(c => c.categoria === filter);
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
function updatePremiumStatus() {
    const isPremium = Storage.getPremiumStatus();
    const btnPremium = document.getElementById('btnPremium');
    const premiumStatus = document.getElementById('premiumStatus');
    const premiumText = document.getElementById('premiumText');
    
    if (isPremium) {
        premiumStatus.style.display = 'block';
        premiumStatus.innerHTML = `
            <span class="premium-badge">✓ Usuario Premium</span>
            <span style="font-size:0.82em;margin-left:12px;color:rgba(255,255,255,0.7);">
                Para cancelar: <a href="https://www.mercadopago.com.ar/subscriptions" target="_blank" style="color:#f0c040;text-decoration:underline;">MercadoPago → Mis suscripciones</a>
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
    // No hay paciente → mostrar toast y abrir modal de gestión
    showToast('Primero creá un paciente para poder registrar datos. \u{1F464}', 'warning', 4000);
    setTimeout(() => openGestionPacientesModal(), 300);
    return false;
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
    }
}

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

        if (type === 'medicamentos') {
            const meds = await Storage.getMedicamentos();
            if (!meds.length) { body.innerHTML = '<p class="empty-state">Sin medicamentos registrados</p>'; return; }
            body.innerHTML = meds.map(m => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
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
                    <strong>📅 ${c.titulo || c.medico || 'Cita'}</strong>
                    <br><small style="color:var(--text-secondary);">${formatDate(c.fecha)}${c.hora ? ' a las ' + c.hora : ''}${c.lugar ? ' — ' + c.lugar : ''}</small>
                </div>`).join('');

        } else if (type === 'tareas') {
            const tareas = await Storage.getTareas();
            const pendientes = tareas.filter(t => !t.completada && (t.fecha || '').substring(0, 10) === today);
            if (!pendientes.length) { body.innerHTML = '<p class="empty-state">Sin tareas pendientes hoy 🎉</p>'; return; }
            body.innerHTML = pendientes.map(t => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                    <strong>✓ ${t.titulo || t.nombre}</strong>
                    ${t.descripcion ? `<br><small style="color:var(--text-secondary);">${t.descripcion}</small>` : ''}
                </div>`).join('');

        } else if (type === 'registros') {
            const historial = await Storage.getHistorialMedicamentos();
            const sintomas = await Storage.getSintomas();
            const regMes = [
                ...historial.filter(h => (h.fecha || '').startsWith(thisMonth)).map(h => ({ tipo: '💊', texto: `${h.medicamento_nombre || h.medicamentoNombre} — ${h.dosis}`, fecha: h.fecha })),
                ...sintomas.filter(s => (s.fecha || '').startsWith(thisMonth)).map(s => ({ tipo: '🩺', texto: s.descripcion || s.tipo, fecha: s.fecha }))
            ].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
            if (!regMes.length) { body.innerHTML = '<p class="empty-state">Sin registros este mes</p>'; return; }
            body.innerHTML = regMes.map(r => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
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
            // Usuario Free: auto-seleccionar primer paciente para que paciente_id se asigne correctamente
            const paciente = pacientes[0] || null;
            if (paciente) {
                // Siempre actualizar currentPacienteId con el paciente real del usuario free.
                // No usar guarda "if (!currentPacienteId)" porque podría quedar con un valor
                // desactualizado si el paciente fue editado o la sesión se restauró parcialmente.
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
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon" onclick="editPaciente(${p.id})" title="Editar">&#9999;&#65039;</button>
                        ${isPremium ? `<button class="btn-icon" onclick="deletePaciente(${p.id})" title="Eliminar">&#128465;&#65039;</button>` : ''}
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
    if (paciente) openPacienteForm(paciente);
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

// ========== PERFIL DE USUARIO ==========

function openProfileModal() {
    const user = API.getUser();
    if (!user) return;
    document.getElementById('profileNombre').value = user.nombre || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profilePassword').value = '';
    document.getElementById('profilePasswordConfirm').value = '';
    // Mostrar info premium si aplica
    const premiumInfo = document.getElementById('profilePremiumInfo');
    if (premiumInfo) premiumInfo.style.display = Storage.getPremiumStatus() ? 'block' : 'none';
    document.getElementById('profileModal').classList.add('active');
    // Actualizar estado de push notifications y botón A2HS al abrir el modal
    updatePushToggleUI();
    updateA2HSButton();
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

    // Si el navegador no soporta push, ocultar la sección
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        section.style.display = 'none';
        return;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        const permission = Notification.permission;

        if (subscription && permission === 'granted') {
            btn.textContent = '🔔 Notificaciones activadas — Desactivar';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-push-active');
        } else if (permission === 'denied') {
            btn.textContent = '🔕 Permiso denegado en el navegador';
            btn.disabled = true;
            btn.style.opacity = '0.6';
        } else {
            btn.textContent = '🔔 Activar notificaciones push';
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-push-active');
            btn.disabled = false;
            btn.style.opacity = '';
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

        // Escuchar mensajes del SW (ej: pushsubscriptionchange)
        navigator.serviceWorker.addEventListener('message', async (event) => {
            if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
                try {
                    await API.savePushSubscription(event.data.subscription);
                    console.log('[Push] Suscripción actualizada en backend');
                } catch (e) { /* OK */ }
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




