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
    // Inicializar estado de la app
    updatePremiumStatus();
    setupNavigation();
    setupEventListeners();
    
    // Cargar datos iniciales
    await loadDashboard();
    loadAllSections();
    
    // Mostrar banner de bienvenida si es la primera vez
    showWelcomeBannerIfNeeded();
    
    // Configurar fecha de hoy en inputs
    setDefaultDates();
    
    // Inicializar calendario
    initCalendar();
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
    updateAlertsContainer();
    updateUpcomingActivities();
}

async function updateDashboardStats() {
    const stats = Storage.getStats();
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('dashMedCount').textContent = stats.medicamentos;
    
    // Citas próximas (esta semana)
    const citasProximas = Storage.getCitas().filter(c => {
        const citaDate = new Date(c.fecha);
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return citaDate >= new Date() && citaDate <= weekFromNow;
    });
    document.getElementById('dashCitasCount').textContent = citasProximas.length;
    
    // Tareas de hoy pendientes
    const tareasPendientes = Storage.getTareas().filter(t => 
        !t.completada && t.fecha === today
    );
    document.getElementById('dashTareasCount').textContent = tareasPendientes.length;
    
    // Registros este mes
    const thisMonth = new Date().toISOString().substring(0, 7);
    const registrosMes = Storage.getHistorialMedicamentos().filter(h => 
        h.fecha.startsWith(thisMonth)
    ).length + Storage.getSintomas().filter(s => 
        s.fecha.startsWith(thisMonth)
    ).length;
    document.getElementById('dashRegistrosCount').textContent = registrosMes;
}

async function updateAlertsContainer() {
    const container = document.getElementById('alertsContainer');
    const alerts = Notifications.getUrgentAlerts();
    
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
    const activities = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Agregar citas próximas
    await Storage.getCitas().forEach(cita => {
        const citaDate = new Date(`${cita.fecha}T${cita.hora}`);
        if (citaDate > now && citaDate <= tomorrow) {
            activities.push({
                time: cita.hora,
                title: cita.titulo,
                subtitle: `Cita - ${cita.lugar || 'Sin ubicación'}`,
                type: 'cita',
                date: citaDate
            });
        }
    });
    
    // Agregar tareas de hoy
    const today = now.toISOString().split('T')[0];
    await Storage.getTareas().filter(t => !t.completada && t.fecha === today).forEach(tarea => {
        activities.push({
            time: tarea.hora || '00:00',
            title: tarea.titulo,
            subtitle: `Tarea - ${tarea.categoria}`,
            type: 'tarea',
            date: new Date(`${tarea.fecha}T${tarea.hora || '00:00'}`)
        });
    });
    
    // Ordenar por hora
    activities.sort((a, b) => a.date - b.date);
    
    if (activities.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay actividades próximas programadas</p>';
        return;
    }
    
    list.innerHTML = activities.map(act => `
        <div class="upcoming-item">
            <div class="upcoming-time">${act.time}</div>
            <div class="upcoming-content">
                <h4>${act.title}</h4>
                <p>${act.subtitle}</p>
            </div>
        </div>
    `).join('');
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
    
    if (medicamentos.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay medicamentos registrados. Haz clic en "Agregar Medicamento" para comenzar.</p>';
        return;
    }
    
    container.innerHTML = medicamentos.map(med => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <h3 class="item-title">${med.nombre}</h3>
                    <p class="item-subtitle">${med.dosis}</p>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="registrarTomaMedicamento('${med.id}')" title="Registrar toma">✓</button>
                    <button class="btn-icon" onclick="editMedicamento('${med.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="deleteMedicamento('${med.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="item-details">
                <div class="item-detail">
                    <span class="detail-icon">⏰</span>
                    <span>${formatFrecuenciaMed(med)}</span>
                </div>
                ${med.horaInicio ? `
                <div class="item-detail">
                    <span class="detail-icon">🕐</span>
                    <span>Inicio: ${med.horaInicio}</span>
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
    loadHistorialMedicamentos();
}

function loadHistorialMedicamentos() {
    if (!Storage.getPremiumStatus()) {
        document.getElementById('medHistorial').style.display = 'none';
        return;
    }
    
    document.getElementById('medHistorial').style.display = 'block';
    const historial = Storage.getHistorialMedicamentos().slice(-50).reverse();
    const container = document.getElementById('medHistorialList');
    
    if (historial.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay registros de administración</p>';
        return;
    }
    
    container.innerHTML = historial.map(h => `
        <div class="historial-item">
            <div class="historial-info">
                <strong>${h.medicamentoNombre}</strong> - ${h.dosis}
                ${h.notas ? `<br><small>${h.notas}</small>` : ''}
            </div>
            <div class="historial-fecha">${formatDate(h.fecha)}</div>
        </div>
    `).join('');
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
    const medicamento = Storage.getMedicamentos().find(m => m.id === id);
    if (!medicamento) return;
    
    editingMedicamentoId = id;
    document.getElementById('medicamentoModalTitle').textContent = 'Editar Medicamento';
    document.getElementById('medId').value = id;
    document.getElementById('medNombre').value = medicamento.nombre;
    document.getElementById('medDosis').value = medicamento.dosis;
    document.getElementById('medFrecuencia').value = medicamento.frecuencia;
    document.getElementById('medHoraInicio').value = medicamento.horaInicio || '';
    document.getElementById('medNotas').value = medicamento.notas || '';
    document.getElementById('medRecordatorio').checked = medicamento.recordatorio || false;
    
    if (medicamento.frecuencia === 'custom') {
        document.getElementById('customHorariosGroup').style.display = 'block';
        document.getElementById('medHorariosCustom').value = medicamento.horariosCustom || '';
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
    const medicamento = Storage.getMedicamentos().find(m => m.id === id);
    if (!medicamento) return;
    
    Storage.addHistorialMedicamento({
        medicamentoId: id,
        medicamentoNombre: medicamento.nombre,
        dosis: medicamento.dosis,
        notas: ''
    });
    
    // Mostrar confirmación
    alert(`✓ Registrado: ${medicamento.nombre} - ${medicamento.dosis}`);
    await loadMedicamentos();
    await loadDashboard();
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
    const citas = await Storage.getCitas();
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
    const cita = Storage.getCitas().find(c => c.id === id);
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
        await Storage.addCita(cita);
    }
    
    closeCitaModal();
    await loadCitas();
    await loadDashboard();
}

// ========== SÍNTOMAS Y SIGNOS VITALES ==========
async function loadSintomas() {
    const isPremium = Storage.getPremiumStatus();
    const warningDiv = document.getElementById('sintomasPremiumWarning');
    
    if (!isPremium) {
        warningDiv.style.display = 'block';
        // Ocultar algunas funcionalidades
        document.querySelector('[onclick="switchSintomaTab(\'graficas\')"]').disabled = true;
    } else {
        warningDiv.style.display = 'none';
    }
    
    await renderSintomasList();
    updateSignosVitales();
}

async function renderSintomasList() {
    const sintomas = Storage.getSintomas().slice(-30).reverse();
    const container = document.getElementById('sintomasList');
    
    if (sintomas.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay síntomas registrados</p>';
        return;
    }
    
    container.innerHTML = sintomas.map(s => {
        const intensidadClass = s.intensidad > 7 ? 'badge-urgent' : s.intensidad > 4 ? 'badge-pending' : 'badge-active';
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <h3 class="item-title">${s.tipo}</h3>
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

function updateSignosVitales() {
    const signos = Storage.getSignosVitales();
    
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
    
    Storage.addSignoVital(signo);
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
    
    let filtered = tareas;
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
    const tarea = Storage.getTareas().find(t => t.id === id);
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
    const tarea = Storage.getTareas().find(t => t.id === id);
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
    
    const tarea = {
        titulo: document.getElementById('tareaTitulo').value,
        categoria: document.getElementById('tareaCategoria').value,
        frecuencia: document.getElementById('tareaFrecuencia').value,
        fecha: document.getElementById('tareaFecha').value,
        hora: document.getElementById('tareaHora').value,
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
    const contacto = Storage.getContactos().find(c => c.id === id);
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
    const warningDiv = document.getElementById('reportesPremiumWarning');
    const contentDiv = document.getElementById('reportesContent');
    
    if (!isPremium) {
        warningDiv.style.display = 'block';
        contentDiv.style.display = 'none';
    } else {
        warningDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        
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
        premiumText.textContent = 'Premium';
        btnPremium.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    } else {
        premiumStatus.style.display = 'none';
        premiumText.textContent = 'Obtener Premium';
    }
}

function showPremiumModal() {
    document.getElementById('premiumModal').classList.add('active');
}

function closePremiumModal() {
    document.getElementById('premiumModal').classList.remove('active');
}

// ========== UTILIDADES ==========
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
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

function setupEventListeners() {
    // Event listener para botón premium en header
    const btnPremium = document.getElementById('btnPremium');
    if (btnPremium) {
        btnPremium.addEventListener('click', showPremiumModal);
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



